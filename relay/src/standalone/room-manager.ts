import {
  MAX_ENVELOPE_BYTES,
  assertFreshEnvelope,
  decodeEnvelope,
  importAgentPublicKey,
  publicKeyFingerprint,
  signEnvelope,
  verifyChallengeProof,
  verifyEnvelope,
} from "../protocol.js";
import { pairingLookupId, type DashboardAccess } from "../security.js";
import { ACTION_SCOPES, HIGH_RISK, SCOPES, validScopes } from "../scopes.js";
import { currentAccess, filterEvent, validDevice } from "../index.js";
import type { StandaloneConfig } from "./config.js";
import {
  CoordinationStore,
  type PairingRegistration,
  type StoredAgentIdentity,
  type StoredDevice,
  type StoredRoom,
} from "./persistence.js";
import { NodeWebSocket } from "./websocket.js";

export type AgentKind = "PAPER" | "HOST";

export interface RelayCounters {
  startedAt: number;
  connectionsAccepted: number;
  connectionsRejected: number;
  duplicateAgentsReplaced: number;
  authenticationFailures: number;
  protocolFailures: number;
  pairingClaims: number;
  pairingClaimFailures: number;
  rateLimitedPairingClaims: number;
  messagesAccepted: number;
  messagesRejected: number;
  recentDisconnects: string[];
}

interface AgentSession {
  socket: NodeWebSocket;
  kind: AgentKind;
  serverId: string;
  authenticated: boolean;
  authenticatedAt: number;
  publicKey: string;
  fingerprint: string;
  challenge: string;
  challengeExpiry: number;
  candidate?: StoredAgentIdentity;
  sessionNonce: string;
  sequence: number;
  recent: string[];
  chain: Promise<void>;
  authTimer: ReturnType<typeof setTimeout>;
}

interface DashboardSession {
  socket: NodeWebSocket;
  access: DashboardAccess;
  rate: number[];
  transferRate: number[];
  snapshotRate: number;
  chain: Promise<void>;
}

interface PendingAction {
  deviceId: string;
  kind: AgentKind;
  action: string;
  expires: number;
}

interface PairingWaiter {
  deviceId: string;
  resolve: (value: PairingGrant | null) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface PairingGrant {
  device: StoredDevice;
  generation: number;
  revision: number;
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UTC_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;
const AGENT_EVENTS = new Set([
  "telemetry.server",
  "telemetry.system",
  "telemetry.worlds",
  "inventory.players",
  "players.presence",
  "inventory.plugins",
  "console.lines",
  "chat.message",
  "service.status",
  "backup.progress",
]);

export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  constructor(
    private readonly store: CoordinationStore,
    private readonly config: StandaloneConfig,
    readonly counters: RelayCounters,
  ) {}

  room(serverId: string): Room {
    let room = this.rooms.get(serverId);
    if (!room) {
      room = new Room(serverId, this.store.loadRoom(serverId), this.store, this.config, this.counters);
      this.rooms.set(serverId, room);
    }
    return room;
  }

  roomCount(): number {
    return this.rooms.size;
  }

  socketCounts(): { paper: number; host: number; dashboards: number; unauthenticated: number } {
    let paper = 0;
    let host = 0;
    let dashboards = 0;
    let unauthenticated = 0;
    for (const room of this.rooms.values()) {
      const counts = room.socketCounts();
      paper += counts.paper;
      host += counts.host;
      dashboards += counts.dashboards;
      unauthenticated += counts.unauthenticated;
    }
    return { paper, host, dashboards, unauthenticated };
  }

  closeAll(): void {
    for (const room of this.rooms.values()) room.closeAll();
  }
}

export class Room {
  private paper: AgentSession | null = null;
  private host: AgentSession | null = null;
  private readonly candidates = new Set<AgentSession>();
  private readonly dashboards = new Map<string, DashboardSession>();
  private readonly pending = new Map<string, PendingAction>();
  private readonly pairingWaiters = new Map<string, PairingWaiter>();
  private claiming = false;

  constructor(
    readonly serverId: string,
    private metadata: StoredRoom,
    private readonly store: CoordinationStore,
    private readonly config: StandaloneConfig,
    private readonly counters: RelayCounters,
  ) {}

  socketCounts(): { paper: number; host: number; dashboards: number; unauthenticated: number } {
    return {
      paper: this.paper?.authenticated ? 1 : 0,
      host: this.host?.authenticated ? 1 : 0,
      dashboards: this.dashboards.size,
      unauthenticated: [...this.candidates].filter((candidate) => !candidate.authenticated).length,
    };
  }

  acceptsDashboard(access: DashboardAccess): boolean {
    return this.currentAccess(access);
  }

  attachAgent(socket: NodeWebSocket, kind: AgentKind): boolean {
    if (this.socketCounts().unauthenticated >= this.config.unauthenticatedLimit) return false;
    const session: AgentSession = {
      socket,
      kind,
      serverId: this.serverId,
      authenticated: false,
      authenticatedAt: 0,
      publicKey: "",
      fingerprint: "",
      challenge: "",
      challengeExpiry: 0,
      sessionNonce: "",
      sequence: 0,
      recent: [],
      chain: Promise.resolve(),
      authTimer: setTimeout(() => {
        if (!session.authenticated) socket.close(4008, "Authentication timed out");
      }, this.config.handshakeTimeoutMs),
    };
    this.candidates.add(session);
    socket.onMessage((text) => {
      session.chain = session.chain.then(() => this.agentMessage(session, text)).catch((error) => {
        this.counters.messagesRejected += 1;
        this.counters.protocolFailures += 1;
        this.log("PROTOCOL_REJECTED", kind, messageTypeHint(text), error);
        socket.close(4008, `Protocol message rejected: ${protocolRejectionCode(error)}`);
      });
    });
    socket.onClose((code, reason) => this.agentDisconnected(session, code, reason));
    socket.onError((error) => this.log("AGENT_SOCKET_ERROR", kind, "transport", error));
    return true;
  }

  attachDashboard(socket: NodeWebSocket, access: DashboardAccess): boolean {
    if (!this.currentAccess(access) || this.dashboards.size >= this.config.dashboardLimit)
      return false;
    const existing = this.dashboards.get(access.deviceId);
    if (existing) existing.socket.close(4002, "Device reconnected");
    const session: DashboardSession = {
      socket,
      access,
      rate: [],
      transferRate: [],
      snapshotRate: 0,
      chain: Promise.resolve(),
    };
    this.dashboards.set(access.deviceId, session);
    socket.onMessage((text) => {
      session.chain = session.chain.then(() => this.dashboardMessage(session, text)).catch((error) => {
        this.counters.messagesRejected += 1;
        this.dashboardSend(session, {
          type: "relay.error",
          code: "INVALID_REQUEST",
          error: error instanceof Error ? error.message : "The request was rejected.",
        });
      });
    });
    socket.onClose((_code, _reason) => {
      if (this.dashboards.get(access.deviceId) === session) this.dashboards.delete(access.deviceId);
    });
    this.dashboardSend(session, this.ready(session));
    void this.sendToAgent("PAPER", "gateway.snapshot_request", {});
    void this.sendToAgent("HOST", "gateway.snapshot_request", {});
    return true;
  }

  async claimPairing(registration: PairingRegistration, name: string): Promise<PairingGrant | null> {
    if (
      this.claiming ||
      this.pairingWaiters.size ||
      !this.paper?.authenticated ||
      !this.metadata.currentPairing ||
      this.metadata.currentPairing.lookupId !== registration.lookupId ||
      this.metadata.currentPairing.challengeId !== registration.challengeId ||
      registration.expiresAt <= Date.now()
    )
      return null;
    this.claiming = true;
    const pending = this.metadata.currentPairing;
    delete this.metadata.currentPairing;
    this.persist();
    try {
      const deviceId = crypto.randomUUID();
      return await new Promise<PairingGrant | null>((resolve) => {
        const timer = setTimeout(() => {
          this.pairingWaiters.delete(pending.requestId);
          resolve(null);
        }, 10_000);
        this.pairingWaiters.set(pending.requestId, { deviceId, resolve, timer });
        void this.sendToAgent("PAPER", "pairing.consume", {
          requestId: pending.requestId,
          deviceId,
          name,
        }).then((sent) => {
          if (sent) return;
          clearTimeout(timer);
          this.pairingWaiters.delete(pending.requestId);
          resolve(null);
        });
      });
    } finally {
      this.claiming = false;
    }
  }

  closeAll(): void {
    this.paper?.socket.close(1001, "Relay shutting down");
    this.host?.socket.close(1001, "Relay shutting down");
    for (const candidate of this.candidates) candidate.socket.close(1001, "Relay shutting down");
    for (const dashboard of this.dashboards.values())
      dashboard.socket.close(1001, "Relay shutting down");
  }

  private async agentMessage(session: AgentSession, text: string): Promise<void> {
    if (Buffer.byteLength(text, "utf8") > MAX_ENVELOPE_BYTES)
      throw new Error("Protocol envelope is too large");
    const { envelope, body } = decodeEnvelope(text);
    assertFreshEnvelope(envelope);
    if (envelope.serverId !== this.serverId) throw new Error("Wrong room");

    if (envelope.type === "agent.hello") {
      if (session.publicKey || body.protocolVersion !== 3 || body.agentKind !== session.kind)
        throw new Error("Protocol or agent kind mismatch");
      const key = requiredText(body.publicKey, "publicKey", 512);
      const fingerprint = requiredText(body.publicKeyFingerprint, "fingerprint", 64);
      const imported = await importAgentPublicKey(key);
      if (!(await verifyEnvelope(envelope, imported)) || (await publicKeyFingerprint(key)) !== fingerprint)
        throw new Error("Invalid identity");
      if (session.kind === "HOST" && key !== this.metadata.identity?.hostPublicKey)
        throw new Error("Host identity is not locally attached");
      if (session.kind === "PAPER" && this.metadata.identity && this.metadata.identity.publicKey !== key)
        throw new Error("Room is already bound");
      session.candidate = identityFromHello(body, key, fingerprint);
      session.publicKey = key;
      session.fingerprint = fingerprint;
      session.challenge = randomToken();
      session.challengeExpiry = Date.now() + this.config.handshakeTimeoutMs;
      session.sessionNonce = requiredUuid(body._session, "session nonce");
      if (body._sequence !== 1) throw new Error("Invalid initial sequence");
      session.sequence = 1;
      session.recent = [envelope.messageId];
      await this.sendGateway(session.socket, "gateway.challenge", { nonce: session.challenge });
      this.counters.messagesAccepted += 1;
      return;
    }

    if (!session.publicKey || !(await verifyEnvelope(envelope, await importAgentPublicKey(session.publicKey))))
      throw new Error("Invalid signature");
    if (
      body._session !== session.sessionNonce ||
      !Number.isSafeInteger(body._sequence) ||
      Number(body._sequence) <= session.sequence ||
      session.recent.includes(envelope.messageId)
    )
      throw new Error("Session replay rejected");
    session.sequence = Number(body._sequence);
    session.recent = [...session.recent, envelope.messageId].slice(-32);
    delete body._session;
    delete body._sequence;

    if (envelope.type === "agent.challenge_response") {
      if (
        session.authenticated ||
        !session.challenge ||
        Date.now() > session.challengeExpiry ||
        body.nonce !== session.challenge ||
        !(await verifyChallengeProof(
          session.challenge,
          body.proof,
          await importAgentPublicKey(session.publicKey),
        )) ||
        !session.candidate
      ) {
        this.counters.authenticationFailures += 1;
        throw new Error("Challenge rejected");
      }
      if (session.kind === "PAPER") this.metadata.identity = session.candidate;
      else this.metadata.hostIdentity = session.candidate;
      session.authenticated = true;
      session.authenticatedAt = Date.now();
      session.challenge = "";
      delete session.candidate;
      clearTimeout(session.authTimer);
      this.persist();
      this.replaceAgent(session);
      await this.sendGateway(session.socket, "gateway.authenticated", {
        protocolVersion: 3,
        paired: this.metadata.paired,
        authenticatedAt: new Date().toISOString(),
      });
      this.broadcastReady();
      if (session.kind === "PAPER")
        await this.sendToAgent("HOST", "paper.connection", { connected: true });
      if (session.kind === "HOST")
        await this.sendGateway(session.socket, "paper.connection", {
          connected: Boolean(this.paper?.authenticated),
        });
      this.counters.messagesAccepted += 1;
      return;
    }

    if (!session.authenticated) throw new Error("Agent authentication required");
    if (session.kind === "HOST" && session.publicKey !== this.metadata.identity?.hostPublicKey)
      throw new Error("Host authorization changed");

    if (envelope.type === "agent.pairing_begin") {
      if (session.kind !== "PAPER") throw new Error("Only Paper issues pairing codes");
      await this.registerPairing(session, body);
      this.counters.messagesAccepted += 1;
      return;
    }
    if (envelope.type === "pairing.accepted" || envelope.type === "pairing.denied") {
      if (session.kind !== "PAPER") throw new Error("Only Paper approves grants");
      this.resolvePairing(envelope.type, body);
      this.counters.messagesAccepted += 1;
      return;
    }
    if (envelope.type === "access.sync") {
      this.applyAccessSync(session, body);
      this.counters.messagesAccepted += 1;
      return;
    }
    if (envelope.type === "backup.coordination") {
      if (session.kind !== "HOST" || this.metadata.hostIdentity?.capabilities["backup.create"] !== true)
        throw new Error("Host backups disabled");
      requiredUuid(body.requestId, "requestId");
      requiredUuid(body.leaseId, "leaseId");
      if (!["prepare", "renew", "resume"].includes(String(body.operation)))
        throw new Error("Invalid save lease operation");
      await this.sendToAgent("PAPER", "backup.coordination", body);
      this.counters.messagesAccepted += 1;
      return;
    }
    if (envelope.type === "backup.coordination.result") {
      if (session.kind !== "PAPER") throw new Error("Only Paper reports save leases");
      await this.sendToAgent("HOST", "backup.coordination.result", body);
      this.counters.messagesAccepted += 1;
      return;
    }
    if (envelope.type === "action.result") {
      this.routeActionResult(session, body);
      this.counters.messagesAccepted += 1;
      return;
    }
    if (!AGENT_EVENTS.has(envelope.type)) return;
    if (
      session.kind === "HOST" &&
      !new Set(["telemetry.system", "service.status", "backup.progress"]).has(envelope.type)
    )
      throw new Error("Event not allowed for host");
    if (envelope.type === "players.presence") validatePresenceEvent(body);
    const identity = session.kind === "HOST" ? this.metadata.hostIdentity : this.metadata.identity;
    for (const dashboard of this.dashboards.values()) {
      if (!this.currentAccess(dashboard.access)) continue;
      const filtered = filterEvent(
        envelope.type,
        body,
        dashboard.access.scopes,
        identity?.capabilities ?? {},
      );
      if (filtered)
        this.dashboardSend(dashboard, {
          type: "server.event",
          serverId: this.serverId,
          agentKind: session.kind,
          agentSession: session.sessionNonce,
          agentSequence: session.sequence,
          eventType: envelope.type,
          body: filtered,
          receivedAt: new Date().toISOString(),
        });
    }
    this.counters.messagesAccepted += 1;
  }

  private async dashboardMessage(session: DashboardSession, text: string): Promise<void> {
    if (Buffer.byteLength(text, "utf8") > 65_536) throw new Error("Request too large");
    const message: unknown = JSON.parse(text);
    if (!record(message)) throw new Error("Invalid request");
    if (!this.currentAccess(session.access)) {
      session.socket.close(4003, "Device revoked or expired");
      return;
    }
    if (message.type === "dashboard.ping") {
      this.dashboardSend(session, { type: "dashboard.pong" });
      return;
    }
    if (message.type !== "dashboard.action") throw new Error("Unknown request");
    const requestId = requiredUuid(message.requestId, "requestId");
    try {
      const action = requiredText(message.action, "action", 64);
      const scope = ACTION_SCOPES[action];
      const parameters = message.parameters;
      if (!scope || !session.access.scopes.includes(scope)) throw new Error("SCOPE_DENIED");
      if (
        !record(parameters) ||
        Object.keys(parameters).length > 16 ||
        Buffer.byteLength(JSON.stringify(parameters), "utf8") > 49_152
      )
        throw new Error("INVALID_PARAMETERS");
      validateActionParameters(action, parameters);
      const transfer = action.endsWith(".chunk");
      const now = Date.now();
      const rate = (transfer ? session.transferRate : session.rate).filter((time) => time > now - 10_000);
      if (rate.length >= (transfer ? 160 : 20)) throw new Error("RATE_LIMITED");
      if (transfer) session.transferRate = [...rate, now];
      else session.rate = [...rate, now];
      if (HIGH_RISK.has(action) && parameters.confirmed !== true)
        throw new Error("CONFIRMATION_REQUIRED");
      if (
        (action === "player.op" || action === "player.deop" || action.startsWith("backup.restore")) &&
        session.access.role !== "Owner"
      )
        throw new Error("OWNER_REQUIRED");
      let kind: AgentKind =
        action.startsWith("backup.") || (action.startsWith("server.") && action !== "server.status")
          ? "HOST"
          : "PAPER";
      if ((action.startsWith("files.") || action === "server.status") && this.host?.authenticated)
        kind = "HOST";
      if (message.agentKind !== undefined) {
        if (message.agentKind !== "PAPER" && message.agentKind !== "HOST")
          throw new Error("INVALID_PARAMETERS");
        kind = message.agentKind;
      }
      if (action.startsWith("players.") && kind !== "PAPER") throw new Error("INVALID_PARAMETERS");
      const identity = kind === "HOST" ? this.metadata.hostIdentity : this.metadata.identity;
      if (identity?.capabilities[scope] !== true) throw new Error("CAPABILITY_DISABLED");
      const agent = kind === "HOST" ? this.host : this.paper;
      if (!agent?.authenticated) throw new Error(kind === "HOST" ? "HOST_OFFLINE" : "PAPER_OFFLINE");
      if (action === "players.snapshot.request") {
        if (session.snapshotRate > now - 5_000) throw new Error("RATE_LIMITED");
        session.snapshotRate = now;
      }
      this.prunePending(now);
      if (this.pending.has(requestId)) throw new Error("DUPLICATE_REQUEST");
      const ownPending = [...this.pending.values()].filter(
        (pending) => pending.deviceId === session.access.deviceId,
      ).length;
      if (this.pending.size >= 64 || ownPending >= 32) throw new Error("BUSY");
      this.pending.set(requestId, {
        deviceId: session.access.deviceId,
        kind,
        action,
        expires: now + 15 * 60_000,
      });
      await this.sendGateway(agent.socket, "action.request", {
        requestId,
        action,
        deviceId: session.access.deviceId,
        generation: session.access.generation,
        parameters,
      });
      this.dashboardSend(session, {
        type: "dashboard.action_queued",
        requestId,
        action,
        agentKind: kind,
      });
      this.counters.messagesAccepted += 1;
    } catch (error) {
      this.dashboardSend(session, {
        type: "dashboard.action_rejected",
        requestId,
        code: error instanceof Error ? error.message : "DENIED",
        error: actionError(error),
      });
      this.counters.messagesRejected += 1;
    }
  }

  private replaceAgent(session: AgentSession): void {
    const previous = session.kind === "PAPER" ? this.paper : this.host;
    if (session.kind === "PAPER") this.paper = session;
    else this.host = session;
    if (previous && previous !== session) {
      previous.authenticated = false;
      previous.socket.close(4002, "Agent reconnected");
      this.counters.duplicateAgentsReplaced += 1;
    }
  }

  private agentDisconnected(session: AgentSession, code: number, reason: string): void {
    clearTimeout(session.authTimer);
    this.candidates.delete(session);
    const wasAuthoritative =
      (session.kind === "PAPER" && this.paper === session) ||
      (session.kind === "HOST" && this.host === session);
    if (session.kind === "PAPER" && this.paper === session) this.paper = null;
    if (session.kind === "HOST" && this.host === session) this.host = null;
    session.authenticated = false;
    this.recordDisconnect(`${session.kind}:${code}:${reason}`);
    if (wasAuthoritative) {
      this.broadcastReady();
      if (session.kind === "PAPER")
        void this.sendToAgent("HOST", "paper.connection", { connected: false });
    }
  }

  private async registerPairing(
    session: AgentSession,
    body: Record<string, unknown>,
  ): Promise<void> {
    const requestId = requiredUuid(body.requestId, "requestId");
    const code = requiredPairingCode(body.code);
    const expiresAt = Date.parse(requiredText(body.expiresAt, "expiresAt", 64));
    if (
      !validScopes(body.scopes) ||
      typeof body.role !== "string" ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now() ||
      expiresAt > Date.now() + 330_000 ||
      body.fingerprint !== this.metadata.identity?.fingerprint
    )
      throw new Error("Invalid pairing registration");
    if (this.metadata.currentPairing)
      this.store.deletePairing(this.metadata.currentPairing.lookupId);
    const registration: PairingRegistration = {
      lookupId: await pairingLookupId(code, this.config.pairingCodePepper),
      serverId: this.serverId,
      requestId,
      challengeId: crypto.randomUUID(),
      fingerprint: this.metadata.identity!.fingerprint,
      expiresAt,
    };
    if (this.store.registerPairing(registration) !== "ok") {
      await this.sendGateway(session.socket, "pairing.rejected", { requestId });
      return;
    }
    this.metadata.currentPairing = registration;
    this.persist();
    await this.sendGateway(session.socket, "pairing.registered", {
      requestId,
      challengeId: registration.challengeId,
      expiresAt: new Date(expiresAt).toISOString(),
    });
  }

  private resolvePairing(type: string, body: Record<string, unknown>): void {
    const requestId = requiredUuid(body.requestId, "requestId");
    const waiter = this.pairingWaiters.get(requestId);
    if (!waiter) return;
    clearTimeout(waiter.timer);
    this.pairingWaiters.delete(requestId);
    if (
      type === "pairing.accepted" &&
      validDevice(body.device) &&
      body.device.deviceId === waiter.deviceId &&
      Number.isSafeInteger(body.generation) &&
      Number(body.generation) > 0 &&
      Number.isSafeInteger(body.revision) &&
      Number(body.revision) > 0
    ) {
      const grant: PairingGrant = {
        device: body.device as StoredDevice,
        generation: Number(body.generation),
        revision: Number(body.revision),
      };
      const latestGeneration = this.metadata.generation;
      const latestRevision = this.metadata.revision;
      if (
        latestGeneration > grant.generation ||
        (latestGeneration === grant.generation && latestRevision > grant.revision)
      ) {
        waiter.resolve(null);
        return;
      }
      if (latestGeneration !== grant.generation) this.metadata.devices = [];
      this.metadata.generation = grant.generation;
      this.metadata.revision = grant.revision;
      this.metadata.devices = this.metadata.devices.filter(
        (device) => device.deviceId !== grant.device.deviceId,
      );
      this.metadata.devices.push(grant.device);
      this.metadata.paired = true;
      this.persist();
      waiter.resolve(grant);
      this.closeInvalidDashboards();
      this.broadcastReady();
      return;
    }
    waiter.resolve(null);
  }

  private applyAccessSync(session: AgentSession, body: Record<string, unknown>): void {
    if (
      body.protocolVersion !== 3 ||
      body.serverId !== this.serverId ||
      !Number.isSafeInteger(body.generation) ||
      Number(body.generation) < 1 ||
      !Number.isSafeInteger(body.revision) ||
      !Array.isArray(body.devices) ||
      body.devices.length > 64 ||
      !body.devices.every(validDevice)
    )
      throw new Error("Invalid access snapshot");
    const next = body.devices as StoredDevice[];
    if (
      session.kind === "HOST" &&
      (Number(body.generation) !== this.metadata.generation ||
        next.some((device) => !this.metadata.devices.some((old) => sameDevice(old, device))))
    ) {
      this.log("HOST_GRANT_CONFLICT", session.kind, "access.sync");
      return;
    }
    if (Number(body.generation) < this.metadata.generation) return;
    if (
      Number(body.generation) === this.metadata.generation &&
      Number(body.revision) < this.metadata.revision
    )
      return;
    this.metadata.generation = Number(body.generation);
    this.metadata.revision = Number(body.revision);
    this.metadata.devices = next;
    this.metadata.paired = next.some((device) => device.expiresAt * 1000 > Date.now());
    this.persist();
    this.closeInvalidDashboards();
    this.broadcastReady();
  }

  private routeActionResult(session: AgentSession, body: Record<string, unknown>): void {
    const requestId = requiredUuid(body.requestId, "requestId");
    const pending = this.pending.get(requestId);
    if (
      !pending ||
      pending.kind !== session.kind ||
      body.deviceId !== pending.deviceId ||
      body.action !== pending.action
    )
      return;
    this.pending.delete(requestId);
    const dashboard = this.dashboards.get(pending.deviceId);
    if (!dashboard || !this.currentAccess(dashboard.access)) return;
    this.dashboardSend(dashboard, {
      type: "server.event",
      serverId: this.serverId,
      agentKind: session.kind,
      eventType: "action.result",
      body,
      receivedAt: new Date().toISOString(),
    });
  }

  private currentAccess(access: DashboardAccess): boolean {
    return currentAccess(
      this.metadata as Parameters<typeof currentAccess>[0],
      access,
    );
  }

  private ready(session: DashboardSession): Record<string, unknown> {
    const capabilities: Record<string, boolean> = {};
    for (const scope of SCOPES)
      capabilities[scope] =
        session.access.scopes.includes(scope) &&
        (this.metadata.identity?.capabilities[scope] === true ||
          this.metadata.hostIdentity?.capabilities[scope] === true);
    return {
      type: "dashboard.ready",
      serverId: this.serverId,
      protocolVersion: 3,
      version: "3.1.0",
      connectionStatus: this.paper?.authenticated ? "online" : "offline",
      agents: {
        paper: Boolean(this.paper?.authenticated),
        host: Boolean(this.host?.authenticated),
        hostInstalled: Boolean(this.metadata.identity?.hostPublicKey),
      },
      device: this.metadata.devices.find((device) => device.deviceId === session.access.deviceId),
      server: {
        serverId: this.serverId,
        fingerprint: this.metadata.identity?.fingerprint ?? "",
        pluginVersion: this.metadata.identity?.pluginVersion ?? "",
        minecraftVersion: this.metadata.identity?.minecraftVersion ?? "",
        capabilities,
        paperCapabilities: this.metadata.identity?.capabilities ?? {},
        hostCapabilities: this.metadata.hostIdentity?.capabilities ?? {},
        hostVersion: this.metadata.hostIdentity?.pluginVersion ?? null,
        paperSession: this.paper?.sessionNonce,
        paired: this.metadata.paired,
      },
      receivedAt: new Date().toISOString(),
    };
  }

  private broadcastReady(): void {
    for (const dashboard of this.dashboards.values()) {
      if (this.currentAccess(dashboard.access)) this.dashboardSend(dashboard, this.ready(dashboard));
    }
  }

  private closeInvalidDashboards(): void {
    for (const dashboard of this.dashboards.values())
      if (!this.currentAccess(dashboard.access)) dashboard.socket.close(4003, "Device revoked or expired");
    if (this.host?.authenticated && this.host.publicKey !== this.metadata.identity?.hostPublicKey)
      this.host.socket.close(4003, "Host attachment revoked");
  }

  private async sendToAgent(kind: AgentKind, type: string, body: Record<string, unknown>): Promise<boolean> {
    const session = kind === "HOST" ? this.host : this.paper;
    if (!session?.authenticated) return false;
    try {
      await this.sendGateway(session.socket, type, body);
      return true;
    } catch (error) {
      this.log("PEER_DELIVERY_FAILED", kind, type, error);
      session.socket.close(1011, "Agent transport delivery failed");
      return false;
    }
  }

  private async sendGateway(
    socket: NodeWebSocket,
    type: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    const encoded = await signEnvelope(type, this.serverId, body, this.config.relayPrivateKey);
    if (!socket.send(encoded)) throw new Error("WebSocket send failed");
  }

  private dashboardSend(session: DashboardSession, body: Record<string, unknown>): void {
    if (!session.socket.send(JSON.stringify(body))) session.socket.close(1011, "Dashboard delivery failed");
  }

  private persist(): void {
    this.store.saveRoom(this.serverId, this.metadata);
  }

  private prunePending(now: number): void {
    for (const [requestId, pending] of this.pending)
      if (pending.expires <= now) this.pending.delete(requestId);
  }

  private recordDisconnect(reason: string): void {
    this.counters.recentDisconnects = [...this.counters.recentDisconnects, reason].slice(-32);
  }

  private log(code: string, kind: AgentKind, messageType: string, error?: unknown): void {
    console.warn(
      JSON.stringify({
        component: "PlexonPanelRelay",
        runtime: "standalone",
        code,
        serverId: this.serverId,
        agentKind: kind,
        messageType,
        error: error instanceof Error ? error.message : undefined,
      }),
    );
  }
}

function identityFromHello(
  body: Record<string, unknown>,
  publicKey: string,
  fingerprint: string,
): StoredAgentIdentity {
  const capabilities = record(body.capabilities) ? body.capabilities : {};
  if (Object.keys(capabilities).length > 256 || !Object.values(capabilities).every((value) => typeof value === "boolean"))
    throw new Error("Invalid capabilities");
  return {
    publicKey,
    fingerprint,
    pluginVersion: requiredText(body.pluginVersion, "pluginVersion", 128),
    paperVersion: requiredText(body.paperVersion, "paperVersion", 256),
    minecraftVersion: requiredText(body.minecraftVersion, "minecraftVersion", 64),
    javaVersion: requiredText(body.javaVersion, "javaVersion", 128),
    operatingSystem: requiredText(body.operatingSystem, "operatingSystem", 256),
    capabilities: capabilities as Record<string, boolean>,
    hostPublicKey: typeof body.hostPublicKey === "string" && body.hostPublicKey.length <= 512 ? body.hostPublicKey : "",
  };
}

function validateActionParameters(action: string, parameters: Record<string, unknown>): void {
  if (action === "players.snapshot.request") {
    if (Object.keys(parameters).length) throw new Error("INVALID_PARAMETERS");
    return;
  }
  if (action !== "players.history.list") return;
  const allowed = new Set(["query", "status", "from", "to", "cursor", "limit"]);
  if (Object.keys(parameters).some((key) => !allowed.has(key))) throw new Error("INVALID_PARAMETERS");
  if (
    parameters.query !== undefined &&
    (typeof parameters.query !== "string" || parameters.query.length > 64 || /[\0\r\n]/.test(parameters.query))
  )
    throw new Error("INVALID_PARAMETERS");
  if (parameters.status !== undefined && !["ALL", "ONLINE", "OFFLINE"].includes(String(parameters.status)))
    throw new Error("INVALID_PARAMETERS");
  const from = optionalInstant(parameters.from);
  const to = optionalInstant(parameters.to);
  if (from !== undefined && to !== undefined && to < from) throw new Error("INVALID_PARAMETERS");
  if (
    parameters.cursor !== undefined &&
    (typeof parameters.cursor !== "string" || parameters.cursor.length > 512 || !/^[A-Za-z0-9_-]*$/.test(parameters.cursor))
  )
    throw new Error("INVALID_PARAMETERS");
  if (
    parameters.limit !== undefined &&
    (!Number.isSafeInteger(parameters.limit) || Number(parameters.limit) < 1 || Number(parameters.limit) > 100)
  )
    throw new Error("INVALID_PARAMETERS");
}

function validatePresenceEvent(body: Record<string, unknown>): void {
  const allowed = new Set([
    "eventId",
    "sessionId",
    "uuid",
    "name",
    "state",
    "observedAt",
    "sessionStartedAt",
    "sessionEndedAt",
    "sessionDurationMillis",
    "termination",
    "persistenceState",
  ]);
  if (Object.keys(body).some((key) => !allowed.has(key))) throw new Error("Invalid presence event");
  requiredUuid(body.eventId, "eventId");
  requiredUuid(body.sessionId, "sessionId");
  requiredUuid(body.uuid, "uuid");
  const name = requiredText(body.name, "name", 64);
  if (/[\0-\x1f\x7f]/.test(name)) throw new Error("Invalid name");
  if (body.state !== "JOINED" && body.state !== "LEFT") throw new Error("Invalid presence state");
  const observed = strictInstant(body.observedAt, "observedAt");
  const started = strictInstant(body.sessionStartedAt, "sessionStartedAt");
  if (started > observed + 5_000) throw new Error("Invalid presence timestamps");
  if (!["OPEN", "QUIT", "KICK", "UNKNOWN_DISCONNECT"].includes(String(body.termination)))
    throw new Error("Invalid presence termination");
  if (!["DISABLED", "QUEUED", "DEGRADED"].includes(String(body.persistenceState)))
    throw new Error("Invalid persistence state");
  if (body.state === "JOINED") {
    if (body.termination !== "OPEN" || body.sessionEndedAt !== null || body.sessionDurationMillis !== null)
      throw new Error("Invalid joined presence event");
    return;
  }
  if (body.termination === "OPEN") throw new Error("Invalid left presence event");
  if (body.termination === "UNKNOWN_DISCONNECT") {
    if (body.sessionEndedAt !== null || body.sessionDurationMillis !== null)
      throw new Error("Invalid unknown disconnect");
    return;
  }
  const ended = strictInstant(body.sessionEndedAt, "sessionEndedAt");
  if (
    ended !== observed ||
    ended < started ||
    !Number.isSafeInteger(body.sessionDurationMillis) ||
    Number(body.sessionDurationMillis) !== ended - started
  )
    throw new Error("Invalid closed presence event");
}

function strictInstant(value: unknown, name: string): number {
  const text = requiredText(value, name, 40);
  const parsed = Date.parse(text);
  if (!UTC_INSTANT.test(text) || !Number.isFinite(parsed)) throw new Error(`Invalid ${name}`);
  return parsed;
}

function optionalInstant(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > 40 || !value.trim()) throw new Error("INVALID_PARAMETERS");
  const parsed = Date.parse(value);
  if (!UTC_INSTANT.test(value) || !Number.isFinite(parsed)) throw new Error("INVALID_PARAMETERS");
  return parsed;
}

function sameDevice(a: StoredDevice, b: StoredDevice): boolean {
  return (
    a.deviceId === b.deviceId &&
    a.role === b.role &&
    a.issuedAt === b.issuedAt &&
    a.expiresAt === b.expiresAt &&
    [...a.scopes].sort().join() === [...b.scopes].sort().join()
  );
}

function actionError(error: unknown): string {
  const code = error instanceof Error ? error.message : "DENIED";
  return (
    {
      SCOPE_DENIED: "Your device does not have this scope.",
      CAPABILITY_DISABLED: "This feature is disabled in local policy.",
      HOST_OFFLINE: "The host companion is not connected.",
      PAPER_OFFLINE: "The Paper agent is offline.",
      CONFIRMATION_REQUIRED: "Confirm this action first.",
      OWNER_REQUIRED: "This operation requires an Owner device.",
      RATE_LIMITED: "Too many requests. Wait a few seconds.",
      DUPLICATE_REQUEST: "This request ID was already submitted.",
      BUSY: "The relay is busy with other requests.",
    } as Record<string, string>
  )[code] ?? "The relay rejected this action.";
}

function protocolRejectionCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/wrong room/i.test(message)) return "WRONG_SERVER";
  if (/protocol|agent kind/i.test(message)) return "PROTOCOL_MISMATCH";
  if (/signature/i.test(message)) return "INVALID_SIGNATURE";
  if (/identity|room is already bound|host identity/i.test(message)) return "INVALID_IDENTITY";
  if (/replay/i.test(message)) return "SESSION_REPLAY";
  if (/initial sequence/i.test(message)) return "INVALID_INITIAL_SEQUENCE";
  if (/challenge/i.test(message)) return "CHALLENGE_REJECTED";
  if (/authentication/i.test(message)) return "AUTH_REQUIRED";
  if (/access snapshot/i.test(message)) return "ACCESS_SYNC_INVALID";
  return "INVALID_ENVELOPE";
}

function messageTypeHint(text: string): string {
  try {
    const parsed: unknown = JSON.parse(text);
    return record(parsed) && typeof parsed.type === "string" ? parsed.type.slice(0, 64) : "unknown";
  } catch {
    return "unknown";
  }
}

function requiredText(value: unknown, name: string, maximum: number): string {
  if (typeof value !== "string" || !value || value.length > maximum) throw new Error(`Invalid ${name}`);
  return value;
}

function requiredUuid(value: unknown, name: string): string {
  const text = requiredText(value, name, 64);
  if (!UUID.test(text)) throw new Error(`Invalid ${name}`);
  return text;
}

function requiredPairingCode(value: unknown): string {
  const code = requiredText(value, "pairing code", 6);
  if (!/^\d{6}$/.test(code)) throw new Error("Invalid pairing code");
  return code;
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(bytes).toString("base64url");
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

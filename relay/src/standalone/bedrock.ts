import { createHash, randomBytes } from "node:crypto";
import { FLEET_CONTRACT_ID } from "../fleet-contract.js";
import { decodeEnvelope, importAgentPublicKey, signEnvelope, verifyChallengeProof, verifyEnvelope } from "../protocol.js";
import { ACTION_CONTRACT_ID } from "../scopes.js";
import type { DashboardAccess } from "../security.js";
import { BEDROCK_CONTRACT, object, type BedrockConfig } from "./bedrock-config.js";
import { bedrockEvent } from "./bedrock-events.js";
import { audit, BedrockGrants } from "./bedrock-grants.js";
import type { StandaloneConfig } from "./config.js";
import type { NodeWebSocket } from "./websocket.js";

const SESSION = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;
const SKEW_MS = 30_000;
const HOST_IDLE_MS = 25_000;
const SNAPSHOT_COOLDOWN_MS = 5_000;
const CAPABILITIES = new Set(["bedrock.status.view", "bedrock.logs.view"]);
const EVENT_SCOPE: ReadonlyMap<string, string> = new Map([
  ["bedrock.status", "server.status"], ["bedrock.logs", "console.view.full"],
]);

interface Host {
  socket: NodeWebSocket;
  session: string;
  nonce: string;
  sequence: number;
  phase: "hello" | "proof" | "active";
  deadline: number;
  lastSeen: number;
  queue: Promise<void>;
  queued: number;
  messages: number[];
  serverName: string;
  snapshotAt: number;
}

interface Dashboard {
  socket: NodeWebSocket;
  access: DashboardAccess;
  messages: number[];
}

type RelayConfig = Pick<StandaloneConfig, "databasePath" | "relayPrivateKey" | "unauthenticatedLimit" | "handshakeTimeoutMs" | "dashboardLimit">;

export class BedrockRoom {
  readonly serverId: string;
  private readonly grants: BedrockGrants;
  private readonly key: Promise<CryptoKey>;
  private readonly fingerprint: string;
  private readonly candidates = new Set<Host>();
  private readonly devices = new Map<string, Dashboard>();
  private readonly replay = new Map<string, number>();
  private readonly latest = new Map<string, Record<string, unknown>>();
  private readonly watchdog: ReturnType<typeof setInterval>;
  private active: Host | undefined;
  private serverName = "TonimBedrock";
  private closed = false;

  constructor(private readonly registration: BedrockConfig, private readonly config: RelayConfig) {
    this.serverId = registration.serverId;
    this.grants = new BedrockGrants(config.databasePath, registration);
    this.key = importAgentPublicKey(registration.publicKey);
    this.fingerprint = createHash("sha256").update(Buffer.from(registration.publicKey, "base64"))
      .digest().subarray(0, 12).toString("hex").toUpperCase().match(/../g)!.join(":");
    this.watchdog = setInterval(() => this.expire(), 1_000);
    this.watchdog.unref();
  }

  hasHost(): boolean {
    return this.active !== undefined && this.active.socket.isOpen() && this.active.lastSeen > Date.now() - HOST_IDLE_MS;
  }

  matchesEnrollment(lookupId: string): boolean { return this.grants.matchesEnrollment(lookupId); }

  claim(lookupId: string, name: string): { access: DashboardAccess; name: string; fingerprint: string } | null {
    if (this.closed || !this.hasHost()) return null;
    const claim = this.grants.claim(lookupId, name);
    return claim ? { ...claim, fingerprint: this.fingerprint } : null;
  }

  acceptsDashboard(access: DashboardAccess): boolean { return !this.closed && this.grants.device(access) !== null; }

  attachAgent(socket: NodeWebSocket): boolean {
    if (this.closed || this.candidates.size >= this.config.unauthenticatedLimit) return false;
    const host: Host = {
      socket, session: "", nonce: "", sequence: 0, phase: "hello", deadline: Date.now() + this.config.handshakeTimeoutMs,
      lastSeen: 0, queue: Promise.resolve(), queued: 0, messages: [], serverName: "", snapshotAt: 0,
    };
    this.candidates.add(host);
    socket.onClose(() => this.detach(host));
    socket.onError(() => socket.close(1011, "Bedrock host transport failed"));
    socket.onMessage((text) => {
      if (host.queued >= 8 || !takeMessage(host.messages, 16)) {
        socket.close(4008, "Bedrock host rate exceeded");
        return;
      }
      host.queued += 1;
      host.queue = host.queue.then(() => this.receiveHost(host, text)).catch(() => {
        audit("BEDROCK_HOST_MESSAGE_REJECTED", this.serverId);
        socket.close(4008, "Bedrock host message rejected");
      }).finally(() => { host.queued -= 1; });
    });
    return true;
  }

  attachDashboard(socket: NodeWebSocket, access: DashboardAccess): boolean {
    if (!this.acceptsDashboard(access) || (!this.devices.has(access.deviceId) && this.devices.size >= this.config.dashboardLimit))
      return false;
    this.devices.get(access.deviceId)?.socket.close(4002, "Device reconnected");
    const device: Dashboard = { socket, access, messages: [] };
    this.devices.set(access.deviceId, device);
    socket.onClose(() => {
      if (this.devices.get(access.deviceId) === device) this.devices.delete(access.deviceId);
    });
    socket.onError(() => socket.close(1011, "Bedrock dashboard transport failed"));
    socket.onMessage((text) => this.receiveDashboard(device, text));
    this.ready(device);
    for (const [type, event] of this.latest) {
      const body = event.body;
      if (object(body) && typeof body.capturedAt === "string" && Date.parse(body.capturedAt) > Date.now() - SKEW_MS)
        this.deliver(device, type, event);
    }
    if (this.active) this.requestSnapshot(this.active);
    return true;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.watchdog);
    for (const candidate of this.candidates) candidate.socket.close(1001, "Relay shutting down");
    this.active?.socket.close(1001, "Relay shutting down");
    for (const device of this.devices.values()) device.socket.close(1001, "Relay shutting down");
    this.grants.close();
  }

  private async receiveHost(host: Host, text: string): Promise<void> {
    if (!this.attached(host)) return;
    const { envelope, body } = decodeEnvelope(text);
    const now = Date.now();
    const time = UTC_INSTANT.test(envelope.timestamp) ? Date.parse(envelope.timestamp) : Number.NaN;
    if (envelope.serverId !== this.serverId || !Number.isFinite(time) || Math.abs(now - time) > SKEW_MS ||
        body.bedrockContract !== BEDROCK_CONTRACT || body.nodeId !== this.registration.nodeId ||
        body.instanceKey !== this.registration.instanceKey || typeof body._session !== "string" || !SESSION.test(body._session) ||
        typeof body._sequence !== "number" || !Number.isSafeInteger(body._sequence) || body._sequence <= host.sequence ||
        (host.session && body._session !== host.session) || this.replay.has(envelope.messageId))
      throw new Error("Invalid signed host identity, session or envelope freshness");
    const key = await this.key;
    if (!await verifyEnvelope(envelope, key)) throw new Error("Invalid Bedrock host signature");
    if (!this.attached(host)) return;
    if (this.replay.has(envelope.messageId) || this.replay.size >= 4096) throw new Error("Replayed host envelope");
    this.replay.set(envelope.messageId, now + 2 * SKEW_MS);
    host.sequence = body._sequence;

    if (host.phase === "hello") {
      const advertised = body.capabilities;
      if (host.sequence !== 1 || envelope.type !== "agent.hello" || body.protocolVersion !== 3 ||
          body.agentKind !== "BEDROCK_HOST" || body.publicKey !== this.registration.publicKey ||
          body.publicKeyFingerprint !== this.fingerprint || body.fleetContract !== FLEET_CONTRACT_ID ||
          body.edition !== "BEDROCK" || body.runtime !== "DOCKER" || typeof body.serverName !== "string" ||
          !/^[\p{L}\p{N} ._()-]{1,64}$/u.test(body.serverName) || !Array.isArray(advertised) ||
          advertised.length !== CAPABILITIES.size || ![...CAPABILITIES].every((id) => advertised.includes(id)))
        throw new Error("Invalid Bedrock host hello");
      host.session = body._session;
      host.serverName = body.serverName;
      host.nonce = randomBytes(32).toString("base64url");
      host.phase = "proof";
      await this.sendHost(host, "gateway.challenge", { nonce: host.nonce });
      return;
    }

    if (host.phase === "proof") {
      if (host.sequence !== 2 || envelope.type !== "agent.challenge_response" || body.nonce !== host.nonce ||
          now >= host.deadline || !await verifyChallengeProof(host.nonce, body.proof, key))
        throw new Error("Invalid Bedrock host challenge proof");
      if (!this.attached(host) || Date.now() >= host.deadline) return;
      await this.sendHost(host, "gateway.authenticated", { nonce: host.nonce, protocolVersion: 3 });
      if (!this.attached(host) || Date.now() >= host.deadline) return;
      const previous = this.active;
      this.active = host;
      host.phase = "active";
      this.candidates.delete(host);
      this.serverName = host.serverName;
      host.lastSeen = Date.now();
      this.latest.clear();
      previous?.socket.close(4002, "Bedrock host reconnected");
      audit("BEDROCK_HOST_AUTHENTICATED", this.serverId);
      this.refreshDevices();
      return;
    }

    if (body.edition !== "BEDROCK" || body.runtime !== "DOCKER" || !EVENT_SCOPE.has(envelope.type))
      throw new Error("Unsupported Bedrock Host event");
    const checked = bedrockEvent(envelope.type, body, now);
    const prior = this.latest.get(envelope.type)?.body;
    if (object(prior) && Date.parse(String(checked.capturedAt)) <= Date.parse(String(prior.capturedAt))) return;
    host.lastSeen = now;
    const event = {
      type: "server.event", serverId: this.serverId, agentKind: "HOST", agentSession: host.session,
      agentSequence: host.sequence, eventType: envelope.type, body: checked, receivedAt: new Date(now).toISOString(),
    };
    this.latest.set(envelope.type, event);
    for (const device of this.devices.values()) this.deliver(device, envelope.type, event);
  }

  private attached(host: Host): boolean {
    return !this.closed && host.socket.isOpen() && (this.active === host || this.candidates.has(host));
  }

  private async sendHost(host: Host, type: string, fields: Record<string, unknown>): Promise<void> {
    const envelope = await signEnvelope(type, this.serverId, {
      ...fields, bedrockContract: BEDROCK_CONTRACT, _session: host.session,
      nodeId: this.registration.nodeId, instanceKey: this.registration.instanceKey,
    }, this.config.relayPrivateKey);
    if (!this.attached(host) || !host.socket.send(envelope)) throw new Error("Cannot deliver Bedrock host envelope");
  }

  private requestSnapshot(host: Host): void {
    const now = Date.now();
    if (now - host.snapshotAt < SNAPSHOT_COOLDOWN_MS) return;
    host.snapshotAt = now;
    void this.sendHost(host, "gateway.snapshot_request", {}).catch(() => host.socket.close(1011, "Snapshot request failed"));
  }

  private receiveDashboard(device: Dashboard, text: string): void {
    if (!this.acceptsDashboard(device.access)) {
      device.socket.close(4003, "Device revoked or expired");
      return;
    }
    if (!takeMessage(device.messages, 10)) {
      device.socket.close(4008, "Dashboard message rate exceeded");
      return;
    }
    try {
      const message: unknown = JSON.parse(text);
      if (object(message) && message.type === "dashboard.ping" && Object.keys(message).length === 1) {
        this.send(device, { type: "dashboard.pong" });
        return;
      }
    } catch {
      // Unrecognized and malformed input have the same read-only response.
    }
    this.send(device, { type: "relay.error", code: "BEDROCK_READ_ONLY", error: "This Bedrock room supports monitoring only." });
  }

  private deliver(device: Dashboard, type: string, event: Record<string, unknown>): void {
    if (!this.acceptsDashboard(device.access)) {
      device.socket.close(4003, "Device revoked or expired");
      return;
    }
    const scope = EVENT_SCOPE.get(type);
    if (scope && device.access.scopes.includes(scope)) this.send(device, event);
  }

  private ready(dashboard: Dashboard): void {
    const access = dashboard.access;
    const device = this.grants.device(access);
    if (!device) {
      dashboard.socket.close(4003, "Device revoked or expired");
      return;
    }
    const online = this.hasHost();
    const capabilities = { "server.status": true, "console.view.full": true };
    this.send(dashboard, {
      type: "dashboard.ready", serverId: this.serverId, protocolVersion: 3, version: BEDROCK_CONTRACT,
      actionContract: ACTION_CONTRACT_ID, connectionStatus: online ? "online" : "offline",
      consoleAuthority: online ? "HOST" : "UNAVAILABLE",
      agents: { paper: false, host: online, hostInstalled: true },
      device: { ...device, role: access.role, scopes: access.scopes, lastSeen: Math.floor(Date.now() / 1000) },
      server: {
        serverId: this.serverId, nodeId: this.registration.nodeId, instanceKey: this.registration.instanceKey,
        serverName: this.serverName, fleetContract: FLEET_CONTRACT_ID, fleetState: "BOUND", fingerprint: this.fingerprint,
        edition: "BEDROCK", runtime: "DOCKER", roomMode: "HOST_ONLY", bedrockContract: BEDROCK_CONTRACT, paired: true,
        hostSession: online ? this.active?.session : undefined, pluginVersion: "", hostVersion: null, minecraftVersion: "",
        capabilities, paperCapabilities: {}, hostCapabilities: capabilities,
        paperTargetCompatible: false, hostTargetCompatible: false,
      },
      receivedAt: new Date().toISOString(),
    });
  }

  private refreshDevices(): void {
    if (!this.closed) for (const device of this.devices.values()) this.ready(device);
  }

  private send(dashboard: Dashboard, message: Record<string, unknown>): void {
    if (!dashboard.socket.send(JSON.stringify(message))) dashboard.socket.close(1011, "Bedrock dashboard delivery failed");
  }

  private detach(host: Host): void {
    this.candidates.delete(host);
    if (this.active !== host) return;
    this.active = undefined;
    this.latest.clear();
    this.refreshDevices();
  }

  private expire(): void {
    const now = Date.now();
    for (const [id, expiry] of this.replay) if (expiry <= now) this.replay.delete(id);
    for (const host of this.candidates) if (host.deadline <= now) host.socket.close(4008, "Bedrock handshake expired");
    if (this.active && this.active.lastSeen < now - HOST_IDLE_MS) this.active.socket.close(4008, "Bedrock host samples expired");
    for (const device of this.devices.values()) {
      if (!this.acceptsDashboard(device.access)) device.socket.close(4003, "Device revoked or expired");
    }
  }
}

function takeMessage(window: number[], maximum: number): boolean {
  const now = Date.now();
  while (window.length && window[0]! <= now - 5_000) window.shift();
  if (window.length >= maximum) return false;
  window.push(now);
  return true;
}

import {
  MAX_ENVELOPE_BYTES,
  assertFreshEnvelope,
  decodeEnvelope,
  importAgentPublicKey,
  publicKeyFingerprint,
  signEnvelope,
  verifyChallengeProof,
  verifyEnvelope,
} from "./protocol.js";
import {
  normalizePairingCode,
  opaqueClientKey,
  pairingLookupId,
  signDashboardAccess,
  verifyDashboardAccess,
} from "./security.js";

interface Env {
  SERVER_ROOMS: DurableObjectNamespace;
  PAIRING_DIRECTORY: DurableObjectNamespace;
  DASHBOARD_ORIGINS: string;
  PAIRING_CODE_PEPPER: string;
  ACCESS_TOKEN_SECRET: string;
  GATEWAY_ED25519_PRIVATE_KEY: string;
  GATEWAY_ED25519_PUBLIC_KEY: string;
}

interface AgentIdentity {
  publicKey: string;
  fingerprint: string;
  pluginVersion: string;
  paperVersion: string;
  minecraftVersion: string;
  javaVersion: string;
  operatingSystem: string;
  capabilities: Record<string, boolean>;
}

interface PairingRegistration {
  lookupId: string;
  serverId: string;
  requestId: string;
  challengeId: string;
  fingerprint: string;
  expiresAt: number;
}

interface RoomMetadata {
  identity?: AgentIdentity;
  paired: boolean;
  generation: number;
  currentPairing?: PairingRegistration;
}

interface SocketAttachment {
  role: "agent" | "dashboard";
  serverId: string;
  deviceId?: string;
  generation?: number;
  authenticated?: boolean;
  publicKey?: string;
  fingerprint?: string;
  challenge?: string;
  recentMessageIds?: string[];
}

interface DirectoryRate {
  windowStartedAt: number;
  attempts: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTION = /^[a-z][a-z0-9_.-]{0,63}$/;
const AGENT_EVENTS = new Set([
  "telemetry.server",
  "telemetry.system",
  "inventory.players",
  "inventory.plugins",
  "console.lines",
  "chat.message",
  "action.result",
]);
const METADATA_KEY = "room-metadata";
const DIRECTORY_NAME = "pairing-directory-v1";
const INTERNAL_HEADER = "X-Plexon-Internal";
const TOKEN_LIFETIME_SECONDS = 30 * 24 * 60 * 60;

const relayWorker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/healthz") {
      return json({
        ok: true,
        service: "plexonpanel-relay",
        protocolVersion: 2,
        storage: "coordination-only",
        gatewayPublicKey: env.GATEWAY_ED25519_PUBLIC_KEY,
      }, 200, corsHeaders(request, env));
    }
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, env) });

    if (request.method === "POST" && url.pathname === "/v1/pairings/claim") {
      if (!dashboardOriginAllowed(request, env)) {
        return json({ ok: false, error: "Dashboard origin is not allowed" }, 403, corsHeaders(request, env));
      }
      const contentLength = Number(request.headers.get("content-length") ?? "0");
      if (contentLength > 4096) return json({ ok: false, error: "Request is too large" }, 413, corsHeaders(request, env));
      let body: Record<string, unknown>;
      try {
        const decoded = await request.json();
        if (!isRecord(decoded)) throw new Error("Pairing request must be an object");
        body = decoded;
      } catch {
        return json({ ok: false, error: "Pairing request is not valid JSON" }, 400, corsHeaders(request, env));
      }
      let code: string;
      try {
        code = normalizePairingCode(body.code);
      } catch {
        return json({ ok: false, error: "Enter the six-digit code shown by the plugin." }, 400, corsHeaders(request, env));
      }
      const clientAddress = request.headers.get("CF-Connecting-IP") ?? "unknown";
      const clientKey = await opaqueClientKey(clientAddress, env.PAIRING_CODE_PEPPER);
      const directory = env.PAIRING_DIRECTORY.get(env.PAIRING_DIRECTORY.idFromName(DIRECTORY_NAME));
      const resolutionResponse = await directory.fetch(internalRequest("/resolve", env, {
        code,
        clientKey,
      }));
      if (!resolutionResponse.ok) {
        const status = resolutionResponse.status === 429 ? 429 : 403;
        const error = status === 429 ? "Too many pairing attempts. Wait a few minutes and try again." : "Invalid or expired pairing code.";
        return json({ ok: false, error }, status, corsHeaders(request, env));
      }
      const registration = await resolutionResponse.json() as PairingRegistration;
      const room = env.SERVER_ROOMS.get(env.SERVER_ROOMS.idFromName(registration.serverId));
      const claimResponse = await room.fetch(internalRequest("/claim", env, {
        lookupId: registration.lookupId,
        challengeId: registration.challengeId,
      }));
      if (!claimResponse.ok) {
        return json({ ok: false, error: "Invalid or expired pairing code." }, 403, corsHeaders(request, env));
      }
      const claim = await claimResponse.json() as { generation: number; fingerprint: string };
      await directory.fetch(internalRequest("/delete", env, { lookupId: registration.lookupId }));
      const now = Math.floor(Date.now() / 1000);
      const deviceId = crypto.randomUUID();
      const accessToken = await signDashboardAccess({
        version: 1,
        audience: "plexonpanel-relay",
        serverId: registration.serverId,
        deviceId,
        generation: claim.generation,
        issuedAt: now,
        expiresAt: now + TOKEN_LIFETIME_SECONDS,
      }, env.ACCESS_TOKEN_SECRET);
      const websocketUrl = new URL("/v1/dashboard", request.url);
      websocketUrl.protocol = websocketUrl.protocol === "https:" ? "wss:" : "ws:";
      return json({
        ok: true,
        serverId: registration.serverId,
        deviceId,
        fingerprint: claim.fingerprint,
        accessToken,
        expiresAt: new Date((now + TOKEN_LIFETIME_SECONDS) * 1000).toISOString(),
        websocketUrl: websocketUrl.toString(),
      }, 200, corsHeaders(request, env));
    }

    if (request.method === "GET" && url.pathname === "/v1/dashboard/session") {
      if (!dashboardOriginAllowed(request, env)) {
        return json({ ok: false, error: "Dashboard origin is not allowed" }, 403, corsHeaders(request, env));
      }
      const authorization = request.headers.get("Authorization") ?? "";
      if (!authorization.startsWith("Bearer ")) {
        return json({ ok: false, error: "Dashboard credential is required" }, 401, corsHeaders(request, env));
      }
      let access;
      try {
        access = await verifyDashboardAccess(authorization.slice(7), env.ACCESS_TOKEN_SECRET);
      } catch {
        return json({ ok: false, error: "Dashboard credential is invalid or expired" }, 401, corsHeaders(request, env));
      }
      const room = env.SERVER_ROOMS.get(env.SERVER_ROOMS.idFromName(access.serverId));
      const validation = await room.fetch(internalRequest("/validate", env, { generation: access.generation }));
      if (!validation.ok) {
        return json({ ok: false, error: "Dashboard device was revoked" }, 401, corsHeaders(request, env));
      }
      return json({ ok: true, serverId: access.serverId, expiresAt: new Date(access.expiresAt * 1000).toISOString() }, 200, corsHeaders(request, env));
    }

    if (request.method === "GET" && url.pathname === "/v1/agent") {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json({ ok: false, error: "WebSocket required" }, 426);
      if (request.headers.get("X-PlexonPanel-Protocol") !== "2") return json({ ok: false, error: "Protocol v2 required" }, 426);
      const serverId = url.searchParams.get("serverId") ?? "";
      if (!UUID.test(serverId)) return json({ ok: false, error: "Invalid server ID" }, 400);
      return roomFetch(request, env, serverId, { role: "agent" });
    }

    if (request.method === "GET" && url.pathname === "/v1/dashboard") {
      if (!dashboardOriginAllowed(request, env)) {
        return json({ ok: false, error: "Dashboard origin is not allowed" }, 403, corsHeaders(request, env));
      }
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json({ ok: false, error: "WebSocket required" }, 426);
      const protocols = (request.headers.get("Sec-WebSocket-Protocol") ?? "").split(",").map((value) => value.trim());
      const authentication = protocols.find((value) => value.startsWith("auth."));
      if (!protocols.includes("plexonpanel-v2") || !authentication) return json({ ok: false, error: "Authentication required" }, 401);
      let access;
      try {
        access = await verifyDashboardAccess(authentication.slice(5), env.ACCESS_TOKEN_SECRET);
      } catch {
        return json({ ok: false, error: "Dashboard credential is invalid or expired" }, 401);
      }
      return roomFetch(request, env, access.serverId, {
        role: "dashboard",
        deviceId: access.deviceId,
        generation: String(access.generation),
      });
    }

    return json({ ok: false, error: "Route not found" }, 404, corsHeaders(request, env));
  },
};

export default relayWorker;

export class PairingDirectory {
  constructor(private readonly state: DurableObjectState, private readonly env: Env) {}

  async fetch(request: Request): Promise<Response> {
    if (!authorizedInternal(request, this.env)) return json({ ok: false }, 403);
    const url = new URL(request.url);
    const body = await request.json() as Record<string, unknown>;
    if (url.pathname === "/register") {
      const code = normalizePairingCode(body.code);
      const lookupId = await pairingLookupId(code, this.env.PAIRING_CODE_PEPPER);
      const registration = registrationFrom(body, lookupId);
      const key = `code:${lookupId}`;
      const existing = await this.state.storage.get<PairingRegistration>(key);
      if (existing && existing.expiresAt > Date.now() && existing.serverId !== registration.serverId) {
        return json({ ok: false, error: "Pairing code collision" }, 409);
      }
      await this.state.storage.put(key, registration);
      await this.scheduleCleanup(registration.expiresAt);
      return json({ ok: true, lookupId });
    }
    if (url.pathname === "/resolve") {
      const clientKey = requiredText(body.clientKey, "clientKey", 128);
      if (!await this.consumeRateLimit(clientKey)) return json({ ok: false }, 429);
      const code = normalizePairingCode(body.code);
      const lookupId = await pairingLookupId(code, this.env.PAIRING_CODE_PEPPER);
      const registration = await this.state.storage.get<PairingRegistration>(`code:${lookupId}`);
      if (!registration || registration.expiresAt <= Date.now()) {
        if (registration) await this.state.storage.delete(`code:${lookupId}`);
        return json({ ok: false }, 404);
      }
      return json(registration);
    }
    if (url.pathname === "/delete") {
      const lookupId = requiredText(body.lookupId, "lookupId", 128);
      await this.state.storage.delete(`code:${lookupId}`);
      return json({ ok: true });
    }
    return json({ ok: false }, 404);
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    const entries = await this.state.storage.list<PairingRegistration | DirectoryRate>();
    let next = Number.POSITIVE_INFINITY;
    const expired: string[] = [];
    for (const [key, value] of entries) {
      const expiresAt = key.startsWith("code:")
        ? (value as PairingRegistration).expiresAt
        : (value as DirectoryRate).windowStartedAt + 15 * 60_000;
      if (expiresAt <= now) expired.push(key);
      else next = Math.min(next, expiresAt);
    }
    if (expired.length) await this.state.storage.delete(expired);
    if (Number.isFinite(next)) await this.state.storage.setAlarm(next);
    else await this.state.storage.deleteAlarm();
  }

  private async consumeRateLimit(clientKey: string): Promise<boolean> {
    const key = `rate:${clientKey}`;
    const now = Date.now();
    const existing = await this.state.storage.get<DirectoryRate>(key);
    const current = !existing || now - existing.windowStartedAt >= 15 * 60_000
      ? { windowStartedAt: now, attempts: 0 }
      : existing;
    if (current.attempts >= 10) return false;
    current.attempts += 1;
    await this.state.storage.put(key, current);
    await this.scheduleCleanup(current.windowStartedAt + 15 * 60_000);
    return true;
  }

  private async scheduleCleanup(timestamp: number): Promise<void> {
    const existing = await this.state.storage.getAlarm();
    if (existing === null || timestamp < existing) await this.state.storage.setAlarm(timestamp);
  }
}

export class ServerRoom {
  constructor(private readonly state: DurableObjectState, private readonly env: Env) {}

  async fetch(request: Request): Promise<Response> {
    if (!authorizedInternal(request, this.env)) return json({ ok: false }, 403);
    const url = new URL(request.url);
    if (url.pathname === "/validate") {
      const body = await request.json() as Record<string, unknown>;
      const generation = Number(body.generation);
      const metadata = await this.metadata();
      return metadata.paired && Number.isInteger(generation) && generation === metadata.generation
        ? json({ ok: true })
        : json({ ok: false }, 403);
    }
    if (url.pathname === "/claim") {
      const body = await request.json() as Record<string, unknown>;
      const lookupId = requiredText(body.lookupId, "lookupId", 128);
      const challengeId = requiredText(body.challengeId, "challengeId", 64);
      const metadata = await this.metadata();
      const pending = metadata.currentPairing;
      if (!pending || pending.expiresAt <= Date.now() || pending.lookupId !== lookupId || pending.challengeId !== challengeId) {
        return json({ ok: false }, 403);
      }
      metadata.paired = true;
      delete metadata.currentPairing;
      await this.state.storage.put(METADATA_KEY, metadata);
      await this.sendToAgent("pairing.complete", {
        pairedAt: new Date().toISOString(),
        restored: false,
      });
      return json({ generation: metadata.generation, fingerprint: metadata.identity?.fingerprint ?? "unknown" });
    }

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json({ ok: false }, 426);
    const role = request.headers.get("X-Plexon-Role");
    const serverId = request.headers.get("X-Plexon-Server-Id") ?? "";
    if ((role !== "agent" && role !== "dashboard") || !UUID.test(serverId)) return json({ ok: false }, 400);
    const metadata = await this.metadata();
    if (role === "dashboard") {
      const generation = Number(request.headers.get("X-Plexon-Generation"));
      if (!metadata.paired || generation !== metadata.generation) return json({ ok: false, error: "Dashboard device was revoked" }, 403);
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const attachment: SocketAttachment = role === "agent"
      ? { role, serverId, authenticated: false, recentMessageIds: [] }
      : {
          role,
          serverId,
          deviceId: request.headers.get("X-Plexon-Device-Id") ?? "unknown",
          generation: metadata.generation,
        };
    server.serializeAttachment(attachment);
    this.state.acceptWebSocket(server, [role]);

    if (role === "dashboard") {
      server.send(JSON.stringify({
        type: "dashboard.ready",
        serverId,
        connectionStatus: this.authenticatedAgents().length ? "online" : "offline",
        server: metadata.identity ? {
          serverId,
          fingerprint: metadata.identity.fingerprint,
          pluginVersion: metadata.identity.pluginVersion,
          minecraftVersion: metadata.identity.minecraftVersion,
          capabilities: metadata.identity.capabilities,
          paired: metadata.paired,
        } : { serverId, paired: metadata.paired },
        receivedAt: new Date().toISOString(),
      }));
      await this.sendToAgent("gateway.snapshot_request", { requestedAt: new Date().toISOString() });
    }
    return new Response(null, {
      status: 101,
      webSocket: client,
      ...(role === "dashboard" ? { headers: { "Sec-WebSocket-Protocol": "plexonpanel-v2" } } : {}),
    });
  }

  async webSocketMessage(socket: WebSocket, message: ArrayBuffer | string): Promise<void> {
    const attachment = socket.deserializeAttachment() as SocketAttachment;
    try {
      if (typeof message !== "string") throw new Error("Binary messages are not supported");
      if (new TextEncoder().encode(message).byteLength > MAX_ENVELOPE_BYTES) throw new Error("Message is too large");
      if (attachment.role === "agent") await this.handleAgentMessage(socket, attachment, message);
      else await this.handleDashboardMessage(socket, attachment, message);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Message rejected";
      if (attachment.role === "agent") socket.close(4008, "Protocol message rejected");
      else {
        try {
          socket.send(JSON.stringify({ type: "relay.error", error: reason }));
        } catch {
          // The hibernation runtime will remove an already closed dashboard.
        }
      }
    }
  }

  async webSocketClose(socket: WebSocket, code: number, reason: string): Promise<void> {
    const attachment = socket.deserializeAttachment() as SocketAttachment;
    this.broadcastAgentOfflineIfLast(socket, attachment);
    void code;
    void reason;
  }

  async webSocketError(socket: WebSocket, error: unknown): Promise<void> {
    const attachment = socket.deserializeAttachment() as SocketAttachment;
    this.broadcastAgentOfflineIfLast(socket, attachment);
    void error;
  }

  private async handleAgentMessage(socket: WebSocket, attachment: SocketAttachment, text: string): Promise<void> {
    const decoded = decodeEnvelope(text);
    assertFreshEnvelope(decoded.envelope);
    if (decoded.envelope.serverId !== attachment.serverId) throw new Error("Server ID mismatch");
    const metadata = await this.metadata();

    if (decoded.envelope.type === "agent.hello") {
      if (attachment.publicKey) throw new Error("Agent hello was already accepted on this connection");
      if (decoded.body.protocolVersion !== 2) throw new Error("Protocol v2 is required");
      const publicKeyBase64 = requiredText(decoded.body.publicKey, "publicKey", 512);
      const publicKey = await importAgentPublicKey(publicKeyBase64);
      if (!await verifyEnvelope(decoded.envelope, publicKey)) throw new Error("Invalid agent hello signature");
      const fingerprint = requiredText(decoded.body.publicKeyFingerprint, "publicKeyFingerprint", 64);
      if (await publicKeyFingerprint(publicKeyBase64) !== fingerprint) throw new Error("Agent fingerprint mismatch");
      if (metadata.identity && (metadata.identity.publicKey !== publicKeyBase64 || metadata.identity.fingerprint !== fingerprint)) {
        throw new Error("Server ID is already bound to another identity");
      }
      metadata.identity = identityFromHello(decoded.body, publicKeyBase64, fingerprint);
      await this.state.storage.put(METADATA_KEY, metadata);
      const challenge = randomToken(32);
      attachment.publicKey = publicKeyBase64;
      attachment.fingerprint = fingerprint;
      attachment.challenge = challenge;
      attachment.authenticated = false;
      attachment.recentMessageIds = [decoded.envelope.messageId];
      socket.serializeAttachment(attachment);
      await this.sendGateway(socket, attachment.serverId, "gateway.challenge", { nonce: challenge });
      return;
    }

    const publicKeyBase64 = attachment.publicKey ?? metadata.identity?.publicKey;
    if (!publicKeyBase64) throw new Error("Agent identity is not established");
    const publicKey = await importAgentPublicKey(publicKeyBase64);
    if (!await verifyEnvelope(decoded.envelope, publicKey)) throw new Error("Invalid agent signature");
    const recent = attachment.recentMessageIds ?? [];
    if (recent.includes(decoded.envelope.messageId)) throw new Error("Replayed protocol message");
    attachment.recentMessageIds = [...recent, decoded.envelope.messageId].slice(-128);

    if (decoded.envelope.type === "agent.challenge_response") {
      const nonce = requiredText(decoded.body.nonce, "nonce", 128);
      if (!attachment.challenge || nonce !== attachment.challenge
          || !await verifyChallengeProof(nonce, decoded.body.proof, publicKey)) {
        throw new Error("Invalid agent challenge proof");
      }
      attachment.authenticated = true;
      delete attachment.challenge;
      socket.serializeAttachment(attachment);
      for (const other of this.authenticatedAgents()) {
        if (other !== socket) other.close(4002, "Replaced by a newer authenticated agent connection");
      }
      await this.sendGateway(socket, attachment.serverId, "gateway.authenticated", {
        authenticatedAt: new Date().toISOString(),
        paired: metadata.paired,
      });
      if (metadata.paired) {
        await this.sendGateway(socket, attachment.serverId, "pairing.complete", {
          restored: true,
          pairedAt: new Date().toISOString(),
        });
      }
      this.broadcastDashboards({
        type: "server.connection",
        serverId: attachment.serverId,
        connectionStatus: "online",
        receivedAt: new Date().toISOString(),
      });
      return;
    }

    socket.serializeAttachment(attachment);
    if (!attachment.authenticated) throw new Error("Agent authentication is required");
    if (decoded.envelope.type === "agent.pairing_begin") {
      await this.registerPairing(socket, attachment, metadata, decoded.body);
      return;
    }
    if (decoded.envelope.type === "agent.unpair_request") {
      metadata.paired = false;
      metadata.generation += 1;
      if (metadata.currentPairing) await this.deleteDirectoryPairing(metadata.currentPairing.lookupId);
      delete metadata.currentPairing;
      await this.state.storage.put(METADATA_KEY, metadata);
      await this.sendGateway(socket, attachment.serverId, "pairing.revoked", { revokedAt: new Date().toISOString() });
      this.broadcastDashboards({ type: "server.unpaired", serverId: attachment.serverId });
      for (const dashboard of this.state.getWebSockets("dashboard")) dashboard.close(4003, "Server pairing revoked");
      return;
    }
    if (!metadata.paired || !AGENT_EVENTS.has(decoded.envelope.type)) return;
    this.broadcastDashboards({
      type: "server.event",
      serverId: attachment.serverId,
      eventType: decoded.envelope.type,
      body: decoded.body,
      receivedAt: new Date().toISOString(),
    });
  }

  private async registerPairing(
    socket: WebSocket,
    attachment: SocketAttachment,
    metadata: RoomMetadata,
    body: Record<string, unknown>,
  ): Promise<void> {
    const requestId = requiredUuid(body.requestId, "requestId");
    const code = normalizePairingCode(body.code);
    const fingerprint = requiredText(body.fingerprint, "fingerprint", 64);
    const expiresAt = Date.parse(requiredText(body.expiresAt, "expiresAt", 64));
    if (fingerprint !== metadata.identity?.fingerprint || !Number.isFinite(expiresAt)
        || expiresAt <= Date.now() || expiresAt > Date.now() + 5 * 60_000 + 30_000) {
      throw new Error("Invalid pairing registration");
    }
    const challengeId = crypto.randomUUID();
    const lookupId = await pairingLookupId(code, this.env.PAIRING_CODE_PEPPER);
    if (metadata.currentPairing) await this.deleteDirectoryPairing(metadata.currentPairing.lookupId);
    const registration: PairingRegistration = {
      lookupId,
      serverId: attachment.serverId,
      requestId,
      challengeId,
      fingerprint,
      expiresAt,
    };
    const directory = this.directory();
    const response = await directory.fetch(internalRequest("/register", this.env, { ...registration, code }));
    if (!response.ok) {
      await this.sendGateway(socket, attachment.serverId, "pairing.rejected", { requestId });
      return;
    }
    metadata.currentPairing = registration;
    await this.state.storage.put(METADATA_KEY, metadata);
    await this.sendGateway(socket, attachment.serverId, "pairing.registered", {
      requestId,
      challengeId,
      expiresAt: new Date(expiresAt).toISOString(),
    });
  }

  private async handleDashboardMessage(socket: WebSocket, attachment: SocketAttachment, text: string): Promise<void> {
    if (new TextEncoder().encode(text).byteLength > 65_536) throw new Error("Dashboard message is too large");
    let message: unknown;
    try {
      message = JSON.parse(text);
    } catch {
      throw new Error("Dashboard message is not valid JSON");
    }
    if (!isRecord(message)) throw new Error("Dashboard message must be an object");
    if (message.type === "dashboard.ping") {
      socket.send(JSON.stringify({ type: "dashboard.pong", receivedAt: new Date().toISOString() }));
      return;
    }
    if (message.type !== "dashboard.action") throw new Error("Unsupported dashboard message");
    const requestId = requiredUuid(message.requestId, "requestId");
    try {
      const metadata = await this.metadata();
      if (!metadata.paired || attachment.generation !== metadata.generation) throw new Error("Dashboard device was revoked");
      const agent = this.authenticatedAgents()[0];
      if (!agent) throw new Error("Paper server is offline");
      const action = requiredText(message.action, "action", 64);
      if (!ACTION.test(action)) throw new Error("Invalid action");
      if (!isRecord(message.parameters)) throw new Error("Invalid action parameters");
      await this.sendGateway(agent, attachment.serverId, "action.request", {
        requestId,
        action,
        actorId: `device:${attachment.deviceId ?? "dashboard"}`,
        actorDisplayName: "Dashboard administrator",
        parameters: message.parameters,
      });
      socket.send(JSON.stringify({ type: "dashboard.action_queued", requestId, action }));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Action request was rejected";
      socket.send(JSON.stringify({ type: "dashboard.action_rejected", requestId, error: reason }));
    }
  }

  private async metadata(): Promise<RoomMetadata> {
    return await this.state.storage.get<RoomMetadata>(METADATA_KEY) ?? { paired: false, generation: 1 };
  }

  private authenticatedAgents(): WebSocket[] {
    return this.state.getWebSockets("agent").filter((socket) => {
      const attachment = socket.deserializeAttachment() as SocketAttachment;
      return attachment.authenticated === true;
    });
  }

  private async sendToAgent(type: string, body: Record<string, unknown>): Promise<void> {
    const agent = this.authenticatedAgents()[0];
    if (!agent) return;
    const attachment = agent.deserializeAttachment() as SocketAttachment;
    try {
      await this.sendGateway(agent, attachment.serverId, type, body);
    } catch {
      agent.close(1011, "Relay could not deliver a control message");
    }
  }

  private async sendGateway(socket: WebSocket, serverId: string, type: string, body: Record<string, unknown>): Promise<void> {
    socket.send(await signEnvelope(type, serverId, body, this.env.GATEWAY_ED25519_PRIVATE_KEY));
  }

  private broadcastDashboards(message: Record<string, unknown>): void {
    const encoded = JSON.stringify(message);
    for (const dashboard of this.state.getWebSockets("dashboard")) {
      try {
        dashboard.send(encoded);
      } catch {
        // A closed peer is removed by the hibernation runtime.
      }
    }
  }

  private broadcastAgentOfflineIfLast(socket: WebSocket, attachment: SocketAttachment): void {
    if (attachment.role !== "agent" || !attachment.authenticated
        || this.authenticatedAgents().some((candidate) => candidate !== socket)) return;
    this.broadcastDashboards({
      type: "server.connection",
      serverId: attachment.serverId,
      connectionStatus: "offline",
      receivedAt: new Date().toISOString(),
    });
  }

  private directory(): DurableObjectStub {
    return this.env.PAIRING_DIRECTORY.get(this.env.PAIRING_DIRECTORY.idFromName(DIRECTORY_NAME));
  }

  private async deleteDirectoryPairing(lookupId: string): Promise<void> {
    await this.directory().fetch(internalRequest("/delete", this.env, { lookupId }));
  }
}

function roomFetch(
  request: Request,
  env: Env,
  serverId: string,
  values: Record<string, string>,
): Promise<Response> {
  const headers = new Headers(request.headers);
  headers.set(INTERNAL_HEADER, env.ACCESS_TOKEN_SECRET);
  headers.set("X-Plexon-Server-Id", serverId);
  for (const [key, value] of Object.entries(values)) headers.set(`X-Plexon-${headerName(key)}`, value);
  const room = env.SERVER_ROOMS.get(env.SERVER_ROOMS.idFromName(serverId));
  return room.fetch(new Request(request, { headers }));
}

function internalRequest(path: string, env: Env, body: Record<string, unknown>): Request {
  return new Request(`https://relay.internal${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", [INTERNAL_HEADER]: env.ACCESS_TOKEN_SECRET },
    body: JSON.stringify(body),
  });
}

function authorizedInternal(request: Request, env: Env): boolean {
  return request.headers.get(INTERNAL_HEADER) === env.ACCESS_TOKEN_SECRET;
}

function identityFromHello(body: Record<string, unknown>, publicKey: string, fingerprint: string): AgentIdentity {
  return {
    publicKey,
    fingerprint,
    pluginVersion: requiredText(body.pluginVersion, "pluginVersion", 64),
    paperVersion: requiredText(body.paperVersion, "paperVersion", 256),
    minecraftVersion: requiredText(body.minecraftVersion, "minecraftVersion", 64),
    javaVersion: requiredText(body.javaVersion, "javaVersion", 128),
    operatingSystem: requiredText(body.operatingSystem, "operatingSystem", 256),
    capabilities: booleanRecord(body.capabilities),
  };
}

function registrationFrom(body: Record<string, unknown>, lookupId: string): PairingRegistration {
  const expiresAt = Number(body.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || expiresAt > Date.now() + 6 * 60_000) {
    throw new Error("Invalid pairing expiry");
  }
  return {
    lookupId,
    serverId: requiredUuid(body.serverId, "serverId"),
    requestId: requiredUuid(body.requestId, "requestId"),
    challengeId: requiredUuid(body.challengeId, "challengeId"),
    fingerprint: requiredText(body.fingerprint, "fingerprint", 64),
    expiresAt,
  };
}

function booleanRecord(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) throw new Error("Invalid capabilities");
  const result: Record<string, boolean> = {};
  for (const [key, child] of Object.entries(value)) {
    if (!/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(key) || typeof child !== "boolean") throw new Error("Invalid capability");
    result[key] = child;
  }
  return result;
}

function requiredText(value: unknown, name: string, maximumLength: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximumLength) throw new Error(`Invalid ${name}`);
  return value;
}

function requiredUuid(value: unknown, name: string): string {
  const result = requiredText(value, name, 64);
  if (!UUID.test(result)) throw new Error(`Invalid ${name}`);
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function randomToken(bytes: number): string {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function headerName(value: string): string {
  return value.replace(/[A-Z]/g, (character) => `-${character}`).replace(/^./, (character) => character.toUpperCase());
}

function allowedOrigins(env: Env): Set<string> {
  return new Set(env.DASHBOARD_ORIGINS.split(",").map((value) => value.trim()).filter(Boolean));
}

function dashboardOriginAllowed(request: Request, env: Env): boolean {
  const origin = request.headers.get("Origin") ?? "";
  return allowedOrigins(env).has(origin);
}

function corsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Origin",
  });
  const origin = request.headers.get("Origin") ?? "";
  if (allowedOrigins(env).has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, Sec-WebSocket-Protocol");
  }
  return headers;
}

function json(value: unknown, status = 200, headers?: Headers): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(value), { status, headers: responseHeaders });
}

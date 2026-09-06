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
  type DashboardAccess,
} from "./security.js";
import { ACTION_SCOPES, SCOPES, HIGH_RISK, validScopes } from "./scopes.js";
interface Env {
  SERVER_ROOMS: DurableObjectNamespace;
  PAIRING_DIRECTORY: DurableObjectNamespace;
  DASHBOARD_ORIGINS: string;
  PAIRING_CODE_PEPPER: string;
  ACCESS_TOKEN_SECRET: string;
  GATEWAY_ED25519_PRIVATE_KEY: string;
  GATEWAY_ED25519_PUBLIC_KEY: string;
}
type AgentKind = "PAPER" | "HOST";
interface AgentIdentity {
  publicKey: string;
  fingerprint: string;
  pluginVersion: string;
  paperVersion: string;
  minecraftVersion: string;
  javaVersion: string;
  operatingSystem: string;
  capabilities: Record<string, boolean>;
  hostPublicKey: string;
}
interface Device {
  deviceId: string;
  name: string;
  role: string;
  scopes: string[];
  issuedAt: number;
  expiresAt: number;
  lastSeen: number;
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
  protocolVersion: 3;
  identity?: AgentIdentity;
  hostIdentity?: AgentIdentity;
  paired: boolean;
  generation: number;
  revision: number;
  devices: Device[];
  currentPairing?: PairingRegistration;
}
interface SocketAttachment {
  role: "agent" | "dashboard";
  serverId: string;
  kind?: AgentKind;
  deviceId?: string;
  generation?: number;
  authenticated?: boolean;
  publicKey?: string;
  fingerprint?: string;
  challenge?: string;
  challengeExpiry?: number;
  candidate?: AgentIdentity;
  sessionNonce?: string;
  sequence?: number;
  recent?: string[];
  pending?: {
    requestId: string;
    kind: AgentKind;
    action: string;
    expires: number;
  }[];
  access?: DashboardAccess;
  rate?: number[];
  transferRate?: number[];
}
interface DirectoryRate {
  windowStartedAt: number;
  attempts: number;
}
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const METADATA_KEY = "room-metadata",
  DIRECTORY_NAME = "pairing-directory-v3",
  INTERNAL_HEADER = "X-Plexon-Internal";
const AGENT_EVENTS = new Set([
  "telemetry.server",
  "telemetry.system",
  "telemetry.worlds",
  "inventory.players",
  "inventory.plugins",
  "console.lines",
  "chat.message",
  "service.status",
  "backup.progress",
]);

async function boundedJson(
  request: Request,
  maximum: number,
): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.byteLength;
    if (size > maximum) {
      await reader.cancel();
      throw new Error("Request body exceeds limits");
    }
    chunks.push(next.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const value: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  );
  if (!isRecord(value)) throw new Error("Expected object");
  return value;
}
const relayWorker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url),
      cors = corsHeaders(request, env);
    if (request.method === "GET" && url.pathname === "/healthz")
      return json(
        {
          ok: true,
          service: "plexonpanel-relay",
          version: "2.0.0",
          protocolVersion: 3,
          storage: "coordination-only",
          gatewayPublicKey: env.GATEWAY_ED25519_PUBLIC_KEY,
        },
        200,
        cors,
      );
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors });
    if (
      url.pathname.startsWith("/v1/pairings") ||
      url.pathname.startsWith("/v1/dashboard")
    )
      if (!dashboardOriginAllowed(request, env))
        return json(
          {
            ok: false,
            error: "Dashboard origin is not allowed",
            code: "ORIGIN_DENIED",
          },
          403,
          cors,
        );
    if (request.method === "POST" && url.pathname === "/v1/pairings/claim") {
      let body: Record<string, unknown>, code: string;
      try {
        body = await boundedJson(request, 4096);
        code = normalizePairingCode(body.code);
        if (Object.keys(body).some((k) => k !== "code" && k !== "name"))
          throw new Error("Unexpected pairing field");
      } catch {
        return json(
          {
            ok: false,
            error:
              "Pairing request must be valid JSON with a six-digit code and device name.",
          },
          400,
          cors,
        );
      }
      const name = typeof body.name === "string" ? body.name : "Browser device";
      if (!/^[\p{L}\p{N} ._()-]{1,64}$/u.test(name))
        return json(
          { ok: false, error: "Choose a short device name." },
          400,
          cors,
        );
      const directory = env.PAIRING_DIRECTORY.get(
        env.PAIRING_DIRECTORY.idFromName(DIRECTORY_NAME),
      );
      const clientKey = await opaqueClientKey(
        request.headers.get("CF-Connecting-IP") ?? "unknown",
        env.PAIRING_CODE_PEPPER,
      );
      const resolved = await directory.fetch(
        internalRequest("/resolve", env, { code, clientKey }),
      );
      if (!resolved.ok)
        return json(
          {
            ok: false,
            error:
              resolved.status === 429
                ? "Too many pairing attempts. Try again in 15 minutes."
                : "Invalid or expired pairing code.",
          },
          resolved.status === 429 ? 429 : 403,
          cors,
        );
      const registration = (await resolved.json()) as PairingRegistration;
      const room = env.SERVER_ROOMS.get(
        env.SERVER_ROOMS.idFromName(registration.serverId),
      );
      const claim = await room.fetch(
        internalRequest("/claim", env, {
          lookupId: registration.lookupId,
          challengeId: registration.challengeId,
          deviceId: crypto.randomUUID(),
          name,
        }),
      );
      if (!claim.ok)
        return json(
          {
            ok: false,
            error:
              "Pairing was not approved by the local Paper agent. Generate another code.",
          },
          403,
          cors,
        );
      const grant = (await claim.json()) as {
        device: Device;
        generation: number;
        fingerprint: string;
      };
      if (
        !validDevice(grant.device) ||
        !Number.isSafeInteger(grant.generation) ||
        grant.generation < 1
      )
        return json({ ok: false, error: "Invalid local grant" }, 502, cors);
      await directory.fetch(
        internalRequest("/delete", env, { lookupId: registration.lookupId }),
      );
      const access: DashboardAccess = {
        version: 3,
        protocolVersion: 3,
        audience: "plexonpanel-relay",
        serverId: registration.serverId,
        deviceId: grant.device.deviceId,
        role: grant.device.role,
        scopes: grant.device.scopes,
        generation: grant.generation,
        issuedAt: grant.device.issuedAt,
        expiresAt: grant.device.expiresAt,
      };
      const websocket = new URL("/v1/dashboard", request.url);
      websocket.protocol = websocket.protocol === "https:" ? "wss:" : "ws:";
      return json(
        {
          ok: true,
          protocolVersion: 3,
          serverId: access.serverId,
          deviceId: access.deviceId,
          role: access.role,
          scopes: access.scopes,
          name: grant.device.name,
          fingerprint: grant.fingerprint,
          accessToken: await signDashboardAccess(
            access,
            env.ACCESS_TOKEN_SECRET,
          ),
          expiresAt: new Date(access.expiresAt * 1000).toISOString(),
          websocketUrl: websocket.toString(),
        },
        200,
        cors,
      );
    }
    if (request.method === "GET" && url.pathname === "/v1/dashboard/session") {
      const authorization = request.headers.get("Authorization") ?? "";
      if (!authorization.startsWith("Bearer "))
        return json(
          { ok: false, error: "Dashboard credential is required" },
          401,
          cors,
        );
      let access: DashboardAccess;
      try {
        access = await verifyDashboardAccess(
          authorization.slice(7),
          env.ACCESS_TOKEN_SECRET,
        );
      } catch {
        return json(
          {
            ok: false,
            error:
              "Device credential expired or incompatible; pair this browser again.",
            code: "CREDENTIAL_INVALID",
          },
          401,
          cors,
        );
      }
      const room = env.SERVER_ROOMS.get(
        env.SERVER_ROOMS.idFromName(access.serverId),
      );
      const result = await room.fetch(
        internalRequest("/validate", env, { access }),
      );
      if (!result.ok)
        return json(
          {
            ok: false,
            error: "This device was revoked.",
            code: "DEVICE_REVOKED",
          },
          401,
          cors,
        );
      return json(
        {
          ok: true,
          protocolVersion: 3,
          serverId: access.serverId,
          role: access.role,
          scopes: access.scopes,
          expiresAt: new Date(access.expiresAt * 1000).toISOString(),
        },
        200,
        cors,
      );
    }
    if (request.method === "GET" && url.pathname === "/v1/agent") {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
        return json({ ok: false, error: "WebSocket required" }, 426);
      if (request.headers.get("X-PlexonPanel-Protocol") !== "3")
        return json(
          {
            ok: false,
            error:
              "Protocol 3 required. Upgrade the agent and re-pair browsers.",
            code: "PROTOCOL_MISMATCH",
          },
          426,
        );
      const serverId = url.searchParams.get("serverId") ?? "",
        kind = url.searchParams.get("agentKind") ?? "PAPER";
      if (!UUID.test(serverId) || !new Set(["PAPER", "HOST"]).has(kind))
        return json({ ok: false, error: "Invalid agent identity" }, 400);
      return roomFetch(request, env, serverId, { role: "agent", kind });
    }
    if (request.method === "GET" && url.pathname === "/v1/dashboard") {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
        return json({ ok: false, error: "WebSocket required" }, 426);
      const protocols = (request.headers.get("Sec-WebSocket-Protocol") ?? "")
        .split(",")
        .map((s) => s.trim());
      const authentication = protocols.find((s) => s.startsWith("auth."));
      if (!protocols.includes("plexonpanel-v3") || !authentication)
        return json(
          { ok: false, error: "Protocol 3 authentication required" },
          401,
        );
      let access: DashboardAccess;
      try {
        access = await verifyDashboardAccess(
          authentication.slice(5),
          env.ACCESS_TOKEN_SECRET,
        );
      } catch {
        return json(
          { ok: false, error: "Device credential invalid or expired" },
          401,
        );
      }
      return roomFetch(request, env, access.serverId, {
        role: "dashboard",
        access: JSON.stringify(access),
      });
    }
    return json({ ok: false, error: "Route not found" }, 404, cors);
  },
};
export default relayWorker;

export class PairingDirectory {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    if (!authorizedInternal(request, this.env)) return json({ ok: false }, 403);
    const url = new URL(request.url);
    const body = (await request.json()) as Record<string, unknown>;
    if (url.pathname === "/register") {
      const code = normalizePairingCode(body.code);
      const lookupId = await pairingLookupId(
        code,
        this.env.PAIRING_CODE_PEPPER,
      );
      const registration = registrationFrom(body, lookupId);
      const key = `code:${lookupId}`;
      const existing = await this.state.storage.get<PairingRegistration>(key);
      if (
        existing &&
        existing.expiresAt > Date.now() &&
        existing.serverId !== registration.serverId
      ) {
        return json({ ok: false, error: "Pairing code collision" }, 409);
      }
      await this.state.storage.put(key, registration);
      await this.scheduleCleanup(registration.expiresAt);
      return json({ ok: true, lookupId });
    }
    if (url.pathname === "/resolve") {
      const clientKey = requiredText(body.clientKey, "clientKey", 128);
      if (!(await this.consumeRateLimit(clientKey)))
        return json({ ok: false }, 429);
      const code = normalizePairingCode(body.code);
      const lookupId = await pairingLookupId(
        code,
        this.env.PAIRING_CODE_PEPPER,
      );
      const registration = await this.state.storage.get<PairingRegistration>(
        `code:${lookupId}`,
      );
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
    const entries = await this.state.storage.list<
      PairingRegistration | DirectoryRate
    >();
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
    const current =
      !existing || now - existing.windowStartedAt >= 15 * 60_000
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
    if (existing === null || timestamp < existing)
      await this.state.storage.setAlarm(timestamp);
  }
}

export class ServerRoom {
  private claiming = false;
  private messages: Promise<void> = Promise.resolve();
  private queuedBytes = 0;
  private pairingWaiters = new Map<
    string,
    {
      resolve: (
        value: { device: Device; generation: number; revision: number } | null,
      ) => void;
      deviceId: string;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private pending = new Map<
    string,
    { deviceId: string; kind: AgentKind; action: string; expires: number }
  >();
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {
    // Only request routing metadata is attached; never file, console or command contents.
    for (const socket of state.getWebSockets("dashboard")) {
      const a = socket.deserializeAttachment() as SocketAttachment;
      for (const p of a.pending ?? [])
        if (p.expires > Date.now())
          this.pending.set(p.requestId, {
            deviceId: a.deviceId!,
            kind: p.kind,
            action: p.action,
            expires: p.expires,
          });
    }
  }
  async fetch(request: Request): Promise<Response> {
    if (!authorizedInternal(request, this.env)) return json({ ok: false }, 403);
    const url = new URL(request.url),
      metadata = await this.metadata();
    if (url.pathname === "/validate") {
      const body = (await request.json()) as { access: DashboardAccess };
      return json(
        { ok: currentAccess(metadata, body.access) },
        currentAccess(metadata, body.access) ? 200 : 403,
      );
    }
    if (url.pathname === "/claim") {
      const body = (await request.json()) as Record<string, unknown>,
        pending = metadata.currentPairing;
      if (
        !pending ||
        pending.expiresAt <= Date.now() ||
        pending.lookupId !== body.lookupId ||
        pending.challengeId !== body.challengeId ||
        !this.agents("PAPER").length ||
        this.pairingWaiters.size ||
        this.claiming
      )
        return json({ ok: false }, 403);
      this.claiming = true;
      try {
        delete metadata.currentPairing;
        await this.state.storage.put(METADATA_KEY, metadata);
        const deviceId = requiredUuid(body.deviceId, "deviceId"),
          name = requiredText(body.name, "name", 64);
        const grant = await new Promise<{
          device: Device;
          generation: number;
          revision: number;
        } | null>((resolve) => {
          const timer = setTimeout(() => {
            this.pairingWaiters.delete(pending.requestId);
            resolve(null);
          }, 10000);
          this.pairingWaiters.set(pending.requestId, {
            resolve,
            deviceId,
            timer,
          });
          void this.sendToAgent("PAPER", "pairing.consume", {
            requestId: pending.requestId,
            deviceId,
            name,
          }).catch(() => {
            clearTimeout(timer);
            this.pairingWaiters.delete(pending.requestId);
            resolve(null);
          });
        });
        if (!grant) return json({ ok: false }, 403);
        const latest = await this.metadata();
        if (
          latest.generation > grant.generation ||
          (latest.generation === grant.generation &&
            latest.revision > grant.revision)
        )
          return json({ ok: false }, 403);
        if (latest.generation !== grant.generation) latest.devices = [];
        latest.generation = grant.generation;
        latest.revision = grant.revision;
        latest.devices = latest.devices.filter((d) => d.deviceId !== deviceId);
        latest.devices.push(grant.device);
        latest.paired = true;
        await this.state.storage.put(METADATA_KEY, latest);
        await this.scheduleExpiry(latest);
        return json({
          ...grant,
          fingerprint: latest.identity?.fingerprint ?? "unknown",
        });
      } finally {
        this.claiming = false;
      }
    }
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
      return json({ ok: false }, 426);
    const role = request.headers.get("X-Plexon-Role"),
      serverId = request.headers.get("X-Plexon-Server-Id") ?? "";
    if ((role !== "agent" && role !== "dashboard") || !UUID.test(serverId))
      return json({ ok: false }, 400);
    if (this.state.getWebSockets().length >= 80)
      return json({ ok: false, error: "Room connection limit" }, 429);
    let attachment: SocketAttachment;
    if (role === "dashboard") {
      const access = JSON.parse(
        request.headers.get("X-Plexon-Access") ?? "null",
      ) as DashboardAccess;
      if (!currentAccess(metadata, access) || access.serverId !== serverId)
        return json({ ok: false, error: "Device revoked" }, 403);
      attachment = {
        role,
        serverId,
        deviceId: access.deviceId,
        generation: access.generation,
        access,
        rate: [],
      };
    } else {
      const kind = request.headers.get("X-Plexon-Kind") as AgentKind;
      if (kind !== "PAPER" && kind !== "HOST") return json({ ok: false }, 400);
      attachment = { role, serverId, kind, authenticated: false, recent: [] };
    }
    const pair = new WebSocketPair(),
      socket = pair[1];
    socket.serializeAttachment(attachment);
    this.state.acceptWebSocket(socket, [role]);
    if (role === "dashboard") {
      for (const other of this.state.getWebSockets("dashboard")) {
        if (
          other !== socket &&
          (other.deserializeAttachment() as SocketAttachment).deviceId ===
            attachment.deviceId
        )
          other.close(4002, "Device reconnected");
      }
      socket.send(JSON.stringify(this.ready(metadata, attachment)));
      await this.sendToAgent("PAPER", "gateway.snapshot_request", {});
      await this.sendToAgent("HOST", "gateway.snapshot_request", {});
      await this.scheduleExpiry(metadata);
    }
    return new Response(null, {
      status: 101,
      webSocket: pair[0],
      ...(role === "dashboard"
        ? { headers: { "Sec-WebSocket-Protocol": "plexonpanel-v3" } }
        : {}),
    });
  }
  async webSocketMessage(
    socket: WebSocket,
    message: ArrayBuffer | string,
  ): Promise<void> {
    const size =
      typeof message === "string"
        ? new TextEncoder().encode(message).byteLength
        : MAX_ENVELOPE_BYTES + 1;
    if (size > MAX_ENVELOPE_BYTES || this.queuedBytes + size > 1048576) {
      socket.close(4008, "Message queue limit exceeded");
      return;
    }
    this.queuedBytes += size;
    const task = this.messages
      .then(async () => {
        const a = socket.deserializeAttachment() as SocketAttachment;
        try {
          if (a.role === "agent")
            await this.agentMessage(socket, a, message as string);
          else await this.dashboardMessage(socket, a, message as string);
        } catch {
          if (a.role === "agent")
            socket.close(4008, "Protocol message rejected");
          else
            socket.send(
              JSON.stringify({
                type: "relay.error",
                code: "INVALID_REQUEST",
                error: "The request was rejected.",
              }),
            );
        }
      })
      .finally(() => {
        this.queuedBytes -= size;
      });
    this.messages = task.catch(() => {});
    await task;
  }
  async webSocketClose(socket: WebSocket): Promise<void> {
    await this.disconnected(socket);
  }
  async webSocketError(socket: WebSocket): Promise<void> {
    await this.disconnected(socket);
  }
  async alarm(): Promise<void> {
    const m = await this.metadata();
    this.closeInvalid(m);
    await this.scheduleExpiry(m);
  }
  private async agentMessage(
    socket: WebSocket,
    a: SocketAttachment,
    text: string,
  ): Promise<void> {
    const { envelope, body } = decodeEnvelope(text);
    assertFreshEnvelope(envelope);
    if (envelope.serverId !== a.serverId) throw new Error("Wrong room");
    let m = await this.metadata();
    if (envelope.type === "agent.hello") {
      if (
        a.publicKey ||
        body.protocolVersion !== 3 ||
        body.agentKind !== a.kind
      )
        throw new Error("Protocol or agent kind mismatch");
      const key = requiredText(body.publicKey, "publicKey", 512),
        fingerprint = requiredText(
          body.publicKeyFingerprint,
          "fingerprint",
          64,
        );
      if (
        !(await verifyEnvelope(envelope, await importAgentPublicKey(key))) ||
        (await publicKeyFingerprint(key)) !== fingerprint
      )
        throw new Error("Invalid identity");
      if (a.kind === "HOST" && key !== m.identity?.hostPublicKey)
        throw new Error("Host identity is not locally attached");
      if (a.kind === "PAPER" && m.identity && m.identity.publicKey !== key)
        throw new Error("Room is already bound");
      a.candidate = identityFromHello(body, key, fingerprint);
      a.publicKey = key;
      a.fingerprint = fingerprint;
      a.challenge = randomToken(32);
      a.challengeExpiry = Date.now() + 15000;
      a.sessionNonce = requiredUuid(body._session, "session nonce");
      if (body._sequence !== 1) throw new Error("Invalid initial sequence");
      a.sequence = 1;
      a.recent = [envelope.messageId];
      socket.serializeAttachment(a);
      await this.sendGateway(socket, a.serverId, "gateway.challenge", {
        nonce: a.challenge,
      });
      return;
    }
    if (
      !a.publicKey ||
      !(await verifyEnvelope(envelope, await importAgentPublicKey(a.publicKey)))
    )
      throw new Error("Invalid signature");
    if (
      body._session !== a.sessionNonce ||
      !Number.isSafeInteger(body._sequence) ||
      Number(body._sequence) <= (a.sequence ?? 0) ||
      a.recent?.includes(envelope.messageId)
    )
      throw new Error("Session replay rejected");
    a.sequence = Number(body._sequence);
    // The monotonic sequence rejects replay for the entire connection without an unbounded attachment.
    a.recent = [...(a.recent ?? []), envelope.messageId].slice(-32);
    delete body._session;
    delete body._sequence;
    socket.serializeAttachment(a);
    if (envelope.type === "agent.challenge_response") {
      if (
        a.authenticated ||
        !a.challenge ||
        Date.now() > (a.challengeExpiry ?? 0) ||
        body.nonce !== a.challenge ||
        !(await verifyChallengeProof(
          a.challenge,
          body.proof,
          await importAgentPublicKey(a.publicKey),
        ))
      )
        throw new Error("Challenge rejected");
      if (!a.candidate) throw new Error("Missing candidate identity");
      if (a.kind === "PAPER") m.identity = a.candidate;
      else m.hostIdentity = a.candidate;
      await this.state.storage.put(METADATA_KEY, m);
      a.authenticated = true;
      delete a.challenge;
      delete a.candidate;
      socket.serializeAttachment(a);
      for (const other of this.agents(a.kind)) {
        if (other !== socket) {
          const previous = other.deserializeAttachment() as SocketAttachment;
          previous.authenticated = false;
          other.serializeAttachment(previous);
          other.close(4002, "Agent reconnected");
        }
      }
      await this.sendGateway(socket, a.serverId, "gateway.authenticated", {
        protocolVersion: 3,
        paired: m.paired,
        authenticatedAt: new Date().toISOString(),
      });
      await this.broadcastReady(m);
      if (a.kind === "PAPER")
        await this.sendToAgent("HOST", "paper.connection", { connected: true });
      if (a.kind === "HOST")
        await this.sendGateway(socket, a.serverId, "paper.connection", {
          connected: this.agents("PAPER").length > 0,
        });
      return;
    }
    if (!a.authenticated) throw new Error("Agent authentication required");
    if (a.kind === "HOST" && a.publicKey !== m.identity?.hostPublicKey)
      throw new Error("Host authorization changed");
    if (envelope.type === "agent.pairing_begin") {
      if (a.kind !== "PAPER")
        throw new Error("Only Paper issues pairing codes");
      await this.registerPairing(socket, a, m, body);
      return;
    }
    if (
      envelope.type === "pairing.accepted" ||
      envelope.type === "pairing.denied"
    ) {
      if (a.kind !== "PAPER") throw new Error("Only Paper approves grants");
      const id = requiredUuid(body.requestId, "requestId"),
        waiter = this.pairingWaiters.get(id);
      if (!waiter) return;
      clearTimeout(waiter.timer);
      this.pairingWaiters.delete(id);
      if (
        envelope.type === "pairing.accepted" &&
        validDevice(body.device) &&
        body.device.deviceId === waiter.deviceId &&
        Number.isSafeInteger(body.generation) &&
        Number(body.generation) > 0 &&
        Number.isSafeInteger(body.revision) &&
        Number(body.revision) > 0
      )
        waiter.resolve({
          device: body.device,
          generation: Number(body.generation),
          revision: Number(body.revision),
        });
      else waiter.resolve(null);
      return;
    }
    if (envelope.type === "access.sync") {
      if (
        body.protocolVersion !== 3 ||
        body.serverId !== a.serverId ||
        !Number.isSafeInteger(body.generation) ||
        Number(body.generation) < 1 ||
        !Number.isSafeInteger(body.revision) ||
        !Array.isArray(body.devices) ||
        body.devices.length > 64 ||
        !body.devices.every(validDevice)
      )
        throw new Error("Invalid access snapshot");
      // HOST reads the same local registry, but may only remove grants. New grants originate from PAPER.
      const next = body.devices as Device[];
      if (
        a.kind === "HOST" &&
        (Number(body.generation) !== m.generation ||
          next.some((d) => !m.devices.some((old) => sameDevice(old, d))))
      )
        throw new Error("Host cannot issue device grants");
      if (Number(body.generation) < m.generation) return;
      if (
        Number(body.generation) === m.generation &&
        Number(body.revision) < m.revision
      )
        return;
      m = {
        ...m,
        generation: Number(body.generation),
        revision: Number(body.revision),
        devices: next,
        paired: next.some((d) => d.expiresAt * 1000 > Date.now()),
      };
      await this.state.storage.put(METADATA_KEY, m);
      this.closeInvalid(m);
      await this.scheduleExpiry(m);
      await this.broadcastReady(m);
      return;
    }
    if (envelope.type === "backup.coordination") {
      if (
        a.kind !== "HOST" ||
        m.hostIdentity?.capabilities["backup.create"] !== true
      )
        throw new Error("Host backups disabled");
      requiredUuid(body.requestId, "requestId");
      requiredUuid(body.leaseId, "leaseId");
      if (!["prepare", "renew", "resume"].includes(String(body.operation)))
        throw new Error("Invalid save lease operation");
      await this.sendToAgent("PAPER", "backup.coordination", body);
      return;
    }
    if (envelope.type === "backup.coordination.result") {
      if (a.kind !== "PAPER") throw new Error("Only Paper reports save leases");
      await this.sendToAgent("HOST", "backup.coordination.result", body);
      return;
    }
    if (envelope.type === "action.result") {
      const requestId = requiredUuid(body.requestId, "requestId"),
        pending = this.pending.get(requestId);
      if (
        !pending ||
        pending.kind !== a.kind ||
        body.deviceId !== pending.deviceId ||
        body.action !== pending.action
      )
        return;
      this.pending.delete(requestId);
      for (const peer of this.state.getWebSockets("dashboard")) {
        const access = peer.deserializeAttachment() as SocketAttachment;
        access.pending = (access.pending ?? []).filter(
          (p) => p.requestId !== requestId && p.expires > Date.now(),
        );
        peer.serializeAttachment(access);
        if (
          access.deviceId === pending.deviceId &&
          currentAccess(m, access.access)
        )
          peer.send(
            JSON.stringify({
              type: "server.event",
              serverId: a.serverId,
              agentKind: a.kind,
              eventType: "action.result",
              body,
              receivedAt: new Date().toISOString(),
            }),
          );
      }
      return;
    }
    if (!AGENT_EVENTS.has(envelope.type)) return;
    if (
      a.kind === "HOST" &&
      !new Set(["telemetry.system", "service.status", "backup.progress"]).has(
        envelope.type,
      )
    )
      throw new Error("Event not allowed for host");
    for (const peer of this.state.getWebSockets("dashboard")) {
      const d = peer.deserializeAttachment() as SocketAttachment;
      if (!currentAccess(m, d.access)) continue;
      const identity = a.kind === "HOST" ? m.hostIdentity : m.identity;
      const filtered = filterEvent(
        envelope.type,
        body,
        d.access!.scopes,
        identity?.capabilities ?? {},
      );
      if (filtered)
        peer.send(
          JSON.stringify({
            type: "server.event",
            serverId: a.serverId,
            agentKind: a.kind,
            eventType: envelope.type,
            body: filtered,
            receivedAt: new Date().toISOString(),
          }),
        );
    }
  }
  private async dashboardMessage(
    socket: WebSocket,
    a: SocketAttachment,
    text: string,
  ): Promise<void> {
    if (new TextEncoder().encode(text).byteLength > 65536)
      throw new Error("Request too large");
    const message: unknown = JSON.parse(text);
    if (!isRecord(message)) throw new Error("Invalid request");
    const m = await this.metadata();
    if (!currentAccess(m, a.access)) {
      socket.close(4003, "Device revoked or expired");
      return;
    }
    if (message.type === "dashboard.ping") {
      socket.send(JSON.stringify({ type: "dashboard.pong" }));
      return;
    }
    if (message.type !== "dashboard.action") throw new Error("Unknown request");
    const id = requiredUuid(message.requestId, "requestId");
    try {
      const action = requiredText(message.action, "action", 64),
        scope = ACTION_SCOPES[action],
        parameters = message.parameters;
      if (!scope || !a.access!.scopes.includes(scope))
        throw new Error("SCOPE_DENIED");
      if (
        !isRecord(parameters) ||
        Object.keys(parameters).length > 16 ||
        new TextEncoder().encode(JSON.stringify(parameters)).byteLength > 49152
      )
        throw new Error("INVALID_PARAMETERS");
      const transfer = action.endsWith(".chunk");
      const rate = ((transfer ? a.transferRate : a.rate) ?? []).filter(
        (t) => t > Date.now() - 10000,
      );
      if (rate.length >= (transfer ? 160 : 20)) throw new Error("RATE_LIMITED");
      if (transfer) a.transferRate = [...rate, Date.now()];
      else a.rate = [...rate, Date.now()];
      socket.serializeAttachment(a);
      if (HIGH_RISK.has(action) && parameters.confirmed !== true)
        throw new Error("CONFIRMATION_REQUIRED");
      if (
        (action === "player.op" ||
          action === "player.deop" ||
          action.startsWith("backup.restore")) &&
        a.access!.role !== "Owner"
      )
        throw new Error("OWNER_REQUIRED");
      let kind: AgentKind =
        action.startsWith("backup.") ||
        (action.startsWith("server.") && action !== "server.status")
          ? "HOST"
          : "PAPER";
      if (
        (action.startsWith("files.") || action === "server.status") &&
        this.agents("HOST").length
      )
        kind = "HOST";
      if (message.agentKind !== undefined) {
        if (message.agentKind !== "HOST" && message.agentKind !== "PAPER")
          throw new Error("INVALID_PARAMETERS");
        kind = message.agentKind;
      }
      const identity = kind === "HOST" ? m.hostIdentity : m.identity;
      if (identity?.capabilities[scope] !== true)
        throw new Error("CAPABILITY_DISABLED");
      const agent = this.agents(kind)[0];
      if (!agent)
        throw new Error(kind === "HOST" ? "HOST_OFFLINE" : "PAPER_OFFLINE");
      for (const [key, p] of this.pending)
        if (p.expires < Date.now()) this.pending.delete(key);
      if (this.pending.has(id)) throw new Error("DUPLICATE_REQUEST");
      if (this.pending.size >= 64) throw new Error("BUSY");
      const attachedPending = (a.pending ?? []).filter(
        (p) => p.expires > Date.now(),
      );
      if (attachedPending.length >= 32) throw new Error("BUSY");
      a.pending = [
        ...attachedPending,
        { requestId: id, kind, action, expires: Date.now() + 15 * 60000 },
      ];
      socket.serializeAttachment(a);
      this.pending.set(id, {
        deviceId: a.deviceId!,
        kind,
        action,
        expires: Date.now() + 15 * 60000,
      });
      await this.sendGateway(agent, a.serverId, "action.request", {
        requestId: id,
        action,
        deviceId: a.deviceId,
        generation: a.generation,
        parameters,
      });
      socket.send(
        JSON.stringify({
          type: "dashboard.action_queued",
          requestId: id,
          action,
          agentKind: kind,
        }),
      );
    } catch (error) {
      socket.send(
        JSON.stringify({
          type: "dashboard.action_rejected",
          requestId: id,
          code: error instanceof Error ? error.message : "DENIED",
          error: actionError(error),
        }),
      );
    }
  }
  private async registerPairing(
    socket: WebSocket,
    a: SocketAttachment,
    m: RoomMetadata,
    body: Record<string, unknown>,
  ): Promise<void> {
    const requestId = requiredUuid(body.requestId, "requestId"),
      code = normalizePairingCode(body.code),
      expiresAt = Date.parse(requiredText(body.expiresAt, "expiresAt", 64));
    if (
      !validScopes(body.scopes) ||
      typeof body.role !== "string" ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now() ||
      expiresAt > Date.now() + 330000 ||
      body.fingerprint !== m.identity?.fingerprint
    )
      throw new Error("Invalid pairing registration");
    if (m.currentPairing)
      await this.directory().fetch(
        internalRequest("/delete", this.env, {
          lookupId: m.currentPairing.lookupId,
        }),
      );
    const registration: PairingRegistration = {
      lookupId: await pairingLookupId(code, this.env.PAIRING_CODE_PEPPER),
      serverId: a.serverId,
      requestId,
      challengeId: crypto.randomUUID(),
      fingerprint: m.identity!.fingerprint,
      expiresAt,
    };
    const response = await this.directory().fetch(
      internalRequest("/register", this.env, { ...registration, code }),
    );
    if (!response.ok) {
      await this.sendGateway(socket, a.serverId, "pairing.rejected", {
        requestId,
      });
      return;
    }
    m.currentPairing = registration;
    await this.state.storage.put(METADATA_KEY, m);
    await this.sendGateway(socket, a.serverId, "pairing.registered", {
      requestId,
      challengeId: registration.challengeId,
      expiresAt: new Date(expiresAt).toISOString(),
    });
  }
  private async metadata(): Promise<RoomMetadata> {
    const stored = await this.state.storage.get<RoomMetadata>(METADATA_KEY);
    if (stored?.protocolVersion === 3 && Array.isArray(stored.devices))
      return stored;
    // Preserve the rc.2 identity pin, explicitly discard unscoped browser credentials.
    return {
      protocolVersion: 3,
      ...(stored?.identity ? { identity: stored.identity } : {}),
      paired: false,
      generation: Math.max(1, (stored?.generation ?? 0) + 1),
      revision: 0,
      devices: [],
    };
  }
  private agents(kind?: AgentKind): WebSocket[] {
    return this.state.getWebSockets("agent").filter((s) => {
      const a = s.deserializeAttachment() as SocketAttachment;
      return a.authenticated && (!kind || a.kind === kind);
    });
  }
  private directory(): DurableObjectStub {
    return this.env.PAIRING_DIRECTORY.get(
      this.env.PAIRING_DIRECTORY.idFromName(DIRECTORY_NAME),
    );
  }
  private async sendGateway(
    socket: WebSocket,
    serverId: string,
    type: string,
    body: Record<string, unknown>,
  ) {
    socket.send(
      await signEnvelope(
        type,
        serverId,
        body,
        this.env.GATEWAY_ED25519_PRIVATE_KEY,
      ),
    );
  }
  private async sendToAgent(
    kind: AgentKind,
    type: string,
    body: Record<string, unknown>,
  ) {
    const s = this.agents(kind)[0];
    if (s)
      await this.sendGateway(
        s,
        (s.deserializeAttachment() as SocketAttachment).serverId,
        type,
        body,
      );
  }
  private ready(m: RoomMetadata, a: SocketAttachment): Record<string, unknown> {
    const scopes = a.access?.scopes ?? [],
      capabilities: Record<string, boolean> = {};
    for (const scope of SCOPES)
      capabilities[scope] =
        scopes.includes(scope) &&
        (m.identity?.capabilities[scope] === true ||
          m.hostIdentity?.capabilities[scope] === true);
    return {
      type: "dashboard.ready",
      serverId: a.serverId,
      protocolVersion: 3,
      version: "2.0.0",
      connectionStatus: this.agents("PAPER").length ? "online" : "offline",
      agents: {
        paper: this.agents("PAPER").length > 0,
        host: this.agents("HOST").length > 0,
        hostInstalled: Boolean(m.identity?.hostPublicKey),
      },
      device: m.devices.find((d) => d.deviceId === a.deviceId),
      server: {
        serverId: a.serverId,
        fingerprint: m.identity?.fingerprint ?? "",
        pluginVersion: m.identity?.pluginVersion ?? "",
        minecraftVersion: m.identity?.minecraftVersion ?? "",
        capabilities,
        paperCapabilities: m.identity?.capabilities ?? {},
        hostCapabilities: m.hostIdentity?.capabilities ?? {},
        hostVersion: m.hostIdentity?.pluginVersion ?? null,
        paired: m.paired,
      },
      receivedAt: new Date().toISOString(),
    };
  }
  private async broadcastReady(m: RoomMetadata) {
    for (const s of this.state.getWebSockets("dashboard")) {
      const a = s.deserializeAttachment() as SocketAttachment;
      if (currentAccess(m, a.access)) s.send(JSON.stringify(this.ready(m, a)));
    }
  }
  private closeInvalid(m: RoomMetadata) {
    for (const s of this.state.getWebSockets("dashboard")) {
      if (
        !currentAccess(
          m,
          (s.deserializeAttachment() as SocketAttachment).access,
        )
      )
        s.close(4003, "Device revoked or expired");
    }
    for (const s of this.agents("HOST"))
      if (
        (s.deserializeAttachment() as SocketAttachment).publicKey !==
        m.identity?.hostPublicKey
      )
        s.close(4003, "Host attachment revoked");
  }
  private async scheduleExpiry(m: RoomMetadata) {
    const expiries = m.devices
      .map((d) => d.expiresAt * 1000)
      .filter((t) => t > Date.now());
    if (expiries.length)
      await this.state.storage.setAlarm(Math.min(...expiries));
    else await this.state.storage.deleteAlarm();
  }
  private async disconnected(socket: WebSocket) {
    const a = socket.deserializeAttachment() as SocketAttachment;
    if (a.role !== "agent" || !a.authenticated) return;
    a.authenticated = false;
    socket.serializeAttachment(a);
    const m = await this.metadata();
    await this.broadcastReady(m);
    if (a.kind === "PAPER" && !this.agents("PAPER").length)
      await this.sendToAgent("HOST", "paper.connection", { connected: false });
  }
}
export function validDevice(value: unknown): value is Device {
  if (!isRecord(value)) return false;
  return (
    typeof value.deviceId === "string" &&
    UUID.test(value.deviceId) &&
    typeof value.name === "string" &&
    value.name.length <= 64 &&
    typeof value.role === "string" &&
    /^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(value.role) &&
    validScopes(value.scopes) &&
    Number.isSafeInteger(value.issuedAt) &&
    Number.isSafeInteger(value.expiresAt) &&
    Number(value.expiresAt) > Number(value.issuedAt) &&
    Number(value.expiresAt) - Number(value.issuedAt) <= 2592000
  );
}
function sameDevice(a: Device, b: Device) {
  return (
    a.deviceId === b.deviceId &&
    a.role === b.role &&
    a.issuedAt === b.issuedAt &&
    a.expiresAt === b.expiresAt &&
    [...a.scopes].sort().join() === [...b.scopes].sort().join()
  );
}
export function currentAccess(
  m: RoomMetadata,
  access: DashboardAccess | undefined,
): boolean {
  if (
    !access ||
    !validScopes(access.scopes) ||
    access.protocolVersion !== 3 ||
    access.generation !== m.generation ||
    access.expiresAt * 1000 <= Date.now()
  )
    return false;
  return m.devices.some(
    (d) =>
      d.deviceId === access.deviceId &&
      d.role === access.role &&
      d.expiresAt === access.expiresAt &&
      d.issuedAt === access.issuedAt &&
      [...d.scopes].sort().join() === [...access.scopes].sort().join(),
  );
}
export function filterEvent(
  type: string,
  body: Record<string, unknown>,
  scopes: string[],
  caps: Record<string, boolean>,
): Record<string, unknown> | null {
  const has = (scope: string) => scopes.includes(scope) && caps[scope] === true;
  if (type.startsWith("telemetry.")) return has("telemetry.view") ? body : null;
  if (type === "service.status") return has("server.status") ? body : null;
  if (type === "backup.progress") return has("backup.view") ? body : null;
  if (type === "inventory.plugins") return has("plugins.view") ? body : null;
  if (type === "chat.message") return has("chat.view") ? body : null;
  if (type === "console.lines") {
    if (!has("console.view.full") && !has("console.view.errors")) return null;
    const lines = Array.isArray(body.lines)
      ? body.lines
          .slice(0, 100)
          .filter(
            (line) =>
              isRecord(line) &&
              (has("console.view.full") ||
                line.level === "WARN" ||
                line.level === "ERROR" ||
                line.level === "SEVERE"),
          )
      : [];
    return { ...body, lines };
  }
  if (type === "inventory.players") {
    if (!has("players.view")) return null;
    const players = Array.isArray(body.players)
      ? body.players
          .slice(0, 512)
          .filter(isRecord)
          .map((p) => {
            const copy = { ...p };
            if (!has("players.address")) delete copy.address;
            if (!has("players.location")) delete copy.position;
            return copy;
          })
      : [];
    return { ...body, players };
  }
  return null;
}
function actionError(error: unknown): string {
  const code = error instanceof Error ? error.message : "DENIED";
  return (
    (
      {
        SCOPE_DENIED: "Your device does not have this scope.",
        CAPABILITY_DISABLED: "This feature is disabled in local policy.",
        HOST_OFFLINE: "The host companion is not connected.",
        PAPER_OFFLINE: "The Paper agent is offline.",
        CONFIRMATION_REQUIRED: "Confirm this action first.",
        RATE_LIMITED: "Too many requests. Wait a few seconds.",
        DUPLICATE_REQUEST: "This request ID was already submitted.",
      } as Record<string, string>
    )[code] ?? "The relay rejected this action."
  );
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
  for (const [key, value] of Object.entries(values))
    headers.set(`X-Plexon-${headerName(key)}`, value);
  const room = env.SERVER_ROOMS.get(env.SERVER_ROOMS.idFromName(serverId));
  return room.fetch(new Request(request, { headers }));
}

function internalRequest(
  path: string,
  env: Env,
  body: Record<string, unknown>,
): Request {
  return new Request(`https://relay.internal${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [INTERNAL_HEADER]: env.ACCESS_TOKEN_SECRET,
    },
    body: JSON.stringify(body),
  });
}

function authorizedInternal(request: Request, env: Env): boolean {
  return request.headers.get(INTERNAL_HEADER) === env.ACCESS_TOKEN_SECRET;
}

function identityFromHello(
  body: Record<string, unknown>,
  publicKey: string,
  fingerprint: string,
): AgentIdentity {
  return {
    publicKey,
    fingerprint,
    pluginVersion: requiredText(body.pluginVersion, "pluginVersion", 64),
    paperVersion: requiredText(body.paperVersion, "paperVersion", 256),
    minecraftVersion: requiredText(
      body.minecraftVersion,
      "minecraftVersion",
      64,
    ),
    javaVersion: requiredText(body.javaVersion, "javaVersion", 128),
    operatingSystem: requiredText(body.operatingSystem, "operatingSystem", 256),
    capabilities: booleanRecord(body.capabilities),
    hostPublicKey:
      typeof body.hostPublicKey === "string" ? body.hostPublicKey : "",
  };
}

function registrationFrom(
  body: Record<string, unknown>,
  lookupId: string,
): PairingRegistration {
  const expiresAt = Number(body.expiresAt);
  if (
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now() ||
    expiresAt > Date.now() + 6 * 60_000
  ) {
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
    if (!/^[a-z][a-z0-9.]{0,63}$/.test(key) || typeof child !== "boolean")
      throw new Error("Invalid capability");
    result[key] = child;
  }
  return result;
}

function requiredText(
  value: unknown,
  name: string,
  maximumLength: number,
): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > maximumLength
  )
    throw new Error(`Invalid ${name}`);
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
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function headerName(value: string): string {
  return value
    .replace(/[A-Z]/g, (character) => `-${character}`)
    .replace(/^./, (character) => character.toUpperCase());
}

function allowedOrigins(env: Env): Set<string> {
  return new Set(
    env.DASHBOARD_ORIGINS.split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function dashboardOriginAllowed(request: Request, env: Env): boolean {
  const origin = request.headers.get("Origin") ?? "";
  return allowedOrigins(env).has(origin);
}

function corsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
  });
  const origin = request.headers.get("Origin") ?? "";
  if (allowedOrigins(env).has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, Sec-WebSocket-Protocol",
    );
  }
  return headers;
}

function json(value: unknown, status = 200, headers?: Headers): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(value), {
    status,
    headers: responseHeaders,
  });
}

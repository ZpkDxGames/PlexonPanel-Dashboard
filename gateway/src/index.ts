import {
  createHash,
  randomUUID,
  type KeyObject,
} from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Socket } from "node:net";
import { loadGatewayConfig } from "./config.js";
import {
  normalizePairingCode,
  safeEqualText,
  verifyDashboardAccessToken,
} from "./crypto.js";
import {
  ReplayWindow,
  assertFreshEnvelope,
  decodeAgentPublicKey,
  decodeEnvelope,
  loadGatewayIdentity,
  signEnvelope,
  verifyChallengeProof,
  verifyEnvelope,
  type DecodedEnvelope,
} from "./protocol.js";
import { SlidingWindowRateLimiter } from "./rate-limit.js";
import {
  GatewayStore,
  IdentityConflictError,
  PairingClaimError,
  PairingCollisionError,
  type StateSlot,
} from "./store.js";
import { acceptWebSocket, type WebSocketPeer } from "./websocket.js";

const config = loadGatewayConfig();
const gatewayIdentity = loadGatewayIdentity(config.gatewayPrivateKeyBase64);
const store = new GatewayStore(config.pairingCodePepper, config.firebaseProjectId);
const agents = new Map<string, AgentContext>();
const dashboards = new Map<string, Set<WebSocketPeer>>();
const dashboardDeviceIds = new WeakMap<WebSocketPeer, string>();
const liveState = new Map<string, Record<string, unknown>>();
const persistence = new Map<string, PendingPersistence>();
const addressPairingLimit = new SlidingWindowRateLimiter(10, 15 * 60_000);
const codePairingLimit = new SlidingWindowRateLimiter(5, 5 * 60_000);

interface AgentContext {
  connectionId: string;
  peer: WebSocketPeer;
  replay: ReplayWindow;
  serverId: string | null;
  publicKey: KeyObject | null;
  publicKeyBase64: string | null;
  fingerprint: string | null;
  challenge: string | null;
  authenticated: boolean;
  paired: boolean;
  authenticationTimer: NodeJS.Timeout | null;
}

interface PendingPersistence {
  values: Partial<Record<StateSlot, Record<string, unknown>>>;
  timer: NodeJS.Timeout;
}

const server = createServer((request, response) => {
  void handleHttp(request, response).catch((error: unknown) => {
    logError("HTTP request failed", error);
    const statusCode = error !== null && typeof error === "object" && "statusCode" in error
      ? Number((error as { statusCode: unknown }).statusCode)
      : 500;
    if (!response.headersSent) json(response, Number.isInteger(statusCode) ? statusCode : 500, {
      ok: false,
      error: statusCode === 401 ? "Unauthorized" : "Internal gateway error",
    });
    else response.destroy();
  });
});

server.on("upgrade", (request, socket) => {
  const networkSocket = socket as Socket;
  void handleUpgrade(request, networkSocket).catch((error: unknown) => {
    logError("WebSocket upgrade rejected", error);
    if (!networkSocket.destroyed) rejectUpgrade(networkSocket, 403, "WebSocket upgrade rejected");
  });
});

server.on("clientError", (_error, socket) => {
  if (!socket.destroyed) socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
});

server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
server.keepAliveTimeout = 5_000;
server.listen(config.port, "0.0.0.0", () => {
  console.log(JSON.stringify({
    level: "info",
    event: "gateway.started",
    port: config.port,
    protocolVersion: 2,
    gatewayPublicKey: gatewayIdentity.publicKeyBase64,
  }));
});

const heartbeat = setInterval(() => {
  for (const context of agents.values()) context.peer.ping();
  for (const peers of dashboards.values()) {
    for (const peer of peers) peer.ping();
  }
  addressPairingLimit.prune();
  codePairingLimit.prune();
}, 25_000);
heartbeat.unref();

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

async function handleHttp(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "gateway.local"}`);
  if (request.method === "GET" && url.pathname === "/healthz") {
    json(response, 200, {
      ok: true,
      service: "plexonpanel-gateway",
      protocolVersion: 2,
      connectedAgents: [...agents.values()].filter((context) => context.authenticated).length,
      connectedDashboards: [...dashboards.values()].reduce((sum, peers) => sum + peers.size, 0),
    });
    return;
  }

  requireInternalAuthorization(request);

  if (request.method === "POST" && url.pathname === "/v1/pairings/claim") {
    const body = await readJson(request);
    const clientAddress = safeClientAddress(request.headers["x-plexon-client-address"]);
    const addressKey = createHash("sha256").update(clientAddress).digest("hex");
    if (!addressPairingLimit.consume(`address:${addressKey}`)) {
      json(response, 429, { ok: false, error: "Too many pairing attempts" });
      return;
    }
    let code: string;
    try {
      code = normalizePairingCode(body.code);
    } catch {
      json(response, 400, { ok: false, error: "A six-digit pairing code is required" });
      return;
    }
    const codeKey = createHash("sha256").update(code).digest("hex");
    if (!codePairingLimit.consume(`code:${codeKey}`)) {
      json(response, 429, { ok: false, error: "Too many attempts for this pairing code" });
      return;
    }
    const deviceId = requiredIdentifier(body.deviceId, "deviceId", 128);
    const deviceLabel = requiredText(body.deviceLabel, "deviceLabel", 120);
    const resolution = await store.resolvePairing(code);
    const context = resolution ? agents.get(resolution.serverId) : null;
    if (!resolution
        || resolution.status !== "open"
        || resolution.expiresAt.getTime() <= Date.now()
        || !context?.authenticated
        || context.peer.isClosed) {
      json(response, 403, { ok: false, error: "Invalid, expired, or offline pairing code" });
      return;
    }
    try {
      const claim = await store.claimPairing(code, deviceId, deviceLabel);
      context.paired = true;
      sendGateway(context, "pairing.complete", {
        pairedAt: new Date().toISOString(),
        deviceId,
      });
      await store.recordAudit(claim.serverId, randomUUID(), {
        type: "server.paired",
        actorId: `device:${deviceId}`,
        result: "success",
      });
      json(response, 200, {
        ok: true,
        serverId: claim.serverId,
        deviceId: claim.deviceId,
      });
    } catch (error) {
      if (error instanceof PairingClaimError) {
        json(response, 403, { ok: false, error: "Invalid or expired pairing code" });
        return;
      }
      throw error;
    }
    return;
  }

  const stateMatch = /^\/v1\/servers\/([0-9a-f-]{36})\/state$/i.exec(url.pathname);
  if (request.method === "GET" && stateMatch?.[1]) {
    const serverId = stateMatch[1];
    const deviceId = requiredIdentifier(request.headers["x-plexon-device-id"], "X-Plexon-Device-Id", 128);
    if (!await store.isAuthorizedDevice(serverId, deviceId)) {
      json(response, 403, { ok: false, error: "Dashboard device is not authorized" });
      return;
    }
    const state = await store.readDashboardState(serverId);
    if (!state) {
      json(response, 404, { ok: false, error: "Server not found" });
      return;
    }
    const context = agents.get(serverId);
    json(response, 200, {
      ok: true,
      ...state,
      connectionStatus: context?.authenticated && !context.peer.isClosed ? "online" : "offline",
      liveState: liveState.get(serverId) ?? {},
    });
    return;
  }

  const actionMatch = /^\/v1\/servers\/([0-9a-f-]{36})\/actions$/i.exec(url.pathname);
  if (request.method === "POST" && actionMatch?.[1]) {
    const serverId = actionMatch[1];
    const context = agents.get(serverId);
    if (!context?.authenticated || !context.paired || context.peer.isClosed) {
      json(response, 409, { ok: false, error: "Server is offline or unpaired" });
      return;
    }
    const body = await readJson(request);
    const action = requiredIdentifier(body.action, "action", 64);
    const deviceId = requiredIdentifier(body.deviceId, "deviceId", 128);
    if (!await store.isAuthorizedDevice(serverId, deviceId)) {
      json(response, 403, { ok: false, error: "Dashboard device is not authorized" });
      return;
    }
    const parameters = recordField(body.parameters, "parameters");
    const requestId = randomUUID();
    sendGateway(context, "action.request", {
      requestId,
      action,
      actorId: `device:${deviceId}`,
      actorDisplayName: "Dashboard administrator",
      parameters,
    });
    await store.recordAudit(serverId, requestId, {
      type: "action.requested",
      requestId,
      action,
      actorId: `device:${deviceId}`,
      status: "pending",
    });
    json(response, 202, { ok: true, requestId });
    return;
  }

  const revokeDeviceMatch = /^\/v1\/servers\/([0-9a-f-]{36})\/devices\/revoke$/i.exec(url.pathname);
  if (request.method === "POST" && revokeDeviceMatch?.[1]) {
    const serverId = revokeDeviceMatch[1];
    const body = await readJson(request);
    const deviceId = requiredIdentifier(body.deviceId, "deviceId", 128);
    const revoked = await store.revokeDevice(serverId, deviceId);
    if (revoked) {
      const peers = dashboards.get(serverId);
      if (peers) {
        for (const peer of peers) {
          if (dashboardDeviceIds.get(peer) === deviceId) peer.close(4003, "Dashboard device signed out");
        }
      }
      await store.recordAudit(serverId, randomUUID(), {
        type: "device.revoked",
        actorId: `device:${deviceId}`,
        result: "success",
      });
    }
    json(response, 200, { ok: true, revoked });
    return;
  }

  json(response, 404, { ok: false, error: "Route not found" });
}

async function handleUpgrade(request: IncomingMessage, socket: Socket): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "gateway.local"}`);
  if (request.headers.upgrade?.toLowerCase() !== "websocket") {
    rejectUpgrade(socket, 400, "WebSocket upgrade required");
    return;
  }
  if (url.pathname === "/v1/agent") {
    if (request.headers["x-plexonpanel-protocol"] !== "2") {
      rejectUpgrade(socket, 426, "PlexonPanel protocol v2 required");
      return;
    }
    const context: AgentContext = {
      connectionId: randomUUID(),
      peer: null as unknown as WebSocketPeer,
      replay: new ReplayWindow(),
      serverId: null,
      publicKey: null,
      publicKeyBase64: null,
      fingerprint: null,
      challenge: null,
      authenticated: false,
      paired: false,
      authenticationTimer: null,
    };
    context.peer = acceptWebSocket(request, socket, {
      onText: (text) => handleAgentMessage(context, text),
      onClose: () => handleAgentClose(context),
      onError: (error) => logError("Agent WebSocket error", error, context.serverId),
    });
    context.authenticationTimer = setTimeout(() => {
      if (!context.authenticated) context.peer.close(4001, "Agent authentication timed out");
    }, 15_000);
    context.authenticationTimer.unref();
    return;
  }

  if (url.pathname === "/v1/dashboard") {
    const origin = typeof request.headers.origin === "string" ? request.headers.origin : "";
    if (!config.allowedDashboardOrigins.has(origin)) {
      rejectUpgrade(socket, 403, "Dashboard origin is not allowed");
      return;
    }
    const protocols = typeof request.headers["sec-websocket-protocol"] === "string"
      ? request.headers["sec-websocket-protocol"].split(",").map((value) => value.trim())
      : [];
    const authenticationProtocol = protocols.find((value) => value.startsWith("auth."));
    if (!protocols.includes("plexonpanel-v2") || !authenticationProtocol) {
      rejectUpgrade(socket, 401, "Dashboard authentication is required");
      return;
    }
    const access = verifyDashboardAccessToken(
      authenticationProtocol.slice("auth.".length),
      config.dashboardTokenSecret,
    );
    if (!await store.isAuthorizedDevice(access.serverId, access.deviceId)) {
      rejectUpgrade(socket, 403, "Dashboard device has been revoked");
      return;
    }
    const peer = acceptWebSocket(request, socket, {
      onText: async () => { throw new Error("Dashboard WebSockets are read-only"); },
      onClose: () => removeDashboard(access.serverId, peer),
      onError: (error) => logError("Dashboard WebSocket error", error, access.serverId),
    }, "plexonpanel-v2");
    const peers = dashboards.get(access.serverId) ?? new Set<WebSocketPeer>();
    peers.add(peer);
    dashboardDeviceIds.set(peer, access.deviceId);
    dashboards.set(access.serverId, peers);
    const persisted = await store.readDashboardState(access.serverId);
    const context = agents.get(access.serverId);
    peer.sendJson({
      type: "dashboard.ready",
      serverId: access.serverId,
      connectionStatus: context?.authenticated && !context.peer.isClosed ? "online" : "offline",
      persisted: persisted ?? {},
      liveState: liveState.get(access.serverId) ?? {},
      receivedAt: new Date().toISOString(),
    });
    return;
  }

  rejectUpgrade(socket, 404, "WebSocket route not found");
}

async function handleAgentMessage(context: AgentContext, text: string): Promise<void> {
  const decoded = decodeEnvelope(text);
  assertFreshEnvelope(decoded.envelope);
  if (!context.replay.accept(decoded.envelope.messageId)) throw new Error("Replayed protocol message");

  if (decoded.envelope.type === "agent.hello") {
    await handleAgentHello(context, decoded);
    return;
  }
  if (!context.serverId || !context.publicKey || decoded.envelope.serverId !== context.serverId) {
    throw new Error("Agent identity is not established");
  }
  if (!verifyEnvelope(decoded.envelope, context.publicKey)) throw new Error("Invalid agent signature");

  if (decoded.envelope.type === "agent.challenge_response") {
    const nonce = requiredText(decoded.body.nonce, "nonce", 128);
    if (!context.challenge
        || nonce !== context.challenge
        || !verifyChallengeProof(nonce, decoded.body.proof, context.publicKey)) {
      throw new Error("Invalid agent challenge proof");
    }
    context.authenticated = true;
    context.challenge = null;
    if (context.authenticationTimer) clearTimeout(context.authenticationTimer);
    context.authenticationTimer = null;
    await store.markAgentOnline(context.serverId, context.connectionId);
    sendGateway(context, "gateway.authenticated", {
      authenticatedAt: new Date().toISOString(),
      paired: context.paired,
    });
    if (context.paired) {
      sendGateway(context, "pairing.complete", { restored: true, pairedAt: new Date().toISOString() });
    }
    return;
  }
  if (!context.authenticated) throw new Error("Agent must authenticate before sending data");

  if (decoded.envelope.type === "agent.pairing_begin") {
    await handlePairingRegistration(context, decoded.body);
    return;
  }
  if (decoded.envelope.type === "agent.unpair_request") {
    await store.revokePairing(context.serverId);
    context.paired = false;
    sendGateway(context, "pairing.revoked", { revokedAt: new Date().toISOString() });
    broadcast(context.serverId, {
      type: "server.unpaired",
      serverId: context.serverId,
      receivedAt: new Date().toISOString(),
    });
    return;
  }

  if (!context.paired) return;
  await handleAgentData(context, decoded);
}

async function handleAgentHello(context: AgentContext, decoded: DecodedEnvelope): Promise<void> {
  if (context.serverId || decoded.body.protocolVersion !== 2) throw new Error("Invalid or duplicate agent hello");
  const publicKeyBase64 = requiredText(decoded.body.publicKey, "publicKey", 512);
  const publicKey = decodeAgentPublicKey(publicKeyBase64);
  if (!verifyEnvelope(decoded.envelope, publicKey)) throw new Error("Invalid signed agent hello");
  const fingerprint = requiredText(decoded.body.publicKeyFingerprint, "publicKeyFingerprint", 64);
  if (!safeEqualText(fingerprint, publicKeyFingerprint(publicKey))) {
    throw new Error("Agent public-key fingerprint mismatch");
  }
  const registration = await store.registerAgentIdentity({
    serverId: decoded.envelope.serverId,
    publicKey: publicKeyBase64,
    fingerprint,
    pluginVersion: requiredText(decoded.body.agentVersion, "agentVersion", 64),
    paperVersion: requiredText(decoded.body.serverSoftware, "serverSoftware", 256),
    minecraftVersion: requiredText(decoded.body.minecraftVersion, "minecraftVersion", 64),
    javaVersion: requiredText(decoded.body.javaVersion, "javaVersion", 128),
    operatingSystem: requiredText(decoded.body.operatingSystem, "operatingSystem", 256),
    capabilities: booleanRecord(decoded.body.capabilities, "capabilities"),
  });
  const previous = agents.get(decoded.envelope.serverId);
  if (previous && previous !== context) previous.peer.close(4000, "Replaced by a newer agent connection");
  context.serverId = decoded.envelope.serverId;
  context.publicKey = publicKey;
  context.publicKeyBase64 = publicKeyBase64;
  context.fingerprint = fingerprint;
  context.paired = registration.paired;
  context.challenge = randomUUID();
  agents.set(context.serverId, context);
  sendGateway(context, "gateway.challenge", { nonce: context.challenge });
}

async function handlePairingRegistration(
  context: AgentContext,
  body: Record<string, unknown>,
): Promise<void> {
  const serverId = requireServerId(context);
  const requestId = requiredIdentifier(body.requestId, "requestId", 128);
  const code = normalizePairingCode(body.code);
  const fingerprint = requiredText(body.fingerprint, "fingerprint", 64);
  const expiresAt = new Date(requiredText(body.expiresAt, "expiresAt", 64));
  if (fingerprint !== context.fingerprint
      || !Number.isFinite(expiresAt.getTime())
      || expiresAt.getTime() <= Date.now()
      || expiresAt.getTime() > Date.now() + 5 * 60_000 + 30_000) {
    sendGateway(context, "pairing.rejected", { requestId, reason: "invalid_request" });
    return;
  }
  const challengeId = randomUUID();
  try {
    await store.registerPairing({
      serverId,
      requestId,
      challengeId,
      code,
      fingerprint,
      expiresAt,
    });
    sendGateway(context, "pairing.registered", {
      requestId,
      challengeId,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof PairingCollisionError || error instanceof IdentityConflictError) {
      sendGateway(context, "pairing.rejected", {
        requestId,
        reason: error instanceof PairingCollisionError ? "code_collision" : "identity_conflict",
      });
      return;
    }
    throw error;
  }
}

async function handleAgentData(context: AgentContext, decoded: DecodedEnvelope): Promise<void> {
  const serverId = requireServerId(context);
  const slot = stateSlot(decoded.envelope.type);
  if (slot) {
    const current = liveState.get(serverId) ?? {};
    if (slot === "errors") {
      const previous = Array.isArray(current.errors) ? current.errors : [];
      const lines = Array.isArray(decoded.body.lines)
        ? decoded.body.lines.filter(isErrorLine).slice(-100)
        : [];
      current.errors = [...previous, ...lines].slice(-100);
    } else {
      current[slot] = decoded.body;
    }
    liveState.set(serverId, current);
    const persistedBody = slot === "errors"
      ? { lines: current.errors ?? [], capturedAt: new Date().toISOString() }
      : decoded.body;
    queuePersistence(serverId, slot, persistedBody as Record<string, unknown>);
  }
  if (decoded.envelope.type === "action.result") {
    const requestId = requiredIdentifier(decoded.body.requestId, "requestId", 128);
    await store.recordAudit(serverId, requestId, {
      type: "action.result",
      ...decoded.body,
    });
  }
  broadcast(serverId, {
    type: "server.event",
    serverId,
    eventType: decoded.envelope.type,
    body: decoded.body,
    receivedAt: new Date().toISOString(),
  });
}

function stateSlot(type: string): StateSlot | null {
  return ({
    "telemetry.server": "server",
    "telemetry.system": "system",
    "inventory.players": "players",
    "inventory.plugins": "plugins",
    "console.lines": "errors",
  } as Record<string, StateSlot>)[type] ?? null;
}

function queuePersistence(serverId: string, slot: StateSlot, body: Record<string, unknown>): void {
  const pending = persistence.get(serverId);
  if (pending) {
    pending.values[slot] = body;
    return;
  }
  const values: Partial<Record<StateSlot, Record<string, unknown>>> = { [slot]: body };
  const timer = setTimeout(() => void flushPersistence(serverId), 5_000);
  timer.unref();
  persistence.set(serverId, { values, timer });
}

async function flushPersistence(serverId: string): Promise<void> {
  const pending = persistence.get(serverId);
  if (!pending) return;
  persistence.delete(serverId);
  clearTimeout(pending.timer);
  await Promise.all(Object.entries(pending.values).map(([slot, body]) => (
    store.saveLatestState(serverId, slot as StateSlot, body)
  )));
}

async function handleAgentClose(context: AgentContext): Promise<void> {
  if (context.authenticationTimer) clearTimeout(context.authenticationTimer);
  if (!context.serverId) return;
  if (agents.get(context.serverId) === context) {
    agents.delete(context.serverId);
    broadcast(context.serverId, {
      type: "server.connection",
      serverId: context.serverId,
      connectionStatus: "offline",
      receivedAt: new Date().toISOString(),
    });
  }
  try {
    await store.markAgentOffline(context.serverId, context.connectionId);
  } catch (error) {
    logError("Unable to record agent disconnect", error, context.serverId);
  }
}

function sendGateway(context: AgentContext, type: string, body: Record<string, unknown>): void {
  context.peer.sendText(signEnvelope(type, requireServerId(context), body, gatewayIdentity));
}

function broadcast(serverId: string, message: Record<string, unknown>): void {
  const peers = dashboards.get(serverId);
  if (!peers) return;
  for (const peer of peers) {
    if (peer.isClosed) peers.delete(peer);
    else peer.sendJson(message);
  }
  if (peers.size === 0) dashboards.delete(serverId);
}

function removeDashboard(serverId: string, peer: WebSocketPeer): void {
  const peers = dashboards.get(serverId);
  if (!peers) return;
  peers.delete(peer);
  if (peers.size === 0) dashboards.delete(serverId);
}

function requireInternalAuthorization(request: IncomingMessage): void {
  const authorization = request.headers.authorization ?? "";
  const expected = `Bearer ${config.internalApiKey}`;
  if (!safeEqualText(authorization, expected)) {
    const error = new Error("Unauthorized gateway request") as Error & { statusCode?: number };
    error.statusCode = 401;
    throw error;
  }
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += value.length;
    if (size > 65_536) throw new Error("Request body is too large");
    chunks.push(value);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Request body is not valid JSON");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Request body must be an object");
  }
  return parsed as Record<string, unknown>;
}

function json(response: ServerResponse, statusCode: number, value: unknown): void {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

function rejectUpgrade(socket: Socket, statusCode: number, message: string): void {
  const reason = ({ 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 426: "Upgrade Required" } as Record<number, string>)[statusCode] ?? "Error";
  const body = Buffer.from(message, "utf8");
  socket.end([
    `HTTP/1.1 ${statusCode} ${reason}`,
    "Connection: close",
    "Content-Type: text/plain; charset=utf-8",
    `Content-Length: ${body.length}`,
    "",
    message,
  ].join("\r\n"));
}

function requiredText(value: unknown, name: string, maximumLength: number): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maximumLength || value.includes("\0")) {
    throw new Error(`${name} is invalid`);
  }
  return value;
}

function requiredIdentifier(value: unknown, name: string, maximumLength: number): string {
  const text = requiredText(value, name, maximumLength);
  if (!/^[A-Za-z0-9._:@-]+$/.test(text)) throw new Error(`${name} is invalid`);
  return text;
}

function recordField(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}

function booleanRecord(value: unknown, name: string): Record<string, boolean> {
  const source = recordField(value, name);
  const result: Record<string, boolean> = {};
  for (const [key, child] of Object.entries(source)) {
    if (!/^[a-z][A-Za-z0-9]{0,63}$/.test(key) || typeof child !== "boolean") {
      throw new Error(`${name} contains an invalid capability`);
    }
    result[key] = child;
  }
  return result;
}

function safeClientAddress(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  const address = raw?.split(",")[0]?.trim() ?? "unknown";
  return address.slice(0, 64);
}

function requireServerId(context: AgentContext): string {
  if (!context.serverId) throw new Error("Agent server identity is not established");
  return context.serverId;
}

function publicKeyFingerprint(key: KeyObject): string {
  const der = key.export({ format: "der", type: "spki" });
  const digest = createHash("sha256").update(der).digest().subarray(0, 12);
  return [...digest].map((value) => value.toString(16).padStart(2, "0").toUpperCase()).join(":");
}

function isErrorLine(value: unknown): boolean {
  if (value === null || typeof value !== "object") return false;
  const level = (value as Record<string, unknown>).level;
  return level === "WARN" || level === "WARNING" || level === "ERROR" || level === "SEVERE";
}

function logError(message: string, error: unknown, serverId?: string | null): void {
  console.error(JSON.stringify({
    level: "error",
    event: message,
    ...(serverId ? { serverId } : {}),
    error: error instanceof Error ? error.message : "Unknown error",
  }));
}

async function shutdown(signal: string): Promise<void> {
  clearInterval(heartbeat);
  server.close();
  for (const context of agents.values()) context.peer.close(1001, "Gateway restarting");
  for (const peers of dashboards.values()) {
    for (const peer of peers) peer.close(1001, "Gateway restarting");
  }
  await Promise.all([...persistence.keys()].map(flushPersistence));
  console.log(JSON.stringify({ level: "info", event: "gateway.stopped", signal }));
  process.exit(0);
}

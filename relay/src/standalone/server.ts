import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import { pathToFileURL } from "node:url";
import { normalizePairingCode, opaqueClientKey, pairingLookupId, signDashboardAccess, verifyDashboardAccess, type DashboardAccess } from "../security.js";
import { loadStandaloneConfig, type StandaloneConfig } from "./config.js";
import { CoordinationStore } from "./persistence.js";
import { RoomManager, type RelayCounters } from "./room-manager.js";
import { NodeWebSocket, header, websocketProtocols } from "./websocket.js";

const VERSION = "3.1.0";
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface StandaloneRelay {
  readonly config: StandaloneConfig;
  readonly counters: RelayCounters;
  readonly store: CoordinationStore;
  readonly rooms: RoomManager;
  readonly server: ReturnType<typeof createServer>;
  start(): Promise<void>;
  close(): Promise<void>;
}

export function createStandaloneRelay(config: StandaloneConfig): StandaloneRelay {
  const store = new CoordinationStore(config.databasePath);
  const counters: RelayCounters = {
    startedAt: Date.now(),
    connectionsAccepted: 0,
    connectionsRejected: 0,
    duplicateAgentsReplaced: 0,
    authenticationFailures: 0,
    protocolFailures: 0,
    pairingClaims: 0,
    pairingClaimFailures: 0,
    rateLimitedPairingClaims: 0,
    messagesAccepted: 0,
    messagesRejected: 0,
    recentDisconnects: [],
  };
  const rooms = new RoomManager(store, config, counters);
  const server = createServer((request, response) => {
    void handleHttp(request, response, config, store, rooms, counters).catch((error) => {
      safeLog("HTTP_HANDLER_FAILURE", error);
      if (!response.headersSent) json(response, 500, { ok: false, error: "Internal relay error" });
      else response.destroy();
    });
  });
  server.on("upgrade", (request, socket, head) => {
    void handleUpgrade(request, socket, head, config, rooms, counters).catch((error) => {
      counters.connectionsRejected += 1;
      safeLog("UPGRADE_FAILURE", error);
      rejectUpgrade(socket, 500, "Internal relay error");
    });
  });
  server.on("clientError", (_error, socket) => {
    if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
  });

  const cleanup = setInterval(() => {
    try {
      store.prune(Date.now(), 128);
    } catch (error) {
      safeLog("COORDINATION_CLEANUP_FAILURE", error);
    }
  }, 60_000);
  cleanup.unref();

  let closing: Promise<void> | null = null;
  return {
    config,
    counters,
    store,
    rooms,
    server,
    async start() {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
          server.off("listening", onListening);
          reject(error);
        };
        const onListening = () => {
          server.off("error", onError);
          resolve();
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(config.port, config.host);
      });
      console.log(
        JSON.stringify({
          component: "PlexonPanelRelay",
          runtime: "standalone",
          event: "started",
          host: config.host,
          port: config.port,
          protocolVersion: 3,
          storage: "coordination-only",
        }),
      );
    },
    close() {
      if (closing) return closing;
      closing = (async () => {
        clearInterval(cleanup);
        rooms.closeAll();
        await Promise.race([
          new Promise<void>((resolve) => server.close(() => resolve())),
          new Promise<void>((resolve) => setTimeout(resolve, config.gracefulShutdownMs)),
        ]);
        server.closeAllConnections();
        store.close();
      })();
      return closing;
    },
  };
}

async function handleHttp(
  request: IncomingMessage,
  response: ServerResponse,
  config: StandaloneConfig,
  store: CoordinationStore,
  rooms: RoomManager,
  counters: RelayCounters,
): Promise<void> {
  const url = requestUrl(request);
  const cors = corsHeaders(request, config);
  setHeaders(response, cors);

  if (request.method === "GET" && url.pathname === "/healthz") {
    const sockets = rooms.socketCounts();
    json(response, 200, {
      ok: true,
      service: "plexonpanel-relay",
      runtime: "standalone",
      version: VERSION,
      protocolVersion: 3,
      storage: "coordination-only",
      uptimeSeconds: Math.max(0, Math.floor((Date.now() - counters.startedAt) / 1000)),
      rooms: rooms.roomCount(),
      connections: {
        paper: sockets.paper,
        host: sockets.host,
        dashboards: sockets.dashboards,
        unauthenticated: sockets.unauthenticated,
      },
    });
    return;
  }

  const dashboardRoute =
    url.pathname.startsWith("/v1/pairings") || url.pathname.startsWith("/v1/dashboard");
  if (request.method === "OPTIONS" && dashboardRoute) {
    if (!originAllowed(request, config)) {
      json(response, 403, { ok: false, error: "Dashboard origin is not allowed", code: "ORIGIN_DENIED" });
      return;
    }
    response.statusCode = 204;
    response.end();
    return;
  }
  if (dashboardRoute && !originAllowed(request, config)) {
    json(response, 403, { ok: false, error: "Dashboard origin is not allowed", code: "ORIGIN_DENIED" });
    return;
  }

  if (request.method === "POST" && url.pathname === "/v1/pairings/claim") {
    counters.pairingClaims += 1;
    let body: Record<string, unknown>;
    let code: string;
    try {
      body = await boundedJson(request, 4096);
      code = normalizePairingCode(body.code);
      if (Object.keys(body).some((key) => key !== "code" && key !== "name"))
        throw new Error("Unexpected pairing field");
    } catch {
      counters.pairingClaimFailures += 1;
      json(response, 400, {
        ok: false,
        error: "Pairing request must be valid JSON with a six-digit code and device name.",
      });
      return;
    }
    const name = typeof body.name === "string" ? body.name : "Browser device";
    if (!/^[\p{L}\p{N} ._()-]{1,64}$/u.test(name)) {
      counters.pairingClaimFailures += 1;
      json(response, 400, { ok: false, error: "Choose a short device name." });
      return;
    }
    const clientKey = await opaqueClientKey(clientIdentity(request, config), config.pairingCodePepper);
    if (!store.consumePairingRateLimit(clientKey)) {
      counters.rateLimitedPairingClaims += 1;
      counters.pairingClaimFailures += 1;
      json(response, 429, { ok: false, error: "Too many pairing attempts. Try again in 15 minutes." });
      return;
    }
    const lookupId = await pairingLookupId(code, config.pairingCodePepper);
    const registration = store.resolvePairingByLookup(lookupId);
    if (!registration) {
      counters.pairingClaimFailures += 1;
      json(response, 403, { ok: false, error: "Invalid or expired pairing code." });
      return;
    }
    const room = rooms.room(registration.serverId);
    const grant = await room.claimPairing(registration, name);
    if (!grant) {
      counters.pairingClaimFailures += 1;
      json(response, 403, {
        ok: false,
        error: "Pairing was not approved by the local Paper agent. Generate another code.",
      });
      return;
    }
    store.deletePairing(registration.lookupId);
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
    const origin = publicOrigin(request, config);
    const websocket = new URL("/v1/dashboard", origin);
    websocket.protocol = websocket.protocol === "https:" ? "wss:" : "ws:";
    json(response, 200, {
      ok: true,
      protocolVersion: 3,
      serverId: access.serverId,
      deviceId: access.deviceId,
      role: access.role,
      scopes: access.scopes,
      name: grant.device.name,
      fingerprint: registration.fingerprint,
      accessToken: await signDashboardAccess(access, config.accessTokenSecret),
      expiresAt: new Date(access.expiresAt * 1000).toISOString(),
      websocketUrl: websocket.toString(),
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/v1/dashboard/session") {
    const authorization = header(request, "authorization");
    if (!authorization.startsWith("Bearer ")) {
      json(response, 401, { ok: false, error: "Dashboard credential is required" });
      return;
    }
    let access: DashboardAccess;
    try {
      access = await verifyDashboardAccess(authorization.slice(7), config.accessTokenSecret);
    } catch {
      json(response, 401, {
        ok: false,
        error: "Device credential expired or incompatible; pair this browser again.",
        code: "CREDENTIAL_INVALID",
      });
      return;
    }
    if (!rooms.room(access.serverId).acceptsDashboard(access)) {
      json(response, 401, { ok: false, error: "This device was revoked.", code: "DEVICE_REVOKED" });
      return;
    }
    json(response, 200, {
      ok: true,
      protocolVersion: 3,
      serverId: access.serverId,
      role: access.role,
      scopes: access.scopes,
      expiresAt: new Date(access.expiresAt * 1000).toISOString(),
    });
    return;
  }

  json(response, 404, { ok: false, error: "Route not found" });
}

async function handleUpgrade(
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  config: StandaloneConfig,
  rooms: RoomManager,
  counters: RelayCounters,
): Promise<void> {
  const url = requestUrl(request);
  if (header(request, "upgrade").toLowerCase() !== "websocket") {
    counters.connectionsRejected += 1;
    rejectUpgrade(socket, 426, "WebSocket required");
    return;
  }

  if (url.pathname === "/v1/agent") {
    if (header(request, "x-plexonpanel-protocol") !== "3") {
      counters.connectionsRejected += 1;
      rejectUpgrade(socket, 426, "Protocol 3 required");
      return;
    }
    const serverId = url.searchParams.get("serverId") ?? "";
    const kind = url.searchParams.get("agentKind") ?? "PAPER";
    if (!UUID.test(serverId) || (kind !== "PAPER" && kind !== "HOST")) {
      counters.connectionsRejected += 1;
      rejectUpgrade(socket, 400, "Invalid agent identity");
      return;
    }
    const peer = NodeWebSocket.accept(request, socket, head, { maxMessageBytes: 131_072 });
    if (!rooms.room(serverId).attachAgent(peer, kind)) {
      counters.connectionsRejected += 1;
      peer.close(1013, "Agent handshake limit reached");
      return;
    }
    counters.connectionsAccepted += 1;
    return;
  }

  if (url.pathname === "/v1/dashboard") {
    if (!originAllowed(request, config)) {
      counters.connectionsRejected += 1;
      rejectUpgrade(socket, 403, "Dashboard origin is not allowed");
      return;
    }
    const protocols = websocketProtocols(request);
    const authentication = protocols.find((protocol) => protocol.startsWith("auth."));
    if (!protocols.includes("plexonpanel-v3") || !authentication) {
      counters.connectionsRejected += 1;
      rejectUpgrade(socket, 401, "Protocol 3 authentication required");
      return;
    }
    let access: DashboardAccess;
    try {
      access = await verifyDashboardAccess(authentication.slice(5), config.accessTokenSecret);
    } catch {
      counters.connectionsRejected += 1;
      rejectUpgrade(socket, 401, "Device credential invalid or expired");
      return;
    }
    const room = rooms.room(access.serverId);
    if (!room.acceptsDashboard(access)) {
      counters.connectionsRejected += 1;
      rejectUpgrade(socket, 403, "Device revoked");
      return;
    }
    const peer = NodeWebSocket.accept(request, socket, head, {
      protocol: "plexonpanel-v3",
      maxMessageBytes: 65_536,
    });
    if (!room.attachDashboard(peer, access)) {
      counters.connectionsRejected += 1;
      peer.close(1013, "Dashboard connection limit reached");
      return;
    }
    counters.connectionsAccepted += 1;
    return;
  }

  counters.connectionsRejected += 1;
  rejectUpgrade(socket, 404, "Route not found");
}

function requestUrl(request: IncomingMessage): URL {
  const host = header(request, "host") || "127.0.0.1";
  return new URL(request.url ?? "/", `http://${host}`);
}

function publicOrigin(request: IncomingMessage, config: StandaloneConfig): URL {
  const host = header(request, "host") || `${config.host}:${config.port}`;
  const trusted = trustedProxyRequest(request, config);
  const forwarded = trusted ? header(request, "x-forwarded-proto").split(",")[0]?.trim() : "";
  const protocol = forwarded === "https" ? "https:" : "http:";
  return new URL(`${protocol}//${host}`);
}

function originAllowed(request: IncomingMessage, config: StandaloneConfig): boolean {
  const origin = header(request, "origin");
  return Boolean(origin && config.dashboardOrigins.has(origin));
}

function corsHeaders(request: IncomingMessage, config: StandaloneConfig): Record<string, string> {
  const origin = header(request, "origin");
  if (!origin || !config.dashboardOrigins.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

function clientIdentity(request: IncomingMessage, config: StandaloneConfig): string {
  if (trustedProxyRequest(request, config)) {
    const cloudflare = header(request, "cf-connecting-ip").trim();
    if (cloudflare && cloudflare.length <= 128) return cloudflare;
  }
  return request.socket.remoteAddress ?? "unknown";
}

function trustedProxyRequest(request: IncomingMessage, config: StandaloneConfig): boolean {
  if (config.trustedProxy !== "cloudflare-loopback") return false;
  const address = request.socket.remoteAddress ?? "";
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

async function boundedJson(request: IncomingMessage, maximum: number): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const raw of request) {
    const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    size += chunk.length;
    if (size > maximum) throw new Error("Request body exceeds limits");
    chunks.push(chunk);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks, size).toString("utf8"));
  if (!record(parsed)) throw new Error("Expected object");
  return parsed;
}

function setHeaders(response: ServerResponse, headers: Record<string, string>): void {
  for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
}

function json(response: ServerResponse, status: number, body: Record<string, unknown>): void {
  const encoded = JSON.stringify(body);
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Content-Length", Buffer.byteLength(encoded));
  response.end(encoded);
}

function rejectUpgrade(socket: Duplex, status: number, message: string): void {
  if (socket.destroyed) return;
  const phrase =
    ({ 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 426: "Upgrade Required", 429: "Too Many Requests", 500: "Internal Server Error" } as Record<number, string>)[status] ?? "Error";
  const body = JSON.stringify({ ok: false, error: message });
  socket.end(
    `HTTP/1.1 ${status} ${phrase}\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`,
  );
}

function safeLog(code: string, error: unknown): void {
  console.error(
    JSON.stringify({
      component: "PlexonPanelRelay",
      runtime: "standalone",
      code,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function main(): Promise<void> {
  const relay = createStandaloneRelay(await loadStandaloneConfig());
  const shutdown = (signal: string) => {
    console.log(JSON.stringify({ component: "PlexonPanelRelay", runtime: "standalone", event: "shutdown", signal }));
    void relay.close().finally(() => process.exit(0));
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.on("uncaughtException", (error) => {
    safeLog("UNCAUGHT_EXCEPTION", error);
    void relay.close().finally(() => process.exit(1));
  });
  process.on("unhandledRejection", (error) => {
    safeLog("UNHANDLED_REJECTION", error);
    void relay.close().finally(() => process.exit(1));
  });
  await relay.start();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error) => {
    safeLog("STARTUP_FAILURE", error);
    process.exitCode = 1;
  });
}

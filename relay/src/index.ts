import coreWorker, {
  PairingDirectory,
  ServerRoom as CoreServerRoom,
  currentAccess,
  filterEvent,
  validDevice,
} from "./index-core.js";
import {
  assertFreshEnvelope,
  decodeEnvelope,
  importAgentPublicKey,
  verifyEnvelope,
} from "./protocol.js";

export { PairingDirectory, currentAccess, filterEvent, validDevice };

type AgentKind = "PAPER" | "HOST";
type AgentAttachment = {
  role: "agent" | "dashboard";
  serverId: string;
  kind?: AgentKind;
  authenticated?: boolean;
  publicKey?: string;
  sessionNonce?: string;
  sequence?: number;
  recent?: string[];
  access?: Parameters<typeof currentAccess>[1];
  consoleHealthy?: boolean;
  consoleSourceState?: string;
};
type RoomMetadataLike = Parameters<typeof currentAccess>[0] & {
  identity?: { hostPublicKey?: string; capabilities: Record<string, boolean> };
  hostIdentity?: { capabilities: Record<string, boolean> };
};
type RoomInternals = {
  state: DurableObjectState;
  metadata(): Promise<RoomMetadataLike>;
  agents(kind?: AgentKind): WebSocket[];
  broadcastReady(metadata: RoomMetadataLike): Promise<void>;
  sendToAgent(kind: AgentKind, type: string, body: Record<string, unknown>): Promise<boolean>;
  safeDashboardSend(
    socket: WebSocket,
    payload: Record<string, unknown>,
    attachment?: AgentAttachment,
  ): boolean;
};
type CorePrototype = {
  agentMessage(
    socket: WebSocket,
    attachment: AgentAttachment,
    text: string,
  ): Promise<void>;
  dashboardMessage(
    socket: WebSocket,
    attachment: AgentAttachment,
    text: string,
  ): Promise<void>;
  ready(metadata: RoomMetadataLike, attachment: AgentAttachment): Record<string, unknown>;
  disconnected(socket: WebSocket): Promise<void>;
};

function asInternals(room: CoreServerRoom): RoomInternals {
  return room as unknown as RoomInternals;
}

function hostSession(room: RoomInternals): AgentAttachment | null {
  const socket = room.agents("HOST")[0];
  return socket ? (socket.deserializeAttachment() as AgentAttachment) : null;
}

function hostConsoleAuthoritative(room: RoomInternals, metadata: RoomMetadataLike): boolean {
  const host = hostSession(room);
  return Boolean(
    host?.authenticated &&
      host.consoleHealthy === true &&
      metadata.hostIdentity?.capabilities["console.view.full"] === true,
  );
}

function hostConsoleState(room: RoomInternals): string {
  const host = hostSession(room);
  if (!host?.authenticated) return "HOST_OFFLINE";
  return host.consoleSourceState ?? "STARTING";
}

async function announceConsoleAuthority(
  room: RoomInternals,
  metadata: RoomMetadataLike,
): Promise<void> {
  await room.sendToAgent("PAPER", "console.authority", {
    hostAuthoritative: hostConsoleAuthoritative(room, metadata),
    source: "HOST_JOURNAL",
    state: hostConsoleState(room),
  });
}

function boundedText(value: unknown, maximum: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= maximum
    ? value
    : null;
}

function validateConsoleBatch(body: Record<string, unknown>): void {
  if (!Array.isArray(body.lines) || body.lines.length < 1 || body.lines.length > 100)
    throw new Error("Event not allowed for host console batch");
  for (const candidate of body.lines) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
      throw new Error("Event not allowed for malformed host console line");
    const line = candidate as Record<string, unknown>;
    const content = boundedText(line.content, 65_536);
    const level = boundedText(line.level, 16);
    const capturedAt = boundedText(line.capturedAt, 64);
    if (!content || !capturedAt || !level || !["DEBUG", "INFO", "WARN", "ERROR", "SEVERE"].includes(level))
      throw new Error("Event not allowed for malformed host console line");
    if (line.source !== undefined && line.source !== "HOST_JOURNAL")
      throw new Error("Event not allowed for invalid host console source");
    for (const key of ["journalCursor", "invocationId", "service", "pid", "streamSession"])
      if (line[key] !== undefined && line[key] !== null && !boundedText(line[key], 4096))
        throw new Error("Event not allowed for oversized host console metadata");
    if (
      line.sourceSequence !== undefined &&
      (!Number.isSafeInteger(line.sourceSequence) || Number(line.sourceSequence) < 0)
    )
      throw new Error("Event not allowed for invalid host console sequence");
  }
}

async function processHostConsole(
  roomObject: CoreServerRoom,
  socket: WebSocket,
  attachment: AgentAttachment,
  text: string,
): Promise<void> {
  const room = asInternals(roomObject);
  const { envelope, body } = decodeEnvelope(text);
  assertFreshEnvelope(envelope);
  if (envelope.serverId !== attachment.serverId) throw new Error("Wrong room");
  if (!attachment.authenticated || attachment.kind !== "HOST")
    throw new Error("Agent authentication required");
  if (
    !attachment.publicKey ||
    !(await verifyEnvelope(envelope, await importAgentPublicKey(attachment.publicKey)))
  )
    throw new Error("Invalid signature");
  if (
    body._session !== attachment.sessionNonce ||
    !Number.isSafeInteger(body._sequence) ||
    Number(body._sequence) <= (attachment.sequence ?? 0) ||
    attachment.recent?.includes(envelope.messageId)
  )
    throw new Error("Session replay rejected");
  attachment.sequence = Number(body._sequence);
  attachment.recent = [...(attachment.recent ?? []), envelope.messageId].slice(-32);
  delete body._session;
  delete body._sequence;
  socket.serializeAttachment(attachment);

  const metadata = await room.metadata();
  if (attachment.publicKey !== metadata.identity?.hostPublicKey)
    throw new Error("Host authorization changed");

  if (envelope.type === "console.source") {
    const state = boundedText(body.state, 64);
    if (body.source !== "HOST_JOURNAL" || typeof body.available !== "boolean" || !state)
      throw new Error("Event not allowed for invalid console source state");
    if (body.service !== undefined && !boundedText(body.service, 128))
      throw new Error("Event not allowed for invalid console service");
    attachment.consoleHealthy = body.available === true;
    attachment.consoleSourceState = state;
    socket.serializeAttachment(attachment);
    await room.broadcastReady(metadata);
    await announceConsoleAuthority(room, metadata);
    return;
  }

  validateConsoleBatch(body);
  if (attachment.consoleHealthy !== true)
    throw new Error("Event not allowed while host console source is unavailable");
  const hostCanView =
    metadata.hostIdentity?.capabilities["console.view.full"] === true ||
    metadata.hostIdentity?.capabilities["console.view.errors"] === true;
  if (!hostCanView) throw new Error("Event not allowed while host console capability is disabled");

  // When Host local policy does not allow full-console authority, Paper remains the live producer
  // while online. Host still serves its allowed output while Paper is offline.
  if (room.agents("PAPER").length > 0 && !hostConsoleAuthoritative(room, metadata)) return;

  for (const peer of room.state.getWebSockets("dashboard")) {
    const dashboard = peer.deserializeAttachment() as AgentAttachment;
    if (!currentAccess(metadata, dashboard.access)) continue;
    const filtered = filterEvent(
      "console.lines",
      body,
      dashboard.access?.scopes ?? [],
      metadata.hostIdentity?.capabilities ?? {},
    );
    if (!filtered) continue;
    room.safeDashboardSend(
      peer,
      {
        type: "server.event",
        serverId: attachment.serverId,
        agentKind: "HOST",
        agentSession: attachment.sessionNonce,
        agentSequence: attachment.sequence,
        eventType: "console.lines",
        body: filtered,
        receivedAt: new Date().toISOString(),
      },
      dashboard,
    );
  }
}

const corePrototype = CoreServerRoom.prototype as unknown as CorePrototype;
const coreAgentMessage = corePrototype.agentMessage;
const coreDashboardMessage = corePrototype.dashboardMessage;
const coreReady = corePrototype.ready;
const coreDisconnected = corePrototype.disconnected;

export class ServerRoom extends CoreServerRoom {}

const adapterPrototype = ServerRoom.prototype as unknown as CorePrototype;
adapterPrototype.agentMessage = async function (
  this: CoreServerRoom,
  socket,
  attachment,
  text,
): Promise<void> {
  let type = "";
  try {
    type = decodeEnvelope(text).envelope.type;
  } catch {
    return coreAgentMessage.call(this, socket, attachment, text);
  }
  if (
    attachment.kind === "HOST" &&
    attachment.authenticated &&
    (type === "console.source" || type === "console.lines")
  ) {
    await processHostConsole(this, socket, attachment, text);
    return;
  }
  await coreAgentMessage.call(this, socket, attachment, text);
  if (type === "agent.challenge_response" && attachment.kind === "PAPER" && attachment.authenticated) {
    const room = asInternals(this);
    await announceConsoleAuthority(room, await room.metadata());
  }
};

adapterPrototype.dashboardMessage = async function (
  this: CoreServerRoom,
  socket,
  attachment,
  text,
): Promise<void> {
  if (text.length <= 65_536) {
    try {
      const message = JSON.parse(text) as Record<string, unknown>;
      if (
        message.type === "dashboard.action" &&
        message.action === "console.execute" &&
        message.agentKind === "HOST"
      ) {
        socket.send(
          JSON.stringify({
            type: "dashboard.action_rejected",
            requestId: message.requestId,
            code: "INVALID_PARAMETERS",
            error: "Console commands are available only through the Paper agent.",
          }),
        );
        return;
      }
    } catch {
      // The core parser owns normal malformed-request handling.
    }
  }
  await coreDashboardMessage.call(this, socket, attachment, text);
};

adapterPrototype.ready = function (
  this: CoreServerRoom,
  metadata,
  attachment,
): Record<string, unknown> {
  const room = asInternals(this);
  return {
    ...coreReady.call(this, metadata, attachment),
    version: "3.4.0",
    consoleAuthority: hostConsoleAuthoritative(room, metadata) ? "HOST" : "PAPER_FALLBACK",
    consoleSourceState: hostConsoleState(room),
  };
};

adapterPrototype.disconnected = async function (
  this: CoreServerRoom,
  socket,
): Promise<void> {
  const attachment = socket.deserializeAttachment() as AgentAttachment;
  await coreDisconnected.call(this, socket);
  if (attachment.kind === "HOST") {
    const room = asInternals(this);
    await announceConsoleAuthority(room, await room.metadata());
  }
};

const worker = {
  async fetch(
    request: Request,
    env: Parameters<typeof coreWorker.fetch>[1],
  ): Promise<Response> {
    const response = await coreWorker.fetch(request, env);
    const url = new URL(request.url);
    if (request.method !== "GET" || url.pathname !== "/healthz" || !response.ok) return response;
    const payload = (await response.json()) as Record<string, unknown>;
    return new Response(JSON.stringify({ ...payload, version: "3.4.0" }), {
      status: response.status,
      headers: response.headers,
    });
  },
};

export default worker;

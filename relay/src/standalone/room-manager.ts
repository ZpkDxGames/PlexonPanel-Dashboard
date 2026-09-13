import {
  Room as CoreRoom,
  RoomManager,
  type AgentKind,
  type RelayCounters,
} from "./room-manager-core.js";
import {
  assertFreshEnvelope,
  decodeEnvelope,
  importAgentPublicKey,
  verifyEnvelope,
} from "../protocol.js";
import { currentAccess, filterEvent } from "../index.js";
import type { DashboardAccess } from "../security.js";
import type { StoredRoom } from "./persistence.js";
import type { NodeWebSocket } from "./websocket.js";

export { RoomManager, type AgentKind, type RelayCounters };

type StoredIdentity = {
  hostPublicKey?: string;
  capabilities: Record<string, boolean>;
};
type MetadataLike = StoredRoom & {
  identity?: StoredIdentity;
  hostIdentity?: StoredIdentity;
};
type AgentSessionLike = {
  socket: NodeWebSocket;
  kind: AgentKind;
  serverId: string;
  authenticated: boolean;
  publicKey: string;
  sessionNonce: string;
  sequence: number;
  recent: string[];
  consoleHealthy?: boolean;
  consoleSourceState?: string;
};
type DashboardSessionLike = {
  socket: NodeWebSocket;
  access: DashboardAccess;
};
type RoomInternals = {
  serverId: string;
  metadata: MetadataLike;
  paper: AgentSessionLike | null;
  host: AgentSessionLike | null;
  dashboards: Map<string, DashboardSessionLike>;
  counters: RelayCounters;
  currentAccess(access: DashboardAccess): boolean;
  broadcastReady(): void;
  sendToAgent(kind: AgentKind, type: string, body: Record<string, unknown>): Promise<boolean>;
  dashboardSend(session: DashboardSessionLike, body: Record<string, unknown>): void;
};
type RoomPrototype = {
  agentMessage(session: AgentSessionLike, text: string): Promise<void>;
  dashboardMessage(session: DashboardSessionLike, text: string): Promise<void>;
  ready(session: DashboardSessionLike): Record<string, unknown>;
  agentDisconnected(session: AgentSessionLike, code: number, reason: string): void;
};

function internals(room: CoreRoom): RoomInternals {
  return room as unknown as RoomInternals;
}

function authoritative(room: RoomInternals): boolean {
  return Boolean(
    room.host?.authenticated &&
      room.host.consoleHealthy === true &&
      room.metadata.hostIdentity?.capabilities["console.view.full"] === true,
  );
}

function sourceState(room: RoomInternals): string {
  if (!room.host?.authenticated) return "HOST_OFFLINE";
  return room.host.consoleSourceState ?? "STARTING";
}

async function announceAuthority(room: RoomInternals): Promise<void> {
  await room.sendToAgent("PAPER", "console.authority", {
    hostAuthoritative: authoritative(room),
    source: "HOST_JOURNAL",
    state: sourceState(room),
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
  roomObject: CoreRoom,
  session: AgentSessionLike,
  text: string,
): Promise<void> {
  const room = internals(roomObject);
  const { envelope, body } = decodeEnvelope(text);
  assertFreshEnvelope(envelope);
  if (envelope.serverId !== room.serverId) throw new Error("Wrong room");
  if (!session.authenticated || session.kind !== "HOST")
    throw new Error("Agent authentication required");
  if (
    !session.publicKey ||
    !(await verifyEnvelope(envelope, await importAgentPublicKey(session.publicKey)))
  )
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

  if (session.publicKey !== room.metadata.identity?.hostPublicKey)
    throw new Error("Host authorization changed");

  if (envelope.type === "console.source") {
    const state = boundedText(body.state, 64);
    if (body.source !== "HOST_JOURNAL" || typeof body.available !== "boolean" || !state)
      throw new Error("Event not allowed for invalid console source state");
    if (body.service !== undefined && !boundedText(body.service, 128))
      throw new Error("Event not allowed for invalid console service");
    session.consoleHealthy = body.available === true;
    session.consoleSourceState = state;
    room.broadcastReady();
    await announceAuthority(room);
    room.counters.messagesAccepted += 1;
    return;
  }

  validateConsoleBatch(body);
  if (session.consoleHealthy !== true)
    throw new Error("Event not allowed while host console source is unavailable");
  const hostCanView =
    room.metadata.hostIdentity?.capabilities["console.view.full"] === true ||
    room.metadata.hostIdentity?.capabilities["console.view.errors"] === true;
  if (!hostCanView) throw new Error("Event not allowed while host console capability is disabled");
  if (room.paper?.authenticated && !authoritative(room)) {
    room.counters.messagesAccepted += 1;
    return;
  }

  for (const dashboard of room.dashboards.values()) {
    if (!room.currentAccess(dashboard.access)) continue;
    const filtered = filterEvent(
      "console.lines",
      body,
      dashboard.access.scopes,
      room.metadata.hostIdentity?.capabilities ?? {},
    );
    if (!filtered) continue;
    room.dashboardSend(dashboard, {
      type: "server.event",
      serverId: room.serverId,
      agentKind: "HOST",
      agentSession: session.sessionNonce,
      agentSequence: session.sequence,
      eventType: "console.lines",
      body: filtered,
      receivedAt: new Date().toISOString(),
    });
  }
  room.counters.messagesAccepted += 1;
}

const prototype = CoreRoom.prototype as unknown as RoomPrototype;
const coreAgentMessage = prototype.agentMessage;
const coreDashboardMessage = prototype.dashboardMessage;
const coreReady = prototype.ready;
const coreAgentDisconnected = prototype.agentDisconnected;

prototype.agentMessage = async function (
  this: CoreRoom,
  session,
  text,
): Promise<void> {
  let type = "";
  try {
    type = decodeEnvelope(text).envelope.type;
  } catch {
    return coreAgentMessage.call(this, session, text);
  }
  if (
    session.kind === "HOST" &&
    session.authenticated &&
    (type === "console.source" || type === "console.lines")
  ) {
    await processHostConsole(this, session, text);
    return;
  }
  await coreAgentMessage.call(this, session, text);
  if (type === "agent.challenge_response" && session.kind === "PAPER" && session.authenticated)
    await announceAuthority(internals(this));
};

prototype.dashboardMessage = async function (
  this: CoreRoom,
  session,
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
        internals(this).dashboardSend(session, {
          type: "dashboard.action_rejected",
          requestId: message.requestId,
          code: "INVALID_PARAMETERS",
          error: "Console commands are available only through the Paper agent.",
        });
        return;
      }
    } catch {
      // The core parser owns normal malformed-request handling.
    }
  }
  await coreDashboardMessage.call(this, session, text);
};

prototype.ready = function (
  this: CoreRoom,
  session,
): Record<string, unknown> {
  const room = internals(this);
  return {
    ...coreReady.call(this, session),
    version: "3.4.0",
    consoleAuthority: authoritative(room) ? "HOST" : "PAPER_FALLBACK",
    consoleSourceState: sourceState(room),
  };
};

prototype.agentDisconnected = function (
  this: CoreRoom,
  session,
  code,
  reason,
): void {
  const wasHost = session.kind === "HOST" && session.authenticated;
  coreAgentDisconnected.call(this, session, code, reason);
  if (wasHost) void announceAuthority(internals(this));
};

export { CoreRoom as Room };

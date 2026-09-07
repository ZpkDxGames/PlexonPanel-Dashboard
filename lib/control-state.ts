import type { Scope } from "./scopes";
export type JsonMap = Record<string, unknown>;
export interface Device {
  deviceId: string;
  name: string;
  role: string;
  scopes: Scope[];
  issuedAt: number;
  expiresAt: number;
  lastSeen: number;
}
export interface Ready {
  serverId: string;
  protocolVersion: number;
  version: string;
  device: Device;
  agents: { paper: boolean; host: boolean; hostInstalled: boolean };
  server: {
    fingerprint: string;
    pluginVersion: string;
    hostVersion: string | null;
    minecraftVersion: string;
    capabilities: Record<string, boolean>;
    paperCapabilities: Record<string, boolean>;
    hostCapabilities: Record<string, boolean>;
    paperSession?: string;
  };
}
export interface Sample {
  at: number;
  tps: number | null;
  mspt: number | null;
  hostCpu: number | null;
  processCpu: number | null;
  heap: number | null;
  memory: number | null;
  players: number | null;
  gc: number | null;
}
export interface ControlState {
  serverId: string;
  ready: Ready | null;
  server: JsonMap;
  system: JsonMap;
  hostSystem: JsonMap;
  service: JsonMap;
  worlds: JsonMap[];
  inventoryIds?: { players?: string; plugins?: string };
  pendingPlayerSnapshot?: {
    snapshotId: string;
    capturedAt: string;
    agentSession?: string;
    players: JsonMap[];
  };
  presenceDeltas: JsonMap[];
  presenceEventIds: string[];
  players: JsonMap[];
  plugins: JsonMap[];
  console: JsonMap[];
  chat: JsonMap[];
  history: Sample[];
  backupProgress: JsonMap | null;
  updatedAt: number;
  telemetryUpdatedAt: number;
  cached: boolean;
}

export const CONTROL_HISTORY_RETENTION_MS = 35 * 60_000;
export const CONTROL_HISTORY_MAX_POINTS = 8192;

export function emptyControlState(serverId: string): ControlState {
  return {
    serverId,
    ready: null,
    server: {},
    system: {},
    hostSystem: {},
    service: {},
    worlds: [],
    presenceDeltas: [],
    presenceEventIds: [],
    players: [],
    plugins: [],
    console: [],
    chat: [],
    history: [],
    backupProgress: null,
    updatedAt: 0,
    telemetryUpdatedAt: 0,
    cached: false,
  };
}
export function record(value: unknown): JsonMap {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonMap)
    : {};
}
export function records(value: unknown, limit = 512): JsonMap[] {
  return Array.isArray(value)
    ? (value
        .slice(0, limit)
        .filter(
          (v) => v !== null && typeof v === "object" && !Array.isArray(v),
        ) as JsonMap[])
    : [];
}
export function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}
export function str(value: unknown, fallback = "—"): string {
  return typeof value === "string" ? value : fallback;
}
export function capturedAtMillis(value: unknown): number | null {
  if (typeof value !== "string" || !value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function applyControlMessage(
  state: ControlState,
  message: JsonMap,
): ControlState {
  if (message.serverId !== state.serverId) return state;
  if (message.type === "dashboard.ready") {
    if (message.protocolVersion !== 3 || !record(message.device).deviceId)
      return state;
    const ready = message as unknown as Ready,
      previousSession = state.ready?.server.paperSession,
      nextSession = ready.server.paperSession,
      samePaperSession =
        typeof nextSession === "string"
          ? previousSession === nextSession
          : previousSession === undefined && Boolean(state.ready?.agents.paper),
      preserveRoster =
        ready.agents.paper &&
        Boolean(state.ready) &&
        samePaperSession &&
        !state.cached;
    return {
      ...state,
      ready,
      players: preserveRoster ? state.players : [],
      inventoryIds: preserveRoster
        ? state.inventoryIds
        : { ...state.inventoryIds, players: undefined },
      pendingPlayerSnapshot: undefined,
      presenceDeltas: preserveRoster ? (state.presenceDeltas ?? []) : [],
      presenceEventIds: preserveRoster ? (state.presenceEventIds ?? []) : [],
      cached: false,
    };
  }
  if (message.type !== "server.event") return state;
  const body = record(message.body),
    kind = message.agentKind === "HOST" ? "HOST" : "PAPER";
  const agentSession =
    typeof message.agentSession === "string" ? message.agentSession : undefined;
  if (
    kind === "PAPER" &&
    state.ready?.server.paperSession &&
    agentSession !== state.ready.server.paperSession
  )
    return state;
  const receivedAt = Date.now();
  let next = { ...state, updatedAt: receivedAt, cached: false };
  switch (message.eventType) {
    case "telemetry.server":
      next.server = body;
      break;
    case "telemetry.system":
      if (kind === "HOST") next.hostSystem = body;
      else next.system = body;
      break;
    case "telemetry.worlds":
      next.worlds = records(body.worlds, 64);
      break;
    case "inventory.players": {
      const offset = number(body.offset) ?? 0;
      if (!Number.isSafeInteger(offset) || typeof body.snapshotId !== "string")
        return state;
      let pending =
        offset === 0
          ? {
              snapshotId: body.snapshotId,
              capturedAt: str(body.capturedAt, ""),
              agentSession,
              players: [] as JsonMap[],
            }
          : state.pendingPlayerSnapshot;
      if (
        !pending ||
        pending.snapshotId !== body.snapshotId ||
        pending.players.length !== offset ||
        pending.agentSession !== agentSession
      )
        return state;
      pending = {
        ...pending,
        players: [...pending.players, ...records(body.players, 100)].slice(0, 512),
      };
      if (body.complete !== true) {
        next.pendingPlayerSnapshot = pending;
        break;
      }
      const deltas = (state.presenceDeltas ?? []).filter((delta) =>
        instantAfter(str(delta.observedAt, ""), pending.capturedAt),
      );
      next.players = deltas.reduce(
        (players, delta) => applyPresence(players, delta),
        pending.players,
      );
      next.pendingPlayerSnapshot = undefined;
      next.presenceDeltas = deltas.slice(-512);
      next.inventoryIds = {
        ...state.inventoryIds,
        players: body.snapshotId,
      };
      break;
    }
    case "inventory.plugins": {
      const offset = number(body.offset) ?? 0;
      if (
        !Number.isSafeInteger(offset) ||
        (offset &&
          (state.inventoryIds?.plugins !== body.snapshotId ||
            state.plugins.length !== offset))
      )
        return state;
      next.plugins = [
        ...(offset ? state.plugins : []),
        ...records(body.plugins, 100),
      ].slice(0, 256);
      next.inventoryIds = {
        ...state.inventoryIds,
        plugins: str(body.snapshotId),
      };
      break;
    }
    case "players.presence": {
      if (
        typeof body.eventId !== "string" ||
        typeof body.sessionId !== "string" ||
        typeof body.uuid !== "string" ||
        typeof body.name !== "string" ||
        (body.state !== "JOINED" && body.state !== "LEFT") ||
        (state.presenceEventIds ?? []).includes(body.eventId)
      )
        return state;
      const delta = {
        ...body,
        ...(agentSession ? { _agentSession: agentSession } : {}),
      };
      next.players = applyPresence(state.players, delta);
      next.presenceDeltas = [...(state.presenceDeltas ?? []), delta].slice(-512);
      next.presenceEventIds = [
        ...(state.presenceEventIds ?? []),
        body.eventId,
      ].slice(-1024);
      break;
    }
    case "console.lines":
      next.console = [...state.console, ...records(body.lines, 100)].slice(
        -600,
      );
      break;
    case "chat.message":
      next.chat = [...state.chat, body].slice(-200);
      break;
    case "service.status":
      next.service = body;
      break;
    case "backup.progress":
      next.backupProgress = body;
      break;
    default:
      return state;
  }
  if (
    message.eventType === "telemetry.server" ||
    message.eventType === "telemetry.system"
  ) {
    const at = capturedAtMillis(body.capturedAt) ?? receivedAt,
      host = next.ready?.agents.host ? next.hostSystem : {},
      paper = next.ready?.agents.paper ? next.system : {},
      server = next.ready?.agents.paper ? next.server : {},
      tps = Array.isArray(server.tps) ? number(server.tps[0]) : null;
    const sample: Sample = {
      at,
      tps,
      mspt: number(server.averageTickMillis),
      hostCpu: number(host.hostCpuPercent),
      processCpu: number(paper.processCpuPercent),
      heap: number(paper.jvmHeapUsedBytes),
      memory: number(host.physicalMemoryUsedBytes),
      players: number(server.onlinePlayers),
      gc: number(paper.gcPauseTotalMillis),
    };
    next = {
      ...next,
      telemetryUpdatedAt: receivedAt,
      history: appendHistory(next.history, sample),
    };
  }
  return next;
}
export function safeCache(state: ControlState): ControlState {
  // Player addresses/locations, files, action parameters and action outputs never enter this cache.
  return {
    ...emptyControlState(state.serverId),
    ...state,
    players: [],
    pendingPlayerSnapshot: undefined,
    presenceDeltas: [],
    presenceEventIds: [],
    service: {},
    backupProgress: null,
    console: records(state.console, 600).slice(-200),
    chat: records(state.chat, 200).slice(-100),
    history: Array.isArray(state.history)
      ? state.history.slice(-CONTROL_HISTORY_MAX_POINTS)
      : [],
    cached: true,
  };
}
export function diagnostics(state: ControlState): string {
  const host = state.ready?.agents.host ? state.hostSystem : {},
    paper = state.ready?.agents.paper ? state.system : {},
    hostCpu = number(host.hostCpuPercent),
    paperCpu = number(paper.processCpuPercent);
  return [
    `PlexonPanel Dashboard 3.0.1 / Protocol 3`,
    `Paper agent: ${state.ready?.server.pluginVersion ?? "unknown"}`,
    `Host agent: ${state.ready?.server.hostVersion ?? "not installed"}`,
    `Paper connected: ${Boolean(state.ready?.agents.paper)}`,
    `Host connected: ${Boolean(state.ready?.agents.host)}`,
    `Java: ${str(paper.javaVersion)}`,
    `OS / architecture: ${str(host.operatingSystem, str(paper.operatingSystem))} / ${str(host.architecture, str(paper.architecture))}`,
    `TPS: ${Array.isArray(state.server.tps) ? state.server.tps.join(" / ") : "unavailable"}`,
    `MSPT: ${number(state.server.averageTickMillis) ?? "unavailable"}`,
    `Host CPU: ${hostCpu === null ? "unavailable" : `${hostCpu}%`}`,
    `Paper process CPU: ${paperCpu === null ? "unavailable" : `${paperCpu}%`}`,
    `JVM heap bytes: ${number(paper.jvmHeapUsedBytes) ?? "unavailable"}`,
  ].join("\n");
}

function appendHistory(history: Sample[], sample: Sample): Sample[] {
  const latestAt = Math.max(sample.at, history.at(-1)?.at ?? sample.at);
  const cutoff = latestAt - CONTROL_HISTORY_RETENTION_MS;
  const retained = history.filter((point) => point.at >= cutoff);
  const sameAt = retained.findIndex((point) => point.at === sample.at);
  if (sameAt >= 0) retained[sameAt] = sample;
  else retained.push(sample);
  retained.sort((a, b) => a.at - b.at);
  return retained.slice(-CONTROL_HISTORY_MAX_POINTS);
}

function applyPresence(players: JsonMap[], delta: JsonMap): JsonMap[] {
  const uuid = str(delta.uuid, ""),
    sessionId = str(delta.sessionId, "");
  if (!uuid || !sessionId) return players;
  const index = players.findIndex((player) => player.uuid === uuid);
  if (delta.state === "LEFT") {
    if (index < 0) return players;
    const currentSession = players[index].sessionId;
    if (typeof currentSession === "string" && currentSession !== sessionId)
      return players;
    return players.filter((_, playerIndex) => playerIndex !== index);
  }
  const row: JsonMap = {
    ...(index >= 0 ? players[index] : {}),
    uuid,
    name: delta.name,
    sessionId,
    ...(typeof delta.sessionStartedAt === "string"
      ? { sessionStartedAt: delta.sessionStartedAt }
      : {}),
    presenceObservedAt: delta.observedAt,
  };
  const next = index >= 0 ? players.filter((_, i) => i !== index) : players;
  return [...next, row]
    .slice(0, 512)
    .sort((a, b) => str(a.name, "").localeCompare(str(b.name, "")));
}

function instantAfter(value: string, boundary: string): boolean {
  const instant = instantParts(value),
    other = instantParts(boundary);
  if (!instant || !other) return false;
  return (
    instant.seconds > other.seconds ||
    (instant.seconds === other.seconds && instant.fraction > other.fraction)
  );
}

function instantParts(
  value: string,
): { seconds: number; fraction: number } | null {
  const match =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/.exec(
      value,
    );
  if (!match) return null;
  const seconds = Date.parse(`${match[1]}Z`);
  if (!Number.isFinite(seconds)) return null;
  return {
    seconds,
    fraction: Number((match[2] ?? "").padEnd(9, "0")),
  };
}

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
  players: JsonMap[];
  plugins: JsonMap[];
  console: JsonMap[];
  chat: JsonMap[];
  history: Sample[];
  backupProgress: JsonMap | null;
  updatedAt: number;
  cached: boolean;
}
export function emptyControlState(serverId: string): ControlState {
  return {
    serverId,
    ready: null,
    server: {},
    system: {},
    hostSystem: {},
    service: {},
    worlds: [],
    players: [],
    plugins: [],
    console: [],
    chat: [],
    history: [],
    backupProgress: null,
    updatedAt: 0,
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
export function applyControlMessage(
  state: ControlState,
  message: JsonMap,
): ControlState {
  if (message.serverId !== state.serverId) return state;
  if (message.type === "dashboard.ready") {
    if (message.protocolVersion !== 3 || !record(message.device).deviceId)
      return state;
    return { ...state, ready: message as unknown as Ready, cached: false };
  }
  if (message.type !== "server.event") return state;
  const body = record(message.body),
    kind = message.agentKind === "HOST" ? "HOST" : "PAPER";
  let next = { ...state, updatedAt: Date.now(), cached: false };
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
    case "inventory.players":
    case "inventory.plugins": {
      const field =
        message.eventType === "inventory.players" ? "players" : "plugins";
      const offset = number(body.offset) ?? 0;
      if (
        offset &&
        (state.inventoryIds?.[field] !== body.snapshotId ||
          state[field].length !== offset)
      )
        return state;
      next[field] = [
        ...(offset ? state[field] : []),
        ...records(body[field], 100),
      ].slice(0, field === "players" ? 512 : 256);
      next.inventoryIds = {
        ...state.inventoryIds,
        [field]: str(body.snapshotId),
      };
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
  if (String(message.eventType).startsWith("telemetry.")) {
    const at = Math.floor(Date.now() / 5000) * 5000,
      host = next.ready?.agents.host ? next.hostSystem : next.system,
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
      history: [
        ...next.history.filter(
          (p) => p.at !== at && p.at >= Date.now() - 1800000,
        ),
        sample,
      ].slice(-361),
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
    service: {},
    backupProgress: null,
    console: records(state.console, 600).slice(-200),
    chat: records(state.chat, 200).slice(-100),
    history: Array.isArray(state.history) ? state.history.slice(-361) : [],
    cached: true,
  };
}
export function diagnostics(state: ControlState): string {
  const host = state.ready?.agents.host ? state.hostSystem : state.system;
  return [
    `PlexonPanel Dashboard 2.1.0 / Protocol 3`,
    `Paper agent: ${state.ready?.server.pluginVersion ?? "unknown"}`,
    `Host agent: ${state.ready?.server.hostVersion ?? "not installed"}`,
    `Paper connected: ${Boolean(state.ready?.agents.paper)}`,
    `Host connected: ${Boolean(state.ready?.agents.host)}`,
    `Java: ${str(state.system.javaVersion)}`,
    `OS / architecture: ${str(host.operatingSystem)} / ${str(host.architecture)}`,
    `TPS: ${Array.isArray(state.server.tps) ? state.server.tps.join(" / ") : "unavailable"}`,
    `MSPT: ${number(state.server.averageTickMillis) ?? "unavailable"}`,
    `Host CPU: ${number(host.hostCpuPercent) ?? "unavailable"}%`,
    `JVM heap bytes: ${number(state.system.jvmHeapUsedBytes) ?? "unavailable"}`,
  ].join("\n");
}

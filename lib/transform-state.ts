import { selectCpuLoad } from "./cpu-load.js";
import type { DashboardWorkspace, ResourceMetric, TimelinePoint } from "./dashboard-types";
import type {
  AgentCapabilities,
  AuditRecord,
  ConsoleEntry,
  PlayerRecord,
  PluginRecord,
} from "./management-data";

const colors = ["violet", "cyan", "green", "amber", "rose"];

export function transformRelayState(relay: Record<string, unknown>): DashboardWorkspace {
  const serverDocument = record(relay.server);
  const persisted = record(relay.state);
  const live = record(relay.liveState);
  const server = record(live.server ?? persisted.server);
  const system = record(live.system ?? persisted.system);
  const playersEnvelope = record(live.players ?? persisted.players);
  const pluginsEnvelope = record(live.plugins ?? persisted.plugins);
  const errorsEnvelope = record(live.errors ?? persisted.errors);
  const connectionStatus = relay.connectionStatus === "online" ? "online" : "offline";
  const players = array(playersEnvelope.players).map(playerRecord).filter(notNull);
  const plugins = array(pluginsEnvelope.plugins).map(pluginRecord).filter(notNull);
  const consoleEntries = array(errorsEnvelope.lines).map(consoleRecord).filter(notNull);
  const maximumPlayers = positiveInteger(server.maximumPlayers);
  const tps = numberArray(server.tps);
  const currentTps = tps[0] ?? 0;
  const tickMillis = finiteNumber(server.averageTickMillis);
  const onlinePlayers = positiveInteger(server.onlinePlayers);
  const uptime = positiveNumber(system.processUptimeMillis);
  const capabilities = capabilityRecord(serverDocument.capabilities);
  const audit = array(relay.audit).map(auditRecord).filter(notNull);

  return {
    overview: {
      server: {
        id: text(serverDocument.serverId, "unknown-server"),
        name: text(server.serverName, "Paired Paper server"),
        address: "Private outbound connection",
        status: connectionStatus,
        platform: "Paper",
        version: text(server.minecraftVersion, text(serverDocument.minecraftVersion, "Unknown")),
        lastSeen: relativeTime(serverDocument.lastSeenAt),
      },
      stats: [
        {
          label: "TPS",
          value: currentTps > 0 ? currentTps.toFixed(2) : "—",
          detail: currentTps >= 19 ? "Healthy and stable" : currentTps > 0 ? "Performance needs attention" : "Waiting for telemetry",
          tone: currentTps >= 19 ? "positive" : currentTps > 0 ? "warning" : "neutral",
        },
        {
          label: "MSPT",
          value: tickMillis > 0 ? tickMillis.toFixed(1) : "—",
          detail: tickMillis > 0 && tickMillis < 45 ? "Within a healthy range" : tickMillis > 0 ? "Tick time is elevated" : "Waiting for telemetry",
          tone: tickMillis > 0 && tickMillis < 45 ? "positive" : tickMillis > 0 ? "warning" : "neutral",
        },
        {
          label: "Players",
          value: maximumPlayers > 0 ? `${onlinePlayers} / ${maximumPlayers}` : String(onlinePlayers),
          detail: connectionStatus === "online" ? `${players.length} player records received` : "Last known player count",
          tone: "neutral",
        },
        {
          label: "Uptime",
          value: uptime > 0 ? formatDuration(uptime) : "—",
          detail: connectionStatus === "online" ? "Current Paper process" : "Last reported process uptime",
          tone: "neutral",
        },
      ],
      resources: resources(system),
      tpsHistory: tpsHistory(tps),
      activity: activity(players, plugins, consoleEntries),
    },
    management: {
      players,
      maximumPlayers,
      consoleEntries,
      chatMessages: [],
      plugins,
      audit,
      identity: {
        serverId: text(serverDocument.serverId, "Unknown"),
        fingerprint: text(serverDocument.fingerprint, "Unavailable"),
        pluginVersion: text(serverDocument.pluginVersion, "Unknown"),
        connectionStatus,
        paired: serverDocument.paired === true,
      },
      capabilities,
    },
  };
}

export function applyRelayEvent(
  current: DashboardWorkspace,
  eventType: string,
  body: Record<string, unknown>,
): DashboardWorkspace {
  if (eventType === "chat.message") {
    const message = chatRecord(body);
    if (!message) return current;
    return {
      ...current,
      management: {
        ...current.management,
        chatMessages: [...current.management.chatMessages.filter((item) => item.id !== message.id), message].slice(-200),
      },
    };
  }
  if (eventType === "action.result") {
    const requestId = text(body.requestId, `action-${Date.now()}`);
    const result: AuditRecord = {
      id: requestId,
      actor: "Paper agent",
      action: text(body.action, "Remote action"),
      target: text(body.message, text(body.code, "Server")),
      time: relativeTime(body.completedAt),
      result: body.success === true ? "success" : "blocked",
    };
    return {
      ...current,
      management: {
        ...current.management,
        audit: [result, ...current.management.audit.filter((item) => item.id !== requestId)].slice(0, 20),
      },
    };
  }
  const relay: Record<string, unknown> = {
    connectionStatus: current.overview.server.status === "online" ? "online" : "offline",
    server: {
      serverId: current.management.identity.serverId,
      fingerprint: current.management.identity.fingerprint,
      pluginVersion: current.management.identity.pluginVersion,
      paired: current.management.identity.paired,
      capabilities: current.management.capabilities,
    },
    liveState: {},
  };
  const live = relay.liveState as Record<string, unknown>;
  const slot = ({
    "telemetry.server": "server",
    "telemetry.system": "system",
    "inventory.players": "players",
    "inventory.plugins": "plugins",
    "console.lines": "errors",
  } as Record<string, string>)[eventType];
  if (!slot) return current;
  live[slot] = body;
  const next = transformRelayState(relay);
  return mergeWorkspace(current, next, slot);
}

export function applyRelayReady(
  current: DashboardWorkspace | null,
  server: Record<string, unknown>,
  connectionStatus: unknown,
): DashboardWorkspace {
  const next = transformRelayState({ server, connectionStatus });
  if (!current || current.management.identity.serverId !== next.management.identity.serverId) return next;
  return {
    ...current,
    overview: {
      ...current.overview,
      server: {
        ...current.overview.server,
        id: next.overview.server.id,
        status: next.overview.server.status,
        version: next.overview.server.version === "Unknown" ? current.overview.server.version : next.overview.server.version,
        lastSeen: next.overview.server.lastSeen === "Unknown" ? current.overview.server.lastSeen : next.overview.server.lastSeen,
      },
    },
    management: {
      ...current.management,
      identity: next.management.identity,
      capabilities: next.management.capabilities,
    },
  };
}

export function applyConnectionStatus(
  current: DashboardWorkspace,
  status: "online" | "offline",
): DashboardWorkspace {
  return {
    ...current,
    overview: { ...current.overview, server: { ...current.overview.server, status } },
    management: {
      ...current.management,
      identity: { ...current.management.identity, connectionStatus: status },
    },
  };
}

function mergeWorkspace(current: DashboardWorkspace, next: DashboardWorkspace, slot: string): DashboardWorkspace {
  if (slot === "server") {
    const history = [...current.overview.tpsHistory, ...next.overview.tpsHistory.slice(0, 1)].slice(-30);
    const stats = next.overview.stats.map((item, index) => index === 3 ? current.overview.stats[3]! : item);
    return {
      ...current,
      overview: {
        ...current.overview,
        server: { ...current.overview.server, ...next.overview.server },
        stats,
        tpsHistory: history,
      },
      management: { ...current.management, maximumPlayers: next.management.maximumPlayers },
    };
  }
  if (slot === "system") {
    return {
      ...current,
      overview: {
        ...current.overview,
        stats: current.overview.stats.map((item, index) => index === 3 ? next.overview.stats[3]! : item),
        resources: next.overview.resources,
      },
    };
  }
  if (slot === "players") return { ...current, management: { ...current.management, players: next.management.players } };
  if (slot === "plugins") return { ...current, management: { ...current.management, plugins: next.management.plugins } };
  return {
    ...current,
    management: {
      ...current.management,
      consoleEntries: uniqueConsoleEntries([...current.management.consoleEntries, ...next.management.consoleEntries]).slice(-200),
    },
  };
}

function uniqueConsoleEntries(entries: ConsoleEntry[]): ConsoleEntry[] {
  const seen = new Set<string>();
  const result: ConsoleEntry[] = [];
  for (const entry of entries) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    result.push(entry);
  }
  return result;
}

function resources(system: Record<string, unknown>): ResourceMetric[] {
  const cpu = selectCpuLoad(system.systemCpuLoad, system.processCpuLoad);
  const memoryTotal = positiveNumber(system.physicalMemoryTotalBytes) || positiveNumber(system.jvmHeapMaximumBytes);
  const memoryUsed = positiveNumber(system.physicalMemoryUsedBytes) || positiveNumber(system.jvmHeapUsedBytes);
  const diskTotal = positiveNumber(system.diskTotalBytes);
  const diskUsable = positiveNumber(system.diskUsableBytes);
  const diskUsed = Math.max(0, diskTotal - diskUsable);
  const memoryPercent = memoryTotal ? percentage((memoryUsed / memoryTotal) * 100) : 0;
  const diskPercent = diskTotal ? percentage((diskUsed / diskTotal) * 100) : 0;
  return [
    { label: cpu.source === "process" ? "Paper CPU" : "CPU load", value: cpu.percent, displayValue: cpu.available ? `${cpu.percent}%` : "Unavailable", detail: cpu.source === "process" ? `JVM process · ${positiveInteger(system.availableProcessors) || "—"} host cores` : `${positiveInteger(system.availableProcessors) || "—"} cores reported`, tone: "cyan" },
    { label: "Memory", value: memoryPercent, displayValue: memoryTotal ? `${formatBytes(memoryUsed)} / ${formatBytes(memoryTotal)}` : "Unavailable", detail: memoryTotal ? `${formatBytes(Math.max(0, memoryTotal - memoryUsed))} available` : "Host memory not reported", tone: "violet" },
    { label: "Disk", value: diskPercent, displayValue: diskTotal ? `${formatBytes(diskUsed)} / ${formatBytes(diskTotal)}` : "Unavailable", detail: diskTotal ? `${formatBytes(diskUsable)} available` : "Disk usage not reported", tone: "green" },
  ];
}

function tpsHistory(values: number[]): TimelinePoint[] {
  const labels = ["1m", "5m", "15m"];
  return values.slice(0, 3).map((value, index) => ({ label: labels[index] ?? `${index + 1}`, value }));
}

function activity(players: PlayerRecord[], plugins: PluginRecord[], consoleEntries: ConsoleEntry[]) {
  const result = [];
  if (players[0]) result.push({ id: `player-${players[0].id}`, category: "player" as const, title: `${players[0].name} is online`, detail: `${players[0].world} · ${players[0].ping} ms`, time: "Latest snapshot" });
  result.push({ id: "plugins-current", category: "plugin" as const, title: "Plugin inventory synchronized", detail: `${plugins.filter((plugin) => plugin.status === "enabled").length} enabled · ${plugins.filter((plugin) => plugin.status === "disabled").length} disabled`, time: "Latest snapshot" });
  if (consoleEntries[0]) result.push({ id: `error-${consoleEntries[0].id}`, category: "system" as const, title: `${consoleEntries[0].level} captured`, detail: consoleEntries[0].message, time: consoleEntries[0].time });
  result.push({ id: "identity-current", category: "security" as const, title: "Cryptographic server identity verified", detail: "Ed25519 challenge completed by the relay", time: "Current connection" });
  return result.slice(0, 4);
}

function playerRecord(value: unknown, index: number): PlayerRecord | null {
  const player = record(value);
  const id = text(player.uuid, "");
  const name = text(player.name, "");
  if (!id || !name) return null;
  const health = finiteNumber(player.health);
  const maximumHealth = finiteNumber(player.maximumHealth);
  return {
    id,
    name,
    initials: initials(name),
    world: text(player.world, "Unknown world"),
    role: player.op === true ? "Operator" : player.whitelisted === true ? "Whitelisted" : "Player",
    ping: positiveInteger(player.pingMillis),
    health: maximumHealth > 0 ? `${health.toFixed(1)} / ${maximumHealth.toFixed(1)}` : "Unavailable",
    experienceLevel: positiveInteger(player.experienceLevel),
    joined: "Online",
    color: colors[index % colors.length]!,
  };
}

function pluginRecord(value: unknown): PluginRecord | null {
  const plugin = record(value);
  const name = text(plugin.name, "");
  if (!name) return null;
  const authors = array(plugin.authors).filter((item): item is string => typeof item === "string");
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    version: text(plugin.version, "Unknown"),
    author: authors.join(", ") || "Unknown author",
    description: text(plugin.mainClass, "Paper plugin"),
    status: plugin.enabled === false ? "disabled" : "enabled",
  };
}

function consoleRecord(value: unknown, index: number): ConsoleEntry | null {
  const line = record(value);
  const message = text(line.content, "");
  if (!message) return null;
  const capturedAt = text(line.capturedAt, "unknown");
  const fingerprint = text(line.fingerprint, "line");
  return {
    id: `${fingerprint}-${capturedAt}-${index}`,
    time: formatClock(line.capturedAt),
    level: normalizeLevel(line.level),
    source: "Paper",
    message,
  };
}

function chatRecord(value: unknown) {
  const message = record(value);
  const id = text(message.messageId, "");
  const player = text(message.senderName, "");
  const content = text(message.content, "");
  if (!id || !player || !content) return null;
  return {
    id,
    player,
    initials: initials(player),
    channel: "Global" as const,
    message: content,
    time: formatClock(message.capturedAt),
    color: colors[Math.abs(hashText(player)) % colors.length]!,
  };
}

function auditRecord(value: unknown, index: number): AuditRecord {
  const event = record(value);
  return {
    id: text(event.id, `audit-${index}`),
    actor: text(event.actorId, "PlexonPanel"),
    action: text(event.action, text(event.type, "Security event")),
    target: text(event.target, "Server"),
    time: relativeTime(event.createdAt),
    result: event.result === "blocked" || event.success === false ? "blocked" : "success",
  };
}

function capabilityRecord(value: unknown): AgentCapabilities {
  const source = record(value);
  const enabled = (name: keyof AgentCapabilities) => source[name] === true;
  return {
    telemetry: enabled("telemetry"), consoleStream: enabled("consoleStream"), errorCapture: enabled("errorCapture"),
    chatStream: enabled("chatStream"), chatSend: enabled("chatSend"), remoteActions: enabled("remoteActions"),
    consoleExecute: enabled("consoleExecute"), playerMessage: enabled("playerMessage"), playerKick: enabled("playerKick"),
    playerBan: enabled("playerBan"), playerUnban: enabled("playerUnban"), playerWhitelist: enabled("playerWhitelist"),
  };
}

function normalizeLevel(value: unknown): ConsoleEntry["level"] {
  const level = typeof value === "string" ? value.toUpperCase() : "INFO";
  if (level === "SEVERE" || level === "ERROR") return "ERROR";
  if (level === "WARNING" || level === "WARN") return "WARN";
  return "INFO";
}

function record(value: unknown): Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function text(value: unknown, fallback: string): string { return typeof value === "string" && value.trim() ? value : fallback; }
function finiteNumber(value: unknown): number { return typeof value === "number" && Number.isFinite(value) ? value : 0; }
function positiveNumber(value: unknown): number { return Math.max(0, finiteNumber(value)); }
function positiveInteger(value: unknown): number { return Math.max(0, Math.round(finiteNumber(value))); }
function numberArray(value: unknown): number[] { return array(value).filter((item): item is number => typeof item === "number" && Number.isFinite(item)); }
function percentage(value: number): number { return Math.max(0, Math.min(100, Math.round(value))); }
function formatBytes(value: number): string { return value ? `${(value / 1024 ** 3).toFixed(value >= 10 * 1024 ** 3 ? 1 : 2)} GB` : "0 GB"; }

function formatDuration(milliseconds: number): string {
  const totalMinutes = Math.floor(milliseconds / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatClock(value: unknown): string {
  if (typeof value !== "string") return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
}

function relativeTime(value: unknown): string {
  if (typeof value !== "string") return "Unknown";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Unknown";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

function initials(value: string): string { return value.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?"; }
function hashText(value: string): number { return [...value].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) | 0, 0); }
function notNull<T>(value: T | null): value is T { return value !== null; }

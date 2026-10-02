import { capturedAtMillis, number, record, str, type ControlState } from "./control-state";
import { FLEET_CONTRACT_ID, validFleetUuid } from "./fleet-contract";
import type { FleetPhase } from "./fleet-feed";
export const FLEET_STALE_MS = 30_000;
export interface FleetCard {
  serverId: string; name: string; nodeId: string | null;
  status: "online" | "degraded" | "offline" | "stale"; reason: string;
  paper: boolean; host: boolean; players: number | null; tps: number | null; mspt: number | null;
  serviceCpu: number | null; serviceMemory: number | null; serviceState: string; lastUpdate: number | null;
}
export interface NodeSummary {
  nodeId: string; servers: number; sourceServerId: string | null; capturedAt: number | null;
  cpu: number | null; usedMemory: number | null; totalMemory: number | null;
  diskUsed: number | null; diskTotal: number | null;
}
export function fresh(value: unknown, now: number): boolean {
  const at = capturedAtMillis(value);
  return at !== null && at <= now + 5_000 && now - at <= FLEET_STALE_MS;
}
export function boundNode(state: ControlState): string | null {
  const server = state.ready?.server;
  return server?.fleetState === "BOUND" && server.fleetContract === FLEET_CONTRACT_ID && validFleetUuid(server.nodeId)
    ? server.nodeId.toLowerCase() : null;
}
export function fleetCard(state: ControlState, phase: FleetPhase, now: number): FleetCard {
  const live = phase === "live" && !state.cached;
  const paper = live && Boolean(state.ready?.agents.paper), host = live && Boolean(state.ready?.agents.host);
  const serverFresh = paper && fresh(state.server.capturedAt, now);
  const resources = record(state.service.resources);
  const serviceFresh = host && fresh(resources.capturedAt, now) && resources.scope === "MINECRAFT_SERVICE" && resources.source === "SYSTEMD_CGROUP";
  let status: FleetCard["status"] = "online", reason = "Paper and Host are connected";
  if (phase === "revoked") { status = "offline"; reason = "Browser grant expired or was revoked; pair this server again"; }
  else if (phase === "limited") { status = "stale"; reason = "Subscription limit reached; open this server to prioritize it"; }
  else if (!live) { status = "stale"; reason = "Waiting for an authenticated relay connection"; }
  else if (!paper && !host) { status = "offline"; reason = "Paper and Host are offline"; }
  else if (!paper) { status = "offline"; reason = `Minecraft is ${str(state.service.activeState, "offline")}; Host is connected`; }
  else if (!serverFresh) { status = "stale"; reason = "Minecraft telemetry is missing or older than 30 seconds"; }
  else if (!host) { status = "degraded"; reason = "Host is offline; node and service metrics are unavailable"; }
  else if ((Array.isArray(state.server.tps) && (number(state.server.tps[0]) ?? 20) < 18) ||
           (number(state.server.averageTickMillis) ?? 0) > 50) { status = "degraded"; reason = "Minecraft tick performance is degraded"; }
  const timestamps = [serverFresh ? capturedAtMillis(state.server.capturedAt) : null,
    serviceFresh ? capturedAtMillis(resources.capturedAt) : null].filter((x): x is number => x !== null);
  return { serverId: state.serverId, name: str(state.ready?.server.serverName, str(state.server.serverName, "Server")),
    nodeId: boundNode(state), status, reason, paper, host,
    players: serverFresh ? number(state.server.onlinePlayers) : null,
    tps: serverFresh && Array.isArray(state.server.tps) ? number(state.server.tps[0]) : null,
    mspt: serverFresh ? number(state.server.averageTickMillis) : null,
    serviceCpu: serviceFresh && resources.cpuAvailable === true && resources.cpuUnit === "PERCENT_OF_ONE_CORE" ? number(resources.cpuPercent) : null,
    serviceMemory: serviceFresh && resources.memoryAvailable === true ? number(resources.memoryBytes) : null,
    serviceState: host ? str(state.service.activeState, "unknown") : "unavailable",
    lastUpdate: timestamps.length ? Math.max(...timestamps) : null };
}
export function nodeSummaries(states: readonly ControlState[], now: number): NodeSummary[] {
  const groups = new Map<string, ControlState[]>();
  for (const state of states) { const id = boundNode(state); if (id) groups.set(id, [...(groups.get(id) ?? []), state]); }
  return [...groups].map(([nodeId, members]) => {
    const source = members.filter(state => !state.cached && state.ready?.agents.host &&
      state.hostSystem.nodeId === nodeId && state.hostSystem.processRole === "HOST" && state.hostSystem.metricScope === "NODE" &&
      fresh(state.hostSystem.capturedAt, now))
      .sort((a, b) => (capturedAtMillis(b.hostSystem.capturedAt) ?? 0) - (capturedAtMillis(a.hostSystem.capturedAt) ?? 0))[0];
    const sample = source?.hostSystem ?? {};
    return { nodeId, servers: members.length, sourceServerId: source?.serverId ?? null,
      capturedAt: capturedAtMillis(sample.capturedAt), cpu: number(sample.hostCpuPercent),
      usedMemory: number(sample.physicalMemoryUsedBytes), totalMemory: number(sample.physicalMemoryTotalBytes),
      diskUsed: number(sample.diskUsedBytes), diskTotal: number(sample.diskTotalBytes) };
  });
}

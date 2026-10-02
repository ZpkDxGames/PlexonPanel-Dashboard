import { FLEET_CONTRACT_ID, parseFleetIdentity, type FleetIdentity } from "./fleet-contract.js";

export interface FleetAgent { pluginVersion: string; fleet?: FleetIdentity }
export class FleetProtocolError extends Error {}

export function fleetTargetCompatible(kind: "PAPER" | "HOST", paper: FleetAgent | undefined, host: FleetAgent | undefined): boolean {
  if (paper?.pluginVersion !== "5.0.0" && host?.pluginVersion !== "5.0.0") return true;
  if (paper?.pluginVersion !== "5.0.0" || !paper.fleet) return false;
  if (kind === "PAPER") return true;
  return host?.pluginVersion === "5.0.0" && Boolean(host.fleet)
    && paper.fleet.serverId === host.fleet?.serverId
    && paper.fleet.nodeId === host.fleet?.nodeId
    && paper.fleet.instanceKey === host.fleet?.instanceKey;
}

/** Called only after the hello signature and server-room envelope binding have been verified. */
export function fleetFromHello(serverId: string, body: Record<string, unknown>): FleetIdentity | undefined {
  if (body.serverId !== undefined && body.serverId !== serverId)
    throw new FleetProtocolError("Signed hello server identity mismatch");
  const fields = ["fleetContract", "nodeId", "instanceKey", "serverName"];
  const present = fields.some((key) => body[key] !== undefined);
  const version = String(body.pluginVersion ?? "");
  const major = Number(/^(\d+)\./.exec(version)?.[1] ?? 0);
  if (major > 5 || (major === 5 && version !== "5.0.0"))
    throw new FleetProtocolError("Unsupported fleet component version");
  if (!present && major < 5) return undefined;
  if (body.fleetContract !== FLEET_CONTRACT_ID)
    throw new FleetProtocolError("Unsupported fleet contract");
  const fleet = parseFleetIdentity({ serverId, nodeId: body.nodeId,
    instanceKey: body.instanceKey, serverName: body.serverName });
  if (!fleet) throw new FleetProtocolError("Invalid signed fleet identity");
  return fleet;
}

export function assertFleetAssociation(
  candidate: FleetAgent, previous: FleetAgent | undefined, counterpart: FleetAgent | undefined,
): void {
  if (candidate.pluginVersion !== "5.0.0" &&
      (previous?.pluginVersion === "5.0.0" || counterpart?.pluginVersion === "5.0.0"))
    throw new FleetProtocolError("Fleet component downgrade denied");
  if (previous?.fleet && !candidate.fleet) throw new FleetProtocolError("Fleet identity downgrade denied");
  for (const bound of [previous, counterpart]) {
    if (!candidate.fleet || !bound?.fleet) continue;
    if (candidate.fleet.serverId !== bound.fleet.serverId
        || candidate.fleet.nodeId !== bound.fleet.nodeId
        || candidate.fleet.instanceKey !== bound.fleet.instanceKey)
      throw new FleetProtocolError("Immutable fleet association mismatch");
  }
}

/** Names are presentation; only a validated Host association establishes node authority. */
export function fleetReadyFields(paper: FleetAgent | undefined, host: FleetAgent | undefined) {
  const paired = paper?.fleet && host?.fleet
    && paper.fleet.serverId === host.fleet.serverId
    && paper.fleet.nodeId === host.fleet.nodeId
    && paper.fleet.instanceKey === host.fleet.instanceKey;
  const identity = paper?.fleet ?? host?.fleet;
  return {
    serverName: identity?.serverName ?? "",
    nodeId: identity?.nodeId ?? null,
    instanceKey: identity?.instanceKey ?? null,
    fleetContract: identity ? FLEET_CONTRACT_ID : null,
    fleetState: paired ? "BOUND" : identity ? "INCOMPLETE" : "LEGACY",
    paperTargetCompatible: fleetTargetCompatible("PAPER", paper, host),
    hostTargetCompatible: fleetTargetCompatible("HOST", paper, host),
  };
}

export function assertNodeTelemetry(agent: FleetAgent | undefined, body: Record<string, unknown>, kind?: "PAPER" | "HOST"): void {
  if (body.nodeId !== undefined && (!agent?.fleet || body.nodeId !== agent.fleet.nodeId))
    throw new FleetProtocolError("Node telemetry identity mismatch");
  if (agent?.pluginVersion === "5.0.0" && (!agent.fleet || body.nodeId !== agent.fleet.nodeId))
    throw new FleetProtocolError("Missing node telemetry binding");
  if (agent?.pluginVersion === "5.0.0" && kind &&
      (body.metricScope !== "NODE" || body.processRole !== (kind === "HOST" ? "HOST" : "MINECRAFT")))
    throw new FleetProtocolError("Invalid telemetry source authority");
}

export function assertServiceTelemetry(agent: FleetAgent | undefined, body: Record<string, unknown>, kind?: "PAPER" | "HOST"): void {
  if (kind !== "HOST") throw new FleetProtocolError("Service status requires Host authority");
  assertNodeTelemetry(agent, body);
  if (agent?.pluginVersion !== "5.0.0") return;
  const resources = body.resources;
  if (!resources || typeof resources !== "object" || Array.isArray(resources) ||
      (resources as Record<string, unknown>).scope !== "MINECRAFT_SERVICE" ||
      (resources as Record<string, unknown>).source !== "SYSTEMD_CGROUP" ||
      (resources as Record<string, unknown>).cpuUnit !== "PERCENT_OF_ONE_CORE")
    throw new FleetProtocolError("Invalid service resource authority");
}

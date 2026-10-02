import { FLEET_CONTRACT_ID, parseFleetIdentity, type FleetIdentity } from "./fleet-contract.js";

export interface FleetAgent { pluginVersion: string; fleet?: FleetIdentity }

/** Called only after the hello signature and server-room envelope binding have been verified. */
export function fleetFromHello(serverId: string, body: Record<string, unknown>): FleetIdentity | undefined {
  if (body.serverId !== undefined && body.serverId !== serverId)
    throw new Error("Signed hello server identity mismatch");
  const fields = ["fleetContract", "nodeId", "instanceKey", "serverName"];
  const present = fields.some((key) => body[key] !== undefined);
  const version = String(body.pluginVersion ?? "");
  const major = Number(/^(\d+)\./.exec(version)?.[1] ?? 0);
  if (major > 5 || (major === 5 && version !== "5.0.0"))
    throw new Error("Unsupported fleet component version");
  if (!present && major < 5) return undefined;
  if (body.fleetContract !== FLEET_CONTRACT_ID)
    throw new Error("Unsupported fleet contract");
  const fleet = parseFleetIdentity({ serverId, nodeId: body.nodeId,
    instanceKey: body.instanceKey, serverName: body.serverName });
  if (!fleet) throw new Error("Invalid signed fleet identity");
  return fleet;
}

export function assertFleetAssociation(
  candidate: FleetAgent, previous: FleetAgent | undefined, counterpart: FleetAgent | undefined,
): void {
  if (previous?.fleet && !candidate.fleet) throw new Error("Fleet identity downgrade denied");
  for (const bound of [previous, counterpart]) {
    if (!candidate.fleet || !bound?.fleet) continue;
    if (candidate.fleet.serverId !== bound.fleet.serverId
        || candidate.fleet.nodeId !== bound.fleet.nodeId
        || candidate.fleet.instanceKey !== bound.fleet.instanceKey)
      throw new Error("Immutable fleet association mismatch");
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
  };
}

export function assertNodeTelemetry(agent: FleetAgent | undefined, body: Record<string, unknown>): void {
  if (body.nodeId !== undefined && (!agent?.fleet || body.nodeId !== agent.fleet.nodeId))
    throw new Error("Node telemetry identity mismatch");
  if (agent?.pluginVersion === "5.0.0" && (!agent.fleet || body.nodeId !== agent.fleet.nodeId))
    throw new Error("Missing node telemetry binding");
}

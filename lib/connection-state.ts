import { record, type ControlState } from "./control-state";
import { fresh } from "./fleet-model";
import { normalizeServiceState } from "./lifecycle-state";
import { capturedAtMillis, TELEMETRY_STALE_MS, classifyTelemetry } from "./telemetry-freshness";

export type ConnectionPhase = "loading" | "unpaired" | "connecting" | "live" | "reconnecting" | "revoked" | "limited";
export interface ConnectionState {
  kind: "connecting" | "relay-unavailable" | "access-required" | "limited" | "host-disconnected" | "stopped" | "starting" | "stopping" | "failed" | "paper-disconnected" | "incompatible" | "stale" | "online" | "skew";
  label: string;
  detail: string;
  relay: string;
  host: string;
  minecraft: string;
}

/** A missing plugin connection never proves that the Minecraft process stopped. */
export function connectionState(state: ControlState, phase: ConnectionPhase, now: number): ConnectionState {
  const result: ConnectionState = { kind: "connecting", label: "Connecting", detail: "Checking this server's authenticated relay session.",
    relay: "Connecting", host: "Unknown", minecraft: "Unknown" };
  if (phase === "revoked" || phase === "unpaired") return { ...result, kind: "access-required", label: "Pairing required",
    detail: "This server's browser grant has expired or was revoked. Pair it again to restore access.", relay: "Access required" };
  if (phase === "limited") return { ...result, kind: "limited", label: "Subscription paused",
    detail: "Open this server to prioritize its connection.", relay: "Paused" };
  if (phase === "reconnecting") return { ...result, kind: "relay-unavailable", label: "Relay unavailable",
    detail: "Reconnecting automatically. Minecraft and Host states cannot be verified; commands are disabled.", relay: "Unavailable" };
  if (phase !== "live" || state.cached || !state.ready) return result;
  const paper = state.ready.agents.paper, host = state.ready.agents.host;
  result.relay = "Connected";
  result.host = host ? "Connected" : "Disconnected";
  result.minecraft = paper ? "Connected" : "Unknown";
  if (!host) return { ...result, kind: "host-disconnected", label: "Host disconnected",
    detail: paper ? "Minecraft is connected. Host service controls and backups are unavailable." : "The relay is connected. Host is disconnected; the Minecraft process state is unknown." };
  if (state.ready.server.hostTargetCompatible === false || state.ready.server.paperTargetCompatible === false)
    return { ...result, kind: "incompatible", label: "Agent compatibility issue", detail: "Agent versions or instance bindings do not match. Affected commands remain disabled." };
  const serviceFresh = fresh(record(state.service.resources).capturedAt, now,state.receipts?.service);
  const service = serviceFresh ? normalizeServiceState(state.service.state) : "unknown";
  if (!paper && service === "inactive") return { ...result, kind: "stopped", label: "Minecraft stopped", minecraft: "Stopped",
    detail: "Host is connected and confirms that this Minecraft service is stopped." };
  if (service === "activating" || service === "deactivating") {
    const starting = service === "activating";
    return { ...result, kind: starting ? "starting" : "stopping", label: starting ? "Minecraft starting" : "Minecraft stopping",
      minecraft: starting ? "Starting" : "Stopping", detail: "Host confirms a service transition. Wait for the next sample before using lifecycle controls." };
  }
  if (!paper && service === "failed") return { ...result, kind: "failed", label: "Minecraft service failed", minecraft: "Failed",
    detail: "Host reports a failed Minecraft service. Review this server's console before retrying." };
  if (!paper) return { ...result, kind: "paper-disconnected", label: "Minecraft connection unavailable",
    minecraft: service === "active" ? "Running · plugin disconnected" : "Unknown",
    detail: service === "active" ? "Host reports a running service, but the Paper agent is disconnected." : "Host is connected. Waiting for a fresh service sample or Paper connection." };
  if (capturedAtMillis(state.server.capturedAt) === null && state.paperConnectedAt !== undefined &&
      now >= state.paperConnectedAt && now - state.paperConnectedAt <= TELEMETRY_STALE_MS)
    return { ...result, label: "Waiting for Minecraft telemetry",
      detail: "The Paper agent is connected. Waiting for its first sample from this session." };
  const health=classifyTelemetry({capturedAt:state.server.capturedAt,receivedAt:state.receipts?.paperHealth,connected:paper,now});
  if (!health.usable) return { ...result, kind: "stale", label: "Minecraft telemetry unavailable",
    detail: "Agents are connected, but Minecraft telemetry is missing, older than 30 seconds, or has an inconsistent clock. Host telemetry and backups are independent." };
  if(health.skewAheadMs>5000)return {...result,kind:"skew",label:`Paper clock skew +${Math.round(health.skewAheadMs/1000)} s`,detail:`Paper's clock is about ${Math.round(health.skewAheadMs/1000)} s ahead of this browser. Values are the latest received samples. Check time synchronization on the server and on this computer.`};
  return { ...result, kind: "online", label: "Online", detail: "Minecraft, Host, and relay are connected." };
}

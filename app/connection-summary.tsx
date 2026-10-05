"use client";
import type { ControlState } from "../lib/control-state";
import { connectionState, type ConnectionPhase, type ConnectionState } from "../lib/connection-state";
import { useTelemetryNow } from "../lib/telemetry-clock";

export function useConnectionState(state: ControlState, phase: ConnectionPhase): ConnectionState {
  const now = useTelemetryNow(state.updatedAt);
  return connectionState(state, phase, now);
}
export function ConnectionPills({ state, phase }: { state: ControlState; phase: ConnectionPhase }) {
  const status = useConnectionState(state, phase);
  return <div className="workspace-connections" aria-label="Server connections">
    <span title={`Relay: ${status.relay}`}><i />Relay <b>{status.relay}</b></span>
    <span title={`Host: ${status.host}`}><i />Host <b>{status.host}</b></span>
    <span title={`Minecraft: ${status.minecraft}`}><i />Minecraft <b>{status.minecraft}</b></span>
  </div>;
}
export function ConnectionSummary({ state, phase, retry }: { state: ControlState; phase: ConnectionPhase; retry: () => void }) {
  const status = useConnectionState(state, phase);
  return <section className="workspace-health" data-state={status.kind} aria-label="Selected server status" role="status">
    <div><strong>{status.label}</strong><p>{status.detail}{state.cached && " Showing this server's saved history; commands are disabled."}</p></div>
    {phase === "reconnecting" && <button className="cr-button" onClick={retry}>Retry connection</button>}
  </section>;
}

"use client";
import type { ControlState } from "../lib/control-state";
import type { ConnectionPhase } from "../lib/connection-state";
import { classifyTelemetry } from "../lib/telemetry-freshness";
import { useTelemetryNow } from "../lib/telemetry-clock";

export function TelemetryFreshness({ state, phase }: { state: ControlState; phase: ConnectionPhase }) {
  const now = useTelemetryNow(state.updatedAt);
  const live = phase === "live" && !state.cached;
  const streams = [
    { name: "Minecraft", sample: state.server, connected: live && Boolean(state.ready?.agents.paper) },
    { name: "Host", sample: state.hostSystem, connected: live && Boolean(state.ready?.agents.host) },
  ];
  return <div className="workspace-freshness" role="group" aria-label="Telemetry freshness">
    {streams.map(stream => {
      const status = classifyTelemetry({capturedAt:stream.sample.capturedAt,receivedAt:stream.name==="Minecraft"?state.receipts?.paperHealth:state.receipts?.hostSystem,connected:stream.connected,now});
      return <span key={stream.name} className={`workspace-freshness ${status.kind}`}>
        {stream.name}: {status.label}
      </span>;
    })}
  </div>;
}

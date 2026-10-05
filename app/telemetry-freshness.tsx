"use client";
import type { ControlState } from "../lib/control-state";
import type { ConnectionPhase } from "../lib/connection-state";
import { telemetryFreshness } from "../lib/telemetry-freshness";
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
      const status = telemetryFreshness(stream.sample.capturedAt, stream.connected, now);
      return <span key={stream.name} className={`cr21-freshness ${status.kind}`}>
        {stream.name}: {status.label}
      </span>;
    })}
  </div>;
}

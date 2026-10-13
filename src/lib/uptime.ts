import { number, type ControlState } from "../adapter/control-state";
import { classifyTelemetry } from "../adapter/telemetry-freshness";

/** Paper JVM elapsed time only. Session acceptance/reset belongs to the reducer. */
export function paperProcessUptime(
  state: ControlState,
  now: number,
): number | null {
  const freshness = classifyTelemetry({
    capturedAt: state.system.capturedAt,
    receivedAt: state.receipts?.paperSystem,
    connected: Boolean(state.ready?.agents.paper) && !state.cached,
    expectedIntervalMs: number(state.system.sourceIntervalMillis),
    now,
  });
  return freshness.usable ? number(state.system.processUptimeMillis) : null;
}

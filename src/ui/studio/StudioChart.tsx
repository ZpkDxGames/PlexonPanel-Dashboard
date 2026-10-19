import { useMemo } from "react";
import type { TelemetryView } from "../bindings";
import { shapeTelemetry, SERIES, seriesKey } from "../telemetry/series";
import { Stage } from "../telemetry/Stage";
import { TimeAxis } from "../telemetry/TimeAxis";
export type ChartView =
  "tick" | "memory" | "cpu" | "compute" | "gc" | "entities";
export type ChartData = Pick<
  TelemetryView,
  "paper" | "system" | "host" | "service" | "now" | "since"
>;
/** Compact compatibility entry for the real Settings component preview. */
export function StudioChart({
  data,
  active = "tps",
}: {
  data: ChartData;
  active?: string;
  staged?: boolean;
}) {
  const samples = useMemo(
      () => shapeTelemetry(data),
      [data.paper, data.system, data.host, data.service],
    ),
    domain = useMemo(
      () => [data.since, data.now] as [number, number],
      [data.since, data.now],
    );
  return (
    <div className="pp-chart pp-preview-chart">
      <Stage
        spec={SERIES[seriesKey(active)]}
        samples={samples}
        domainT={domain}
        minHeight={90}
      />
      <TimeAxis domainT={domain} />
    </div>
  );
}

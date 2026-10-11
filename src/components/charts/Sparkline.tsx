import { useMemo } from "react";
import type { Sample } from "../../adapter/control-state";
import { metricPoints, pointSegments, type MetricKey } from "../../lib/telemetryView";

export function Sparkline({ samples, metric, active }: { samples: Sample[]; metric: MetricKey; active: boolean }) {
  const segments = useMemo(() => pointSegments(metricPoints(samples.slice(-240), metric)), [samples, metric]);
  const values = segments.flat().map((p) => p.value!);
  if (!values.length) return <div className="sparkline-placeholder" aria-hidden="true"/>;
  const first = segments[0][0].at, last = segments.at(-1)!.at(-1)!.at, min = Math.min(...values), max = Math.max(...values);
  return <svg className={`sparkline ${active ? "" : "is-historical"}`} viewBox="0 0 160 30" preserveAspectRatio="none" aria-hidden="true">{segments.map((segment, index) => <path key={index} d={segment.map((p, i) => `${i ? "L" : "M"}${2 + (p.at - first) / Math.max(1, last - first) * 156},${26 - (p.value! - min) / Math.max(1, max - min) * 22}`).join("")} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>)}</svg>;
}

import { usePlotHistory } from "../presentation/PlotHistory";
import { memo } from "react";
import { type Sample } from "../adapter/control-state";
import {
  displaySegments,
  historyFor,
  sourceFor,
  type MetricKey,
} from "../presentation/telemetry";
import { Icon } from "./Icon";
export const Sparkline = memo(function Sparkline({
  samples,
  metric,
}: {
  samples: Sample[];
  metric: MetricKey;
}) {
  const epochs = usePlotHistory();
  const points = historyFor(
      epochs?.[sourceFor[metric]] ?? samples,
      sourceFor[metric],
    ).slice(-60),
    numeric = points
      .map((sample) => sample[metric])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (numeric.length < 2) return <span className="sparkline" />;
  const min = Math.min(...numeric),
    max = Math.max(...numeric),
    first = points[0].at,
    last = points.at(-1)!.at;
  return (
    <svg
      className="sparkline"
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {displaySegments(points, metric, 100).map((segment, i) => (
        <path
          key={i}
          d={segment
            .map(
              (sample, index) =>
                `${index ? "L" : "M"}${(((sample.at - first) / Math.max(1, last - first)) * 100).toFixed(1)},${(26 - (((sample[metric] as number) - min) / Math.max(0.01, max - min)) * 22).toFixed(1)}`,
            )
            .join("")}
        />
      ))}
    </svg>
  );
});
export function MetricCell({
  label,
  reading,
  detail,
  icon,
  history,
  metric,
}: {
  label: string;
  reading: { value: string; unit: string; available: boolean };
  detail: string;
  icon: string;
  history?: Sample[];
  metric?: MetricKey;
}) {
  return (
    <div className="metric-cell" data-available={reading.available}>
      <span className="metric-label">
        <Icon name={icon} />
        {label}
      </span>
      <div className="metric-value">
        <strong>{reading.value}</strong>
        <em>{reading.unit}</em>
      </div>
      <small>{detail}</small>
      {history && metric && <Sparkline samples={history} metric={metric} />}
    </div>
  );
}
export function SectionLabel({
  index,
  title,
  detail,
}: {
  index: string;
  title: string;
  detail?: string;
}) {
  return (
    <div className="section-label">
      <h2>
        <b>{index}</b>
        {title}
      </h2>
      {detail && <span>{detail}</span>}
    </div>
  );
}
export function Coverage({ samples }: { samples: Sample[] }) {
  const recent = historyFor(samples, "paperHealth").slice(-90);
  return (
    <div
      className="availability-strip"
      aria-label="Observed mean tick samples; amber exceeds 50 milliseconds, gaps are grey"
    >
      {recent.map((sample, index) => (
        <i
          key={`${sample.at}:${index}`}
          className={
            sample.mspt === null ? "gap" : sample.mspt! > 50 ? "hot" : ""
          }
          title={`${new Date(sample.at).toISOString()} · ${sample.mspt ?? "unknown"} ms`}
        />
      ))}
    </div>
  );
}

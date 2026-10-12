import { useMemo, useState } from "react";
import type { Sample } from "../adapter/control-state";
import { sampleStats } from "../lib/chart";
import { TimeSeries, type MetricKey } from "./charts/TimeSeries";
import { Segmented } from "./Segmented";
import { Panel, Status } from "./ui";

export type FocusMetricOption = {
  key: MetricKey;
  shortLabel: string;
  label: string;
  unit: "%" | "bytes";
  color: string;
  source: "Paper JVM" | "Host" | "Host service";
};

function valueLabel(value: number | null | undefined, unit: "%" | "bytes") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  if (unit === "bytes") return `${(value / 2 ** 30).toFixed(2)} GiB`;
  return `${value.toFixed(1)}%`;
}

export function FocusedMetricPanel({
  title,
  eyebrow,
  samples,
  windowMs,
  live,
  options,
  defaultMetric,
}: {
  title: string;
  eyebrow: string;
  samples: Sample[];
  windowMs: number;
  live: boolean;
  options: readonly FocusMetricOption[];
  defaultMetric: MetricKey;
}) {
  const [selected, setSelected] = useState<MetricKey | "compare">(
    defaultMetric,
  );
  const active =
    selected === "compare"
      ? options
      : options.filter((option) => option.key === selected);
  const focus = selected === "compare" ? null : active[0];
  const stats = useMemo(() => {
    if (!focus) return null;
    return sampleStats(
      samples
        .map((sample) => sample[focus.key])
        .filter((value): value is number => typeof value === "number"),
    );
  }, [focus, samples]);
  const currentValues = options.map((option) => {
    const current = samples.findLast(
      (sample) => typeof sample[option.key] === "number",
    )?.[option.key];
    return { option, current: typeof current === "number" ? current : null };
  });

  return (
    <Panel
      title={title}
      eyebrow={eyebrow}
      className="metric-focus-panel"
      action={
        <Status tone={live ? "success" : "neutral"}>
          {live ? "Live" : "History"}
        </Status>
      }
    >
      <div className="metric-focus-toolbar">
        <Segmented label={`${title} metric`} value={selected}>
          {options.map((option) => (
            <button
              key={option.key}
              className={selected === option.key ? "active" : ""}
              aria-pressed={selected === option.key}
              onClick={() => setSelected(option.key)}
            >
              {option.shortLabel}
            </button>
          ))}
          <button
            className={selected === "compare" ? "active" : ""}
            aria-pressed={selected === "compare"}
            onClick={() => setSelected("compare")}
          >
            Compare
          </button>
        </Segmented>
        <span>
          {selected === "compare"
            ? "Comparison mode · inspect each source together"
            : `${focus?.label ?? ""} · ${focus?.source ?? ""}`}
        </span>
      </div>

      {focus && stats ? (
        <div className="metric-focus-stats">
          {[
            ["Now", stats.current],
            ["Average", stats.average],
            ["Lowest", stats.min],
            ["Peak", stats.max],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <strong>
                {valueLabel(
                  typeof value === "number" ? value : null,
                  focus.unit,
                )}
              </strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="metric-focus-stats compare">
          {currentValues.map(({ option, current }) => (
            <div key={option.key}>
              <i style={{ background: option.color }} />
              <strong>{valueLabel(current, option.unit)}</strong>
              <span>{option.label}</span>
            </div>
          ))}
        </div>
      )}

      <TimeSeries
        samples={samples}
        windowMs={windowMs}
        height={258}
        title={focus?.label ?? `${title} comparison`}
        live={live}
        yMin={0}
        series={active.map((option) => ({
          key: option.key,
          label: option.label,
          unit: option.unit,
          color: option.color,
        }))}
        source={
          selected === "compare"
            ? "Paper JVM + Host"
            : focus?.source ?? "Paper JVM + Host"
        }
      />
    </Panel>
  );
}

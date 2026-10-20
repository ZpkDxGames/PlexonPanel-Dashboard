import {
  SERIES,
  sampleAt,
  latest,
  type Sample,
  type SeriesKey,
} from "./series";
import { useCrosshair } from "./crosshair";
import { time, usePrefs } from "../bindings";
const groups: { label: string; keys: SeriesKey[] }[] = [
  { label: "Tick", keys: ["tps", "mean", "p95", "p99"] },
  { label: "GC", keys: ["gc"] },
  { label: "Memory", keys: ["heapUsed", "committed", "cgroup"] },
  { label: "CPU", keys: ["svcCpu", "nodeCpu"] },
  { label: "World", keys: ["chunks", "entities"] },
];
export function ReadoutBar({ samples }: { samples: Sample[] }) {
  const at = useCrosshair(),
    prefs = usePrefs();
  return (
    <div
      className="pp-readout-bar"
      data-testid="readout-bar"
      data-state={at === null ? "live" : "scrub"}
      role="status"
      aria-live="off"
      tabIndex={0}
      aria-label="Shared telemetry readout"
    >
      <time>{time(at ?? samples.at(-1)?.t ?? NaN, prefs.timezone)}</time>
      <span className="pp-readout-bar__mode">
        {at === null ? "FOLLOW" : "SCRUB"}
      </span>
      {groups.map((g) => (
        <span className="pp-readout-bar__seg" key={g.label}>
          <i>{g.label}</i>
          {g.keys.map((key) => {
            const spec = SERIES[key],
              row = at === null ? undefined : sampleAt(samples, at, key),
              value =
                at === null
                  ? latest(samples, key)
                  : row
                    ? spec.accessor(row)
                    : null;
            return (
              <span key={key} className="pp-readout-bar__kv">
                <em title={spec.label} aria-label={spec.label}>
                  {key === "chunks"
                    ? "Chunks"
                    : spec.label
                        .replace(" MSPT", "")
                        .replace(" pauses Δ", " Δ")}
                </em>
                <b style={{ color: spec.color }}>{spec.fmt(value)}</b>
                <small>{spec.unit}</small>
              </span>
            );
          })}
        </span>
      ))}
    </div>
  );
}

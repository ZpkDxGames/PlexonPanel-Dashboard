import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useNow } from "../hooks";
import { classifyTelemetry } from "../adapter/telemetry-freshness";
import {
  resourceWindow,
  resourceSegments,
  resourceScale,
  type Resources,
  type ResourceKey,
  type ResourceScale,
  type ResourcePoint,
} from "../lib/resource-series";
import { formatTime } from "../lib/time";
import { Segmented } from "./Segmented";
import { Panel } from "./ui";
export type ResourceOption = {
  key: ResourceKey;
  shortLabel: string;
  label: string;
  unit: "%" | "bytes";
  color: string;
  source: string;
};
function valueLabel(value: number | null | undefined, unit: "%" | "bytes") {
  return value == null
    ? "—"
    : unit === "bytes"
      ? `${(value / 2 ** 30).toFixed(2)} GiB`
      : `${value.toFixed(1)}%`;
}
const Plot = memo(function Plot({
  lines,
  max,
  start,
  end,
  unit,
}: {
  lines: {
    option: ResourceOption;
    points: ResourcePoint[];
  }[];
  max: number;
  start: number;
  end: number;
  unit: "%" | "bytes";
}) {
  const [hover, setHover] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(220, entry.contentRect.width)),
    );
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const plotWidth = width - 75;
  const geometry = useMemo(() => {
    if (import.meta.env.DEV) {
      const target = window as unknown as { __resourceGeometry?: number };
      target.__resourceGeometry = (target.__resourceGeometry ?? 0) + 1;
    }
    return lines.map((line) => {
      const segments = resourceSegments(line.points, start, end, plotWidth);
      return {
        ...line,
        segments,
        paths: segments.map((segment) =>
          segment
            .map(
              (p, i) =>
                `${i ? "L" : "M"}${(60 + ((p.capturedAt - start) / (end - start)) * plotWidth).toFixed(2)},${(205 - (p.value! / max) * 190).toFixed(2)}`,
            )
            .join(" "),
        ),
      };
    });
  }, [lines, max, start, end, plotWidth]);
  return (
    <div
      ref={root}
      className="resource-plot"
      onPointerLeave={() => setHover(null)}
    >
      <svg
        viewBox={`0 0 ${width} 235`}
        role="img"
        aria-label="Independent source time series"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover(
            Math.max(
              0,
              Math.min(
                1,
                (((e.clientX - r.left) / r.width) * width - 60) / plotWidth,
              ),
            ),
          );
        }}
      >
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line
              x1="60"
              x2={width - 15}
              y1={205 - f * 190}
              y2={205 - f * 190}
              stroke="currentColor"
              opacity=".12"
            />
            <text x="2" y={208 - f * 190} fill="currentColor" fontSize="10">
              {valueLabel(max * f, unit)}
            </text>
          </g>
        ))}
        {geometry.map(({ option, paths, segments }) => (
          <g
            key={option.key}
            stroke={option.color}
            fill="none"
            strokeWidth="2"
            strokeLinejoin="round"
          >
            {paths.map((d, i) => (
              <path key={i} d={d} />
            ))}
            {segments
              .filter((s) => s.length === 1)
              .map((s, i) => (
                <circle
                  key={i}
                  cx={
                    60 + ((s[0].capturedAt - start) / (end - start)) * plotWidth
                  }
                  cy={205 - (s[0].value! / max) * 190}
                  r="2"
                />
              ))}
          </g>
        ))}
        <text x="60" y="229" fill="currentColor" fontSize="11">
          {formatTime(start, { seconds: true })}
        </text>
        <text
          x={width - 15}
          y="229"
          textAnchor="end"
          fill="currentColor"
          fontSize="11"
        >
          {formatTime(end, { seconds: true })}
        </text>
        {hover !== null && (
          <line
            x1={60 + hover * plotWidth}
            x2={60 + hover * plotWidth}
            y1="10"
            y2="205"
            stroke="currentColor"
            opacity=".4"
          />
        )}
      </svg>
      <div className="resource-inspector" aria-live="off">
        {hover === null
          ? "Hover to inspect each source at its own capture time."
          : lines.map(({ option, points }) => {
              const at = start + hover * (end - start);
              let lo = 0,
                hi = points.length;
              while (lo < hi) {
                const mid = (lo + hi) >>> 1;
                if (points[mid].capturedAt <= at) lo = mid + 1;
                else hi = mid;
              }
              const p = points[lo - 1];
              const available =
                p &&
                p.sourceIntervalMillis &&
                at - p.capturedAt <= p.sourceIntervalMillis * 3;
              return (
                <span key={option.key}>
                  {option.shortLabel}:{" "}
                  {available
                    ? `${valueLabel(p.value, option.unit)} · ${formatTime(p.capturedAt, { seconds: true, millis: true })}`
                    : "gap"}
                </span>
              );
            })}
      </div>
    </div>
  );
});
export function ResourcePanel({
  title,
  eyebrow,
  resources,
  windowMs,
  connections,
  options,
  defaultMetric,
}: {
  title: string;
  eyebrow: string;
  resources: Resources;
  windowMs: number;
  connections: { paper: boolean; host: boolean };
  options: readonly ResourceOption[];
  defaultMetric: ResourceKey;
}) {
  const now = useNow(),
    clock = useRef(now),
    latest = useRef(resources);
  latest.current = resources;
  clock.current = Math.max(clock.current, now);
  const [selected, setSelected] = useState<ResourceKey | "compare">(
      defaultMetric,
    ),
    [hidden, setHidden] = useState<ResourceKey[]>([]);
  const scale = useRef<ResourceScale>({ max: 1, calmSince: null });
  // Packet arrivals update the source owners. Plot projection runs only on the shared 1s clock.
  const snapshot = useMemo(() => {
    if (import.meta.env.DEV) {
      const target = window as unknown as { __resourceProjections?: number };
      target.__resourceProjections = (target.__resourceProjections ?? 0) + 1;
    }
    const end = clock.current,
      start = end - windowMs;
    return {
      start,
      end,
      lines: options.map((option) => {
        const points = resourceWindow(latest.current[option.key], start, end);
        return {
          option,
          points,
        };
      }),
    };
  }, [now, windowMs, options]);
  const required = Math.max(
    1,
    ...snapshot.lines.flatMap((l) =>
      l.points.flatMap((p) => (p.value === null ? [] : [p.value])),
    ),
  );
  scale.current = resourceScale(scale.current, required, clock.current);
  const active = useMemo(
    () =>
      snapshot.lines.filter((l) =>
        selected === "compare"
          ? !hidden.includes(l.option.key)
          : l.option.key === selected,
      ),
    [snapshot, selected, hidden],
  );
  const focus = selected === "compare" ? null : active[0],
    values =
      focus?.points.flatMap((p) => (p.value === null ? [] : [p.value])) ?? [];
  const current = focus?.points.at(-1);
  const freshness = current
    ? classifyTelemetry({
        capturedAt: new Date(current.capturedAt).toISOString(),
        receivedAt: current.receivedAt,
        connected:
          current.source === "paper" ? connections.paper : connections.host,
        now,
        expectedIntervalMs: current.sourceIntervalMillis,
      })
    : null;
  return (
    <Panel title={title} eyebrow={eyebrow} className="resource-panel">
      <div className="resource-toolbar">
        <Segmented label={`${title} metric`} value={selected}>
          {options.map((o) => (
            <button
              key={o.key}
              className={selected === o.key ? "active" : ""}
              aria-pressed={selected === o.key}
              onClick={() => setSelected(o.key)}
            >
              {o.shortLabel}
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
      </div>
      {focus ? (
        <>
          <div className="resource-stats">
            {[
              ["Now", freshness?.usable ? current?.value : null],
              [
                "Average",
                values.length
                  ? values.reduce((a, b) => a + b, 0) / values.length
                  : null,
              ],
              ["Minimum", values.length ? Math.min(...values) : null],
              ["Peak", values.length ? Math.max(...values) : null],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <strong>
                  {valueLabel(
                    typeof value === "number" ? value : null,
                    focus.option.unit,
                  )}
                </strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <p className="subtle">
            {focus.option.label} · {focus.option.source} ·{" "}
            {freshness?.label ?? "waiting for telemetry"} · cadence{" "}
            {current?.sourceIntervalMillis
              ? `${current.sourceIntervalMillis} ms`
              : "unknown"}
          </p>
        </>
      ) : (
        <div className="resource-legend">
          {options.map((o) => (
            <button
              key={o.key}
              aria-pressed={!hidden.includes(o.key)}
              onClick={() =>
                setHidden((keys) =>
                  keys.includes(o.key)
                    ? keys.filter((k) => k !== o.key)
                    : [...keys, o.key],
                )
              }
            >
              <i style={{ background: o.color }} />
              {o.shortLabel}
            </button>
          ))}
        </div>
      )}
      <Plot
        lines={active}
        max={scale.current.max}
        start={snapshot.start}
        end={snapshot.end}
        unit={options[0].unit}
      />
    </Panel>
  );
}

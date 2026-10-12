import { SmoothPath } from "./SmoothPath";
import { usePreferences } from "../../store/preferences";
import { projectHistory } from "../../adapter/history";
import { copy } from "../../i18n/en";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Sample } from "../../adapter/control-state";
import { domain, monotone, stableDomain, resample } from "../../lib/chart";
export type MetricKey = keyof Pick<
  Sample,
  | "tps"
  | "mspt"
  | "hostCpu"
  | "processCpu"
  | "heap"
  | "memory"
  | "players"
  | "gc"
  | "serviceCpu"
  | "serviceMemory"
>;
type Series = {
  key: MetricKey;
  label: string;
  color: string;
  unit: string;
};
export function Sparkline({
  values,
  color = "var(--c1)",
  minSpan = 1,
}: {
  values: (number | null)[];
  color?: string;
  minSpan?: number;
}) {
  const id = useId().replaceAll(":", "");
  const v = values
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n))
    .slice(-60);
  const [lo, hi] = domain(v, minSpan);
  const pts = v.map(
    (n, i) =>
      [
        (i / Math.max(1, v.length - 1)) * 180,
        36 - ((n - lo) / (hi - lo)) * 32,
      ] as [number, number],
  );
  const p = monotone(pts);
  return (
    <svg
      className="spark"
      viewBox="0 0 180 40"
      preserveAspectRatio="none"
      style={{ "--c": color } as React.CSSProperties}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {p && (
        <>
          <path d={`${p}L180,40L0,40Z`} fill={`url(#${id})`} />
          <path className="ln" d={p} />
        </>
      )}
    </svg>
  );
}
function PlotSegment({
  path,
  points,
  color,
  id,
  area,
  end,
  bottom,
}: {
  path: string;
  points: [number, number][];
  color: string;
  id: string;
  area: boolean;
  end: boolean;
  bottom: number;
}) {
  const endpoint = useRef<SVGGElement>(null);
  return (
    <>
      {area && (
        <SmoothPath
          d={`${path}L${points.at(-1)![0]},${bottom}L${points[0][0]},${bottom}Z`}
          fill={`url(#${id})`}
        />
      )}
      <SmoothPath
        className="chart-line"
        d={path}
        fill="none"
        stroke={color}
        endpoint={endpoint}
      />
      {end && (
        <g ref={endpoint}>
          <circle
            className="chart-end-ring"
            cx={points.at(-1)![0]}
            cy={points.at(-1)![1]}
            r={7}
            style={{ fill: color }}
          />
          <circle
            className="chart-end"
            cx={points.at(-1)![0]}
            cy={points.at(-1)![1]}
            r={4}
            style={{ fill: color }}
          />
        </g>
      )}
    </>
  );
}
export function TimeSeries({
  samples,
  series,
  threshold,
  title,
  source = "Paper",
  height = 300,
  yMin,
  yMax,
  live = true,
}: {
  samples: Sample[];
  series: Series[];
  threshold?: number;
  title: string;
  source?: string;
  height?: number;
  yMin?: number;
  yMax?: number;
  live?: boolean;
}) {
  const prefs = usePreferences();
  const axis = useRef<{ key: string; bounds: [number, number] } | undefined>(
    undefined,
  );
  const [table, setTable] = useState(false),
    [hidden, setHidden] = useState<Set<MetricKey>>(new Set()),
    [width, setWidth] = useState(600),
    [local, setLocal] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const id = useId().replaceAll(":", "");
  useEffect(() => {
    const observer = new ResizeObserver(([e]) =>
      setWidth(Math.max(240, e.contentRect.width)),
    );
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const active = series.filter((s) => !hidden.has(s.key));
  const present = useMemo(() => {
    const merged = new Map<number, Sample>();
    for (const a of active) {
      const source = ["hostCpu", "memory"].includes(a.key)
        ? "hostSystem"
        : ["processCpu", "heap", "gc"].includes(a.key)
          ? "paperSystem"
          : ["serviceCpu", "serviceMemory"].includes(a.key)
            ? "service"
            : "paperHealth";
      const points = samples.some((s) => s.sources)
        ? projectHistory(samples, source)
        : samples;
      for (const point of points) {
        if (typeof point[a.key] !== "number") continue;
        const row = merged.get(point.at) ?? {
          at: point.at,
          tps: null,
          mspt: null,
          hostCpu: null,
          processCpu: null,
          heap: null,
          memory: null,
          players: null,
          gc: null,
        };
        Object.assign(row, { [a.key]: point[a.key] });
        merged.set(point.at, row);
      }
    }
    return [...merged.values()].sort((a, b) => a.at - b.at);
  }, [samples, series, hidden]);
  const values = present.flatMap((s) =>
    active
      .map((a) => s[a.key])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v)),
  );
  const bytes = active[0]?.unit === "bytes",
    scale = bytes ? 2 ** 30 : 1;
  const metric = active[0]?.key;
  const minimumSpan =
    metric === "tps"
      ? 3
      : metric === "mspt"
        ? 14
        : active[0]?.unit === "%"
          ? 20
          : bytes
            ? 1
            : 1;
  const [fit, setFit] = useState(0);
  const axisKey = active.map((a) => a.key).join(",") + fit;
  const bounds = stableDomain(
    values.map((v) => v / scale),
    minimumSpan,
    axis.current?.key === axisKey ? axis.current.bounds : undefined,
  );
  axis.current = values.length ? { key: axisKey, bounds } : undefined;
  let [lo, hi] = bounds;
  if (yMin !== undefined) lo = yMin;
  if (yMax !== undefined) hi = Math.max(hi, yMax);
  const left = 44,
    right = width - 24,
    top = 22,
    bottom = height - 30;
  const start = present[0]?.at ?? 0,
    end = present.at(-1)?.at ?? 1;
  const x = (at: number) =>
      left + ((at - start) / Math.max(1, end - start)) * (right - left),
    y = (v: number) => bottom - ((v / scale - lo) / (hi - lo)) * (bottom - top);
  const hover = local;
  const nearest =
    hover === null
      ? null
      : present.reduce<Sample | null>(
          (best, s) =>
            !best || Math.abs(s.at - hover) < Math.abs(best.at - hover)
              ? s
              : best,
          null,
        );
  const nearestFor = (key: MetricKey) =>
    hover === null
      ? null
      : present.reduce<Sample | null>(
          (best, s) =>
            typeof s[key] !== "number"
              ? best
              : !best || Math.abs(s.at - hover) < Math.abs(best.at - hover)
                ? s
                : best,
          null,
        );
  const paths = active.map((s) => {
    const groups: [number, number][][] = [];
    let last = 0;
    for (const p of present) {
      const v = p[s.key];
      if (typeof v !== "number") continue;
      if (p.at - last > 10000) {
        if (groups.at(-1)?.length) groups.push([]);
      }
      if (typeof v === "number") {
        if (!groups.length) groups.push([]);
        groups.at(-1)!.push([x(p.at), y(v)]);
      }
      last = p.at;
    }
    const maxPoints = Math.max(80, Math.floor(width * 2));
    return {
      s,
      groups: groups
        .filter((g) => g.length)
        .map((g) => {
          if (g.length > maxPoints) {
            const kept: [number, number][] = [];
            const step = Math.ceil(g.length / maxPoints);
            for (let i = 0; i < g.length; i += step) {
              const bucket = g.slice(i, i + step);
              const min = bucket.reduce((a, b) => (a[1] < b[1] ? a : b)),
                max = bucket.reduce((a, b) => (a[1] > b[1] ? a : b));
              kept.push(...[min, max].sort((a, b) => a[0] - b[0]));
            }
            g = kept;
          }
          const points =
            prefs.chartCurve === "step"
              ? g
              : resample(g, prefs.chartDensity === "rich" ? 320 : 120);
          const path =
            prefs.chartCurve === "smooth"
              ? monotone(points)
              : points
                  .map(([x, y], i) =>
                    i === 0
                      ? `M${x},${y}`
                      : prefs.chartCurve === "step"
                        ? `H${x}V${y}`
                        : `L${x},${y}`,
                  )
                  .join("");
          return { points, path };
        }),
    };
  });
  const summary = present.length
    ? `${title}. ${present.length} samples. Range ${lo.toFixed(1)} to ${hi.toFixed(1)} ${bytes ? "GiB" : (active[0]?.unit ?? "")}.`
    : `${title}. No samples received.`;
  const inspect = (at: number | null) => {
    setLocal(at);
  };
  return (
    <div className="chart-block" ref={root}>
      <div className="chart-legend">
        <button className="table-toggle" onClick={() => setFit((n) => n + 1)}>
          {copy.refine_4b290c75}
        </button>
        {series.length > 1 &&
          series.map((s) => (
            <button
              key={s.key}
              aria-pressed={!hidden.has(s.key)}
              className={hidden.has(s.key) ? "muted" : ""}
              onClick={() =>
                setHidden((v) => {
                  const n = new Set(v);
                  n.has(s.key) ? n.delete(s.key) : n.add(s.key);
                  return n;
                })
              }
            >
              <i style={{ background: s.color }} />
              {s.label}
              {present.filter((p) => typeof p[s.key] === "number").length <
                2 && (
                <small className="series-status">
                  {present.some((p) => typeof p[s.key] === "number")
                    ? "Collecting history"
                    : "Awaiting sample"}
                </small>
              )}
            </button>
          ))}
        <button className="table-toggle" onClick={() => setTable((v) => !v)}>
          {table ? "Hide table" : "View as table"}
        </button>
      </div>
      <div className="chart chart-draw" style={{ height }}>
        <svg
          className="time-series"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={summary}
          tabIndex={0}
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            inspect(
              start +
                Math.max(
                  0,
                  Math.min(1, (e.clientX - rect.left - left) / (right - left)),
                ) *
                  (end - start),
            );
          }}
          onPointerLeave={() => inspect(null)}
          onBlur={() => inspect(null)}
          onKeyDown={(e) => {
            if (!["ArrowLeft", "ArrowRight"].includes(e.key) || !present.length)
              return;
            e.preventDefault();
            const at = nearest ? present.indexOf(nearest) : present.length - 1;
            inspect(
              present[
                Math.max(
                  0,
                  Math.min(
                    present.length - 1,
                    at + (e.key === "ArrowRight" ? 1 : -1),
                  ),
                )
              ].at,
            );
          }}
        >
          <defs>
            {series.map((s) => (
              <linearGradient
                key={s.key}
                id={`${id}-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0" stopColor={s.color} stopOpacity=".28" />
                <stop offset="1" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
            <clipPath id={`${id}-clip`}>
              <rect
                x={left}
                y={0}
                width={right - left + 8}
                height={bottom + 1}
              />
            </clipPath>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((r) => (
            <g key={r}>
              <line
                className="gridline"
                x1={left}
                x2={right}
                y1={top + (bottom - top) * r}
                y2={top + (bottom - top) * r}
              />
              <text
                x={left - 9}
                y={top + (bottom - top) * r + 4}
                textAnchor="end"
              >
                {(hi - (hi - lo) * r).toFixed(
                  metric === "tps" || hi < 5 ? 1 : 0,
                )}
              </text>
            </g>
          ))}
          {threshold !== undefined && threshold >= lo && threshold <= hi && (
            <g>
              <line
                className="threshold"
                x1={left}
                x2={right}
                y1={y(threshold * scale)}
                y2={y(threshold * scale)}
              />
              <text
                className="threshold-label"
                x={right - 4}
                y={y(threshold * scale) - 8}
                textAnchor="end"
              >
                {metric === "tps" ? "Lag below" : "Budget"} {threshold}
                {metric === "mspt" ? " ms" : ""}
              </text>
            </g>
          )}
          <g clipPath={`url(#${id}-clip)`}>
            <g>
              {paths.map(({ s, groups }) => (
                <g key={s.key}>
                  {groups.map(({ path, points }, i) => (
                    <PlotSegment
                      key={i}
                      path={path}
                      points={points}
                      color={s.color}
                      id={`${id}-${s.key}`}
                      area={prefs.chartStyle === "area"}
                      end={live && i === groups.length - 1}
                      bottom={bottom}
                    />
                  ))}
                </g>
              ))}
            </g>
          </g>
          {(width < 400 ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1]).map((r) => (
            <text
              key={r}
              x={left + (right - left) * r}
              y={height - 6}
              textAnchor={r === 0 ? "start" : r === 1 ? "end" : "middle"}
            >
              {present.length
                ? new Date(start + (end - start) * r).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    ...(end - start < 300000 ? { second: "2-digit" } : {}),
                  })
                : r === 0.5
                  ? "Waiting for data"
                  : ""}
            </text>
          ))}
          {nearest && (
            <g>
              <line
                className="crosshair"
                x1={x(nearest.at)}
                x2={x(nearest.at)}
                y1={top}
                y2={bottom}
              />
              {active.map((s) => {
                const sample = nearestFor(s.key);
                return (
                  sample && (
                    <circle
                      key={s.key}
                      cx={x(sample.at)}
                      cy={y(sample[s.key]!)}
                      r={5}
                      fill={s.color}
                      stroke="var(--surface-solid)"
                      strokeWidth={3}
                    />
                  )
                );
              })}
            </g>
          )}
        </svg>
        {!present.length && (
          <div className="inline-empty chart-empty">
            <strong>{copy.no_samples_yet_32176}</strong>
            <span>{copy.metrics_appear_when_the_server_connect_cac63}</span>
          </div>
        )}
      </div>
      {nearest && (
        <div
          className="chart-tooltip"
          style={{
            left: Math.max(0, Math.min(width - 190, x(nearest.at) - 75)),
          }}
        >
          <strong>{new Date(nearest.at).toLocaleTimeString()}</strong>
          {active.map((s) => {
            const sample = nearestFor(s.key);
            return (
              <span
                key={s.key}
                title={
                  sample
                    ? new Date(sample.at).toLocaleTimeString()
                    : "No sample"
                }
              >
                <i style={{ background: s.color }} />
                {s.label}
                <b>
                  {sample
                    ? `${(sample[s.key]! / scale).toFixed(2)} ${bytes ? "GiB" : s.unit}`
                    : "—"}
                </b>
              </span>
            );
          })}
        </div>
      )}
      <p className="sr-only">
        {summary}
        {copy._use_arrow_keys_to_inspect_samples_d2b97}
      </p>
      {table && (
        <div
          className="table-region"
          tabIndex={0}
          aria-label={`${title} sample table`}
        >
          <table>
            <thead>
              <tr>
                <th>{copy.time_6c82e}</th>
                {series.map((s) => (
                  <th key={s.key}>{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {present.slice(-50).map((s) => (
                <tr key={s.at}>
                  <td>{new Date(s.at).toLocaleTimeString()}</td>
                  {series.map((k) => (
                    <td key={k.key}>
                      {typeof s[k.key] === "number"
                        ? (s[k.key]! / scale).toFixed(2)
                        : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <footer className="chart-provenance">
        <span>{source}</span>
        <span>
          {present.length
            ? `${Math.max(1, Math.round((end - start) / 60000))} min of data`
            : "Waiting for data"}
        </span>
        <span>{live ? "Live window" : "History retained"}</span>
      </footer>
    </div>
  );
}

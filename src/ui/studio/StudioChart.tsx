import { useEffect, useId, useRef, useState } from "react";
import {
  usePrefs,
  record,
  fmt,
  time,
  type Sample,
  type Tone,
  type TelemetryView,
} from "../bindings";
import { buildRows, buildTimeTicks, type Row } from "../chart/scales";
import { monotone } from "./geometry";
export type ChartView =
  "tick" | "memory" | "cpu" | "compute" | "gc" | "entities";
export type ChartData = Pick<
  TelemetryView,
  "paper" | "system" | "host" | "service" | "now" | "since"
>;
export function ChartDefs({ prefix }: { prefix: string }) {
  const p = usePrefs(),
    a = p.chartFill ? 0.38 : 0;
  return (
    <defs>
      {(["emerald", "cyan", "violet", "amber", "rose", "indigo"] as const).map(
        (c) => (
          <linearGradient
            key={c}
            id={`${prefix}-grad-${c}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor={`rgb(var(--${c}))`} stopOpacity={a} />
            <stop
              offset="55%"
              stopColor={`rgb(var(--${c}))`}
              stopOpacity={a * 0.35}
            />
            <stop
              offset="100%"
              stopColor={`rgb(var(--${c}))`}
              stopOpacity="0"
            />
          </linearGradient>
        ),
      )}
      <linearGradient id={`${prefix}-band-p95p99`} x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="rgb(var(--violet))" stopOpacity=".25" />
        <stop offset="1" stopColor="rgb(var(--violet))" stopOpacity=".06" />
      </linearGradient>
      <pattern
        id={`${prefix}-hatch-gap`}
        data-def="pp-hatch-gap"
        width="7"
        height="7"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width="7" height="7" fill="rgb(var(--rose)/.035)" />
        <line
          x1="0"
          y1="0"
          x2="0"
          y2="7"
          stroke="rgb(var(--rose)/.3)"
          strokeWidth="1.2"
        />
      </pattern>
      <filter
        id={`${prefix}-glow`}
        x="-10%"
        y="-30%"
        width="120%"
        height="160%"
      >
        <feGaussianBlur stdDeviation="1.8" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}
function segments(rows: Row[], key: string) {
  const result: Row[][] = [];
  let current: Row[] = [];
  for (const r of rows) {
    const prev = current.at(-1);
    if (
      typeof r[key] !== "number" ||
      (prev && (r.epoch !== prev.epoch || r.t - prev.t > 10000))
    ) {
      if (current.length) result.push(current);
      current = [];
    }
    if (typeof r[key] === "number") current.push(r);
  }
  if (current.length) result.push(current);
  return result;
}
export function StudioChart({
  data,
  view = "tick",
  active = "tps",
  crosshair,
  onCrosshair,
  stale = false,
}: {
  data: ChartData;
  view?: ChartView;
  active?: string;
  crosshair?: number | null;
  onCrosshair?: (value: number | null) => void;
  stale?: boolean;
}) {
  const prefs = usePrefs(),
    ref = useRef<HTMLDivElement>(null),
    [size, setSize] = useState({ w: 1000, h: 300 }),
    [hover, setHover] = useState<number | null>(null),
    id = useId().replaceAll(":", ""),
    { w, h } = size;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = new ResizeObserver(([e]) =>
      setSize({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    r.observe(el);
    return () => r.disconnect();
  }, []);
  const rows = buildRows(data.paper),
    system = buildRows(data.system).system.map((row, i, all) =>
      i === 0 || all[i - 1].epoch !== row.epoch || all[i - 1].gc === null
        ? { ...row, gc: null }
        : row,
    ),
    host = buildRows(data.host).host,
    service = buildRows(data.service).service,
    l = 44,
    r = 44,
    top = 16,
    bottom = h - 25,
    pw = Math.max(1, w - l - r),
    ph = Math.max(1, bottom - top),
    x = (at: number) =>
      l + ((at - data.since) / Math.max(1, data.now - data.since)) * pw;
  type Series = {
    key: string;
    label: string;
    tone: Tone;
    rows: Row[];
    max: number;
    min?: number;
  };
  const memoryMax = Math.max(
      1,
      ...system.map((s) => Number(s.max ?? s.committed ?? s.heap ?? 0)),
      ...service.map((s) => Number(s.cgroup ?? 0)),
    ),
    cpuMax = Math.max(100, ...service.map((s) => Number(s.cpu ?? 0))),
    servicePeak = service.some((r) => typeof r.cpu === "number")
      ? Math.max(
          ...service.map((r) =>
            typeof r.cpu === "number" ? r.cpu : -Infinity,
          ),
        )
      : null,
    entityMax = Math.max(
      1,
      ...rows.paper.flatMap((s) => [
        Number(s.chunks ?? 0),
        Number(s.entities ?? 0),
      ]),
    );
  const defs: Record<ChartView, Series[]> = {
      tick: [
        {
          key: "tps",
          label: "TPS",
          tone: "emerald",
          rows: rows.paper,
          max: 20,
          min: 15,
        },
        {
          key: "mspt",
          label: "Mean MSPT",
          tone: "cyan",
          rows: rows.paper,
          max: 60,
        },
        { key: "p95", label: "p95", tone: "violet", rows: rows.paper, max: 60 },
        { key: "p99", label: "p99", tone: "amber", rows: rows.paper, max: 60 },
      ],
      memory: [
        {
          key: "cgroup",
          label: "Cgroup",
          tone: "indigo",
          rows: service,
          max: memoryMax,
        },
        {
          key: "committed",
          label: "Committed",
          tone: "violet",
          rows: system,
          max: memoryMax,
        },
        {
          key: "heap",
          label: "Heap used",
          tone: "violet",
          rows: system,
          max: memoryMax,
        },
      ],
      compute: [
        {
          key: "cpu",
          label: "Service CPU",
          tone: "indigo",
          rows: service,
          max: cpuMax,
        },
        {
          key: "node",
          label: "Node CPU",
          tone: "cyan",
          rows: host,
          max: cpuMax,
        },
      ],
      cpu: [
        {
          key: "cpu",
          label: "Service CPU",
          tone: "indigo",
          rows: service,
          max: cpuMax,
        },
        {
          key: "node",
          label: "Node CPU",
          tone: "cyan",
          rows: host,
          max: cpuMax,
        },
        {
          key: "peak",
          label: "Service peak",
          tone: "amber",
          rows: service.map((r) => ({
            ...r,
            peak: typeof r.cpu === "number" ? servicePeak : null,
          })),
          max: cpuMax,
        },
        {
          key: "chunks",
          label: "Chunks",
          tone: "emerald",
          rows: rows.paper,
          max: entityMax,
        },
        {
          key: "entities",
          label: "Entities",
          tone: "violet",
          rows: rows.paper,
          max: entityMax,
        },
      ],
      gc: [
        {
          key: "gc",
          label: "GC Δ ms",
          tone: "rose",
          rows: system,
          max: Math.max(10, ...system.map((s) => Number(s.gc ?? 0))),
        },
      ],
      entities: [
        {
          key: "chunks",
          label: "Chunks",
          tone: "cyan",
          rows: rows.paper,
          max: entityMax,
        },
        {
          key: "entities",
          label: "Entities",
          tone: "violet",
          rows: rows.paper,
          max: entityMax,
        },
      ],
    },
    series = defs[view];
  const y = (value: number, s: Series) =>
    bottom -
    ((Math.min(s.max, Math.max(s.min ?? 0, value)) - (s.min ?? 0)) /
      Math.max(1, s.max - (s.min ?? 0))) *
      ph;
  const cursor = crosshair === undefined ? hover : crosshair;
  const nearestRow =
    cursor == null
      ? null
      : series[0].rows.reduce<Row | null>(
          (a, p) =>
            typeof p[series[0].key] !== "number"
              ? a
              : !a || Math.abs(p.t - cursor) < Math.abs(a.t - cursor)
                ? p
                : a,
          null,
        );
  const sampleAt = nearestRow?.t ?? null;
  const readoutSeries =
    view === "tick"
      ? [
          ...series,
          {
            key: "gc",
            label: "GC Δ ms",
            tone: "rose" as Tone,
            rows: system,
            max: 100,
          },
        ]
      : series;
  const cx = sampleAt == null ? null : x(sampleAt),
    ticks = buildTimeTicks(
      data.since,
      data.now,
      (t, seconds) => time(t, prefs.timezone, seconds),
      w < 500 ? 3 : 7,
    );
  const uniqueGaps = rows.gaps;
  return (
    <div
      ref={ref}
      className="pp-chart pp-well"
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect(),
          at =
            data.since +
            Math.max(0, Math.min(1, (e.clientX - rect.left - l) / pw)) *
              (data.now - data.since);
        setHover(at);
        onCrosshair?.(at);
      }}
      onPointerLeave={() => {
        setHover(null);
        onCrosshair?.(null);
      }}
    >
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`${view} telemetry; ${data.paper.length} samples. ${series.map((s) => `${s.label} range ${fmt(Math.min(...s.rows.filter((r) => typeof r[s.key] === "number").map((r) => Number(r[s.key]))))} to ${fmt(Math.max(...s.rows.filter((r) => typeof r[s.key] === "number").map((r) => Number(r[s.key]))))}`).join("; ")}`}
      >
        <ChartDefs prefix={id} />
        <defs>
          <clipPath id={`${id}-clip`}>
            <rect x={l} y={top} width={pw} height={ph} />
          </clipPath>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line
              x1={l}
              x2={w - r}
              y1={top + ph * f}
              y2={top + ph * f}
              stroke="rgb(var(--line)/.07)"
            />
            <text
              x={w - r + 9}
              y={top + ph * f + 3}
              fontSize="9"
              fill="rgb(var(--faint))"
            >
              {fmt(
                (view === "tick"
                  ? 60
                  : view === "cpu"
                    ? entityMax
                    : series[0].max) *
                  (1 - f),
                0,
              )}
            </text>
            {view === "tick" && (f === 0 || f === 1) && (
              <text
                x={l - 9}
                y={top + ph * f + 3}
                textAnchor="end"
                fontSize="9"
                fill="rgb(var(--emerald))"
              >
                {f === 0 ? "20" : "15"}
              </text>
            )}
          </g>
        ))}
        {ticks.ticks.map((t) => (
          <g key={t}>
            <line
              x1={x(t)}
              x2={x(t)}
              y1={top}
              y2={bottom}
              stroke="rgb(var(--line)/.035)"
            />
            <text
              x={x(t)}
              y={h - 7}
              textAnchor="middle"
              fontSize="9"
              fill="rgb(var(--faint))"
            >
              {time(t, prefs.timezone, ticks.withSeconds)}
            </text>
          </g>
        ))}
        <g clipPath={`url(#${id}-clip)`}>
          {uniqueGaps.map((g) => (
            <g key={g.id}>
              <rect
                data-gap="true"
                x={x(g.from)}
                y={top}
                width={Math.max(2, x(g.to) - x(g.from))}
                height={ph}
                fill={`url(#${id}-hatch-gap)`}
              />
              <line
                x1={x(g.to)}
                x2={x(g.to)}
                y1={top}
                y2={bottom}
                stroke="rgb(var(--rose)/.45)"
                strokeDasharray="3 4"
              />
              <text
                x={x(g.to) + 5}
                y={top + 12}
                fontSize="9"
                fill="rgb(var(--muted))"
              >
                restart · epoch{" "}
                {rows.paper.find((s) => s.t >= g.to)?.epoch.slice(0, 8)}
              </text>
            </g>
          ))}
          {view === "tick" &&
            segments(rows.paper, "p95").flatMap((seg, i) => {
              const valid = seg.filter((s) => typeof s.p99 === "number");
              if (!valid.length) return [];
              const lower = valid.map((p) => ({
                  x: x(p.t),
                  y: y(Number(p.p95), series[2]),
                })),
                upper = [...valid]
                  .reverse()
                  .map((p) => ({ x: x(p.t), y: y(Number(p.p99), series[3]) }));
              return (
                <path
                  key={i}
                  data-band="p95-p99"
                  d={`${monotone(lower)}L${upper.map((p) => `${p.x},${p.y}`).join("L")}Z`}
                  fill={`url(#${id}-band-p95p99)`}
                />
              );
            })}
          {series.map((s) =>
            segments(s.rows, s.key).map((seg, i) => {
              const points = seg.map((p) => ({
                  x: x(p.t),
                  y: y(Number(p[s.key]), s),
                })),
                line = monotone(points),
                isActive =
                  active === s.key || (active === "mean" && s.key === "mspt");
              return (
                <g
                  key={`${s.key}-${i}`}
                  opacity={stale ? 0.55 : isActive ? 1 : 0.55}
                >
                  <path
                    data-area={s.key}
                    d={`${line}L${points.at(-1)!.x},${bottom}L${points[0].x},${bottom}Z`}
                    fill={`url(#${id}-grad-${s.tone})`}
                  />
                  {view === "gc" ? (
                    points.map((p, i) => (
                      <line
                        key={i}
                        x1={p.x}
                        x2={p.x}
                        y1={bottom}
                        y2={p.y}
                        stroke="rgb(var(--rose))"
                        strokeWidth="2"
                      />
                    ))
                  ) : (
                    <path
                      data-series={s.key}
                      data-epoch={seg[0].epoch}
                      data-from={seg[0].t}
                      data-to={seg.at(-1)!.t}
                      d={line}
                      fill="none"
                      stroke={`rgb(var(--${s.tone}))`}
                      strokeWidth={isActive ? 1.8 : 1.4}
                      vectorEffect="non-scaling-stroke"
                      className="pp-chart-line"
                      filter={isActive ? `url(#${id}-glow)` : undefined}
                    />
                  )}
                </g>
              );
            }),
          )}
          {view === "memory" && (
            <line
              data-memory-limit="true"
              x1={l}
              x2={w - r}
              y1={y(
                Number(
                  system.find((s) => typeof s.max === "number")?.max ??
                    memoryMax,
                ),
                series[0],
              )}
              y2={y(
                Number(
                  system.find((s) => typeof s.max === "number")?.max ??
                    memoryMax,
                ),
                series[0],
              )}
              stroke="rgb(var(--violet)/.5)"
              strokeDasharray="4 4"
            />
          )}
          {view === "tick" && (
            <g data-budget="50">
              <line
                x1={l}
                x2={w - r}
                y1={y(50, series[1])}
                y2={y(50, series[1])}
                stroke="rgb(var(--amber)/.65)"
                strokeDasharray="5 5"
              />
              <text
                x={l + 5}
                y={y(50, series[1]) - 6}
                fontSize="9"
                fill="rgb(var(--amber))"
              >
                50 ms budget
              </text>
            </g>
          )}
          {cx != null && (
            <line
              x1={cx}
              x2={cx}
              y1={top}
              y2={bottom}
              stroke="rgb(var(--line)/.45)"
            />
          )}
        </g>
      </svg>
      {stale && (
        <div className="pp-chart-status">
          Paper telemetry stale — showing last known window
        </div>
      )}
      {!series.some((s) =>
        s.rows.some((r) => typeof r[s.key] === "number"),
      ) && <div className="pp-chart-status">Waiting for telemetry samples</div>}
      {sampleAt != null && cx != null && (
        <div
          className="pp-chart-readout"
          style={{ left: Math.max(4, Math.min(w - 200, cx + 12)), top: 35 }}
        >
          <b>{time(sampleAt, prefs.timezone)}</b>
          <dl>
            {readoutSeries.map((s) => {
              const values = s.rows.filter((p) => typeof p[s.key] === "number"),
                row =
                  sampleAt == null
                    ? null
                    : values.reduce<Row | null>(
                        (a, p) =>
                          !a ||
                          Math.abs(p.t - sampleAt) < Math.abs(a.t - sampleAt)
                            ? p
                            : a,
                        null,
                      );
              return (
                <div key={s.key}>
                  <dt>{s.label}</dt>
                  <dd>
                    {fmt(
                      view === "tick" && s.key !== "gc"
                        ? (record(data.paper.find((p) => p.at === row?.t))[
                            s.key
                          ] ?? row?.[s.key])
                        : row?.[s.key],
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}
      <table className="sr-only">
        <caption>Latest twenty telemetry samples</caption>
        <thead>
          <tr>
            {["Time", "TPS", "Mean MSPT", "p95", "p99"].map((k) => (
              <th key={k}>{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.paper.slice(-20).map((p, i) => (
            <tr key={i}>
              <td>{time(p.at, prefs.timezone)}</td>
              <td>{fmt(p.tps)}</td>
              <td>{fmt(p.mspt)}</td>
              <td>{fmt(p.p95)}</td>
              <td>{fmt(p.p99)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

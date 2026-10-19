import { useEffect, useId, useRef, useState } from "react";
import {
  usePrefs,
  record,
  fmt,
  time,
  type Tone,
  type TelemetryView,
} from "../bindings";
import { buildRows, buildTimeTicks, type Row } from "../chart/scales";
import { monotone } from "./geometry";
import {
  adaptiveMsptMax,
  stageBounds,
  scaleInStage,
  gapLabelPositions,
  type StageBounds,
} from "./stages";
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
type Gap = { from: number; to: number };
function segments(rows: Row[], key: string, gaps: Gap[]) {
  const result: Row[][] = [];
  let current: Row[] = [];
  for (const row of rows) {
    const previous = current.at(-1),
      inGap = gaps.some((g) => row.t > g.from && row.t < g.to);
    if (
      typeof row[key] !== "number" ||
      inGap ||
      (previous &&
        (row.epoch !== previous.epoch ||
          row.t - previous.t > 10000 ||
          gaps.some((g) => previous.t <= g.from && row.t >= g.to)))
    ) {
      if (current.length) result.push(current);
      current = [];
    }
    if (typeof row[key] === "number" && !inGap) current.push(row);
  }
  if (current.length) result.push(current);
  return result;
}
type Series = {
  key: string;
  label: string;
  tone: Tone;
  rows: Row[];
  max: number;
  min?: number;
};
type Stage = { label: string; series: Series[]; bounds: StageBounds };
export function StudioChart({
  data,
  view = "tick",
  active = "tps",
  staged = true,
  crosshair,
  onCrosshair,
  stale = false,
}: {
  data: ChartData;
  view?: ChartView;
  active?: string;
  staged?: boolean;
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
    if (!ref.current) return;
    const observer = new ResizeObserver(([e]) =>
      setSize({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const rows = buildRows(data.paper, Infinity),
    system = buildRows(data.system).system.map((row, i, all) =>
      i === 0 || all[i - 1].epoch !== row.epoch || all[i - 1].gc === null
        ? { ...row, gc: null }
        : row,
    ),
    host = buildRows(data.host).host,
    service = buildRows(data.service).service,
    l = w < 500 ? 30 : 44,
    r = w < 500 ? 30 : 44,
    top = 8,
    bottom = h - 25,
    pw = Math.max(1, w - l - r),
    ph = Math.max(1, bottom - top),
    x = (at: number) =>
      l + ((at - data.since) / Math.max(1, data.now - data.since)) * pw,
    maximum = (rs: Row[], keys: string[], floor: number) =>
      Math.max(
        floor,
        ...rs.flatMap((s) =>
          keys.map((k) => (typeof s[k] === "number" ? Number(s[k]) : 0)),
        ),
      ),
    memoryMax = Math.max(
      maximum(system, ["max", "committed", "heap"], 1),
      maximum(service, ["cgroup"], 1),
    ),
    heapMax = maximum(system, ["committed", "max", "heap"], 1),
    cpuMax = Math.max(
      maximum(service, ["cpu"], 100),
      maximum(host, ["node"], 100),
    ),
    servicePeak = service.some((s) => typeof s.cpu === "number")
      ? maximum(service, ["cpu"], 0)
      : null,
    entityMax = maximum(rows.paper, ["chunks", "entities"], 1),
    msptMax = adaptiveMsptMax(
      rows.paper.flatMap((s) => [s.mspt, s.p95, s.p99]),
    ),
    gcMax = maximum(system, ["gc"], 0) * 1.2,
    item = (
      key: string,
      label: string,
      tone: Tone,
      rs: Row[],
      max: number,
      min = 0,
    ): Series => ({ key, label, tone, rows: rs, max, min }),
    tps = item("tps", "TPS", "emerald", rows.paper, 20, 15),
    envelope = [
      item("mspt", "Mean MSPT", "cyan", rows.paper, msptMax),
      item("p95", "p95", "violet", rows.paper, msptMax),
      item("p99", "p99", "amber", rows.paper, msptMax),
    ],
    gc = item("gc", "GC Δ ms", "rose", system, Math.max(5, gcMax)),
    heap = item("heap", "Heap used", "violet", system, heapMax),
    committed = item("committed", "Committed", "cyan", system, memoryMax),
    cgroup = item("cgroup", "Cgroup", "indigo", service, memoryMax),
    compute = [
      item("cpu", "Service CPU", "indigo", service, cpuMax),
      item("node", "Node CPU", "cyan", host, cpuMax),
    ],
    peak = item(
      "peak",
      "Service peak",
      "amber",
      service.map((s) => ({
        ...s,
        peak: typeof s.cpu === "number" ? servicePeak : null,
      })),
      cpuMax,
    ),
    counts = [
      item("chunks", "Chunks", "emerald", rows.paper, entityMax),
      item("entities", "Entities", "violet", rows.paper, entityMax),
    ],
    isStaged = staged && ["tick", "memory", "cpu"].includes(view);
  const groups =
    view === "tick"
      ? [[tps], envelope, [gc]]
      : view === "memory"
        ? [[heap], [committed], [cgroup]]
        : view === "cpu"
          ? [[...compute, peak], counts]
          : view === "compute"
            ? [compute]
            : view === "gc"
              ? [[gc]]
              : [counts];
  const labels =
    view === "tick"
      ? ["TPS", "MSPT (MEAN / P95–P99)", "GC Δ"]
      : view === "memory"
        ? ["JVM HEAP USED", "JVM COMMITTED", "SERVICE CGROUP"]
        : view === "cpu"
          ? ["COMPUTE LOAD (%)", "WORLD LOAD (COUNT)"]
          : [""];
  const bounds = isStaged
    ? stageBounds(
        top,
        bottom,
        view === "tick" ? [26, 52, 22] : view === "cpu" ? [52, 48] : [1, 1, 1],
      )
    : [{ top, bottom, plotTop: top + 7, plotBottom: bottom }];
  const stages: Stage[] = isStaged
    ? groups.map((series, i) => ({
        label: labels[i],
        series,
        bounds: bounds[i],
      }))
    : [
        {
          label: "",
          series: groups
            .flat()
            .filter((s) => view !== "tick" || s.key !== "gc"),
          bounds: bounds[0],
        },
      ];
  const series = stages.flatMap((s) => s.series),
    cursor = crosshair === undefined ? hover : crosshair,
    nearest =
      cursor == null
        ? null
        : series
            .flatMap((s) => s.rows.filter((r) => typeof r[s.key] === "number"))
            .reduce<Row | null>(
              (a, p) =>
                !a || Math.abs(p.t - cursor) < Math.abs(a.t - cursor) ? p : a,
              null,
            ),
    sampleAt = nearest?.t ?? null,
    cx = sampleAt == null ? null : x(sampleAt),
    ticks = buildTimeTicks(
      data.since,
      data.now,
      (t, seconds) => time(t, prefs.timezone, seconds),
      w < 500 ? 3 : 7,
    ),
    uniqueGaps = rows.gaps,
    gapLabels = gapLabelPositions(uniqueGaps.map((g) => x(g.to))),
    hasFocus = series.some(
      (s) => s.key === active || (active === "max" && s.key === "cgroup"),
    );
  return (
    <div
      ref={ref}
      className="pp-chart pp-well"
      data-staged={isStaged}
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
        aria-label={`${view} telemetry; ${data.paper.length} samples. ${isStaged ? `${stages.length} separate stages.` : ""} ${series.map((s) => `${s.label} range ${s.min ?? 0} to ${fmt(s.max)}`).join("; ")}`}
      >
        <ChartDefs prefix={id} />
        <defs>
          <clipPath id={`${id}-clip`}>
            <rect x={l} y={top} width={pw} height={ph} />
          </clipPath>
        </defs>
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
        {stages.map((stage, stageIndex) => {
          const b = stage.bounds,
            focused = stage.series.some(
              (s) =>
                s.key === active || (active === "max" && s.key === "cgroup"),
            ),
            y = (value: number, s: Series) =>
              scaleInStage(value, s.min ?? 0, s.max, b);
          return (
            <g
              key={stageIndex}
              data-stage={stageIndex + 1}
              data-stage-top={b.plotTop}
              data-stage-bottom={b.plotBottom}
              opacity={stale ? 0.55 : !hasFocus || focused ? 1 : 0.78}
            >
              {isStaged && (
                <>
                  <line
                    x1={l}
                    x2={w - r}
                    y1={b.top}
                    y2={b.top}
                    stroke="rgb(var(--line)/.12)"
                  />
                  <text
                    x={l + 6}
                    y={b.top + 11}
                    className="pp-stage-label"
                    fill="rgb(var(--muted))"
                  >
                    STAGE {String(stageIndex + 1).padStart(2, "0")} ·{" "}
                    {stage.label}
                  </text>
                </>
              )}
              {[0, 0.5, 1].map((f) => (
                <g key={f}>
                  <line
                    x1={l}
                    x2={w - r}
                    y1={b.plotTop + (b.plotBottom - b.plotTop) * f}
                    y2={b.plotTop + (b.plotBottom - b.plotTop) * f}
                    stroke="rgb(var(--line)/.06)"
                  />
                  <text
                    x={w - r + 6}
                    y={b.plotTop + (b.plotBottom - b.plotTop) * f + 3}
                    fontSize="9"
                    fill="rgb(var(--faint))"
                  >
                    {fmt(
                      (stage.series[0].min ?? 0) +
                        (stage.series[0].max - (stage.series[0].min ?? 0)) *
                          (1 - f),
                      stage.series[0].max < 5 ? 1 : 0,
                    )}
                  </text>
                </g>
              ))}
              <g clipPath={`url(#${id}-clip)`}>
                {view === "tick" &&
                  stage.series.some((s) => s.key === "p95") &&
                  segments(rows.paper, "p95", uniqueGaps).flatMap((seg, i) => {
                    // A missing bound starts a new band too; never bridge an unavailable sample.
                    return segments(seg, "p99", uniqueGaps).map((valid, j) => {
                      const lower = valid.map((p) => ({
                          x: x(p.t),
                          y: y(Number(p.p95), envelope[1]),
                        })),
                        upper = [...valid]
                          .reverse()
                          .map((p) => ({
                            x: x(p.t),
                            y: y(Number(p.p99), envelope[2]),
                          }));
                      return (
                        <path
                          key={`${i}-${j}`}
                          data-band="p95-p99"
                          d={`${monotone(lower)}L${upper.map((p) => `${p.x},${p.y}`).join("L")}Z`}
                          fill={`url(#${id}-band-p95p99)`}
                        />
                      );
                    });
                  })}
                {stage.series.map((s) =>
                  segments(s.rows, s.key, uniqueGaps).map((seg, i) => {
                    const points = seg.map((p) => ({
                        x: x(p.t),
                        y: y(Number(p[s.key]), s),
                      })),
                      line = monotone(points),
                      isActive = active === s.key;
                    return (
                      <g key={`${s.key}-${i}`}>
                        {s.key !== "gc" && s.key !== "peak" && (
                          <path
                            data-area={s.key}
                            d={`${line}L${points.at(-1)!.x},${b.plotBottom}L${points[0].x},${b.plotBottom}Z`}
                            fill={`url(#${id}-grad-${s.tone})`}
                          />
                        )}
                        {s.key === "gc" ? (
                          points.map((p, j) => (
                            <line
                              key={j}
                              data-impulse="gc"
                              x1={p.x}
                              x2={p.x}
                              y1={b.plotBottom}
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
                            strokeDasharray={
                              s.key === "peak" ? "4 4" : undefined
                            }
                            vectorEffect="non-scaling-stroke"
                            className="pp-chart-line"
                            filter={isActive ? `url(#${id}-glow)` : undefined}
                          />
                        )}
                      </g>
                    );
                  }),
                )}
                {view === "memory" && (!isStaged || stageIndex === 2) && (
                  <line
                    data-memory-limit="true"
                    x1={l}
                    x2={w - r}
                    y1={y(maximum(system, ["max"], memoryMax), cgroup)}
                    y2={y(maximum(system, ["max"], memoryMax), cgroup)}
                    stroke="rgb(var(--violet)/.6)"
                    strokeDasharray="4 4"
                  />
                )}
                {view === "tick" &&
                  stage.series.some((s) => s.key === "mspt") && (
                    <g data-budget="50">
                      <line
                        x1={l}
                        x2={w - r}
                        y1={msptMax >= 45 ? y(50, envelope[0]) : b.plotTop + 2}
                        y2={msptMax >= 45 ? y(50, envelope[0]) : b.plotTop + 2}
                        stroke="rgb(var(--amber)/.6)"
                        strokeDasharray="5 5"
                      />
                      <text
                        x={l + 5}
                        y={
                          (msptMax >= 45 ? y(50, envelope[0]) : b.plotTop + 2) +
                          11
                        }
                        fontSize="9"
                        fill="rgb(var(--amber))"
                      >
                        {msptMax >= 45
                          ? "50 ms budget"
                          : `50 ms budget · scale 0–${msptMax} ms`}
                      </text>
                    </g>
                  )}
              </g>
            </g>
          );
        })}
        <g clipPath={`url(#${id}-clip)`}>
          {uniqueGaps.map((g, i) => (
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
              {gapLabels[i] && (
                <text
                  data-epoch-label="true"
                  x={x(g.to) + 5}
                  y={bottom - 4}
                  fontSize="9"
                  fill="rgb(var(--muted))"
                >
                  restart · epoch{" "}
                  {rows.paper.find((s) => s.t >= g.to)?.epoch.slice(0, 8)}
                </text>
              )}
            </g>
          ))}
          {cx != null && (
            <line
              data-crosshair="true"
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
            {(view === "tick" && !isStaged ? [...series, gc] : series).map(
              (s) => {
                const row = s.rows
                  .filter((p) => typeof p[s.key] === "number")
                  .reduce<Row | null>(
                    (a, p) =>
                      !a || Math.abs(p.t - sampleAt) < Math.abs(a.t - sampleAt)
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
              },
            )}
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

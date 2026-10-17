"use client";
import {
  createContext,
  memo,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import uPlot from "uplot";
import { records, type Sample } from "../../adapter/control-state";
import { usePlotHistory } from "../../presentation/PlotHistory";
import { sourceFor } from "../../presentation/telemetry";
import { canvasData, type CanvasSeries } from "../../presentation/canvas-data";
import { usePreferences } from "../../store/preferences";
import { useSession } from "../../hooks";
export type ChartEvidence = {
  capturedAt: string | null;
  receivedAt: number | null;
  cadence: number | null;
  label: string;
};
type Group = {
  key: string;
  plots: Set<uPlot>;
  zoom: [number, number] | null;
  applying: boolean;
};
const Crosshair = createContext<Group | null>(null);
export function CrosshairGroup({ children }: { children: ReactNode }) {
  const key = useId(),
    value = useMemo<Group>(
      () => ({ key, plots: new Set(), zoom: null, applying: false }),
      [key],
    );
  return <Crosshair.Provider value={value}>{children}</Crosshair.Provider>;
}
export const TimeSeries = memo(function TimeSeries({
  samples,
  series,
  yMin = 0,
  yMax,
  threshold,
  title,
  source = "Paper",
  height = 230,
  mobileHeight,
  evidence,
  windowStart = -Infinity,
}: {
  samples: Sample[];
  series: CanvasSeries[];
  yMin?: number;
  yMax?: number;
  threshold?: number;
  title: string;
  source?: string;
  height?: number;
  mobileHeight?: number;
  evidence?: ChartEvidence;
  windowStart?: number;
}) {
  const prefs = usePreferences(),
    snap = useSession(),
    histories = usePlotHistory(samples),
    group = useContext(Crosshair),
    element = useRef<HTMLDivElement>(null),
    plot = useRef<uPlot | null>(null),
    [visible, setVisible] = useState(true),
    [table, setTable] = useState(false);
  const signature = JSON.stringify(series),
    expanded = useMemo(
      () =>
        series.some((s) => s.key === "mspt") &&
        !series.some((s) => s.key === "msptP99")
          ? [
              ...series,
              {
                key: "msptP95" as const,
                label: "p95",
                color: "var(--chart-2)",
                unit: "ms",
              },
              {
                key: "msptP99" as const,
                label: "p99",
                color: "var(--chart-3)",
                unit: "ms",
              },
            ]
          : series,
      [signature],
    );
  const epoch = `${snap.revision}:${snap.state.bootEpochId}:${snap.state.ready?.server.paperSession}:${snap.state.ready?.server.hostSession}:${snap.state.ready?.agents.paper}:${snap.state.ready?.agents.host}`,
    epochSeen = useRef(epoch);
  const retainedProjection = useRef<ReturnType<typeof canvasData>>({
    data: [[], ...expanded.map(() => [])],
    events: [],
  });
  const sourceProjection = useRef<{
    epoch: string;
    windowStart: number;
    signature: string;
    payloads: unknown[];
    first: (number | null | undefined)[];
    result: ReturnType<typeof canvasData>;
  } | null>(null);
  const projected = useMemo<ReturnType<typeof canvasData>>(() => {
    if (!visible)
      return epochSeen.current === epoch
        ? retainedProjection.current
        : { data: [[], ...expanded.map(() => [])], events: [] };
    const sources = [...new Set(expanded.map((item) => sourceFor[item.key]))];
    const payloads = sources.map(
      (source) =>
        ({
          paperHealth: snap.state.server,
          paperSystem: snap.state.system,
          hostSystem: snap.state.hostSystem,
          service: snap.state.service.resources,
        })[source],
    );
    const first = sources.map((source) => {
      const row = (histories?.[source] ?? samples)[0];
      return row?.sources ? row.sources[source] : row?.at;
    });
    const previous = sourceProjection.current;
    // Another producer's packet cannot change an unchanged source's curve.
    // Earliest retained capture, window and epoch still invalidate this reuse.
    if (
      samples === snap.state.history &&
      previous &&
      previous.epoch === epoch &&
      previous.windowStart === windowStart &&
      previous.signature === signature &&
      payloads.every((value, i) => value === previous.payloads[i]) &&
      first.every((value, i) => value === previous.first[i])
    ) {
      retainedProjection.current = previous.result;
      return previous.result;
    }
    const result = canvasData(histories ?? {}, samples, expanded, windowStart);
    sourceProjection.current = {
      epoch,
      windowStart,
      signature,
      payloads,
      first,
      result,
    };
    retainedProjection.current = result;
    return result;
  }, [histories, samples, expanded, windowStart, visible, epoch]);
  const latest = useRef(projected);
  latest.current = projected;
  const presence = useRef(snap.state.presenceDeltas);
  presence.current = snap.state.presenceDeltas;
  const operations = useRef(snap.state.sessionEvents?.serverEvents);
  operations.current = snap.state.sessionEvents?.serverEvents;
  const drawnStamp = useRef("");
  useEffect(() => {
    const el = element.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "100px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const el = element.current;
    if (!el) return;
    const style = getComputedStyle(document.documentElement),
      color = (s: string) =>
        s.replace(/var\(([^)]+)\)/g, (_, name) =>
          style.getPropertyValue(name).trim(),
        );
    const axisFont = `${Math.round({ small: 14, standard: 16, large: 18 }[prefs.textSize] * 0.7)}px monospace`;
    const bytes = expanded.every((s) => s.unit === "bytes"),
      format = (v: number) =>
        bytes ? `${(v / 2 ** 30).toFixed(1)}G` : v.toFixed(1);
    const data = [...latest.current.data] as typeof projected.data;
    if (threshold !== undefined) data.push(data[0].map(() => threshold));
    const p95 = expanded.findIndex((s) => s.key === "msptP95") + 1,
      p99 = expanded.findIndex((s) => s.key === "msptP99") + 1;
    const options: uPlot.Options = {
      width: Math.max(220, el.clientWidth),
      height:
        el.clientWidth < 420 ? (mobileHeight ?? Math.min(height, 220)) : height,
      cursor: {
        sync: group ? { key: group.key } : undefined,
        drag: { x: true, y: false },
      },
      select: { show: true, left: 0, top: 0, width: 0, height: 0 },
      legend: { show: true },
      scales: {
        x: { time: true },
        y: {
          auto: true,
          range: (_u, min, max) => [
            Math.min(yMin, min ?? yMin),
            Math.max(yMax ?? 0, max ?? 1, threshold ?? 0, 1) * 1.08,
          ],
        },
      },
      axes: [
        {
          stroke: color("var(--faint)"),
          grid: { show: false },
          font: axisFont,
          size: 42,
        },
        {
          stroke: color("var(--faint)"),
          grid: { stroke: color("var(--line)"), width: 1 },
          font: axisFont,
          size: 44,
          values: (_u, ticks) => ticks.map(format),
        },
      ],
      series: [
        {},
        ...expanded.map((s) => ({
          label: s.label,
          stroke: color(s.color),
          width: 1.25,
          spanGaps: false,
          points: { show: false },
          value: (_u: uPlot, v: number | null) => (v == null ? "—" : format(v)),
        })),
        ...(threshold === undefined
          ? []
          : [
              {
                label: `${threshold} ms reference`,
                stroke: color("var(--warning)"),
                width: 1,
                dash: [4, 4],
                points: { show: false },
              },
            ]),
      ],
      bands:
        p95 > 0 && p99 > 0
          ? [{ series: [p99, p95], fill: color("var(--chart-2)") + "22" }]
          : [],
      tzDate:
        prefs.timezone === "UTC"
          ? (ts) => uPlot.tzDate(new Date(ts * 1000), "Etc/UTC")
          : undefined,
      hooks: {
        setSelect: [
          (u) => {
            if (!group || group.applying || u.select.width < 8) return;
            const min = u.posToVal(u.select.left, "x"),
              max = u.posToVal(u.select.left + u.select.width, "x");
            if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min)
              return;
            group.zoom = [min, max];
            group.applying = true;
            try {
              for (const other of group.plots)
                if (other !== u) other.setScale("x", { min, max });
            } finally {
              group.applying = false;
            }
          },
        ],
        draw: [
          (u) => {
            const ctx = u.ctx;
            ctx.save();
            ctx.strokeStyle = color("var(--chart-2)");
            ctx.globalAlpha = 0.55;
            const marks = [
              ...latest.current.events,
              ...records(operations.current, 100).map(
                (event) => Date.parse(String(event.capturedAt)) / 1000,
              ),
              ...(presence.current ?? [])
                .slice(-100)
                .map((e) => Date.parse(String(e.observedAt)) / 1000),
            ];
            const pixels = new Set<number>();
            for (const at of marks) {
              if (
                !Number.isFinite(at) ||
                at < (u.scales.x.min ?? 0) ||
                at > (u.scales.x.max ?? 0)
              )
                continue;
              const x = Math.round(u.valToPos(at, "x", true));
              if (pixels.has(x)) continue;
              pixels.add(x);
              ctx.beginPath();
              ctx.moveTo(x, u.bbox.top);
              ctx.lineTo(x, u.bbox.top + 8);
              ctx.stroke();
            }
            ctx.restore();
          },
        ],
      },
    };
    const dual =
      expanded.some((item) => item.unit === "TPS") &&
      expanded.some((item) => item.unit === "ms");
    if (dual) {
      options.scales!.tps = { range: () => [0, 20] };
      options.scales!.mspt = {
        range: (_u, _min, max) => [0, Math.max(50, max ?? 0) * 1.08],
      };
      expanded.forEach((item, index) => {
        options.series[index + 1].scale = item.unit === "TPS" ? "tps" : "mspt";
      });
      if (threshold !== undefined) options.series.at(-1)!.scale = "mspt";
      options.axes![1].scale = "tps";
      options.axes!.push({
        ...options.axes![1],
        scale: "mspt",
        side: 1,
        label: "ms",
        labelSize: 12,
        grid: { show: false },
      });
    }
    if (prefs.chartFill && expanded.length === 1)
      options.series[1].fill = color(expanded[0].color) + "0a";
    if (!prefs.chartFill) options.bands = [];
    const chart = new uPlot(options, data, el);
    plot.current = chart;
    drawnStamp.current = "";
    group?.plots.add(chart);
    const observer = new ResizeObserver(() =>
      chart.setSize({
        width: Math.max(220, el.clientWidth),
        height:
          el.clientWidth < 420
            ? (mobileHeight ?? Math.min(height, 220))
            : height,
      }),
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      group?.plots.delete(chart);
      chart.destroy();
      plot.current = null;
    };
  }, [
    expanded,
    threshold,
    yMin,
    yMax,
    height,
    mobileHeight,
    prefs.theme,
    prefs.accent,
    prefs.timezone,
    prefs.textSize,
    prefs.chartFill,
    group,
  ]);
  useEffect(() => {
    const chart = plot.current;
    if (!chart) return;
    if (epochSeen.current !== epoch) {
      epochSeen.current = epoch;
      if (group) group.zoom = null;
      if (!visible) {
        retainedProjection.current = {
          data: [[], ...expanded.map(() => [])],
          events: [],
        };
        latest.current = retainedProjection.current;
      }
      chart.setData([[], ...expanded.map(() => [])]);
    }
    if (!visible) return;
    const stamp = JSON.stringify([
      epoch,
      windowStart,
      threshold,
      presence.current?.at(-1)?.eventId,
      records(operations.current, 100).at(0)?.eventId,
      ...projected.data.map((row) => [row.length, row[0], row.at(-1)]),
    ]);
    if (drawnStamp.current === stamp) return;
    drawnStamp.current = stamp;
    const data = [...projected.data] as typeof projected.data;
    if (threshold !== undefined) data.push(data[0].map(() => threshold));
    if (group) group.applying = true;
    try {
      chart.setData(data);
      if (group?.zoom)
        chart.setScale("x", { min: group.zoom[0], max: group.zoom[1] });
    } finally {
      if (group) group.applying = false;
    }
  }, [projected, visible, epoch, expanded, threshold, group]);
  const rawEvidence = useMemo(
    () =>
      table
        ? canvasData(histories ?? {}, samples, expanded, windowStart, false)
            .data
        : projected.data,
    [table, histories, samples, expanded, windowStart, projected],
  );
  const n = rawEvidence[0].length,
    rawIndexes = Array.from(
      { length: Math.min(50, n) },
      (_, i) => n - Math.min(50, n) + i,
    );
  return (
    <section className="v5-chart" aria-label={title}>
      <header className="v5-chart-head">
        <div>
          <span>{source}</span>
          <br />
          <strong>{title}</strong>
        </div>
        <span>{evidence?.label ?? "Capture time"}</span>
      </header>
      <div
        className="v5-chart-canvas"
        ref={element}
        role="img"
        aria-label={`${title}. ${n} retained source observations. Raw evidence table available below.`}
      />
      <footer className="v5-chart-footer">
        <span>Drag to zoom · GC / presence / operation markers</span>
        <button aria-expanded={table} onClick={() => setTable((v) => !v)}>
          Raw evidence
        </button>
        <button
          onClick={() => {
            if (group) {
              group.zoom = null;
              group.applying = true;
              try {
                for (const chart of group.plots) chart.setData(chart.data);
              } finally {
                group.applying = false;
              }
            }
          }}
        >
          Reset zoom
        </button>
      </footer>
      {table ? (
        <div className="v5-chart-table">
          <table>
            <caption>Latest 50 actual observations</caption>
            <thead>
              <tr>
                <th>Captured at</th>
                {expanded.map((s) => (
                  <th key={s.key}>
                    {s.label} ({s.unit})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rawIndexes.map((i) => (
                <tr key={rawEvidence[0][i]}>
                  <td>{new Date(rawEvidence[0][i] * 1000).toISOString()}</td>
                  {expanded.map((s, j) => (
                    <td key={s.key}>{rawEvidence[j + 1][i] ?? "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
});

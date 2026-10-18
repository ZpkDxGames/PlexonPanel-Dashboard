"use client";
import {
  memo,
  useId,
  useMemo,
  useState,
  useRef,
  useEffect,
  type ComponentProps,
} from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePlotHistory } from "../../presentation/PlotHistory";
import {
  chartRows,
  sourceKeys,
  type ChartSeries,
} from "../../presentation/recharts-data";
import {
  finite,
  historyFor,
  sourceFor,
  type Source,
} from "../../presentation/telemetry";
import type { ControlState } from "../../adapter/control-state";
import { resolvedTheme, usePreferences } from "../../store/preferences";
import { valueLabel } from "../../presentation/format";
const lightPalette: Record<string, string> = {
  "#2dd4bf": "#0f766e",
  "#38bdf8": "#0369a1",
  "#a78bfa": "#6d28d9",
  "#f59e0b": "#b45309",
  "#f472b6": "#be185d",
};
export const tickSeries: ChartSeries[] = [
  {
    key: "mspt",
    label: "Mean MSPT",
    color: "#2dd4bf",
    unit: "ms",
    axis: "right",
  },
  { key: "msptP95", label: "p95", color: "#a78bfa", unit: "ms", axis: "right" },
  { key: "msptP99", label: "p99", color: "#f59e0b", unit: "ms", axis: "right" },
  { key: "tps", label: "TPS", color: "#38bdf8", unit: "TPS", axis: "left" },
];
export const memorySeries: ChartSeries[] = [
  { key: "heap", label: "JVM used", color: "#2dd4bf", unit: "bytes" },
  {
    key: "heapCommitted",
    label: "JVM committed",
    color: "#a78bfa",
    unit: "bytes",
  },
  {
    key: "serviceMemory",
    label: "Service cgroup",
    color: "#38bdf8",
    unit: "bytes",
  },
  { key: "memory", label: "Node physical", color: "#f59e0b", unit: "bytes" },
];
export const computeSeries: ChartSeries[] = [
  {
    key: "serviceCpu",
    label: "Service CPU",
    color: "#2dd4bf",
    unit: "%",
    axis: "left",
  },
  {
    key: "hostCpu",
    label: "Node CPU",
    color: "#38bdf8",
    unit: "%",
    axis: "left",
  },
  {
    key: "chunks",
    label: "Loaded chunks",
    color: "#a78bfa",
    unit: "chunks",
    axis: "right",
  },
];
const TelemetryPlot = memo(function TelemetryPlot({
  state,
  epochs,
  series = tickSeries,
  since,
  height = 360,
  domain,
  syncId = "telemetry",
  label = "Server telemetry",
}: {
  state: ControlState;
  epochs: ReturnType<typeof usePlotHistory>;
  series?: ChartSeries[];
  since: number;
  height?: number;
  domain?: [number, number];
  syncId?: string;
  label?: string;
}) {
  const prefs = usePreferences(),
    id = useId().replace(/:/g, "");
  const light = resolvedTheme(prefs.theme) === "light";
  const color = (value: string) =>
    light ? (lightPalette[value] ?? value) : value;
  const data = useMemo(
    () =>
      Object.fromEntries(
        (
          ["paperHealth", "paperSystem", "service", "hostSystem"] as Source[]
        ).map((source) => [
          source,
          chartRows(
            epochs?.[source] ?? state.history,
            source,
            sourceKeys(series, source),
            since,
            120,
          ),
        ]),
      ) as Record<Source, ReturnType<typeof chartRows>>,
    [epochs, state.history, series, since],
  );
  const primary = data[sourceFor[series[0].key]],
    right = series.some((s) => s.axis === "right"),
    ticks =
      series.some((s) => s.key === "tps") &&
      series.some((s) => s.key === "mspt");
  const clock = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: prefs.timezone === "UTC" ? "UTC" : undefined,
      }),
    [prefs.timezone],
  );
  const markers = useMemo(() => {
    const result: { at: number; name: string }[] = [];
    const jvm = historyFor(
      epochs?.paperSystem ?? state.history,
      "paperSystem",
      since,
    );
    for (let i = 1; i < jvm.length; i++)
      if (
        finite(jvm[i].gc) &&
        finite(jvm[i - 1].gc) &&
        jvm[i].gc! > jvm[i - 1].gc!
      )
        result.push({ at: jvm[i].at, name: "GC" });
    const events = Array.isArray(state.sessionEvents?.events)
      ? state.sessionEvents.events
      : [];
    const operations = Array.isArray(state.sessionEvents?.serverEvents)
      ? state.sessionEvents.serverEvents
      : [];
    for (const event of [...events, ...operations]) {
      const at = Date.parse(String(event.observedAt ?? event.capturedAt));
      if (at >= since)
        result.push({
          at,
          name: String(event.action ?? event.category ?? "Event"),
        });
    }
    return result.slice(-12);
  }, [epochs, state.history, state.sessionEvents, since]);
  const formatAxis = (v: number, unit: string) =>
    unit === "bytes"
      ? `${(v / 2 ** 30).toFixed(v >= 2 ** 30 ? 0 : 1)}G`
      : `${Number(v.toFixed(1))}`;
  return (
    <div
      role="group"
      aria-label={`${label}. Missing and restart observations create gaps.`}
      className="min-w-0"
      data-testid="telemetry-chart"
      data-zoomed={Boolean(domain)}
    >
      <div className="px-2 pt-4 md:px-4" style={{ height }}>
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          debounce={80}
        >
          <ComposedChart
            data={primary}
            syncId={syncId}
            syncMethod="value"
            margin={{ top: 14, right: right ? 16 : 12, left: 0, bottom: 0 }}
            accessibilityLayer
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
                  <stop
                    offset="0%"
                    stopColor={color(s.color)}
                    stopOpacity={0.24}
                  />
                  <stop
                    offset="100%"
                    stopColor={color(s.color)}
                    stopOpacity={0.01}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--chart-grid)"
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="at"
              type="number"
              scale="time"
              domain={domain ?? ["dataMin", "dataMax"]}
              allowDataOverflow
              tickFormatter={(v) => clock.format(v)}
              stroke="var(--muted-foreground)"
              tickLine={false}
              axisLine={false}
              minTickGap={48}
              tick={{ fontSize: 9, fontFamily: "var(--font-mono)" }}
              height={34}
            />
            <YAxis
              yAxisId="left"
              domain={ticks ? [0, 20] : [0, "auto"]}
              width={46}
              stroke="var(--muted-foreground)"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) =>
                formatAxis(
                  v,
                  series.find((s) => s.axis !== "right")?.unit ?? "",
                )
              }
              tick={{ fontSize: 9, fontFamily: "var(--font-mono)" }}
            />
            {right && (
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={
                  ticks
                    ? [0, (max: number) => Math.max(60, max * 1.1)]
                    : [0, "auto"]
                }
                width={64}
                stroke="var(--muted-foreground)"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) =>
                  `${formatAxis(v, "")}${ticks ? " ms" : ""}`
                }
                tick={{ fontSize: 9, fontFamily: "var(--font-mono)" }}
              />
            )}
            <Tooltip
              cursor={{
                stroke: "var(--muted-foreground)",
                strokeDasharray: "3 3",
              }}
              content={({ active, label: at }) =>
                active && typeof at === "number" ? (
                  <div className="min-w-44 rounded-xl border bg-card p-3 shadow-xl">
                    <p className="mb-3 font-mono text-[10px] text-muted-foreground">
                      {new Date(at).toLocaleTimeString(undefined, {
                        timeZone: prefs.timezone === "UTC" ? "UTC" : undefined,
                      })}
                    </p>
                    {series.map((s) => {
                      const rows = data[sourceFor[s.key]];
                      let nearest = rows[0];
                      for (const r of rows)
                        if (
                          !nearest ||
                          Math.abs(r.at - at) < Math.abs(nearest.at - at)
                        )
                          nearest = r;
                      return (
                        <div
                          key={s.key}
                          className="flex items-center justify-between gap-5 py-1 text-[10px]"
                        >
                          <span className="flex items-center gap-2">
                            <i
                              className="size-1.5 rounded-full"
                              style={{ background: color(s.color) }}
                            />
                            {s.label}
                          </span>
                          <span className="font-mono">
                            {valueLabel(
                              nearest && Math.abs(nearest.at - at) <= 5000
                                ? nearest[s.key]
                                : null,
                              s.unit,
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : null
              }
            />
            {ticks && (
              <ReferenceLine
                yAxisId="right"
                y={50}
                stroke={color("#f59e0b")}
                strokeDasharray="4 5"
                label={{
                  value: "50 ms threshold",
                  position: "insideTopRight",
                  fill: "var(--muted-foreground)",
                  fontSize: 9,
                }}
              />
            )}
            {ticks && (
              <Area
                yAxisId="right"
                data={data.paperHealth}
                dataKey="tickBand"
                stroke="none"
                fill={color("#a78bfa")}
                fillOpacity={0.08}
                isAnimationActive={false}
                connectNulls={false}
                tooltipType="none"
              />
            )}
            {series.map((s, i) =>
              i === 0 ? (
                <Area
                  key={s.key}
                  data={data[sourceFor[s.key]]}
                  yAxisId={s.axis ?? "left"}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={color(s.color)}
                  strokeWidth={2}
                  fill={
                    prefs.chartFill ? `url(#${id}-${s.key})` : "transparent"
                  }
                  isAnimationActive={false}
                  connectNulls={false}
                  dot={false}
                  activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
                />
              ) : (
                <Area
                  key={s.key}
                  data={data[sourceFor[s.key]]}
                  yAxisId={s.axis ?? "left"}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={color(s.color)}
                  fill="transparent"
                  strokeWidth={s.key === "tps" ? 2 : 1.4}
                  strokeDasharray={s.key === "msptP99" ? "4 4" : undefined}
                  isAnimationActive={false}
                  connectNulls={false}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              ),
            )}
            {markers.map((m, i) => (
              <ReferenceLine
                key={`${m.at}:${i}`}
                x={m.at}
                yAxisId="left"
                stroke={color("#a78bfa")}
                strokeOpacity={0.2}
                strokeDasharray="2 6"
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {!primary.length && (
        <p className="-mt-40 mb-32 text-center text-xs text-muted-foreground">
          Waiting for source measurements
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pb-4 pt-2">
        {series.map((s) => (
          <span
            key={s.key}
            className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
          >
            <i
              className="h-0.5 w-3 rounded-full"
              style={{ background: color(s.color) }}
            />
            {s.label}
          </span>
        ))}
        <span className="ml-auto text-[9px] text-muted-foreground">
          Independent source clocks · gaps preserved
        </span>
      </div>
    </div>
  );
});

/** Freeze offscreen SVG work; raw ingestion and the source history remain at full cadence. */
export const TelemetryChart = memo(function TelemetryChart(
  props: Omit<ComponentProps<typeof TelemetryPlot>, "epochs">,
) {
  const epochs = usePlotHistory(props.state.history),
    root = useRef<HTMLDivElement>(null),
    [visible, setVisible] = useState(true);
  const frozen = useRef({ ...props, epochs });
  const a = frozen.current.state,
    b = props.state;
  const epochChanged =
    a.bootEpochId !== b.bootEpochId ||
    a.serverId !== b.serverId ||
    a.ready?.device.scopes !== b.ready?.device.scopes ||
    a.ready?.server.paperSession !== b.ready?.server.paperSession ||
    a.ready?.server.hostSession !== b.ready?.server.hostSession ||
    a.ready?.agents.paper !== b.ready?.agents.paper ||
    a.ready?.agents.host !== b.ready?.agents.host;
  if (visible || epochChanged) frozen.current = { ...props, epochs };
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries[0].intersectionRatio >= 0.75),
      { threshold: [0, 0.75, 1] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={root} data-chart-active={visible}>
      <TelemetryPlot {...frozen.current} />
    </div>
  );
});

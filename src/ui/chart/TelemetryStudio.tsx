import { historyFor } from "../../presentation/telemetry";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Activity, Maximize2 } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceLine,
  ReferenceArea,
  Area,
  Line,
  Scatter,
  Tooltip,
} from "recharts";
import { useControl, useBand, fmt1 } from "../hooks/useControl";
import { usePreferences } from "../../store/preferences";
import { IconBadge } from "../primitives/IconBadge";
import { FreshnessChip } from "../primitives/FreshnessChip";
import { SourceChip } from "../primitives/SourceChip";
import { SummaryStrip } from "./SummaryStrip";
import { ChartDefs } from "./chart-defs";
import { ChartTooltip } from "./ChartTooltip";
import { buildRows, buildTimeTicks, msptDomain, type Row } from "./scales";
import type { Tone } from "../types";
export function TelemetryStudio({
  tall = false,
  pinned,
}: {
  tall?: boolean;
  pinned?: string;
}) {
  const { state } = useControl(),
    prefs = usePreferences(),
    paperBand = useBand("paperHealth"),
    hostBand = useBand("hostSystem"),
    [tab, setTab] = useState("Tick & MSPT"),
    [range, setRange] = useState("15m"),
    [expanded, setExpanded] = useState(false),
    [active, setActive] = useState(
      new Set([
        "tps",
        "mspt",
        "p95",
        "p99",
        "gc",
        "heap",
        "committed",
        "cgroup",
        "max",
        "cpu",
        "node",
        "chunks",
        "entities",
        "wait",
      ]),
    );
  const fmt = (t: number, sec = false) =>
    new Date(t).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      ...(sec ? { second: "2-digit" as const } : {}),
      ...(prefs.timezone === "UTC" ? { timeZone: "UTC" } : {}),
    });
  const h = useMemo(() => {
      const end = state.history.at(-1)?.at ?? Date.now(),
        span =
          range === "5m"
            ? 300000
            : range === "15m"
              ? 900000
              : range === "1h"
                ? 3600000
                : range === "6h"
                  ? 21600000
                  : Infinity;
      return state.history.filter(
        (s) => s.at >= end - span && (!pinned || s.epoch === pinned),
      );
    }, [state.history, range, pinned]),
    domain = msptDomain(historyFor(h, "paperHealth").map((p) => p.mspt ?? NaN)),
    data = useMemo(() => buildRows(h, domain[1]), [h, domain[1]]),
    t0 = data.rows[0]?.t ?? Date.now() - 900000,
    t1 = data.rows.at(-1)?.t ?? Date.now(),
    ticks = buildTimeTicks(t0, t1, fmt),
    tick = tab === "Tick & MSPT",
    mem = tab === "Memory Tiers";
  const selected = useSearchParams().get("series");
  useEffect(() => {
    if (selected === "cpu") setTab("CPU & Chunks");
    else if (selected === "heap") setTab("Memory Tiers");
    else if (selected) setTab("Tick & MSPT");
  }, [selected]);
  const configs: {
    key: string;
    label: string;
    unit: string;
    tone: Tone;
    source: "Paper" | "Host";
    data: Row[];
    axis: string;
  }[] = tick
    ? [
        {
          key: "tps",
          label: "TPS",
          unit: "TPS",
          tone: "sky",
          source: "Paper",
          data: data.paper,
          axis: "left",
        },
        {
          key: "mspt",
          label: "Mean MSPT",
          unit: "ms",
          tone: "cyan",
          source: "Paper",
          data: data.paper,
          axis: "right",
        },
        {
          key: "p95",
          label: "p95 MSPT",
          unit: "ms",
          tone: "violet",
          source: "Paper",
          data: data.paper,
          axis: "right",
        },
        {
          key: "p99",
          label: "p99 MSPT",
          unit: "ms",
          tone: "amber",
          source: "Paper",
          data: data.paper,
          axis: "right",
        },
        {
          key: "gc",
          label: "GC pauses",
          unit: "ms Δ",
          tone: "rose",
          source: "Paper",
          data: data.system,
          axis: "right",
        },
      ]
    : mem
      ? [
          {
            key: "heap",
            label: "Heap used",
            unit: "GiB",
            tone: "violet",
            source: "Paper",
            data: data.system,
            axis: "left",
          },
          {
            key: "committed",
            label: "Committed",
            unit: "GiB",
            tone: "violet",
            source: "Paper",
            data: data.system,
            axis: "left",
          },
          {
            key: "cgroup",
            label: "Cgroup",
            unit: "GiB",
            tone: "indigo",
            source: "Host",
            data: data.service,
            axis: "left",
          },
          {
            key: "max",
            label: "Heap max",
            unit: "GiB",
            tone: "slate",
            source: "Paper",
            data: data.system,
            axis: "left",
          },
          {
            key: "gc",
            label: "GC pauses",
            unit: "ms Δ",
            tone: "rose",
            source: "Paper",
            data: data.system,
            axis: "right",
          },
        ]
      : [
          {
            key: "cpu",
            label: "Service CPU",
            unit: "% / core",
            tone: "indigo",
            source: "Host",
            data: data.service,
            axis: "left",
          },
          {
            key: "node",
            label: "Node CPU",
            unit: "%",
            tone: "cyan",
            source: "Host",
            data: data.host,
            axis: "left",
          },
          {
            key: "chunks",
            label: "Loaded chunks",
            unit: "chunks",
            tone: "emerald",
            source: "Paper",
            data: data.paper,
            axis: "right",
          },
          {
            key: "entities",
            label: "Entities",
            unit: "entities",
            tone: "amber",
            source: "Paper",
            data: data.paper,
            axis: "right",
          },
          {
            key: "wait",
            label: "Tick wait",
            unit: "Unavailable",
            tone: "slate",
            source: "Paper",
            data: [],
            axis: "right",
          },
        ];
  return (
    <section
      className={`pp-card studio ${expanded ? "studio-expanded" : ""}`}
      data-tone="cyan"
    >
      <header className="card-header">
        <IconBadge icon={Activity} tone="cyan" />
        <div>
          <h2>Server performance</h2>
          <p className="eyebrow">Telemetry studio</p>
        </div>
        <div className="ml-auto flex gap-2">
          <label className="sr-only" htmlFor="chart-range">
            Chart range
          </label>
          <select
            id="chart-range"
            value={range}
            onChange={(e) => setRange(e.target.value)}
          >
            {["5m", "15m", "1h", "6h", "session"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <button
            className="icon-btn"
            aria-label="Expand performance chart"
            onClick={() => setExpanded(!expanded)}
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </header>
      <div className="flex flex-wrap gap-2 mb-3">
        <SourceChip source="Paper" />
        <FreshnessChip band={paperBand} />
        <SourceChip source="Host" />
        <FreshnessChip band={hostBand} />
      </div>
      <div className="segments mb-4" role="group" aria-label="Metric tabs">
        {["Tick & MSPT", "Memory Tiers", "CPU & Chunks"].map((v) => (
          <button
            key={v}
            aria-pressed={tab === v}
            className={tab === v ? "pp-glow-active" : ""}
            onClick={() => setTab(v)}
          >
            {v}
          </button>
        ))}
      </div>
      <SummaryStrip
        metrics={configs.map((c) => ({
          ...c,
          value: fmt1(c.data.at(-1)?.[c.key]),
          spark: c.data.map((r) =>
            typeof r[c.key] === "number" ? (r[c.key] as number) : null,
          ),
        }))}
        active={active}
        onToggle={(key) =>
          setActive((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
              if (configs.filter((c) => next.has(c.key)).length > 1)
                next.delete(key);
            } else next.add(key);
            return next;
          })
        }
      />
      <div
        className="pp-well chart-well mt-4"
        style={{ height: expanded ? "65vh" : tall ? 420 : 320 }}
      >
        <div className="axis-units">
          <span>{tick ? "TPS" : mem ? "GiB" : "% of one core"}</span>
          <span>{tick ? "MSPT · ms" : mem ? "GC · ms" : "Count"}</span>
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data.rows}
            margin={{ top: 18, right: 8, bottom: 4, left: 0 }}
          >
            <ChartDefs />
            <CartesianGrid
              vertical={false}
              stroke="rgb(var(--line)/.06)"
              strokeDasharray="2 6"
            />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[t0, t1]}
              ticks={ticks.ticks}
              tickFormatter={(t) => fmt(t, ticks.withSeconds)}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "rgb(var(--text-3))" }}
            />
            <YAxis
              yAxisId="left"
              width={40}
              domain={tick ? [0, 20] : [0, "auto"]}
              ticks={tick ? [0, 5, 10, 15, 20] : undefined}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "rgb(var(--text-3))" }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              width={46}
              domain={tick ? domain : [0, "auto"]}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "rgb(var(--text-3))" }}
            />
            {data.gaps.map((g) => (
              <ReferenceArea
                key={g.id}
                yAxisId="left"
                x1={g.from}
                x2={g.to}
                fill="url(#epoch-gap)"
                label={{
                  value: "Restarted",
                  fontSize: 11,
                  fill: "rgb(var(--text-3))",
                  position: "insideTop",
                }}
              />
            ))}
            {tick && (
              <ReferenceLine
                yAxisId="right"
                y={50}
                stroke="rgb(var(--hue-amber)/.55)"
                strokeDasharray="4 4"
                label={{
                  value: "50 ms budget",
                  position: "insideTopLeft",
                  fontSize: 11,
                  fill: "rgb(var(--hue-amber))",
                }}
              />
            )}
            {tick && prefs.chartFill && active.has("p99") && (
              <Area
                data={data.paper}
                yAxisId="right"
                dataKey="band"
                stroke="none"
                fill="url(#band-p9x)"
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
            {configs
              .filter((c) => active.has(c.key))
              .map((c) =>
                c.key === "gc" ? (
                  <Scatter
                    key={c.key}
                    data={c.data.filter(
                      (r) => typeof r.gc === "number" && r.gc > 0,
                    )}
                    yAxisId={c.axis}
                    dataKey={c.key}
                    fill={`rgb(var(--hue-${c.tone}))`}
                    shape="diamond"
                    isAnimationActive={false}
                  />
                ) : prefs.chartFill ? (
                  <Area
                    key={c.key}
                    data={c.data}
                    yAxisId={c.axis}
                    dataKey={c.key}
                    stroke={`rgb(var(--hue-${c.tone}))`}
                    strokeWidth={1.8}
                    fill={`url(#fill-${c.tone})`}
                    connectNulls={false}
                    dot={false}
                    isAnimationActive={false}
                    activeDot={{
                      r: 4.5,
                      stroke: "rgb(var(--card))",
                      strokeWidth: 1.5,
                    }}
                  />
                ) : (
                  <Line
                    key={c.key}
                    data={c.data}
                    yAxisId={c.axis}
                    dataKey={c.key}
                    stroke={`rgb(var(--hue-${c.tone}))`}
                    strokeWidth={1.8}
                    connectNulls={false}
                    dot={false}
                    isAnimationActive={false}
                  />
                ),
              )}
            <Tooltip
              cursor={{
                stroke: "rgb(var(--accent)/.55)",
                strokeDasharray: "3 3",
              }}
              content={<ChartTooltip />}
              allowEscapeViewBox={{ x: false, y: true }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <footer className="chart-footer">
        <span>Independent source clocks · gaps preserved</span>
        <span>35m bounded history · no interpolation</span>
      </footer>
      {!h.length && (
        <p className="text-secondary">
          Waiting for captured samples. Missing readings remain unavailable.
        </p>
      )}
    </section>
  );
}

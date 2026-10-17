"use client";
import { useState } from "react";
import { useSession, useNow } from "../hooks";
import { CrosshairGroup, TimeSeries } from "../components/charts/TimeSeries";
import {
  sourceEvidence,
  sourceFor,
  type MetricKey,
} from "../presentation/telemetry";
import type { CanvasSeries } from "../presentation/canvas-data";
const tracks: {
  key: MetricKey;
  title: string;
  source: string;
  unit: string;
  color: string;
}[] = [
  {
    key: "tps",
    title: "Tick rate",
    source: "PAPER HEALTH",
    unit: "TPS",
    color: "var(--chart-1)",
  },
  {
    key: "mspt",
    title: "Tick duration envelope",
    source: "PAPER HEALTH",
    unit: "ms",
    color: "var(--chart-1)",
  },
  {
    key: "serviceCpu",
    title: "Minecraft service CPU",
    source: "SYSTEMD CGROUP · % OF ONE CORE",
    unit: "% of one core",
    color: "var(--chart-3)",
  },
  {
    key: "hostCpu",
    title: "Node CPU",
    source: "HOST HARDWARE",
    unit: "%",
    color: "var(--chart-4)",
  },
  {
    key: "heap",
    title: "JVM heap",
    source: "PAPER JVM",
    unit: "bytes",
    color: "var(--chart-2)",
  },
  {
    key: "serviceMemory",
    title: "Minecraft service memory",
    source: "SYSTEMD CGROUP",
    unit: "bytes",
    color: "var(--chart-3)",
  },
  {
    key: "chunks",
    title: "Loaded chunks",
    source: "PAPER HEALTH",
    unit: "chunks",
    color: "var(--chart-3)",
  },
  {
    key: "entities",
    title: "World entities",
    source: "PAPER HEALTH",
    unit: "entities",
    color: "var(--chart-4)",
  },
];
const focusTracks = [
  ...tracks,
  {
    key: "processCpu" as const,
    title: "Paper process CPU",
    source: "PAPER JVM · PROCESS NORMALIZED",
    unit: "%",
    color: "var(--chart-2)",
  },
];
const memory: { title: string; source: string; series: CanvasSeries[] }[] = [
  {
    title: "JVM heap allocation",
    source: "PAPER JVM",
    series: [
      { key: "heap", label: "Used", color: "var(--chart-2)", unit: "bytes" },
      {
        key: "heapCommitted",
        label: "Committed",
        color: "var(--chart-3)",
        unit: "bytes",
      },
      {
        key: "heapMax",
        label: "Maximum",
        color: "var(--chart-4)",
        unit: "bytes",
      },
    ],
  },
  {
    title: "Service memory accounting",
    source: "SYSTEMD CGROUP",
    series: [
      {
        key: "serviceMemory",
        label: "MemoryCurrent",
        color: "var(--chart-3)",
        unit: "bytes",
      },
      {
        key: "serviceMemoryMax",
        label: "MemoryMax",
        color: "var(--chart-2)",
        unit: "bytes",
      },
    ],
  },
  {
    title: "Node physical RAM",
    source: "HOST HARDWARE",
    series: [
      {
        key: "memory",
        label: "Physical used",
        color: "var(--chart-4)",
        unit: "bytes",
      },
    ],
  },
];
export default function Performance() {
  const { state } = useSession(),
    now = useNow(),
    [minutes, setMinutes] = useState(5),
    [compare, setCompare] = useState(true),
    [focus, setFocus] = useState<MetricKey>("tps");
  const cutoff = Math.floor(now / 10000) * 10000 - minutes * 60000;
  return (
    <CrosshairGroup>
      <div className="analysis-toolbar">
        <div className="segmented">
          <button aria-pressed={compare} onClick={() => setCompare(true)}>
            Compare 8 signals
          </button>
          <button aria-pressed={!compare} onClick={() => setCompare(false)}>
            Single focus
          </button>
        </div>
        <div className="segmented" aria-label="Time range">
          {[1, 5, 15, 35].map((n) => (
            <button
              key={n}
              aria-pressed={minutes === n}
              onClick={() => setMinutes(n)}
            >
              {n}m
            </button>
          ))}
        </div>
        {!compare ? (
          <select
            aria-label="Focus signal"
            value={focus}
            onChange={(e) => setFocus(e.target.value as MetricKey)}
          >
            {focusTracks.map((t) => (
              <option key={t.key} value={t.key}>
                {t.title}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <div className="v5-session">
        <strong>Independent source clocks</strong> · Crosshairs and brush zoom
        synchronize. Gaps remain gaps. Service CPU may exceed 100%. Violet ticks
        mark observed GC or player events.
      </div>
      <div className="v5-signal-grid">
        {(compare ? tracks : focusTracks)
          .filter((t) => compare || t.key === focus)
          .map((t) => (
            <TimeSeries
              key={t.key}
              title={t.title}
              source={t.source}
              samples={state.history}
              series={[
                {
                  key: t.key,
                  label: t.key === "mspt" ? "Mean" : t.title,
                  color: t.color,
                  unit: t.unit,
                },
              ]}
              windowStart={cutoff}
              threshold={t.key === "mspt" ? 50 : undefined}
              yMax={t.key === "tps" ? 20 : undefined}
              evidence={sourceEvidence(state, sourceFor[t.key], now)}
              height={220}
            />
          ))}
      </div>
      <section className="v5-memory-attribution">
        <h2>Memory attribution</h2>
        <p>
          Separate producer clocks: heap allocation, complete service cgroup,
          and physical node RAM.
        </p>
        <div className="v5-memory-grid">
          {memory.map((t) => (
            <TimeSeries
              key={t.title}
              title={t.title}
              source={t.source}
              samples={state.history}
              series={t.series}
              windowStart={cutoff}
              height={210}
            />
          ))}
        </div>
      </section>
    </CrosshairGroup>
  );
}

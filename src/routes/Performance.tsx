"use client";
import { useMemo, useState } from "react";
import { Activity, Expand, Layers3 } from "lucide-react";
import { useNow, useSession } from "../hooks";
import { usePlotHistory } from "../presentation/PlotHistory";
import {
  historyFor,
  sourceEvidence,
  sourceFor,
  type MetricKey,
} from "../presentation/telemetry";
import type { ChartSeries } from "../presentation/recharts-data";
import { TelemetryChart } from "../components/charts/TelemetryChart";
import { Card, CardHeader } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Select } from "../components/ui/input";

import { TimeBrush } from "../components/charts/TimeBrush";
import { PageHeader } from "../components/PageHeader";
const tracks: { label: string; series: ChartSeries[] }[] = [
  {
    label: "Tick rate",
    series: [{ key: "tps", label: "TPS", unit: "TPS", color: "#2dd4bf" }],
  },
  {
    label: "Tick duration",
    series: [
      { key: "mspt", label: "Mean MSPT", unit: "ms", color: "#38bdf8" },
      { key: "msptP95", label: "p95", unit: "ms", color: "#a78bfa" },
      { key: "msptP99", label: "p99", unit: "ms", color: "#f59e0b" },
    ],
  },
  {
    label: "JVM heap",
    series: [
      { key: "heap", label: "Used", unit: "bytes", color: "#a78bfa" },
      {
        key: "heapCommitted",
        label: "Committed",
        unit: "bytes",
        color: "#38bdf8",
      },
      { key: "heapMax", label: "Maximum", unit: "bytes", color: "#f59e0b" },
    ],
  },
  {
    label: "Service memory",
    series: [
      {
        key: "serviceMemory",
        label: "systemd cgroup",
        unit: "bytes",
        color: "#38bdf8",
      },
    ],
  },
  {
    label: "Service CPU",
    series: [
      {
        key: "serviceCpu",
        label: "% of one core",
        unit: "%",
        color: "#2dd4bf",
      },
    ],
  },
  {
    label: "Node CPU",
    series: [
      { key: "hostCpu", label: "Host physical", unit: "%", color: "#f59e0b" },
    ],
  },
  {
    label: "Loaded chunks",
    series: [{ key: "chunks", label: "Chunks", unit: "", color: "#a78bfa" }],
  },
  {
    label: "Entities",
    series: [
      { key: "entities", label: "Entities", unit: "", color: "#f472b6" },
    ],
  },
];
export default function Performance() {
  const { state } = useSession(),
    now = useNow(),
    epochs = usePlotHistory();
  const [mode, setMode] = useState("compare"),
    [focus, setFocus] = useState(0),
    [minutes, setMinutes] = useState(15),
    [evidence, setEvidence] = useState<MetricKey>("mspt");
  const [domain, setDomain] = useState<[number, number] | undefined>();
  const since = Math.floor(now / 10000) * 10000 - minutes * 60000;
  const raw = useMemo(
    () =>
      historyFor(
        epochs?.[sourceFor[evidence]] ?? state.history,
        sourceFor[evidence],
        since,
      ).slice(-50),
    [epochs, state.history, evidence, since],
  );
  return (
    <div className="space-y-5">
      <PageHeader
        title="Performance"
        description="Independent source clocks. Every spike, in context."
        action={<Badge tone="info">4 Hz Paper telemetry</Badge>}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Analyzer mode"
          className="inline-flex gap-1 rounded-lg border bg-background p-1"
        >
          {[
            { value: "compare", label: "Compare tracks", icon: Layers3 },
            { value: "focus", label: "Single focus", icon: Expand },
          ].map((item) => (
            <button
              key={item.value}
              aria-pressed={mode === item.value}
              onClick={() => setMode(item.value)}
              className={`flex min-h-8 items-center gap-2 rounded-md px-3 text-xs font-medium ${mode === item.value ? "bg-muted text-foreground" : "text-muted-foreground"}`}
            >
              <item.icon size={14} />
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {mode === "focus" && (
            <Select
              aria-label="Focused signal"
              value={focus}
              onChange={(e) => setFocus(Number(e.target.value))}
            >
              {tracks.map((t, i) => (
                <option key={t.label} value={i}>
                  {t.label}
                </option>
              ))}
            </Select>
          )}
          <Select
            className="w-28"
            aria-label="Performance time range"
            value={minutes}
            onChange={(e) => {
              setMinutes(Number(e.target.value));
              setDomain(undefined);
            }}
          >
            {[1, 5, 15, 35].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </Select>
        </div>
      </div>
      <Card>
        <TimeBrush state={state} since={since} onRange={setDomain} />
      </Card>
      <div
        className={
          mode === "compare" ? "grid gap-5 xl:grid-cols-2" : "grid gap-5"
        }
      >
        {(mode === "compare" ? tracks : [tracks[focus]]).map((t) => {
          const e = sourceEvidence(state, sourceFor[t.series[0].key], now);
          return (
            <Card key={t.label}>
              <CardHeader
                title={t.label}
                icon={<Activity size={15} className="text-muted-foreground" />}
                action={
                  <Badge dot tone={e.kind === "live" ? "success" : "warning"}>
                    {e.kind}
                  </Badge>
                }
              />
              <TelemetryChart
                state={state}
                series={t.series}
                since={since}
                height={mode === "compare" ? 235 : 420}
                domain={domain}
                syncId="performance"
                label={t.label}
              />
            </Card>
          );
        })}
      </div>
      <Card>
        <CardHeader
          title="Raw source evidence"
          description="Last 50 actual observations · full precision · no interpolated rows"
          action={
            <Select
              className="w-44"
              aria-label="Evidence signal"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value as MetricKey)}
            >
              {tracks
                .flatMap((t) => t.series)
                .map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
            </Select>
          }
        />
        <div
          className="max-h-72 overflow-auto"
          tabIndex={0}
          role="region"
          aria-label="Raw telemetry evidence"
        >
          <table className="w-full text-left font-mono text-[10px]">
            <thead className="sticky top-0 bg-card text-muted-foreground">
              <tr>
                <th className="p-3 pl-5">CAPTURE TIME</th>
                <th className="p-3">SOURCE</th>
                <th className="p-3">VALUE</th>
              </tr>
            </thead>
            <tbody>
              {raw.map((r, i) => (
                <tr key={`${r.at}:${i}`} className="border-t">
                  <td className="p-3 pl-5">{new Date(r.at).toISOString()}</td>
                  <td className="p-3 text-muted-foreground">
                    {sourceFor[evidence]}
                  </td>
                  <td className="p-3">
                    {r[evidence] === null || r[evidence] === undefined
                      ? "Missing observation"
                      : String(r[evidence])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

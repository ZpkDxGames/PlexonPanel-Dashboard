"use client";

import { useState } from "react";
import {
  Badge,
  Empty,
  Panel,
  bytes,
  metric,
  type ViewProps,
} from "./control-views";
import { diagnostics, number, str, type JsonMap, type Sample } from "../lib/control-state";
import { useUiPreferences } from "../components/ui-preferences-provider";

import { METRICS, metricSeries, exportMetrics, type MetricField } from "../lib/metric-reports";
import { useTelemetryNow } from "../lib/telemetry-clock";
import { TelemetryChart, type ChartSpec } from "./telemetry-chart";
import { telemetryFreshness } from "../lib/telemetry-freshness";
const CHARTS: ChartSpec[] = [
  { field: "tps", label: "TPS", shortLabel: "TPS", format: (n) => n.toFixed(2), source: "paper-health", domain: [0, 20], reference: { value: 18, label: "18 degraded reference" }, series: 1 },
  { field: "mspt", label: "MSPT", shortLabel: "MSPT", format: (n) => `${n.toFixed(2)} ms`, source: "paper-health", reference: { value: 50, label: "50 ms tick budget" }, series: 2 },
  { field: "hostCpu", label: "Host CPU", shortLabel: "Host CPU", format: (n) => `${n.toFixed(1)}%`, source: "host-system", percentage: true, series: 3 },
  { field: "processCpu", label: "Paper process CPU", shortLabel: "Paper CPU", format: (n) => `${n.toFixed(1)}%`, source: "paper-system", percentage: true, series: 4 },
  { field: "memory", label: "Host memory used", shortLabel: "Host memory", format: (n) => bytes(n), source: "host-system", series: 5 },
  { field: "heap", label: "JVM heap used", shortLabel: "JVM heap", format: (n) => bytes(n), source: "paper-system", series: 6 },
  { field: "players", label: "Online players", shortLabel: "Players", format: n => String(n), source: "paper-health", series: 1 },
  { field: "serviceCpu", label: "Minecraft service CPU", shortLabel: "Service CPU", format: n => `${n.toFixed(1)}%`, source: "host-service", series: 3 },
  { field: "serviceMemory", label: "Minecraft service RAM", shortLabel: "Service RAM", format: n => bytes(n), source: "host-service", series: 5 },
];

function displayTime(at: number, zone: "local" | "utc") {
  const date = new Date(at);
  return zone === "utc"
    ? `${date.toLocaleTimeString(undefined, { timeZone: "UTC" })} UTC`
    : date.toLocaleTimeString();
}

function capturedAt(recordValue: JsonMap) {
  const raw = str(recordValue.capturedAt, "");
  const parsed = raw ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function downloadBlob(filename: string, body: string, type: string) {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function exportHistory(history: Sample[], serverId: string, minutes: number, format: "csv" | "json") {
  const stamp = new Date().toISOString().replaceAll(":", "");
  downloadBlob(`plexonpanel-${serverId.slice(0, 8)}-${stamp}.${format}`, exportMetrics(history, serverId, minutes, Date.now(), format), format === "json" ? "application/json" : "text/csv;charset=utf-8");
}

function SegmentedWindow({ value, onChange }: { value: number; onChange: (value: 1 | 5 | 15 | 30) => void }) {
  return (
    <div className="workspace-segmented" aria-label="Chart time window">
      {([1, 5, 15, 30] as const).map((minutes) => (
        <button key={minutes} type="button" aria-pressed={value === minutes} onClick={() => onChange(minutes)}>{minutes}m</button>
      ))}
    </div>
  );
}

function WorldTable({ worlds }: { worlds: Record<string, unknown>[] }) {
  if (!worlds.length) return <Empty title="No world snapshot yet" />;
  return (
    <div className="ui-table-wrap"><table>
      <thead><tr><th>World</th><th>Chunks</th><th>Entities</th><th>Players</th></tr></thead>
      <tbody>{worlds.map((world) => <tr key={str(world.name)}><td>{str(world.name)}</td><td>{String(world.loadedChunks ?? "—")}</td><td>{String(world.entities ?? "—")}</td><td>{String(world.players ?? "—")}</td></tr>)}</tbody>
    </table></div>
  );
}

export function PerformanceView({ props, resetHistory }: { props: ViewProps; resetHistory: () => void }) {
  const { preferences, updatePreference } = useUiPreferences();
  const windowMinutes = preferences.chartWindowMinutes;
  const [paused, setPaused] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [frozenHistory, setFrozenHistory] = useState<Sample[]>(props.state.history);
  const history = paused ? frozenHistory : props.state.history;
  const hostConnected = Boolean(props.state.ready?.agents.host);
  const paperConnected = Boolean(props.state.ready?.agents.paper);
  const host = props.state.hostSystem;
  const togglePause = () => {
    if (paused) { setPaused(false); return; }
    setFrozenHistory(props.state.history);
    setPaused(true);
  };
  const clearHistory = () => {
    if (!window.confirm("Clear only this browser's rolling telemetry history?")) return;
    resetHistory();
    setFrozenHistory([]);
  };
  const capacityFor = (field: MetricField) => field === "memory" && hostConnected ? number(host.physicalMemoryTotalBytes) : field === "heap" && paperConnected ? number(props.state.system.jvmHeapMaximumBytes) : null;
  const sourceRecord = (spec: ChartSpec) => spec.source === "host-service" ? (props.state.service.resources as JsonMap ?? {}) : spec.source === "host-system" ? props.state.hostSystem : spec.source === "paper-system" ? props.state.system : props.state.server;
  const sourceLabel = (spec: ChartSpec) => `${METRICS[spec.field].origin} · ${METRICS[spec.field].unit}`;
  const now = useTelemetryNow(props.state.updatedAt);
  const paperSampleLive = props.connected && !props.state.cached && paperConnected && ["live", "delayed"].includes(telemetryFreshness(props.state.server.capturedAt, true, now).kind);
  const jvmSampleLive = props.connected && !props.state.cached && paperConnected && ["live", "delayed"].includes(telemetryFreshness(props.state.system.capturedAt, true, now).kind);
  const hostSampleLive = props.connected && !props.state.cached && hostConnected && ["live", "delayed"].includes(telemetryFreshness(host.capturedAt, true, now).kind);
  const chartStatus = (spec: ChartSpec): "live" | "paused" | "disconnected" | "stale" => {
    const sourceConnected = (spec.source === "host-system" || spec.source === "host-service") ? hostConnected : paperConnected;
    const freshness = telemetryFreshness(sourceRecord(spec).capturedAt, sourceConnected && props.connected && !props.state.cached, now);
    return freshness.kind === "disconnected" ? "disconnected" : paused ? "paused" : freshness.kind === "live" || freshness.kind === "delayed" ? "live" : "stale";
  };

  return (
    <>
      <div className="workspace-performance-toolbar">
        <div><strong>Performance workspace</strong><span>Browser-local source history · Paper and Host remain independently authoritative</span></div>
        <SegmentedWindow value={windowMinutes} onChange={(value) => updatePreference("chartWindowMinutes", value)} />
        <button className="ui-button" onClick={togglePause}>{paused ? "Resume charts" : "Pause charts"}</button>
        <button className="ui-button" onClick={() => props.notice(props.state.telemetryUpdatedAt ? `Latest pushed telemetry: ${new Date(props.state.telemetryUpdatedAt).toLocaleTimeString()}.` : "Waiting for the first telemetry sample.")}>Refresh latest</button>
        <details className="workspace-menu"><summary className="ui-button">Export / history</summary><div><button onClick={() => exportHistory(history, props.state.serverId, windowMinutes, "csv")}>Export CSV</button><button onClick={() => exportHistory(history, props.state.serverId, windowMinutes, "json")}>Export JSON</button><button onClick={clearHistory}>Reset local history</button></div></details>
        <button className="ui-button" onClick={() => void navigator.clipboard.writeText(diagnostics(props.state)).then(() => props.notice("Safe diagnostics copied."))}>Copy diagnostics</button>
      </div>
      {paused && <div className="workspace-state-banner">Charts paused locally. {props.connected ? "WebSocket telemetry remains connected and authoritative samples continue to arrive." : "The dashboard is disconnected; the visible history remains frozen locally."}</div>}
      <div className="workspace-chart-grid">
        {CHARTS.map((spec) => {
          const source = sourceRecord(spec);
          return (
            <TelemetryChart
              key={spec.field}
              history={history}
              spec={spec}
              windowMinutes={windowMinutes}
              capacity={capacityFor(spec.field)}
              status={chartStatus(spec)}
              sourceLabel={sourceLabel(spec)}
              sourceIntervalMs={number(source.sourceIntervalMillis)}
              sourceCapturedAt={capturedAt(source)}
            />
          );
        })}
      </div>
      <Panel title="Observed data table" aside={<Badge>Source captures · last {windowMinutes}m</Badge>}>
        <details className="workspace-disclosure" onToggle={event => setTableOpen(event.currentTarget.open)}><summary>Inspect the latest 100 observations per metric</summary>
          <div className="ui-table-wrap"><table><thead><tr><th>Metric / source</th><th>Captured at</th><th>Value</th><th>Unit</th></tr></thead><tbody>
          {tableOpen && CHARTS.flatMap(spec => metricSeries(history, spec.field, windowMinutes, now).slice(-100).reverse().map(point => <tr key={`${spec.field}-${point.at}`}><td>{spec.label}<small>{METRICS[spec.field].origin}</small></td><td>{displayTime(point.at, preferences.timeZone)}</td><td>{point.value === null ? "Gap / unavailable" : spec.format(point.value)}</td><td>{METRICS[spec.field].unit}</td></tr>))}
          </tbody></table></div>
        </details>
      </Panel>
      <Panel title="Latest source statistics" aside={<Badge>Paper health / JVM · independent captures</Badge>}>
        <div className="workspace-metric-grid compact">
          {[
            ["Minimum", metric(paperSampleLive ? props.state.server.minimumSampleTickMillis : null, " ms"), "Recent Paper tick sample"],
            ["Average", metric(paperSampleLive ? props.state.server.averageTickMillis : null, " ms"), "Paper rolling tick time"],
            ["95th percentile", metric(paperSampleLive ? props.state.server.p95TickMillis : null, " ms"), "Recent Paper tick sample"],
            ["Maximum", metric(paperSampleLive ? props.state.server.maximumSampleTickMillis : null, " ms"), "Recent Paper tick sample"],
            ["JVM heap used", bytes(jvmSampleLive ? props.state.system.jvmHeapUsedBytes : null), `Committed ${bytes(jvmSampleLive ? props.state.system.jvmHeapCommittedBytes : null)}`],
            ["Paper process RSS", bytes(jvmSampleLive ? props.state.system.processRssBytes : null), `Paper swap ${bytes(jvmSampleLive ? props.state.system.swapUsedBytes : null)}`],
            ["GC pauses", metric(jvmSampleLive ? props.state.system.gcPauseTotalMillis : null, " ms", 0), `${(jvmSampleLive ? props.state.system.gcCollections : null) ?? "—"} collections since Paper start`],
            ["Host disk used", hostSampleLive ? bytes(host.diskUsedBytes) : "Unavailable", hostSampleLive ? `${bytes(host.diskUsableBytes)} available` : "Host companion disconnected"],
          ].map(([label, value, detail]) => <div className="workspace-metric-card" key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>)}
        </div>
      </Panel>
      <Panel title="Host load averages">
        {hostSampleLive ? (
          <div className="workspace-metric-grid compact">{[1, 5, 15].map((minutes) => <div className="workspace-metric-card" key={minutes}><span>{minutes} minute{minutes > 1 ? "s" : ""}</span><strong>{metric(host[`loadAverage${minutes}m`], "", 2)}</strong><small>Machine-wide runnable and uninterruptible tasks</small></div>)}</div>
        ) : (
          <Empty title="Host companion disconnected">Machine load averages are Host-owned and are not inferred from Paper telemetry.</Empty>
        )}
      </Panel>
      <Panel title="World statistics"><WorldTable worlds={paperSampleLive ? props.state.worlds : []} /></Panel>
    </>
  );
}

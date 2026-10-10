"use client";

import { useState } from "react";
import {
  bytes,
  metric,
  type ViewProps,
} from "./control-views";
import { Badge, Button, Empty, PageHeader, Panel } from "./ui/workspace";
import { Menu, Table } from "./ui/primitives";
import { diagnostics, number, str, type JsonMap, type Sample } from "../lib/control-state";
import { useUiPreferences } from "../components/ui-preferences-provider";

import { METRICS, metricSeries, exportMetrics, type MetricField } from "../lib/metric-reports";
import { useTelemetryNow } from "../lib/telemetry-clock";
import { TelemetryChart, type ChartSpec } from "./telemetry-chart";
import { classifyTelemetry } from "../lib/telemetry-freshness";
const CHARTS: ChartSpec[] = [
  { field: "tps", label: "TPS", shortLabel: "TPS", format: (n) => n.toFixed(2), source: "paper-health", domain: [0, 20], reference: { value: 19, label: "19 TPS warning threshold" }, series: 1 },
  { field: "mspt", label: "MSPT", shortLabel: "MSPT", format: (n) => `${n.toFixed(2)} ms`, source: "paper-health", reference: { value: 50, label: "50 ms tick budget" }, series: 2 },
  { field: "hostCpu", label: "Host CPU (machine)", shortLabel: "Host CPU", format: (n) => `${n.toFixed(1)}%`, source: "host-system", percentage: true, series: 3 },
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
    <div className="pp-segmented" aria-label="Chart time window">
      {([1, 5, 15, 30] as const).map((minutes) => (
        <Button key={minutes} type="button" aria-pressed={value === minutes} onClick={() => onChange(minutes)}>{minutes} min</Button>
      ))}
    </div>
  );
}

function WorldTable({ worlds }: { worlds: Record<string, unknown>[] }) {
  if (!worlds.length) return <Empty title="No world snapshot yet" />;
  return (
    <Table caption="Latest Paper world snapshot" rows={worlds} rowKey={world=>str(world.name)} columns={[
      {key:'name',label:'World',rowHeader:true,render:world=>str(world.name)},
      {key:'chunks',label:'Chunks',render:world=>String(world.loadedChunks??'Unavailable')},
      {key:'entities',label:'Entities',render:world=>String(world.entities??'Unavailable')},
      {key:'players',label:'Players',render:world=>String(world.players??'Unavailable')},
    ]}/>

  );
}

export function PerformanceView({ props, resetHistory }: { props: ViewProps; resetHistory: () => void }) {
  const { preferences, updatePreference } = useUiPreferences();
  const windowMinutes = preferences.chartWindowMinutes;
  const [inspectionAt, setInspectionAt] = useState<number|null>(null);
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
  const sourceLabel = (spec: ChartSpec) => `${METRICS[spec.field].origin.replaceAll(" · "," / ")} / ${METRICS[spec.field].unit}`;
  const now = useTelemetryNow(props.state.updatedAt);
  const receipt=(spec:ChartSpec)=>props.state.receipts?.[spec.source==="host-service"?"service":spec.source==="host-system"?"hostSystem":spec.source==="paper-system"?"paperSystem":"paperHealth"];
  const paperSampleLive = props.connected && !props.state.cached && paperConnected && classifyTelemetry({capturedAt:props.state.server.capturedAt,receivedAt:props.state.receipts?.paperHealth,connected:true,now}).usable;
  const jvmSampleLive = props.connected && !props.state.cached && paperConnected && classifyTelemetry({capturedAt:props.state.system.capturedAt,receivedAt:props.state.receipts?.paperSystem,connected:true,now}).usable;
  const hostSampleLive = props.connected && !props.state.cached && hostConnected && classifyTelemetry({capturedAt:host.capturedAt,receivedAt:props.state.receipts?.hostSystem,connected:true,now}).usable;
  const chartStatus = (spec: ChartSpec): "live" | "paused" | "disconnected" | "stale" => {
    const sourceConnected = (spec.source === "host-system" || spec.source === "host-service") ? hostConnected : paperConnected;
    const freshness = classifyTelemetry({capturedAt:sourceRecord(spec).capturedAt,receivedAt:receipt(spec),connected:sourceConnected&&props.connected&&!props.state.cached,now});
    return freshness.kind === "disconnected" ? "disconnected" : paused ? "paused" : freshness.usable ? "live" : "stale";
  };

  return (
    <div className="pp-workspace" data-ui6-workspace="Performance">
      <PageHeader title="Observed performance" description={paused?'Charts paused in this browser.':'Paper, Host and service captures remain separate.'} primary={<Button variant="primary" onClick={togglePause}>{paused?'Resume charts':'Pause charts'}</Button>} secondary={<Menu label="More" items={[
        {label:'Refresh latest',onSelect:()=>props.notice(props.state.telemetryUpdatedAt?`Latest pushed telemetry: ${new Date(props.state.telemetryUpdatedAt).toLocaleTimeString()}.`:'Waiting for the first telemetry sample.')},
        {label:'Copy diagnostics',onSelect:()=>void navigator.clipboard.writeText(diagnostics(props.state)).then(()=>props.notice('Safe diagnostics copied.'))},
        {label:'Export CSV',onSelect:()=>exportHistory(history,props.state.serverId,windowMinutes,'csv')},
        {label:'Export JSON',onSelect:()=>exportHistory(history,props.state.serverId,windowMinutes,'json')},
        {label:'Reset local history',onSelect:clearHistory},
      ]}/>}/>
      <SegmentedWindow value={windowMinutes} onChange={value=>updatePreference('chartWindowMinutes',value)}/>
      {paused && <div className="pp-notice">Charts paused locally. {props.connected ? "WebSocket telemetry remains connected and authoritative samples continue to arrive." : "The dashboard is disconnected; the visible history remains frozen locally."}</div>}
      <div className="pp-chart-grid">
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
              receivedAt={receipt(spec)}
              inspectionAt={inspectionAt}
              onInspect={setInspectionAt}
            />
          );
        })}
      </div>
      <Panel title="Observed report" aside={<Badge>Last {windowMinutes} min</Badge>}>
        <p className="pp-muted">Each chart reports its sample count, observed coverage, sample-based p95 and gaps. These are browser observations.</p>
        <details className="pp-disclosure" onToggle={event=>setTableOpen(event.currentTarget.open)}><summary>Inspect the latest 100 observations per metric</summary>
          <Table caption="Bounded observed values" rows={tableOpen?CHARTS.flatMap(spec=>metricSeries(history,spec.field,windowMinutes,now).slice(-100).reverse().map(point=>({spec,point}))):[]} rowKey={row=>`${row.spec.field}-${row.point.at}`} columns={[
            {key:'metric',label:'Metric / source',rowHeader:true,render:({spec})=><>{spec.label}<small>{METRICS[spec.field].origin.replaceAll(' · ',' / ')}</small></>},
            {key:'at',label:'Captured at',render:({point})=>displayTime(point.at,preferences.timeZone)},
            {key:'value',label:'Value',render:({spec,point})=><span className="pp-number">{point.value===null?'Gap / unavailable':spec.format(point.value)}</span>},
            {key:'unit',label:'Unit',render:({spec})=>METRICS[spec.field].unit},
          ]}/>
        </details>
      </Panel>
      <Panel title="Latest source statistics" aside={<Badge>Paper health / JVM captures</Badge>}>
        <div className="pp-stat-grid">
          {[
            ["Minimum", metric(paperSampleLive ? props.state.server.minimumSampleTickMillis : null, " ms"), "Recent Paper tick sample"],
            ["Average", metric(paperSampleLive ? props.state.server.averageTickMillis : null, " ms"), "Paper rolling tick time"],
            ["95th percentile", metric(paperSampleLive ? props.state.server.p95TickMillis : null, " ms"), "Recent Paper tick sample"],
            ["Maximum", metric(paperSampleLive ? props.state.server.maximumSampleTickMillis : null, " ms"), "Recent Paper tick sample"],
            ["JVM heap used", bytes(jvmSampleLive ? props.state.system.jvmHeapUsedBytes : null), `Committed ${bytes(jvmSampleLive ? props.state.system.jvmHeapCommittedBytes : null)}`],
            ["Paper process RSS", bytes(jvmSampleLive ? props.state.system.processRssBytes : null), `Paper swap ${bytes(jvmSampleLive ? props.state.system.swapUsedBytes : null)}`],
            ["GC pauses", metric(jvmSampleLive ? props.state.system.gcPauseTotalMillis : null, " ms", 0), `${(jvmSampleLive ? props.state.system.gcCollections : null) ?? "—"} collections since Paper start`],
            ["Host disk used", hostSampleLive ? bytes(host.diskUsedBytes) : "Unavailable", hostSampleLive ? `${bytes(host.diskUsableBytes)} available` : "Host companion disconnected"],
          ].map(([label, value, detail]) => <div className="pp-stat" key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>)}
        </div>
      </Panel>
      <Panel title="Host load averages">
        {hostSampleLive ? (
          <div className="pp-stat-grid">{[1, 5, 15].map((minutes) => <div className="pp-stat" key={minutes}><span>{minutes} minute{minutes > 1 ? "s" : ""}</span><strong>{metric(host[`loadAverage${minutes}m`], "", 2)}</strong><small>Machine-wide runnable and uninterruptible tasks</small></div>)}</div>
        ) : (
          <Empty title="Host companion disconnected">Machine load averages are Host-owned and are not inferred from Paper telemetry.</Empty>
        )}
      </Panel>
      <Panel title="World statistics"><WorldTable worlds={paperSampleLive ? props.state.worlds : []} /></Panel>
    </div>
  );
}

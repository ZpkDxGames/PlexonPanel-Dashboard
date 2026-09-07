"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Agent,
  Badge,
  Empty,
  Panel,
  bytes,
  duration,
  metric,
  ratio,
  time,
  type ViewProps,
} from "./control-views";
import { diagnostics, number, str, type JsonMap, type Sample } from "../lib/control-state";
import { displayRateLabel } from "../lib/display-cadence";
import {
  buildSvgPaths,
  gapSegments,
  nearestValueIndex,
  resolveDomain,
  seriesStats,
  thinSegment,
  windowedPoints,
  type TimedValue,
} from "../lib/chart-geometry";
import { useUiPreferences } from "../components/ui-preferences-provider";

type HistoryField = keyof Omit<Sample, "at">;
type ChartSource = "paper-health" | "paper-system" | "host-system";
type ChartSpec = {
  field: HistoryField;
  label: string;
  shortLabel: string;
  format: (value: number) => string;
  source: ChartSource;
  domain?: [number, number];
  percentage?: boolean;
  reference?: { value: number; label: string };
  series: 1 | 2 | 3 | 4 | 5 | 6;
};

const CHARTS: ChartSpec[] = [
  { field: "tps", label: "TPS", shortLabel: "TPS", format: (n) => n.toFixed(2), source: "paper-health", domain: [0, 20], reference: { value: 18, label: "18 degraded reference" }, series: 1 },
  { field: "mspt", label: "MSPT", shortLabel: "MSPT", format: (n) => `${n.toFixed(2)} ms`, source: "paper-health", reference: { value: 50, label: "50 ms tick budget" }, series: 2 },
  { field: "hostCpu", label: "Host CPU", shortLabel: "Host CPU", format: (n) => `${n.toFixed(1)}%`, source: "host-system", percentage: true, series: 3 },
  { field: "processCpu", label: "Paper process CPU", shortLabel: "Paper CPU", format: (n) => `${n.toFixed(1)}%`, source: "paper-system", percentage: true, series: 4 },
  { field: "memory", label: "Host memory used", shortLabel: "Host memory", format: (n) => bytes(n), source: "host-system", series: 5 },
  { field: "heap", label: "JVM heap used", shortLabel: "JVM heap", format: (n) => bytes(n), source: "paper-system", series: 6 },
];

function sampleValue(sample: Sample, field: HistoryField): number | null {
  const value = sample[field];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function displayTime(at: number, zone: "local" | "utc") {
  const date = new Date(at);
  return zone === "utc"
    ? `${date.toLocaleTimeString(undefined, { timeZone: "UTC" })} UTC`
    : date.toLocaleTimeString();
}

function sampleFreshnessText(at: number, tailAt: number) {
  const age = Math.max(0, tailAt - at);
  if (age < 1_000) return "latest sample";
  if (age < 60_000) return `${Math.floor(age / 1_000)}s before latest`;
  return `${Math.floor(age / 60_000)}m before latest`;
}

function sourceAgeText(capturedAt: number | null) {
  if (capturedAt === null) return "Sample age unavailable";
  const age = Math.max(0, Date.now() - capturedAt);
  if (age < 1_000) return `Last sample ${(age / 1000).toFixed(1)}s ago`;
  if (age < 60_000) return `Last sample ${(age / 1000).toFixed(age < 10_000 ? 1 : 0)}s ago`;
  return `Last sample ${Math.floor(age / 60_000)}m ago`;
}

function capturedAt(recordValue: JsonMap) {
  const raw = str(recordValue.capturedAt, "");
  const parsed = raw ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function trendText(points: readonly TimedValue[]) {
  const values = points.map((point) => point.value).filter((value): value is number => value !== null);
  if (values.length < 2) return "not enough samples for a trend";
  const first = values[0];
  const last = values[values.length - 1];
  const delta = (last - first) / Math.max(1, Math.abs(first));
  if (Math.abs(delta) < 0.02) return "roughly flat";
  return delta > 0 ? "rising" : "falling";
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

function exportHistory(history: Sample[], format: "csv" | "json") {
  const stamp = new Date().toISOString().replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
  if (format === "json") {
    downloadBlob(`plexonpanel-performance-${stamp}.json`, JSON.stringify(history, null, 2), "application/json");
    return;
  }
  const columns: (keyof Sample)[] = ["at", "tps", "mspt", "hostCpu", "processCpu", "heap", "memory", "players", "gc"];
  const rows = history.map((sample) =>
    columns.map((column) => column === "at" ? new Date(sample.at).toISOString() : sample[column] === null ? "" : String(sample[column])).join(","),
  );
  downloadBlob(`plexonpanel-performance-${stamp}.csv`, [columns.join(","), ...rows].join("\n"), "text/csv;charset=utf-8");
}

function SegmentedWindow({ value, onChange }: { value: number; onChange: (value: 1 | 5 | 15 | 30) => void }) {
  return (
    <div className="cr21-segmented" aria-label="Chart time window">
      {([1, 5, 15, 30] as const).map((minutes) => (
        <button key={minutes} type="button" aria-pressed={value === minutes} onClick={() => onChange(minutes)}>{minutes}m</button>
      ))}
    </div>
  );
}

function TelemetryChart({
  history,
  spec,
  windowMinutes,
  status,
  capacity,
  sourceLabel,
  sourceIntervalMs,
  sourceCapturedAt,
}: {
  history: Sample[];
  spec: ChartSpec;
  windowMinutes: number;
  status: "live" | "paused" | "disconnected";
  capacity?: number | null;
  sourceLabel: string;
  sourceIntervalMs: number | null;
  sourceCapturedAt: number | null;
}) {
  const { preferences } = useUiPreferences();
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [inspectIndex, setInspectIndex] = useState<number | null>(null);
  const [documentVisible, setDocumentVisible] = useState(true);
  const [inViewport, setInViewport] = useState(true);
  const points = useMemo(() => windowedPoints(history, windowMinutes), [history, windowMinutes]);
  const series = useMemo<TimedValue[]>(() => points.map((point) => ({ at: point.at, value: sampleValue(point, spec.field) })), [points, spec.field]);
  const values = series.map((point) => point.value).filter((value): value is number => value !== null);
  const stats = seriesStats(series);
  const [lower, upper] = resolveDomain(values, { fixed: spec.domain, percentage: spec.percentage, capacity, reference: spec.reference?.value });
  const end = points.at(-1)?.at ?? history.at(-1)?.at ?? 0;
  const start = points.at(0)?.at ?? Math.max(0, end - windowMinutes * 60_000);
  const xFor = (at: number) => 62 + ((at - start) / Math.max(1, end - start)) * 638;
  const yFor = (value: number) => 178 - ((value - lower) / Math.max(0.001, upper - lower)) * 142;
  const renderSegments = useMemo(
    () => gapSegments(series).map((segment) => thinSegment(segment, 800)),
    [series],
  );
  const paths = buildSvgPaths(renderSegments, xFor, yFor, 178);
  const inspected = inspectIndex === null ? null : points[inspectIndex] ?? null;
  const inspectedValue = inspected ? sampleValue(inspected, spec.field) : null;
  const ticks = [upper, lower + (upper - lower) / 2, lower];
  const descriptionId = `chart-description-${spec.field}`;
  const gradientId = `chart-gradient-${spec.field}`;
  const liveTailActive = status === "live" && documentVisible && inViewport && preferences.livePulse;
  const sourceCadence = sourceIntervalMs === null ? sourceLabel : `${sourceLabel} ~${sourceIntervalMs} ms`;

  useEffect(() => {
    const updateVisibility = () => setDocumentVisible(!document.hidden);
    document.addEventListener("visibilitychange", updateVisibility);
    queueMicrotask(updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    if (!viewportRef.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => setInViewport(entries[0]?.isIntersecting ?? true), { rootMargin: "120px" });
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);

  const moveInspection = (direction: -1 | 1) => {
    if (!series.length) return;
    let index = inspectIndex ?? (direction < 0 ? series.length : -1);
    for (let count = 0; count < series.length; count += 1) {
      index += direction;
      if (index < 0 || index >= series.length) break;
      if (series[index].value !== null) {
        setInspectIndex(index);
        break;
      }
    }
  };

  const noDataTitle = !points.length
    ? status === "disconnected" ? "No samples while disconnected" : "Waiting for first sample"
    : "Metric unavailable in this telemetry window";

  return (
    <Panel
      title={spec.label}
      className="cr21-chart-card"
      aside={
        <div className="cr23-chart-state">
          <span className="cr23-live-tail" data-active={liveTailActive || undefined}><i /> {status === "live" ? "Live tail" : status === "paused" ? "Paused" : "Offline"}</span>
          <Badge tone={status === "live" ? "green" : status === "paused" ? "amber" : "quiet"}>{status === "live" ? "Live" : status === "paused" ? "View paused" : "Disconnected"}</Badge>
        </div>
      }
    >
      <div className="cr21-chart-summary">
        <div><span>Current</span><strong>{stats.current === null ? "Unavailable" : spec.format(stats.current)}</strong></div>
        <dl>
          <div><dt>Min</dt><dd>{stats.minimum === null ? "—" : spec.format(stats.minimum)}</dd></div>
          <div><dt>Avg</dt><dd>{stats.average === null ? "—" : spec.format(stats.average)}</dd></div>
          <div><dt>Max</dt><dd>{stats.maximum === null ? "—" : spec.format(stats.maximum)}</dd></div>
          <div><dt>P95</dt><dd>{stats.p95 === null ? "—" : spec.format(stats.p95)}</dd></div>
        </dl>
      </div>
      <div className="cr21-chart-caption">
        <span>{sourceCadence} · Display {displayRateLabel(preferences.displayUpdateRateMs)}</span>
        <span>{sourceAgeText(sourceCapturedAt)}</span>
      </div>
      {stats.count ? (
        <div className="cr21-chart-stage" ref={viewportRef}>
          <p id={descriptionId} className="sr-only">
            {spec.label} over the last {windowMinutes} minutes is {trendText(series)}. Latest value {stats.current === null ? "unavailable" : spec.format(stats.current)}. {stats.count} available source samples; missing samples are rendered as gaps. Focus the chart and use the left and right arrow keys to inspect samples.
          </p>
          <svg
            ref={svgRef}
            className={`cr21-chart cr23-series-${spec.series}`}
            viewBox="0 0 720 210"
            role="img"
            tabIndex={0}
            aria-describedby={descriptionId}
            aria-label={`${spec.label}: current ${stats.current === null ? "unavailable" : spec.format(stats.current)}, minimum ${stats.minimum === null ? "unavailable" : spec.format(stats.minimum)}, average ${stats.average === null ? "unavailable" : spec.format(stats.average)}, maximum ${stats.maximum === null ? "unavailable" : spec.format(stats.maximum)}`}
            onFocus={() => { if (inspectIndex === null) moveInspection(-1); }}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                moveInspection(event.key === "ArrowLeft" ? -1 : 1);
              }
              if (event.key === "Escape") setInspectIndex(null);
            }}
            onPointerLeave={() => setInspectIndex(null)}
            onPointerMove={(event) => {
              if (!series.length) return;
              const rect = svgRef.current?.getBoundingClientRect();
              if (!rect) return;
              const x = ((event.clientX - rect.left) / rect.width) * 720;
              const ratioX = Math.max(0, Math.min(1, (x - 62) / 638));
              setInspectIndex(nearestValueIndex(series, start + ratioX * Math.max(1, end - start)));
            }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--cr23-series)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--cr23-series)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[36, 107, 178].map((y) => <line key={y} x1="62" x2="700" y1={y} y2={y} className="cr21-gridline" />)}
            {ticks.map((tick, index) => (
              <text key={index} x="55" y={[40, 111, 182][index]} textAnchor="end" className="cr21-axis-label">
                {spec.field === "memory" || spec.field === "heap" ? bytes(tick) : tick.toFixed(tick >= 100 ? 0 : 1)}
              </text>
            ))}
            {spec.reference && spec.reference.value >= lower && spec.reference.value <= upper && (
              <>
                <rect x="62" width="638" y={Math.max(30, yFor(spec.reference.value) - 4)} height="8" className="cr23-reference-band" />
                <line x1="62" x2="700" y1={yFor(spec.reference.value)} y2={yFor(spec.reference.value)} className="cr21-reference-line" />
                <text x="694" y={Math.max(15, yFor(spec.reference.value) - 7)} textAnchor="end" className="cr21-reference-label">{spec.reference.label}</text>
              </>
            )}
            {preferences.chartStyle === "area" && paths.area && <path d={paths.area} fill={`url(#${gradientId})`} className="cr23-chart-area" />}
            <path d={paths.line} className="cr21-trend" />
            {inspected && inspectedValue !== null && (
              <>
                <line x1={xFor(inspected.at)} x2={xFor(inspected.at)} y1="26" y2="178" className="cr21-crosshair" />
                <circle cx={xFor(inspected.at)} cy={yFor(inspectedValue)} r="4" className="cr21-sample-dot" />
              </>
            )}
            <text x="62" y="201" className="cr21-axis-label">{displayTime(start, preferences.timeZone)}</text>
            <text x="700" y="201" textAnchor="end" className="cr21-axis-label">{displayTime(end, preferences.timeZone)}</text>
          </svg>
          {inspected && inspectedValue !== null && (
            <div className="cr21-chart-tooltip" title={`UTC: ${new Date(inspected.at).toISOString()}`}>
              <strong>{displayTime(inspected.at, preferences.timeZone)}</strong>
              <span>{spec.shortLabel}</span>
              <b>{spec.format(inspectedValue)}</b>
              <small>{sampleFreshnessText(inspected.at, end)}</small>
              {inspected.tps !== null && spec.field !== "tps" && <small>TPS {inspected.tps.toFixed(2)}</small>}
              {inspected.mspt !== null && spec.field !== "mspt" && <small>MSPT {inspected.mspt.toFixed(2)} ms</small>}
            </div>
          )}
        </div>
      ) : (
        <Empty title={noDataTitle}>
          {points.length
            ? "This metric is unsupported or absent in the received samples. Other telemetry remains available."
            : status === "disconnected"
              ? "Reconnect the owning agent to resume authoritative telemetry. Existing browser-local samples remain bounded."
              : "Keep this browser open to build bounded browser-local history."}
        </Empty>
      )}
      <div className="cr21-chart-caption"><span>Browser-local rolling history · source timestamps</span><span>{points.length} samples · {stats.count} values</span></div>
    </Panel>
  );
}

function Sparkline({ history, field, label, value, detail, series }: {
  history: Sample[];
  field: HistoryField;
  label: string;
  value: string;
  detail: string;
  series: 1 | 2 | 3 | 4 | 5 | 6;
}) {
  const points = windowedPoints(history, 5);
  const values: TimedValue[] = points.map((point) => ({ at: point.at, value: sampleValue(point, field) }));
  const finite = values.map((point) => point.value).filter((entry): entry is number => entry !== null);
  const [lower, upper] = resolveDomain(finite, { percentage: field === "hostCpu" || field === "processCpu", fixed: field === "tps" ? [0, 20] : undefined });
  const start = points.at(0)?.at ?? 0;
  const end = points.at(-1)?.at ?? start + 1;
  const xFor = (at: number) => 4 + ((at - start) / Math.max(1, end - start)) * 192;
  const yFor = (entry: number) => 46 - ((entry - lower) / Math.max(0.001, upper - lower)) * 40;
  const paths = buildSvgPaths(gapSegments(values).map((segment) => thinSegment(segment, 240)), xFor, yFor, 46);
  return (
    <div className={`cr21-metric-card cr23-spark-card cr23-series-${series}`}>
      <span>{label}</span><strong>{value}</strong>
      <svg viewBox="0 0 200 50" className="cr23-sparkline" role="img" aria-label={`${label} five-minute sparkline; ${finite.length} available samples, with missing data shown as gaps.`}><path d={paths.line} /></svg>
      <small>{detail}</small>
    </div>
  );
}

function HealthSummary({ props }: { props: ViewProps }) {
  const state = props.state;
  const host = state.ready?.agents.host ? state.hostSystem : state.system;
  const tps = Array.isArray(state.server.tps) ? number(state.server.tps[0]) : null;
  const mspt = number(state.server.averageTickMillis);
  const memory = ratio(host.physicalMemoryUsedBytes, host.physicalMemoryTotalBytes);
  const disk = number(host.diskUsedPercent);
  const enough = tps !== null && mspt !== null;
  const checks: { text: string; state: "ok" | "warn" | "bad" }[] = [];
  if (tps !== null) checks.push({ text: `TPS ${tps.toFixed(2)}`, state: tps >= 19 ? "ok" : tps >= 18 ? "warn" : "bad" });
  if (mspt !== null) checks.push({ text: `Tick time ${mspt.toFixed(2)} ms`, state: mspt < 40 ? "ok" : mspt < 50 ? "warn" : "bad" });
  checks.push({ text: state.ready?.agents.paper ? "Paper agent connected" : "Paper agent disconnected", state: state.ready?.agents.paper ? "ok" : "bad" });
  if (state.ready?.agents.hostInstalled) checks.push({ text: state.ready?.agents.host ? "Host companion connected" : "Host companion disconnected", state: state.ready?.agents.host ? "ok" : "warn" });
  if (memory !== null) checks.push({ text: `Memory ${memory.toFixed(0)}% used`, state: memory < 85 ? "ok" : memory < 95 ? "warn" : "bad" });
  if (disk !== null) checks.push({ text: `Disk ${disk.toFixed(0)}% used`, state: disk < 85 ? "ok" : disk < 95 ? "warn" : "bad" });
  const worst = checks.some((check) => check.state === "bad") ? "bad" : checks.some((check) => check.state === "warn") ? "warn" : "ok";
  return (
    <Panel title="Server health" aside={<Badge tone={!enough ? "quiet" : worst === "ok" ? "green" : "amber"}>{!enough ? "Unavailable" : worst === "ok" ? "Healthy" : worst === "warn" ? "Degraded" : "Needs attention"}</Badge>}>
      {!enough ? <Empty title="Health unavailable">Waiting for enough live telemetry to calculate a browser-side health summary.</Empty> : (
        <div className="cr21-health-list">
          {checks.map((check) => <div key={check.text} data-state={check.state}><span>{check.state === "ok" ? "✓" : check.state === "warn" ? "!" : "×"}</span>{check.text}</div>)}
        </div>
      )}
    </Panel>
  );
}

function WorldTable({ worlds }: { worlds: Record<string, unknown>[] }) {
  if (!worlds.length) return <Empty title="No world snapshot yet" />;
  return (
    <div className="cr-table-wrap"><table>
      <thead><tr><th>World</th><th>Chunks</th><th>Entities</th><th>Players</th></tr></thead>
      <tbody>{worlds.map((world) => <tr key={str(world.name)}><td>{str(world.name)}</td><td>{String(world.loadedChunks ?? "—")}</td><td>{String(world.entities ?? "—")}</td><td>{String(world.players ?? "—")}</td></tr>)}</tbody>
    </table></div>
  );
}

export function OverviewView21(props: ViewProps) {
  const { state } = props;
  const host = state.ready?.agents.host ? state.hostSystem : state.system;
  const tps = Array.isArray(state.server.tps) ? number(state.server.tps[0]) : null;
  const mspt = number(state.server.averageTickMillis);
  const hostConnected = Boolean(state.ready?.agents.host);
  const cpuField: HistoryField = hostConnected ? "hostCpu" : "processCpu";
  const cpuValue = hostConnected ? host.hostCpuPercent : state.system.processCpuPercent;
  const memoryField: HistoryField = hostConnected ? "memory" : "heap";
  const memoryValue = hostConnected ? host.physicalMemoryUsedBytes : state.system.jvmHeapUsedBytes;
  const warnings = state.console.filter((line) => line.level === "WARN" || line.level === "ERROR").slice(-5).reverse();
  return (
    <>
      <div className="cr21-metric-grid cr23-overview-signals">
        <Sparkline history={state.history} field="tps" label="TPS / MSPT health" value={tps === null ? "—" : tps.toFixed(2)} detail={mspt === null ? "MSPT unavailable" : `MSPT ${mspt.toFixed(2)} ms`} series={1} />
        <Sparkline history={state.history} field={cpuField} label={hostConnected ? "Host CPU" : "Paper process CPU"} value={metric(cpuValue, "%", 1)} detail={hostConnected ? "Host utilization" : "Paper process utilization"} series={3} />
        <Sparkline history={state.history} field={memoryField} label={hostConnected ? "Host memory" : "JVM heap"} value={bytes(memoryValue)} detail={hostConnected ? "Host memory used" : "JVM heap used"} series={5} />
        <Sparkline history={state.history} field="players" label="Online players" value={number(state.server.onlinePlayers) === null ? "—" : String(state.server.onlinePlayers)} detail={`Maximum ${state.server.maximumPlayers ?? "—"}`} series={6} />
      </div>
      <div className="cr21-metric-grid compact cr23-supporting-signals">
        <div className="cr21-metric-card"><span>Uptime</span><strong>{duration(state.system.processUptimeMillis)}</strong><small>Paper process</small></div>
        <div className="cr21-metric-card"><span>Disk</span><strong>{bytes(host.diskUsedBytes)}</strong><small>{number(host.diskUsableBytes) === null ? "Availability unavailable" : `${bytes(host.diskUsableBytes)} available`}</small></div>
      </div>
      <div className="cr21-two-wide">
        <HealthSummary props={props} />
        <Panel title="Infrastructure status" className="cr21-status-panel">
          <div className="cr21-status-strip">
            <Agent name="Paper agent" online={Boolean(state.ready?.agents.paper)} detail={state.ready?.server.pluginVersion ?? "Waiting for identity"} />
            <Agent name="Host companion" online={Boolean(state.ready?.agents.host)} detail={state.ready?.agents.hostInstalled ? (state.ready.server.hostVersion ?? "Disconnected") : "Not installed"} />
            <div className="cr21-status-item"><span className={`cr-dot ${props.connected ? "online" : ""}`} /><div><strong>Relay</strong><small>Protocol 3</small></div><Badge tone={props.connected ? "green" : "quiet"}>{props.connected ? "Live" : "Disconnected"}</Badge></div>
          </div>
        </Panel>
      </div>
      <div className="cr21-two-wide">
        <Panel title="World activity"><WorldTable worlds={state.worlds} /></Panel>
        <Panel title="Recent warnings">
          {warnings.length ? <div className="cr-events">{warnings.map((line, index) => <div key={`${line.fingerprint}-${index}`}><Badge tone={line.level === "ERROR" ? "amber" : "quiet"}>{str(line.level)}</Badge><p>{str(line.content)}</p><small>{time(line.capturedAt)}</small></div>)}</div> : <Empty title="No warnings in this browser session">Warnings appear here only when the authorized console stream provides them.</Empty>}
        </Panel>
      </div>
      <div className="cr21-inline-actions"><button className="cr-button" onClick={() => void navigator.clipboard.writeText(diagnostics(state)).then(() => props.notice("Safe diagnostics copied."))}>Copy safe diagnostics</button></div>
    </>
  );
}

export function PerformanceView21({ props, resetHistory }: { props: ViewProps; resetHistory: () => void }) {
  const { preferences, updatePreference } = useUiPreferences();
  const windowMinutes = preferences.chartWindowMinutes;
  const [paused, setPaused] = useState(false);
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
  const capacityFor = (field: HistoryField) => field === "memory" && hostConnected ? number(host.physicalMemoryTotalBytes) : field === "heap" && paperConnected ? number(props.state.system.jvmHeapMaximumBytes) : null;
  const sourceRecord = (spec: ChartSpec) => spec.source === "host-system" ? props.state.hostSystem : spec.source === "paper-system" ? props.state.system : props.state.server;
  const sourceLabel = (spec: ChartSpec) => spec.source === "host-system" ? "Host source" : spec.source === "paper-system" ? "Paper JVM source" : "Paper health source";
  const chartStatus = (spec: ChartSpec): "live" | "paused" | "disconnected" => {
    const sourceConnected = spec.source === "host-system" ? hostConnected : paperConnected;
    return !sourceConnected || !props.connected ? "disconnected" : paused ? "paused" : "live";
  };

  return (
    <>
      <div className="cr21-performance-toolbar">
        <div><strong>Performance workspace</strong><span>Browser-local source history · Paper and Host remain independently authoritative</span></div>
        <SegmentedWindow value={windowMinutes} onChange={(value) => updatePreference("chartWindowMinutes", value)} />
        <button className="cr-button" onClick={togglePause}>{paused ? "Resume charts" : "Pause charts"}</button>
        <button className="cr-button" onClick={() => props.notice(props.state.telemetryUpdatedAt ? `Latest pushed telemetry: ${new Date(props.state.telemetryUpdatedAt).toLocaleTimeString()}.` : "Waiting for the first telemetry sample.")}>Refresh latest</button>
        <details className="cr21-menu"><summary className="cr-button">Export / history</summary><div><button onClick={() => exportHistory(history, "csv")}>Export CSV</button><button onClick={() => exportHistory(history, "json")}>Export JSON</button><button onClick={clearHistory}>Reset local history</button></div></details>
        <button className="cr-button" onClick={() => void navigator.clipboard.writeText(diagnostics(props.state)).then(() => props.notice("Safe diagnostics copied."))}>Copy diagnostics</button>
      </div>
      {paused && <div className="cr21-state-banner">Charts paused locally. {props.connected ? "WebSocket telemetry remains connected and authoritative samples continue to arrive." : "The dashboard is disconnected; the visible history remains frozen locally."}</div>}
      <div className="cr21-chart-grid">
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
      <Panel title="Tick and process statistics">
        <div className="cr21-metric-grid compact">
          {[
            ["Minimum", metric(props.state.server.minimumSampleTickMillis, " ms"), "Recent Paper tick sample"],
            ["Average", metric(props.state.server.averageTickMillis, " ms"), "Paper rolling tick time"],
            ["95th percentile", metric(props.state.server.p95TickMillis, " ms"), "Recent Paper tick sample"],
            ["Maximum", metric(props.state.server.maximumSampleTickMillis, " ms"), "Recent Paper tick sample"],
            ["JVM heap used", bytes(props.state.system.jvmHeapUsedBytes), `Committed ${bytes(props.state.system.jvmHeapCommittedBytes)}`],
            ["Paper process RSS", bytes(props.state.system.processRssBytes), `Paper swap ${bytes(props.state.system.swapUsedBytes)}`],
            ["GC pauses", metric(props.state.system.gcPauseTotalMillis, " ms", 0), `${props.state.system.gcCollections ?? "—"} collections since Paper start`],
            ["Host disk used", hostConnected ? bytes(host.diskUsedBytes) : "Unavailable", hostConnected ? `${bytes(host.diskUsableBytes)} available` : "Host companion disconnected"],
          ].map(([label, value, detail]) => <div className="cr21-metric-card" key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>)}
        </div>
      </Panel>
      <Panel title="Host load averages">
        {hostConnected ? (
          <div className="cr21-metric-grid compact">{[1, 5, 15].map((minutes) => <div className="cr21-metric-card" key={minutes}><span>{minutes} minute{minutes > 1 ? "s" : ""}</span><strong>{metric(host[`loadAverage${minutes}m`], "", 2)}</strong><small>Machine-wide runnable and uninterruptible tasks</small></div>)}</div>
        ) : (
          <Empty title="Host companion disconnected">Machine load averages are Host-owned and are not inferred from Paper telemetry.</Empty>
        )}
      </Panel>
      <Panel title="World statistics"><WorldTable worlds={props.state.worlds} /></Panel>
    </>
  );
}

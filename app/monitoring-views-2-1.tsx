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
import { diagnostics, number, str, type Sample } from "../lib/control-state";

type HistoryField = keyof Omit<Sample, "at">;

type ChartSpec = {
  field: HistoryField;
  label: string;
  shortLabel: string;
  format: (value: number) => string;
  domain?: [number, number];
  reference?: { value: number; label: string };
};

const CHARTS: ChartSpec[] = [
  {
    field: "tps",
    label: "TPS",
    shortLabel: "TPS",
    format: (n) => n.toFixed(2),
    domain: [0, 20],
    reference: { value: 18, label: "18 degraded reference" },
  },
  {
    field: "mspt",
    label: "MSPT",
    shortLabel: "MSPT",
    format: (n) => `${n.toFixed(2)} ms`,
    reference: { value: 50, label: "50 ms tick budget" },
  },
  {
    field: "hostCpu",
    label: "Host CPU",
    shortLabel: "CPU",
    format: (n) => `${n.toFixed(1)}%`,
    domain: [0, 100],
  },
  {
    field: "processCpu",
    label: "Paper process CPU",
    shortLabel: "Paper CPU",
    format: (n) => `${n.toFixed(1)}%`,
    domain: [0, 100],
  },
  {
    field: "memory",
    label: "Host memory used",
    shortLabel: "Memory",
    format: (n) => bytes(n),
  },
  {
    field: "heap",
    label: "JVM heap used",
    shortLabel: "Heap",
    format: (n) => bytes(n),
  },
];

function percentile(values: number[], percentileValue: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1),
  );
  return sorted[index];
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
    downloadBlob(
      `plexonpanel-performance-${stamp}.json`,
      JSON.stringify(history, null, 2),
      "application/json",
    );
    return;
  }
  const columns: (keyof Sample)[] = [
    "at",
    "tps",
    "mspt",
    "hostCpu",
    "processCpu",
    "heap",
    "memory",
    "players",
    "gc",
  ];
  const rows = history.map((sample) =>
    columns
      .map((column) =>
        column === "at"
          ? new Date(sample.at).toISOString()
          : sample[column] === null
            ? ""
            : String(sample[column]),
      )
      .join(","),
  );
  downloadBlob(
    `plexonpanel-performance-${stamp}.csv`,
    [columns.join(","), ...rows].join("\n"),
    "text/csv;charset=utf-8",
  );
}

function SegmentedWindow({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="cr21-segmented" aria-label="Chart time window">
      {[1, 5, 15, 30].map((minutes) => (
        <button
          key={minutes}
          type="button"
          aria-pressed={value === minutes}
          onClick={() => onChange(minutes)}
        >
          {minutes}m
        </button>
      ))}
    </div>
  );
}

function TelemetryChart({ history, spec, windowMinutes }: { history: Sample[]; spec: ChartSpec; windowMinutes: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const end = history.at(-1)?.at ?? 0;
  const points = useMemo(
    () => history.filter((point) => point.at >= end - windowMinutes * 60_000),
    [history, end, windowMinutes],
  );
  const samples = points.filter((point) => point[spec.field] !== null);
  const values = samples.map((point) => point[spec.field] as number);
  const current = values.at(-1) ?? null;
  const minimum = values.length ? Math.min(...values) : null;
  const maximum = values.length ? Math.max(...values) : null;
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const p95 = percentile(values, 95);
  const start = points.at(0)?.at ?? end;
  const rawMin = minimum ?? 0;
  const rawMax = maximum ?? 1;
  const padding = Math.max(1, (rawMax - rawMin) * 0.12);
  const lower = spec.domain?.[0] ?? Math.max(0, rawMin - padding);
  const upper = spec.domain?.[1] ?? Math.max(rawMax + padding, spec.reference?.value ?? 0, lower + 1);
  const xFor = (at: number) => 62 + ((at - start) / Math.max(1, end - start)) * 638;
  const yFor = (value: number) => 178 - ((value - lower) / Math.max(0.001, upper - lower)) * 142;
  let path = "";
  let gap = true;
  for (const point of points) {
    const value = point[spec.field];
    if (value === null) {
      gap = true;
      continue;
    }
    path += `${gap ? "M" : "L"}${xFor(point.at).toFixed(1)},${yFor(value).toFixed(1)} `;
    gap = false;
  }
  const hover = hoverIndex === null ? null : points[hoverIndex] ?? null;
  const hoverValue = hover?.[spec.field] ?? null;
  const ticks = [upper, lower + (upper - lower) / 2, lower];

  return (
    <Panel
      title={spec.label}
      className="cr21-chart-card"
      aside={<Badge tone="green">Live</Badge>}
    >
      <div className="cr21-chart-summary">
        <div>
          <span>Current</span>
          <strong>{current === null ? "Unavailable" : spec.format(current)}</strong>
        </div>
        <dl>
          <div><dt>Min</dt><dd>{minimum === null ? "—" : spec.format(minimum)}</dd></div>
          <div><dt>Avg</dt><dd>{average === null ? "—" : spec.format(average)}</dd></div>
          <div><dt>Max</dt><dd>{maximum === null ? "—" : spec.format(maximum)}</dd></div>
          <div><dt>P95</dt><dd>{p95 === null ? "—" : spec.format(p95)}</dd></div>
        </dl>
      </div>
      {values.length ? (
        <div className="cr21-chart-stage">
          <svg
            ref={svgRef}
            className="cr21-chart"
            viewBox="0 0 720 210"
            role="img"
            aria-label={`${spec.label}: current ${current === null ? "unavailable" : spec.format(current)}, minimum ${minimum === null ? "unavailable" : spec.format(minimum)}, average ${average === null ? "unavailable" : spec.format(average)}, maximum ${maximum === null ? "unavailable" : spec.format(maximum)}`}
            onPointerLeave={() => setHoverIndex(null)}
            onPointerMove={(event) => {
              if (!points.length) return;
              const rect = svgRef.current?.getBoundingClientRect();
              if (!rect) return;
              const x = ((event.clientX - rect.left) / rect.width) * 720;
              const ratioX = Math.max(0, Math.min(1, (x - 62) / 638));
              const target = start + ratioX * Math.max(1, end - start);
              let nearest = 0;
              let distance = Number.POSITIVE_INFINITY;
              points.forEach((point, index) => {
                const nextDistance = Math.abs(point.at - target);
                if (nextDistance < distance) {
                  distance = nextDistance;
                  nearest = index;
                }
              });
              setHoverIndex(nearest);
            }}
          >
            {[36, 107, 178].map((y) => (
              <line key={y} x1="62" x2="700" y1={y} y2={y} className="cr21-gridline" />
            ))}
            {ticks.map((tick, index) => (
              <text key={index} x="55" y={[40, 111, 182][index]} textAnchor="end" className="cr21-axis-label">
                {spec.field === "memory" || spec.field === "heap" ? bytes(tick) : tick.toFixed(tick >= 100 ? 0 : 1)}
              </text>
            ))}
            {spec.reference && spec.reference.value >= lower && spec.reference.value <= upper && (
              <>
                <line x1="62" x2="700" y1={yFor(spec.reference.value)} y2={yFor(spec.reference.value)} className="cr21-reference-line" />
                <text x="694" y={Math.max(15, yFor(spec.reference.value) - 5)} textAnchor="end" className="cr21-reference-label">
                  {spec.reference.label}
                </text>
              </>
            )}
            <path d={path} className="cr21-trend" />
            {hover && hoverValue !== null && (
              <>
                <line x1={xFor(hover.at)} x2={xFor(hover.at)} y1="26" y2="178" className="cr21-crosshair" />
                <circle cx={xFor(hover.at)} cy={yFor(hoverValue)} r="4" className="cr21-sample-dot" />
              </>
            )}
            <text x="62" y="201" className="cr21-axis-label">{new Date(start).toLocaleTimeString()}</text>
            <text x="700" y="201" textAnchor="end" className="cr21-axis-label">{new Date(end).toLocaleTimeString()}</text>
          </svg>
          {hover && hoverValue !== null && (
            <div className="cr21-chart-tooltip">
              <strong>{new Date(hover.at).toLocaleTimeString()}</strong>
              <span>{spec.shortLabel}</span>
              <b>{spec.format(hoverValue)}</b>
              {hover.tps !== null && spec.field !== "tps" && <small>TPS {hover.tps.toFixed(2)}</small>}
              {hover.mspt !== null && spec.field !== "mspt" && <small>MSPT {hover.mspt.toFixed(2)} ms</small>}
            </div>
          )}
        </div>
      ) : (
        <Empty title="Waiting for first sample">Keep this browser open to build rolling browser-local history.</Empty>
      )}
      <div className="cr21-chart-caption">
        <span>Browser-local rolling history</span>
        <span>{points.length} samples</span>
      </div>
    </Panel>
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
      {!enough ? (
        <Empty title="Health unavailable">Waiting for enough live telemetry to calculate a browser-side health summary.</Empty>
      ) : (
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
    <div className="cr-table-wrap">
      <table>
        <thead><tr><th>World</th><th>Chunks</th><th>Entities</th><th>Players</th></tr></thead>
        <tbody>
          {worlds.map((world) => (
            <tr key={str(world.name)}>
              <td>{str(world.name)}</td>
              <td>{String(world.loadedChunks ?? "—")}</td>
              <td>{String(world.entities ?? "—")}</td>
              <td>{String(world.players ?? "—")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OverviewView21(props: ViewProps) {
  const { state } = props;
  const host = state.ready?.agents.host ? state.hostSystem : state.system;
  const tps = Array.isArray(state.server.tps) ? state.server.tps[0] : null;
  const warnings = state.console.filter((line) => line.level === "WARN" || line.level === "ERROR").slice(-5).reverse();
  const metrics = [
    ["TPS", metric(tps, "", 2), "1 minute average"],
    ["MSPT", metric(state.server.averageTickMillis, " ms", 2), "Average tick time"],
    ["Players", number(state.server.onlinePlayers) === null ? "—" : `${state.server.onlinePlayers} / ${state.server.maximumPlayers ?? "—"}`, "Current Paper session"],
    ["Uptime", duration(state.system.processUptimeMillis), "Paper process"],
    ["CPU", metric(host.hostCpuPercent, "%"), "Host utilization"],
    ["Memory", bytes(host.physicalMemoryUsedBytes), `${bytes(host.physicalMemoryAvailableBytes)} available`],
    ["Disk", bytes(host.diskUsedBytes), `${bytes(host.diskUsableBytes)} available`],
    ["JVM Heap", bytes(state.system.jvmHeapUsedBytes), `${bytes(state.system.jvmHeapMaximumBytes)} maximum`],
  ];
  return (
    <>
      <div className="cr21-metric-grid">
        {metrics.map(([label, value, detail]) => (
          <div className="cr21-metric-card" key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
        ))}
      </div>
      <div className="cr21-two-wide">
        <TelemetryChart history={state.history} field={undefined as never} spec={CHARTS[0]} windowMinutes={5} />
        <HealthSummary props={props} />
      </div>
      <Panel title="Infrastructure status" className="cr21-status-panel">
        <div className="cr21-status-strip">
          <Agent name="Paper agent" online={Boolean(state.ready?.agents.paper)} detail={state.ready?.server.pluginVersion ?? "Waiting for identity"} />
          <Agent name="Host companion" online={Boolean(state.ready?.agents.host)} detail={state.ready?.agents.hostInstalled ? state.ready.server.hostVersion ?? "Disconnected" : "Not installed"} />
          <div className="cr21-status-item"><span className="cr-dot online" /><div><strong>Relay</strong><small>Protocol 3</small></div><Badge tone="green">Live</Badge></div>
        </div>
      </Panel>
      <div className="cr21-two-wide">
        <Panel title="World activity"><WorldTable worlds={state.worlds} /></Panel>
        <Panel title="Recent warnings">
          {warnings.length ? <div className="cr-events">{warnings.map((line, index) => <div key={`${line.fingerprint}-${index}`}><Badge tone={line.level === "ERROR" ? "amber" : "quiet"}>{str(line.level)}</Badge><p>{str(line.content)}</p><small>{time(line.capturedAt)}</small></div>)}</div> : <Empty title="No warnings in this browser session">Warnings appear here only when the authorized console stream provides them.</Empty>}
        </Panel>
      </div>
      <div className="cr21-inline-actions">
        <button className="cr-button" onClick={() => void navigator.clipboard.writeText(diagnostics(state)).then(() => props.notice("Safe diagnostics copied."))}>Copy safe diagnostics</button>
      </div>
    </>
  );
}

export function PerformanceView21({ props, resetHistory }: { props: ViewProps; resetHistory: () => void }) {
  const [windowMinutes, setWindowMinutes] = useState(() => {
    if (typeof window === "undefined") return 5;
    const stored = Number(localStorage.getItem("plexonpanel-performance-window"));
    return [1, 5, 15, 30].includes(stored) ? stored : 5;
  });
  const [paused, setPaused] = useState(false);
  const [frozenHistory, setFrozenHistory] = useState<Sample[]>(props.state.history);
  useEffect(() => {
    localStorage.setItem("plexonpanel-performance-window", String(windowMinutes));
  }, [windowMinutes]);
  useEffect(() => {
    if (!paused) setFrozenHistory(props.state.history);
  }, [paused, props.state.history]);
  const history = paused ? frozenHistory : props.state.history;
  const host = props.state.ready?.agents.host ? props.state.hostSystem : props.state.system;
  return (
    <>
      <div className="cr21-performance-toolbar">
        <div><strong>Performance workspace</strong><span>Browser-local rolling history · live telemetry remains connected</span></div>
        <SegmentedWindow value={windowMinutes} onChange={setWindowMinutes} />
        <button className="cr-button" onClick={() => setPaused((value) => !value)}>{paused ? "Resume charts" : "Pause charts"}</button>
        <button className="cr-button" onClick={() => props.notice(props.state.updatedAt ? `Latest pushed sample: ${new Date(props.state.updatedAt).toLocaleTimeString()}.` : "Waiting for the first telemetry sample.")}>Refresh latest</button>
        <details className="cr21-menu"><summary className="cr-button">Export / history</summary><div><button onClick={() => exportHistory(history, "csv")}>Export CSV</button><button onClick={() => exportHistory(history, "json")}>Export JSON</button><button onClick={() => { if (window.confirm("Clear only this browser's rolling telemetry history?")) resetHistory(); }}>Reset local history</button></div></details>
        <button className="cr-button" onClick={() => void navigator.clipboard.writeText(diagnostics(props.state)).then(() => props.notice("Safe diagnostics copied."))}>Copy diagnostics</button>
      </div>
      {paused && <div className="cr21-state-banner">Charts paused locally. WebSocket telemetry and server-side collection are still running.</div>}
      <div className="cr21-chart-grid">
        {CHARTS.map((spec) => <TelemetryChart key={spec.field} history={history} spec={spec} windowMinutes={windowMinutes} />)}
      </div>
      <Panel title="Tick statistics">
        <div className="cr21-metric-grid compact">
          {[
            ["Minimum", metric(props.state.server.minimumSampleTickMillis, " ms"), "Recent Paper tick sample"],
            ["Average", metric(props.state.server.averageTickMillis, " ms"), "Paper rolling tick time"],
            ["95th percentile", metric(props.state.server.p95TickMillis, " ms"), "Recent Paper tick sample"],
            ["Maximum", metric(props.state.server.maximumSampleTickMillis, " ms"), "Recent Paper tick sample"],
            ["Heap used", bytes(props.state.system.jvmHeapUsedBytes), `Committed ${bytes(props.state.system.jvmHeapCommittedBytes)}`],
            ["GC pauses", metric(props.state.system.gcPauseTotalMillis, " ms", 0), `${props.state.system.gcCollections ?? "—"} collections since start`],
            ["Disk used", bytes(host.diskUsedBytes), `${bytes(host.diskUsableBytes)} available`],
            ["Process RSS", bytes(props.state.system.processRssBytes), `Swap ${bytes(props.state.system.swapUsedBytes)}`],
          ].map(([label, value, detail]) => <div className="cr21-metric-card" key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>)}
        </div>
      </Panel>
      <Panel title="Load averages">
        <div className="cr21-metric-grid compact">
          {[1, 5, 15].map((minutes) => <div className="cr21-metric-card" key={minutes}><span>{minutes} minute{minutes > 1 ? "s" : ""}</span><strong>{metric(host[`loadAverage${minutes}m`], "", 2)}</strong><small>Runnable and uninterruptible tasks</small></div>)}
        </div>
      </Panel>
      <Panel title="World statistics"><WorldTable worlds={props.state.worlds} /></Panel>
    </>
  );
}

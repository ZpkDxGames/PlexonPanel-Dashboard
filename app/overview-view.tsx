"use client";
import { useState } from "react";
import { Badge, Empty, Panel, bytes, duration, time, type ViewProps } from "./control-views";
import { ActivityHistoryModal } from "./activity-history-modal";
import { TelemetryChart, type ChartSpec } from "./telemetry-chart";
import { capturedAtMillis, diagnostics, number, record, str, type Sample } from "../lib/control-state";
import { METRICS, metricSeries, type MetricField } from "../lib/metric-reports";
import { buildSvgPaths, gapSegments, resolveDomain, thinSegment } from "../lib/chart-geometry";
import { telemetryFreshness } from "../lib/telemetry-freshness";
import { useTelemetryNow } from "../lib/telemetry-clock";
import { fleetCard } from "../lib/fleet-model";
import { useUiPreferences } from "../components/ui-preferences-provider";

function MetricTile({ label, value, detail, history, field, now, fresh }: {
  label: string; value: string; detail: string; history: Sample[]; field: MetricField; now: number; fresh: boolean;
}) {
  const points = metricSeries(history, field, 5, now);
  const values = points.flatMap(p => p.value === null ? [] : [p.value]);
  const [low, high] = resolveDomain(values, { fixed: field === "tps" ? [0, 20] : undefined });
  const first = points[0]?.at ?? now;
  const paths = buildSvgPaths(gapSegments(points, Math.max(1000, METRICS[field].intervalMs * 3)).map(segment => thinSegment(segment, 160)),
    at => 2 + (at - first) / Math.max(1, now - first) * 196, value => 40 - (value - low) / (high - low) * 34, 40);
  return <article className="metric-tile" data-stale={!fresh || undefined}>
    <div className="metric-label"><span>{label}</span><span className="metric-origin">{METRICS[field].source === "service" ? "HOST" : "PAPER"}</span></div>
    <strong>{fresh ? value : "—"}</strong><small>{detail}</small>
    <svg viewBox="0 0 200 44" preserveAspectRatio="none" role="img" aria-label={`${label}: browser-observed five-minute history, ${values.length} source values. Gaps remain empty.`}><path d={paths.line} /></svg>
  </article>;
}
const OVERVIEW_CHARTS: ChartSpec[] = [
  { field: "tps", label: "Tick health", shortLabel: "TPS", format: n => `${n.toFixed(2)} TPS`, source: "paper-health", domain: [0, 20], series: 1 },
  { field: "mspt", label: "Tick duration", shortLabel: "MSPT", format: n => `${n.toFixed(2)} ms`, source: "paper-health", reference: { value: 50, label: "50 ms tick budget" }, series: 2 },
];
export function OverviewView(props: ViewProps) {
  const { state } = props;
  const { preferences } = useUiPreferences();
  const now = useTelemetryNow(state.updatedAt);
  const [historyOpen, setHistoryOpen] = useState(false);
  const card = fleetCard(state, props.connected ? "live" : "reconnecting", now);
  const paper = props.connected && !state.cached && Boolean(state.ready?.agents.paper);
  const host = props.connected && !state.cached && Boolean(state.ready?.agents.host);
  const healthFresh = telemetryFreshness(state.server.capturedAt, paper, now);
  const jvmFresh = telemetryFreshness(state.system.capturedAt, paper, now);
  const valid = (freshness: ReturnType<typeof telemetryFreshness>) => freshness.kind === "live" || freshness.kind === "delayed";
  const tps = card.tps, mspt = card.mspt;
  const warnings = [
    ...(tps !== null && tps < 18 ? [{ title: "TPS below target", detail: `${tps.toFixed(2)} ticks/s from Paper's latest capture.` }] : []),
    ...(mspt !== null && mspt > 50 ? [{ title: "Tick budget exceeded", detail: `${mspt.toFixed(2)} ms from Paper's latest capture; budget is 50 ms.` }] : []),
  ];
  const activity = state.presenceDeltas.slice(-6).reverse();
  const resource = record(state.service.resources);
  return <div className="overview-workspace">
    <section className="overview-context" aria-label="Instance context">
      <div><span className="workspace-kicker">SELECTED INSTANCE</span><strong>{state.ready?.server.instanceKey ?? "Identity unavailable"}</strong><small>{state.serverId.slice(0, 8)} · Signed source</small></div>
      <dl><div><dt>Service</dt><dd>{card.serviceState}</dd></div><div><dt>Paper uptime</dt><dd>{valid(jvmFresh) ? duration(state.system.processUptimeMillis) : "—"}</dd></div><div><dt>Version</dt><dd>{state.ready?.server.minecraftVersion ?? "—"}</dd></div></dl>
    </section>
    <section className="metric-grid" aria-label="Primary server signals">
      <MetricTile label="TPS" value={tps === null ? "—" : tps.toFixed(2)} detail={`20 ticks/s target · ${healthFresh.label}`} history={state.history} field="tps" now={now} fresh={valid(healthFresh)} />
      <MetricTile label="MSPT" value={mspt === null ? "—" : `${mspt.toFixed(2)} ms`} detail={`50 ms tick budget · ${healthFresh.label}`} history={state.history} field="mspt" now={now} fresh={valid(healthFresh)} />
      <MetricTile label="Online players" value={card.players === null ? "—" : String(card.players)} detail={`${number(state.server.maximumPlayers) ?? "Unknown"} slots · ${healthFresh.label}`} history={state.history} field="players" now={now} fresh={valid(healthFresh)} />
      <MetricTile label="JVM heap" value={bytes(state.system.jvmHeapUsedBytes)} detail={`${bytes(state.system.jvmHeapMaximumBytes)} capacity · ${jvmFresh.label}`} history={state.history} field="heap" now={now} fresh={valid(jvmFresh)} />
      <MetricTile label="Service CPU" value={card.serviceCpu === null ? "—" : `${card.serviceCpu.toFixed(1)}%`} detail="Minecraft cgroup · 100% = one core" history={state.history} field="serviceCpu" now={now} fresh={card.serviceCpu !== null} />
      <MetricTile label="Service RAM" value={bytes(card.serviceMemory)} detail="Minecraft cgroup · separate from heap" history={state.history} field="serviceMemory" now={now} fresh={card.serviceMemory !== null} />
    </section>
    {warnings.length > 0 && <section className="overview-insights" aria-label="Derived telemetry warnings">{warnings.map(warning => <div key={warning.title}><Badge tone="amber">Derived warning</Badge><strong>{warning.title}</strong><span>{warning.detail}</span></div>)}</section>}
    <div className="workspace-chart-grid overview-trends">{OVERVIEW_CHARTS.map(spec => <TelemetryChart key={spec.field} history={state.history} spec={spec} windowMinutes={preferences.chartWindowMinutes} sourceLabel="Paper health · source capture" sourceIntervalMs={number(state.server.sourceIntervalMillis)} sourceCapturedAt={capturedAtMillis(state.server.capturedAt)} status={!paper ? "disconnected" : valid(healthFresh) ? "live" : "stale"} />)}</div>
    <div className="overview-details-grid">
      <Panel title="Recent activity" aside={<button className="ui-text-button" onClick={() => setHistoryOpen(true)}>View history</button>}>
        {activity.length ? <div className="activity-list">{activity.map(event => <article key={str(event.eventId, `${event.uuid}-${event.observedAt}`)}><span className="activity-initial" aria-hidden>{str(event.name, "?").slice(0, 1)}</span><div><strong>{str(event.name, "Player")}</strong><small>Observed {event.state === "LEFT" ? "leave" : "join"} · Paper</small></div><time>{time(event.observedAt)}</time></article>)}</div> : <Empty title="No recent presence activity">Authorized Paper join and leave observations appear here.</Empty>}
      </Panel>
      <Panel title="World activity" aside={<Badge>{state.worlds.length} worlds</Badge>}>
        {valid(healthFresh) && state.worlds.length ? <div className="ui-table-wrap"><table><thead><tr><th>World</th><th>Players</th><th>Chunks</th><th>Entities</th></tr></thead><tbody>{state.worlds.slice(0, 8).map(world => <tr key={str(world.name)}><td>{str(world.name)}</td><td>{String(world.players ?? "—")}</td><td>{String(world.loadedChunks ?? "—")}</td><td>{String(world.entities ?? "—")}</td></tr>)}</tbody></table></div> : <Empty title="Waiting for world telemetry">Fresh Paper world samples are required.</Empty>}
      </Panel>
    </div>
    <details className="workspace-disclosure overview-sources"><summary>Source details and safe diagnostics</summary><dl className="ui-details"><div><dt>Paper health</dt><dd>{healthFresh.label}</dd></div><div><dt>Paper JVM</dt><dd>{jvmFresh.label}</dd></div><div><dt>Host service</dt><dd>{telemetryFreshness(resource.capturedAt, host, now).label}</dd></div><div><dt>Shared node</dt><dd>{telemetryFreshness(state.hostSystem.capturedAt, host, now).label} · shown once in Fleet</dd></div></dl><button className="ui-button" onClick={() => void navigator.clipboard.writeText(diagnostics(state)).then(() => props.notice("Safe diagnostics copied."))}>Copy safe diagnostics</button></details>
    {historyOpen && <ActivityHistoryModal props={props} open onClose={() => setHistoryOpen(false)} />}
  </div>;
}

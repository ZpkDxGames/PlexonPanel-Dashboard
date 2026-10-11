import { useMemo, useState } from "react";
import { useSession, useNow } from "../hooks";
import { number, str, type Sample } from "../adapter/control-state";
import { bytes, entityDensity, metric, sourceStatus } from "../store/selectors";
import { Button, Panel, Status } from "../components/ui";
import { CrosshairGroup, TimeSeries } from "../components/charts/TimeSeries";
import { ActionReview } from "../features/ActionReview";
import { session, type Prepared } from "../adapter/session";
import { classifyTelemetry } from "../adapter/telemetry-freshness";
import { metricPoints, observedSpikes, summarize, type MetricKey } from "../lib/telemetryView";
import { Sparkline } from "../components/charts/Sparkline";
import { tickSeries, cpuSeries, memorySeries } from "../components/charts/presets";

function Kpi({ label, reading, source, detail, samples, spark, live = false }: { label: string; reading: {value:string;unit:string;available:boolean}; source: string; detail: string; samples?: Sample[]; spark?: MetricKey; live?: boolean }) {
  return <div className={reading.available ? `kpi is-available ${live ? "is-live" : "is-historical"}` : "kpi is-unavailable"}><div className="kpi-label"><span>{label}</span><i aria-hidden="true" /></div><div className="kpi-value"><strong>{reading.value}</strong>{reading.unit && <em>{reading.unit}</em>}</div><small>{source} · {detail}</small>{samples && spark && <Sparkline samples={samples} metric={spark} active={live}/>}</div>;
}

export default function Overview() {
  const snap = useSession(); const now = useNow(); const state = snap.state;
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const paper = sourceStatus(state, "Paper", snap.phase === "live" && Boolean(state.ready?.agents.paper), now);
  const host = sourceStatus(state, "Host", snap.phase === "live" && Boolean(state.ready?.agents.host), now);
  const jvm = classifyTelemetry({capturedAt: state.system.capturedAt, receivedAt: state.receipts?.paperSystem, connected: snap.phase === "live" && Boolean(state.ready?.agents.paper), now});
  const tps = number(Array.isArray(state.server.tps) ? state.server.tps[0] : null);
  const mspt = number(state.server.averageTickMillis);
  const heap = bytes(state.system.jvmHeapUsedBytes);
  const chunkValues = state.worlds.map((world) => number(world.loadedChunks));
  const chunks = chunkValues.length && chunkValues.every((v) => v !== null) ? chunkValues.reduce<number>((total, value) => total + value!, 0) : null;
  const lag = useMemo(() => observedSpikes(state.history), [state.history]);
  const observedPeak = useMemo(() => summarize(metricPoints(state.history, "players"))?.max ?? null, [state.history]);
  const lifecycle = (action: string) => { try { setPrepared(session.prepare(action, {}, "HOST")); } catch { /* Disabled controls explain authority. */ } };
  return <>
    <section className="kpi-strip" aria-label="Current server condition">
      <Kpi label="Tick rate" reading={metric(tps, "TPS", 2)} source="Paper" detail={paper.label} samples={state.history} spark="tps" live={paper.usable} />
      <Kpi label="Tick duration" reading={metric(mspt, "ms", 1)} source="Paper" detail={`mean · ${paper.kind}`} samples={state.history} spark="mspt" live={paper.usable} />
      <Kpi label="Online players" reading={metric(number(state.server.onlinePlayers), "players", 0)} source="Paper" detail={paper.label} samples={state.history} spark="players" live={paper.usable} />
      <Kpi label="Process CPU" reading={metric(number(state.system.processCpuPercent), "%", 1)} source="Paper JVM" detail={jvm.label} samples={state.history} spark="processCpu" live={jvm.usable} />
      <Kpi label="JVM heap" reading={heap} source="Paper JVM" detail={`used · ${jvm.kind}`} samples={state.history} spark="heap" live={jvm.usable} />
      <Kpi label="Loaded chunks" reading={metric(chunks, "chunks", 0)} source="Paper" detail={`${state.worlds.length} worlds${chunks === null ? " · partial" : ""}`} />
    </section>
    <CrosshairGroup><div className="overview-grid">
      <Panel eyebrow="Live session" title="Tick health" className="tick-panel" action={<Status tone={paper.kind === "live" ? "success" : paper.kind === "skew" ? "warning" : "neutral"}>{paper.label}</Status>}>
        <TimeSeries title="TPS and mean tick duration" samples={state.history} yMax={20} threshold={50} series={tickSeries} />
      </Panel>
      <Panel eyebrow="Observed evidence" title="What needs attention" className="evidence-panel"><div className="evidence-list">
        <div><span>Mean-MSPT spikes</span><strong>{lag.length}</strong><small>Samples above 50 ms; cause unknown</small></div>
        <div><span>Observed peak</span><strong>{observedPeak ?? "—"}</strong><small>Players within retained session</small></div>
        <div><span>Service</span><strong>{str(state.service.state, "Unknown")}</strong><small>Host · {host.label}</small></div>
        <div><span>Data coverage</span><strong>{state.history.length}</strong><small>Retained observations · source clocks differ</small></div>
      </div></Panel>
      <Panel eyebrow="Resources" title="CPU sources"><TimeSeries title="CPU utilization" source="Paper JVM + Host" height={210} samples={state.history} yMax={100} series={cpuSeries} /></Panel>
      <Panel eyebrow="Resources" title="Memory sources"><TimeSeries title="Memory utilization" source="Paper JVM + Host" height={210} samples={state.history} series={memorySeries} /></Panel>
    </div></CrosshairGroup>
    <div className="lower-grid">
      <Panel eyebrow="World evidence" title="Entities and loaded chunks"><div className="table-region" tabIndex={0}><table><thead><tr><th>World</th><th>Chunks</th><th>Entities</th><th>Entities / chunk</th></tr></thead><tbody>{state.worlds.length ? state.worlds.map((world) => { const density=entityDensity(world.entities,world.loadedChunks); return <tr key={str(world.name)}><td>{str(world.name)}</td><td>{number(world.loadedChunks)?.toLocaleString() ?? "Unknown"}</td><td>{number(world.entities)?.toLocaleString() ?? "Unknown"}</td><td>{density === null ? "Unknown" : density.toFixed(2)}</td></tr>; }) : <tr><td colSpan={4}>Waiting for world telemetry.</td></tr>}</tbody></table></div></Panel>
      <Panel eyebrow="Host authority" title="Server lifecycle"><div className="lifecycle"><p>Controls require current Host service evidence and a matching signed grant.</p><div><Button onClick={() => lifecycle("server.start")} disabled={Boolean(session.reason("server.start","HOST"))} title={session.reason("server.start","HOST")}>Start</Button><Button onClick={() => lifecycle("server.restart")} disabled={Boolean(session.reason("server.restart","HOST"))} title={session.reason("server.restart","HOST")}>Restart</Button><Button variant="danger" onClick={() => lifecycle("server.stop")} disabled={Boolean(session.reason("server.stop","HOST"))} title={session.reason("server.stop","HOST")}>Stop</Button></div><small>{session.reason("server.restart","HOST") || "Agent completion will be shown after dispatch."}</small></div></Panel>
    </div>
    <ActionReview prepared={prepared} onClose={() => setPrepared(null)} />
  </>;
}

import { useMemo, useState } from "react";
import { useSession, useNow } from "../hooks";
import { number, str } from "../adapter/control-state";
import { bytes, entityDensity, metric, sourceStatus } from "../store/selectors";
import { Button, Panel, Status } from "../components/ui";
import { CrosshairGroup, TimeSeries } from "../components/charts/TimeSeries";
import { ActionReview } from "../features/ActionReview";
import { session, type Prepared } from "../adapter/session";

function MiniTrend({ values }: { values: (number | null)[] }) {
  const recent = values.slice(-30);
  const numeric = recent.filter((value): value is number => typeof value === "number");
  if (numeric.length < 2) return <span className="mini-trend unavailable" aria-hidden="true" />;
  const min = Math.min(...numeric), max = Math.max(...numeric), range = Math.max(1, max - min);
  let path = "", drawing = false;
  recent.forEach((value, index) => {
    if (typeof value !== "number") { drawing = false; return; }
    const x = recent.length === 1 ? 0 : index / (recent.length - 1) * 100;
    const y = 25 - ((value - min) / range) * 20;
    path += `${drawing ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    drawing = true;
  });
  return <svg className="mini-trend" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path d={path} pathLength="1" /></svg>;
}

function Kpi({ label, reading, source, detail, trend }: { label: string; reading: {value:string;unit:string;available:boolean}; source: string; detail: string; trend?: (number | null)[] }) {
  return <div className="kpi" data-available={reading.available}><span>{label}</span><div className="kpi-value"><strong>{reading.value}</strong>{reading.unit && <em>{reading.unit}</em>}</div><small>{source} · {detail}</small>{trend && <MiniTrend values={trend} />}</div>;
}

export default function Overview() {
  const snap = useSession(); const now = useNow(); const state = snap.state;
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const paper = sourceStatus(state, "Paper", Boolean(state.ready?.agents.paper), now);
  const host = sourceStatus(state, "Host", Boolean(state.ready?.agents.host), now);
  const tps = number(Array.isArray(state.server.tps) ? state.server.tps[0] : null);
  const mspt = number(state.server.averageTickMillis);
  const heap = bytes(state.system.jvmHeapUsedBytes);
  const hostCpu = number(state.hostSystem.hostCpuPercent);
  const chunks = state.worlds.reduce((total, world) => total + (number(world.loadedChunks) ?? 0), 0);
  const lag = useMemo(() => state.history.filter((sample) => typeof sample.mspt === "number" && sample.mspt > 50), [state.history]);
  const observedPeak = useMemo(() => Math.max(0, ...state.history.map((sample) => sample.players ?? 0)), [state.history]);
  const lifecycle = (action: string) => { try { setPrepared(session.prepare(action, {}, "HOST")); } catch { /* Disabled controls explain authority. */ } };
  return <>
    <section className="kpi-strip" aria-label="Current server condition">
      <Kpi label="Tick rate" reading={metric(tps, "TPS", 2)} source="Paper" detail={paper.label} trend={state.history.map((sample) => sample.tps)} />
      <Kpi label="Mean tick time" reading={metric(mspt, "ms", 1)} source="Paper" detail="observed mean" trend={state.history.map((sample) => sample.mspt)} />
      <Kpi label="Online players" reading={metric(number(state.server.onlinePlayers), "players", 0)} source="Paper" detail="current" trend={state.history.map((sample) => sample.players)} />
      <Kpi label="Paper process CPU" reading={metric(number(state.system.processCpuPercent), "%", 1)} source="Paper JVM" detail={paper.label} trend={state.history.map((sample) => sample.processCpu)} />
      <Kpi label="Host CPU" reading={metric(hostCpu, "%", 1)} source="Host machine" detail={host.label} trend={state.history.map((sample) => sample.hostCpu)} />
      <Kpi label="JVM heap used" reading={heap} source="Paper JVM" detail={heap.available ? "process memory" : "waiting"} trend={state.history.map((sample) => sample.heap)} />
    </section>
    <CrosshairGroup><div className="overview-grid">
      <Panel eyebrow="Live session" title="Tick health" description="Paper tick rate and observed mean duration" className="tick-panel" action={<Status tone={paper.kind === "live" ? "success" : paper.kind === "skew" ? "warning" : "neutral"}>{paper.label}</Status>}>
        <TimeSeries title="TPS and mean tick duration" samples={state.history} yMax={100} threshold={50} series={[{key:"tps",label:"TPS",unit:"TPS",color:"var(--chart-1)"},{key:"mspt",label:"Mean MSPT",unit:"ms",color:"var(--chart-3)"}]} />
      </Panel>
      <Panel eyebrow="Observed evidence" title="What needs attention" className="evidence-panel"><div className="evidence-list">
        <div><span>Mean-MSPT spikes</span><strong>{lag.length}</strong><small>Samples above 50 ms; cause unknown</small></div>
        <div><span>Observed peak</span><strong>{observedPeak || "—"}</strong><small>Players within retained session</small></div>
        <div><span>Service</span><strong>{str(state.service.state, "Unknown")}</strong><small>Host · {host.label}</small></div>
        <div><span>Data coverage</span><strong>{state.history.length}</strong><small>Captured samples</small></div>
      </div></Panel>
      <Panel eyebrow="Resources" title="CPU sources" description="Machine-wide Host and Paper process values stay separate"><TimeSeries title="CPU utilization" source="Paper JVM + Host" height={210} samples={state.history} yMax={100} series={[{key:"processCpu",label:"Paper process",unit:"%",color:"var(--chart-2)"},{key:"hostCpu",label:"Host machine",unit:"%",color:"var(--chart-4)"}]} /></Panel>
      <Panel eyebrow="Resources" title="Memory sources" description="JVM heap and machine memory are independently sourced"><TimeSeries title="Memory utilization" source="Paper JVM + Host" height={210} samples={state.history} series={[{key:"heap",label:"JVM heap",unit:"bytes",color:"var(--chart-1)"},{key:"memory",label:"Host used",unit:"bytes",color:"var(--chart-3)"}]} /></Panel>
    </div></CrosshairGroup>
    <div className="lower-grid">
      <Panel eyebrow="World evidence" title="Entities and loaded chunks" action={<span className="subtle">{state.worlds.length ? `${chunks.toLocaleString()} loaded chunks` : "Unavailable"}</span>}><div className="table-region" tabIndex={0}><table><thead><tr><th>World</th><th>Chunks</th><th>Entities</th><th>Entities / chunk</th></tr></thead><tbody>{state.worlds.length ? state.worlds.map((world) => { const density=entityDensity(world.entities,world.loadedChunks); return <tr key={str(world.name)}><td>{str(world.name)}</td><td>{number(world.loadedChunks)?.toLocaleString() ?? "Unknown"}</td><td>{number(world.entities)?.toLocaleString() ?? "Unknown"}</td><td>{density === null ? "Unknown" : density.toFixed(2)}</td></tr>; }) : <tr><td colSpan={4}>Waiting for world telemetry.</td></tr>}</tbody></table></div></Panel>
      <Panel eyebrow="Host authority" title="Server lifecycle"><div className="lifecycle"><p>Controls require current Host service evidence and a matching signed grant.</p><div><Button onClick={() => lifecycle("server.start")} disabled={Boolean(session.reason("server.start","HOST"))} title={session.reason("server.start","HOST")}>Start</Button><Button onClick={() => lifecycle("server.restart")} disabled={Boolean(session.reason("server.restart","HOST"))} title={session.reason("server.restart","HOST")}>Restart</Button><Button variant="danger" onClick={() => lifecycle("server.stop")} disabled={Boolean(session.reason("server.stop","HOST"))} title={session.reason("server.stop","HOST")}>Stop</Button></div><small>{session.reason("server.restart","HOST") || "Agent completion will be shown after dispatch."}</small></div></Panel>
    </div>
    <ActionReview prepared={prepared} onClose={() => setPrepared(null)} />
  </>;
}

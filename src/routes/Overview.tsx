import { useMemo, useState } from "react";
import { useSession, useNow } from "../hooks";
import { number, str } from "../adapter/control-state";
import { classifyTelemetry } from "../adapter/telemetry-freshness";
import { bytes, entityDensity, metric, sourceStatus } from "../store/selectors";
import { Button, Panel, Status } from "../components/ui";
import { Icon } from "../components/Icon";
import { PlayerHead } from "../components/PlayerHead";
import { CrosshairGroup, TimeSeries } from "../components/charts/TimeSeries";
import { ActionReview } from "../features/ActionReview";
import { session, type Prepared } from "../adapter/session";
import { navigate } from "../router";

function Kpi({ label, icon, reading, detail, ratio }: { label: string; icon: string; reading: { value: string; unit: string; available: boolean }; detail: string; ratio?: number | null }) {
  return <div className="kpi"><div className="kpi-label"><span>{label}</span><Icon name={icon} /></div><div className="kpi-value"><strong>{reading.value}</strong>{reading.unit && <em>{reading.unit}</em>}</div><small title={detail}>{detail}</small>{ratio != null && reading.available && <div className="metric-meter" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }} /></div>}</div>;
}

export default function Overview() {
  const snap = useSession(); const now = useNow(); const state = snap.state;
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [selected, setSelected] = useState<"tps" | "mspt">("tps");
  const [minutes, setMinutes] = useState(15);
  const connected = snap.phase === "live";
  const paper = sourceStatus(state, "Paper", connected && Boolean(state.ready?.agents.paper), now);
  const host = sourceStatus(state, "Host", connected && Boolean(state.ready?.agents.host), now);
  const system = classifyTelemetry({ capturedAt: state.system.capturedAt, receivedAt: state.receipts?.paperSystem, connected: connected && Boolean(state.ready?.agents.paper), now });
  const tps = number(Array.isArray(state.server.tps) ? state.server.tps[0] : null);
  const mspt = number(state.server.averageTickMillis);
  const online = number(state.server.onlinePlayers);
  const capacity = number(state.server.maxPlayers);
  const cpu = number(state.system.processCpuPercent);
  const heapUsed = number(state.system.jvmHeapUsedBytes);
  const heapMax = number(state.system.jvmHeapMaximumBytes);
  const heap = bytes(heapUsed);
  const chunks = state.worlds.reduce((total, world) => total + (number(world.loadedChunks) ?? 0), 0);
  const samples = useMemo(() => state.history.filter((sample) => sample.at >= now - minutes * 60_000), [state.history, now, minutes]);
  const lag = samples.filter((sample) => typeof sample.mspt === "number" && sample.mspt > 50);
  const readings = samples.map((sample) => sample[selected]).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const average = readings.length ? readings.reduce((sum, value) => sum + value, 0) / readings.length : null;
  const isLive = paper.kind === "live";
  const health = !isLive ? "Telemetry needs attention" : tps === null || mspt === null ? "Waiting for tick readings" : mspt > 50 || tps < 18 ? "Performance needs attention" : "Tick health looks good";
  const lifecycle = (action: string) => { try { setPrepared(session.prepare(action, {}, "HOST")); } catch { /* Authority is checked again at dispatch. */ } };
  const serverName = str(state.ready?.server.serverName, snap.labels[state.serverId] || "Selected server");
  const tickSeries = selected === "tps" ? [{ key: "tps" as const, label: "Tick rate", unit: "TPS", color: "var(--chart-cyan)" }] : [{ key: "mspt" as const, label: "Mean tick duration", unit: "ms", color: "var(--chart-amber)" }];

  return <>
    <section className="server-summary" aria-label="Selected server and controls">
      <div className="server-identity"><span className="server-emblem"><Icon name="layers" /></span><div><div className="server-title"><h2>{serverName}</h2><Status tone={isLive ? "success" : "warning"}>{isLive ? "Receiving telemetry" : paper.kind === "disconnected" ? "Disconnected" : "Check telemetry"}</Status></div><p><span>Minecraft {str(state.ready?.server.minecraftVersion, "version unknown")}</span><span>Last service state: {str(state.service.state, "unknown")}</span></p></div></div>
      <div className="server-controls"><Button variant="quiet" onClick={() => navigate("Console")}><Icon name="console" />Console</Button>{([{ action: "start", label: "Start", icon: "play" }, { action: "restart", label: "Restart", icon: "restart" }, { action: "stop", label: "Stop", icon: "stop" }] as const).map(({ action, label, icon }) => { const reason = session.reason(`server.${action}`, "HOST"); return <Button key={action} variant={action === "stop" ? "danger" : "secondary"} onClick={() => lifecycle(`server.${action}`)} disabled={Boolean(reason)} title={reason || `${label} server`}><Icon name={icon} />{label}</Button>; })}</div>
      {session.reason("server.restart", "HOST") && <p className="server-control-note"><Icon name="access" />{session.reason("server.restart", "HOST")}</p>}
    </section>
    <section className="kpi-strip" aria-label="Current server condition">
      <Kpi label="Tick rate" icon="performance" reading={metric(tps, "TPS", 2)} detail={isLive ? "Target 20 TPS · Paper" : `Last reading · ${paper.label}`} ratio={tps === null ? null : tps / 20} />
      <Kpi label="Players online" icon="players" reading={metric(online, capacity === null ? "players" : `/ ${capacity}`, 0)} detail={isLive ? "Connected to this server" : `Last reading · ${paper.label}`} ratio={online === null || !capacity ? null : online / capacity} />
      <Kpi label="Process CPU" icon="cpu" reading={metric(cpu, "%", 1)} detail={system.kind === "live" ? "Minecraft JVM process" : `Last reading · ${system.label}`} ratio={cpu === null ? null : cpu / 100} />
      <Kpi label="Memory used" icon="memory" reading={heap} detail={system.kind !== "live" ? `Last reading · ${system.label}` : heapMax ? `of ${bytes(heapMax).value} ${bytes(heapMax).unit} JVM heap` : "JVM heap · capacity unknown"} ratio={heapUsed === null || !heapMax ? null : heapUsed / heapMax} />
    </section>
    <CrosshairGroup>
      <div className="overview-grid">
        <Panel eyebrow="Performance" title="Server activity" className="tick-panel" action={<button className="text-link" onClick={() => navigate("Performance")}>Explore <Icon name="chevron" /></button>}>
          <div className="overview-chart-controls"><div className="segmented" role="group" aria-label="Performance metric">{(["tps", "mspt"] as const).map((key) => <button key={key} className={selected === key ? "active" : ""} aria-pressed={selected === key} onClick={() => setSelected(key)}>{key === "tps" ? "Tick rate" : "Tick duration"}</button>)}</div><div className="segmented chart-ranges" role="group" aria-label="Overview time range">{[5, 15, 35].map((value) => <button key={value} className={minutes === value ? "active" : ""} aria-pressed={minutes === value} onClick={() => setMinutes(value)}>{value}m</button>)}</div></div>
          <div className="chart-stats"><div><span>Latest reading</span><strong>{metric(selected === "tps" ? tps : mspt, "", selected === "tps" ? 2 : 1).value}<small>{selected === "tps" ? "TPS" : "ms"}</small></strong></div><div><span>Window average</span><strong>{metric(average, "", 2).value}</strong></div><div><span>Window low</span><strong>{metric(readings.length ? Math.min(...readings) : null, "", 2).value}</strong></div></div>
          <TimeSeries title={selected === "tps" ? "Tick rate" : "Mean tick duration"} samples={samples} yMax={selected === "tps" ? 20 : 100} threshold={selected === "mspt" ? 50 : undefined} series={tickSeries} height={230} />
        </Panel>
        <Panel eyebrow="At a glance" title="Server health" className="health-panel"><div className={`health-summary ${isLive && tps !== null && mspt !== null && mspt <= 50 && tps >= 18 ? "healthy" : "attention"}`}><span className="health-icon"><Icon name={isLive && tps !== null && mspt !== null && mspt <= 50 && tps >= 18 ? "access" : "alert"} /></span><strong>{health}</strong><p>{!isLive ? paper.label : "Based on the latest tick rate and mean tick duration."}</p></div><dl className="health-facts"><div><dt>Mean tick duration</dt><dd>{metric(mspt, "", 1).value} <small>ms</small></dd></div><div><dt>Above tick budget</dt><dd>{samples.some((sample) => typeof sample.mspt === "number") ? lag.length : "—"} <small>samples</small></dd></div><div><dt>Loaded chunks</dt><dd>{state.worlds.length ? chunks.toLocaleString() : "—"}</dd></div><div><dt>Host telemetry</dt><dd className="health-source">{host.label}</dd></div></dl><p className="health-footnote">Tick budget: 50 ms. History covers the selected {minutes}-minute window.</p></Panel>
      </div>
      <div className="resource-grid">
        <Panel eyebrow="Compute" title="CPU utilization"><TimeSeries title="CPU utilization" source="Paper JVM + Host" height={200} samples={samples} yMax={100} series={[{ key: "processCpu", label: "JVM process", unit: "%", color: "var(--chart-blue)" }, { key: "hostCpu", label: "Host", unit: "%", color: "var(--chart-purple)" }]} /></Panel>
        <Panel eyebrow="Memory" title="Memory utilization"><TimeSeries title="Memory utilization" source="Paper JVM + Host" height={200} samples={samples} series={[{ key: "heap", label: "JVM heap", unit: "bytes", color: "var(--chart-cyan)" }, { key: "memory", label: "Host", unit: "bytes", color: "var(--chart-blue)" }]} /></Panel>
      </div>
    </CrosshairGroup>
    <div className="lower-grid">
      <Panel eyebrow="Worlds" title="Loaded world activity"><div className="table-region" role="region" aria-label="World telemetry" tabIndex={0}><table><thead><tr><th>World</th><th>Chunks</th><th>Entities</th><th>Entities / chunk</th></tr></thead><tbody>{state.worlds.length ? state.worlds.map((world) => { const density = entityDensity(world.entities, world.loadedChunks); return <tr key={str(world.name)}><td><span className="world-name"><Icon name="layers" />{str(world.name)}</span></td><td>{number(world.loadedChunks)?.toLocaleString() ?? "Unknown"}</td><td>{number(world.entities)?.toLocaleString() ?? "Unknown"}</td><td>{density === null ? "Unknown" : density.toFixed(2)}</td></tr>; }) : <tr><td colSpan={4}>World activity will appear when telemetry arrives.</td></tr>}</tbody></table></div></Panel>
      <Panel eyebrow={isLive ? "Community" : "Last reported players"} title="Player activity" action={<button className="text-link" onClick={() => navigate("Players")}>View all <Icon name="chevron" /></button>}><div className="overview-players">{state.players.length ? state.players.slice(0, 4).map((player) => <div className="overview-player" key={str(player.uuid)}><PlayerHead uuid={str(player.uuid)} name={str(player.name)} /><div><strong>{str(player.name)}</strong><small>{str(player.world, "World unknown")}</small></div><span>{metric(number(player.ping), "", 0).value} <small>ms</small></span></div>) : <div className="players-quiet"><Icon name="players" /><strong>{online === 0 && isLive ? "A quiet moment" : "Waiting for player activity"}</strong><p>{online === 0 && isLive ? "Nobody is online right now. Players will appear here when they join." : "The player list will appear when the server reports it."}</p></div>}</div></Panel>
    </div>
    <ActionReview prepared={prepared} onClose={() => setPrepared(null)} />
  </>;
}

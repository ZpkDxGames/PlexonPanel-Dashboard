import { useMemo, useState } from "react";
import { useNow, useSession } from "../hooks";
import { navigate } from "../router";
import { Button, Panel, Status } from "../components/ui";
import { emptyControlState, number, str } from "../adapter/control-state";
import { session } from "../adapter/session";
import { sourceStatus } from "../store/selectors";

export default function Fleet() {
  const snap = useSession(), now = useNow(), [query, setQuery] = useState("");
  const rows = useMemo(() => snap.credentials.map((credential) => {
    const selected = credential.serverId === snap.state.serverId;
    const feed = snap.fleet.find((item) => item.serverId === credential.serverId);
    return {serverId: credential.serverId, selected, phase: selected ? snap.phase : feed?.phase ?? "limited", state: selected ? snap.state : feed?.state ?? emptyControlState(credential.serverId)};
  }), [snap.credentials, snap.state, snap.phase, snap.fleet]);
  // Development fixture rows come from the explicitly labelled selected fixture, not invented production data.
  const known = snap.fixture && !rows.length ? [{serverId:snap.state.serverId,selected:true,phase:snap.phase,state:snap.state}] : rows;
  const visible = known.filter((row) => `${str(row.state.ready?.server.serverName, snap.labels[row.serverId] ?? row.serverId)} ${row.serverId}`.toLowerCase().includes(query.toLowerCase()));
  const connected = known.filter((row) => row.phase === "live").length;
  return <div className="fleet-layout"><Panel eyebrow="Minecraft instances" title="Server fleet" action={<Status tone={connected ? "success" : "neutral"}>{connected} / {known.length} connected</Status>}>
    <div className="fleet-toolbar"><input aria-label="Search servers" placeholder="Search server name or ID" value={query} onChange={(event) => setQuery(event.target.value)}/><Button onClick={() => navigate("Settings")}>Pair another server</Button></div>
    <div className="table-region fleet-instances" tabIndex={0} aria-label="Paired server fleet"><table><thead><tr><th>Server</th><th>Connection</th><th>Players</th><th>TPS</th><th>Latest source</th><th>Workspace</th></tr></thead><tbody>{visible.map((row) => {
      const name = str(row.state.ready?.server.serverName, snap.labels[row.serverId] ?? row.serverId);
      const paper = sourceStatus(row.state,"Paper",row.phase === "live" && Boolean(row.state.ready?.agents.paper),now);
      const host = sourceStatus(row.state,"Host",row.phase === "live" && Boolean(row.state.ready?.agents.host),now);
      const tps = number(Array.isArray(row.state.server.tps) ? row.state.server.tps[0] : null);
      const status = row.phase === "live" ? row.state.ready?.agents.paper ? "Connected" : row.state.ready?.agents.host ? "Host only" : "Sources offline" : row.phase === "limited" ? "Not observed" : row.phase;
      const recent = row.state.ready?.agents.paper ? paper : host;
      return <tr key={row.serverId} className={row.selected ? "selected-instance" : ""}><td><strong>{name}</strong><small>{row.state.ready?.server.minecraftVersion ? `Minecraft ${row.state.ready.server.minecraftVersion}` : "Version not supplied"}{row.selected ? " · Selected" : ""}</small><code>{row.serverId}</code></td><td><Status tone={row.phase === "live" && recent.usable ? "success" : row.phase === "reconnecting" || recent.kind === "stale" ? "warning" : "neutral"}>{status}</Status></td><td>{number(row.state.server.onlinePlayers)?.toLocaleString() ?? "—"}</td><td>{tps?.toFixed(2) ?? "—"}</td><td><span>{recent.source}</span><small>{recent.label}</small></td><td><Button variant="quiet" aria-label={`Open ${name}`} onClick={() => { if (!row.selected) void session.select(row.serverId); navigate("Overview"); }}>Open</Button></td></tr>;
    })}{!visible.length && <tr><td colSpan={6}><div className="inline-empty"><strong>{known.length ? "No matching servers" : "No paired servers"}</strong><span>{known.length ? "Adjust your search." : "Pair a server from Settings to receive its telemetry."}</span></div></td></tr>}</tbody></table></div>
  </Panel><aside className="fleet-summary"><span className="eyebrow">Your workspace</span><h2>One clear view of every instance.</h2><p>Each server keeps its own telemetry and permissions. Open an instance to inspect its health and available controls.</p><dl><dt>Paired instances</dt><dd>{known.length}</dd><dt>Connected rooms</dt><dd>{connected}</dd><dt>Needs connection</dt><dd>{known.length-connected}</dd></dl><p className="subtle">An offline Paper server can still have Host controls. Sample age is shown separately from the room connection.</p></aside></div>;
}

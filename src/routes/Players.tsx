import { useMemo, useState } from "react";
import { number, str, type JsonMap } from "../adapter/control-state";
import { session, type Prepared } from "../adapter/session";
import { PlayerHead } from "../components/PlayerHead";
import { Button, Notice, Panel, Status } from "../components/ui";
import { ActionReview } from "../features/ActionReview";
import { playerCommand, permissionCommand } from "../lib/playerCommands";
import { useSession } from "../hooks";

type Player = { uuid: string; name: string; world: string; ping: number | null; onlineMs: number | null; raw: JsonMap };
const actions = [
  ["Message", "player.message"], ["Kick", "player.kick"], ["Ban", "player.ban"], ["Whitelist", "player.whitelist.add"],
  ["Gamemode", "player.gamemode"], ["Heal", "player.heal"], ["Feed", "player.feed"], ["Kill", "player.kill"], ["OP", "player.op"], ["De-op", "player.deop"],
] as const;

function duration(ms: number | null) {
  if (ms === null) return "Unknown";
  const minutes = Math.floor(ms / 60000);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default function Players() {
  const snap = useSession();
  const [query, setQuery] = useState("");
  const [world, setWorld] = useState("all");
  const [selected, setSelected] = useState<string>("");
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [commandTemplate, setCommandTemplate] = useState("tell {player} Hello from the console");
  const [node, setNode] = useState("essentials.fly");
  const [builderError, setBuilderError] = useState("");
  const players = useMemo<Player[]>(() => snap.state.players.map((raw) => ({
    uuid: str(raw.uuid, ""), name: str(raw.name, "Unknown"), world: str(raw.world, "Unknown"),
    ping: number(raw.ping), onlineMs: number(raw.onlineDurationMillis), raw,
  })).filter((p) => p.uuid && (p.name.toLowerCase().includes(query.toLowerCase()) || p.uuid.includes(query))).filter((p) => world === "all" || p.world === world).sort((a,b) => a.name.localeCompare(b.name)), [snap.state.players, query, world]);
  const active = players.find((p) => p.uuid === selected) ?? players[0] ?? null;
  const worlds = [...new Set(snap.state.players.map((p) => str(p.world, "Unknown")))];
  const prepare = (action: string, parameters: JsonMap) => { setBuilderError(""); try { setPrepared(session.prepare(action, parameters, "PAPER")); } catch (error) { setBuilderError(error instanceof Error ? error.message : "Action unavailable."); } };
  const runTemplate = () => { if (!active) return; try { prepare("console.execute", { command: playerCommand(commandTemplate, active) }); } catch (error) { setBuilderError(error instanceof Error ? error.message : "Invalid command."); } };
  const runPermission = (mode: "set" | "unset") => { if (!active) return; try { prepare("console.execute", { command: permissionCommand({ player: active.name, node, mode }) }); } catch (error) { setBuilderError(error instanceof Error ? error.message : "Invalid permission mutation."); } };
  return <>
    <div className="players-toolbar">
      <label className="field"><span className="sr-only">Search players</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or UUID" /></label>
      <label className="field"><span className="sr-only">Filter by world</span><select value={world} onChange={(e) => setWorld(e.target.value)}><option value="all">All worlds</option>{worlds.map((item) => <option key={item}>{item}</option>)}</select></label>
      <Status tone={snap.state.ready?.agents.paper ? "success" : "neutral"}>{snap.state.players.length} online</Status>
    </div>
    <div className="players-layout">
      <Panel eyebrow="Current server roster" title="Online players" action={<span className="subtle">UUID-bound actions</span>}>
        <div className="roster" role="list">{players.length ? players.map((player) => <button role="listitem" className={`player-row ${active?.uuid === player.uuid ? "selected" : ""}`} key={player.uuid} onClick={() => setSelected(player.uuid)}>
          <PlayerHead uuid={player.uuid} name={player.name} /><span className="player-identity"><strong>{player.name}</strong><small>{player.uuid}</small></span><span><b>{player.world}</b><small>{duration(player.onlineMs)} online</small></span><span className={`ping ${player.ping!==null&&player.ping>100?"high":""}`}><i/>{player.ping === null ? "—" : `${player.ping} ms`}</span>
        </button>) : <div className="inline-empty"><strong>No one is online</strong><span>{snap.state.ready?.agents.paper ? "The server is quiet. New joins appear here as they happen." : "Waiting for the Current server roster."}</span></div>}</div>
      </Panel>
      <aside className="player-detail">{active ? <>
        <div className="player-profile"><PlayerHead uuid={active.uuid} name={active.name} large /><div><span className="eyebrow">Selected player</span><h2>{active.name}</h2><button className="copy-id" onClick={() => void navigator.clipboard.writeText(active.uuid)}>Copy UUID</button></div></div>
        <dl className="identity-facts"><dt>Status</dt><dd>Online</dd><dt>World</dt><dd>{active.world}</dd><dt>Ping</dt><dd>{active.ping === null ? "Unknown" : `${active.ping} ms`}</dd><dt>Session</dt><dd>{duration(active.onlineMs)}</dd></dl>
        <section><span className="eyebrow">Player actions</span><div className="action-grid">{actions.map(([label, action]) => { const reason = session.reason(action, "PAPER"); return <Button key={action} variant={action === "player.ban" || action === "player.kill" ? "danger" : "secondary"} disabled={Boolean(reason)} title={reason} onClick={() => prepare(action, { playerId: active.uuid, ...(action === "player.message" ? { message: "" } : {}) })}>{label}</Button>; })}</div></section>
        <section className="player-command"><span className="eyebrow">Command shortcut</span><label className="field">Template<input value={commandTemplate} onChange={(e) => setCommandTemplate(e.target.value)} /></label><code>{commandTemplate.replaceAll("{player}", active.name).replaceAll("{uuid}", active.uuid)}</code><Button onClick={runTemplate} disabled={Boolean(session.reason("console.execute", "PAPER"))}>Review command</Button></section>
        <section className="player-command"><span className="eyebrow">Permissions</span><p className="subtle">Uses a typed LuckPerms command only when the server’s allowed-command policy accepts it. The agent result is authoritative.</p><label className="field">Permission node<input value={node} onChange={(e) => setNode(e.target.value)} /></label><div className="button-row"><Button onClick={() => runPermission("set")}>Review grant</Button><Button onClick={() => runPermission("unset")}>Review removal</Button></div></section>
        <Notice title="Effective permissions">This server does not yet report effective permission trees. A supported <code>permissions.*</code> backend contract.</Notice>
        {builderError && <Notice tone="error" title="Cannot prepare action">{builderError}</Notice>}
      </> : <div className="inline-empty"><strong>No player selected</strong><span>Select an online player to inspect available actions.</span></div>}</aside>
    </div>
    <ActionReview prepared={prepared} onClose={() => setPrepared(null)} />
  </>;
}

"use client";

import { useMemo, useState } from "react";
import type {
  AgentCapabilities,
  ChatMessage,
  ConsoleEntry,
  ManagementData,
  PlayerRecord,
} from "../lib/management-data";

type ManagementSection = "players" | "console" | "chat" | "plugins" | "security";
type ActionRunner = (action: string, parameters: Record<string, unknown>) => Promise<{ requestId: string }>;

interface ManagementViewsProps {
  section: ManagementSection;
  data: ManagementData;
  onPairServer: () => void;
  onAction: ActionRunner;
}

function SectionHeading({ kicker, title, copy, actions }: { kicker: string; title: string; copy: string; actions?: React.ReactNode }) {
  return <header className="module-heading"><div><p className="eyebrow">{kicker}</p><h2>{title}</h2><p>{copy}</p></div>{actions && <div className="module-actions">{actions}</div>}</header>;
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="search-field"><span aria-hidden="true">⌕</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} /></label>;
}

function Avatar({ initials, color }: { initials: string; color: string }) {
  return <span className={`player-avatar ${color}`}>{initials}</span>;
}

function ActionToast({ title = "Dashboard response", message, onClose }: { title?: string; message: string; onClose: () => void }) {
  return <div className="action-toast" role="status"><span className="toast-check">i</span><div><strong>{title}</strong><span>{message}</span></div><button onClick={onClose} aria-label="Dismiss">×</button></div>;
}

function PlayerDrawer({ player, capabilities, onClose, onAction }: {
  player: PlayerRecord;
  capabilities: AgentCapabilities;
  onClose: () => void;
  onAction: (action: string, parameters: Record<string, unknown>, confirmation: string) => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim() || busy) return;
    setBusy(true);
    try {
      await onAction("player.message", { playerId: player.id, message: message.trim() }, `Message queued for ${player.name}.`);
    } finally {
      setBusy(false);
    }
  }

  async function kickPlayer() {
    if (busy || !window.confirm(`Kick ${player.name} from the server?`)) return;
    setBusy(true);
    try {
      await onAction("player.kick", { playerId: player.id, reason: "Removed by a dashboard administrator" }, `Kick request queued for ${player.name}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="drawer-backdrop" onMouseDown={onClose} role="presentation">
      <aside className="player-drawer" role="dialog" aria-modal="true" aria-labelledby="player-name" onMouseDown={(event) => event.stopPropagation()}>
        <button className="drawer-close" onClick={onClose} aria-label="Close player details">×</button>
        <div className="drawer-player"><Avatar initials={player.initials} color={player.color} /><div><span className="online-indicator"><i /> Online now</span><h3 id="player-name">{player.name}</h3><p>{player.role} · {player.world}</p></div></div>
        <div className="drawer-facts"><div><span>Ping</span><strong>{player.ping} ms</strong></div><div><span>Health</span><strong>{player.health}</strong></div><div><span>Experience</span><strong>Level {player.experienceLevel}</strong></div><div><span>Current world</span><strong>{player.world}</strong></div></div>
        <div className="drawer-section">
          <p className="eyebrow">Approved actions</p>
          <form className="drawer-message-form" onSubmit={sendMessage}><input value={message} onChange={(event) => setMessage(event.target.value.slice(0, 2000))} placeholder="Private message" aria-label={`Message ${player.name}`} disabled={!capabilities.playerMessage || busy} /><button disabled={!capabilities.playerMessage || !message.trim() || busy}>Send</button></form>
          <button disabled={!capabilities.playerKick || busy} onClick={() => void kickPlayer()}>Kick from server <span>{capabilities.playerKick ? "→" : "Disabled locally"}</span></button>
          <button disabled title="Teleportation is not supported by the Paper agent">Teleport player <span>Unsupported</span></button>
        </div>
        <div className="drawer-warning"><span>!</span><p><strong>The Paper server remains authoritative.</strong>Every action is signed, checked against local plugin policy, and written to the audit log.</p></div>
      </aside>
    </div>
  );
}

function PlayersView({ data, onAction }: { data: ManagementData; onAction: ActionRunner }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "staff">("all");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRecord | null>(null);
  const [toast, setToast] = useState("");
  const players = useMemo(() => data.players.filter((player) => {
    const matchesQuery = `${player.name} ${player.world} ${player.role}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (filter === "all" || player.role !== "Player");
  }), [data.players, query, filter]);
  const maximum = data.maximumPlayers || data.players.length;
  const averagePing = data.players.length ? Math.round(data.players.reduce((sum, player) => sum + player.ping, 0) / data.players.length) : 0;

  function exportPlayers() {
    const rows = [["Name", "UUID", "World", "Role", "Ping"], ...data.players.map((player) => [player.name, player.id, player.world, player.role, String(player.ping)])];
    const content = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "plexonpanel-online-players.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function runPlayerAction(action: string, parameters: Record<string, unknown>, confirmation: string) {
    try {
      await onAction(action, parameters);
      setToast(confirmation);
      setSelectedPlayer(null);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "The player action was rejected.");
    }
  }

  return (
    <section className="module-view">
      <SectionHeading kicker="Player management" title="Online players" copy="Inspect the current player snapshot and issue only the actions allowed by your Paper server." actions={<button className="secondary-button" onClick={exportPlayers} disabled={!data.players.length}>Export list</button>} />
      <div className="mini-stat-grid"><article><span className="mini-stat-icon green">●</span><div><small>Online now</small><strong>{data.players.length}</strong><span>of {maximum} slots</span></div></article><article><span className="mini-stat-icon violet">%</span><div><small>Capacity</small><strong>{maximum ? ((data.players.length / maximum) * 100).toFixed(1) : "0"}%</strong><span>{Math.max(0, maximum - data.players.length)} slots free</span></div></article><article><span className="mini-stat-icon cyan">S</span><div><small>Operators</small><strong>{data.players.filter((player) => player.role === "Operator").length}</strong><span>Reported by Paper</span></div></article><article><span className="mini-stat-icon amber">↯</span><div><small>Average ping</small><strong>{averagePing} ms</strong><span>Current snapshot</span></div></article></div>
      <article className="data-panel"><div className="data-toolbar"><SearchField value={query} onChange={setQuery} placeholder="Search players, worlds, or roles" /><div className="segmented-control"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All players</button><button className={filter === "staff" ? "active" : ""} onClick={() => setFilter("staff")}>Operators</button></div></div><div className="table-scroll"><table className="player-table"><thead><tr><th>Player</th><th>Location</th><th>Ping</th><th>Health</th><th>Experience</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{players.map((player) => <tr key={player.id}><td><button className="player-identity" onClick={() => setSelectedPlayer(player)}><Avatar initials={player.initials} color={player.color} /><span><strong>{player.name}</strong><small>{player.role}</small></span></button></td><td><span className="world-pill">{player.world}</span></td><td><span className={`ping-value ${player.ping > 90 ? "slow" : ""}`}><i />{player.ping} ms</span></td><td>{player.health}</td><td>Level {player.experienceLevel}</td><td><button className="row-menu" onClick={() => setSelectedPlayer(player)} aria-label={`Manage ${player.name}`}>•••</button></td></tr>)}</tbody></table>{!players.length && <div className="empty-console">No online players match these filters.</div>}</div><footer className="data-footer"><span>Showing {players.length} current player records</span></footer></article>
      {selectedPlayer && <PlayerDrawer player={selectedPlayer} capabilities={data.capabilities} onClose={() => setSelectedPlayer(null)} onAction={runPlayerAction} />}
      {toast && <ActionToast message={toast} onClose={() => setToast("")} />}
    </section>
  );
}

function ConsoleView({ entries: incomingEntries, capabilities, onAction }: { entries: ConsoleEntry[]; capabilities: AgentCapabilities; onAction: ActionRunner }) {
  const [localEntries, setLocalEntries] = useState<ConsoleEntry[]>([]);
  const [pauseSnapshot, setPauseSnapshot] = useState<ConsoleEntry[] | null>(null);
  const [clearedIds, setClearedIds] = useState<Set<string>>(() => new Set());
  const [level, setLevel] = useState<"ALL" | ConsoleEntry["level"]>("ALL");
  const [query, setQuery] = useState("");
  const [command, setCommand] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const entries = pauseSnapshot ?? [...incomingEntries, ...localEntries].filter((entry) => !clearedIds.has(entry.id));
  const paused = pauseSnapshot !== null;
  const visibleEntries = useMemo(() => entries.filter((entry) => (level === "ALL" || entry.level === level) && `${entry.source} ${entry.message}`.toLowerCase().includes(query.toLowerCase())), [entries, level, query]);
  const canRun = capabilities.remoteActions && capabilities.consoleExecute;

  function togglePaused() {
    setPauseSnapshot((current) => current === null ? entries : null);
  }

  function clearLocally() {
    setClearedIds((current) => new Set([...current, ...entries.map((entry) => entry.id)]));
    setLocalEntries([]);
    if (paused) setPauseSnapshot([]);
  }

  async function runCommand(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = command.trim().replace(/^\//, "");
    if (!trimmed || !canRun || busy) return;
    setBusy(true);
    try {
      const result = await onAction("console.execute", { command: trimmed });
      const localEntry: ConsoleEntry = { id: result.requestId, time: "Now", level: "INFO", source: "PlexonPanel", message: `Command request queued: ${trimmed}` };
      setLocalEntries((current) => [...current, localEntry]);
      if (paused) setPauseSnapshot((current) => [...(current ?? []), localEntry]);
      setCommand("");
      setFeedback(`Command request ${result.requestId.slice(0, 8)} was queued.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "The command request was rejected.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="module-view console-module"><SectionHeading kicker="Remote console" title="Server console" copy="Search bounded live output and submit commands accepted by the plugin's local allowlist." actions={<><span className="console-session"><i /> {capabilities.consoleStream ? "Live stream" : capabilities.errorCapture ? "Errors only" : "Disabled locally"}</span><button className="secondary-button" onClick={togglePaused}>{paused ? "Resume stream" : "Pause stream"}</button></>} /><article className="console-panel"><div className="console-toolbar"><div className="console-levels">{(["ALL", "INFO", "WARN", "ERROR"] as const).map((item) => <button key={item} className={`${level === item ? "active" : ""} ${item.toLowerCase()}`} onClick={() => setLevel(item)}>{item}</button>)}</div><SearchField value={query} onChange={setQuery} placeholder="Search console output" /><button className="console-clear" onClick={clearLocally}>Clear locally</button></div><div className="console-output" aria-live="polite">{paused && <div className="paused-banner"><span>Ⅱ</span>Live output paused · incoming lines are not added to this view</div>}{visibleEntries.length ? visibleEntries.map((entry) => <div className="console-line" key={entry.id}><time>{entry.time}</time><span className={`level-badge ${entry.level.toLowerCase()}`}>{entry.level}</span><strong>[{entry.source}]</strong><p>{entry.message}</p></div>) : <div className="empty-console">No console lines are available for these filters.</div>}</div><form className="command-line" onSubmit={runCommand}><span>›</span><input value={command} onChange={(event) => setCommand(event.target.value.slice(0, 512))} placeholder={canRun ? "Enter an allowlisted server command…" : "Remote console is disabled in config.yml"} aria-label="Server command" disabled={!canRun || busy} /><kbd>Enter</kbd><button type="submit" disabled={!canRun || !command.trim() || busy}>{busy ? "Sending" : "Run command"}</button></form></article><div className="console-notice"><span>i</span><p><strong>Local policy always wins.</strong>The relay signs the request, then the Paper plugin independently checks its allow and deny rules before execution.</p></div>{feedback && <ActionToast message={feedback} onClose={() => setFeedback("")} />}</section>;
}

function ChatView({ data, onAction }: { data: ManagementData; onAction: ActionRunner }) {
  const [message, setMessage] = useState("");
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [playerQuery, setPlayerQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const messages = [...data.chatMessages, ...localMessages].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index).slice(-200);
  const onlinePlayers = data.players.filter((player) => player.name.toLowerCase().includes(playerQuery.toLowerCase()));

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || !data.capabilities.chatSend || busy) return;
    setBusy(true);
    try {
      const result = await onAction("chat.global.send", { message: trimmed });
      const optimisticMessage: ChatMessage = { id: result.requestId, player: "Administrator", initials: "AD", role: "Dashboard", channel: "Global", message: trimmed, time: "Now", color: "violet" };
      setLocalMessages((current) => [...current, optimisticMessage].slice(-200));
      setMessage("");
      setFeedback("Global message request queued.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "The chat request was rejected.");
    } finally { setBusy(false); }
  }

  return <section className="module-view chat-module"><SectionHeading kicker="PlexonChats bridge" title="Global chat" copy="Follow the bounded global stream and speak only when dashboard sending is enabled locally." actions={<span className="integration-pill"><i /> {data.capabilities.chatStream ? "Connected" : "Disabled locally"}</span>} /><div className="chat-layout"><article className="chat-panel"><header className="chat-header"><div><span className="channel-hash">#</span><div><strong>Global channel</strong><small>{data.players.length} players currently online</small></div></div></header><div className="message-stream">{messages.map((item) => <div className={`chat-message ${item.color === "system" ? "system-message" : ""}`} key={item.id}><Avatar initials={item.initials} color={item.color} /><div><div className="message-meta"><strong>{item.player}</strong>{item.role && <span>{item.role}</span>}<time>{item.time}</time></div><p>{item.message}</p></div></div>)}{!messages.length && <div className="empty-chat"><span>◇</span><strong>No retained chat history</strong><p>New global messages appear here while this authorized dashboard is connected.</p></div>}</div><form className="chat-composer" onSubmit={sendMessage}><input value={message} onChange={(event) => setMessage(event.target.value.slice(0, 2000))} placeholder={data.capabilities.chatSend ? "Message #global" : "Dashboard chat sending is disabled"} aria-label="Chat message" disabled={!data.capabilities.chatSend || busy} /><span>{message.length} / 2000</span><button className="send-button" type="submit" disabled={!data.capabilities.chatSend || !message.trim() || busy}>Send</button></form></article><aside className="chat-sidebar"><div className="channel-list"><p>Channels</p><button className="active"><span>#</span>global <b>{data.players.length}</b></button></div><div className="online-list"><div><p>Online players</p><span>{data.players.length}</span></div><SearchField value={playerQuery} onChange={setPlayerQuery} placeholder="Find a player" />{onlinePlayers.slice(0, 8).map((player) => <button key={player.id}><span className="online-avatar"><Avatar initials={player.initials} color={player.color} /><i /></span><span><strong>{player.name}</strong><small>{player.world}</small></span></button>)}</div></aside></div>{feedback && <ActionToast message={feedback} onClose={() => setFeedback("")} />}</section>;
}

function PluginsView({ data }: { data: ManagementData }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "enabled" | "disabled">("all");
  const plugins = useMemo(() => data.plugins.filter((plugin) => `${plugin.name} ${plugin.author} ${plugin.description}`.toLowerCase().includes(query.toLowerCase()) && (filter === "all" || plugin.status === filter)), [data.plugins, query, filter]);
  const enabled = data.plugins.filter((plugin) => plugin.status === "enabled").length;
  const disabled = data.plugins.length - enabled;
  return <section className="module-view"><SectionHeading kicker="Plugin inventory" title="Installed plugins" copy="Review the exact plugin inventory reported by the connected Paper instance." actions={<span className="integration-pill"><i /> Automatic sync</span>} /><div className="plugin-summary"><article><span className="summary-ring green">{enabled}</span><div><strong>Enabled</strong><p>Loaded by Paper</p></div></article><article><span className="summary-ring muted">{disabled}</span><div><strong>Disabled</strong><p>Not currently active</p></div></article><article className="compat-card"><span>✓</span><div><strong>Read-only inventory</strong><p>Plugin lifecycle actions are intentionally unsupported in wire protocol 3.</p></div></article></div><article className="data-panel plugin-panel"><div className="data-toolbar"><SearchField value={query} onChange={setQuery} placeholder="Search installed plugins" /><div className="segmented-control"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button><button className={filter === "enabled" ? "active" : ""} onClick={() => setFilter("enabled")}>Enabled</button><button className={filter === "disabled" ? "active" : ""} onClick={() => setFilter("disabled")}>Disabled</button></div></div><div className="plugin-list">{plugins.map((plugin) => <div className="plugin-row" key={plugin.id}><span className="plugin-emblem">{plugin.name.slice(0, 2).toUpperCase()}</span><div className="plugin-copy"><div><strong>{plugin.name}</strong><span>v{plugin.version}</span></div><p>{plugin.description}</p><small>by {plugin.author}</small></div><div className="plugin-state"><span className={`state-pill ${plugin.status}`}>{plugin.status}</span></div></div>)}{!plugins.length && <div className="empty-console">No plugins match these filters.</div>}</div></article></section>;
}

function Toggle({ checked, label }: { checked: boolean; label: string }) {
  return <button className={`toggle ${checked ? "checked" : ""}`} role="switch" aria-checked={checked} aria-label={label} disabled><span /></button>;
}

function SecurityView({ data, onPairServer }: { data: ManagementData; onPairServer: () => void }) {
  const { identity, capabilities } = data;
  const shortId = identity.serverId.length > 12 ? `${identity.serverId.slice(0, 8)}…${identity.serverId.slice(-4)}` : identity.serverId;
  const policies = [
    ["›_", "Console execution", "Run commands accepted by the local allowlist.", capabilities.consoleExecute],
    ["P", "Player moderation", "Message or kick players when enabled in config.yml.", capabilities.playerMessage || capabilities.playerKick],
    ["#", "Chat interaction", "Read and send the global chat stream.", capabilities.chatStream || capabilities.chatSend],
    ["!", "Error capture", "Receive redacted warning and error fingerprints.", capabilities.errorCapture],
  ] as const;
  return <section className="module-view security-module"><SectionHeading kicker="Access and policy" title="Security center" copy="Inspect the signed server identity and the capabilities enforced by the plugin." actions={<button className="primary-button" onClick={onPairServer}>Pair another server</button>} /><div className="security-grid"><article className="identity-card"><div className="identity-heading"><span className="identity-shield">◇</span><div><p className="eyebrow">Server identity</p><h3>Cryptographic link {identity.connectionStatus === "online" ? "healthy" : "offline"}</h3></div><span className={`state-pill ${identity.paired ? "enabled" : "disabled"}`}>{identity.paired ? "Verified" : "Unpaired"}</span></div><p>The relay accepts this UUID only when the plugin proves possession of its persistent Ed25519 private key.</p><div className="identity-facts"><div><span>Server ID</span><code title={identity.serverId}>{shortId}</code></div><div><span>Fingerprint</span><code title={identity.fingerprint}>{identity.fingerprint}</code></div><div><span>Agent version</span><strong>{identity.pluginVersion}</strong></div></div></article><article className="security-score"><div className="score-ring"><strong>v3</strong><span>signed</span></div><div><p className="eyebrow">Transport posture</p><h3>Hardened connection</h3><p>Short-lived pairing, scoped device credentials, signed messages, replay protection, and local action policy are active.</p><div className="score-items"><span><i className="good" />Ed25519 server identity</span><span><i className="good" />IndexedDB device credential</span><span><i className="good" />One-time pairing challenge</span></div></div></article></div><div className="security-columns"><article className="policy-panel"><header><div><p className="eyebrow">Paper-owned policy</p><h3>Effective capabilities</h3></div><span>Read from config.yml</span></header><div className="policy-list">{policies.map(([icon, title, copy, enabled]) => <div key={title}><span className="policy-icon">{icon}</span><div><strong>{title}</strong><p>{copy}</p></div><Toggle checked={enabled} label={title} /></div>)}</div></article><article className="audit-panel"><header><div><p className="eyebrow">Live + browser cache</p><h3>Recent action results</h3></div></header><div className="audit-list">{data.audit.map((item) => <div key={item.id}><span className={`audit-result ${item.result}`}>{item.result === "success" ? "✓" : "!"}</span><div><strong>{item.action}</strong><p>{item.actor} · {item.target}</p></div><time>{item.time}</time></div>)}{!data.audit.length && <div className="empty-console">No action results are cached in this browser. The full audit stays on Paper.</div>}</div></article></div></section>;
}

export default function ManagementViews({ section, data, onPairServer, onAction }: ManagementViewsProps) {
  if (section === "players") return <PlayersView data={data} onAction={onAction} />;
  if (section === "console") return <ConsoleView entries={data.consoleEntries} capabilities={data.capabilities} onAction={onAction} />;
  if (section === "chat") return <ChatView data={data} onAction={onAction} />;
  if (section === "plugins") return <PluginsView data={data} />;
  return <SecurityView data={data} onPairServer={onPairServer} />;
}

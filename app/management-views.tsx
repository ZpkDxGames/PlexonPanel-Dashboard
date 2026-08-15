"use client";

import { useMemo, useState } from "react";
import {
  demoAudit,
  demoChatMessages,
  demoConsoleEntries,
  demoPlayers,
  demoPlugins,
  type ChatMessage,
  type ConsoleEntry,
  type PlayerRecord,
} from "../lib/management-data";

type ManagementSection = "players" | "console" | "chat" | "plugins" | "security";

interface ManagementViewsProps {
  section: ManagementSection;
  onPairServer: () => void;
}

function SectionHeading({
  kicker,
  title,
  copy,
  actions,
}: {
  kicker: string;
  title: string;
  copy: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="module-heading">
      <div>
        <p className="eyebrow">{kicker}</p>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
      {actions && <div className="module-actions">{actions}</div>}
    </header>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="search-field">
      <span aria-hidden="true">⌕</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </label>
  );
}

function Avatar({ initials, color }: { initials: string; color: string }) {
  return <span className={`player-avatar ${color}`}>{initials}</span>;
}

function PreviewToast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="preview-toast" role="status">
      <span className="toast-check">✓</span>
      <div><strong>Preview action</strong><span>{message}</span></div>
      <button onClick={onClose} aria-label="Dismiss">×</button>
    </div>
  );
}

function PlayerDrawer({
  player,
  onClose,
  onAction,
}: {
  player: PlayerRecord;
  onClose: () => void;
  onAction: (message: string) => void;
}) {
  return (
    <div className="drawer-backdrop" onMouseDown={onClose} role="presentation">
      <aside className="player-drawer" role="dialog" aria-modal="true" aria-labelledby="player-name" onMouseDown={(event) => event.stopPropagation()}>
        <button className="drawer-close" onClick={onClose} aria-label="Close player details">×</button>
        <div className="drawer-player"><Avatar initials={player.initials} color={player.color} /><div><span className="online-indicator"><i /> Online now</span><h3 id="player-name">{player.name}</h3><p>{player.role} · {player.world}</p></div></div>
        <div className="drawer-facts">
          <div><span>Ping</span><strong>{player.ping} ms</strong></div>
          <div><span>Session</span><strong>{player.joined}</strong></div>
          <div><span>Play time</span><strong>{player.playTime}</strong></div>
          <div><span>Current world</span><strong>{player.world}</strong></div>
        </div>
        <div className="drawer-section"><p className="eyebrow">Quick actions</p><button onClick={() => onAction(`Message composer opened for ${player.name}.`)}>Send private message <span>→</span></button><button onClick={() => onAction(`${player.name} would be teleported to spawn.`)}>Teleport to spawn <span>→</span></button><button onClick={() => onAction(`${player.name} would be removed after confirmation.`)}>Kick from server <span>→</span></button></div>
        <div className="drawer-warning"><span>!</span><p><strong>Remote actions are disabled in preview mode.</strong>Every production action will require permission checks and an audit record.</p></div>
      </aside>
    </div>
  );
}

function PlayersView() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "staff">("all");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRecord | null>(null);
  const [toast, setToast] = useState("");
  const players = useMemo(() => demoPlayers.filter((player) => {
    const matchesQuery = `${player.name} ${player.world} ${player.role}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all" || player.role !== "Player";
    return matchesQuery && matchesFilter;
  }), [query, filter]);

  return (
    <section className="module-view">
      <SectionHeading kicker="Player management" title="Online players" copy="Inspect sessions, moderate players, and move quickly when support is needed." actions={<button className="secondary-button">Export list</button>} />
      <div className="mini-stat-grid">
        <article><span className="mini-stat-icon green">●</span><div><small>Online now</small><strong>84</strong><span>of 250 slots</span></div></article>
        <article><span className="mini-stat-icon violet">%</span><div><small>Capacity</small><strong>33.6%</strong><span>166 slots free</span></div></article>
        <article><span className="mini-stat-icon cyan">S</span><div><small>Staff online</small><strong>4</strong><span>1 owner · 3 mods</span></div></article>
        <article><span className="mini-stat-icon amber">↯</span><div><small>Average ping</small><strong>46 ms</strong><span>Stable connection</span></div></article>
      </div>
      <article className="data-panel">
        <div className="data-toolbar"><SearchField value={query} onChange={setQuery} placeholder="Search players, worlds, or roles" /><div className="segmented-control"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All players</button><button className={filter === "staff" ? "active" : ""} onClick={() => setFilter("staff")}>Staff</button></div></div>
        <div className="table-scroll">
          <table className="player-table">
            <thead><tr><th>Player</th><th>Location</th><th>Ping</th><th>Play time</th><th>Joined</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{players.map((player) => <tr key={player.id}><td><button className="player-identity" onClick={() => setSelectedPlayer(player)}><Avatar initials={player.initials} color={player.color} /><span><strong>{player.name}</strong><small>{player.role}</small></span></button></td><td><span className="world-pill">{player.world}</span></td><td><span className={`ping-value ${player.ping > 90 ? "slow" : ""}`}><i />{player.ping} ms</span></td><td>{player.playTime}</td><td>{player.joined}</td><td><button className="row-menu" onClick={() => setSelectedPlayer(player)} aria-label={`Manage ${player.name}`}>•••</button></td></tr>)}</tbody>
          </table>
        </div>
        <footer className="data-footer"><span>Showing {players.length} of 84 online players</span><div><button disabled>←</button><b>1</b><button>2</button><button>3</button><button>→</button></div></footer>
      </article>
      {selectedPlayer && <PlayerDrawer player={selectedPlayer} onClose={() => setSelectedPlayer(null)} onAction={(message) => { setToast(message); setSelectedPlayer(null); }} />}
      {toast && <PreviewToast message={toast} onClose={() => setToast("")} />}
    </section>
  );
}

function ConsoleView() {
  const [entries, setEntries] = useState(demoConsoleEntries);
  const [level, setLevel] = useState<"ALL" | ConsoleEntry["level"]>("ALL");
  const [query, setQuery] = useState("");
  const [command, setCommand] = useState("");
  const [paused, setPaused] = useState(false);
  const visibleEntries = useMemo(() => entries.filter((entry) => (level === "ALL" || entry.level === level) && `${entry.source} ${entry.message}`.toLowerCase().includes(query.toLowerCase())), [entries, level, query]);

  function runPreviewCommand(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = command.trim();
    if (!trimmed) return;
    setEntries((current) => [...current, { id: `preview-${Date.now()}`, time: "18:43:02", level: "INFO", source: "PlexonPanel", message: `Preview intercepted command: ${trimmed}` }]);
    setCommand("");
  }

  return (
    <section className="module-view console-module">
      <SectionHeading kicker="Remote console" title="Server console" copy="Search output, isolate errors, and securely issue approved commands." actions={<><span className="console-session"><i /> Session secured</span><button className="secondary-button" onClick={() => setPaused((value) => !value)}>{paused ? "Resume stream" : "Pause stream"}</button></>} />
      <article className="console-panel">
        <div className="console-toolbar"><div className="console-levels">{(["ALL", "INFO", "WARN", "ERROR"] as const).map((item) => <button key={item} className={`${level === item ? "active" : ""} ${item.toLowerCase()}`} onClick={() => setLevel(item)}>{item}</button>)}</div><SearchField value={query} onChange={setQuery} placeholder="Search console output" /><button className="console-clear" onClick={() => setEntries([])}>Clear</button></div>
        <div className="console-output" aria-live="polite">
          {paused && <div className="paused-banner"><span>Ⅱ</span>Live output paused · existing lines remain searchable</div>}
          {visibleEntries.length ? visibleEntries.map((entry) => <div className="console-line" key={entry.id}><time>{entry.time}</time><span className={`level-badge ${entry.level.toLowerCase()}`}>{entry.level}</span><strong>[{entry.source}]</strong><p>{entry.message}</p></div>) : <div className="empty-console">No console lines match these filters.</div>}
        </div>
        <form className="command-line" onSubmit={runPreviewCommand}><span>›</span><input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Enter an approved server command…" aria-label="Server command" /><kbd>Enter</kbd><button type="submit" disabled={!command.trim()}>Run command</button></form>
      </article>
      <div className="console-notice"><span>i</span><p><strong>Preview command guard is active.</strong>Commands are displayed locally and never sent to a server until authentication, policy checks, and the signed gateway are connected.</p></div>
    </section>
  );
}

function ChatView() {
  const [messages, setMessages] = useState(demoChatMessages);
  const [channel, setChannel] = useState<ChatMessage["channel"]>("Global");
  const [message, setMessage] = useState("");
  const [playerQuery, setPlayerQuery] = useState("");
  const onlinePlayers = demoPlayers.filter((player) => player.name.toLowerCase().includes(playerQuery.toLowerCase()));

  function sendPreviewMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    setMessages((current) => [...current, { id: `preview-chat-${Date.now()}`, player: "Administrator", initials: "AD", role: "Dashboard", channel, message: trimmed, time: "Now", color: "violet" }]);
    setMessage("");
  }

  return (
    <section className="module-view chat-module">
      <SectionHeading kicker="PlexonChats bridge" title="Live chat" copy="Follow the global channel and join the conversation from one moderated view." actions={<span className="integration-pill"><i /> PlexonChats connected</span>} />
      <div className="chat-layout">
        <article className="chat-panel">
          <header className="chat-header"><div><span className="channel-hash">#</span><div><strong>{channel} channel</strong><small>{channel === "Global" ? "84 players can see this channel" : "4 staff members can see this channel"}</small></div></div><button aria-label="Chat options">•••</button></header>
          <div className="message-stream">{messages.filter((item) => item.channel === channel).map((item) => <div className={`chat-message ${item.color === "system" ? "system-message" : ""}`} key={item.id}><Avatar initials={item.initials} color={item.color} /><div><div className="message-meta"><strong>{item.player}</strong>{item.role && <span>{item.role}</span>}<time>{item.time}</time></div><p>{item.message}</p></div></div>)}{channel === "Staff" && <div className="empty-chat"><span>◇</span><strong>Staff channel is quiet</strong><p>Preview data has no recent staff messages.</p></div>}</div>
          <form className="chat-composer" onSubmit={sendPreviewMessage}><button type="button" aria-label="Add attachment">＋</button><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder={`Message #${channel.toLowerCase()}`} aria-label="Chat message" /><span>{message.length} / 256</span><button className="send-button" type="submit" disabled={!message.trim()}>Send</button></form>
        </article>
        <aside className="chat-sidebar"><div className="channel-list"><p>Channels</p><button className={channel === "Global" ? "active" : ""} onClick={() => setChannel("Global")}><span>#</span>global <b>84</b></button><button className={channel === "Staff" ? "active" : ""} onClick={() => setChannel("Staff")}><span>♢</span>staff <b>4</b></button></div><div className="online-list"><div><p>Online players</p><span>84</span></div><SearchField value={playerQuery} onChange={setPlayerQuery} placeholder="Find a player" />{onlinePlayers.slice(0, 6).map((player) => <button key={player.id}><span className="online-avatar"><Avatar initials={player.initials} color={player.color} /><i /></span><span><strong>{player.name}</strong><small>{player.world}</small></span></button>)}</div></aside>
      </div>
    </section>
  );
}

function PluginsView() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "enabled" | "attention">("all");
  const [toast, setToast] = useState("");
  const plugins = useMemo(() => demoPlugins.filter((plugin) => {
    const matchesQuery = `${plugin.name} ${plugin.author} ${plugin.description}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all" || (filter === "enabled" ? plugin.status === "enabled" : plugin.status !== "enabled");
    return matchesQuery && matchesFilter;
  }), [query, filter]);

  return (
    <section className="module-view">
      <SectionHeading kicker="Plugin checker" title="Installed plugins" copy="Review plugin health and find version drift before it becomes downtime." actions={<button className="primary-button" onClick={() => setToast("A fresh plugin inventory would be requested from the server.")}>Run health check</button>} />
      <div className="plugin-summary"><article><span className="summary-ring green">31</span><div><strong>Enabled</strong><p>All loaded successfully</p></div></article><article><span className="summary-ring amber">1</span><div><strong>Update available</strong><p>Review before upgrading</p></div></article><article><span className="summary-ring muted">2</span><div><strong>Disabled</strong><p>Configured not to load</p></div></article><article className="compat-card"><span>✓</span><div><strong>Paper 26.2 compatibility</strong><p>No known conflicts detected in the current inventory.</p></div></article></div>
      <article className="data-panel plugin-panel"><div className="data-toolbar"><SearchField value={query} onChange={setQuery} placeholder="Search installed plugins" /><div className="segmented-control"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button><button className={filter === "enabled" ? "active" : ""} onClick={() => setFilter("enabled")}>Enabled</button><button className={filter === "attention" ? "active" : ""} onClick={() => setFilter("attention")}>Needs attention</button></div></div><div className="plugin-list">{plugins.map((plugin) => <div className="plugin-row" key={plugin.id}><span className="plugin-emblem">{plugin.name.slice(0, 2).toUpperCase()}</span><div className="plugin-copy"><div><strong>{plugin.name}</strong><span>v{plugin.version}</span></div><p>{plugin.description}</p><small>by {plugin.author}</small></div><div className="plugin-state"><span className={`state-pill ${plugin.status}`}>{plugin.status === "update" ? `Update ${plugin.nextVersion}` : plugin.status}</span><button onClick={() => setToast(`${plugin.name} details opened in preview mode.`)}>Details</button></div></div>)}</div></article>
      {toast && <PreviewToast message={toast} onClose={() => setToast("")} />}
    </section>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button className={`toggle ${checked ? "checked" : ""}`} role="switch" aria-checked={checked} aria-label={label} onClick={onChange}><span /></button>;
}

function SecurityView({ onPairServer }: { onPairServer: () => void }) {
  const [policies, setPolicies] = useState({ console: true, moderation: true, chat: true, pluginActions: false, errorCapture: true });
  const flip = (key: keyof typeof policies) => setPolicies((current) => ({ ...current, [key]: !current[key] }));

  return (
    <section className="module-view security-module">
      <SectionHeading kicker="Access and policy" title="Security center" copy="Control remote capabilities and review every privileged action." actions={<button className="primary-button" onClick={onPairServer}>Pair another server</button>} />
      <div className="security-grid">
        <article className="identity-card"><div className="identity-heading"><span className="identity-shield">◇</span><div><p className="eyebrow">Server identity</p><h3>Cryptographic link healthy</h3></div><span className="state-pill enabled">Verified</span></div><p>The plugin identity and dashboard gateway are using a trusted pairing relationship.</p><div className="identity-facts"><div><span>Server ID</span><code>srv_demo_••••8A21</code></div><div><span>Signing</span><strong>Ed25519</strong></div><div><span>Last verified</span><strong>Just now</strong></div></div><button className="secondary-button">View public key</button></article>
        <article className="security-score"><div className="score-ring"><strong>94</strong><span>/ 100</span></div><div><p className="eyebrow">Security posture</p><h3>Excellent protection</h3><p>Two recommendations remain before production launch.</p><div className="score-items"><span><i className="good" />Signed server identity</span><span><i className="good" />Role-based access</span><span><i className="warn" />Require MFA for owners</span></div></div></article>
      </div>
      <div className="security-columns">
        <article className="policy-panel"><header><div><p className="eyebrow">Remote policy</p><h3>Allowed capabilities</h3></div><span>Changes are audited</span></header><div className="policy-list"><div><span className="policy-icon">›_</span><div><strong>Console access</strong><p>Run allowlisted commands through the gateway.</p></div><Toggle checked={policies.console} onChange={() => flip("console")} label="Console access" /></div><div><span className="policy-icon">P</span><div><strong>Player moderation</strong><p>Kick, ban, message, and teleport players.</p></div><Toggle checked={policies.moderation} onChange={() => flip("moderation")} label="Player moderation" /></div><div><span className="policy-icon">#</span><div><strong>Chat interaction</strong><p>Read and send messages through PlexonChats.</p></div><Toggle checked={policies.chat} onChange={() => flip("chat")} label="Chat interaction" /></div><div><span className="policy-icon">◆</span><div><strong>Plugin actions</strong><p>Enable, disable, or reload installed plugins.</p></div><Toggle checked={policies.pluginActions} onChange={() => flip("pluginActions")} label="Plugin actions" /></div><div><span className="policy-icon">!</span><div><strong>Error capture</strong><p>Fingerprint exceptions found in server logs.</p></div><Toggle checked={policies.errorCapture} onChange={() => flip("errorCapture")} label="Error capture" /></div></div></article>
        <article className="audit-panel"><header><div><p className="eyebrow">Immutable record</p><h3>Recent audit events</h3></div><button>View all</button></header><div className="audit-list">{demoAudit.map((item) => <div key={item.id}><span className={`audit-result ${item.result}`}>{item.result === "success" ? "✓" : "!"}</span><div><strong>{item.action}</strong><p>{item.actor} · {item.target}</p></div><time>{item.time}</time></div>)}</div></article>
      </div>
    </section>
  );
}

export default function ManagementViews({ section, onPairServer }: ManagementViewsProps) {
  if (section === "players") return <PlayersView />;
  if (section === "console") return <ConsoleView />;
  if (section === "chat") return <ChatView />;
  if (section === "plugins") return <PluginsView />;
  return <SecurityView onPairServer={onPairServer} />;
}

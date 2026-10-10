"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { pairDashboardServer } from "../lib/data-source";
import { record, str, number } from "../lib/control-state";
import { normalizeServiceState } from "../lib/lifecycle-state";
import { authoritySummary } from "../lib/authority-summary";
import { useTelemetryNow } from "../lib/telemetry-clock";
import { DASHBOARD_VERSION } from "../lib/dashboard-version";
import { sections, type Section } from "../lib/workspace-navigation";
import { shellCopy } from "../lib/copy/shell";
import type { SessionActivity } from "../lib/session-activity";
import type { DashboardModel } from "./use-dashboard-session";
import { actionLabel } from "../lib/operation-messages";
import type { Confirmation } from "./use-signed-operations";
import { useConnectionState } from "./connection-summary";
import { Badge, Button, Dialog, Field, Popover, Select, Skeleton, Toast } from "./ui/primitives";
import { type IconName } from "./ui/icons";

const CompactPulse = dynamic(() => import("./charts/tick-pulse").then(m => m.TickPulse), { ssr: false });
const Preferences = dynamic(() => import("./preferences-dialog").then(m => m.PreferencesDialog), { ssr: false });
const groups: { label: string; pages: Section[] }[] = [
  { label: shellCopy.monitor, pages: ["Overview", "Performance"] },
  { label: shellCopy.operate, pages: ["Players", shellCopy.console, "Chat", "Plugins", "Server", "Backups"] },
  { label: shellCopy.manage, pages: ["Configuration", "Access", "Audit", "Settings"] },
];
const icons: Record<Section, IconName> = { Fleet: "fleet", Overview: "overview", Performance: "performance", Players: "players", Console: "console", Chat: "chat", Plugins: "plugins", Server: "server", Backups: "backups", Configuration: "configuration", Access: "access", Audit: "audit", Settings: "settings" };
const chords: Record<string, Section> = { g: "Fleet", o: "Overview", p: "Performance", l: "Players", c: shellCopy.console, h: "Chat", i: "Plugins", s: "Server", b: "Backups", f: "Configuration", a: "Access", u: "Audit", t: "Settings" };
function Brand() { return <div className="shell-brand"><strong>PlexonPanel</strong><span>{shellCopy.controlRoom}<span>{DASHBOARD_VERSION}</span></span></div>; }
function Rail({ section, navigate }: { section: Section; navigate: (section: Section) => void }) {
  const item = (page: Section) => <Button key={page} variant="quiet" icon={icons[page]} aria-current={section === page ? "page" : undefined} onClick={() => navigate(page)}>{page}</Button>;
  return <nav className="shell-nav" aria-label={shellCopy.workspaces}>{item("Fleet")}{groups.map(group => <div className="shell-nav-group" key={group.label}><span>{group.label}</span>{group.pages.map(item)}</div>)}</nav>;
}

/** This interface has no operation callback: every choice is navigation. */
export function NavigationPalette({ open, close, navigate, switchServer, servers }: { open: boolean; close: () => void; navigate: (section: Section) => void; switchServer: (id: string) => void; servers: readonly { id: string; name: string }[] }) {
  const [query, setQuery] = useState("");
  const finish = () => { setQuery(""); close(); };
  const matches = (name: string) => name.toLocaleLowerCase().includes(query.toLocaleLowerCase());
  return <Dialog className="shell-palette" open={open} onClose={finish} title={shellCopy.paletteTitle} description={shellCopy.paletteDescription}>
    <Field label={shellCopy.paletteFind} value={query} maxLength={80} onChange={e => setQuery(e.target.value)} autoFocus />
    <div className="shell-palette-list">{sections.filter(matches).map(page => <Button variant="quiet" icon={icons[page]} key={page} onClick={() => { navigate(page); finish(); }}>{shellCopy.goTo} {page}</Button>)}</div>
    {servers.some(s => matches(s.name)) && <div className="shell-palette-list"><h3>{shellCopy.pairedServers}</h3>{servers.filter(s => matches(s.name)).map(server => <Button variant="quiet" icon="server" key={server.id} onClick={() => { switchServer(server.id); finish(); }}>{server.name}</Button>)}</div>}
    {!sections.some(matches) && !servers.some(s => matches(s.name)) && <p>{shellCopy.paletteEmpty}</p>}
  </Dialog>;
}
function BoundConfirmation({ value }: { value: Confirmation }) {
  const target = value.parameters.path ?? value.parameters.plugin ?? value.parameters.playerId ?? value.parameters.deviceId ?? value.parameters.backupId;
  const label=actionLabel(value.action);
  return <Dialog className="shell-confirm" returnFocusElement={value.returnFocusElement} open onClose={() => value.resolve(false)} title={label} actions={<><Button onClick={() => value.resolve(false)}>{shellCopy.cancel}</Button><Button variant="danger" onClick={() => value.resolve(true)}>{label}</Button></>}>
    <Badge tone="warn">{shellCopy.confirmOperation}</Badge><p>{shellCopy.confirmBefore} <strong>{value.serverName}</strong> {shellCopy.confirmAfter}</p><code className="shell-identifier">{value.serverId}</code>
    {value.targetName && <p>Player: <strong>{value.targetName}</strong> <code>{str(value.parameters.playerId).slice(0,8)}</code></p>}
    {target !== undefined && <code className="shell-identifier">{String(target)}</code>}
    {["server.stop","server.restart","maintenance.restart.now"].includes(value.action) && <p>Players will be disconnected.</p>}
    {value.action === "backup.full.retry-upload" && <p>Upload the retained backup again. The server will stay running.</p>}
    {value.action === "files.write" && <p>Save the reviewed changes to this file on this server.</p>}
    {value.action === "chat.global.send" && <p>Send the message to this server’s global chat.</p>}
    {value.action === "console.execute" && <pre>{str(value.parameters.command)}</pre>}
    {value.action === "backup.full.delete" && <p>{shellCopy.deleteBackup}</p>}
    {value.action === "maintenance.recovery.resolve" && <p>{shellCopy.resolveRecovery}</p>}
    {value.action === "maintenance.restart.now" && <p>{shellCopy.restartMaintenance}</p>}
  </Dialog>;
}
function PairingScreen({ model: m }: { model: DashboardModel }) {
  const [code, setCode] = useState(""); const [name, setName] = useState<string>(shellCopy.defaultDevice);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  return <main className="deepslate shell-pair" data-ui6-pairing><section className="shell-pair-guide"><Brand /><h1>{shellCopy.pairHeadline}</h1><p>{shellCopy.pairIntro}</p><ol>
    <li>{shellCopy.pairRun} <code>/plexonpanel pair</code> {shellCopy.pairLocally}</li><li>{shellCopy.pairExpiryStep}</li><li>{shellCopy.pairRoleStep}</li>
  </ol><p className="pp-muted">{shellCopy.pairRole}</p></section>
    <section className="shell-pair-form"><h2>{shellCopy.pairTitle}</h2><form className="pp-stack" onSubmit={event => { event.preventDefault(); setBusy(true); setError(""); void pairDashboardServer(code, name).then(() => m.restore()).catch(reason => { setError(reason instanceof Error ? reason.message : shellCopy.pairFailed); setBusy(false); }); }}>
      <Field label={shellCopy.deviceName} required maxLength={64} value={name} onChange={e => setName(e.target.value)} autoComplete="off" />
      <Field label={shellCopy.pairCode} type="password" inputMode="numeric" required maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} autoComplete="one-time-code" hint={shellCopy.pairHint} />
      {(error || m.error) && <p role="alert">{error || m.error}</p>}
      <Button type="submit" variant="primary" busy={busy} disabled={!/^\d{6}$/.test(code)}>{busy ? shellCopy.pairWaiting : shellCopy.pairSubmit}</Button>
      {(m.credential || m.credentials.length > 0) && <Button onClick={() => { m.setPairing(false); m.setSection("Fleet"); if (!m.credential) m.setPhase("connecting"); }}>{shellCopy.pairBack}</Button>}
    </form><p className="pp-muted">{shellCopy.pairPrivacy}</p>
      {m.credentials.length > 0 && <Select label={shellCopy.pairSelect} value="" options={m.credentials.map(s => ({ value: s.serverId, label: m.serverLabels[s.serverId] || shellCopy.serverName(s.serverId) }))} onChange={m.switchServer} />}
    </section></main>;
}
function activityText(item: SessionActivity) {
  if (item.kind === "action") return `${item.action.replaceAll(".", " ")}. ${item.authority}. ${item.status}${item.code ? `. ${item.code}` : ""}`;
  if (item.kind === "backup-phase") return `${shellCopy.backupPhase}. ${item.phase}`;
  return `${shellCopy.relay} ${item.relay}. ${shellCopy.paper} ${item.paper === null ? shellCopy.unknown : item.paper ? shellCopy.connected : shellCopy.disconnected}. ${shellCopy.host} ${item.host === null ? shellCopy.unknown : item.host ? shellCopy.connected : shellCopy.disconnected}`;
}
export function DashboardShell({ model: m, children, pulseReady = false, pulseWindowEndAt }: { model: DashboardModel; children: ReactNode; pulseReady?: boolean; pulseWindowEndAt?: number }) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false); const [activityOpen, setActivityOpen] = useState(false); const chord = useRef(0);
  const connection = useConnectionState(m.state, m.phase);
  const ready = m.phase === "live" && !m.state.cached;
  const now = useTelemetryNow(m.state.updatedAt);
  const authority = authoritySummary(m.state, ready, connection, now);
  const name = (id: string) => id === m.state.serverId ? str(m.state.ready?.server.serverName ?? m.state.server.serverName, m.serverLabels[id] || shellCopy.serverName(id)) : m.serverLabels[id] || shellCopy.serverName(id);
  const servers = m.credentials.map(s => ({ id: s.serverId, name: name(s.serverId) }));
  const drawerOpen = m.mobileNavigation && m.sidebarOpen;
  const consoleAuthority = ready ? ({ HOST: shellCopy.host, PAPER_FALLBACK: shellCopy.paperFallback, UNAVAILABLE: shellCopy.unavailable }[m.state.ready?.consoleAuthority ?? "UNAVAILABLE"]) : shellCopy.unavailable;
  const { navigate } = m;
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.ctrlKey || event.metaKey || event.altKey || target?.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector("dialog[open]")) return;
      if (event.key === "?") { event.preventDefault(); setShortcutsOpen(true); return; }
      const now = performance.now(); const key = event.key.toLowerCase();
      if (chord.current > 0 && now - chord.current < 1000 && chords[key]) { chord.current = 0; event.preventDefault(); navigate(chords[key]); }
      else chord.current = key === "g" ? now : 0;
    };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  }, [navigate]);
  if (m.pairing || m.phase === "unpaired") return <PairingScreen model={m} />;
  if (m.phase === "loading") return <main className="deepslate shell-boot" data-ui6-boot><Brand /><h1>{shellCopy.bootTitle}</h1><p>{shellCopy.bootDescription}</p><Skeleton label={shellCopy.bootTitle} lines={3} /></main>;
  return <div className="deepslate shell" data-ui6-shell>
    <nav aria-label="Skip navigation"><a className="shell-skip" href="#server-workspace">{shellCopy.skip}</a></nav>
    <div className="shell-frame" inert={drawerOpen}>
      <aside className="shell-rail"><Brand /><Rail section={m.section} navigate={m.navigate} /><Button variant="quiet" onClick={() => setShortcutsOpen(true)}>{shellCopy.shortcutsTitle}</Button></aside>
      <div className="shell-main"><header className="shell-header">
        <Button className="shell-menu" variant="quiet" icon="menu" aria-label={shellCopy.openNavigation} aria-expanded={drawerOpen} onClick={() => m.setSidebarOpen(true)} />
        <div className="shell-server-identity" data-server-name={m.credential ? name(m.credential.serverId) : shellCopy.noServer}><Select label={shellCopy.selectedServer} value={m.credential?.serverId ?? ""} options={servers.map(s => ({ value: s.id, label: s.name }))} onChange={m.switchServer} /></div>
        <div className="shell-pulse-slot" data-ui6-pulse-slot>{pulseReady ? <CompactPulse key={m.state.serverId} history={m.state.history} receivedAt={m.state.receipts?.paperHealth??0} capturedAt={m.state.server.capturedAt??null} connected={ready&&Boolean(m.state.ready?.agents.paper)} intervalMs={number(m.state.server.sourceIntervalMillis)??2000} windowEndAt={pulseWindowEndAt} compact status={connection.label} /> : <Skeleton label="Loading compact Pulse" lines={1}/>}</div>
        <div className="shell-tools"><Button variant="quiet" icon="search" aria-label={shellCopy.openPalette} onClick={() => m.setPaletteOpen(true)}><span>{shellCopy.goTo}</span><kbd>⌘ / Ctrl K</kbd></Button><Button variant="quiet" icon="clock" aria-label={shellCopy.openActivity} onClick={() => setActivityOpen(true)} /><Button variant="quiet" icon="settings" aria-label={shellCopy.clientSettings} onClick={() => m.setPreferencesOpen(true)}><span>{shellCopy.clientSettings}</span></Button></div>
        <div className="shell-authority"><dl className="shell-source-line"><div><dt>{shellCopy.relay}</dt><dd>{connection.relay}</dd></div><div><dt>{shellCopy.paper}</dt><dd>{ready && m.state.ready ? m.state.ready.agents.paper ? shellCopy.connected : shellCopy.disconnected : shellCopy.unknown}</dd></div><div><dt>{shellCopy.host}</dt><dd>{connection.host}</dd></div><div><dt>{shellCopy.console}</dt><dd>{consoleAuthority}</dd></div></dl>
          <Popover label={<><span className="shell-authority-desktop">{shellCopy.authorityTitle}</span><span className="shell-authority-mobile">{authority.word} <span>{authority.count}/4 healthy</span></span></>} accessibleLabel={`${shellCopy.authorityTitle}: ${authority.word}, ${authority.count} of 4 healthy sources`} title={shellCopy.authorityDetails}><dl className="shell-facts"><div><dt>Relay</dt><dd>{connection.relay}</dd></div><div><dt>Paper</dt><dd>{ready && m.state.ready ? m.state.ready.agents.paper ? "Connected" : "Disconnected" : "Unknown"}</dd></div><div><dt>Host</dt><dd>{connection.host}</dd></div><div><dt>Console</dt><dd>{consoleAuthority}</dd></div></dl><p>Healthy count uses fresh compatible Paper health, fresh compatible Host service telemetry, the relay session and its declared console source. Each source retains its own authority.</p><p>{connection.detail}</p><p>{shellCopy.authorityDescription}</p><dl className="shell-facts"><div><dt>{shellCopy.hostState}</dt><dd>{ready && m.state.ready?.agents.host ? normalizeServiceState(m.state.service.state) : "unknown"}</dd></div><div><dt>{shellCopy.lastReceived}</dt><dd>{m.state.updatedAt ? new Date(m.state.updatedAt).toLocaleTimeString() : shellCopy.notSupplied}</dd></div><div><dt>{shellCopy.serviceCaptured}</dt><dd>{str(record(m.state.service.resources).capturedAt, shellCopy.notSupplied)}</dd></div><div><dt>{shellCopy.deviceRole}</dt><dd>{m.state.ready?.device.role ?? m.credential?.role ?? shellCopy.unknown}</dd></div><div><dt>{shellCopy.boundServer}</dt><dd><code>{m.credential?.serverId ?? shellCopy.notSelected}</code></dd></div></dl></Popover>
        </div></header>
        <main id="server-workspace" tabIndex={-1}><div className="shell-page-heading"><h1>{m.section}</h1><Button variant="quiet" icon="refresh" onClick={m.refreshCurrent}>{shellCopy.refresh}</Button></div>
        {(m.section !== "Fleet" || m.error) && <section className={m.section === "Overview" && ["online", "connecting"].includes(connection.kind) && !m.error ? "shell-health pp-sr-only" : "shell-health"} data-state={connection.kind} aria-label="Selected server status" role="status"><strong>{connection.label}</strong><p>{m.error || connection.detail}{m.state.cached && shellCopy.cached}</p>{m.phase === "reconnecting" && <Button onClick={() => m.setReconnect(v => v + 1)}>{shellCopy.retry}</Button>}</section>}
        <div className="shell-content">{children ?? <Skeleton label={shellCopy.loading(m.section)} lines={3} />}</div></main>
        <footer className="shell-footer">{shellCopy.footer}</footer>
      </div>
    </div>
    <Dialog className="shell-drawer" open={drawerOpen} onClose={() => m.setSidebarOpen(false)} title={shellCopy.navigation}><Brand /><Rail section={m.section} navigate={m.navigate} /><Button onClick={() => { m.setSidebarOpen(false); setShortcutsOpen(true); }}>{shellCopy.shortcutsTitle}</Button></Dialog>
    <NavigationPalette open={m.paletteOpen} close={() => m.setPaletteOpen(false)} navigate={m.navigate} switchServer={m.switchServer} servers={servers} />
    <Dialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} title={shellCopy.shortcutsTitle} description={shellCopy.shortcutsDescription}><dl className="shell-shortcuts"><div><dt>{shellCopy.paletteFind}</dt><dd><kbd>Ctrl / ⌘ K</kbd></dd></div><div><dt>{shellCopy.showShortcuts}</dt><dd><kbd>?</kbd></dd></div>{Object.entries(chords).map(([key, page]) => <div key={key}><dt>{page}</dt><dd><kbd>g</kbd> {shellCopy.then} <kbd>{key}</kbd></dd></div>)}</dl></Dialog>
    <Dialog className="shell-activity" open={activityOpen} onClose={() => setActivityOpen(false)} title={shellCopy.activityTitle} description={shellCopy.activityDescription} actions={<Button disabled={!m.activity.length} onClick={m.clearActivity}>{shellCopy.activityClear}</Button>}><ol>{m.activity.map(item => <li key={item.sequence}><time dateTime={new Date(item.observedAt).toISOString()}>{new Date(item.observedAt).toLocaleTimeString()}</time><strong>{name(item.serverId)}</strong><span>{activityText(item)}</span></li>)}</ol>{!m.activity.length && <p>{shellCopy.activityEmpty}</p>}</Dialog>
    {m.confirmation && <BoundConfirmation value={m.confirmation} />}
    {m.preferencesOpen && <Preferences close={() => m.setPreferencesOpen(false)} />}
    {m.notice && <div className="shell-notice"><Toast onDismiss={() => m.setNotice("")}>{m.notice}</Toast></div>}
  </div>;
}

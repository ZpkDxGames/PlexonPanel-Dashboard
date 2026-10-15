import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "motion/react";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { navigate, routeLabels, routes, type RouteName } from "../router";
import { useSession, useNow } from "../hooks";
import { classifyTelemetry } from "../adapter/telemetry-freshness";
import { connectionPhaseLabel, session } from "../adapter/session";
import { preferences, usePreferences } from "../store/preferences";

const navIcon: Record<RouteName, string> = { Fleet: "fleet", Overview: "overview", Performance: "performance", Players: "players", Console: "console", Backups: "backups", Access: "access", Settings: "settings" };
const descriptions: Record<RouteName, string> = {
  Fleet: "Your servers, together in one place.", Overview: "A clear view of your Minecraft server.",
  Performance: "Explore performance and spot changes over time.", Players: "See who’s online and manage your community.",
  Console: "Follow server activity and run commands.", Backups: "Protect your worlds and manage recovery.",
  Access: "Manage trusted devices and review activity.", Settings: "Make this workspace yours.",
};
const groups: { label: string; items: RouteName[] }[] = [
  { label: "Workspace", items: ["Fleet", "Overview", "Performance", "Players", "Console"] },
  { label: "Management", items: ["Backups", "Access", "Settings"] },
];

export function Shell({ route, children }: { route: RouteName; children: ReactNode }) {
  const snap = useSession();
  const now = useNow();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [query, setQuery] = useState("");
  const prefs = usePreferences();
  const osReducedMotion = useReducedMotion();
  const reduceMotion = prefs.reduceMotion || osReducedMotion;
  const name = String(snap.state.ready?.server.serverName ?? snap.labels[snap.state.serverId] ?? (snap.state.serverId || "No server selected"));
  const freshness = useMemo(() => classifyTelemetry({ capturedAt: snap.state.server.capturedAt, receivedAt: snap.state.receipts?.paperHealth, connected: snap.phase === "live", now }), [snap.state.server.capturedAt, snap.state.receipts?.paperHealth, snap.phase, now]);
  const results = routes.filter((item) => `${routeLabels[item]} ${descriptions[item]}`.toLowerCase().includes(query.trim().toLowerCase()));
  const openPalette = () => { setQuery(""); setPalette(true); };
  const go = (item: RouteName) => { navigate(item); setDrawer(false); setPalette(false); };

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        // Never stack navigation over an operation confirmation.
        if (!document.querySelector("dialog[open]")) { setQuery(""); setPalette(true); }
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);

  const brand = <><span className="brand-mark"><Icon name="layers" /></span><span className="brand-copy"><strong>Plexon<span>Panel</span></strong><small>Server workspace</small></span></>;
  const nav = <nav className="primary-nav" aria-label="Primary navigation">{groups.map((group) => <div className="nav-group" key={group.label}><span className="nav-group-label">{group.label}</span>{group.items.map((item) => <button className={route === item ? "nav-link active" : "nav-link"} key={item} title={routeLabels[item]} aria-label={routeLabels[item]} onClick={() => go(item)} aria-current={route === item ? "page" : undefined}><Icon name={navIcon[item]} /><span>{routeLabels[item]}</span>{route === item && <i className="nav-active-dot" />}</button>)}</div>)}</nav>;

  return <MotionConfig reducedMotion={reduceMotion ? "always" : "never"}><div className={collapsed ? "app-shell rail" : "app-shell"}>
    <a className="skip-link" href="#main-content">Skip to workspace</a>
    <aside className="sidebar">
      <button className="brand" onClick={() => navigate("Fleet")} aria-label="Open fleet">{brand}</button>
      {nav}
      <div className="sidebar-footer"><div className="sidebar-session"><span className="session-avatar"><Icon name="access" /></span><div><strong>{snap.state.ready?.device.name || "This device"}</strong><small>{snap.state.ready?.device.role || "Connected workspace"}</small></div></div><button className="collapse" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}><Icon name="chevron" /><span>Collapse sidebar</span></button></div>
    </aside>
    <header className="context-bar">
      <div className="context-location"><button className="mobile-menu" onClick={() => setDrawer(true)} aria-label="Open navigation"><Icon name="menu" /></button><button className="server-context" onClick={() => navigate("Fleet")} title="Switch server"><span className="server-glyph" /><strong>{name}</strong><Icon name="chevron" /></button><span className="context-divider">/</span><span className="context-page">{routeLabels[route]}</span></div>
      <div className="context-actions">
        <button className="command-trigger" onClick={openPalette} aria-label="Search pages"><Icon name="search" /><span>Search pages…</span><kbd>Ctrl K</kbd></button>
        <span className={`source-chip ${freshness.kind}`} title={`Paper telemetry: ${freshness.label}`}><i />{freshness.kind === "live" ? "Live telemetry" : freshness.kind === "skew" ? "Clock offset" : freshness.kind === "waiting" ? "Awaiting data" : freshness.kind === "disconnected" ? "Disconnected" : "Delayed telemetry"}</span>
        <button className="icon-button" onClick={() => preferences.update({ theme: document.documentElement.dataset.theme === "dark" ? "light" : "dark" })} aria-label="Toggle theme" title="Toggle theme"><Icon name="sun" /></button>
      </div>
    </header>
    <main className="workspace" id="main-content" tabIndex={-1}>
      {snap.fixture && <div className="fixture-banner">Preview data · synthetic development fixture · server actions are blocked</div>}
      <div className="workspace-heading"><div><span className="eyebrow">Server workspace</span><h1>{routeLabels[route]}</h1><p>{descriptions[route]}</p></div><div className="workspace-meta"><Icon name="clock" /><span>Telemetry <b>{freshness.label}</b></span></div></div>
      {snap.error && snap.phase !== "live" && <div className="connection-notice" role="alert"><div><strong>{connectionPhaseLabel(snap.phase)}</strong><span>{snap.error}</span></div><button onClick={() => session.reconnect()}>Retry now</button></div>}
      <AnimatePresence mode="wait"><motion.div key={route} initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: reduceMotion ? 1 : 0 }} transition={{ duration: reduceMotion ? 0 : 0.18 }}>{children}</motion.div></AnimatePresence>
      <footer className="workspace-footer"><span>PlexonPanel <span aria-hidden="true">/</span> Minecraft operations</span><span>{connectionPhaseLabel(snap.phase)}</span></footer>
    </main>
    <Modal open={drawer} onClose={() => setDrawer(false)} label="Navigation" className="navigation-dialog"><div className="drawer-heading"><div className="brand">{brand}</div><button className="icon-button" onClick={() => setDrawer(false)} aria-label="Close navigation"><Icon name="close" /></button></div>{nav}</Modal>
    <Modal open={palette} onClose={() => setPalette(false)} label="Search pages" className="palette"><div className="palette-input"><Icon name="search" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && results[0]) go(results[0]); if (event.key === "ArrowDown") { event.preventDefault(); event.currentTarget.closest("dialog")?.querySelector<HTMLButtonElement>(".palette-results button")?.focus(); } }} placeholder="Where would you like to go?" aria-label="Search pages" /><button className="icon-button" onClick={() => setPalette(false)} aria-label="Close search"><Icon name="close" /></button></div><div className="palette-results">{results.map((item) => <button key={item} onClick={() => go(item)}><Icon name={navIcon[item]} /><span>{routeLabels[item]}<small>{descriptions[item]}</small></span><Icon name="chevron" /></button>)}{!results.length && <p className="palette-empty" role="status">No pages found. Try “players” or “settings”.</p>}</div><footer className="palette-footer"><span>Enter to open · Tab to browse</span><span>Esc to close</span></footer></Modal>
    <nav className="bottom-nav" aria-label="Primary mobile navigation">{(["Overview", "Performance", "Players", "Console"] as RouteName[]).map((item) => <button key={item} onClick={() => go(item)} className={route === item ? "active" : ""} aria-current={route === item ? "page" : undefined}><Icon name={navIcon[item]} /><span>{routeLabels[item].replace(" & chat", "")}</span></button>)}</nav>
  </div></MotionConfig>;
}

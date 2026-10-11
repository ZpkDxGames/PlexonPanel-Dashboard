import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "./Icon";
import { navigate, routeLabels, routes, type RouteName } from "../router";
import { useSession, useNow } from "../hooks";
import { classifyTelemetry } from "../adapter/telemetry-freshness";
import { connectionPhaseLabel, session } from "../adapter/session";
import { preferences, usePreferences } from "../store/preferences";

const navIcon: Record<RouteName, string> = { Fleet: "fleet", Overview: "overview", Performance: "performance", Players: "players", Console: "console", Backups: "backups", Access: "access", Settings: "settings" };

export function Shell({ route, children }: { route: RouteName; children: ReactNode }) {
  const snap = useSession();
  const now = useNow();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const prefs = usePreferences();
  const name = String(snap.state.ready?.server.serverName ?? snap.labels[snap.state.serverId] ?? (snap.state.serverId || "No server selected"));
  const freshness = useMemo(() => classifyTelemetry({ capturedAt: snap.state.server.capturedAt, receivedAt: snap.state.receipts?.paperHealth, connected: snap.phase === "live", now }), [snap.state.server.capturedAt, snap.state.receipts?.paperHealth, snap.phase, now]);
  const skew = freshness.skewAheadMs > 5000;

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPalette(true); }
      if (event.key === "Escape") { setPalette(false); setDrawer(false); }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);

  const nav = <nav className="primary-nav" aria-label="Primary navigation">{routes.map((item) => <button className={route === item ? "nav-link active" : "nav-link"} key={item} onClick={() => { navigate(item); setDrawer(false); }} aria-current={route === item ? "page" : undefined}><Icon name={navIcon[item]} /><span>{routeLabels[item]}</span></button>)}</nav>;

  return <div className={collapsed ? "app-shell rail" : "app-shell"}>
    <a className="skip-link" href="#main-content">Skip to workspace</a>
    <aside className="sidebar">
      <button className="brand" onClick={() => navigate("Fleet")} aria-label="Open fleet"><span className="brand-mark">P</span><span className="brand-copy"><strong>PlexonPanel</strong><small>Command center</small></span></button>
      {nav}
      <button className="collapse" onClick={() => setCollapsed((value) => !value)}><Icon name="chevron" /> <span>Collapse sidebar</span></button>
    </aside>
    <header className="context-bar">
      <button className="mobile-menu" onClick={() => setDrawer(true)} aria-label="Open navigation"><Icon name="menu" /></button>
      <button className="server-context" onClick={() => navigate("Fleet")}><span className="server-glyph" /><span><small>Selected server</small><strong>{name}</strong></span><Icon name="chevron" /></button>
      <div className="context-actions">
        <button className="command-trigger" onClick={() => setPalette(true)}><Icon name="search" /><span>Find anything</span><kbd>⌘K</kbd></button>
        {skew ? <button className="source-chip attention" title={`${Math.round(freshness.skewAheadMs / 1000)} seconds ahead. Freshness expires by receipt time.`} onClick={() => navigate("Settings")}><Icon name="clock" /><span>Clock offset</span><strong>+{Math.round(freshness.skewAheadMs / 1000)}s</strong></button> : <span className={`source-chip ${freshness.kind}`}><i />{freshness.label}</span>}
        <button className="icon-button" onClick={() => preferences.update({theme: prefs.theme === "dark" ? "light" : "dark"})} aria-label="Toggle theme"><Icon name="sun" /></button>
        <span className={`connection-dot ${snap.phase === "live" ? "live" : ""}`} title={connectionPhaseLabel(snap.phase)} />
      </div>
    </header>
    <main className="workspace" id="main-content">
      {snap.fixture && <div className="fixture-banner">Development fixture · synthetic data · all dispatches are blocked</div>}
      <div className="workspace-heading"><div><span className="eyebrow">{name}</span><h1>{routeLabels[route]}</h1></div><div className="workspace-meta"><span>Paper <b>{freshness.label}</b></span><span>Host <b>{snap.state.ready?.agents.host ? "available" : "offline"}</b></span></div></div>
      {snap.error && snap.phase !== "live" && <div className="connection-notice" role="alert"><div><strong>{connectionPhaseLabel(snap.phase)}</strong><span>{snap.error}</span></div><button onClick={() => session.reconnect()}>Retry now</button></div>}
      <AnimatePresence mode="wait"><motion.div key={route} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>{children}</motion.div></AnimatePresence>
    </main>
    <AnimatePresence>{drawer && <><motion.button className="scrim" aria-label="Close navigation" onClick={() => setDrawer(false)} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} /><motion.aside className="mobile-drawer" initial={{x:-280}} animate={{x:0}} exit={{x:-280}}><div className="brand"><span className="brand-mark">P</span><span className="brand-copy"><strong>PlexonPanel</strong><small>Command center</small></span></div>{nav}</motion.aside></>}</AnimatePresence>
    <AnimatePresence>{palette && <motion.div className="palette-wrap" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={() => setPalette(false)}><motion.div className="palette" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(event) => event.stopPropagation()} initial={{scale:.98,y:-10}} animate={{scale:1,y:0}}><div className="palette-input"><Icon name="search" /><input autoFocus placeholder="Jump to a workspace…" aria-label="Search commands" /></div><div className="palette-results">{routes.map((item) => <button key={item} onClick={() => {navigate(item);setPalette(false);}}><Icon name={navIcon[item]} /><span>{routeLabels[item]}</span><small>Navigate</small></button>)}</div></motion.div></motion.div>}</AnimatePresence>
    <nav className="bottom-nav" aria-label="Primary mobile navigation">{(["Overview", "Performance", "Players", "Console"] as RouteName[]).map((item) => <button key={item} onClick={() => navigate(item)} className={route === item ? "active" : ""}><Icon name={navIcon[item]} /><span>{routeLabels[item].replace(" & chat", "")}</span></button>)}</nav>
  </div>;
}

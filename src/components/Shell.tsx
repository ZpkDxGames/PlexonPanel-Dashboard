import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "./Icon";
import { ToastViewport } from "./toast";
import { navigate, routeLabels, type RouteName } from "../router";
import { useSession, useNow } from "../hooks";
import { classifyTelemetry } from "../adapter/telemetry-freshness";
import { connectionPhaseLabel, session } from "../adapter/session";
import { preferences, usePreferences } from "../store/preferences";
import { emphasizedEase, motionTokens } from "../motion";

const navIcon: Record<RouteName, string> = { Fleet: "fleet", Overview: "overview", Performance: "performance", Players: "players", Console: "console", Backups: "backups", Access: "access", Settings: "settings" };
const groups: readonly { label: string; routes: readonly RouteName[] }[] = [
  { label: "Monitor", routes: ["Fleet", "Overview", "Performance"] },
  { label: "Operate", routes: ["Players", "Console", "Backups"] },
  { label: "System", routes: ["Access", "Settings"] },
];
const routeDescriptions: Record<RouteName, string> = {
  Fleet: "Paired server rooms",
  Overview: "Current operational state",
  Performance: "Retained telemetry evidence",
  Players: "Roster and scoped actions",
  Console: "Console, chat and plugins",
  Backups: "Host-owned restore points",
  Access: "Devices, scopes and audit",
  Settings: "Connection and presentation",
};

function useFocusBoundary(active: boolean, ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = ref.current;
    const background = document.querySelectorAll<HTMLElement>(".sidebar, .context-bar, .workspace, .bottom-nav");
    background.forEach((element) => element.setAttribute("inert", ""));
    const focusable = () => [...root.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
    requestAnimationFrame(() => focusable()[0]?.focus());
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes = focusable();
      if (!nodes.length) return;
      const first = nodes[0], last = nodes.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    root.addEventListener("keydown", trap);
    return () => {
      root.removeEventListener("keydown", trap);
      background.forEach((element) => element.removeAttribute("inert"));
      previous?.focus();
    };
  }, [active, ref]);
}

export function Shell({ route, children }: { route: RouteName; children: ReactNode }) {
  const snap = useSession();
  const now = useNow();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const drawerRef = useRef<HTMLElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const prefs = usePreferences();
  const timing = motionTokens[prefs.motion];
  const name = String(snap.state.ready?.server.serverName ?? snap.labels[snap.state.serverId] ?? (snap.state.serverId || "No server selected"));
  const freshness = useMemo(() => classifyTelemetry({ capturedAt: snap.state.server.capturedAt, receivedAt: snap.state.receipts?.paperHealth, connected: snap.phase === "live", now }), [snap.state.server.capturedAt, snap.state.receipts?.paperHealth, snap.phase, now]);
  const skew = freshness.skewAheadMs > 5000;
  const fleet = useMemo(() => {
    const selected = snap.state.serverId ? [{ serverId: snap.state.serverId, phase: snap.phase, state: snap.state }] : [];
    return [...selected, ...snap.fleet].filter((row, index, all) => all.findIndex((candidate) => candidate.serverId === row.serverId) === index);
  }, [snap.state.serverId, snap.state, snap.phase, snap.fleet]);
  const query = paletteQuery.trim().toLowerCase();
  const filteredRoutes = groups.flatMap((group) => group.routes).filter((item) => !query || routeLabels[item].toLowerCase().includes(query) || routeDescriptions[item].toLowerCase().includes(query));
  const filteredFleet = fleet.filter((row) => {
    const label = String(row.state.ready?.server.serverName ?? snap.labels[row.serverId] ?? row.serverId);
    return !query || label.toLowerCase().includes(query) || row.serverId.toLowerCase().includes(query);
  });

  useFocusBoundary(drawer, drawerRef);
  useFocusBoundary(palette, paletteRef);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setDrawer(false); setPalette(true); setPaletteQuery("");
      }
      if (event.key === "Escape") { setPalette(false); setDrawer(false); }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);

  const openRoute = (item: RouteName) => { navigate(item); setDrawer(false); setPalette(false); };
  const toggleTheme = () => {
    const update = () => preferences.update({ theme: prefs.theme === "dark" ? "light" : "dark" });
    const transitionDocument = document as Document & { startViewTransition?: (callback: () => void) => unknown };
    if (prefs.motion === "full" && transitionDocument.startViewTransition) transitionDocument.startViewTransition(update);
    else update();
  };
  const navigation = (context: "rail" | "drawer") => <nav className="primary-nav" aria-label={context === "rail" ? "Primary navigation" : "Navigation drawer"}>
    {groups.map((group) => <section className="nav-group" key={group.label} aria-label={group.label}>
      <span className="nav-group-label">{group.label}</span>
      {group.routes.map((item) => <button className={route === item ? "nav-link active" : "nav-link"} key={item} onClick={() => openRoute(item)} aria-current={route === item ? "page" : undefined} title={collapsed && context === "rail" ? routeLabels[item] : undefined}>
        {route === item && <motion.span className="nav-active-indicator" layoutId={`${context}-active-route`} transition={{ duration: timing.base, ease: emphasizedEase }} />}
        <Icon name={navIcon[item]} /><span>{routeLabels[item]}</span>
      </button>)}
    </section>)}
  </nav>;

  return <div className={collapsed ? "app-shell rail" : "app-shell"}>
    <a className="skip-link" href="#main-content">Skip to workspace</a>
    <aside className="sidebar" aria-label="Application navigation">
      <button className="brand" onClick={() => navigate("Fleet")} aria-label="Open fleet"><span className="brand-mark">P</span><span className="brand-copy"><strong>PlexonPanel</strong><small>Command center</small></span></button>
      {navigation("rail")}
      <button className="collapse" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}><Icon name="chevron" /> <span>Collapse sidebar</span></button>
    </aside>

    <header className="context-bar">
      <button className="mobile-menu" onClick={() => { setPalette(false); setDrawer(true); }} aria-label="Open navigation"><Icon name="menu" /></button>
      <button className="server-context" onClick={() => navigate("Fleet")}><span className="server-glyph" /><span><small>Selected server</small><strong>{name}</strong></span><Icon name="chevron" /></button>
      <div className="context-actions">
        <button className="command-trigger" aria-label="Find workspace or server" onClick={() => { setDrawer(false); setPalette(true); setPaletteQuery(""); }}><Icon name="search" /><span>Find workspace or server</span><kbd>⌘K</kbd></button>
        {skew ? <button className="source-chip attention" title={`${Math.round(freshness.skewAheadMs / 1000)} seconds ahead. Freshness expires by receipt time.`} onClick={() => navigate("Settings")}><Icon name="clock" /><span>Clock offset</span><strong>+{Math.round(freshness.skewAheadMs / 1000)}s</strong></button> : <span className={`source-chip ${freshness.kind}`}><i />{freshness.label}</span>}
        <button className="icon-button" onClick={toggleTheme} aria-label="Toggle color theme" title="Toggle color theme"><Icon name="sun" /></button>
        <span className={`connection-dot ${snap.phase === "live" ? "live" : ""}`} title={connectionPhaseLabel(snap.phase)} role="status" aria-label={`Connection ${connectionPhaseLabel(snap.phase)}`} />
      </div>
    </header>

    <main className="workspace" id="main-content">
      {snap.fixture && <div className="fixture-banner">Development fixture · synthetic data · all dispatches are blocked</div>}
      <div className="workspace-heading"><div><span className="eyebrow">{name}</span><h1>{routeLabels[route]}</h1><p>{routeDescriptions[route]}</p></div><div className="workspace-meta"><span>Paper <b>{freshness.label}</b></span><span>Host <b>{snap.state.ready?.agents.host ? "available" : "offline"}</b></span></div></div>
      {snap.error && snap.phase !== "live" && <div className="connection-notice" role="alert"><div><strong>{connectionPhaseLabel(snap.phase)}</strong><span>{snap.error}</span></div><button onClick={() => session.reconnect()}>Retry now</button></div>}
      <AnimatePresence mode="wait"><motion.div className="route-stage" key={route} initial={{ opacity: 0, y: prefs.motion === "full" ? 8 : 0 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: prefs.motion === "full" ? -4 : 0 }} transition={{ duration: timing.base, ease: emphasizedEase }}>{children}</motion.div></AnimatePresence>
    </main>

    <AnimatePresence>{drawer && <><motion.button className="scrim" aria-label="Close navigation" onClick={() => setDrawer(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><motion.aside ref={drawerRef} className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Navigation" initial={{ x: prefs.motion === "full" ? -288 : 0, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: prefs.motion === "full" ? -288 : 0, opacity: 0 }} transition={{ duration: timing.base, ease: emphasizedEase }}><div className="drawer-head"><div className="brand"><span className="brand-mark">P</span><span className="brand-copy"><strong>PlexonPanel</strong><small>Command center</small></span></div><button className="icon-button" onClick={() => setDrawer(false)} aria-label="Close navigation"><Icon name="close" /></button></div>{navigation("drawer")}</motion.aside></>}</AnimatePresence>

    <AnimatePresence>{palette && <motion.div className="palette-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setPalette(false)}><motion.div ref={paletteRef} className="palette" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(event) => event.stopPropagation()} initial={{ scale: prefs.motion === "full" ? .975 : 1, y: prefs.motion === "full" ? -10 : 0, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: prefs.motion === "full" ? .985 : 1, opacity: 0 }} transition={{ duration: timing.base, ease: emphasizedEase }}>
      <div className="palette-input"><Icon name="search" /><input autoFocus value={paletteQuery} onChange={(event) => setPaletteQuery(event.target.value)} placeholder="Search workspaces and paired servers…" aria-label="Search commands" /><kbd>Esc</kbd></div>
      <div className="palette-results">
        {filteredRoutes.length > 0 && <section><span className="palette-label">Workspaces</span>{filteredRoutes.map((item) => <button key={item} onClick={() => openRoute(item)}><Icon name={navIcon[item]} /><span><strong>{routeLabels[item]}</strong><small>{routeDescriptions[item]}</small></span><kbd>Go</kbd></button>)}</section>}
        {filteredFleet.length > 0 && <section><span className="palette-label">Paired servers</span>{filteredFleet.map((row) => { const label = String(row.state.ready?.server.serverName ?? snap.labels[row.serverId] ?? row.serverId); return <button key={row.serverId} onClick={() => { void session.select(row.serverId).then(() => openRoute("Overview")); }}><Icon name="server" /><span><strong>{label}</strong><small>{row.phase} · {row.serverId}</small></span><kbd>Open</kbd></button>; })}</section>}
        {!filteredRoutes.length && !filteredFleet.length && <div className="palette-empty"><Icon name="search" /><strong>No matching destination</strong><span>Try a workspace name or paired server.</span></div>}
      </div>
    </motion.div></motion.div>}</AnimatePresence>

    <nav className="bottom-nav" aria-label="Primary mobile navigation">{(["Overview", "Performance", "Players", "Console"] as RouteName[]).map((item) => <button key={item} onClick={() => navigate(item)} className={route === item ? "active" : ""}><Icon name={navIcon[item]} /><span>{routeLabels[item].replace(" & chat", "")}</span></button>)}</nav>
    <ToastViewport />
  </div>;
}

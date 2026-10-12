import { copy } from "../i18n/en";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { ServerIcon } from "./ServerIcon";
import { navigate, routeLabels, routes, type RouteName } from "../router";
import { useSession, useNow } from "../hooks";
import { classifyTelemetry } from "../adapter/telemetry-freshness";
import { connectionPhaseLabel, session } from "../adapter/session";
import { preferences, usePreferences } from "../store/preferences";
const icons: Record<RouteName, string> = {
  Overview: "overview",
  Console: "console",
  Players: "players",
  Performance: "performance",
  Worlds: "globe",
  Backups: "backups",
  Schedules: "clock",
  Logs: "logs",
  Fleet: "fleet",
  Access: "access",
  Settings: "settings",
};
const descriptions: Record<RouteName, string> = {
  Overview: "Your server at a glance.",
  Console: "Live output and commands, with room to focus.",
  Players: "Your community, online and within reach.",
  Performance: "Understand ticks, compute and memory over time.",
  Worlds: "A closer look at every world and dimension.",
  Backups: "Keep your worlds safe, locally and offsite.",
  Schedules: "Plan restarts and review your maintenance policy.",
  Logs: "Player arrivals, world issues and backup events.",
  Fleet: "All your paired servers in one place.",
  Access: "Manage trusted devices and review activity.",
  Settings: "Make this workspace yours.",
};
function readCollapsed() {
  try {
    return localStorage.getItem("plexon:sidebar") === "collapsed";
  } catch {
    return false;
  }
}
export function Shell({
  route,
  children,
}: {
  route: RouteName;
  children: ReactNode;
}) {
  const snap = useSession(),
    now = useNow(),
    prefs = usePreferences();
  const [collapsed, setCollapsed] = useState(readCollapsed),
    [drawer, setDrawer] = useState(false),
    [palette, setPalette] = useState(false),
    [query, setQuery] = useState(""),
    [choice, setChoice] = useState(0),
    [notifications, setNotifications] = useState(false);
  const paletteRef = useRef<HTMLDialogElement>(null),
    drawerRef = useRef<HTMLDialogElement>(null),
    notifyRef = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState({ top: 0, height: 44 });
  const name = String(
    snap.state.ready?.server.serverName ??
      snap.labels[snap.state.serverId] ??
      (snap.state.serverId || "No server selected"),
  );
  const freshness = useMemo(
    () =>
      classifyTelemetry({
        capturedAt: snap.state.server.capturedAt,
        receivedAt: snap.state.receipts?.paperHealth,
        connected: snap.phase === "live",
        now,
      }),
    [
      snap.state.server.capturedAt,
      snap.state.receipts?.paperHealth,
      snap.phase,
      now,
    ],
  );
  const filtered = routes.filter((r) =>
    `${routeLabels[r]} ${descriptions[r]}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const playerMatches = snap.state.players
    .filter(
      (p) =>
        query.length > 1 &&
        String(p.name).toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 5);
  const entries = [
    ...filtered.map((r) => ({
      label: routeLabels[r],
      icon: icons[r],
      go: () => navigate(r),
    })),
    ...playerMatches.map((p) => ({
      label: String(p.name),
      icon: "players",
      go: () => navigate("Players"),
    })),
  ];
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuery("");
        setChoice(0);
        setPalette(true);
      }
      if (e.key === "Escape") {
        setPalette(false);
        setDrawer(false);
        setNotifications(false);
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>(
      "[aria-current=page]",
    );
    if (el) {
      el.scrollIntoView({ block: "nearest" });
      setPill({
        top:
          el.getBoundingClientRect().top -
          (navRef.current?.getBoundingClientRect().top ?? 0) +
          (navRef.current?.scrollTop ?? 0),
        height: el.offsetHeight,
      });
    }
  }, [route, collapsed]);
  useEffect(() => {
    if (palette) paletteRef.current?.showModal();
    else if (paletteRef.current?.open) {
      paletteRef.current.close();
      trigger.current?.focus();
    }
  }, [palette]);
  useEffect(() => {
    if (drawer) drawerRef.current?.showModal();
    else if (drawerRef.current?.open) drawerRef.current.close();
  }, [drawer]);
  useEffect(() => {
    if (notifications) notifyRef.current?.showModal();
    else if (notifyRef.current?.open) notifyRef.current.close();
  }, [notifications]);
  const nav = (mobile = false) => (
    <nav
      ref={mobile ? undefined : navRef}
      className="primary-nav"
      aria-label={mobile ? "All pages" : "Primary navigation"}
    >
      {!mobile && (
        <span
          className="nav-pill"
          style={{
            transform: `translateY(${pill.top}px)`,
            height: pill.height,
          }}
        />
      )}
      {routes.map((item, i) => (
        <div key={item}>
          {[5, 10].includes(i) && (
            <div className="nav-group">{i === 5 ? "Manage" : "Workspace"}</div>
          )}
          <button
            className={`nav-link ${route === item ? "active" : ""}`}
            onClick={() => {
              navigate(item);
              setDrawer(false);
            }}
            aria-current={route === item ? "page" : undefined}
            title={routeLabels[item]}
          >
            <Icon name={icons[item]} />
            <span>{routeLabels[item]}</span>
            {item === "Players" && (
              <span className="badge">{snap.state.players.length}</span>
            )}
          </button>
        </div>
      ))}
    </nav>
  );
  return (
    <>
      <div className={`app-shell ${collapsed ? "rail" : ""}`}>
        <a
          className="skip-link"
          href="#main-content"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById("main-content")?.focus();
          }}
        >
          {copy.skip_to_workspace_94000}
        </a>
        <aside className="sidebar" aria-label={copy.workspace_navigation_921a5}>
          <button
            className="brand"
            onClick={() => navigate("Fleet")}
            aria-label={copy.open_fleet_2cf70}
          >
            <ServerIcon />
            <span className="brand-copy">
              <strong>{copy.plexon_6bab8}</strong>
              <small>{copy.server_panel_6100c}</small>
            </span>
          </button>
          {nav()}
          <button
            className="collapse"
            onClick={() => {
              setCollapsed((v) => !v);
              try {
                localStorage.setItem(
                  "plexon:sidebar",
                  collapsed ? "expanded" : "collapsed",
                );
              } catch {}
            }}
            title={copy.collapse_sidebar_9e687}
          >
            <Icon name="chevron" />
            <span>
              {collapsed ? "Expand" : "Collapse"}
              {copy._sidebar_6aea5}
            </span>
          </button>
          <div className="side-foot">
            <span className="avatar">
              {(snap.state.ready?.device.name ?? "P").slice(0, 1)}
            </span>
            <div>
              <b>{snap.state.ready?.device.name ?? "Paired browser"}</b>
              {snap.state.ready?.device.role ?? "Unpaired"}
              <small> · 6.5.0</small>
            </div>
          </div>
        </aside>
        <div className="main-column">
          <header className="topbar context-bar">
            <button
              className="iconbtn mobile-menu"
              onClick={() => setDrawer(true)}
              aria-label={copy.open_all_pages_1adce}
            >
              <Icon name="menu" />
            </button>
            <button
              className="server-context"
              onClick={() => navigate("Fleet")}
              title={copy.change_server_08602}
            >
              <strong>{name}</strong>
              <Icon name="chevron" />
              <span className="crumb-label"> / {routeLabels[route]}</span>
            </button>
            <div className="spacer" />
            <div className="context-actions">
              <button
                className="search"
                ref={trigger}
                onClick={() => {
                  setQuery("");
                  setChoice(0);
                  setPalette(true);
                }}
                aria-label={copy.open_command_palette_33c64}
              >
                <Icon name="search" />
                <span>{copy.search_pages_players_commands_bf19e}</span>
                <kbd>{copy.ctrl_k_a784e}</kbd>
              </button>
              {freshness.skewAheadMs > 5000 && (
                <button
                  className="source-chip attention"
                  title={`Server clock is ${Math.round(freshness.skewAheadMs / 1000)}s ahead. Freshness uses receipt time.`}
                  onClick={() => navigate("Settings")}
                >
                  <Icon name="clock" />
                  {copy.clock_offset_e11f9}
                </button>
              )}
              <button
                className="iconbtn"
                onClick={() =>
                  preferences.update({
                    theme:
                      document.documentElement.dataset.theme === "dark"
                        ? "light"
                        : "dark",
                  })
                }
                aria-label={copy.toggle_theme_9b0ea}
                title={copy.toggle_light_dark_dcd2e}
              >
                <Icon
                  name={
                    document.documentElement.dataset.theme === "dark"
                      ? "sun"
                      : "moon"
                  }
                />
              </button>
              <button
                className="iconbtn"
                onClick={() => setNotifications(true)}
                aria-label={copy.notifications_753a2}
                title={copy.recent_events_8b65e}
              >
                <Icon name="bell" />
                {snap.state.console.some((l) => l.level === "ERROR") && (
                  <span className="dot" />
                )}
              </button>
            </div>
          </header>
          <main className="workspace boot" id="main-content" tabIndex={-1}>
            {snap.fixture && (
              <div className="fixture-banner">
                <span>{copy.design_demo_simulated_data_no_server_a_cf147}</span>
                <a href="?demo=1&idle=1#Overview">{copy.idle_cc1eb}</a>
                <a href="?demo=1&offline=1#Overview">{copy.offline_e01fa}</a>
              </div>
            )}
            {route !== "Overview" && (
              <div className="workspace-heading">
                <div>
                  <h1>{routeLabels[route]}</h1>
                  <p>{descriptions[route]}</p>
                </div>
              </div>
            )}
            {snap.error && snap.phase !== "live" && (
              <div className="connection-notice" role="alert">
                <div>
                  <strong>{connectionPhaseLabel(snap.phase)}</strong>
                  <span>{snap.error}</span>
                </div>
                <button onClick={() => session.reconnect()}>
                  {copy.reconnect_now_a2f4e}
                </button>
              </div>
            )}
            <div
              className="route-view"
              key={`${route}:${snap.state.serverId}:${snap.revision}`}
            >
              {children}
            </div>
          </main>
        </div>
        <nav className="bottom-nav" aria-label={copy.mobile_navigation_058f3}>
          {(["Overview", "Console", "Players", "Backups"] as RouteName[]).map(
            (r) => (
              <button
                key={r}
                onClick={() => navigate(r)}
                className={route === r ? "active" : ""}
                aria-current={route === r ? "page" : undefined}
                title={routeLabels[r]}
              >
                <Icon name={icons[r]} />
                <span>{routeLabels[r]}</span>
              </button>
            ),
          )}
          <button
            onClick={() => setDrawer(true)}
            aria-label={copy.more_pages_1fd2b}
          >
            <Icon name="menu" />
            <span>{copy.more_4bab2}</span>
          </button>
        </nav>
        <dialog
          ref={drawerRef}
          className="mobile-drawer"
          aria-label={copy.all_pages_921a7}
          onCancel={() => setDrawer(false)}
        >
          <button className="collapse" onClick={() => setDrawer(false)}>
            {copy.close_menu_6c9fc}
          </button>
          {nav(true)}
        </dialog>
        <dialog
          ref={paletteRef}
          className="palette"
          aria-label={copy.command_palette_7b6b5}
          onCancel={() => setPalette(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setChoice((v) =>
                Math.max(
                  0,
                  Math.min(
                    entries.length - 1,
                    v + (e.key === "ArrowDown" ? 1 : -1),
                  ),
                ),
              );
            }
            if (e.key === "Enter") {
              e.preventDefault();
              entries[choice]?.go();
              setPalette(false);
            }
          }}
        >
          <div className="palette-input">
            <Icon name="search" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setChoice(0);
              }}
              placeholder={copy.find_a_page_or_player_10584}
              aria-label={copy.search_commands_5ae3a}
            />
          </div>
          <div className="palette-results">
            {entries.map((item, i) => (
              <button
                key={item.label}
                aria-selected={choice === i}
                onClick={() => {
                  item.go();
                  setPalette(false);
                }}
              >
                <Icon name={item.icon} />
                {item.label}
                <small>{copy.open_cf9b7}</small>
              </button>
            ))}
            {!entries.length && (
              <div className="inline-empty">
                {copy.no_matches_try_a_page_or_player_name_35d54}
              </div>
            )}
          </div>
          <div className="dialog-actions">
            <button className="btn" onClick={() => setPalette(false)}>
              {copy.close_bbfa7}
            </button>
          </div>
        </dialog>
        <dialog
          ref={notifyRef}
          aria-label={copy.recent_events_8b65e}
          onCancel={() => setNotifications(false)}
        >
          <h2>{copy.recent_events_8b65e}</h2>
          <p className="subtle">
            {copy.the_latest_server_warnings_and_errors_07e93}
          </p>
          {snap.state.console
            .filter((l) => ["WARN", "ERROR", "FATAL"].includes(String(l.level)))
            .slice(-5)
            .map((l, i) => (
              <div className="notice warning" key={i}>
                {String(l.content ?? l.rawText)}
              </div>
            ))}
          {!snap.state.console.some((l) =>
            ["WARN", "ERROR", "FATAL"].includes(String(l.level)),
          ) && (
            <div className="inline-empty">
              <strong>{copy.all_quiet_889fd}</strong>
              <span>{copy.no_warnings_received_in_this_session_498ee}</span>
            </div>
          )}
          <div className="dialog-actions">
            <button className="btn" onClick={() => setNotifications(false)}>
              {copy.close_bbfa7}
            </button>
          </div>
        </dialog>
      </div>
    </>
  );
}

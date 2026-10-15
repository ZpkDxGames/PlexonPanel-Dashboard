import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { BrandMark } from "./Brand";
import { Modal } from "./Modal";
import { ToastViewport } from "./toast";
import { navigate, routeLabels, routes, type RouteName } from "../router";
import { useSession, useNow } from "../hooks";
import { session, connectionPhaseLabel } from "../adapter/session";
import { preferences, usePreferences } from "../store/preferences";
import { sourceEvidence } from "../presentation/telemetry";
const icons: Record<RouteName, string> = {
  Fleet: "fleet",
  Overview: "overview",
  Performance: "performance",
  Players: "players",
  Console: "console",
  Backups: "backups",
  Access: "access",
  Settings: "settings",
};
const descriptions: Record<RouteName, string> = {
  Fleet: "Every instance. One place to begin.",
  Overview: "Your Minecraft server, in perspective.",
  Performance: "Inspect the measurements behind the moment.",
  Players: "Know your community. Act with context.",
  Console: "The live record of your server.",
  Backups: "A durable record of your worlds.",
  Access: "Follow the operation. Understand the authority.",
  Settings: "A workspace that works your way.",
};
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
  const [drawer, setDrawer] = useState(false),
    [palette, setPalette] = useState(false),
    [query, setQuery] = useState("");
  const name = String(
    snap.state.ready?.server.serverName ??
      snap.labels[snap.state.serverId] ??
      (snap.state.serverId || "Choose a server"),
  );
  const paper = sourceEvidence(snap.state, "paperHealth", now),
    host = sourceEvidence(snap.state, "hostSystem", now);
  const fleet = useMemo(
    () =>
      [
        ...(snap.state.serverId
          ? [
              {
                serverId: snap.state.serverId,
                state: snap.state,
                phase: snap.phase,
              },
            ]
          : []),
        ...snap.fleet,
      ].filter(
        (row, i, all) =>
          all.findIndex((other) => other.serverId === row.serverId) === i,
      ),
    [snap.state, snap.phase, snap.fleet],
  );
  const clock = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: prefs.timezone === "UTC" ? "UTC" : undefined,
      }),
    [prefs.timezone],
  );
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setDrawer(false);
        setPalette(true);
        setQuery("");
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  const open = (item: RouteName) => {
    navigate(item);
    setDrawer(false);
    setPalette(false);
  };
  const nav = (mobile = false) => (
    <nav
      className="primary-nav"
      aria-label={mobile ? "Navigation drawer" : "Primary navigation"}
    >
      {routes.map((item) => (
        <button
          key={item}
          className={`nav-link ${route === item ? "active" : ""}`}
          aria-label={routeLabels[item]}
          aria-current={route === item ? "page" : undefined}
          onClick={() => open(item)}
        >
          <Icon name={icons[item]} />
          <span>
            {item === "Console"
              ? "Console"
              : item === "Access"
                ? "Access"
                : routeLabels[item]}
          </span>
        </button>
      ))}
    </nav>
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to workspace
      </a>
      <header className="masthead">
        <button
          className="brand"
          aria-label="Open fleet"
          onClick={() => open("Fleet")}
        >
          <BrandMark />
          <span>
            plexon<span className="brand-light">panel</span>
          </span>
        </button>
        <div className="masthead-divider" />
        <button
          className="server-context"
          onClick={() => {
            setQuery("");
            setPalette(true);
          }}
        >
          <Icon name="server" />
          <span>
            <small>SELECTED SERVER</small>
            <strong>{name}</strong>
          </span>
          <Icon name="chevron" />
        </button>
        <div className="masthead-status">
          <StatusDot live={snap.phase === "live"} />
          <span>{connectionPhaseLabel(snap.phase)}</span>
        </div>
        <div className="context-actions">
          <button
            className="command-trigger"
            aria-label="Find workspace or server"
            onClick={() => {
              setPalette(true);
              setQuery("");
            }}
          >
            <Icon name="search" />
            <span>Search</span>
            <kbd>⌘ K</kbd>
          </button>
          <button
            className="icon-button"
            aria-label="Toggle color theme"
            onClick={() =>
              preferences.update({
                theme:
                  document.documentElement.dataset.theme === "dark"
                    ? "light"
                    : "dark",
              })
            }
          >
            <Icon name="sun" />
          </button>
          <span
            className="operator-avatar"
            title={snap.state.ready?.device.name ?? "Browser device"}
          >
            {snap.state.ready?.device.name?.slice(0, 1).toUpperCase() ?? "P"}
          </span>
        </div>
      </header>
      <div className="workspace-bar" role="region" aria-label="Workspace navigation">
        {nav()}
        <div className="mobile-location">
          <button
            className="icon-button"
            aria-label="Open navigation"
            onClick={() => setDrawer(true)}
          >
            <Icon name="menu" />
          </button>
          <strong>{routeLabels[route]}</strong>
          <span>Workspace</span>
        </div>
        <time>
          {clock.format(now)}
          <small>{prefs.timezone === "UTC" ? " UTC" : " local"}</small>
        </time>
      </div>
      <main
        id="main-content"
        className={`workspace workspace-${route.toLowerCase()}`}
      >
        {snap.fixture && (
          <div className="fixture-banner">
            DEVELOPMENT PREVIEW{" "}
            <span>Synthetic telemetry · operational dispatch disabled</span>
          </div>
        )}
        <div className="workspace-heading">
          <div>
            <span className="eyebrow">
              {route === "Fleet"
                ? "SERVER DIRECTORY"
                : route === "Settings"
                  ? "BROWSER WORKSPACE"
                  : (snap.state.ready?.server.instanceKey ??
                    "SERVER OPERATIONS")}
            </span>
            <h1>{routeLabels[route]}</h1>
            <p>{descriptions[route]}</p>
          </div>
          <div className="workspace-meta" aria-label="Source health">
            <span>
              <StatusDot live={paper.kind === "live"} />
              <b>Paper</b> {paper.kind}
            </span>
            <span>
              <StatusDot live={host.kind === "live"} />
              <b>Host</b> {host.kind}
            </span>
            <small>
              Minecraft{" "}
              {snap.state.ready?.server.minecraftVersion ?? "unavailable"}
            </small>
          </div>
        </div>
        {snap.error && snap.phase !== "live" && (
          <div className="connection-notice" role="alert">
            <Icon name="alert" />
            <div>
              <strong>{connectionPhaseLabel(snap.phase)}</strong>
              <p>{snap.error}</p>
            </div>
            <button
              className="button secondary"
              onClick={() => session.reconnect()}
            >
              Retry connection
            </button>
          </div>
        )}
        <div className="route-stage" key={`${route}:${snap.revision}`}>
          {children}
        </div>
        <footer className="workspace-footer">
          <span>
            <BrandMark />
            PlexonPanel
          </span>
          <span>
            {name} <b>·</b> Protocol 3
          </span>
          <span>Operations, with perspective.</span>
        </footer>
      </main>
      <Modal
        open={drawer}
        onClose={() => setDrawer(false)}
        label="Navigation"
        className="mobile-drawer"
      >
        <div className="drawer-head">
          <BrandMark />
          <strong>Workspaces</strong>
          <button
            className="icon-button"
            aria-label="Close navigation"
            onClick={() => setDrawer(false)}
          >
            <Icon name="close" />
          </button>
        </div>
        {nav(true)}
      </Modal>
      <Modal
        open={palette}
        onClose={() => setPalette(false)}
        label="Command palette"
        className="palette"
      >
        <div className="palette-input">
          <Icon name="search" />
          <input
            autoFocus
            placeholder="Find a workspace or paired server"
            aria-label="Search commands"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className="icon-button"
            aria-label="Close search"
            onClick={() => setPalette(false)}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="palette-results">
          <span className="eyebrow">Workspaces</span>
          {routes
            .filter((item) =>
              routeLabels[item].toLowerCase().includes(query.toLowerCase()),
            )
            .map((item) => (
              <button key={item} onClick={() => open(item)}>
                <Icon name={icons[item]} />
                <span>
                  <strong>{routeLabels[item]}</strong>
                  <small>{descriptions[item]}</small>
                </span>
                <Icon name="arrow" />
              </button>
            ))}
          <span className="eyebrow">Paired servers</span>
          {fleet
            .filter((row) =>
              String(row.state.ready?.server.serverName ?? row.serverId)
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((row) => (
              <button
                key={row.serverId}
                onClick={() => {
                  void session
                    .select(row.serverId)
                    .then(() => open("Overview"));
                }}
              >
                <Icon name="server" />
                <span>
                  <strong>
                    {String(
                      row.state.ready?.server.serverName ??
                        snap.labels[row.serverId] ??
                        row.serverId,
                    )}
                  </strong>
                  <small>{row.phase}</small>
                </span>
              </button>
            ))}
        </div>
      </Modal>
      <ToastViewport />
    </div>
  );
}
function StatusDot({ live }: { live: boolean }) {
  return (
    <i className={`source-dot ${live ? "live" : ""}`} aria-hidden="true" />
  );
}

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { BrandMark } from "./Brand";
import { Modal } from "./Modal";
import { ToastViewport } from "./toast";
import { navigate, routeLabels, routes, type RouteName } from "../router";
import { useSession, useNow } from "../hooks";
import { session, connectionPhaseLabel } from "../adapter/session";
import { preferences, usePreferences } from "../store/preferences";
import { SourceRibbon } from "./nextgen/SourceRibbon";
import { WorkspaceHeader } from "./nextgen/WorkspaceHeader";
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
  Fleet: "All your paired servers, together.",
  Overview: "Monitor your server and manage its next move.",
  Performance: "Explore runtime, compute and memory signals.",
  Players: "Your community, with the context to manage it.",
  Console: "Live output, conversations and installed plugins.",
  Backups: "Protect your worlds with verified restore points.",
  Access: "Manage paired devices and inspect server activity.",
  Settings: "Make this browser workspace your own.",
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
    [query, setQuery] = useState(""),
    [selectError, setSelectError] = useState("");
  const name = String(
    snap.state.ready?.server.serverName ??
      snap.labels[snap.state.serverId] ??
      (snap.state.serverId || "Choose a server"),
  );

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
  const search = () => {
    setDrawer(false);
    setPalette(true);
    setQuery("");
    setSelectError("");
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
          <span>{routeLabels[item]}</span>
        </button>
      ))}
    </nav>
  );
  const serverSwitcher = (
    <button
      className="server-switcher"
      aria-label="Select paired server"
      onClick={search}
    >
      <span className="server-switcher-icon">
        <Icon name="server" />
      </span>
      <span>
        <small>SELECTED SERVER</small>
        <strong>{name}</strong>
      </span>
      <Icon name="chevron" />
    </button>
  );
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          const workspace = document.getElementById("main-content");
          workspace?.focus({ preventScroll: true });
          workspace?.scrollIntoView({ block: "start" });
        }}
      >
        Skip to workspace
      </a>
      <div className="application-body">
        <header className="masthead">
          <div className="masthead-inner">
            <button
              className="workspace-trigger"
              aria-label="Open navigation"
              onClick={() => setDrawer(true)}
            >
              <Icon name="menu" />
              <span>Workspace</span>
            </button>
            <button
              className="brand"
              aria-label="Open fleet"
              onClick={() => open("Fleet")}
            >
              <BrandMark />
              <span>
                Plexon<span className="brand-light">Panel</span>
              </span>
            </button>
            {serverSwitcher}
            <span className="transport-state">
              <StatusDot live={snap.phase === "live"} />
              {connectionPhaseLabel(snap.phase)}
            </span>
            <div className="context-actions">
              <time>
                {clock.format(now)}
                <small> {prefs.timezone === "UTC" ? "UTC" : "local"}</small>
              </time>
              <button
                className="command-trigger"
                aria-label="Find workspace or server"
                onClick={search}
              >
                <Icon name="search" />
                <span>Quick find</span>
                <kbd>⌘ K</kbd>
              </button>
              <button
                className="icon-button theme-trigger"
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
              <button
                className="operator-profile"
                onClick={() => open("Access")}
                aria-label="Browser authority"
              >
                <span className="operator-avatar">
                  {snap.state.ready?.device.name?.slice(0, 1).toUpperCase() ??
                    "P"}
                </span>
                <span>
                  {snap.state.ready?.device.name ?? "Browser device"}
                  <small>
                    {snap.state.ready?.device.role ?? "Awaiting grant"}
                  </small>
                </span>
              </button>
            </div>
          </div>
        </header>
        <div className="route-band">{nav()}</div>
        <main
          id="main-content"
          tabIndex={-1}
          className={`workspace workspace-${route.toLowerCase()}`}
        >
          {snap.fixture && (
            <div className="fixture-banner">
              <Icon name="access" />
              <strong>DEVELOPMENT PREVIEW</strong>
              <span>Synthetic telemetry · operational dispatch disabled</span>
            </div>
          )}
          <WorkspaceHeader
            title={routeLabels[route]}
            description={descriptions[route]}
          />
          <SourceRibbon state={snap.state} now={now} />
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
            <span>Connected to your worlds.</span>
          </footer>
        </main>
      </div>
      <Modal
        open={drawer}
        onClose={() => setDrawer(false)}
        label="Navigation"
        className="mobile-drawer"
      >
        <div className="drawer-head">
          <BrandMark />
          <strong>PlexonPanel</strong>
          <button
            className="icon-button"
            aria-label="Close navigation"
            onClick={() => setDrawer(false)}
          >
            <Icon name="close" />
          </button>
        </div>
        {serverSwitcher}
        {nav(true)}
        <p className="drawer-connection">
          {connectionPhaseLabel(snap.phase)} · Protocol 3
        </p>
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
                  setSelectError("");
                  void session
                    .select(row.serverId)
                    .then(() => open("Overview"))
                    .catch((cause) =>
                      setSelectError(
                        cause instanceof Error
                          ? cause.message
                          : "Server selection unavailable.",
                      ),
                    );
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
          {!routes.some((item) =>
            routeLabels[item].toLowerCase().includes(query.toLowerCase()),
          ) &&
            !fleet.some((row) =>
              String(row.state.ready?.server.serverName ?? row.serverId)
                .toLowerCase()
                .includes(query.toLowerCase()),
            ) && (
              <p className="palette-empty" role="status">
                No matching workspaces or paired servers.
              </p>
            )}
          {selectError && <p role="alert">{selectError}</p>}
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

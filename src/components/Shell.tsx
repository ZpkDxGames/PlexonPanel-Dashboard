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
const short: Record<RouteName, string> = {
  ...routeLabels,
  Console: "Console",
  Access: "Access",
};
const descriptions: Record<RouteName, string> = {
  Fleet: "Your server estate, with each source in its place.",
  Overview: "One clear view of your Minecraft operations.",
  Performance: "Follow the signal. Inspect the evidence.",
  Players: "The people bringing your worlds to life.",
  Console: "A direct line to your server, with control.",
  Backups: "Restore points you can account for.",
  Access: "Know who has access. Trace every operation.",
  Settings: "Make this workspace yours.",
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
  const [expanded, setExpanded] = useState(false),
    [drawer, setDrawer] = useState(false),
    [palette, setPalette] = useState(false),
    [query, setQuery] = useState("");
  const name = String(
    snap.state.ready?.server.serverName ??
      snap.labels[snap.state.serverId] ??
      (snap.state.serverId || "No server selected"),
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
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
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
      {routes.map((item, index) => (
        <button
          key={item}
          className={`nav-link ${route === item ? "active" : ""}`}
          aria-label={routeLabels[item]}
          aria-current={route === item ? "page" : undefined}
          onClick={() => open(item)}
        >
          <Icon name={icons[item]} />
          <span>{short[item]}</span>
          <small>{String(index + 1).padStart(2, "0")}</small>
        </button>
      ))}
    </nav>
  );
  const tz = prefs.timezone === "UTC" ? "UTC" : undefined;
  return (
    <div className={`app-shell ${expanded ? "expanded" : ""}`}>
      <a className="skip-link" href="#main-content">
        Skip to workspace
      </a>
      <aside className="sidebar" aria-label="Application navigation">
        <button
          className="brand"
          aria-label="Open fleet"
          onClick={() => open("Fleet")}
        >
          <BrandMark />
          <span>
            Plexon<strong>Panel</strong>
          </span>
        </button>
        {nav()}
        <div className="rail-footer">
          <button
            className="icon-button"
            aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
            onClick={() => setExpanded((value) => !value)}
          >
            <Icon name="menu" />
          </button>
          <span>CONTROL PLANE</span>
        </div>
      </aside>
      <div className="shell-body">
        <header className="context-bar">
          <div className="context-identity">
            <button
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              onClick={() => setDrawer(true)}
            >
              <Icon name="menu" />
            </button>
            <span className="context-product">PlexonPanel</span>
            <span className="breadcrumb-slash">/</span>
            <button className="server-context" onClick={() => open("Fleet")}>
              <span className="server-avatar">
                <Icon name="server" />
              </span>
              <strong>{name}</strong>
              <Icon name="chevron" />
            </button>
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
              <span>Jump to…</span>
              <kbd>Ctrl K</kbd>
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
        <div className="source-ribbon" role="region" aria-label="Source health">
          <span
            className={`ribbon-status ${snap.phase === "live" ? "success" : ""}`}
          >
            <i />
            {connectionPhaseLabel(snap.phase)}
          </span>
          <span className={`ribbon-source ${paper.kind}`}>
            <b>Paper</b> {paper.label}
          </span>
          <span className={`ribbon-source ${host.kind}`}>
            <b>Host</b> {host.label}
          </span>
          <time>
            {new Intl.DateTimeFormat(undefined, {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
              timeZone: tz,
            }).format(now)}{" "}
            <small>{tz ?? "local"}</small>
          </time>
        </div>
        <main id="main-content" className="workspace">
          {snap.fixture && (
            <div className="fixture-banner">
              Development fixture · synthetic data · live dispatch disabled
            </div>
          )}
          <div className="workspace-heading">
            <div>
              <span className="eyebrow">
                <span className="chapter-number">
                  {String(routes.indexOf(route) + 1).padStart(2, "0")}
                </span>{" "}
                /{" "}
                {["Fleet", "Overview", "Performance"].includes(route)
                  ? "Observe"
                  : route === "Settings" || route === "Access"
                    ? "Workspace"
                    : "Operate"}
              </span>
              <h1>{routeLabels[route]}</h1>
              <p>{descriptions[route]}</p>
            </div>
            <div className="workspace-meta">
              <span className="meta-label">ACTIVE INSTANCE</span>
              <strong>
                {snap.state.ready?.server.instanceKey ?? "Legacy identity"}
              </strong>
              <span>
                Minecraft{" "}
                {snap.state.ready?.server.minecraftVersion ?? "unavailable"}
              </span>
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
              PlexonPanel <b>/</b> Control plane
            </span>
            <span>Source-backed operations · Protocol 3</span>
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
            placeholder="Search workspaces and paired servers…"
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

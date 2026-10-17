"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Layers3,
  Search,
  Sun,
  Moon,
  Menu,
  ChevronDown,
  Check,
  ArrowUpRight,
  Activity,
} from "lucide-react";
import { Select, Tooltip } from "radix-ui";
import { Command } from "cmdk";
import { useSession, useNow } from "../../hooks";
import { session, connectionPhaseLabel } from "../../adapter/session";
import { routeLabels, routes, registerNavigator } from "../../router";
import { PlotHistoryProvider } from "../../presentation/PlotHistory";
import { SourceRibbon } from "../nextgen/SourceRibbon";
import { PairingGate } from "../PairingGate";
import { Splash } from "../Splash";
import { preferences, usePreferences } from "../../store/preferences";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
export function Workbench({ children }: { children: ReactNode }) {
  const snap = useSession(),
    now = useNow(),
    prefs = usePreferences(),
    pathname = usePathname(),
    router = useRouter();
  const [menu, setMenu] = useState(false),
    [search, setSearch] = useState(false),
    [error, setError] = useState("");
  useEffect(
    () => registerNavigator((route) => router.push("/" + route.toLowerCase())),
    [router],
  );
  const current =
    routes.find((r) => pathname === `/${r.toLowerCase()}`) ?? "Overview";
  useEffect(() => {
    let g = 0;
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((v) => !v);
        return;
      }
      if (
        e.target instanceof HTMLElement &&
        (e.target.matches("input,textarea,select") ||
          e.target.isContentEditable)
      )
        return;
      if (e.key.toLowerCase() === "g") g = Date.now();
      else if (Date.now() - g < 1000 && /^[1-8]$/.test(e.key)) {
        router.push("/" + routes[Number(e.key) - 1].toLowerCase());
        g = 0;
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [router]);
  useEffect(() => {
    if (snap.phase !== "live" || snap.fixture) return;
    void session.hydrateEpoch();
    const timer = setInterval(() => {
      if (!document.hidden) void session.hydrateEpoch();
    }, 10000);
    return () => clearInterval(timer);
  }, [snap.phase, snap.revision, snap.state.bootEpochId, snap.fixture]);
  if (!snap.initialized) return <Splash />;
  if (!snap.fixture && !snap.credentials.length) return <PairingGate />;
  const name = String(
      snap.state.ready?.server.serverName ??
        snap.labels[snap.state.serverId] ??
        snap.state.serverId,
    ),
    start = Date.parse(snap.state.bootStartedAt ?? "");
  const age = ["inactive", "failed"].includes(String(snap.state.service.state))
    ? "Service stopped"
    : Number.isFinite(start)
      ? `${Math.max(0, Math.floor((now - start) / 3600000))}h ${Math.max(0, Math.floor(((now - start) % 3600000) / 60000))}m`
      : "Awaiting boot";
  const nav = (mobile = false) => (
    <nav
      aria-label={mobile ? "Mobile workspaces" : "Workspaces"}
      className={mobile ? "mobile-route-list" : "v5-route-band"}
    >
      {routes.map((route, i) => (
        <Link
          key={route}
          href={"/" + route.toLowerCase()}
          aria-current={current === route ? "page" : undefined}
          className={current === route ? "active" : ""}
          onClick={() => setMenu(false)}
        >
          <span className="mono">0{i + 1}</span>
          {routeLabels[route]}
        </Link>
      ))}
    </nav>
  );
  return (
    <PlotHistoryProvider state={snap.state} revision={snap.revision}>
      <Tooltip.Provider>
        <a
          className="skip-link"
          href="#workspace"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById("workspace")?.focus();
          }}
        >
          Skip to workspace
        </a>
        {process.env.NODE_ENV !== "production" && snap.fixture ? (
          <div className="fixture-banner">
            DEVELOPMENT FIXTURE · {snap.fixture} · Simulated evidence ·
            Operations are simulated
          </div>
        ) : null}
        <header className="v5-header">
          <div className="v5-global-bar">
            <Link href="/fleet" className="v5-brand">
              <Layers3 size={25} />
              <strong>
                plexon<span>panel</span>
              </strong>
              <small>5.0</small>
            </Link>
            <Select.Root
              value={snap.state.serverId}
              onValueChange={(id) => {
                setError("");
                void session
                  .select(id)
                  .catch((e) => setError(String(e.message)));
              }}
            >
              <Select.Trigger
                className="v5-server-select"
                aria-label="Select paired server"
              >
                <Layers3 size={17} />
                <Select.Value>{name}</Select.Value>
                <Select.Icon>
                  <ChevronDown size={16} />
                </Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content position="popper" className="v5-select-content">
                  <Select.Viewport>
                    {(snap.credentials.length
                      ? snap.credentials
                      : [{ serverId: snap.state.serverId }]
                    ).map((c) => (
                      <Select.Item
                        key={c.serverId}
                        value={c.serverId}
                        className="v5-select-item"
                      >
                        <Select.ItemText>
                          {c.serverId === snap.state.serverId
                            ? name
                            : (snap.labels[c.serverId] ?? c.serverId)}
                        </Select.ItemText>
                        <Select.ItemIndicator>
                          <Check size={15} />
                        </Select.ItemIndicator>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
            <div className="v5-connections">
              <span data-live={snap.phase === "live"}>
                {connectionPhaseLabel(snap.phase)}
              </span>
              <span data-live={snap.state.ready?.agents.paper}>Paper</span>
              <span data-live={snap.state.ready?.agents.host}>Host</span>
            </div>
            <div className="v5-header-actions">
              <span className="v5-age mono">
                <Activity size={15} />
                {age}
              </span>
              <Button
                variant="ghost"
                aria-label="Find workspace or server"
                onClick={() => setSearch(true)}
              >
                <Search size={18} />
                <kbd>⌘K</kbd>
              </Button>
              <Button
                variant="ghost"
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
                {prefs.theme === "light" ? (
                  <Moon size={18} />
                ) : (
                  <Sun size={18} />
                )}
              </Button>
              <Button
                variant="ghost"
                className="v5-menu"
                aria-label="Open navigation"
                onClick={() => setMenu(true)}
              >
                <Menu size={20} />
              </Button>
            </div>
          </div>
          {nav()}
        </header>
        <main
          id="workspace"
          tabIndex={-1}
          className={`workspace workspace-${current.toLowerCase()} v5-workspace`}
        >
          <div className="v5-heading">
            <div>
              <span className="eyebrow">
                WORKSPACE / {routeLabels[current].toUpperCase()}
              </span>
              <h1>{routeLabels[current]}</h1>
              <p>Follow the signal to its source.</p>
            </div>
            <span className="mono">
              {snap.state.ready?.device.role ?? "Awaiting grant"} · Protocol 3
            </span>
          </div>
          <SourceRibbon state={snap.state} now={now} />
          {error || snap.error ? (
            <p role="alert">{error || snap.error}</p>
          ) : null}
          <div
            className="route-stage"
            key={`${snap.state.serverId}:${snap.revision}:${current}`}
          >
            {children}
          </div>
          <footer className="v5-footer mono">
            <span>{snap.state.serverId}</span>
            <Link href="/access">
              SCOPED AUTHORITY <ArrowUpRight size={14} />
            </Link>
          </footer>
        </main>
        <Dialog open={menu} onOpenChange={setMenu}>
          <DialogContent className="v5-drawer">
            <DialogTitle>Workspaces</DialogTitle>
            <DialogDescription>Choose an operational view.</DialogDescription>
            {nav(true)}
            <Button variant="outline" onClick={() => setMenu(false)}>
              Close navigation
            </Button>
          </DialogContent>
        </Dialog>
        <Dialog open={search} onOpenChange={setSearch}>
          <DialogContent>
            <DialogTitle>Quick find</DialogTitle>
            <DialogDescription>
              Choose a workspace or paired server.
            </DialogDescription>
            <Command label="Find a workspace">
              <Command.Input placeholder="Search workspaces…" />
              <Command.List>
                <Command.Empty>No matching workspace.</Command.Empty>
                <Command.Group heading="Workspaces">
                  {routes.map((route) => (
                    <Command.Item
                      key={route}
                      onSelect={() => {
                        router.push("/" + route.toLowerCase());
                        setSearch(false);
                      }}
                    >
                      {routeLabels[route]}
                    </Command.Item>
                  ))}
                </Command.Group>
                <Command.Group heading="Servers">
                  {snap.credentials.map((c) => (
                    <Command.Item
                      key={c.serverId}
                      onSelect={() => {
                        setSearch(false);
                        void session
                          .select(c.serverId)
                          .catch((e) => setError(e.message));
                      }}
                    >
                      {snap.labels[c.serverId] ?? c.serverId}
                    </Command.Item>
                  ))}
                </Command.Group>
              </Command.List>
            </Command>
          </DialogContent>
        </Dialog>
      </Tooltip.Provider>
    </PlotHistoryProvider>
  );
}

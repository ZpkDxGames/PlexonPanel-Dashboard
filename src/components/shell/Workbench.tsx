"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Box,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  HardDrive,
  LayoutDashboard,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  Sun,
  TerminalSquare,
  Users,
  X,
} from "lucide-react";
import { Command } from "cmdk";
import { useSession, useNow, useShellSession } from "../../hooks";
import { session, connectionPhaseLabel } from "../../adapter/session";
import {
  routeLabels,
  routes,
  registerNavigator,
  type RouteName,
} from "../../router";
import { SessionPlotHistoryProvider } from "../../presentation/PlotHistory";
import { preferences, usePreferences } from "../../store/preferences";
import { sourceEvidence } from "../../presentation/telemetry";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { entryExperience } from "../../entry-state";
import { PairingGate } from "../PairingGate";
import { Splash } from "../Splash";
import { cn } from "../../lib/utils";
const icons = {
  Fleet: Server,
  Overview: LayoutDashboard,
  Performance: Activity,
  Players: Users,
  Console: TerminalSquare,
  Backups: HardDrive,
  Access: ShieldCheck,
  Settings: Settings2,
};
const groups: { label: string; items: RouteName[] }[] = [
  { label: "Monitoring", items: ["Fleet", "Overview", "Performance"] },
  { label: "Management", items: ["Players", "Console", "Backups"] },
  { label: "System", items: ["Access", "Settings"] },
];
export function SourceStatus() {
  const { state, phase } = useSession(),
    now = useNow();
  const [open, setOpen] = useState(false);
  const sources = [
    ["paperHealth", "Paper runtime"],
    ["paperSystem", "Paper JVM"],
    ["service", "Minecraft service"],
    ["hostSystem", "Host node"],
  ] as const;
  const allLive = sources.every(
    ([key]) => sourceEvidence(state, key, now).kind === "live",
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Inspect source status"
          className="flex h-9 items-center gap-2 rounded-lg px-2 text-[11px] text-muted-foreground hover:bg-muted"
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              allLive ? "bg-primary" : "bg-amber-400",
            )}
          />
          <span className="hidden sm:inline">
            {phase === "live"
              ? allLive
                ? "All sources live"
                : "Source status"
              : connectionPhaseLabel(phase)}
          </span>
          <ChevronDown size={12} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end">
        <div className="mb-3 flex items-center justify-between">
          <strong>Source health</strong>
          <Badge dot tone={phase === "live" ? "success" : "warning"}>
            {phase}
          </Badge>
        </div>
        <div className="space-y-3">
          {sources.map(([key, label]) => {
            const e = sourceEvidence(state, key, now);
            return (
              <div key={key} className="border-t pt-3">
                <div className="mb-1 flex items-center justify-between">
                  <span>{label}</span>
                  <Badge tone={e.kind === "live" ? "success" : "warning"}>
                    {e.kind}
                  </Badge>
                </div>
                <p className="font-mono text-[9px] leading-5 text-muted-foreground">
                  Capture {e.capturedAt ?? "not received"}
                  <br />
                  Receipt{" "}
                  {e.receivedAt
                    ? new Date(e.receivedAt).toISOString()
                    : "not received"}
                  <br />
                  Cadence{" "}
                  {e.cadence === null ? "not reported" : `${e.cadence} ms`}
                </p>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
export function Workbench({ children }: { children: ReactNode }) {
  const snap = useShellSession(),
    prefs = usePreferences(),
    pathname = usePathname(),
    router = useRouter();
  const [minimumSplashElapsed, setMinimumSplashElapsed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMinimumSplashElapsed(true), 2800);
    return () => clearTimeout(timer);
  }, []);
  const [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false),
    [search, setSearch] = useState(false),
    [error, setError] = useState("");
  const current =
    routes.find((r) => pathname === `/${r.toLowerCase()}`) ?? "Overview";
  useEffect(
    () => registerNavigator((route) => router.push("/" + route.toLowerCase())),
    [router],
  );
  useEffect(() => {
    let g = 0;
    const handler = (e: KeyboardEvent) => {
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
    addEventListener("keydown", handler);
    return () => removeEventListener("keydown", handler);
  }, [router]);
  useEffect(() => {
    if (snap.phase !== "live" || snap.fixture) return;
    void session.hydrateEpoch();
    const timer = setInterval(() => {
      if (!document.hidden) void session.hydrateEpoch();
    }, 10000);
    return () => clearInterval(timer);
  }, [snap.phase, snap.revision, snap.state.bootEpochId, snap.fixture]);
  const entry = entryExperience(snap, minimumSplashElapsed);
  if (entry === "splash") return <Splash />;
  if (entry === "pairing") return <PairingGate />;
  const name = String(
    snap.state.ready?.server.serverName ??
      snap.labels[snap.state.serverId] ??
      snap.state.serverId,
  );
  const select = (id: string) => {
    setError("");
    void session.select(id).catch((e) => setError(e.message));
  };
  const sidebar = (mini = false) => (
    <div className="flex h-full flex-col">
      <Link
        href="/overview"
        aria-label="PlexonPanel home"
        className={cn(
          "flex h-20 shrink-0 items-center gap-2.5 px-5",
          mini && "justify-center px-0",
        )}
      >
        <span className="rounded-xl border border-primary/25 bg-primary/10 p-2 text-primary">
          <Box size={23} strokeWidth={1.5} />
        </span>
        {!mini && (
          <div>
            <span className="text-[17px] font-bold tracking-tight">
              plexon<span className="text-primary">panel</span>
            </span>
            <span className="ml-1.5 rounded border px-1 py-0.5 font-mono text-[8px] text-muted-foreground">
              5.0
            </span>
          </div>
        )}
      </Link>
      <div className={cn("px-4", mini && "px-2")}>
        <Popover>
          <PopoverTrigger asChild>
            <button
              aria-label="Select paired server"
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border bg-muted/30 p-3 text-left hover:bg-muted",
                mini && "justify-center px-0",
              )}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Server size={16} />
              </span>
              {!mini && (
                <>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-xs font-semibold">
                      {name}
                    </strong>
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      Server workspace
                    </span>
                  </span>
                  <ChevronsUpDown size={13} className="text-muted-foreground" />
                </>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            side={mini ? "right" : "bottom"}
            className="w-64"
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Paired servers
            </p>
            {(snap.credentials.length
              ? snap.credentials
              : [{ serverId: snap.state.serverId }]
            ).map((c) => (
              <button
                key={c.serverId}
                onClick={() => select(c.serverId)}
                className="flex w-full items-center gap-2 rounded-lg p-3 text-left hover:bg-muted"
              >
                <Server size={15} />
                <span className="min-w-0 flex-1 truncate">
                  {c.serverId === snap.state.serverId
                    ? name
                    : (snap.labels[c.serverId] ?? c.serverId)}
                </span>
                {c.serverId === snap.state.serverId && (
                  <span className="size-1.5 rounded-full bg-primary" />
                )}
              </button>
            ))}
            <Link
              href="/settings"
              className="mt-2 block border-t p-3 text-primary"
            >
              Connect another server
            </Link>
          </PopoverContent>
        </Popover>
      </div>
      <nav
        aria-label="Workspaces"
        className={cn(
          "flex-1 space-y-6 overflow-y-auto px-3 pt-8",
          mini && "px-2",
        )}
      >
        {groups.map((group) => (
          <div key={group.label}>
            {!mini && (
              <p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {group.label}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((route) => {
                const Icon = icons[route];
                return (
                  <Link
                    key={route}
                    href={"/" + route.toLowerCase()}
                    title={mini ? routeLabels[route] : undefined}
                    aria-label={routeLabels[route]}
                    aria-current={current === route ? "page" : undefined}
                    onClick={() => setMobile(false)}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                      current === route &&
                        "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
                      mini && "justify-center px-0",
                    )}
                  >
                    <Icon size={17} strokeWidth={1.7} />
                    {!mini && (
                      <>
                        <span className="flex-1">{routeLabels[route]}</span>
                        {current === route && (
                          <span className="size-1 rounded-full bg-primary" />
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className={cn("space-y-3 p-4", mini && "px-2")}>
        {!mini && (
          <div className="rounded-xl border bg-background p-3">
            <div className="mb-1 flex items-center gap-2 text-[11px]">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  snap.phase === "live" ? "bg-primary" : "bg-amber-400",
                )}
              />
              {connectionPhaseLabel(snap.phase)}
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Signed Protocol 3 connection
              <br />
              {snap.state.ready?.device.role ?? "Awaiting grant"} access
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed((v) => !v)}
          className="hidden lg:inline-flex"
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
        {!mini && (
          <p className="px-1 text-[9px] text-muted-foreground">
            PlexonPanel · Minecraft operations
          </p>
        )}
      </div>
    </div>
  );
  return (
    <SessionPlotHistoryProvider>
      <a
        href="#workspace"
        className="fixed left-4 top-2 z-[70] -translate-y-20 rounded-lg bg-primary px-4 py-3 text-sm text-primary-foreground focus:translate-y-0"
      >
        Skip to workspace
      </a>
      <aside
        aria-label="Sidebar"
        data-collapsed={collapsed}
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r bg-card lg:block",
          collapsed ? "w-[72px]" : "w-[240px]",
        )}
      >
        {sidebar(collapsed)}
      </aside>
      <div
        className={cn(
          "min-h-dvh min-w-0",
          collapsed ? "lg:pl-[72px]" : "lg:pl-[240px]",
        )}
      >
        {process.env.NODE_ENV !== "production" && snap.fixture && (
          <div
            className="border-b border-amber-500/25 bg-amber-500/10 px-5 py-1 font-mono text-[9px] text-amber-800 dark:text-amber-300"
            data-testid="fixture-banner"
          >
            DEVELOPMENT FIXTURE · {snap.fixture} · Simulated evidence ·
            Operations are simulated
          </div>
        )}
        <header className="flex h-16 items-center justify-between gap-2 border-b bg-card/70 px-4 md:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </Button>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Workspace
            </span>
            <ChevronRight
              size={12}
              className="hidden text-muted-foreground sm:block"
            />
            <span className="truncate text-xs font-medium">
              {routeLabels[current]}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <SourceStatus />
            <span className="mx-2 hidden h-4 border-l sm:block" />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Find workspace or server"
              onClick={() => setSearch(true)}
            >
              <Search />
            </Button>
            <kbd className="mr-2 hidden rounded border bg-background px-1.5 py-1 font-mono text-[9px] text-muted-foreground md:block">
              ⌘ K
            </kbd>
            <Button
              variant="ghost"
              size="icon"
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
              {prefs.theme === "light" ? <Moon /> : <Sun />}
            </Button>
          </div>
        </header>
        <main
          id="workspace"
          tabIndex={-1}
          className="mx-auto max-w-[1840px] space-y-5 p-4 outline-none md:p-[var(--space,1.5rem)]"
        >
          {error || snap.error ? (
            <p
              role="alert"
              className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400"
            >
              {error || snap.error}
            </p>
          ) : null}
          <div key={`${snap.state.serverId}:${snap.revision}:${current}`}>
            {children}
          </div>
        </main>
      </div>
      <Dialog open={mobile} onOpenChange={setMobile}>
        <DialogContent
          className="inset-y-0 left-0 top-0 h-dvh max-h-dvh w-[280px] max-w-[85vw] translate-x-0 translate-y-0 rounded-none border-y-0 border-l-0 p-0"
          hideClose
        >
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <DialogDescription className="sr-only">
            Choose a server workspace
          </DialogDescription>
          {sidebar()}
          <button
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
            className="absolute right-2 top-2 rounded p-2 text-muted-foreground"
          >
            <X size={16} />
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={search} onOpenChange={setSearch}>
        <DialogContent>
          <DialogTitle>Quick find</DialogTitle>
          <DialogDescription>
            Jump to a workspace or paired server.
          </DialogDescription>
          <Command label="Find a workspace" className="mt-5">
            <div className="flex items-center gap-2 border-b pb-3">
              <Search size={17} className="text-muted-foreground" />
              <Command.Input
                className="w-full bg-transparent text-sm outline-none"
                placeholder="Search workspaces and servers…"
              />
            </div>
            <Command.List className="max-h-80 overflow-y-auto py-2">
              <Command.Empty className="p-5 text-xs text-muted-foreground">
                No results.
              </Command.Empty>
              <Command.Group
                heading="Workspaces"
                className="text-xs [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {routes.map((route) => {
                  const Icon = icons[route];
                  return (
                    <Command.Item
                      key={route}
                      onSelect={() => {
                        router.push("/" + route.toLowerCase());
                        setSearch(false);
                      }}
                      className="flex cursor-pointer items-center gap-3 rounded-lg p-3 data-[selected=true]:bg-muted"
                    >
                      <Icon size={16} />
                      {routeLabels[route]}
                    </Command.Item>
                  );
                })}
              </Command.Group>
              <Command.Group
                heading="Servers"
                className="text-xs [&_[cmdk-group-heading]]:p-3 [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {snap.credentials.map((c) => (
                  <Command.Item
                    key={c.serverId}
                    onSelect={() => {
                      select(c.serverId);
                      setSearch(false);
                    }}
                    className="cursor-pointer rounded-lg p-3 data-[selected=true]:bg-muted"
                  >
                    {snap.labels[c.serverId] ?? c.serverId}
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>
    </SessionPlotHistoryProvider>
  );
}

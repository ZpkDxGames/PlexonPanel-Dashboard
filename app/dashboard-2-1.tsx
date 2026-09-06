"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  bindLiveSocket,
  DashboardRequestError,
  handleRelayControlMessage,
  logoutDashboard,
  pairDashboardServer,
  requestLiveConnection,
  sendDashboardAction,
  type ActionCompletion,
} from "../lib/data-source";
import {
  clearBrowserWorkspace,
  listRelayCredentials,
  loadControlCache,
  loadRelayCredential,
  saveControlCache,
  selectRelayCredential,
  type RelayCredential,
} from "../lib/browser-store";
import {
  applyControlMessage,
  diagnostics,
  emptyControlState,
  record,
  str,
  type ControlState,
  type JsonMap,
} from "../lib/control-state";
import { canAction, HIGH_RISK } from "../lib/scopes";
import {
  lifecycleActionAllowed,
  normalizeServiceState,
} from "../lib/lifecycle-state";
import { operationText } from "../lib/operation-messages";
import { Badge, Empty, type ViewProps } from "./control-views";
import {
  ChatView21,
  ConsoleView21,
  PlayersView21,
  PluginsView21,
} from "./management-views-2-1";
import { AccessView21, AuditView21 } from "./infrastructure-views-2-1";
import { OverviewView21, PerformanceView21 } from "./monitoring-views-2-1";
import { ServerView21 } from "./server-view-2-1";

const FilesView = dynamic(
  () => import("./advanced-views").then((module) => module.FilesView),
  { loading: () => <Empty title="Opening files…" /> },
);
const BackupsView = dynamic(() =>
  import("./advanced-views").then((module) => module.BackupsView),
);
const SettingsView = dynamic(() =>
  import("./settings-view-2-1").then((module) => module.SettingsView21),
);

const sections = [
  "Overview",
  "Performance",
  "Players",
  "Console",
  "Chat",
  "Plugins",
  "Files",
  "Backups",
  "Server",
  "Audit",
  "Access",
  "Settings",
] as const;
type Section = (typeof sections)[number];
type Phase = "loading" | "unpaired" | "connecting" | "live" | "reconnecting";
type Confirmation = {
  action: string;
  parameters: JsonMap;
  resolve: (approved: boolean) => void;
};
type IconName =
  | "overview"
  | "performance"
  | "players"
  | "console"
  | "chat"
  | "plugins"
  | "files"
  | "backups"
  | "server"
  | "audit"
  | "access"
  | "settings"
  | "refresh"
  | "bolt"
  | "search"
  | "chevron"
  | "menu"
  | "panel";

const navGroups: { label: string; sections: Section[] }[] = [
  { label: "MONITOR", sections: ["Overview", "Performance", "Players"] },
  { label: "COMMUNICATION", sections: ["Console", "Chat"] },
  { label: "MANAGE", sections: ["Plugins", "Files", "Backups"] },
  { label: "SYSTEM", sections: ["Server", "Audit", "Access", "Settings"] },
];
const iconBySection: Record<Section, IconName> = {
  Overview: "overview",
  Performance: "performance",
  Players: "players",
  Console: "console",
  Chat: "chat",
  Plugins: "plugins",
  Files: "files",
  Backups: "backups",
  Server: "server",
  Audit: "audit",
  Access: "access",
  Settings: "settings",
};
const iconPaths: Record<IconName, string> = {
  overview: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  performance: "M3 18l5-6 4 3 8-10M16 5h4v4",
  players:
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 9c.5-4 2.5-6 6-6s5.5 2 6 6M16 7a3 3 0 0 1 0 6M16 15c3 0 4.5 1.5 5 5",
  console: "M4 5h16v14H4zM8 9l3 3-3 3M13 15h4",
  chat: "M4 5h16v11H9l-5 4z",
  plugins: "M8 3v5H3v8h5v5h8v-5h5V8h-5V3z",
  files: "M3 7h7l2 2h9v10H3zM3 7V5h7l2 2",
  backups: "M5 8a8 8 0 1 1-1 8M5 3v5H0M12 7v5l3 2",
  server:
    "M3 4h18v6H3zM3 14h18v6H3zM7 7h.01M7 17h.01M11 7h6M11 17h6",
  audit: "M6 3h12v18H6zM9 8h6M9 12h6M9 16h4",
  access: "M12 3l8 4v5c0 5-3 8-8 9-5-1-8-4-8-9V7zM9 12l2 2 4-4",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4",
  refresh:
    "M20 6v5h-5M4 18v-5h5M6 9a7 7 0 0 1 12-2l2 4M4 13l2 4a7 7 0 0 0 12-2",
  bolt: "M13 2 5 13h6l-1 9 9-12h-6z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 5 5",
  chevron: "m8 10 4 4 4-4",
  menu: "M4 7h16M4 12h16M4 17h16",
  panel: "M4 4h16v16H4zM8 8h8v8H8z",
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`cr21-brand ${compact ? "compact" : ""}`}>
      <span className="cr21-brand-mark">
        <Icon name="panel" size={19} />
      </span>
      {!compact && (
        <div>
          <strong>
            Plexon<span>Panel</span>
          </strong>
          <small>Control Room · 2.1</small>
        </div>
      )}
    </div>
  );
}

function Pairing({
  done,
  cancel,
  error: initialError,
}: {
  done: () => Promise<void>;
  cancel?: () => void;
  error?: string;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("My browser");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  return (
    <main className="cr-pair-screen cr21-pair-screen">
      <section className="cr-pair-copy">
        <Brand />
        <div>
          <span className="cr-eyebrow">Plexon server control room</span>
          <h1>
            Your server.
            <br />
            Within reach.
          </h1>
          <p>
            Monitor Paper, manage players, and operate your server through
            locally controlled access.
          </p>
        </div>
        <div className="cr-pair-steps">
          <span>
            <b>01</b> Run <code>/plexonpanel pair</code> locally.
          </span>
          <span>
            <b>02</b> Enter the one-use code before its five-minute expiry.
          </span>
          <span>
            <b>03</b> Open the control room with the role granted locally.
          </span>
        </div>
        <small>
          Monitoring only by default. Your server keeps control of every
          capability.
        </small>
      </section>
      <section className="cr-pair-form">
        <div>
          <Badge tone="cyan">Secure device pairing</Badge>
          <h2>Pair this browser</h2>
          <p>
            The local operator chooses your role. Pairing defaults to Observer
            when no role is supplied.
          </p>
          <form
            className="cr-form"
            onSubmit={(event) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              void pairDashboardServer(code, name)
                .then(() => done())
                .catch((reason) => {
                  setError(
                    reason instanceof Error ? reason.message : "Pairing failed",
                  );
                  setBusy(false);
                });
            }}
          >
            <label>
              Device name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={64}
                required
                autoComplete="off"
              />
            </label>
            <label>
              Six-digit pairing code
              <input
                className="cr-code"
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                required
              />
            </label>
            {error && (
              <p className="cr-alert" role="alert">
                {error}
              </p>
            )}
            <button
              className="cr-button primary"
              disabled={busy || !/^\d{6}$/.test(code)}
            >
              {busy ? "Waiting for local approval…" : "Open control room"}
            </button>
            {cancel && (
              <button type="button" className="cr-button" onClick={cancel}>
                Back to server
              </button>
            )}
          </form>
          <p className="cr-hint">
            Server identity is signed. Telemetry and file contents are not stored
            by the relay.
          </p>
        </div>
      </section>
    </main>
  );
}

function Confirm({ value }: { value: Confirmation }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);
  const target =
    value.parameters.path ??
    value.parameters.playerId ??
    value.parameters.deviceId ??
    value.parameters.backupId;
  return (
    <dialog
      className="cr-confirm cr21-dialog"
      ref={ref}
      aria-labelledby="confirm-title"
      onCancel={(event) => {
        event.preventDefault();
        value.resolve(false);
      }}
    >
      <Badge tone="amber">Confirm operation</Badge>
      <h2 id="confirm-title">{value.action.replaceAll(".", " ")}</h2>
      <p>
        This operation will run on your server using this device&apos;s local
        permissions.
      </p>
      {target !== undefined && (
        <code className="cr-confirm-target">{String(target)}</code>
      )}
      {value.action === "console.execute" && (
        <pre className="cr-output">{str(value.parameters.command)}</pre>
      )}
      <div className="cr-actions">
        <button className="cr-button" onClick={() => value.resolve(false)}>
          Cancel
        </button>
        <button className="cr-button danger" onClick={() => value.resolve(true)}>
          Confirm operation
        </button>
      </div>
    </dialog>
  );
}

function Freshness({ phase, updatedAt }: { phase: Phase; updatedAt: number }) {
  const [now, setNow] = useState(updatedAt);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (phase !== "live")
    return <span className="cr21-freshness stale">Disconnected</span>;
  if (!updatedAt)
    return <span className="cr21-freshness waiting">Waiting for sample</span>;
  const seconds = Math.max(
    0,
    Math.floor((Math.max(now, updatedAt) - updatedAt) / 1000),
  );
  if (seconds <= 15)
    return (
      <span className="cr21-freshness live">Live · updated {seconds}s ago</span>
    );
  if (seconds <= 30)
    return <span className="cr21-freshness">Updated {seconds}s ago</span>;
  if (seconds <= 60)
    return <span className="cr21-freshness stale">Stale · {seconds}s</span>;
  return (
    <span className="cr21-freshness stale">Connection/data unavailable</span>
  );
}

function CommandPalette({
  open,
  close,
  navigate,
  run,
  can,
  restartAvailable,
  refresh,
  copyDiagnostics,
}: {
  open: boolean;
  close: () => void;
  navigate: (section: Section) => void;
  run: ViewProps["run"];
  can: ViewProps["can"];
  restartAvailable: boolean;
  refresh: () => void;
  copyDiagnostics: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    else if (!open && dialog?.open) dialog.close();
  }, [open]);
  const finish = () => {
    setQuery("");
    close();
  };
  const actions: { label: string; action: () => void; visible?: boolean }[] = [
    ...sections.map((section) => ({
      label: `Go to ${section}`,
      action: () => navigate(section),
    })),
    { label: "Refresh current page", action: refresh },
    {
      label: "Create backup",
      visible: can("backup.create", "HOST"),
      action: () => void run("backup.create", {}, "HOST"),
    },
    {
      label: "Restart server",
      visible: restartAvailable,
      action: () => void run("server.restart", {}, "HOST"),
    },
    { label: "Copy diagnostics", action: copyDiagnostics },
  ];
  const visible = actions.filter(
    (item) =>
      item.visible !== false &&
      item.label.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <dialog
      className="cr21-command"
      ref={ref}
      aria-label="Command palette"
      onCancel={(event) => {
        event.preventDefault();
        finish();
      }}
    >
      <div className="cr21-command-search">
        <Icon name="search" />
        <input
          autoFocus
          aria-label="Search commands and pages"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search pages and allowed actions"
        />
        <kbd>Esc</kbd>
      </div>
      <div className="cr21-command-list">
        {visible.map((item) => (
          <button
            key={item.label}
            onClick={() => {
              item.action();
              finish();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </dialog>
  );
}

export default function Dashboard21() {
  const [credential, setCredential] = useState<RelayCredential | null>(null);
  const [credentials, setCredentials] = useState<RelayCredential[]>([]);
  const [state, setState] = useState<ControlState>(() => emptyControlState(""));
  const [phase, setPhase] = useState<Phase>("loading");
  const [section, setSection] = useState<Section>("Overview");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pairing, setPairing] = useState(false);
  const [reconnect, setReconnect] = useState(0);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const unsaved = useRef(false);

  const setUnsaved = useCallback((dirty: boolean) => {
    unsaved.current = dirty;
  }, []);
  const leaveEditor = () =>
    !unsaved.current || window.confirm("Discard unsaved file edits?");
  const navigate = (next: Section) => {
    if (next !== section && !leaveEditor()) return;
    setSection(next);
    localStorage.setItem("plexonpanel-last-section", next);
    setSidebarOpen(false);
  };

  const restore = useCallback(async () => {
    try {
      const selected = await loadRelayCredential();
      setCredentials(await listRelayCredentials());
      setCredential(selected);
      setState(
        selected
          ? ((await loadControlCache(selected.serverId)) ??
              emptyControlState(selected.serverId))
          : emptyControlState(""),
      );
      const storedSection = localStorage.getItem("plexonpanel-last-section");
      if (storedSection && sections.includes(storedSection as Section))
        setSection(storedSection as Section);
      setSidebarCollapsed(
        localStorage.getItem("plexonpanel-sidebar-collapsed") === "true",
      );
      setPairing(false);
      setPhase(selected ? "connecting" : "unpaired");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Browser storage is unavailable",
      );
      setPhase("unpaired");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void restore(), 0);
    return () => window.clearTimeout(timer);
  }, [restore]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 6500);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!credential || !state.updatedAt) return;
    const timer = window.setTimeout(() => {
      void saveControlCache(state).catch(() => {});
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [state, credential]);
  useEffect(() => {
    document.documentElement.dataset.plexonDensity =
      localStorage.getItem("plexonpanel-density") ?? "comfortable";
  }, []);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [section, credential?.serverId]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    if (!sidebarOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sidebarOpen]);

  useEffect(() => {
    if (!credential) return;
    let stopped = false;
    let attempt = 0;
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    const schedule = () => {
      if (stopped) return;
      attempt += 1;
      setPhase("reconnecting");
      retry = setTimeout(
        () => void connect(),
        Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5)) *
          (0.8 + Math.random() * 0.4),
      );
    };
    const connect = async () => {
      if (stopped) return;
      setPhase(attempt ? "reconnecting" : "connecting");
      try {
        const grant = await requestLiveConnection();
        if (stopped || grant.serverId !== credential.serverId) return;
        socket = new WebSocket(grant.websocketUrl, [
          "plexonpanel-v3",
          `auth.${grant.token}`,
        ]);
        socket.onopen = () => {
          if (stopped) {
            socket?.close();
            return;
          }
          bindLiveSocket(socket);
          attempt = 0;
          setState((current) => ({ ...current, ready: null }));
          setError("");
          heartbeat = setInterval(() => {
            if (socket?.readyState === WebSocket.OPEN)
              socket.send(JSON.stringify({ type: "dashboard.ping" }));
          }, 20_000);
        };
        socket.onmessage = (event) => {
          if (
            stopped ||
            typeof event.data !== "string" ||
            event.data.length > 131_072
          )
            return;
          try {
            const message = record(JSON.parse(event.data));
            if (message.serverId && message.serverId !== credential.serverId)
              return;
            if (
              message.type === "dashboard.ready" &&
              message.protocolVersion !== 3
            ) {
              setError(
                "Protocol mismatch. PlexonPanel Dashboard 2.1 requires protocol 3 agents and relay.",
              );
              socket?.close(4008, "Protocol mismatch");
              return;
            }
            if (
              message.type === "dashboard.ready" &&
              message.protocolVersion === 3
            )
              setPhase("live");
            if (handleRelayControlMessage(message)) return;
            if (message.type === "relay.error") {
              setError(str(message.error, "Relay rejected a message"));
              return;
            }
            setState((current) => applyControlMessage(current, message));
          } catch {
            setError("The relay sent an invalid message.");
          }
        };
        socket.onclose = (event) => {
          if (heartbeat) clearInterval(heartbeat);
          if (stopped) return;
          bindLiveSocket(null);
          if (event.code === 4003) {
            setError(
              "This device was revoked or expired. Generate a new local pairing code.",
            );
            void clearBrowserWorkspace().then(() => {
              setCredential(null);
              setState(emptyControlState(""));
              setPhase("unpaired");
            });
            return;
          }
          schedule();
        };
        socket.onerror = () => {
          if (!stopped)
            setError("Relay connection unavailable. Reconnecting automatically…");
        };
      } catch (reason) {
        if (stopped) return;
        if (reason instanceof DashboardRequestError && reason.status === 401) {
          setError(reason.message);
          await clearBrowserWorkspace();
          setCredential(null);
          setState(emptyControlState(""));
          setPhase("unpaired");
          return;
        }
        setError(reason instanceof Error ? reason.message : "Relay unavailable");
        schedule();
      }
    };
    void connect();
    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      if (heartbeat) clearInterval(heartbeat);
      bindLiveSocket(null);
      socket?.close(1000, "Workspace changed");
    };
  }, [credential, reconnect]);

  const can = useCallback(
    (action: string, requestedKind?: "PAPER" | "HOST") => {
      const ready = state.ready;
      if (!ready || phase !== "live") return false;
      if (
        (action === "player.op" ||
          action === "player.deop" ||
          action.startsWith("backup.restore")) &&
        ready.device.role !== "Owner"
      )
        return false;
      let kind =
        requestedKind ??
        (action.startsWith("backup.") ||
        (action.startsWith("server.") && action !== "server.status")
          ? "HOST"
          : "PAPER");
      if (
        !requestedKind &&
        (action.startsWith("files.") || action === "server.status") &&
        ready.agents.host
      )
        kind = "HOST";
      return (
        Boolean(kind === "HOST" ? ready.agents.host : ready.agents.paper) &&
        canAction(
          action,
          ready.device.scopes,
          kind === "HOST"
            ? ready.server.hostCapabilities
            : ready.server.paperCapabilities,
        )
      );
    },
    [state.ready, phase],
  );

  const run = useCallback(
    async (
      action: string,
      parameters: JsonMap,
      kind?: "PAPER" | "HOST",
    ): Promise<ActionCompletion> => {
      if (!can(action, kind)) {
        const unavailable = new Error(
          "This action is unavailable for the current device or local policy.",
        );
        setNotice(unavailable.message);
        throw unavailable;
      }
      if (
        HIGH_RISK.has(action) ||
        action === "console.execute" ||
        action === "plugin.command.reload"
      ) {
        const approved = await new Promise<boolean>((resolve) =>
          setConfirmation({
            action,
            parameters,
            resolve: (ok) => {
              setConfirmation(null);
              resolve(ok);
            },
          }),
        );
        if (!approved) throw new Error("Cancelled");
        parameters = { ...parameters, confirmed: true };
      }
      try {
        const result = await sendDashboardAction(action, parameters, kind);
        setNotice(
          str(result.data.message, result.message || "Operation completed."),
        );
        return result;
      } catch (reason) {
        setNotice(operationText(reason));
        throw reason;
      }
    },
    [can],
  );

  const forget = async () => {
    if (!leaveEditor()) return;
    await logoutDashboard();
    setCredential(null);
    setState(emptyControlState(""));
    setPhase("unpaired");
    setCredentials(await listRelayCredentials());
  };
  const refreshCurrent = useCallback(() => {
    if (
      ["Overview", "Performance", "Players", "Console", "Chat", "Plugins"].includes(
        section,
      )
    ) {
      if (section === "Performance")
        setNotice(
          state.updatedAt
            ? `Latest pushed telemetry received at ${new Date(state.updatedAt).toLocaleTimeString()}.`
            : "Waiting for the first pushed telemetry sample.",
        );
      else if (section === "Console" || section === "Chat")
        setNotice(
          `${section} follows the authorized live stream; no duplicate poll was sent.`,
        );
      else
        setNotice(
          state.updatedAt
            ? `Using the latest pushed snapshot from ${new Date(state.updatedAt).toLocaleTimeString()}.`
            : "Waiting for the first live snapshot.",
        );
      return;
    }
    setRefreshRevision((value) => value + 1);
    setNotice(`Refreshing ${section.toLowerCase()}…`);
  }, [section, state.updatedAt]);
  const copyDiagnostics = useCallback(() => {
    void navigator.clipboard
      .writeText(diagnostics(state))
      .then(() => setNotice("Safe diagnostics copied."));
  }, [state]);
  const resetHistory = useCallback(
    () => setState((current) => ({ ...current, history: [] })),
    [],
  );

  if (pairing || phase === "unpaired")
    return (
      <Pairing
        done={restore}
        {...(credential ? { cancel: () => setPairing(false) } : {})}
        error={error}
      />
    );
  if (phase === "loading")
    return (
      <main className="cr-loading">
        <Brand />
        <p>Opening your browser workspace…</p>
      </main>
    );

  const props: ViewProps = {
    state,
    can,
    run,
    notice: setNotice,
    connected: phase === "live",
    setUnsaved,
  };
  let view: React.ReactNode;
  switch (section) {
    case "Overview":
      view = <OverviewView21 {...props} />;
      break;
    case "Performance":
      view = <PerformanceView21 props={props} resetHistory={resetHistory} />;
      break;
    case "Players":
      view = <PlayersView21 {...props} />;
      break;
    case "Console":
      view = <ConsoleView21 {...props} />;
      break;
    case "Chat":
      view = <ChatView21 {...props} />;
      break;
    case "Plugins":
      view = <PluginsView21 {...props} />;
      break;
    case "Files":
      view = <FilesView {...props} />;
      break;
    case "Backups":
      view = <BackupsView {...props} />;
      break;
    case "Server":
      view = <ServerView21 {...props} />;
      break;
    case "Audit":
      view = <AuditView21 {...props} />;
      break;
    case "Access":
      view = (
        <AccessView21 {...props} forget={forget} pair={() => setPairing(true)} />
      );
      break;
    case "Settings":
      view = (
        <SettingsView
          {...props}
          reconnect={() => setReconnect((value) => value + 1)}
        />
      );
      break;
  }

  const serverName = str(
    state.server.serverName,
    credential?.serverId
      ? `Server ${credential.serverId.slice(0, 8)}`
      : "Server unavailable",
  );
  const role = state.ready?.device.role ?? credential?.role ?? "Paired";
  const paper = Boolean(state.ready?.agents.paper);
  const host = Boolean(state.ready?.agents.host);
  const restartAvailable =
    can("server.restart", "HOST") &&
    lifecycleActionAllowed(
      "restart",
      normalizeServiceState(state.service.state, paper),
    );

  return (
    <div
      className={`control-room cr21-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}
    >
      <button
        className="cr21-mobile-menu"
        aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={sidebarOpen}
        aria-controls="control-room-navigation"
        onClick={() => setSidebarOpen((open) => !open)}
      >
        <Icon name="menu" />
      </button>
      {sidebarOpen && (
        <button
          className="cr21-sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        id="control-room-navigation"
        className={`cr21-sidebar ${sidebarOpen ? "mobile-open" : ""}`}
      >
        <div className="cr21-sidebar-head">
          <Brand compact={sidebarCollapsed} />
          <button
            className="cr21-collapse"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => {
              const next = !sidebarCollapsed;
              setSidebarCollapsed(next);
              localStorage.setItem("plexonpanel-sidebar-collapsed", String(next));
            }}
          >
            <span>{sidebarCollapsed ? "›" : "‹"}</span>
          </button>
        </div>
        {!sidebarCollapsed && (
          <div className="cr21-server-identity">
            <span className={`cr-dot ${paper ? "online" : ""}`} />
            <div>
              <strong>{serverName}</strong>
              <small>
                {paper
                  ? `Paper ${state.ready?.server.minecraftVersion ?? "version unavailable"}`
                  : "Paper disconnected"}
              </small>
            </div>
          </div>
        )}
        <nav className="cr21-nav" aria-label="Control room pages">
          {navGroups.map((group) => (
            <div className="cr21-nav-group" key={group.label}>
              {!sidebarCollapsed && (
                <span className="cr21-nav-label">{group.label}</span>
              )}
              {group.sections.map((name) => (
                <button
                  key={name}
                  className={section === name ? "active" : ""}
                  aria-current={section === name ? "page" : undefined}
                  title={sidebarCollapsed ? name : undefined}
                  onClick={() => navigate(name)}
                >
                  <Icon name={iconBySection[name]} />
                  {!sidebarCollapsed && <span>{name}</span>}
                  {name === "Console" &&
                    state.console.some((line) => line.level === "ERROR") && (
                      <i className="cr-nav-alert" />
                    )}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="cr21-sidebar-foot">
          {!sidebarCollapsed && (
            <>
              <Badge tone="cyan">{role}</Badge>
              <small>{state.ready?.device.name ?? credential?.name}</small>
              <button className="cr-text-button" onClick={() => navigate("Access")}>
                Manage access
              </button>
            </>
          )}
        </div>
      </aside>

      <div className="cr21-main">
        <header className="cr21-topbar">
          <div className="cr21-topbar-server">
            <span className="cr21-kicker">CURRENT SERVER</span>
            {credentials.length > 1 ? (
              <label className="cr21-server-select">
                <span className="sr-only">Selected server</span>
                <select
                  value={credential?.serverId}
                  onChange={(event) => {
                    if (!leaveEditor()) return;
                    setSection("Overview");
                    void selectRelayCredential(event.target.value)
                      .then(restore)
                      .catch((reason) =>
                        setNotice(
                          reason instanceof Error
                            ? reason.message
                            : "Unable to switch server",
                        ),
                      );
                  }}
                >
                  {credentials.map((item) => (
                    <option key={item.serverId} value={item.serverId}>
                      {item.serverId.slice(0, 8)} · {item.role}
                    </option>
                  ))}
                </select>
                <Icon name="chevron" size={15} />
              </label>
            ) : (
              <strong>{serverName}</strong>
            )}
          </div>
          <div className="cr21-agent-pills">
            <span data-online={paper}>
              <i /> {paper ? "Paper" : "Paper offline"}
            </span>
            <span data-online={host}>
              <i />{" "}
              {host
                ? "Host"
                : state.ready?.agents.hostInstalled
                  ? "Host offline"
                  : "Host not installed"}
            </span>
          </div>
          <Freshness phase={phase} updatedAt={state.updatedAt} />
          <div className="cr21-topbar-actions">
            <button
              className="cr21-icon-button"
              title="Refresh current view"
              aria-label="Refresh current view"
              onClick={refreshCurrent}
            >
              <Icon name="refresh" />
            </button>
            <details className="cr21-quick-actions">
              <summary className="cr-button">
                <Icon name="bolt" size={16} /> Quick actions
              </summary>
              <div>
                {restartAvailable && (
                  <button onClick={() => void run("server.restart", {}, "HOST")}>
                    Restart server
                  </button>
                )}
                {can("backup.create", "HOST") && (
                  <button onClick={() => void run("backup.create", {}, "HOST")}>
                    Create backup
                  </button>
                )}
                <button onClick={() => navigate("Console")}>Open console</button>
                <button onClick={() => navigate("Files")}>Open files</button>
                <button onClick={copyDiagnostics}>Copy diagnostics</button>
                <button onClick={refreshCurrent}>Refresh current view</button>
              </div>
            </details>
            <button
              className="cr21-command-button"
              onClick={() => setPaletteOpen(true)}
            >
              <Icon name="search" size={16} />
              <span>Command</span>
              <kbd>⌘K</kbd>
            </button>
            <button className="cr21-role-button" onClick={() => navigate("Access")}>
              <span>{role}</span>
              <Icon name="chevron" size={14} />
            </button>
          </div>
        </header>

        <div className="cr21-page-head">
          <div>
            <span>CONTROL ROOM / {section.toUpperCase()}</span>
            <h1>{section}</h1>
          </div>
          <div className="cr21-page-meta">
            <Freshness phase={phase} updatedAt={state.updatedAt} />
            <button className="cr-button" onClick={refreshCurrent}>
              <Icon name="refresh" size={15} /> Refresh
            </button>
          </div>
        </div>

        {phase !== "live" ? (
          <div className="cr-banner amber">
            {error || "Connecting to the relay…"}
            {state.cached &&
              " Showing a bounded browser cache; actions are disabled."}
            <button onClick={() => setReconnect((value) => value + 1)}>
              Retry now
            </button>
          </div>
        ) : (
          !paper && (
            <div className="cr-banner">
              {host
                ? "Paper is offline. The authenticated Host companion remains connected."
                : "The relay is reachable. Waiting for an authenticated Paper or Host agent."}
            </div>
          )
        )}
        {error && phase === "live" && (
          <p className="cr-alert" role="alert">
            {error}
          </p>
        )}

        <main
          className="cr21-content"
          key={`${credential?.serverId}-${section}-${refreshRevision}`}
        >
          {view}
        </main>
        <footer className="cr21-footer">
          <span>Local authority · Signed protocol 3</span>
          <span>PlexonPanel Dashboard 2.1.0</span>
        </footer>
      </div>

      {notice && (
        <div className="cr-toast cr21-toast" role="status" aria-live="polite">
          <span>{notice}</span>
          <button aria-label="Dismiss notification" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
      {confirmation && <Confirm value={confirmation} />}
      <CommandPalette
        open={paletteOpen}
        close={() => setPaletteOpen(false)}
        navigate={navigate}
        run={run}
        can={can}
        restartAvailable={restartAvailable}
        refresh={refreshCurrent}
        copyDiagnostics={copyDiagnostics}
      />
    </div>
  );
}

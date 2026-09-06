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
import { operationText } from "../lib/operation-messages";
import { Badge, Empty, type ViewProps } from "./control-views";
import {
  ChatView21,
  ConsoleView21,
  PlayersView21,
  PluginsView21,
} from "./management-views-2-1";
import { OverviewView21, PerformanceView21 } from "./monitoring-views-2-1";
import { ServerView21 } from "./server-view-2-1";

const FilesView = dynamic(
  () => import("./advanced-views").then((module) => module.FilesView),
  { loading: () => <Empty title="Opening files…" /> },
);
const BackupsView = dynamic(() =>
  import("./advanced-views").then((module) => module.BackupsView),
);
const AuditView = dynamic(() =>
  import("./advanced-views").then((module) => module.AuditView),
);
const AccessView = dynamic(() =>
  import("./advanced-views").then((module) => module.AccessView),
);
const SettingsView = dynamic(() =>
  import("./advanced-views").then((module) => module.SettingsView),
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
type Phase =
  | "loading"
  | "unpaired"
  | "connecting"
  | "live"
  | "reconnecting"
  | "error";
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
  | "panel"
  | "copy";

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

const navGroups: { label: string; sections: Section[] }[] = [
  { label: "MONITOR", sections: ["Overview", "Performance", "Players"] },
  { label: "COMMUNICATION", sections: ["Console", "Chat"] },
  { label: "MANAGE", sections: ["Plugins", "Files", "Backups"] },
  { label: "SYSTEM", sections: ["Server", "Audit", "Access", "Settings"] },
];

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "overview":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="2" />
          <rect x="14" y="3" width="7" height="7" rx="2" />
          <rect x="3" y="14" width="7" height="7" rx="2" />
          <rect x="14" y="14" width="7" height="7" rx="2" />
        </svg>
      );
    case "performance":
      return (
        <svg {...common}>
          <path d="M3 17l5-5 4 3 7-8" />
          <path d="M16 7h3v3" />
        </svg>
      );
    case "players":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 19c.6-3.3 2.4-5 5.5-5s4.9 1.7 5.5 5" />
          <circle cx="17" cy="9" r="2" />
          <path d="M15.5 14.5c2.8-.3 4.6 1.2 5 4.5" />
        </svg>
      );
    case "console":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <path d="M7 9l3 3-3 3M12.5 15H17" />
        </svg>
      );
    case "chat":
      return (
        <svg {...common}>
          <path d="M4 5h16v11H9l-5 4V5z" />
        </svg>
      );
    case "plugins":
      return (
        <svg {...common}>
          <path d="M8 3v5H3v8h5v5h8v-5h5V8h-5V3H8z" />
        </svg>
      );
    case "files":
      return (
        <svg {...common}>
          <path d="M3 6h7l2 2h9v11H3z" />
          <path d="M3 6V4h7l2 2" />
        </svg>
      );
    case "backups":
      return (
        <svg {...common}>
          <path d="M5 8a8 8 0 1 1-1 8" />
          <path d="M5 3v5H0" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "server":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="6" rx="2" />
          <rect x="3" y="14" width="18" height="6" rx="2" />
          <path d="M7 7h.01M7 17h.01M11 7h6M11 17h6" />
        </svg>
      );
    case "audit":
      return (
        <svg {...common}>
          <path d="M6 3h12v18H6z" />
          <path d="M9 8h6M9 12h6M9 16h4" />
        </svg>
      );
    case "access":
      return (
        <svg {...common}>
          <path d="M12 3l8 4v5c0 5-3.1 8-8 9-4.9-1-8-4-8-9V7z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.5 1a7 7 0 0 0-1.7-1L14.4 3h-4l-.4 3.1a7 7 0 0 0-1.7 1l-2.5-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.5-1a7 7 0 0 0 1.7 1l.4 3.1h4l.4-3.1a7 7 0 0 0 1.7-1l2.5 1 2-3.4-2-1.5c.1-.3.1-.7.1-1z" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...common}>
          <path d="M20 6v5h-5" />
          <path d="M4 18v-5h5" />
          <path d="M6.1 9a7 7 0 0 1 11.7-2.6L20 11M4 13l2.2 4.6A7 7 0 0 0 18 15" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...common}>
          <path d="M13 2L5 13h6l-1 9 9-12h-6z" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="M16 16l5 5" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...common}>
          <path d="M8 10l4 4 4-4" />
        </svg>
      );
    case "menu":
      return (
        <svg {...common}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      );
    case "copy":
      return (
        <svg {...common}>
          <rect x="8" y="8" width="11" height="11" rx="2" />
          <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M4 4h16v16H4z" />
          <path d="M8 8h8v8H8z" />
        </svg>
      );
  }
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
            <b>01</b> Run <code>/plexonpanel pair</code> in Minecraft or the
            server console.
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
            The local operator chooses your role. Without a role argument,
            pairing defaults to Observer.
          </p>
          <form
            className="cr-form"
            onSubmit={(event) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              void pairDashboardServer(code, name)
                .then(() => {
                  setCode("");
                  return done();
                })
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
            Server identity is protected by Ed25519 signatures. Telemetry and
            file contents are not stored by the relay.
          </p>
        </div>
      </section>
    </main>
  );
}

function Confirm({ value }: { value: Confirmation }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
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
        <button
          className="cr-button danger"
          onClick={() => value.resolve(true)}
        >
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
    return (
      <span className="cr21-freshness waiting">Waiting for sample</span>
    );
  const seconds = Math.max(
    0,
    Math.floor((Math.max(now, updatedAt) - updatedAt) / 1000),
  );
  if (seconds <= 15)
    return (
      <span className="cr21-freshness live">
        Live · updated {seconds}s ago
      </span>
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
  refresh,
  copyDiagnostics,
}: {
  open: boolean;
  close: () => void;
  navigate: (section: Section) => void;
  run: ViewProps["run"];
  can: ViewProps["can"];
  refresh: () => void;
  copyDiagnostics: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (open) ref.current?.showModal();
    else if (ref.current?.open) ref.current.close();
  }, [open]);
  const finishClose = () => {
    setQuery("");
    close();
  };
  const items: { label: string; action: () => void; visible?: boolean }[] = [
    ...sections.map((section) => ({
      label: `Go to ${section}`,
      action: () => navigate(section),
    })),
    { label: "Refresh current page", action: refresh },
    {
      label: "Create backup",
      visible: can("backup.create", "HOST"),
      action: () => {
        void run("backup.create", {}, "HOST");
      },
    },
    {
      label: "Restart server",
      visible: can("server.restart", "HOST"),
      action: () => {
        void run("server.restart", {}, "HOST");
      },
    },
    { label: "Copy diagnostics", action: copyDiagnostics },
  ];
  const visible = items.filter(
    (item) =>
      item.visible !== false &&
      item.label.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <dialog
      className="cr21-command"
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        finishClose();
      }}
    >
      <div className="cr21-command-search">
        <Icon name="search" />
        <input
          autoFocus
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
              finishClose();
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
  const [state, setState] = useState<ControlState>(() =>
    emptyControlState(""),
  );
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
  const navigate = useCallback(
    (next: Section) => {
      if (next !== section && !leaveEditor()) return;
      setSection(next);
      localStorage.setItem("plexonpanel-last-section", next);
      setSidebarOpen(false);
    },
    [section],
  );

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
    let current = true;
    void Promise.resolve().then(() => {
      if (current) return restore();
    });
    return () => {
      current = false;
    };
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
            setError(
              "Relay connection unavailable. Reconnecting automatically…",
            );
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
      [
        "Overview",
        "Performance",
        "Players",
        "Console",
        "Chat",
        "Plugins",
      ].includes(section)
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
      view = <AuditView {...props} />;
      break;
    case "Access":
      view = (
        <AccessView {...props} forget={forget} pair={() => setPairing(true)} />
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

  return (
    <div
      className={`cr21-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}
    >
      <button
        className="cr21-mobile-menu"
        aria-label="Open navigation"
        onClick={() => setSidebarOpen(true)}
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
      <aside className={`cr21-sidebar ${sidebarOpen ? "mobile-open" : ""}`}>
        <div className="cr21-sidebar-head">
          <Brand compact={sidebarCollapsed} />
          <button
            className="cr21-collapse"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => {
              const next = !sidebarCollapsed;
              setSidebarCollapsed(next);
              localStorage.setItem(
                "plexonpanel-sidebar-collapsed",
                String(next),
              );
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
              <button
                className="cr-text-button"
                onClick={() => navigate("Access")}
              >
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
              <i />
              {paper ? "Paper" : "Paper offline"}
            </span>
            <span data-online={host}>
              <i />
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
                <Icon name="bolt" size={16} />
                Quick actions
              </summary>
              <div>
                {can("server.restart", "HOST") && (
                  <button
                    onClick={() => {
                      void run("server.restart", {}, "HOST");
                    }}
                  >
                    Restart server
                  </button>
                )}
                {can("backup.create", "HOST") && (
                  <button
                    onClick={() => {
                      void run("backup.create", {}, "HOST");
                    }}
                  >
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
            <button
              className="cr21-role-button"
              onClick={() => navigate("Access")}
            >
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
              <Icon name="refresh" size={15} />
              Refresh
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
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
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
        refresh={refreshCurrent}
        copyDiagnostics={copyDiagnostics}
      />
    </div>
  );
}

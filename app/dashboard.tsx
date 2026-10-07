"use client";

import { Select } from "../components/select";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  bindLiveSocket,
  captureActionTarget,
  DashboardRequestError,
  LIVE_CONNECTION_TIMEOUT_MS,
  handleRelayControlMessage,
  logoutDashboard,
  pairDashboardServer,
  requestLiveConnection,
  sendDashboardAction,
  unbindLiveSocket,
  type ActionCompletion,
} from "../lib/data-source";
import {
  clearBrowserWorkspace,
  listRelayCredentials,
  loadControlCache,
  loadRelayCredential,
  loadServerLabels,
  saveServerLabel,
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
  type Ready,
  compatibleActionTarget,
} from "../lib/control-state";
import { DASHBOARD_LABEL, DASHBOARD_VERSION } from "../lib/dashboard-version";
import { isImmediateControlMessage } from "../lib/display-cadence";
import {
  reconcileDeviceGrant,
  type DeviceGrantLike,
} from "../lib/device-grant";
import {
  ACTION_CONTRACT_ID,
  canAction,
  HIGH_RISK,
} from "../lib/scopes";
import {
  lifecycleActionAllowed,
  normalizeServiceState,
} from "../lib/lifecycle-state";
import { operationText } from "../lib/operation-messages";
import { useUiPreferences } from "../components/ui-preferences-provider";
import { Badge, type ViewProps } from "./control-views";
import { ChatView, PluginsView } from "./communication-views";
const ConsoleView = dynamic(() => import("./console-view").then(module => module.ConsoleView));
const PlayersView = dynamic(() => import("./players-view").then(module => module.PlayersView));
const AccessView = dynamic(() => import("./governance-views").then(module => module.AccessView));
const AuditView = dynamic(() => import("./governance-views").then(module => module.AuditView));
const PerformanceView = dynamic(() => import("./performance-view").then(module => module.PerformanceView));
import { OverviewView } from "./overview-view";
const ServerView = dynamic(() => import("./server-view").then(module => module.ServerView));
import { ConnectionPills, ConnectionSummary } from "./connection-summary";
import { TelemetryFreshness } from "./telemetry-freshness";
const BackupsView = dynamic(() => import("./backups-view").then(module => module.BackupsView));

const SettingsView = dynamic(() =>
  import("./settings-view").then((module) => module.SettingsView),
);
const FleetOverview = dynamic(() => import("./fleet-overview").then(module => module.FleetOverview));
const ConfigurationView = dynamic(() => import("./configuration-view").then(module => module.ConfigurationView));
const PreferencesDialog = dynamic(() => import("./preferences-dialog").then(module => module.PreferencesDialog));

const sections = [
  "Fleet",
  "Overview",
  "Performance",
  "Players",
  "Console",
  "Chat",
  "Plugins",
  "Server",
  "Backups",
  "Configuration",
  "Audit",
  "Access",
  "Settings",
] as const;
type Section = (typeof sections)[number];
const pageDescriptions: Record<Section, string> = {
  Fleet: "Choose a paired server to open its workspace.",
  Overview: "Server health, activity and resources at a glance.",
  Performance: "Explore Minecraft and machine metrics over time.",
  Players: "Online players, player history and moderation.",
  Console: "Live output, searchable history and authorized commands.",
  Chat: "Read and participate in this server’s chat.",
  Plugins: "Installed plugins and their configuration.",
  Server: "Start, stop or restart this Minecraft instance.",
  Backups: "Manual full backups, verified storage and recovery.",
  Configuration: "Edit configuration files with a review before saving.",
  Audit: "Review operations performed on this server.",
  Access: "Paired devices, permissions and credentials.",
  Settings: "Client preferences, connection details and diagnostics.",
};
type Phase = "loading" | "unpaired" | "connecting" | "live" | "reconnecting";
type Confirmation = {
  action: string;
  parameters: JsonMap;
  serverId: string;
  serverName: string;
  resolve: (approved: boolean) => void;
};
type StateUpdater = ControlState | ((current: ControlState) => ControlState);
function actionAuthority(action: string, ready: Ready | null, requested?: "PAPER" | "HOST"): "PAPER" | "HOST" {
  if (requested) return requested;
  if (action.startsWith("backup.") || action.startsWith("maintenance.") || action.startsWith("provider.")
      || (action.startsWith("server.") && action !== "server.status")) return "HOST";
  if ((action.startsWith("files.") || action === "server.status") && ready?.agents.host) return "HOST";
  return "PAPER";
}
type IconName =
  | "overview"
  | "performance"
  | "players"
  | "console"
  | "chat"
  | "plugins"
  | "server"
  | "backup"
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
  { label: "MONITOR", sections: ["Fleet", "Overview", "Performance", "Players"] },
  { label: "COMMUNICATION", sections: ["Console", "Chat"] },
  { label: "MANAGE", sections: ["Server", "Configuration", "Plugins", "Backups"] },
  { label: "CONTROL", sections: ["Audit", "Access", "Settings"] },
];
const iconBySection: Record<Section, IconName> = {
  Fleet: "server",
  Overview: "overview",
  Performance: "performance",
  Players: "players",
  Console: "console",
  Chat: "chat",
  Plugins: "plugins",
  Server: "server",
  Backups: "backup",
  Configuration: "settings",
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
  server:
    "M3 4h18v6H3zM3 14h18v6H3zM7 7h.01M7 17h.01M11 7h6M11 17h6",
  backup: "M5 5h14v4H5zM6 9v10h12V9M9 13h6M10 16h4",
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
  panel:
    "M5 4.5h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2ZM3 8h18M6 6.25h.01M8.5 6.25h.01M7 12l2.5 2L7 16M12.5 16h4.5",
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
    <div className={`workspace-brand ${compact ? "compact" : ""}`}>
      <span className="workspace-brand-mark">
        <Icon name="panel" size={19} />
      </span>
      {!compact && (
        <div>
          <strong>
            Plexon<span>Panel</span>
          </strong>
          <small>Control Room · {DASHBOARD_VERSION}</small>
        </div>
      )}
    </div>
  );
}

function Pairing({
  done,
  cancel,
  servers = [],
  selectServer,
  error: initialError,
}: {
  done: () => Promise<void>;
  cancel?: () => void;
  servers?: readonly RelayCredential[];
  selectServer?: (id: string) => void;
  error?: string;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("My browser");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  return (
    <main className="ui-pair-screen">
      <section className="ui-pair-copy">
        <Brand />
        <div>
          <span className="ui-eyebrow">Plexon server control room</span>
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
        <div className="ui-pair-steps">
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
      <section className="ui-pair-form">
        <div>
          <Badge tone="cyan">Secure device pairing</Badge>
          <h2>Pair this browser</h2>
          <p>
            The local operator chooses your role. Pairing defaults to Observer
            when no role is supplied.
          </p>
          <form
            className="ui-form"
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
                className="ui-code"
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
              <p className="ui-alert" role="alert">
                {error}
              </p>
            )}
            <button
              className="ui-button primary"
              disabled={busy || !/^\d{6}$/.test(code)}
            >
              {busy ? "Waiting for local approval…" : "Open control room"}
            </button>
            {cancel && (
              <button type="button" className="ui-button" onClick={cancel}>
                Back to server
              </button>
            )}
          </form>
          <p className="ui-hint">
            Server identity is signed. Telemetry and file contents are not stored
            by the relay.
          </p>
          {servers.length > 0 && selectServer && <label className="ui-form">
            Open a paired server
            <Select aria-label="Open a paired server" value="" onValueChange={selectedValue => { if (selectedValue) selectServer(selectedValue); }}>
              <option value="" disabled>Choose a server</option>
              {servers.map(server => <option key={server.serverId} value={server.serverId}>{server.serverId.slice(0, 8)} · {server.role}</option>)}
            </Select>
          </label>}
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
      className="ui-confirm workspace-dialog"
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
        This operation will run on <strong>{value.serverName}</strong> using this device&apos;s local permissions.
        <br /><code>{value.serverId.slice(0, 8)}</code>
      </p>
      {target !== undefined && (
        <code className="ui-confirm-target">{String(target)}</code>
      )}
      {value.action === "console.execute" && (
        <pre className="ui-output">{str(value.parameters.command)}</pre>
      )}
      {value.action === "backup.full.delete" && <p>This deletes the history record and any retained VPS archive. The canonical Google Drive backup remains stored.</p>}
      {value.action === "maintenance.recovery.resolve" && <p>Verify Minecraft is online and Host-local RCON readiness is healthy before clearing the recovery gate. The failed backup remains recorded as failed.</p>}
      {value.action === "maintenance.restart.now" && <p>The Host will run its maintenance warning and readiness workflow before restarting this server.</p>}
      <div className="ui-actions">
        <button className="ui-button" onClick={() => value.resolve(false)}>
          Cancel
        </button>
        <button className="ui-button danger" onClick={() => value.resolve(true)}>
          Confirm operation
        </button>
      </div>
    </dialog>
  );
}

function CommandPalette({
  open,
  close,
  navigate,
  run,
  restartAvailable,
  refresh,
  copyDiagnostics,
}: {
  open: boolean;
  close: () => void;
  navigate: (section: Section) => void;
  run: ViewProps["run"];
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
      label: "Restart server",
      visible: restartAvailable,
      action: () => void run("server.restart", {}, "HOST").catch(() => {}),
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
      className="workspace-command"
      ref={ref}
      aria-label="Command palette"
      onCancel={(event) => {
        event.preventDefault();
        finish();
      }}
    >
      <div className="workspace-command-search">
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
      <div className="workspace-command-list">
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

export default function Dashboard() {
  const { preferences } = useUiPreferences();
  const [credential, setCredential] = useState<RelayCredential | null>(null);
  const [sessionGrant, setSessionGrant] = useState<DeviceGrantLike | null>(null);
  const [credentials, setCredentials] = useState<RelayCredential[]>([]);
  const [state, setState] = useState<ControlState>(() => emptyControlState(""));
  const [phase, setPhase] = useState<Phase>("loading");
  const [section, setSection] = useState<Section>("Fleet");
  const [serverLabels, setServerLabels] = useState<Record<string, string>>({});
  const knownLabels = useRef<Record<string, string>>({});
  const rememberServerName = useCallback((id: string, name: string) => {
    if (knownLabels.current[id] === name) return;
    knownLabels.current = { ...knownLabels.current, [id]: name };
    setServerLabels(knownLabels.current);
    void saveServerLabel(id, name).catch(() => {});
  }, []);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pairing, setPairing] = useState(false);
  const [reconnect, setReconnect] = useState(0);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const confirmationRef = useRef<Confirmation | null>(null);
  const selectionRevision = useRef(0);
  const cancelConfirmation = useCallback(() => confirmationRef.current?.resolve(false), []);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileNavigation, setMobileNavigation] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const unsaved = useRef(false);
  const authoritativeState = useRef<ControlState>(state);
  const displayTimer = useRef<number | null>(null);
  const displayDirty = useRef(false);
  const displayRateRef = useRef(preferences.displayUpdateRateMs);

  useEffect(() => {
    displayRateRef.current = preferences.displayUpdateRateMs;
  }, [preferences.displayUpdateRateMs]);

  const flushDisplayedState = useCallback(() => {
    if (displayTimer.current !== null) {
      window.clearTimeout(displayTimer.current);
      displayTimer.current = null;
    }
    displayDirty.current = false;
    setState(authoritativeState.current);
  }, []);

  const commitState = useCallback(
    (updater: StateUpdater, immediate = false) => {
      const next =
        typeof updater === "function"
          ? updater(authoritativeState.current)
          : updater;
      authoritativeState.current = next;
      if (immediate || displayRateRef.current === 0) {
        flushDisplayedState();
        return;
      }
      displayDirty.current = true;
      if (displayTimer.current === null) {
        displayTimer.current = window.setTimeout(
          flushDisplayedState,
          displayRateRef.current,
        );
      }
    },
    [flushDisplayedState],
  );

  useEffect(() => {
    if (!displayDirty.current) return;
    if (displayTimer.current !== null) {
      window.clearTimeout(displayTimer.current);
      displayTimer.current = null;
    }
    if (preferences.displayUpdateRateMs === 0) {
      flushDisplayedState();
      return;
    }
    displayTimer.current = window.setTimeout(
      flushDisplayedState,
      preferences.displayUpdateRateMs,
    );
  }, [preferences.displayUpdateRateMs, flushDisplayedState]);

  useEffect(
    () => () => {
      if (displayTimer.current !== null) window.clearTimeout(displayTimer.current);
    },
    [],
  );

  const setUnsaved = useCallback((dirty: boolean) => {
    unsaved.current = dirty;
  }, []);
  const leaveEditor = useCallback(() =>
    !unsaved.current || window.confirm("Discard unsaved changes?"), []);
  const navigate = (next: Section) => {
    if (next !== section && !leaveEditor()) return;
    setSection(next);
    if (next !== "Fleet" && credential) {
      try { localStorage.setItem(`plexonpanel-section:${credential.serverId}`, next); } catch {}
    }
    cancelConfirmation();
    setPaletteOpen(false);
    setSidebarOpen(false);
  };

  const restore = useCallback(async (expectedServerId?: string, revision = selectionRevision.current) => {
    try {
      const [selected, saved, labels] = await Promise.all([loadRelayCredential(), listRelayCredentials(), loadServerLabels()]);
      const cached = selected ? await loadControlCache(selected.serverId) : null;
      if (revision !== selectionRevision.current || (expectedServerId && selected?.serverId !== expectedServerId)) return;
      knownLabels.current = labels;
      setServerLabels(labels);
      setCredentials(saved);
      setCredential(selected);
      setSessionGrant(null);
      const restored = selected
        ? (cached?.serverId === selected.serverId ? cached : emptyControlState(selected.serverId))
        : emptyControlState("");
      authoritativeState.current = restored;
      setState(restored);
      setSection("Fleet");
      try { setSidebarCollapsed(localStorage.getItem("plexonpanel-sidebar-collapsed") === "true"); } catch {}
      setPairing(false);
      setPhase(selected ? "connecting" : saved.length ? "connecting" : "unpaired");
    } catch (reason) {
      if (revision !== selectionRevision.current) return;
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
    const name = state.ready?.server.serverName;
    if (phase === "live" && name) rememberServerName(state.serverId, name);
  }, [phase, state.serverId, state.ready?.server.serverName, rememberServerName]);
  useEffect(() => {
    if (!credential || !state.updatedAt) return;
    const timer = window.setTimeout(() => {
      void saveControlCache(state).catch(() => {});
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [state, credential]);
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
    const media = window.matchMedia("(max-width: 800px)");
    const update = () => setMobileNavigation(media.matches);
    queueMicrotask(update);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!sidebarOpen || !mobileNavigation) return;
    const sidebar = document.getElementById("control-room-navigation");
    const buttons = sidebar?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
    buttons?.[0]?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
        document.querySelector<HTMLButtonElement>(".workspace-mobile-menu")?.focus();
      }
      if (event.key === "Tab" && buttons?.length) {
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sidebarOpen, mobileNavigation]);

  useEffect(() => {
    if (!credential) return;
    const revision = selectionRevision.current;
    let stopped = false;
    let attempt = 0;
    let connectionSequence = 0;
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let handshake: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (stopped || revision !== selectionRevision.current) return;
      attempt += 1;
      setPhase("reconnecting");
      if (retry) clearTimeout(retry);
      retry = setTimeout(
        () => {
          retry = undefined;
          void connect();
        },
        Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5)) *
          (0.8 + Math.random() * 0.4),
      );
    };
    const connect = async () => {
      if (stopped || revision !== selectionRevision.current) return;
      const sequence = ++connectionSequence;
      setPhase(attempt ? "reconnecting" : "connecting");
      try {
        const grant = await requestLiveConnection(credential);
        if (
          stopped || revision !== selectionRevision.current ||
          sequence !== connectionSequence ||
          grant.serverId !== credential.serverId ||
          grant.deviceId !== credential.deviceId ||
          grant.token !== credential.accessToken
        )
          return;
        const candidate = new WebSocket(grant.websocketUrl, [
          "plexonpanel-v3",
          `auth.${grant.token}`,
        ]);
        socket = candidate;
        let heartbeat: ReturnType<typeof setInterval> | undefined;
        let authenticatedReady = false;
        const isCurrent = () =>
          !stopped && revision === selectionRevision.current &&
          sequence === connectionSequence &&
          socket === candidate &&
          authoritativeState.current.serverId === credential.serverId;
        handshake = setTimeout(() => {
          if (isCurrent() && !authenticatedReady) candidate.close(4008, "Relay handshake timed out");
        }, LIVE_CONNECTION_TIMEOUT_MS);
        candidate.onopen = () => {
          if (!isCurrent()) {
            candidate.close();
            return;
          }
          commitState(
            (current) => ({
              ...current,
              ready: null,
              players: [],
              pendingPlayerSnapshot: undefined,
              presenceDeltas: [],
              presenceEventIds: [],
            }),
            true,
          );
          setError("");
          heartbeat = setInterval(() => {
            if (isCurrent() && candidate.readyState === WebSocket.OPEN)
              candidate.send(JSON.stringify({ type: "dashboard.ping" }));
          }, 20_000);
        };
        candidate.onmessage = (event) => {
          if (
            !isCurrent() ||
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
                `${DASHBOARD_LABEL} requires protocol 3 agents and relay.`,
              );
              candidate.close(4008, "Protocol mismatch");
              return;
            }
            if (
              message.type === "dashboard.ready" &&
              message.protocolVersion === 3
            ) {
              if (
                (message.actionContract !== undefined &&
                  message.actionContract !== ACTION_CONTRACT_ID) ||
                (message.actionContract !== undefined &&
                  message.actionContract !== grant.actionContract)
              ) {
                setError(
                  "The live relay room is running a different action contract. Actions are blocked until the relay deployment finishes.",
                );
                candidate.close(4008, "Action contract mismatch");
                return;
              }
              const reported = record(message.device);
              const reportedGrant =
                typeof reported.deviceId === "string" &&
                typeof reported.role === "string" &&
                Array.isArray(reported.scopes) &&
                reported.scopes.every((scope) => typeof scope === "string")
                  ? {
                      deviceId: reported.deviceId,
                      role: reported.role,
                      scopes: reported.scopes as string[],
                    }
                  : null;
              const effective = reconcileDeviceGrant(grant, reportedGrant);
              if (!effective?.metadataMatches) {
                setError(
                  "The live relay connection does not match this browser's signed grant. Reconnecting safely…",
                );
                candidate.close(4008, "Signed grant mismatch");
                return;
              }
              const server = record(message.server);
              const readyContext = {
                authorization: JSON.stringify({ deviceId: reportedGrant?.deviceId,
                  role: reportedGrant?.role, scopes: reportedGrant?.scopes }),
                PAPER: JSON.stringify({ connected: record(message.agents).paper,
                  session: server.paperSession, compatible: server.paperTargetCompatible,
                  capabilities: server.paperCapabilities }),
                HOST: JSON.stringify({ connected: record(message.agents).host,
                  session: server.hostSession, compatible: server.hostTargetCompatible,
                  capabilities: server.hostCapabilities }),
              };
              if (bindLiveSocket(candidate, grant.serverId, readyContext)) cancelConfirmation();
              setSessionGrant({
                deviceId: grant.deviceId,
                role: grant.role,
                scopes: grant.scopes,
              });
              authenticatedReady = true;
              if (handshake) clearTimeout(handshake);
              handshake = undefined;
              attempt = 0;
              setPhase("live");
            }
            if (handleRelayControlMessage(message, candidate)) return;
            if (message.type === "relay.error") {
              setError(str(message.error, "Relay rejected a message"));
              return;
            }
            commitState(
              applyControlMessage(authoritativeState.current, message),
              isImmediateControlMessage(message),
            );
          } catch {
            setError("The relay sent an invalid message.");
          }
        };
        candidate.onclose = (event) => {
          if (handshake) clearTimeout(handshake);
          handshake = undefined;
          if (heartbeat) clearInterval(heartbeat);
          if (unbindLiveSocket(candidate)) cancelConfirmation();
          if (!isCurrent()) return;
          socket = null;
          connectionSequence += 1;
          setSessionGrant(null);
          commitState(
            (current) => ({
              ...current,
              ready: null,
              players: [],
              pendingPlayerSnapshot: undefined,
              presenceDeltas: [],
              presenceEventIds: [],
            }),
            true,
          );
          if (event.code === 4003) {
            setError(
              "This device was revoked or expired. Generate a new local pairing code.",
            );
            void clearBrowserWorkspace(credential.serverId).then(() => {
              if (stopped || selectionRevision.current !== revision || authoritativeState.current.serverId !== credential.serverId) return;
              setCredential(null);
              setSessionGrant(null);
              const empty = emptyControlState("");
              authoritativeState.current = empty;
              setState(empty);
              setPhase("unpaired");
              void listRelayCredentials().then(setCredentials);
            });
            return;
          }
          schedule();
        };
        candidate.onerror = () => {
          if (isCurrent())
            setError("Relay connection unavailable. Reconnecting automatically…");
        };
      } catch (reason) {
        if (stopped || revision !== selectionRevision.current) return;
        if (reason instanceof DashboardRequestError && (reason.status === 401 || reason.status === 403)) {
          setError(reason.message);
          await clearBrowserWorkspace(credential.serverId);
          if (stopped || selectionRevision.current !== revision || authoritativeState.current.serverId !== credential.serverId) return;
          setCredential(null);
          setSessionGrant(null);
          const empty = emptyControlState("");
          authoritativeState.current = empty;
          setState(empty);
          setPhase("unpaired");
          setCredentials(await listRelayCredentials());
          return;
        }
        setError(reason instanceof Error ? reason.message : "Relay unavailable");
        schedule();
      }
    };
    void connect();
    return () => {
      stopped = true;
      connectionSequence += 1;
      if (retry) clearTimeout(retry);
      if (handshake) clearTimeout(handshake);
      const current = socket;
      socket = null;
      if (current) {
        if (unbindLiveSocket(current)) cancelConfirmation();
        current.close(1000, "Workspace changed");
      }
    };
  }, [credential, reconnect, commitState, cancelConfirmation]);

  const can = useCallback(
    (action: string, requestedKind?: "PAPER" | "HOST") => {
      const ready = state.ready;
      if (
        !ready ||
        phase !== "live" ||
        (ready.actionContract !== undefined &&
          ready.actionContract !== ACTION_CONTRACT_ID)
      )
        return false;
      const grant = reconcileDeviceGrant(sessionGrant, ready.device);
      if (!grant) return false;
      if (
        (action === "player.op" ||
          action === "player.deop" ||
          action.startsWith("backup.restore")) &&
        grant.role !== "Owner"
      )
        return false;
      const kind = actionAuthority(action, ready, requestedKind);
      return (
        compatibleActionTarget(ready, kind) &&
        Boolean(kind === "HOST" ? ready.agents.host : ready.agents.paper) &&
        canAction(
          action,
          grant.scopes,
          kind === "HOST"
            ? ready.server.hostCapabilities
            : ready.server.paperCapabilities,
        )
      );
    },
    [sessionGrant, state.ready, phase],
  );

  const run = useCallback(
    async (
      action: string,
      parameters: JsonMap,
      kind?: "PAPER" | "HOST",
      confirmationMode: "default" | "preconfirmed" = "default",
    ): Promise<ActionCompletion> => {
      const revision = selectionRevision.current;
      const expectedServerId = credential?.serverId ?? "";
      kind = actionAuthority(action, state.ready, kind);
      const targetConnection = captureActionTarget(expectedServerId, kind);
      parameters = structuredClone(parameters);
      if (!can(action, kind)) {
        const unavailable = new Error(
          "This action is unavailable for the current device or local policy.",
        );
        setNotice(unavailable.message);
        throw unavailable;
      }
      if (
        confirmationMode !== "preconfirmed" &&
        (HIGH_RISK.has(action) ||
          action === "console.execute" ||
          action === "plugin.command.reload")
      ) {
        const approved = await new Promise<boolean>((resolve) => {
          cancelConfirmation();
          const next: Confirmation = {
            action, parameters, serverId: expectedServerId,
            serverName: str(state.ready?.server.serverName ?? state.server.serverName,
              `Server ${expectedServerId.slice(0, 8)}`),
            resolve: (ok) => {
              if (confirmationRef.current === next) {
                confirmationRef.current = null;
                setConfirmation(null);
              }
              resolve(ok);
            },
          };
          confirmationRef.current = next;
          setConfirmation(next);
        });
        if (!approved) throw new Error("Cancelled");
        parameters = { ...parameters, confirmed: true };
      }
      if (confirmationMode === "preconfirmed")
        parameters = { ...parameters, confirmed: true };
      if (!can(action, kind)) {
        const unavailable = new Error(
          "The live authorization changed before the action was sent. Review the current device grant and try again.",
        );
        setNotice(unavailable.message);
        throw unavailable;
      }
      try {
        const result = await sendDashboardAction(action, parameters, kind, targetConnection);
        if (captureActionTarget(expectedServerId, kind).generation !== targetConnection.generation)
          throw new Error("The target connection changed before completion was displayed.");
        setNotice(
          str(result.data.message, result.message || "Operation completed."),
        );
        return result;
      } catch (reason) {
        if (revision === selectionRevision.current && authoritativeState.current.serverId === expectedServerId) setNotice(operationText(reason));
        throw reason;
      }
    },
    [can, credential?.serverId, state.ready, state.server.serverName, cancelConfirmation],
  );

  const forget = async () => {
    if (!leaveEditor()) return;
    const revision = ++selectionRevision.current;
    cancelConfirmation();
    setCredential(null); setNotice(""); setError("");
    await logoutDashboard(credential?.serverId);
    if (revision !== selectionRevision.current) return;
    setCredential(null);
    setSessionGrant(null);
    const empty = emptyControlState("");
    authoritativeState.current = empty;
    setState(empty);
    setPhase("unpaired");
    const remaining = await listRelayCredentials();
    if (revision === selectionRevision.current) setCredentials(remaining);
  };
  const refreshCurrent = useCallback(() => {
    if (section === "Players") {
      if (!can("players.snapshot.request", "PAPER")) {
        setNotice(
          "A fresh player snapshot requires a connected Paper agent, players.view scope, and local telemetry capability.",
        );
      } else {
        void run("players.snapshot.request", {}, "PAPER").catch(() => {});
      }
      return;
    }
    if (
      ["Overview", "Performance", "Console", "Chat", "Plugins"].includes(
        section,
      )
    ) {
      if (section === "Performance")
        setNotice(
          state.telemetryUpdatedAt
            ? `Latest pushed telemetry received at ${new Date(state.telemetryUpdatedAt).toLocaleTimeString()}.`
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
  }, [can, run, section, state.telemetryUpdatedAt, state.updatedAt]);
  const copyDiagnostics = useCallback(() => {
    void navigator.clipboard
      .writeText(diagnostics(state))
      .then(() => setNotice("Safe diagnostics copied."));
  }, [state]);
  const resetHistory = useCallback(() => {
    commitState((current) => ({ ...current, history: [] }), true);
  }, [commitState]);

  const switchServer = useCallback((nextId: string) => {
    if (!leaveEditor()) return;
    const next = credentials.find(item => item.serverId === nextId);
    if (!next || Date.parse(next.expiresAt) <= Date.now()) {
      setNotice("This server's saved grant expired. Pair it again to restore access.");
      return;
    }
    cancelConfirmation();
    setPaletteOpen(false); setSidebarOpen(false); setPairing(false);
    unsaved.current = false;
    setNotice(""); setError("");
    let nextSection: Section = "Overview";
    try {
      const savedSection = localStorage.getItem(`plexonpanel-section:${nextId}`);
      if (savedSection && savedSection !== "Fleet" && sections.includes(savedSection as Section)) nextSection = savedSection as Section;
    } catch {}
    setSection(nextSection);
    if (credential?.serverId === nextId && authoritativeState.current.serverId === nextId) return;
    const revision = ++selectionRevision.current;
    // Retire the old command channel synchronously, before browser storage can yield.
    bindLiveSocket(null); setSessionGrant(null);
    commitState(emptyControlState(nextId), true);
    setPhase("connecting"); setCredential(next);
    setReconnect(value => value + 1);
    void selectRelayCredential(nextId).catch(() => {
      if (revision === selectionRevision.current) setNotice("The workspace opened, but the selection could not be saved in browser storage.");
    });
  }, [credentials, credential?.serverId, cancelConfirmation, commitState, leaveEditor]);

  if (pairing || phase === "unpaired")
    return (
      <Pairing
        done={restore}
        servers={credentials}
        selectServer={switchServer}
        {...(credential || credentials.length ? { cancel: () => { setPairing(false); setSection("Fleet"); if (!credential) setPhase("connecting"); } } : {})}
        error={error}
      />
    );
  if (phase === "loading")
    return (
      <main className="ui-loading">
        <Brand />
        <p>Opening your browser workspace…</p>
      </main>
    );

  if (section === "Fleet") return <main className="paired-server-home">
    <header className="paired-server-brand"><Brand /><button className="ui-button" onClick={() => setPreferencesOpen(true)}><Icon name="settings" size={16} />Client settings</button></header>
    {error && <p className="ui-alert" role="alert">{error}</p>}
    <FleetOverview credentials={credentials} selected={state} connected={phase === "live"} phase={phase}
      labels={serverLabels} rememberName={rememberServerName} openServer={switchServer} pair={() => setPairing(true)} />
    {notice && <p className="ui-alert" role="status">{notice}</p>}
    <footer className="paired-server-footer">Your selection is remembered in this browser. Access is granted separately by each server.</footer>
    {preferencesOpen && <PreferencesDialog close={() => setPreferencesOpen(false)} />}
  </main>;

  const deviceGrant = reconcileDeviceGrant(sessionGrant, state.ready?.device);
  const props: ViewProps = {
    state,
    can,
    run,
    notice: setNotice,
    connected: phase === "live",
    setUnsaved,
    ...(deviceGrant ? { deviceGrant } : {}),
  };
  let view: React.ReactNode;
  switch (section) {
    case "Overview":
      view = <OverviewView {...props} />;
      break;
    case "Performance":
      view = <PerformanceView props={props} resetHistory={resetHistory} />;
      break;
    case "Players":
      view = <PlayersView {...props} />;
      break;
    case "Console":
      view = <ConsoleView {...props} />;
      break;
    case "Chat":
      view = <ChatView {...props} />;
      break;
    case "Plugins":
      view = <PluginsView {...props} />;
      break;
    case "Server":
      view = <ServerView {...props} />;
      break;
    case "Backups":
      view = <BackupsView {...props} />;
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
    case "Configuration":
      view = <ConfigurationView {...props} />;
      break;
  }

  const serverName = str(
    state.ready?.server.serverName ?? state.server.serverName,
    credential?.serverId
      ? serverLabels[credential.serverId] || `Server ${credential.serverId.slice(0, 8)}`
      : "Server unavailable",
  );
  const role = state.ready?.device.role ?? credential?.role ?? "Paired";
  const paper = phase === "live" && !state.cached && Boolean(state.ready?.agents.paper);
  const restartAvailable =
    can("server.restart", "HOST") &&
    lifecycleActionAllowed(
      "restart",
      normalizeServiceState(state.service.state, paper),
    );

  return (
    <div
      className={`control-room workspace-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}
    >
      <a className="workspace-skip-link" href="#server-workspace">Skip to workspace</a>
      <button
        className="workspace-mobile-menu"
        aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={sidebarOpen}
        aria-controls="control-room-navigation"
        onClick={() => setSidebarOpen((open) => !open)}
      >
        <Icon name="menu" />
      </button>
      {sidebarOpen && (
        <button
          className="workspace-sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        id="control-room-navigation"
        inert={mobileNavigation && !sidebarOpen}
        className={`workspace-sidebar ${sidebarOpen ? "mobile-open" : ""}`}
      >
        <div className="workspace-sidebar-head">
          <Brand compact={sidebarCollapsed} />
          <button
            className="workspace-collapse"
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
          <div className="workspace-server-identity">
            <span className={`ui-dot ${paper ? "online" : ""}`} />
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
        <nav className="workspace-nav" aria-label="Control room pages">
          {navGroups.map((group) => (
            <div className="workspace-nav-group" key={group.label}>
              {!sidebarCollapsed && (
                <span className="workspace-nav-label">{group.label}</span>
              )}
              {group.sections.map((name) => (
                <button
                  key={name}
                  className={section === name ? "active" : ""}
                  aria-label={name === "Fleet" ? "All servers" : name}
                  aria-current={section === name ? "page" : undefined}
                  title={sidebarCollapsed ? name : undefined}
                  onClick={() => navigate(name)}
                >
                  <Icon name={iconBySection[name]} />
                  {!sidebarCollapsed && <span>{name === "Fleet" ? "All servers" : name}</span>}
                  {name === "Console" &&
                    state.console.some((line) => line.level === "ERROR") && (
                      <i className="ui-nav-alert" />
                    )}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="workspace-sidebar-foot">
          {!sidebarCollapsed && (
            <>
              <Badge tone="cyan">{role}</Badge>
              <small>{state.ready?.device.name ?? credential?.name}</small>
              <button className="ui-text-button" onClick={() => navigate("Access")}>
                Manage access
              </button>
            </>
          )}
        </div>
      </aside>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <div className="workspace-topbar-server">
            <span className="workspace-kicker">CURRENT SERVER</span>
            {credentials.length > 0 ? (
              <label className="workspace-server-select">
                <span className="sr-only">Selected server</span>
                <Select aria-label="Selected server"
                  value={state.serverId || credential?.serverId}
                  onValueChange={(selectedValue) => switchServer(selectedValue)}
                >
                  {credentials.map((item) => (
                    <option key={item.serverId} value={item.serverId}>
                      {serverLabels[item.serverId] || `Server ${item.serverId.slice(0, 8)}`} · {item.role}
                    </option>
                  ))}
                </Select>
              </label>
            ) : (
              <strong>{serverName}</strong>
            )}
          </div>
          <ConnectionPills state={state} phase={phase} />
          <div className="workspace-topbar-actions">
            <button className="ui-button workspace-appearance" onClick={() => setPreferencesOpen(true)} title="Client settings"><Icon name="settings" size={16} /><span>Appearance</span></button>
            <button
              className="workspace-icon-button"
              title="Refresh current view"
              aria-label="Refresh current view"
              onClick={refreshCurrent}
            >
              <Icon name="refresh" />
            </button>
            <details className="workspace-quick-actions">
              <summary className="ui-button">
                <Icon name="bolt" size={16} /> Quick actions
              </summary>
              <div>
                {restartAvailable && (
                  <button onClick={() => void run("server.restart", {}, "HOST").catch(() => {})}>
                    Restart server
                  </button>
                )}
                <button onClick={() => navigate("Console")}>Open console</button>
                <button onClick={() => navigate("Players")}>Open players</button>
                <button onClick={copyDiagnostics}>Copy diagnostics</button>
                <button onClick={refreshCurrent}>Refresh current view</button>
              </div>
            </details>
            <button
              className="workspace-command-button"
              aria-label="Open command palette"
              onClick={() => setPaletteOpen(true)}
            >
              <Icon name="search" size={16} />
              <span>Command</span>
              <kbd>⌘K</kbd>
            </button>
            <button className="workspace-role-button" onClick={() => navigate("Access")}>
              <span>{role}</span>
              <Icon name="chevron" size={14} />
            </button>
          </div>
        </header>

        <div className="workspace-page-head">
          <div>
            <span>{serverName} / WORKSPACE</span>
            <h1>{section}</h1>
            <p className="workspace-page-description">{pageDescriptions[section]}</p>
          </div>
          <div className="workspace-page-meta">
            <TelemetryFreshness phase={phase} state={state} />
            <button className="ui-button" onClick={refreshCurrent}>
              <Icon name="refresh" size={15} /> Refresh
            </button>
          </div>
        </div>

        <ConnectionSummary state={state} phase={phase} retry={() => setReconnect(value => value + 1)} />
        {error && phase === "live" && (
          <p className="ui-alert" role="alert">
            {error}
          </p>
        )}

        <main
          id="server-workspace"
          tabIndex={-1}
          className="workspace-content"
          key={`${credential?.serverId}-${section}-${refreshRevision}`}
        >
          {view}
        </main>
        <footer className="workspace-footer">
          <span>Local authority · Signed protocol 3</span>
          <span>{DASHBOARD_LABEL}</span>
        </footer>
      </div>

      {notice && (
        <div className="ui-toast workspace-toast" role="status" aria-live="polite">
          <span>{notice}</span>
          <button aria-label="Dismiss notification" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
      {confirmation && <Confirm value={confirmation} />}
      {preferencesOpen && <PreferencesDialog close={() => setPreferencesOpen(false)} />}
      <CommandPalette
        open={paletteOpen}
        close={() => setPaletteOpen(false)}
        navigate={navigate}
        run={run}
        restartAvailable={restartAvailable}
        refresh={refreshCurrent}
        copyDiagnostics={copyDiagnostics}
      />
    </div>
  );
}

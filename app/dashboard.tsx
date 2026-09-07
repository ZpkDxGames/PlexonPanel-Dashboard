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
  emptyControlState,
  record,
  str,
  type ControlState,
  type JsonMap,
} from "../lib/control-state";
import { canAction, HIGH_RISK } from "../lib/scopes";
import {
  Badge,
  ChatView,
  ConsoleView,
  Empty,
  OverviewView,
  PerformanceView,
  PlayersView,
  PluginsView,
  type ViewProps,
} from "./control-views";
const FilesView = dynamic(
  () => import("./advanced-views").then((m) => m.FilesView),
  { loading: () => <Empty title="Opening files…" /> },
);
const BackupsView = dynamic(() =>
  import("./advanced-views").then((m) => m.BackupsView),
);
const ServerView = dynamic(() =>
  import("./advanced-views").then((m) => m.ServerView),
);
const AuditView = dynamic(() =>
  import("./advanced-views").then((m) => m.AuditView),
);
const AccessView = dynamic(() =>
  import("./advanced-views").then((m) => m.AccessView),
);
const SettingsView = dynamic(() =>
  import("./advanced-views").then((m) => m.SettingsView),
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
function Brand() {
  return (
    <div className="cr-brand">
      <span>P</span>
      <strong>
        Plexon<span>Panel</span>
      </strong>
      <small>2.2.0</small>
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
  const [code, setCode] = useState(""),
    [name, setName] = useState("My browser"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(initialError ?? "");
  return (
    <main className="cr-pair-screen">
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
            onSubmit={(e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              void pairDashboardServer(code, name)
                .then(() => {
                  setCode("");
                  return done();
                })
                .catch((e) => {
                  setError(e instanceof Error ? e.message : "Pairing failed");
                  setBusy(false);
                });
            }}
          >
            <label>
              Device name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
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
              {busy ? "Waiting for local approval…" : "Open control room →"}
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
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      className="cr-confirm"
      ref={dialog}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        value.resolve(false);
      }}
    >
      <Badge tone="amber">Confirm operation</Badge>
      <h2 id="confirm-title">{value.action.replaceAll(".", " ")}</h2>
      <p>
        This operation will run on your server using this device&apos;s local
        permissions.
      </p>
      {Boolean(
        value.parameters.path ||
          value.parameters.playerId ||
          value.parameters.deviceId ||
          value.parameters.backupId,
      ) && (
        <code className="cr-confirm-target">
          {String(
            value.parameters.path ??
              value.parameters.playerId ??
              value.parameters.deviceId ??
              value.parameters.backupId,
          )}
        </code>
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
export default function Dashboard() {
  const [credential, setCredential] = useState<RelayCredential | null>(null),
    [credentials, setCredentials] = useState<RelayCredential[]>([]),
    [state, setState] = useState<ControlState>(() => emptyControlState("")),
    [phase, setPhase] = useState<Phase>("loading"),
    [section, setSection] = useState<Section>("Overview"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [pairing, setPairing] = useState(false),
    [reconnect, setReconnect] = useState(0),
    [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const unsaved = useRef(false);
  const setUnsaved = useCallback((dirty: boolean) => {
    unsaved.current = dirty;
  }, []);
  const leaveEditor = () =>
    !unsaved.current || window.confirm("Discard unsaved file edits?");
  const navigate = (next: Section) => {
    if (next !== section && leaveEditor()) setSection(next);
  };
  const restore = useCallback(async () => {
    try {
      const c = await loadRelayCredential();
      setCredentials(await listRelayCredentials());
      setCredential(c);
      setState(
        c
          ? ((await loadControlCache(c.serverId)) ??
              emptyControlState(c.serverId))
          : emptyControlState(""),
      );
      setPairing(false);
      setPhase(c ? "connecting" : "unpaired");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Browser storage is unavailable",
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
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!credential || !state.updatedAt) return;
    const timer = setTimeout(() => {
      void saveControlCache(state).catch(() => {});
    }, 1000);
    return () => clearTimeout(timer);
  }, [state, credential]);
  useEffect(() => {
    if (!credential) return;
    let stopped = false,
      attempt = 0,
      socket: WebSocket | null = null,
      retry: ReturnType<typeof setTimeout> | undefined,
      heartbeat: ReturnType<typeof setInterval> | undefined;
    document.documentElement.dataset.plexonDensity =
      localStorage.getItem("plexonpanel-density") ?? "comfortable";
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
          }, 20000);
        };
        socket.onmessage = (event) => {
          if (
            stopped ||
            typeof event.data !== "string" ||
            event.data.length > 131072
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
                "Protocol mismatch. Upgrade the relay and agents to protocol 3.",
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
      } catch (e) {
        if (stopped) return;
        if (e instanceof DashboardRequestError && e.status === 401) {
          setError(e.message);
          await clearBrowserWorkspace();
          setCredential(null);
          setState(emptyControlState(""));
          setPhase("unpaired");
          return;
        }
        setError(e instanceof Error ? e.message : "Relay unavailable");
        schedule();
      }
    };
    const schedule = () => {
      if (stopped) return;
      attempt++;
      setPhase("reconnecting");
      retry = setTimeout(
        () => void connect(),
        Math.min(30000, 1000 * 2 ** Math.min(attempt, 5)) *
          (0.8 + Math.random() * 0.4),
      );
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
        (kind === "HOST" ? ready.agents.host : ready.agents.paper) &&
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
        const e = new Error(
          "This action is unavailable for the current device or local policy.",
        );
        setNotice(e.message);
        throw e;
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
        setNotice(str(result.data.message, result.message));
        return result;
      } catch (e) {
        setNotice(e instanceof Error ? e.message : "Operation failed");
        throw e;
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
      view = <OverviewView {...props} />;
      break;
    case "Performance":
      view = <PerformanceView {...props} />;
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
    case "Files":
      view = <FilesView {...props} />;
      break;
    case "Backups":
      view = <BackupsView {...props} />;
      break;
    case "Server":
      view = <ServerView {...props} />;
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
        <SettingsView {...props} reconnect={() => setReconnect((n) => n + 1)} />
      );
  }
  return (
    <div className="control-room">
      <aside className="cr-sidebar">
        <Brand />
        <div className="cr-workspace-label">SERVER WORKSPACE</div>
        {credentials.length > 1 ? (
          <label className="cr-server-select">
            Selected server
            <select
              value={credential?.serverId}
              onChange={(e) => {
                if (!leaveEditor()) return;
                setSection("Overview");
                void selectRelayCredential(e.target.value)
                  .then(restore)
                  .catch((e) => setNotice(e.message));
              }}
            >
              {credentials.map((c) => (
                <option key={c.serverId} value={c.serverId}>
                  {c.serverId.slice(0, 8)} · {c.role}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="cr-server-card">
            <span
              className={`cr-dot ${state.ready?.agents.paper ? "online" : ""}`}
            />
            <div>
              <strong>{str(state.server.serverName, "Plexon server")}</strong>
              <small>
                Paper {state.ready?.server.minecraftVersion ?? "26.2"}
              </small>
            </div>
          </div>
        )}
        <nav className="cr-nav" aria-label="Control room pages">
          {sections.map((name, i) => (
            <button
              key={name}
              className={section === name ? "active" : ""}
              aria-current={section === name ? "page" : undefined}
              onClick={() => navigate(name)}
            >
              <span className="cr-nav-symbol" aria-hidden>
                {
                  [
                    "◫",
                    "⌁",
                    "♙",
                    "›_",
                    "◌",
                    "◇",
                    "▱",
                    "▤",
                    "◉",
                    "≡",
                    "⌘",
                    "⚙",
                  ][i]
                }
              </span>
              {name}
              {name === "Console" &&
                state.console.some((l) => l.level === "ERROR") && (
                  <i className="cr-nav-alert" />
                )}
            </button>
          ))}
        </nav>
        <div className="cr-sidebar-foot">
          <Badge tone="cyan">
            {state.ready?.device.role ?? credential?.role ?? "Paired"}
          </Badge>
          <small>{state.ready?.device.name ?? credential?.name}</small>
          <button className="cr-text-button" onClick={() => navigate("Access")}>
            Manage access →
          </button>
        </div>
      </aside>
      <div className="cr-main">
        <header className="cr-header">
          <div>
            <small>CONTROL ROOM / {section.toUpperCase()}</small>
            <h1>{section}</h1>
          </div>
          <div className="cr-header-status">
            <Badge tone={phase === "live" ? "green" : "amber"}>
              {phase === "live"
                ? "Relay connected"
                : phase === "connecting"
                  ? "Connecting"
                  : "Reconnecting"}
            </Badge>
            <span className="cr-device">
              {state.ready?.device.name ?? credential?.name ?? "Browser"}
            </span>
          </div>
        </header>
        {phase !== "live" ? (
          <div className="cr-banner amber">
            {error || "Connecting to the relay…"}
            {state.cached &&
              " Showing a bounded browser cache; actions are disabled."}
            <button onClick={() => setReconnect((n) => n + 1)}>
              Retry now
            </button>
          </div>
        ) : (
          !state.ready?.agents.paper && (
            <div className="cr-banner">
              {state.ready?.agents.host
                ? "Paper is offline. The host companion is connected."
                : "The relay is reachable. Waiting for an authenticated Paper or host agent."}
            </div>
          )
        )}
        {error && phase === "live" && <p className="cr-alert">{error}</p>}
        <main className="cr-content" key={`${credential?.serverId}-${section}`}>
          {view}
        </main>
        <footer className="cr-footer">
          <span>Local authority · Signed protocol 3</span>
          <span>PlexonPanel Dashboard 2.2.0</span>
        </footer>
      </div>
      {notice && (
        <div className="cr-toast" role="status">
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
      {confirmation && <Confirm value={confirmation} />}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { bindLiveSocket, DashboardRequestError, LIVE_CONNECTION_TIMEOUT_MS, handleRelayControlMessage, logoutDashboard, requestLiveConnection, unbindLiveSocket } from "../lib/data-source";
import { clearBrowserWorkspace, listRelayCredentials, loadControlCache, loadRelayCredential, loadServerLabels, saveServerLabel, saveControlCache, selectRelayCredential, type RelayCredential } from "../lib/browser-store";
import { applyControlMessage, diagnostics, emptyControlState, record, str, type ControlState } from "../lib/control-state";
import { DASHBOARD_LABEL } from "../lib/dashboard-version";
import { isImmediateControlMessage } from "../lib/display-cadence";
import { reconcileDeviceGrant, type DeviceGrantLike } from "../lib/device-grant";
import { ACTION_CONTRACT_ID } from "../lib/scopes";
import { sections, type Section } from "../lib/workspace-navigation";
import { useUiPreferences } from "../components/ui-preferences-provider";
import { useSignedOperations, type Phase } from "./use-signed-operations";
import { useDirtyLeaveGuard } from "./use-dirty-leave";
import { useSessionActivity } from "./use-session-activity";

type StateUpdater = ControlState | ((current: ControlState) => ControlState);

/** One owner for selected instance, display cadence and signed session lifecycle. */
export function useDashboardSession() {
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
  const selectionRevision = useRef(0);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileNavigation, setMobileNavigation] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const { activity, observeActivity, clearActivity } = useSessionActivity();
  const { setUnsaved, leaveEditor, clearUnsaved } = useDirtyLeaveGuard();
  const authoritativeState = useRef<ControlState>(state);
  const displayTimer = useRef<number | null>(null);
  const displayDirty = useRef(false);
  const displayRateRef = useRef(preferences.displayUpdateRateMs);
  const { confirmation, cancelConfirmation, can, run } = useSignedOperations({ credential, sessionGrant, state, phase, selectionRevision, authoritativeState, setNotice, observeActivity });
  const activityServerId = credential?.serverId;
  const activityPaper = phase === "live" ? state.ready?.agents.paper ?? null : null;
  const activityHost = phase === "live" ? state.ready?.agents.host ?? null : null;
  useEffect(() => {
    if (!activityServerId || !["connecting", "live", "reconnecting"].includes(phase)) return;
    let current = true;
    queueMicrotask(() => { if (current) observeActivity({ kind: "connection", serverId: activityServerId, relay: phase as "connecting" | "live" | "reconnecting", paper: activityPaper, host: activityHost }); });
    return () => { current = false; };
  }, [activityServerId, phase, activityPaper, activityHost, observeActivity]);

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
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setMobileNavigation(media.matches);
    queueMicrotask(update);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  // The shell's native dialog owns drawer focus trapping and restoration.

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

  const clearLocalChatCache = useCallback(async()=>{
    const next={...authoritativeState.current,chat:[]};
    commitState(next,true);await saveControlCache(next);
    setNotice('Local chat cache cleared. Incoming messages can fill it again.');
  },[commitState]);
  const clearLocalCache = useCallback(async()=>{
    const current=authoritativeState.current;
    const next={...emptyControlState(current.serverId),ready:current.ready,paperConnectedAt:Date.now()};
    commitState(next,true);await saveControlCache(next);
    setNotice('Local cache cleared for this server. Incoming streams can fill it again.');
  },[commitState]);

  const switchServer = useCallback((nextId: string) => {
    if (!leaveEditor()) return;
    const next = credentials.find(item => item.serverId === nextId);
    if (!next || Date.parse(next.expiresAt) <= Date.now()) {
      setNotice("This server's saved grant expired. Pair it again to restore access.");
      return;
    }
    cancelConfirmation();
    setPaletteOpen(false); setSidebarOpen(false); setPairing(false);
    clearUnsaved();
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
  }, [credentials, credential?.serverId, cancelConfirmation, commitState, leaveEditor, clearUnsaved]);

  return { credential, credentials, sessionGrant, state, phase, setPhase, section, setSection, navigate, serverLabels, rememberServerName, error, notice, setNotice, pairing, setPairing, confirmation, refreshRevision, sidebarOpen, setSidebarOpen, mobileNavigation, sidebarCollapsed, setSidebarCollapsed, paletteOpen, setPaletteOpen, preferencesOpen, setPreferencesOpen, restore, forget, refreshCurrent, copyDiagnostics, resetHistory, clearLocalChatCache, clearLocalCache, switchServer, can, run, setUnsaved, setReconnect, activity, observeActivity, clearActivity };
}
export type DashboardModel = ReturnType<typeof useDashboardSession>;

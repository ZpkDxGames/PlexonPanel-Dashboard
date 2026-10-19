"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  useRef,
} from "react";
import {
  session,
  type Kind,
  type SessionSnapshot,
} from "../../adapter/session";
import { reconcileDeviceGrant } from "../../adapter/device-grant";
import {
  preferences,
  applyPreferencesToDocument,
  type Preferences,
} from "../../store/preferences";
import {
  record,
  number,
  type JsonMap,
  type Sample,
  type ControlState,
} from "../../adapter/control-state";
import {
  historyFor,
  sourceEvidence,
  type Source,
} from "../../presentation/telemetry";
import { SourceEpochs } from "../../presentation/epochs";
import { useNow } from "../../hooks";
export * from "./pure";
export { session, useNow };
export type { Kind, SessionSnapshot, Preferences };
export type { Prepared } from "../../adapter/session";
export type Tone = "emerald" | "cyan" | "violet" | "indigo" | "amber" | "rose";
export type Phase = "online" | "offline" | "starting" | "stopping" | "unknown";
export function scopedSnapshot(raw: SessionSnapshot): SessionSnapshot {
  const grant = reconcileDeviceGrant(raw.grant, raw.state.ready?.device);
  const can = (s: string) =>
    Boolean(grant?.metadataMatches && grant.scopes.includes(s));
  const s = raw.state,
    telemetry = can("telemetry.view"),
    players = can("players.view");
  return {
    ...raw,
    state: {
      ...s,
      server: telemetry || can("overview.view") ? s.server : {},
      system: telemetry ? s.system : {},
      hostSystem: telemetry ? s.hostSystem : {},
      history: telemetry ? s.history : [],
      worlds: telemetry ? s.worlds : [],
      service:
        telemetry || can("server.status")
          ? s.service
          : { invocationId: s.service.invocationId },
      players: players
        ? s.players.map((p) => ({
            ...p,
            ...(!can("players.location")
              ? {
                  position: undefined,
                  x: undefined,
                  y: undefined,
                  z: undefined,
                }
              : {}),
            ...(!can("players.address") ? { address: undefined } : {}),
          }))
        : [],
      inventoryIds: players
        ? s.inventoryIds
        : { ...s.inventoryIds, players: undefined },
      pendingPlayerSnapshot: undefined,
      presenceDeltas: can("players.history.view") ? s.presenceDeltas : [],
      plugins: can("plugins.view") ? s.plugins : [],
      console: can("console.view.full")
        ? s.console
        : can("console.view.errors")
          ? s.console.filter((l) =>
              ["WARN", "ERROR", "FATAL"].includes(String(l.level)),
            )
          : [],
      chat: can("chat.view") ? s.chat : [],
      backupProgress:
        can("backup.view") || can("maintenance.view") ? s.backupProgress : null,
      maintenancePhase: can("maintenance.view")
        ? s.maintenancePhase
        : undefined,
    },
  };
}
export function useControl() {
  const raw = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  return useMemo(() => scopedSnapshot(raw), [raw]);
}
export function usePrefs() {
  const p = useSyncExternalStore(
    preferences.subscribe,
    preferences.getSnapshot,
    preferences.getSnapshot,
  );
  return {
    ...p,
    set: <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
      preferences.update({ [key]: value }),
  };
}
export const usePreferences = usePrefs;
export function PreferencesBridge() {
  const p = usePrefs();
  useEffect(() => {
    const apply = () => applyPreferencesToDocument(preferences.getSnapshot());
    apply();
    const q = matchMedia("(prefers-color-scheme: light)");
    q.addEventListener("change", apply);
    return () => q.removeEventListener("change", apply);
  }, [p.theme, p.accent, p.density, p.textSize, p.motion, p.chartFill]);
  return null;
}
export function useEvidence(source: Source) {
  const { state } = useControl();
  return sourceEvidence(state, source, useNow());
}
export type LedgerEntry = {
  state: "live" | "stale" | "offline";
  ageMs: number | null;
  kind: ReturnType<typeof sourceEvidence>["kind"];
};
export function sourceLedger(state: ControlState, now: number) {
  return Object.fromEntries(
    (["paperHealth", "paperSystem", "hostSystem", "service"] as Source[]).map(
      (source) => {
        const e = sourceEvidence(state, source, now);
        return [
          source,
          {
            state:
              e.kind === "live"
                ? "live"
                : e.kind === "disconnected"
                  ? "offline"
                  : "stale",
            ageMs: e.ageMs,
            kind: e.kind,
          },
        ];
      },
    ),
  ) as Record<Source, LedgerEntry>;
}
export function useSourceLedger() {
  const { state } = useControl();
  return sourceLedger(state, useNow());
}
export function useLedger() {
  const e = useSourceLedger();
  const worst = (a: LedgerEntry, b: LedgerEntry) => {
    const severity = {
      live: 0,
      delayed: 1,
      skew: 2,
      stale: 3,
      waiting: 4,
      disconnected: 5,
    };
    return severity[a.kind] >= severity[b.kind] ? a : b;
  };
  return {
    paper: worst(e.paperHealth, e.paperSystem),
    host: worst(e.hostSystem, e.service),
  };
}
export function serverState(
  s: ControlState,
  paperFresh: boolean,
  hostFresh: boolean,
): "online" | "starting" | "stopping" | "stopped" | "unknown" {
  if (paperFresh) return "online";
  if (!hostFresh) return "unknown";
  const state = String(s.service.state);
  if (["inactive", "failed"].includes(state)) return "stopped";
  if (state === "activating") return "starting";
  if (state === "deactivating") return "stopping";
  if (state === "active")
    return s.service.minecraftReady === true ? "online" : "starting";
  return "unknown";
}
export function useActiveServer() {
  const snap = useControl(),
    p = useEvidence("paperHealth"),
    h = useEvidence("service");
  const phase = serverState(snap.state, p.usable, h.usable);
  return {
    id: snap.state.serverId,
    name: String(
      snap.state.ready?.server.serverName ??
        snap.labels[snap.state.serverId] ??
        "Select instance",
    ),
    version: String(snap.state.ready?.server.minecraftVersion ?? "—"),
    phase: (phase === "stopped" ? "offline" : phase) as Phase,
    uptimeMs: number(snap.state.system.processUptimeMillis),
    epochId: String(
      snap.state.service.invocationId ??
        snap.state.ready?.server.paperSession ??
        "",
    ),
  };
}
export function useServers() {
  const s = useControl(),
    active = useActiveServer();
  return [
    { ...active, state: s.state, selected: true },
    ...s.fleet
      .filter((f) => f.state.serverId !== active.id)
      .map((f) => ({
        id: f.state.serverId,
        name: String(
          f.state.ready?.server.serverName ??
            s.labels[f.state.serverId] ??
            f.state.serverId,
        ),
        phase: f.phase,
        state: f.state,
        selected: false,
      })),
    ...s.credentials
      .filter(
        (c) =>
          c.serverId !== active.id &&
          !s.fleet.some((f) => f.state.serverId === c.serverId),
      )
      .map((c) => ({
        id: c.serverId,
        name: s.labels[c.serverId] ?? c.serverId,
        phase: "unknown",
        state: null,
        selected: false,
      })),
  ];
}
export function serviceMetrics(r: JsonMap) {
  const ok = r.scope === "MINECRAFT_SERVICE" && r.source === "SYSTEMD_CGROUP";
  return {
    cpu:
      ok && r.cpuAvailable === true && r.cpuUnit === "PERCENT_OF_ONE_CORE"
        ? number(r.cpuPercent)
        : null,
    memory: ok && r.memoryAvailable === true ? number(r.memoryBytes) : null,
  };
}
export function observedSessionPeak(
  history: Sample[],
  rosterCount: number | null,
) {
  const epoch = history.at(-1)?.epoch;
  const values = history
    .filter((h) => !epoch || h.epoch === epoch)
    .map((h) => h.players)
    .filter((n): n is number => n != null);
  if (rosterCount != null) values.push(rosterCount);
  return values.length ? Math.max(...values) : null;
}
export function useRoster() {
  const { state: s } = useControl();
  return {
    players: s.players,
    online: number(s.server.onlinePlayers),
    capacity: number(s.server.maximumPlayers ?? s.server.maxPlayers),
    peak: observedSessionPeak(s.history, number(s.server.onlinePlayers)),
    events: s.presenceDeltas,
    worlds: s.worlds,
  };
}
export type Horizon = "1m" | "5m" | "15m" | "35m" | "2h";
export function useTelemetry(window: Horizon = "15m") {
  const { state: s, revision } = useControl(),
    now = useNow(),
    epochs = useRef(new SourceEpochs());
  epochs.current.update(s, revision);
  const since =
    now -
    { "1m": 60000, "5m": 300000, "15m": 900000, "35m": 2100000, "2h": 7200000 }[
      window
    ];
  const history = s.history;
  const scoped = (source: Source) =>
    historyFor(epochs.current.view(history, source), source, since);
  const projected = useMemo(
    () => ({
      paper: scoped("paperHealth"),
      system: scoped("paperSystem"),
      host: scoped("hostSystem"),
      service: scoped("service"),
    }),
    [
      history,
      revision,
      since,
      s.ready?.server.paperSession,
      s.ready?.server.hostSession,
      s.ready?.agents.paper,
      s.ready?.agents.host,
    ],
  );
  const res = serviceMetrics(record(s.service.resources));
  return {
    ...projected,
    raw: history.filter((p) => p.at >= since),
    now,
    since,
    tps: Array.isArray(s.server.tps) ? number(s.server.tps[0]) : null,
    mspt: number(s.server.averageTickMillis),
    p95: number(s.server.p95TickMillis),
    p99: number(s.server.p99TickMillis),
    gc: number(s.system.gcPauseTotalMillis),
    cpu: res.cpu,
    nodeCpu:
      s.hostSystem.metricScope === "NODE"
        ? number(s.hostSystem.hostCpuPercent)
        : null,
    cores:
      number(
        s.hostSystem.availableProcessors ?? s.hostSystem.logicalProcessors,
      ) ?? 1,
    heap: number(s.system.jvmHeapUsedBytes),
    committed: number(s.system.jvmHeapCommittedBytes),
    max: number(s.system.jvmHeapMaximumBytes),
    cgroup: res.memory,
  };
}
export type TelemetryView = ReturnType<typeof useTelemetry>;
export function useQuery(
  action: string,
  kind: Kind = "HOST",
  parameters: JsonMap = {},
  enabled = true,
) {
  const snap = useControl(),
    key = JSON.stringify(parameters),
    gate = session.reason(action, kind),
    identity = [
      snap.revision,
      snap.state.serverId,
      snap.state.ready?.server.paperSession,
      snap.state.ready?.server.hostSession,
      snap.state.ready?.device.scopes.join("|"),
      action,
      kind,
      key,
    ].join(":"),
    [result, setResult] = useState({
      identity: "",
      data: {} as JsonMap,
      error: "",
      loading: true,
    }),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false,
      busy = false;
    setResult({ identity, data: {}, error: gate, loading: enabled && !gate });
    if (!enabled || gate) return;
    async function read() {
      if (busy) return;
      busy = true;
      try {
        const r = await session.query(action, JSON.parse(key), kind);
        if (!cancelled)
          setResult({
            identity,
            data: record(r.data),
            error: "",
            loading: false,
          });
      } catch (e) {
        if (!cancelled)
          setResult({
            identity,
            data: {},
            error: (e as Error).message,
            loading: false,
          });
      } finally {
        busy = false;
      }
    }
    void read();
    const t = setInterval(read, 15000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [identity, gate, enabled, retry, action, kind, key]);
  return {
    ...(gate
      ? { data: {} as JsonMap, error: gate, loading: false }
      : result.identity === identity
        ? result
        : { data: {} as JsonMap, error: "", loading: true }),
    retry: () => setRetry((v) => v + 1),
  };
}
export const fmt = (n: unknown, digits = 1) =>
  typeof n === "number" && Number.isFinite(n)
    ? n.toLocaleString("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    : "—";
export const gib = (n: unknown) =>
  typeof n === "number" ? `${fmt(n / 2 ** 30)} GiB` : "—";
export const duration = (n: unknown) =>
  typeof n === "number"
    ? `${Math.floor(n / 3600000)}h ${Math.floor(n / 60000) % 60}m`
    : "—";
export const time = (
  n: string | number,
  zone: Preferences["timezone"],
  seconds = true,
) => {
  const d = new Date(n);
  return Number.isFinite(+d)
    ? d.toLocaleTimeString("en-GB", {
        ...(zone === "UTC" ? { timeZone: "UTC" } : {}),
        hour: "2-digit",
        minute: "2-digit",
        ...(seconds ? { second: "2-digit" } : {}),
      })
    : "—";
};

export type MutationDispatch = (
  action: string,
  args?: JsonMap,
  kind?: Kind,
) => Promise<void>;
export const MutationContext = createContext<MutationDispatch>(async () => {});
export function useMutation(action: string, kind: Kind) {
  useControl();
  const dispatch = useContext(MutationContext);
  const reason = session.reason(action, kind);
  return {
    reason: reason || null,
    begin: (args: JsonMap = {}) => dispatch(action, args, kind),
  };
}

export const date = (value: string | number, zone: Preferences["timezone"]) => {
  const d = new Date(value);
  return Number.isFinite(+d)
    ? d.toLocaleDateString("en-CA", zone === "UTC" ? { timeZone: "UTC" } : {})
    : "—";
};

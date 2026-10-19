import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  session,
  type Kind,
  type SessionSnapshot,
} from "../../adapter/session";
import { reconcileDeviceGrant } from "../../adapter/device-grant";
import { record, number, type JsonMap } from "../../adapter/control-state";
import {
  sourceEvidence,
  historyFor,
  type Source,
} from "../../presentation/telemetry";
import { useNow } from "../../hooks";
export { session, useNow };
export function scopedSnapshot(raw: SessionSnapshot): SessionSnapshot {
  const access = reconcileDeviceGrant(raw.grant, raw.state.ready?.device),
    can = (s: string) =>
      Boolean(access?.metadataMatches && access.scopes.includes(s)),
    s = raw.state,
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
  const raw = useSyncExternalStore(session.subscribe, session.getSnapshot);
  return useMemo(() => scopedSnapshot(raw), [raw]);
}
export function useSource(source: Source) {
  const { state } = useControl();
  return sourceEvidence(state, source, useNow());
}
export function useBand(source: Source): "live" | "delayed" | "stale" {
  const e = useSource(source);
  return e.kind === "live"
    ? "live"
    : e.kind === "delayed"
      ? "delayed"
      : "stale";
}
export const fmt1 = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v.toFixed(1) : "—";
export const fmtGiB = (v: unknown) =>
  typeof v === "number" ? `${(v / 2 ** 30).toFixed(1)} GiB` : "—";
export const duration = (v: unknown) =>
  typeof v === "number"
    ? `${Math.floor(v / 3600000)}h ${Math.floor(v / 60000) % 60}m`
    : "Not reported";
export function useTelemetry() {
  const { state: s } = useControl(),
    band = useBand("paperHealth"),
    recent = historyFor(s.history, "paperHealth").map((s) => s.mspt),
    finite = recent.filter((v): v is number => v != null);
  return {
    tps: {
      latest: Array.isArray(s.server.tps) ? number(s.server.tps[0]) : null,
      band,
    },
    mspt: {
      latest: number(s.server.averageTickMillis),
      recent,
      mean: finite.length
        ? finite.reduce((a, b) => a + b, 0) / finite.length
        : null,
    },
    msptP95: { latest: number(s.server.p95TickMillis) },
    msptP99: { latest: number(s.server.p99TickMillis) },
  };
}
export function observedSessionPeak(
  history: import("../../adapter/control-state").Sample[],
  rosterCount: number | null,
) {
  const epoch = history.at(-1)?.epoch,
    values = history
      .filter((h) => !epoch || h.epoch === epoch)
      .map((h) => h.players)
      .filter((n): n is number => n != null);
  if (rosterCount != null) values.push(rosterCount);
  return values.length ? Math.max(...values) : null;
}
export function usePlayers() {
  const { state: s } = useControl();
  return {
    online: s.players.map((p): JsonMap & { uuid: string; name: string } => ({
      ...p,
      uuid: String(p.uuid),
      name: String(p.name),
    })),
    count: number(s.server.onlinePlayers),
    capacity: number(s.server.maximumPlayers ?? s.server.maxPlayers),
    sessionPeak: observedSessionPeak(
      s.history,
      number(s.server.onlinePlayers) ??
        (s.inventoryIds?.players || s.players.length ? s.players.length : null),
    ),
    band: useBand("paperHealth"),
  };
}
export function serviceMetrics(resources: JsonMap) {
  const authoritative =
    resources.scope === "MINECRAFT_SERVICE" &&
    resources.source === "SYSTEMD_CGROUP";
  return {
    cpu:
      authoritative &&
      resources.cpuAvailable === true &&
      resources.cpuUnit === "PERCENT_OF_ONE_CORE"
        ? number(resources.cpuPercent)
        : null,
    memory:
      authoritative && resources.memoryAvailable === true
        ? number(resources.memoryBytes)
        : null,
  };
}
export function useCompute() {
  const { state: s } = useControl();
  return {
    service: serviceMetrics(record(s.service.resources)).cpu,
    node:
      s.hostSystem.metricScope === "NODE"
        ? number(s.hostSystem.hostCpuPercent)
        : null,
    band: useBand("service"),
    nodeBand: useBand("hostSystem"),
  };
}
export function useMemoryTiers() {
  const { state: s } = useControl();
  return {
    heapUsed: number(s.system.jvmHeapUsedBytes),
    heapCommitted: number(s.system.jvmHeapCommittedBytes),
    heapMax: number(s.system.jvmHeapMaximumBytes),
    cgroup: serviceMetrics(record(s.service.resources)).memory,
    band: useBand("paperSystem"),
    cgroupBand: useBand("service"),
  };
}
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
      action,
      kind,
      key,
      snap.revision,
      snap.state.serverId,
      snap.state.ready?.server.paperSession,
      snap.state.ready?.server.hostSession,
      snap.state.service.invocationId,
      snap.state.ready?.device.role,
      snap.state.ready?.device.scopes.join("|"),
    ].join(":"),
    [result, set] = useState({
      identity: "",
      data: {} as JsonMap,
      error: "",
      loading: true,
    }),
    [retry, again] = useState(0);
  useEffect(() => {
    let cancelled = false,
      busy = false;
    set({ identity, data: {}, error: gate, loading: enabled && !gate });
    if (!enabled || gate) return;
    async function read() {
      if (busy) return;
      busy = true;
      try {
        const r = await session.query(action, JSON.parse(key), kind);
        if (!cancelled)
          set({ identity, data: record(r.data), error: "", loading: false });
      } catch (e) {
        if (!cancelled)
          set({
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
    const timer = setInterval(read, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [identity, gate, enabled, retry, action, kind, key]);
  return {
    ...(gate
      ? { data: {} as JsonMap, error: gate, loading: false }
      : result.identity === identity
        ? result
        : { data: {} as JsonMap, error: "", loading: true }),
    retry: () => again((n) => n + 1),
  };
}

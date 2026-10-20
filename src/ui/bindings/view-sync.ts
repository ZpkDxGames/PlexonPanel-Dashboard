"use client";
import { useSyncExternalStore } from "react";
import type { Horizon } from "./index";
export interface ViewSyncState {
  selectedPlayerUuid: string;
  horizon: Horizon;
  studioView: "tick" | "memory" | "cpu";
  activeSeries: string;
  studioMode: "focus" | "split";
  playerEventFilter: "all" | "presence" | "advancement" | "death" | "command";
  dockFeed: "console" | "events";
  dockLevel: "All" | "Info" | "Warn" | "Error";
  idePane: "console" | "chat" | "plugins";
  ideLevel: "All" | "Info" | "Warn" | "Error";
  ideWrap: boolean;
  ideRegex: boolean;
  idePlugin: string;
  rosterScope: "online" | "all";
  backupCountdownMinutes: 5 | 10 | 15 | 30;
}
export const VIEW_SYNC_KEY = "plexon:view-sync";
export const DEFAULT_VIEW: Readonly<ViewSyncState> = Object.freeze({
  selectedPlayerUuid: "",
  horizon: "15m",
  studioView: "tick",
  activeSeries: "tps",
  studioMode: "focus",
  playerEventFilter: "all",
  dockFeed: "console",
  dockLevel: "All",
  idePane: "console",
  ideLevel: "All",
  ideWrap: true,
  ideRegex: false,
  idePlugin: "",
  rosterScope: "online",
  backupCountdownMinutes: 5,
});
const choices: Partial<Record<keyof ViewSyncState, readonly unknown[]>> = {
  studioMode: ["focus", "split"],
  playerEventFilter: ["all", "presence", "advancement", "death", "command"],
  horizon: ["1m", "5m", "15m", "35m", "2h"],
  studioView: ["tick", "memory", "cpu"],
  activeSeries: [
    "mean",
    "heapUsed",
    "svcCpu",
    "nodeCpu",
    "tps",
    "mspt",
    "p95",
    "p99",
    "gc",
    "heap",
    "committed",
    "cgroup",
    "max",
    "cpu",
    "node",
    "chunks",
    "entities",
    "peak",
  ],
  dockFeed: ["console", "events"],
  dockLevel: ["All", "Info", "Warn", "Error"],
  idePane: ["console", "chat", "plugins"],
  ideLevel: ["All", "Info", "Warn", "Error"],
  rosterScope: ["online", "all"],
  backupCountdownMinutes: [5, 10, 15, 30],
};
/** Whitelist display choices; never accept content, history, or unknown properties. */
export function validateViewSync(value: unknown): ViewSyncState {
  const result = { ...DEFAULT_VIEW };
  if (!value || typeof value !== "object" || Array.isArray(value))
    return result;
  const input = value as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_VIEW) as (keyof ViewSyncState)[]) {
    const v = input[key];
    if (
      choices[key]?.includes(v) ||
      ((key === "ideWrap" || key === "ideRegex") && typeof v === "boolean") ||
      (key === "selectedPlayerUuid" &&
        typeof v === "string" &&
        v.length <= 64 &&
        (v === "" ||
          /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32}|name:[a-z0-9_]{1,16})$/i.test(
            v,
          ))) ||
      (key === "idePlugin" &&
        typeof v === "string" &&
        v.length <= 128 &&
        !/[\x00-\x1f]/.test(v))
    ) {
      Object.assign(result, { [key]: v });
    }
  }
  return result;
}
let state: ViewSyncState = { ...DEFAULT_VIEW };
const listeners = new Set<() => void>();
function publish(next: ViewSyncState) {
  if (JSON.stringify(next) === JSON.stringify(state)) return;
  state = next;
  listeners.forEach((fn) => fn());
}
function read() {
  try {
    publish(
      validateViewSync(
        JSON.parse(window.localStorage.getItem(VIEW_SYNC_KEY) ?? "null"),
      ),
    );
  } catch {
    publish({ ...DEFAULT_VIEW });
  }
}
function storage(e: StorageEvent) {
  if (
    (e.key === VIEW_SYNC_KEY || e.key === null) &&
    e.storageArea === window.localStorage
  )
    read();
}
export function subscribeViewSync(fn: () => void) {
  listeners.add(fn);
  if (listeners.size === 1) window.addEventListener("storage", storage);
  read();
  return () => {
    listeners.delete(fn);
    if (!listeners.size) window.removeEventListener("storage", storage);
  };
}
export function updateViewSync(patch: Partial<ViewSyncState>) {
  const next = validateViewSync({ ...state, ...patch });
  publish(next);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(VIEW_SYNC_KEY, JSON.stringify(next));
    } catch {
      /* Display choices still work when storage is unavailable. */
    }
  }
}
function set<K extends keyof ViewSyncState>(
  key: K,
  value: ViewSyncState[K] | ((previous: ViewSyncState[K]) => ViewSyncState[K]),
) {
  updateViewSync({
    [key]: typeof value === "function" ? value(state[key]) : value,
  });
}
export const getViewSyncSnapshot = () => state;
export function useViewSync() {
  const snapshot = useSyncExternalStore(
    subscribeViewSync,
    getViewSyncSnapshot,
    () => DEFAULT_VIEW,
  );
  return { ...snapshot, set, patch: updateViewSync };
}

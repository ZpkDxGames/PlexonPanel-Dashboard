import { useEffect, useSyncExternalStore } from "react";
import { session } from "./adapter/session";

export const useSession = () => useSyncExternalStore(session.subscribe, session.getSnapshot);

const listeners = new Set<() => void>();
let now = Date.now();
let interval: ReturnType<typeof setInterval> | undefined;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (!interval) interval = setInterval(() => {
    now = Date.now();
    listeners.forEach((entry) => entry());
  }, 1000);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && interval) {
      clearInterval(interval);
      interval = undefined;
    }
  };
};

export const useNow = () => useSyncExternalStore(subscribe, () => now);


/**
 * Roster snapshots carry the authoritative Paper pingMillis value. Protocol 3
 * rate-limits this action to one request per device per five seconds, so active
 * player-facing routes reconcile just above that boundary.
 */
export function usePlayerSnapshotRefresh() {
  const snap = useSession();
  useEffect(() => {
    if (
      snap.phase !== "live" ||
      !snap.state.ready?.agents.paper ||
      session.reason("players.snapshot.request", "PAPER")
    )
      return;

    let active = true;
    const refresh = () => {
      if (!active || document.visibilityState === "hidden") return;
      void session.query("players.snapshot.request", {}, "PAPER").catch(() => {
        /* Presence remains live even when a bounded reconciliation is skipped. */
      });
    };
    refresh();
    const timer = window.setInterval(refresh, 5_500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [
    snap.phase,
    snap.revision,
    snap.state.ready?.agents.paper,
    snap.state.ready?.server.paperSession,
  ]);
}

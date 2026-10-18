import { useSyncExternalStore } from "react";
import { session } from "./adapter/session";

export const useSession = () =>
  useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );

const listeners = new Set<() => void>();
let now = Date.now();
let interval: ReturnType<typeof setInterval> | undefined;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (!interval)
    interval = setInterval(() => {
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

export const useNow = () =>
  useSyncExternalStore(
    subscribe,
    () => now,
    () => 0,
  );

/** Keep static workspace chrome independent of 4 Hz telemetry publishes. */
export function useShellSession() {
  return useSyncExternalStore(
    session.subscribe,
    shellSnapshot,
    session.getServerSnapshot,
  );
}
let previousShell = session.getSnapshot();
function shellSnapshot() {
  const next = session.getSnapshot(),
    a = previousShell;
  if (
    next.phase !== a.phase ||
    next.revision !== a.revision ||
    next.initialized !== a.initialized ||
    next.fixture !== a.fixture ||
    next.error !== a.error ||
    next.credentials !== a.credentials ||
    next.labels !== a.labels ||
    next.relay !== a.relay ||
    next.state.ready !== a.state.ready ||
    next.state.serverId !== a.state.serverId ||
    next.state.bootEpochId !== a.state.bootEpochId ||
    next.state.bootStartedAt !== a.state.bootStartedAt
  )
    previousShell = next;
  return previousShell;
}

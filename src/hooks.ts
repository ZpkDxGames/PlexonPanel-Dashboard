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

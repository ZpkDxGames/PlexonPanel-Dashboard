"use client";
import { useSyncExternalStore } from "react";

let now = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();
const snapshot = () => now;
const serverSnapshot = () => Date.now();
function update() {
  if (document.visibilityState === "hidden") return;
  now = Date.now();
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    now = Date.now();
    timer = setInterval(update, 1000);
    document.addEventListener("visibilitychange", update);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearInterval(timer);
      timer = undefined;
      document.removeEventListener("visibilitychange", update);
    }
  };
}

/** A packet must never be judged against a clock older than its browser receipt. */
export function useTelemetryNow(receivedAt: number) {
  return Math.max(useSyncExternalStore(subscribe, snapshot, serverSnapshot), receivedAt);
}

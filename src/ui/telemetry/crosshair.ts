"use client";
import { useSyncExternalStore } from "react";
let current: number | null = null,
  pending: number | null | undefined,
  raf = 0;
const listeners = new Set<() => void>();
function flush() {
  raf = 0;
  const next = pending;
  pending = undefined;
  if (next !== undefined && next !== current) {
    current = next;
    listeners.forEach((fn) => fn());
  }
}
export const crosshair = {
  get: () => current,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  set(value: number | null) {
    pending = value;
    if (raf) return;
    if (typeof requestAnimationFrame === "undefined") {
      flush();
      return;
    }
    raf = requestAnimationFrame(flush);
  },
};
export const useCrosshair = () =>
  useSyncExternalStore(crosshair.subscribe, crosshair.get, () => null);

import { useSyncExternalStore } from "react";

export type Preferences = {
  theme: "dark" | "light" | "system";
  density: "comfortable" | "compact";
  reduceMotion: boolean;
  timezone: "browser" | "UTC";
  skinProvider: "proxy" | "crafatar" | "mc-heads" | "minotar" | "disabled";
};

const defaults: Preferences = { theme: "system", density: "comfortable", reduceMotion: false, timezone: "browser", skinProvider: "crafatar" };
let value = read();
const listeners = new Set<() => void>();

function read(): Preferences {
  try {
    const raw = JSON.parse(localStorage.getItem("plexon:preferences") ?? "{}") as Partial<Preferences>;
    return { ...defaults, ...raw };
  } catch { return defaults; }
}

export const preferences = {
  getSnapshot: () => value,
  subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
  update(patch: Partial<Preferences>) {
    value = { ...value, ...patch };
    try { localStorage.setItem("plexon:preferences", JSON.stringify(value)); } catch { /* Preference persistence is optional. */ }
    listeners.forEach((listener) => listener());
  },
};

export const usePreferences = () => useSyncExternalStore(preferences.subscribe, preferences.getSnapshot);

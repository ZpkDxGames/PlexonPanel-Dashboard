import { useSyncExternalStore } from "react";

export type Preferences = {
  theme: "dark" | "light" | "system";
  density: "comfortable" | "compact";
  reduceMotion: boolean;
  timezone: "browser" | "UTC";
  telemetryInterval: 50 | 100 | 250 | 500 | 1000;
  chartStyle: "area" | "line";
  chartCurve: "smooth" | "straight" | "step";
  chartDensity: "rich" | "compact";
  accent: "indigo" | "teal" | "sky" | "rose";
  serverIcons: Record<string, string>;
  skinProvider:
    | "auto"
    | "proxy"
    | "crafatar"
    | "mc-heads"
    | "minotar"
    | "disabled";
};

const defaults: Preferences = {
  theme: "system",
  density: "comfortable",
  reduceMotion: false,
  timezone: "browser",
  skinProvider: "auto",
  telemetryInterval: 100,
  chartStyle: "area",
  chartCurve: "smooth",
  chartDensity: "rich",
  accent: "indigo",
  serverIcons: {},
};
let value = read();
const listeners = new Set<() => void>();

function read(): Preferences {
  try {
    const raw = JSON.parse(
      localStorage.getItem("plexon:preferences") ?? "{}",
    ) as Partial<Preferences>;
    const merged = { ...defaults, ...raw };
    if (raw.telemetryInterval === undefined && raw.skinProvider === "crafatar")
      merged.skinProvider = "auto";
    if (![50, 100, 250, 500, 1000].includes(merged.telemetryInterval))
      merged.telemetryInterval = defaults.telemetryInterval;
    if (!merged.serverIcons || typeof merged.serverIcons !== "object")
      merged.serverIcons = {};
    return merged;
  } catch {
    return defaults;
  }
}

export const preferences = {
  getSnapshot: () => value,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  update(patch: Partial<Preferences>) {
    value = { ...value, ...patch };
    try {
      localStorage.setItem("plexon:preferences", JSON.stringify(value));
    } catch {
      /* Preference persistence is optional. */
    }
    listeners.forEach((listener) => listener());
  },
};

export const usePreferences = () =>
  useSyncExternalStore(preferences.subscribe, preferences.getSnapshot);

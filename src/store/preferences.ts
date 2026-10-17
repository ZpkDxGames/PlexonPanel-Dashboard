import { useSyncExternalStore } from "react";

export type Preferences = {
  theme: "dark" | "light" | "system";
  density: "compact" | "comfortable" | "spacious";
  textSize: "small" | "standard" | "large";
  accent: "teal" | "blue" | "violet";
  motion: "full" | "reduced" | "off";
  chartFill: boolean;
  timezone: "browser" | "UTC";
  skinProvider: "proxy" | "crafatar" | "mc-heads" | "minotar" | "disabled";
};

const defaults: Preferences = {
  theme: "dark",
  density: "comfortable",
  textSize: "standard",
  accent: "teal",
  motion: "full",
  chartFill: true,
  timezone: "browser",
  skinProvider: "crafatar",
};
const listeners = new Set<() => void>();

const oneOf = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T =>
  typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : fallback;

// Parsing calls oneOf: initialize it before the first persisted read.
let value = defaults;

export function parsePreferences(raw: unknown): Preferences {
  const saved =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const legacyMotion =
    saved.reduceMotion === true ? "reduced" : defaults.motion;
  return {
    theme: oneOf(
      saved.theme,
      ["dark", "light", "system"] as const,
      defaults.theme,
    ),
    density: oneOf(
      saved.density,
      ["compact", "comfortable", "spacious"] as const,
      defaults.density,
    ),
    textSize: oneOf(
      saved.textSize,
      ["small", "standard", "large"] as const,
      defaults.textSize,
    ),
    accent: oneOf(
      saved.accent,
      ["teal", "blue", "violet"] as const,
      defaults.accent,
    ),
    motion: oneOf(
      saved.motion,
      ["full", "reduced", "off"] as const,
      legacyMotion,
    ),
    chartFill:
      typeof saved.chartFill === "boolean"
        ? saved.chartFill
        : defaults.chartFill,
    timezone: oneOf(
      saved.timezone,
      ["browser", "UTC"] as const,
      defaults.timezone,
    ),
    skinProvider: oneOf(
      saved.skinProvider,
      ["proxy", "crafatar", "mc-heads", "minotar", "disabled"] as const,
      defaults.skinProvider,
    ),
  };
}

function read(): Preferences {
  try {
    return parsePreferences(
      JSON.parse(localStorage.getItem("plexon:preferences") ?? "{}"),
    );
  } catch {
    return defaults;
  }
}

export function resolvedTheme(
  preference: Preferences["theme"],
): "dark" | "light" {
  if (preference !== "system") return preference;
  return typeof matchMedia === "function" &&
    matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function applyPreferencesToDocument(preference: Preferences): void {
  const root = document.documentElement;
  root.dataset.theme = resolvedTheme(preference.theme);
  root.dataset.density = preference.density;
  root.dataset.textSize = preference.textSize;
  root.dataset.accent = preference.accent;
  root.dataset.motion = preference.motion;
  root.dataset.chartFill = String(preference.chartFill);
}

export const preferences = {
  getSnapshot: () => value,
  hydrate() {
    value = read();
    listeners.forEach((f) => f());
  },
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
  useSyncExternalStore(
    preferences.subscribe,
    preferences.getSnapshot,
    () => defaults,
  );

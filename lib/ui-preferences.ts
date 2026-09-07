export const UI_PREFERENCES_KEY = "plexonpanel-ui-preferences-v1";
export const UI_PREFERENCES_MAX_BYTES = 8192;

export type DisplayUpdateRateMs = 0 | 250 | 500 | 1000 | 2000;

export type UiPreferencesV1 = {
  schemaVersion: 1;
  theme: "system" | "dark" | "light";
  accent: "cyan" | "violet" | "emerald" | "amber";
  contrast: "system" | "standard" | "high";
  density: "compact" | "comfortable" | "spacious";
  textScale: 100 | 112.5 | 125;
  mobilePlayerRows: "cards" | "table";
  playerHeads: boolean;
  playerHeadSize: "small" | "medium";
  playerUuid: "hidden" | "short" | "full";
  liveRowHighlight: boolean;
  chartWindowMinutes: 1 | 5 | 15 | 30;
  chartStyle: "line" | "area";
  chartGrid: boolean;
  chartLayout: "auto" | "single" | "double";
  timeZone: "local" | "utc";
  motion: "system" | "full" | "reduced" | "off";
  livePulse: boolean;
  pageTransitions: boolean;
  displayUpdateRateMs: DisplayUpdateRateMs;
};

export type ResolvedUiPresentation = {
  theme: "dark" | "light";
  contrast: "standard" | "high";
  motion: "full" | "reduced" | "off";
};

const oneOf = <T extends string | number>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T => (allowed.includes(value as T) ? (value as T) : fallback);

export function createDefaultUiPreferences(
  playerHeadsAvailable = false,
): UiPreferencesV1 {
  return {
    schemaVersion: 1,
    theme: "system",
    accent: "cyan",
    contrast: "system",
    density: "comfortable",
    textScale: 100,
    mobilePlayerRows: "cards",
    playerHeads: playerHeadsAvailable,
    playerHeadSize: "medium",
    playerUuid: "short",
    liveRowHighlight: true,
    chartWindowMinutes: 5,
    chartStyle: "area",
    chartGrid: true,
    chartLayout: "auto",
    timeZone: "local",
    motion: "system",
    livePulse: true,
    pageTransitions: true,
    displayUpdateRateMs: 500,
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function parseUiPreferences(
  value: unknown,
  defaults = createDefaultUiPreferences(),
): UiPreferencesV1 {
  const source = record(value);
  return {
    schemaVersion: 1,
    theme: oneOf(source.theme, ["system", "dark", "light"] as const, defaults.theme),
    accent: oneOf(
      source.accent,
      ["cyan", "violet", "emerald", "amber"] as const,
      defaults.accent,
    ),
    contrast: oneOf(
      source.contrast,
      ["system", "standard", "high"] as const,
      defaults.contrast,
    ),
    density: oneOf(
      source.density,
      ["compact", "comfortable", "spacious"] as const,
      defaults.density,
    ),
    textScale: oneOf(source.textScale, [100, 112.5, 125] as const, defaults.textScale),
    mobilePlayerRows: oneOf(
      source.mobilePlayerRows,
      ["cards", "table"] as const,
      defaults.mobilePlayerRows,
    ),
    playerHeads:
      typeof source.playerHeads === "boolean" ? source.playerHeads : defaults.playerHeads,
    playerHeadSize: oneOf(
      source.playerHeadSize,
      ["small", "medium"] as const,
      defaults.playerHeadSize,
    ),
    playerUuid: oneOf(
      source.playerUuid,
      ["hidden", "short", "full"] as const,
      defaults.playerUuid,
    ),
    liveRowHighlight:
      typeof source.liveRowHighlight === "boolean"
        ? source.liveRowHighlight
        : defaults.liveRowHighlight,
    chartWindowMinutes: oneOf(
      source.chartWindowMinutes,
      [1, 5, 15, 30] as const,
      defaults.chartWindowMinutes,
    ),
    chartStyle: oneOf(
      source.chartStyle,
      ["line", "area"] as const,
      defaults.chartStyle,
    ),
    chartGrid:
      typeof source.chartGrid === "boolean" ? source.chartGrid : defaults.chartGrid,
    chartLayout: oneOf(
      source.chartLayout,
      ["auto", "single", "double"] as const,
      defaults.chartLayout,
    ),
    timeZone: oneOf(source.timeZone, ["local", "utc"] as const, defaults.timeZone),
    motion: oneOf(
      source.motion,
      ["system", "full", "reduced", "off"] as const,
      defaults.motion,
    ),
    livePulse:
      typeof source.livePulse === "boolean" ? source.livePulse : defaults.livePulse,
    pageTransitions:
      typeof source.pageTransitions === "boolean"
        ? source.pageTransitions
        : defaults.pageTransitions,
    displayUpdateRateMs: oneOf(
      source.displayUpdateRateMs,
      [0, 250, 500, 1000, 2000] as const,
      defaults.displayUpdateRateMs,
    ),
  };
}

export function parseUiPreferencesText(
  raw: string | null,
  defaults = createDefaultUiPreferences(),
): UiPreferencesV1 {
  if (!raw || raw.length > UI_PREFERENCES_MAX_BYTES) return defaults;
  try {
    return parseUiPreferences(JSON.parse(raw), defaults);
  } catch {
    return defaults;
  }
}

export function loadUiPreferences(
  storage: Pick<Storage, "getItem">,
  playerHeadsAvailable = false,
): UiPreferencesV1 {
  const defaults = createDefaultUiPreferences(playerHeadsAvailable);
  const raw = storage.getItem(UI_PREFERENCES_KEY);
  const parsed = parseUiPreferencesText(raw, defaults);
  if (raw) return parsed;

  const legacyDensity = storage.getItem("plexonpanel-density");
  const legacyWindow = Number(storage.getItem("plexonpanel-performance-window"));
  return {
    ...parsed,
    density: oneOf(
      legacyDensity,
      ["compact", "comfortable", "spacious"] as const,
      parsed.density,
    ),
    chartWindowMinutes: oneOf(
      legacyWindow,
      [1, 5, 15, 30] as const,
      parsed.chartWindowMinutes,
    ),
  };
}

export function saveUiPreferences(
  storage: Pick<Storage, "setItem">,
  preferences: UiPreferencesV1,
): void {
  const normalized = parseUiPreferences(preferences, preferences);
  storage.setItem(UI_PREFERENCES_KEY, JSON.stringify(normalized));
  // Compatibility bridge while the remaining 2.x view modules are migrated.
  storage.setItem("plexonpanel-density", normalized.density);
  storage.setItem(
    "plexonpanel-performance-window",
    String(normalized.chartWindowMinutes),
  );
}

export function resolveUiPresentation(
  preferences: UiPreferencesV1,
  system: { dark: boolean; highContrast: boolean; reducedMotion: boolean },
): ResolvedUiPresentation {
  const theme =
    preferences.theme === "system"
      ? system.dark
        ? "dark"
        : "light"
      : preferences.theme;
  const contrast =
    preferences.contrast === "system"
      ? system.highContrast
        ? "high"
        : "standard"
      : preferences.contrast;
  const motion =
    preferences.motion === "off"
      ? "off"
      : preferences.motion === "reduced" || system.reducedMotion
        ? "reduced"
        : "full";
  return { theme, contrast, motion };
}

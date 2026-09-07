import test from "node:test";
import assert from "node:assert/strict";
import {
  UI_PREFERENCES_KEY,
  createDefaultUiPreferences,
  loadUiPreferences,
  parseUiPreferences,
  parseUiPreferencesText,
  resolveUiPresentation,
  saveUiPreferences,
} from "../.test-dist/lib/ui-preferences.js";

function storage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    value(key) { return values.get(key); },
  };
}

test("UI preferences use provider-aware safe defaults", () => {
  assert.equal(createDefaultUiPreferences(false).playerHeads, false);
  assert.equal(createDefaultUiPreferences(true).playerHeads, true);
  assert.equal(createDefaultUiPreferences().theme, "system");
  assert.equal(createDefaultUiPreferences().motion, "system");
});

test("strict parsing drops unknown and corrupt preference values", () => {
  const parsed = parseUiPreferences({
    schemaVersion: 99,
    theme: "neon",
    accent: "emerald",
    density: "compact",
    textScale: 900,
    chartWindowMinutes: 30,
    chartGrid: false,
    unknown: "do-not-keep",
  });
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.theme, "system");
  assert.equal(parsed.accent, "emerald");
  assert.equal(parsed.density, "compact");
  assert.equal(parsed.textScale, 100);
  assert.equal(parsed.chartWindowMinutes, 30);
  assert.equal(parsed.chartGrid, false);
  assert.equal(Object.hasOwn(parsed, "unknown"), false);
});

test("oversized or invalid stored JSON falls back safely", () => {
  const defaults = createDefaultUiPreferences(true);
  assert.deepEqual(parseUiPreferencesText("{"), defaults), defaults);
  assert.deepEqual(parseUiPreferencesText("x".repeat(9000), defaults), defaults);
});

test("legacy density and chart window migrate without touching other keys", () => {
  const local = storage({
    "plexonpanel-density": "compact",
    "plexonpanel-performance-window": "15",
    "plexonpanel-last-section": "Players",
  });
  const migrated = loadUiPreferences(local, true);
  assert.equal(migrated.density, "compact");
  assert.equal(migrated.chartWindowMinutes, 15);
  assert.equal(migrated.playerHeads, true);
  saveUiPreferences(local, migrated);
  assert.ok(local.value(UI_PREFERENCES_KEY));
  assert.equal(local.value("plexonpanel-last-section"), "Players");
});

test("saved schema mirrors temporary legacy compatibility keys", () => {
  const local = storage();
  const preferences = {
    ...createDefaultUiPreferences(),
    density: "spacious",
    chartWindowMinutes: 30,
  };
  saveUiPreferences(local, preferences);
  assert.equal(local.value("plexonpanel-density"), "spacious");
  assert.equal(local.value("plexonpanel-performance-window"), "30");
  assert.deepEqual(JSON.parse(local.value(UI_PREFERENCES_KEY)), preferences);
});

test("system resolution honors reduced motion as a safety floor", () => {
  const base = createDefaultUiPreferences();
  assert.deepEqual(
    resolveUiPresentation(base, { dark: false, highContrast: true, reducedMotion: true }),
    { theme: "light", contrast: "high", motion: "reduced" },
  );
  assert.equal(
    resolveUiPresentation(
      { ...base, motion: "full" },
      { dark: true, highContrast: false, reducedMotion: true },
    ).motion,
    "reduced",
  );
  assert.equal(
    resolveUiPresentation(
      { ...base, motion: "off" },
      { dark: true, highContrast: false, reducedMotion: false },
    ).motion,
    "off",
  );
});

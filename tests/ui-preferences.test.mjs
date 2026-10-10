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
  assert.equal(createDefaultUiPreferences().theme, "light");
  assert.equal(createDefaultUiPreferences().accent, "monochrome");
  assert.equal(createDefaultUiPreferences().density, "compact");
  assert.equal(createDefaultUiPreferences().motion, "system");
  assert.equal(createDefaultUiPreferences().displayUpdateRateMs, 500);
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
    displayUpdateRateMs: 1000,
    unknown: "do-not-keep",
  });
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.theme, "light");
  assert.equal(parsed.accent, "emerald");
  assert.equal(parsed.density, "compact");
  assert.equal(parsed.textScale, 100);
  assert.equal(parsed.chartWindowMinutes, 30);
  assert.equal(parsed.chartGrid, false);
  assert.equal(parsed.displayUpdateRateMs, 1000);
  assert.equal(Object.hasOwn(parsed, "unknown"), false);
});

test("invalid display update rates migrate to the balanced default", () => {
  assert.equal(parseUiPreferences({ displayUpdateRateMs: 333 }).displayUpdateRateMs, 500);
  assert.equal(parseUiPreferences({ displayUpdateRateMs: -1 }).displayUpdateRateMs, 500);
  assert.equal(parseUiPreferences({ displayUpdateRateMs: 0 }).displayUpdateRateMs, 0);
  assert.equal(parseUiPreferences({ displayUpdateRateMs: 2000 }).displayUpdateRateMs, 2000);
});

test("oversized or invalid stored JSON falls back safely", () => {
  const defaults = createDefaultUiPreferences(true);
  assert.deepEqual(parseUiPreferencesText("{", defaults), defaults);
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
  assert.equal(migrated.displayUpdateRateMs, 500);
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
    displayUpdateRateMs: 250,
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

test('OS theme and cyan defaults apply only when the v1 key is absent', () => {
  assert.equal(loadUiPreferences(storage()).theme, 'system');
  assert.equal(loadUiPreferences(storage()).accent, 'cyan');
  for (const raw of ['', '{', '{}', 'null', '[]', 'true', 'x'.repeat(9000)]) {
    const loaded = loadUiPreferences(storage({[UI_PREFERENCES_KEY]:raw,'plexonpanel-density':'spacious'}));
    assert.equal(loaded.theme, 'light',raw);
    assert.equal(loaded.accent, 'monochrome',raw);
    assert.equal(loaded.density, 'compact',raw);
  }
});

test('all saved accents and complete existing preference values survive additive loading', () => {
  for(const accent of ['monochrome','cyan','violet','emerald','amber']) {
    const saved={...createDefaultUiPreferences(true),theme:'dark',accent,contrast:'high',density:'spacious',textScale:125,mobilePlayerRows:'table',playerHeadSize:'small',playerUuid:'full',liveRowHighlight:false,chartWindowMinutes:30,chartStyle:'line',chartGrid:false,chartLayout:'double',timeZone:'utc',motion:'off',livePulse:false,pageTransitions:false,displayUpdateRateMs:0};
    const local=storage({[UI_PREFERENCES_KEY]:JSON.stringify(saved)});
    assert.deepEqual(loadUiPreferences(local,true),saved);
    saveUiPreferences(local,loadUiPreferences(local,true));
    assert.deepEqual(JSON.parse(local.value(UI_PREFERENCES_KEY)),saved);
  }
  assert.equal(loadUiPreferences(storage({[UI_PREFERENCES_KEY]:'{"accent":"amber"}'})).theme,'light');
});

test('before-paint preference initializer matches the runtime parser for absent and saved keys',async()=>{
  const {readFile}=await import('node:fs/promises');const {runInNewContext}=await import('node:vm');
  const source=await readFile('public/ui-preferences-init.js','utf8');
  for(const raw of [null,'','{','{}','null','[]','true','x'.repeat(9000),JSON.stringify({theme:'dark',accent:'violet',density:'spacious',contrast:'high',motion:'off',textScale:125})])for(const dark of [false,true]) {
    const local=storage({...raw===null?{}:{[UI_PREFERENCES_KEY]:raw},'plexonpanel-density':'comfortable'});
    const root={dataset:{}};
    runInNewContext(source,{document:{documentElement:root},localStorage:local,window:{matchMedia:query=>({matches:query.includes('color-scheme')?dark:query.includes('reduced-motion')})}});
    const loaded=loadUiPreferences(local);const resolved=resolveUiPresentation(loaded,{dark,highContrast:false,reducedMotion:true});
    assert.deepEqual({...root.dataset},{plexonTheme:resolved.theme,plexonAccent:loaded.accent,plexonContrast:resolved.contrast,plexonDensity:loaded.density,plexonTextScale:String(loaded.textScale),plexonMotion:resolved.motion});
  }
});

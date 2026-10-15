import test from "node:test";
import assert from "node:assert/strict";
import { parsePreferences } from "../src/store/preferences";

test("preference parser migrates the legacy reduced-motion flag", () => {
  const value = parsePreferences({ theme: "light", density: "compact", reduceMotion: true });
  assert.equal(value.theme, "light");
  assert.equal(value.density, "compact");
  assert.equal(value.motion, "reduced");
  assert.equal(value.accent, "teal");
});

test("preference parser rejects unsupported persisted values", () => {
  const value = parsePreferences({ theme: "neon", density: "tiny", motion: "spin", chartFill: "yes" });
  assert.equal(value.theme, "dark");
  assert.equal(value.density, "comfortable");
  assert.equal(value.motion, "full");
  assert.equal(value.chartFill, true);
});

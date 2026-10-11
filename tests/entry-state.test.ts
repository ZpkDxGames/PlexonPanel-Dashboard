import assert from "node:assert/strict";
import test from "node:test";
import { entryExperience } from "../src/entry-state";

const state = (patch: Partial<{ initialized: boolean; credentials: unknown[]; fixture: string }> = {}) => ({
  initialized: true,
  credentials: [],
  fixture: "",
  ...patch,
});

test("entry experience waits for both storage initialization and the minimum splash", () => {
  assert.equal(entryExperience(state({ initialized: false }) as never, true), "splash");
  assert.equal(entryExperience(state() as never, false), "splash");
});

test("an initialized browser without pairings enters onboarding", () => {
  assert.equal(entryExperience(state() as never, true), "pairing");
});

test("stored credentials and development fixtures enter the dashboard", () => {
  assert.equal(entryExperience(state({ credentials: [{}] }) as never, true), "dashboard");
  assert.equal(entryExperience(state({ fixture: "healthy" }) as never, true), "dashboard");
});

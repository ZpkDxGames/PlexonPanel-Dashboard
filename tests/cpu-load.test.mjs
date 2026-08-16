import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeCpuLoad, selectCpuLoad } from "../lib/cpu-load.js";

test("preserves a valid idle CPU sample", () => {
  assert.deepEqual(normalizeCpuLoad(0), { available: true, percent: 0 });
});

test("rounds and clamps valid CPU samples", () => {
  assert.deepEqual(normalizeCpuLoad(0.426), { available: true, percent: 43 });
  assert.deepEqual(normalizeCpuLoad(1.5), { available: true, percent: 100 });
});

test("marks missing and negative CPU samples unavailable", () => {
  assert.deepEqual(normalizeCpuLoad(-1), { available: false, percent: 0 });
  assert.deepEqual(normalizeCpuLoad(Number.NaN), { available: false, percent: 0 });
  assert.deepEqual(normalizeCpuLoad(undefined), { available: false, percent: 0 });
});

test("prefers a host CPU sample over the Paper process sample", () => {
  assert.deepEqual(selectCpuLoad(0.42, 0.11), {
    available: true,
    percent: 42,
    source: "system",
  });
});

test("falls back to Paper process CPU when host CPU is unavailable", () => {
  assert.deepEqual(selectCpuLoad(-1, 0.126), {
    available: true,
    percent: 13,
    source: "process",
  });
});

test("reports unavailable only when both CPU samples are unavailable", () => {
  assert.deepEqual(selectCpuLoad(-1, -1), {
    available: false,
    percent: 0,
    source: "unavailable",
  });
});

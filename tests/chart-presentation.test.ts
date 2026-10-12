import assert from "node:assert/strict";
import test from "node:test";
import { presentationWindow } from "../src/lib/chart";

test("30s and 1min charts move on a 500ms presentation clock", () => {
  assert.deepEqual(presentationWindow(10_001, 30_000), {
    start: -19_500,
    end: 10_500,
    step: 500,
  });
  assert.deepEqual(presentationWindow(60_249, 60_000), {
    start: 500,
    end: 60_500,
    step: 500,
  });
});

test("longer chart windows translate at one second instead of every packet", () => {
  assert.deepEqual(presentationWindow(301_001, 300_000), {
    start: 2_000,
    end: 302_000,
    step: 1_000,
  });
  assert.deepEqual(presentationWindow(601_999, 600_000), {
    start: 2_000,
    end: 602_000,
    step: 1_000,
  });
});

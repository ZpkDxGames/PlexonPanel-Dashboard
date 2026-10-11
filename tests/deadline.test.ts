import { test } from "node:test";
import assert from "node:assert/strict";
import { deadlineDelay, MAX_TIMER_DELAY_MS } from "../src/adapter/deadline";

test("long-lived grants are scheduled without overflowing browser timers", () => {
  const now = Date.parse("2026-10-11T00:00:00.000Z");
  const thirtyDays = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(deadlineDelay(thirtyDays, now), MAX_TIMER_DELAY_MS);
});

test("near and expired grant deadlines are classified exactly", () => {
  const now = Date.parse("2026-10-11T00:00:00.000Z");
  assert.equal(deadlineDelay(new Date(now + 12_345).toISOString(), now), 12_345);
  assert.equal(deadlineDelay(new Date(now).toISOString(), now), null);
  assert.equal(deadlineDelay("not-a-date", now), null);
});

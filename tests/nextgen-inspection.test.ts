import test from "node:test";
import assert from "node:assert/strict";
import { nearestObservation } from "../src/presentation/nextgen/inspection";
import { displayTimestamp } from "../src/presentation/nextgen/time";
import type { Sample } from "../src/adapter/control-state";
const samples = [10, 30, 80].map((at) => ({ at, tps: 20 }) as Sample);
test("inspection resolves actual captures, earlier ties and out-of-domain endpoints", () => {
  assert.equal(nearestObservation([], 20), null);
  for (const [at, index] of [
    [-5, 0],
    [10, 0],
    [20, 0],
    [21, 1],
    [79, 2],
    [100, 2],
  ])
    assert.equal(nearestObservation(samples, at), samples[index]);
  assert.deepEqual(
    samples.map((s) => s.at),
    [10, 30, 80],
  );
});
test("UTC labels preserve the exact instant and reject unknown capture values", () => {
  const at = "2026-01-15T02:03:04.000Z";
  assert.equal(
    displayTimestamp(at, true),
    new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: "UTC",
    }).format(Date.parse(at)),
  );
  assert.equal(displayTimestamp("not-a-date", true), "Not reported");
  assert.equal(displayTimestamp(null), "Not reported");
});

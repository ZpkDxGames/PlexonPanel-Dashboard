import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyTelemetry } from "../src/adapter/telemetry-freshness";
const now = 1800000000000;
for (const skew of [6000, 30000, 120000])
  test(`future capture ${skew} expires by receipt`, () => {
    const capturedAt = new Date(now + skew).toISOString();
    assert.equal(
      classifyTelemetry({ capturedAt, receivedAt: now, connected: true, now })
        .kind,
      "skew",
    );
    assert.equal(
      classifyTelemetry({
        capturedAt,
        receivedAt: now,
        connected: true,
        now: now + 11000,
      }).kind,
      "delayed",
    );
    assert.equal(
      classifyTelemetry({
        capturedAt,
        receivedAt: now,
        connected: true,
        now: now + 31000,
      }).kind,
      "stale",
    );
  });
test("missing, disconnected, small offset and behind clock remain distinct", () => {
  assert.equal(
    classifyTelemetry({ capturedAt: undefined, connected: true, now }).kind,
    "waiting",
  );
  assert.equal(
    classifyTelemetry({
      capturedAt: new Date(now).toISOString(),
      connected: false,
      now,
    }).kind,
    "disconnected",
  );
  assert.equal(
    classifyTelemetry({
      capturedAt: new Date(now + 4000).toISOString(),
      receivedAt: now,
      connected: true,
      now,
    }).kind,
    "live",
  );
  assert.equal(
    classifyTelemetry({
      capturedAt: new Date(now - 60000).toISOString(),
      receivedAt: now,
      connected: true,
      now,
    }).kind,
    "stale",
  );
});


test("advertised source cadence tightens delayed and stale detection without changing legacy fallback", () => {
  const capturedAt = new Date(now).toISOString();
  assert.equal(
    classifyTelemetry({
      capturedAt,
      receivedAt: now,
      connected: true,
      now: now + 3500,
      expectedIntervalMs: 250,
    }).kind,
    "delayed",
  );
  assert.equal(
    classifyTelemetry({
      capturedAt,
      receivedAt: now,
      connected: true,
      now: now + 11000,
      expectedIntervalMs: 250,
    }).kind,
    "stale",
  );
  assert.equal(
    classifyTelemetry({
      capturedAt,
      receivedAt: now,
      connected: true,
      now: now + 11000,
    }).kind,
    "delayed",
  );
});

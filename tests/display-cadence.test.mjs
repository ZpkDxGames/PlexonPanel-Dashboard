import { test } from "node:test";
import assert from "node:assert/strict";
import {
  displayRateLabel,
  isImmediateControlMessage,
} from "../.test-dist/lib/display-cadence.js";

const message = (eventType) => ({
  type: "server.event",
  serverId: "server",
  eventType,
  body: {},
});

test("critical and operational state bypasses the presentation throttle", () => {
  assert.equal(isImmediateControlMessage({ type: "dashboard.ready" }), true);
  for (const eventType of [
    "service.status",
    "backup.progress",
    "players.presence",
    "console.lines",
    "chat.message",
    "action.result",
  ]) {
    assert.equal(isImmediateControlMessage(message(eventType)), true, eventType);
  }
});

test("telemetry and bounded inventory remain presentation-throttled", () => {
  for (const eventType of [
    "telemetry.server",
    "telemetry.system",
    "telemetry.worlds",
    "inventory.players",
    "inventory.plugins",
  ]) {
    assert.equal(isImmediateControlMessage(message(eventType)), false, eventType);
  }
});

test("display rate labels distinguish realtime from bounded cadence", () => {
  assert.equal(displayRateLabel(0), "Realtime");
  assert.equal(displayRateLabel(250), "250 ms");
  assert.equal(displayRateLabel(500), "500 ms");
  assert.equal(displayRateLabel(1000), "1 s");
  assert.equal(displayRateLabel(2000), "2 s");
});

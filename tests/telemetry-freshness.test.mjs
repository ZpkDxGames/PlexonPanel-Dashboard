import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { telemetryFreshness } from "../.test-dist/lib/telemetry-freshness.js";
import { TelemetryFreshness } from "../.test-dist/app/telemetry-freshness.js";
import { applyControlMessage, diagnostics, emptyControlState } from "../.test-dist/lib/control-state.js";
import { connectionState } from "../.test-dist/lib/connection-state.js";

test("sample freshness rejects missing, expired, future and disconnected samples consistently", () => {
  const now = Date.now(), at = offset => new Date(now + offset).toISOString();
  assert.equal(telemetryFreshness(undefined, true, now).kind, "waiting");
  assert.equal(telemetryFreshness("bad", true, now).kind, "waiting");
  assert.equal(telemetryFreshness(at(-30_000), true, now).kind, "delayed");
  assert.equal(telemetryFreshness(at(-30_001), true, now).kind, "stale");
  assert.equal(telemetryFreshness(at(5_001), true, now).label, "clock mismatch");
  assert.equal(telemetryFreshness(at(0), false, now).kind, "disconnected");
});

test("fresh Host traffic cannot label missing Minecraft samples as live or fabricate server metrics", () => {
  const now = Date.now();
  let state = { ...emptyControlState("A"), ready: { agents: { paper: true, host: true }, server: { hostSession: "host-1", paperSession: "paper-1" } } };
  state = applyControlMessage(state, { type: "server.event", serverId: "A", agentKind: "HOST", agentSession: "host-1", eventType: "telemetry.system", body: { capturedAt: new Date(now).toISOString() } });
  assert.ok(state.telemetryUpdatedAt);
  assert.equal(connectionState(state, "live", now).kind, "stale");
  const html = renderToStaticMarkup(React.createElement(TelemetryFreshness, { state, phase: "live" }));
  assert.match(html, /Minecraft: waiting for telemetry/);
  assert.match(html, /Host: live/);
  const report = diagnostics(state);
  assert.match(report, /Minecraft sample: unavailable/);
  assert.match(report, /Host sample: .*live/);
  assert.match(report, /TPS: unavailable/);
  assert.doesNotMatch(report, /host-1|paper-1/);
});

test("old captures stay stale after replay and switching instances cannot reuse another server's freshness", () => {
  const now = Date.now();
  let state = { ...emptyControlState("A"), ready: { agents: { paper: true, host: true }, server: { paperSession: "paper-1" } } };
  const replay = { type: "server.event", serverId: "A", agentKind: "PAPER", agentSession: "paper-1", eventType: "telemetry.server", body: { capturedAt: new Date(now - 60_000).toISOString(), tps: [20] } };
  state = applyControlMessage(state, replay);
  assert.equal(telemetryFreshness(state.server.capturedAt, true, now).kind, "stale");
  assert.equal(applyControlMessage(emptyControlState("B"), replay).server.capturedAt, undefined);
  state.cached = true;
  const html = renderToStaticMarkup(React.createElement(TelemetryFreshness, { state, phase: "live" }));
  assert.match(html, /Minecraft: disconnected/);
  assert.doesNotMatch(html, /: live/);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { connectionState } from "../.test-dist/lib/connection-state.js";
import { emptyControlState } from "../.test-dist/lib/control-state.js";
import { ConnectionSummary, ConnectionPills } from "../.test-dist/app/connection-summary.js";
const now = Date.now();
const state = () => ({ ...emptyControlState("server-a"), ready: { agents: { paper: true, host: true }, server: {} },
  server: { capturedAt: new Date(now).toISOString() }, service: { state: "inactive", resources: { capturedAt: new Date(now).toISOString() } } });

test("a fresh Host confirmation distinguishes stopped Minecraft from Host and relay loss", () => {
  const value = state(); value.ready.agents.paper = false;
  assert.equal(connectionState(value, "live", now).kind, "stopped");
  assert.equal(connectionState(value, "live", now).host, "Connected");
  value.ready.agents.host = false;
  assert.equal(connectionState(value, "live", now).kind, "host-disconnected");
  assert.equal(connectionState(value, "live", now).minecraft, "Unknown");
  assert.equal(connectionState(value, "reconnecting", now).kind, "relay-unavailable");
  assert.equal(connectionState(value, "reconnecting", now).host, "Unknown");
});
test("cached, expired, missing and inconsistent signals cannot fabricate stopped status", () => {
  const value = state(); value.ready.agents.paper = false;
  for (const capturedAt of [undefined, "bad", new Date(now - 31_000).toISOString(), new Date(now + 60_000).toISOString()]) {
    value.service.resources.capturedAt = capturedAt;
    assert.equal(connectionState(value, "live", now).kind, "paper-disconnected");
  }
  value.service.resources.capturedAt = new Date(now).toISOString(); value.cached = true;
  assert.equal(connectionState(value, "live", now).kind, "connecting");
  value.cached = false; value.ready.agents.paper = true;
  assert.equal(connectionState(value, "live", now).kind, "online");
});
test("service transitions, failure and running process without plugin are distinct", () => {
  const value = state(); value.ready.agents.paper = false;
  for (const [service, expected] of [["activating", "starting"], ["deactivating", "stopping"], ["failed", "failed"], ["active", "paper-disconnected"]]) {
    value.service.state = service;
    assert.equal(connectionState(value, "live", now).kind, expected);
  }
  assert.equal(connectionState(value, "live", now).minecraft, "Running · plugin disconnected");
});
test("compatibility, revocation, stale telemetry and subscription limits remain explicit", () => {
  const value = state(); value.ready.server.hostTargetCompatible = false;
  assert.equal(connectionState(value, "live", now).kind, "incompatible");
  delete value.ready.server.hostTargetCompatible; value.server.capturedAt = new Date(now - 31_000).toISOString();
  assert.equal(connectionState(value, "live", now).kind, "stale");
  assert.equal(connectionState(value, "revoked", now).kind, "access-required");
  assert.equal(connectionState(value, "limited", now).kind, "limited");
});
test("connection summaries expose readable status and retry controls without color dependence", () => {
  const html = renderToStaticMarkup(React.createElement(ConnectionSummary, { state: state(), phase: "reconnecting", retry() {} }));
  assert.match(html, /Relay unavailable/); assert.match(html, /Retry connection/); assert.match(html, /role="status"/);
  const pills = renderToStaticMarkup(React.createElement(ConnectionPills, { state: state(), phase: "reconnecting" }));
  assert.match(pills, /Relay: Unavailable/); assert.match(pills, /Host: Unknown/); assert.match(pills, /Minecraft: Unknown/);
});

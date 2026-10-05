import assert from "node:assert/strict";
import { test } from "node:test";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import { renderToStaticMarkup } from "react-dom/server";
import { telemetryFreshness } from "../.test-dist/lib/telemetry-freshness.js";
import { TelemetryFreshness } from "../.test-dist/app/telemetry-freshness.js";
import { applyControlMessage, diagnostics, emptyControlState } from "../.test-dist/lib/control-state.js";
import { connectionState } from "../.test-dist/lib/connection-state.js";
import { ConnectionSummary, ConnectionPills } from "../.test-dist/app/connection-summary.js";

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

test("ready waits for the first current-session sample once, without extending the outage on repeated ready packets", () => {
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  try {
    const ready = session => ({ type: "dashboard.ready", protocolVersion: 3, serverId: "A", device: { deviceId: "fixture" }, agents: { paper: true, host: true }, server: { paperSession: session, hostSession: "host-1" } });
    let state = applyControlMessage(emptyControlState("A"), ready("paper-1"));
    assert.equal(connectionState(state, "live", now).label, "Waiting for Minecraft telemetry");
    now += 30_001;
    state = applyControlMessage(state, ready("paper-1"));
    assert.equal(connectionState(state, "live", now).kind, "stale");
    state = applyControlMessage(state, ready("paper-2"));
    assert.equal(connectionState(state, "live", now).label, "Waiting for Minecraft telemetry");
    state.server = { capturedAt: new Date(now).toISOString() };
    assert.equal(connectionState(state, "live", now).kind, "online");
    state = applyControlMessage({ ...state, cached: true }, ready("paper-2"));
    assert.deepEqual(state.server, {});
    assert.equal(connectionState(state, "live", now).label, "Waiting for Minecraft telemetry");
  } finally { Date.now = originalNow; }
});

test("older captures cannot replace current telemetry or service state; role and session boundaries remain enforced", () => {
  const now = Date.now(), current = new Date(now).toISOString(), old = new Date(now - 60_000).toISOString();
  let state = { ...emptyControlState("A"), ready: { agents: { paper: true, host: true }, server: { paperSession: "paper-1", hostSession: "host-1" } } };
  const packet = (eventType, agentKind, capturedAt, session = agentKind === "HOST" ? "host-1" : "paper-1") => ({ type: "server.event", serverId: "A", eventType, agentKind, agentSession: session, body: eventType === "service.status" ? { state: "active", resources: { capturedAt } } : { capturedAt, tps: [20] } });
  for (const [eventType, kind] of [["telemetry.server", "PAPER"], ["telemetry.system", "HOST"], ["telemetry.system", "PAPER"], ["service.status", "HOST"]]) {
    state = applyControlMessage(state, packet(eventType, kind, current));
    assert.equal(applyControlMessage(state, packet(eventType, kind, old)), state);
    assert.equal(applyControlMessage(state, packet(eventType, kind, undefined)), state);
    assert.equal(applyControlMessage(state, packet(eventType, kind, current, "old-session")), state);
  }
  assert.equal(applyControlMessage(state, packet("telemetry.server", "HOST", current)), state);
  assert.equal(applyControlMessage(state, { ...packet("telemetry.server", "PAPER", current), serverId: "B" }), state);
});

test("packet receipts prevent timer/skew flicker, one clock serves all indicators, and foregrounding reveals real loss", async () => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true });
  const saved = new Map(), originalNow = Date.now, originalInterval = globalThis.setInterval, originalClear = globalThis.clearInterval;
  let now = originalNow(), visibility = "visible", timerId = 0;
  const timers = new Map();
  Object.defineProperty(dom.window.document, "visibilityState", { configurable: true, get: () => visibility });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  Date.now = () => now;
  globalThis.setInterval = callback => { timers.set(++timerId, callback); return timerId; };
  globalThis.clearInterval = id => timers.delete(id);
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("root"));
  let state = { ...emptyControlState("A"), ready: { agents: { paper: true, host: true }, server: { paperSession: "paper-1", hostSession: "host-1" } } };
  const receive = () => {
    state = applyControlMessage(state, { type: "server.event", serverId: "A", eventType: "telemetry.server", agentKind: "PAPER", agentSession: "paper-1", body: { capturedAt: new Date(now + 2274).toISOString(), tps: [20] } });
    state = applyControlMessage(state, { type: "server.event", serverId: "A", eventType: "telemetry.system", agentKind: "HOST", agentSession: "host-1", body: { capturedAt: new Date(now + 2000).toISOString() } });
  };
  const render = () => act(async () => root.render(React.createElement(React.Fragment, null,
    React.createElement(ConnectionSummary, { state, phase: "live", retry() {} }),
    React.createElement(ConnectionPills, { state, phase: "live" }),
    React.createElement(TelemetryFreshness, { state, phase: "live" }))));
  try {
    receive(); await render();
    assert.equal(timers.size, 1);
    for (let i = 0; i < 4; i++) {
      now += 5000; receive(); await render(); // Deliberately never fire the clock timer.
      assert.equal(dom.window.document.querySelector(".workspace-health").dataset.state, "online");
      assert.doesNotMatch(dom.window.document.body.textContent, /clock mismatch|telemetry unavailable/);
    }
    visibility = "hidden"; now += 60_000;
    await act(async () => { for (const tick of timers.values()) tick(); });
    visibility = "visible";
    await act(async () => dom.window.document.dispatchEvent(new dom.window.Event("visibilitychange")));
    assert.equal(dom.window.document.querySelector(".workspace-health").dataset.state, "stale");
    assert.match(dom.window.document.body.textContent, /Minecraft: stale/);
    receive(); await render();
    assert.equal(dom.window.document.querySelector(".workspace-health").dataset.state, "online");
    now += 60_000;
    state = applyControlMessage(state, { type: "server.event", serverId: "A", eventType: "telemetry.system", agentKind: "HOST", agentSession: "host-1", body: { capturedAt: new Date(now).toISOString() } });
    await render();
    assert.equal(dom.window.document.querySelector(".workspace-health").dataset.state, "stale");
    assert.match(dom.window.document.body.textContent, /Host: live/);
  } finally {
    await act(async () => root.unmount());
    assert.equal(timers.size, 0);
    Date.now = originalNow; globalThis.setInterval = originalInterval; globalThis.clearInterval = originalClear;
    dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});

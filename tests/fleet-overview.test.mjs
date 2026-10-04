import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FleetFeed } from "../.test-dist/lib/fleet-feed.js";
import { boundNode, fleetCard, nodeSummaries } from "../.test-dist/lib/fleet-model.js";
import { FLEET_CONTRACT_ID } from "../.test-dist/lib/fleet-contract.js";
import { ACTION_CONTRACT_ID } from "../.test-dist/lib/scopes.js";
import { applyControlMessage, emptyControlState, compatibleActionTarget } from "../.test-dist/lib/control-state.js";
import { DashboardRequestError } from "../.test-dist/lib/data-source.js";
import { FleetOverview } from "../.test-dist/app/fleet-overview.js";
const A = "10000000-0000-4000-8000-000000000001", B = "10000000-0000-4000-8000-000000000002";
const NODE = "20000000-0000-4000-8000-000000000001", OTHER = "20000000-0000-4000-8000-000000000002";
const credential = serverId => ({ protocolVersion: 3, serverId, deviceId: "browser", name: "Browser device", role: "viewer",
  scopes: ["server.status"], accessToken: "synthetic-private-grant", websocketUrl: "wss://relay.example.invalid/v1/dashboard", expiresAt: new Date(Date.now() + 60_000).toISOString() });
const grant = c => ({ ...c, actionContract: ACTION_CONTRACT_ID, token: c.accessToken });
const ready = (id, nodeId = NODE, overrides = {}) => ({ type: "dashboard.ready", serverId: id, protocolVersion: 3,
  actionContract: ACTION_CONTRACT_ID, version: "4.0.0", device: { deviceId: "browser", role: "viewer", scopes: ["server.status"] },
  agents: { paper: true, host: true, hostInstalled: true }, server: { serverName: id === A ? "Alpha" : "Bravo", nodeId,
    fleetState: "BOUND", fleetContract: FLEET_CONTRACT_ID, paperSession: "paper-1", hostSession: "host-1" }, ...overrides });
function state(id, nodeId = NODE) {
  const value = applyControlMessage(emptyControlState(id), ready(id, nodeId));
  const capturedAt = new Date().toISOString();
  value.server = { capturedAt, onlinePlayers: 3, tps: [20], averageTickMillis: 12 };
  value.hostSystem = { nodeId, processRole: "HOST", metricScope: "NODE", capturedAt, hostCpuPercent: 35,
    physicalMemoryUsedBytes: 8e9, physicalMemoryTotalBytes: 24e9, diskUsedBytes: 39e9, diskTotalBytes: 145e9 };
  value.service = { state: "active", resources: { capturedAt, scope: "MINECRAFT_SERVICE", source: "SYSTEMD_CGROUP",
    cpuUnit: "PERCENT_OF_ONE_CORE", cpuAvailable: true, cpuPercent: 150, memoryAvailable: true, memoryBytes: 4e9 } };
  return value;
}
class Socket {
  readyState = 1; sent = []; closed = false;
  send(message) { this.sent.push(JSON.parse(message)); }
  close() { this.closed = true; this.readyState = 3; }
  message(value) { this.onmessage?.({ data: JSON.stringify(value) }); }
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test("fleet feed reuses sessions, rejects cross-room events, and keeps credentials out of published snapshots", async () => {
  const sockets = []; let snapshots = [];
  const roster = [credential(A), credential(B)];
  const feed = new FleetFeed(value => snapshots = value, { grant: async c => grant(c), socket: () => { const s = new Socket(); sockets.push(s); return s; } });
  try {
    feed.updateRoster(roster, A); await flush();
    assert.equal(sockets.length, 1);
    sockets[0].onopen(); sockets[0].message(ready(B));
    sockets[0].message({ type: "server.event", serverId: A, agentKind: "PAPER", agentSession: "paper-1", eventType: "telemetry.server", body: { onlinePlayers: 999 } });
    sockets[0].message({ type: "server.event", serverId: B, agentKind: "HOST", agentSession: "host-1", eventType: "console.lines", body: { lines: [{ line: "private-console-content" }] } });
    feed.updateRoster(roster, A);
    assert.equal(sockets.length, 1);
    assert.deepEqual(snapshots[0].state.server, {});
    assert.deepEqual(snapshots[0].state.console, []);
    assert.doesNotMatch(JSON.stringify(snapshots), /synthetic-private-grant|private-console-content|websocketUrl/);
    assert.deepEqual(sockets[0].sent, []);
    feed.updateRoster(roster, B); await flush();
    assert.equal(sockets[0].closed, true); assert.equal(sockets.length, 2);
    sockets[0].message(ready(B));
    assert.equal(snapshots[0].serverId, A);
  } finally { feed.close(); }
});

test("one revoked background server does not revoke another, and a changed credential starts a new session", async () => {
  const sockets = []; let snapshots = [];
  const roster = [credential(A), credential(B)];
  const feed = new FleetFeed(value => snapshots = value, {
    grant: async c => { if (c.serverId === A && c.accessToken === "synthetic-private-grant") throw new DashboardRequestError("private upstream detail", 403); return grant(c); },
    socket: () => { const s = new Socket(); sockets.push(s); return s; },
  });
  try {
    feed.updateRoster(roster, ""); await flush();
    sockets[0].message(ready(B));
    assert.equal(snapshots.find(s => s.serverId === A).phase, "revoked");
    assert.equal(snapshots.find(s => s.serverId === B).phase, "live");
    feed.updateRoster([{ ...roster[0], accessToken: "rotated-synthetic-grant" }, roster[1]], ""); await flush();
    assert.equal(sockets.length, 2);
    sockets[1].message(ready(A, NODE, { device: { deviceId: "different-device", role: "viewer", scopes: ["server.status"] } }));
    assert.equal(snapshots.find(s => s.serverId === A).phase, "revoked");
    assert.equal(snapshots.find(s => s.serverId === B).phase, "live");
  } finally { feed.close(); }
});

test("subscription limit counts the selected socket and ignores a late grant after unsubscription", async () => {
  let calls = 0, snapshots = [], resolve;
  const feed = new FleetFeed(value => snapshots = value, { grant: c => { calls++; return new Promise(r => resolve = () => r(grant(c))); }, socket: () => { throw new Error("late grant must not create a socket"); } });
  const roster = Array.from({ length: 18 }, (_, index) => credential(`server-${index}`));
  feed.updateRoster(roster, "server-0");
  assert.equal(calls, 15); assert.equal(snapshots.filter(s => s.phase === "limited").length, 2);
  feed.close(); resolve(); await flush();
});

test("shared node totals use one fresh Host sample, separate nodes stay separate, stale and Paper data stay unavailable", () => {
  const first = state(A), second = state(B);
  assert.equal(nodeSummaries([first, second], Date.now()).length, 1);
  assert.equal(nodeSummaries([first, second], Date.now())[0].usedMemory, 8e9);
  assert.equal(nodeSummaries([first, second], Date.now())[0].servers, 2);
  assert.equal(nodeSummaries([first, state(B, OTHER)], Date.now()).length, 2);
  first.hostSystem.processRole = "MINECRAFT"; second.hostSystem.capturedAt = new Date(Date.now() - 31_000).toISOString();
  assert.equal(nodeSummaries([first, second], Date.now())[0].cpu, null);
  first.ready.agents.host = false; first.hostSystem = state(A).hostSystem;
  assert.equal(nodeSummaries([first], Date.now())[0].usedMemory, null);
  first.ready.server.fleetContract = "wrong"; assert.equal(boundNode(first), null);
});

test("cards distinguish service one-core CPU from node CPU and do not fabricate stale or missing metrics", () => {
  const value = state(A), card = fleetCard(value, "live", Date.now());
  assert.equal(card.status, "online"); assert.equal(card.serviceCpu, 150); assert.equal(card.players, 3);
  assert.equal(card.serviceState, "active");
  value.service.resources.cpuAvailable = false;
  assert.equal(fleetCard(value, "live", Date.now()).serviceCpu, null);
  value.server.capturedAt = new Date(Date.now() - 31_000).toISOString();
  assert.equal(fleetCard(value, "live", Date.now()).status, "stale"); assert.equal(fleetCard(value, "live", Date.now()).players, null);
  value.ready.agents.paper = false; value.service.state = "inactive";
  assert.equal(fleetCard(value, "live", Date.now()).status, "offline");
  assert.match(fleetCard(value, "live", Date.now()).reason, /Minecraft is inactive/);
  assert.equal(fleetCard(value, "revoked", Date.now()).serviceMemory, null);
});

test("Host replacement clears old metrics and ignores delayed old-session events", () => {
  let value = state(A);
  value = applyControlMessage(value, ready(A, NODE, { server: { ...ready(A).server, hostSession: "host-2" } }));
  assert.deepEqual(value.hostSystem, {}); assert.deepEqual(value.service, {});
  const stale = applyControlMessage(value, { type: "server.event", serverId: A, agentKind: "HOST", agentSession: "host-1", eventType: "telemetry.system", body: { hostCpuPercent: 100 } });
  assert.equal(stale, value);
  const forged = applyControlMessage(value, { type: "server.event", serverId: A, agentKind: "PAPER", agentSession: "paper-1", eventType: "service.status", body: { state: "active" } });
  assert.equal(forged, value);
});

test("fleet rendering exposes selected-server navigation and unavailable metrics without credentials", () => {
  const html = renderToStaticMarkup(React.createElement(FleetOverview, { credentials: [credential(A), credential(B)],
    selected: state(A), connected: true, openServer() {}, pair() {} }));
  assert.match(html, /Your servers/); assert.match(html, /Open Alpha 10000000/); assert.match(html, /100% = one CPU core/);
  assert.match(html, /Unavailable/); assert.doesNotMatch(html, /synthetic-private-grant/);
});

test("mixed-version fleet hides service/node totals and blocks Host controls", () => {
  const a = state(A); a.ready.server.pluginVersion = "5.0.0"; a.ready.server.hostVersion = "3.5.0";
  a.ready.server.hostTargetCompatible = false; a.ready.server.paperTargetCompatible = true;
  assert.equal(compatibleActionTarget(a.ready, "HOST"), false);
  assert.equal(compatibleActionTarget(a.ready, "PAPER"), true);
  assert.equal(fleetCard(a, "live", Date.now()).status, "degraded");
  assert.equal(fleetCard(a, "live", Date.now()).serviceMemory, null);
  assert.equal(fleetCard(a, "live", Date.now()).serviceState, "unavailable");
  assert.deepEqual(nodeSummaries([a], Date.now()), []);
  delete a.ready.server.paperTargetCompatible;
  assert.equal(compatibleActionTarget(a.ready, "PAPER"), false);
  a.ready.server.pluginVersion = "4.0.0"; a.ready.server.hostVersion = "4.0.0";
  assert.equal(compatibleActionTarget(a.ready, "PAPER"), true);
});

test("selector remembers labels while connections are unavailable and distinguishes them from browser device names", () => {
  const html = renderToStaticMarkup(React.createElement(FleetOverview, { credentials: [credential(A), credential(B)],
    selected: emptyControlState(A), connected: false, phase: "reconnecting", labels: { [A]: "PlexonCraft", [B]: "TonimSMP" }, openServer() {}, pair() {} }));
  assert.match(html, /PlexonCraft/); assert.match(html, /TonimSMP/);
  assert.match(html, /Last selected/); assert.match(html, /Continue to workspace/);
  assert.match(html, /Relay unavailable/); assert.match(html, /Connecting/);
  assert.doesNotMatch(html, /Browser device|synthetic-private-grant/);
});

test("a relay socket that never supplies an authenticated ready cannot remain connecting indefinitely", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const sockets = [];
  const feed = new FleetFeed(() => {}, { grant: async c => grant(c), socket: () => { const socket = new Socket(); sockets.push(socket); return socket; } });
  try {
    feed.updateRoster([credential(A)], ""); await flush();
    sockets[0].onopen();
    t.mock.timers.tick(10_000);
    assert.equal(sockets[0].closed, true);
  } finally { feed.close(); t.mock.timers.reset(); }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyControlMessage,
  emptyControlState,
  safeCache,
  number,
  diagnostics,
} from "../.test-dist/lib/control-state.js";
import { canAction } from "../.test-dist/lib/scopes.js";
const id = "server-fixture";
const event = (eventType, body, agentKind = "PAPER") => ({
  type: "server.event",
  serverId: id,
  eventType,
  body,
  agentKind,
});
const ready = {
  serverId: id,
  agents: { paper: true, host: false },
  server: { capabilities: {}, paperCapabilities: {}, hostCapabilities: {} },
  device: { deviceId: "device", scopes: [] },
};
test("CPU zero is a real sample; missing host CPU never becomes process CPU", () => {
  assert.equal(number(0), 0);
  assert.equal(number(-1), null);
  assert.equal(number(undefined), null);
  let s = { ...emptyControlState(id), ready };
  s = applyControlMessage(
    s,
    event("telemetry.system", {
      hostCpuPercent: null,
      processCpuPercent: 20,
      physicalMemoryUsedBytes: 1000,
      jvmHeapUsedBytes: 100,
    }),
  );
  assert.equal(s.history.at(-1).hostCpu, null);
  assert.equal(s.history.at(-1).processCpu, 20);
  assert.equal(s.history.at(-1).heap, 100);
  assert.equal(s.history.at(-1).memory, 1000);
});
test("offline Paper is not plotted as fresh data when the host keeps reporting", () => {
  let s = {
    ...emptyControlState(id),
    ready: { ...ready, agents: { paper: false, host: true } },
    server: { tps: [20], averageTickMillis: 4 },
    system: { processCpuPercent: 12 },
  };
  s = applyControlMessage(
    s,
    event("telemetry.system", { hostCpuPercent: 7 }, "HOST"),
  );
  assert.equal(s.history.at(-1).tps, null);
  assert.equal(s.history.at(-1).processCpu, null);
  assert.equal(s.history.at(-1).hostCpu, 7);
});
test("cross-server and incompatible-ready events cannot contaminate the workspace", () => {
  const s = emptyControlState(id);
  assert.equal(
    applyControlMessage(s, {
      ...event("console.lines", { lines: [{ content: "foreign" }] }),
      serverId: "another",
    }),
    s,
  );
  assert.equal(
    applyControlMessage(s, {
      type: "dashboard.ready",
      serverId: id,
      protocolVersion: 2,
      device: { deviceId: "fake" },
    }),
    s,
  );
});
test("inventory pagination never combines snapshots or appends a missing first page", () => {
  let s = emptyControlState(id);
  const chunk = (snapshotId, offset, players) =>
    event("inventory.players", { snapshotId, offset, players });
  assert.equal(applyControlMessage(s, chunk("a", 1, [{ name: "second" }])), s);
  s = applyControlMessage(s, chunk("a", 0, [{ name: "first" }]));
  assert.equal(applyControlMessage(s, chunk("b", 1, [{ name: "wrong" }])), s);
  s = applyControlMessage(s, chunk("a", 1, [{ name: "second" }]));
  assert.deepEqual(
    s.players.map((p) => p.name),
    ["first", "second"],
  );
});
test("console and cache remain bounded and exclude players, files and action results", () => {
  let s = emptyControlState(id);
  for (let i = 0; i < 100; i++)
    s = applyControlMessage(
      s,
      event("console.lines", {
        lines: Array.from({ length: 100 }, (_, j) => ({
          content: `${i}-${j}`,
        })),
      }),
    );
  s.players = [{ address: "192.0.2.1", position: { x: 1 } }];
  s = applyControlMessage(
    s,
    event("action.result", { data: { content: "private file content" } }),
  );
  const c = safeCache(s);
  assert.equal(s.console.length, 600);
  assert.equal(c.console.length, 200);
  assert.equal(c.players.length, 0);
  assert.ok(!JSON.stringify(c).includes("private file content"));
  assert.ok(!JSON.stringify(c).includes("192.0.2.1"));
  assert.equal(c.cached, true);
});
test("UI actions require the intersection of exact scopes and local capabilities", () => {
  assert.equal(
    canAction("files.delete", ["files.write"], { "files.delete": true }),
    false,
  );
  assert.equal(
    canAction("player.op", ["player.op"], { "player.op": false }),
    false,
  );
  assert.equal(
    canAction("files.write", ["files.write"], { "files.write": true }),
    true,
  );
  assert.ok(!diagnostics(emptyControlState(id)).includes("undefined"));
});

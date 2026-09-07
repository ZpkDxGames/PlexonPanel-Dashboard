import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyControlMessage,
  emptyControlState,
  safeCache,
  number,
  diagnostics,
  capturedAtMillis,
  CONTROL_HISTORY_MAX_POINTS,
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
test("CPU zero is a real sample and Paper process metrics never masquerade as Host metrics", () => {
  assert.equal(number(0), 0);
  assert.equal(number(-1), null);
  assert.equal(number(undefined), null);
  let s = { ...emptyControlState(id), ready };
  s = applyControlMessage(
    s,
    event("telemetry.system", {
      capturedAt: "2026-09-07T17:00:00.250Z",
      hostCpuPercent: 42,
      processCpuPercent: 20,
      physicalMemoryUsedBytes: 1000,
      jvmHeapUsedBytes: 100,
    }),
  );
  assert.equal(s.history.at(-1).hostCpu, null);
  assert.equal(s.history.at(-1).memory, null);
  assert.equal(s.history.at(-1).processCpu, 20);
  assert.equal(s.history.at(-1).heap, 100);
});
test("Host telemetry owns machine CPU and memory while Paper remains independently unavailable", () => {
  let s = {
    ...emptyControlState(id),
    ready: { ...ready, agents: { paper: false, host: true } },
    server: { tps: [20], averageTickMillis: 4 },
    system: { processCpuPercent: 12, jvmHeapUsedBytes: 120 },
  };
  s = applyControlMessage(
    s,
    event(
      "telemetry.system",
      {
        capturedAt: "2026-09-07T17:00:00.500Z",
        hostCpuPercent: 7,
        physicalMemoryUsedBytes: 2048,
      },
      "HOST",
    ),
  );
  assert.equal(s.history.at(-1).tps, null);
  assert.equal(s.history.at(-1).processCpu, null);
  assert.equal(s.history.at(-1).heap, null);
  assert.equal(s.history.at(-1).hostCpu, 7);
  assert.equal(s.history.at(-1).memory, 2048);
});
test("telemetry history uses trusted source capture timestamps at sub-second cadence", () => {
  let s = { ...emptyControlState(id), ready };
  s = applyControlMessage(
    s,
    event("telemetry.server", {
      capturedAt: "2026-09-07T17:00:00.250Z",
      tps: [20],
      averageTickMillis: 2.5,
      onlinePlayers: 3,
    }),
  );
  s = applyControlMessage(
    s,
    event("telemetry.server", {
      capturedAt: "2026-09-07T17:00:00.500Z",
      tps: [19.98],
      averageTickMillis: 3.25,
      onlinePlayers: 3,
    }),
  );
  assert.deepEqual(
    s.history.map((sample) => sample.at),
    [Date.parse("2026-09-07T17:00:00.250Z"), Date.parse("2026-09-07T17:00:00.500Z")],
  );
  assert.equal(s.history.at(-1).tps, 19.98);
  assert.equal(s.history.at(-1).mspt, 3.25);
  assert.equal(capturedAtMillis("not-an-instant"), null);
});
test("same captured instant replaces rather than duplicates a chart sample", () => {
  let s = { ...emptyControlState(id), ready };
  const capturedAt = new Date().toISOString();
  s = applyControlMessage(
    s,
    event("telemetry.server", {
      capturedAt,
      tps: [20],
      averageTickMillis: 2,
      onlinePlayers: 1,
    }),
  );
  s = applyControlMessage(
    s,
    event("telemetry.server", {
      capturedAt,
      tps: [19],
      averageTickMillis: 4,
      onlinePlayers: 2,
    }),
  );
  assert.equal(s.history.length, 1);
  assert.equal(s.history[0].tps, 19);
  assert.equal(s.history[0].players, 2);
});
test("unrelated telemetry snapshots do not duplicate performance history", () => {
  let s = { ...emptyControlState(id), ready };
  s = applyControlMessage(
    s,
    event("telemetry.server", {
      capturedAt: new Date().toISOString(),
      tps: [20],
      averageTickMillis: 2,
    }),
  );
  const length = s.history.length;
  s = applyControlMessage(
    s,
    event("telemetry.worlds", { worlds: [{ name: "world" }] }),
  );
  assert.equal(s.history.length, length);
});
test("high-frequency telemetry history remains strictly bounded", () => {
  const now = Date.now();
  const history = Array.from({ length: CONTROL_HISTORY_MAX_POINTS + 20 }, (_, index) => ({
    at: now - (CONTROL_HISTORY_MAX_POINTS + 20 - index) * 250,
    tps: 20,
    mspt: 2,
    hostCpu: null,
    processCpu: 10,
    heap: 100,
    memory: null,
    players: 1,
    gc: 0,
  }));
  let s = { ...emptyControlState(id), ready, history };
  s = applyControlMessage(
    s,
    event("telemetry.server", {
      capturedAt: new Date(now).toISOString(),
      tps: [20],
      averageTickMillis: 2,
      onlinePlayers: 1,
    }),
  );
  assert.equal(s.history.length, CONTROL_HISTORY_MAX_POINTS);
  assert.ok(s.history.every((sample, index, all) => index === 0 || all[index - 1].at <= sample.at));
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
  const chunk = (snapshotId, offset, players, complete = false) =>
    event("inventory.players", {
      snapshotId,
      offset,
      players,
      complete,
      capturedAt: "2026-09-06T12:00:00Z",
    });
  assert.equal(applyControlMessage(s, chunk("a", 1, [{ name: "second" }])), s);
  s = applyControlMessage(s, chunk("a", 0, [{ name: "first" }]));
  assert.deepEqual(s.players, [], "an incomplete roster is not authoritative");
  assert.equal(applyControlMessage(s, chunk("b", 1, [{ name: "wrong" }])), s);
  s = applyControlMessage(s, chunk("a", 1, [{ name: "second" }], true));
  assert.deepEqual(
    s.players.map((p) => p.name),
    ["first", "second"],
  );
});
test("presence deltas are idempotent and an old session cannot remove a reconnect", () => {
  let s = emptyControlState(id);
  const joined = event("players.presence", {
    eventId: "event-1",
    sessionId: "session-1",
    uuid: "player-1",
    name: "Alex",
    state: "JOINED",
    observedAt: "2026-09-06T12:00:01Z",
  });
  s = applyControlMessage(s, joined);
  assert.equal(s.players.length, 1);
  assert.equal(applyControlMessage(s, joined), s, "duplicate event is ignored");
  s = applyControlMessage(
    s,
    event("players.presence", {
      ...joined.body,
      eventId: "event-2",
      sessionId: "session-2",
      observedAt: "2026-09-06T12:00:02Z",
    }),
  );
  s = applyControlMessage(
    s,
    event("players.presence", {
      ...joined.body,
      eventId: "event-3",
      state: "LEFT",
      observedAt: "2026-09-06T12:00:03Z",
    }),
  );
  assert.equal(s.players[0].sessionId, "session-2");
});
test("a complete snapshot replays only deltas newer than its capture", () => {
  let s = {
    ...emptyControlState(id),
    ready: {
      ...ready,
      server: { ...ready.server, paperSession: "paper-session" },
    },
  };
  s = applyControlMessage(
    s,
    {
      ...event("players.presence", {
        eventId: "event-after",
        sessionId: "session-new",
        uuid: "new-player",
        name: "New",
        state: "JOINED",
        observedAt: "2026-09-06T12:00:00.000000001Z",
      }),
      agentSession: "paper-session",
    },
  );
  s = applyControlMessage(
    s,
    {
      ...event("inventory.players", {
        snapshotId: "snapshot",
        offset: 0,
        complete: true,
        capturedAt: "2026-09-06T12:00:00Z",
        players: [
          { uuid: "existing", name: "Existing", sessionId: "session-existing" },
        ],
      }),
      agentSession: "paper-session",
    },
  );
  assert.deepEqual(
    s.players.map((player) => player.name).sort(),
    ["Existing", "New"],
  );
  assert.equal(
    applyControlMessage(s, {
      ...event("players.presence", {
        eventId: "foreign-event",
        sessionId: "foreign",
        uuid: "foreign",
        name: "Foreign",
        state: "JOINED",
        observedAt: "2026-09-06T12:00:02Z",
      }),
      agentSession: "old-paper-session",
    }),
    s,
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
  assert.equal(c.presenceDeltas.length, 0);
  assert.equal(c.presenceEventIds.length, 0);
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

import test from "node:test";
import assert from "node:assert/strict";
import {
  consoleRowId,
  parseLine,
  tokenize,
  chipTone,
} from "../src/ui/console/parse-line";
import { msptDomain, buildTimeTicks, buildRows } from "../src/ui/chart/scales";
import {
  emptyControlState,
  safeCache,
  applyControlMessage,
  type Sample,
} from "../src/adapter/control-state";
test("parser strips duplicate clocks and plugin brackets into four visual fields", () => {
  const p = parseLine(
    "a",
    "[12:03:04 INFO]: [12:03:04 INFO]: [voicechat] Ready",
  );
  assert.equal(p.time, "12:03:04");
  assert.equal(p.level, "INFO");
  assert.equal(p.tag, "voicechat");
  assert.deepEqual(p.body, [{ t: "text", v: "Ready" }]);
});
test("WARN, ERROR, thread-only and continuation lines remain renderable", () => {
  assert.equal(
    parseLine("a", "[12:03:04] [Server thread/WARN]: Slow tick").level,
    "WARN",
  );
  assert.equal(
    parseLine("b", "[12:03:04 ERROR]: [MiniMOTD] Failure").tag,
    "MiniMOTD",
  );
  assert.equal(
    parseLine("c", "    at java.lang.Thread.run(Thread.java:1)").kind,
    "continuation",
  );
  assert.equal(
    parseLine("d", "[Server thread/INFO]: Ready").thread,
    "Server thread",
  );
});
test("garbage parser inputs never throw", () => {
  for (const value of [
    null,
    undefined,
    {},
    Symbol("x"),
    {
      toString() {
        throw Error();
      },
    },
    123,
    "\u001b[31m[12:03:04 INFO]: Ready",
  ])
    assert.doesNotThrow(() => parseLine("x", value));
});
test("URL tokens preserve trailing punctuation as text; plugin hues are stable", () => {
  assert.deepEqual(tokenize("See https://example.com/a., next"), [
    { t: "text", v: "See " },
    { t: "url", v: "https://example.com/a" },
    { t: "text", v: ".," },
    { t: "text", v: " next" },
  ]);
  assert.equal(chipTone("voicechat"), chipTone("voicechat"));
  assert.ok(!["amber", "rose"].includes(chipTone("voicechat")));
});
test("a single 128ms startup spike never dictates the MSPT scale", () => {
  assert.deepEqual(msptDomain([]), [0, 60]);
  assert.deepEqual(msptDomain([128]), [0, 60]);
  assert.deepEqual(msptDomain([22, 23, 24, 128]), [0, 60]);
  assert.ok(msptDomain(Array(300).fill(90))[1] >= 90);
  assert.ok(msptDomain([NaN, Infinity, -2])[1] >= 50);
});
for (const minutes of [5, 15, 60, 360])
  test(`time ticks never duplicate labels at ${minutes} minutes`, () => {
    const r = buildTimeTicks(0, minutes * 60000, (t, seconds) =>
      new Date(t).toISOString().slice(11, seconds ? 19 : 16),
    );
    const labels = r.ticks.map((t) =>
      new Date(t).toISOString().slice(11, r.withSeconds ? 19 : 16),
    );
    assert.equal(new Set(labels).size, labels.length);
  });
test("constant time formatters terminate without duplicate labels", () =>
  assert.ok(buildTimeTicks(0, 3600000, () => "same").ticks.length <= 1));
const sample = (at: number, epoch: string): Sample => ({
  at,
  epoch,
  tps: 20,
  mspt: 25,
  p95: 40,
  p99: 55,
  hostCpu: 30,
  processCpu: 20,
  heap: 100,
  memory: 1000,
  players: 1,
  gc: 0,
  sources: {
    paperHealth: at,
    paperSystem: at,
    hostSystem: at + 200,
    service: at + 500,
  },
  serviceCpu: 140,
  serviceMemory: 80,
});
test("buildRows inserts null epoch boundaries and keeps independent Host captures", () => {
  const r = buildRows([sample(1000, "a"), sample(2000, "b")], 60);
  assert.ok(r.paper.some((s) => s.mspt === null));
  assert.equal(r.gaps.length, 1);
  assert.equal(r.host[0].t, 1200);
  assert.equal(r.service[0].t, 1500);
  assert.equal(r.paper[0].t, 1000);
  assert.deepEqual(r.paper[0].band, [40, 55]);
});
test("unclamped MSPT and reported bands survive chart projection", () => {
  const r = buildRows([{ ...sample(1000, "a"), mspt: 128 }], 60);
  assert.equal(r.paper[0].mspt, 60);
  assert.equal(r.paper[0].mspt_raw, 128);
});
test("persistable cache never contains console or chat", () => {
  const s = emptyControlState("a");
  s.console = [{ content: "private" }];
  s.chat = [{ message: "private" }];
  assert.deepEqual(safeCache(s).console, []);
  assert.deepEqual(safeCache(s).chat, []);
});
test("Host boot reset clears volatile data and retains a graph boundary", () => {
  const s = emptyControlState("a");
  s.console = [{ content: "old" }];
  s.players = [{ uuid: "old" }];
  s.service = { invocationId: "old" };
  s.history = [sample(1000, "old")];
  const n = applyControlMessage(s, {
    type: "server.event",
    serverId: "a",
    agentKind: "HOST",
    eventType: "session.epoch_reset",
    body: { epoch: "new" },
  });
  assert.equal(n.console.length, 0);
  assert.equal(n.players.length, 0);
  assert.equal(n.history.at(-1)?.mspt, null);
  assert.equal(n.service.invocationId, "new");
});

test("history and live logs share stable Host identities without array indexes", () => {
  assert.equal(
    consoleRowId({ id: "database:1", journalCursor: "cursor-A" }, "boot"),
    consoleRowId(
      { journalCursor: "cursor-A", streamSession: "stream", sourceSequence: 2 },
      "boot",
    ),
  );
  assert.equal(
    consoleRowId({ streamSession: "stream", sourceSequence: 2 }, "boot"),
    "stream:stream:2",
  );
  assert.equal(
    consoleRowId({ capturedAt: "t", content: "line" }, "boot"),
    consoleRowId({ capturedAt: "t", content: "line" }, "boot"),
  );
});

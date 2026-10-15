import test from "node:test";
import assert from "node:assert/strict";
import {
  displaySegments,
  historyFor,
  cadence,
  gcMovement,
  verifiedNodes,
} from "../src/presentation/telemetry";
import { makeFixture } from "../src/development/fixtures";
import type { Sample } from "../src/adapter/control-state";
const sample = (at: number, value: number | null): Sample => ({
  at,
  tps: value,
  mspt: null,
  heap: null,
  memory: null,
  players: null,
  gc: null,
  hostCpu: null,
  processCpu: null,
});
test("display reduction preserves gaps, isolated points, extrema and endpoints without mutating source", () => {
  const data = Array.from({ length: 8192 }, (_, i) =>
    sample(i * 250, i === 3131 ? 1000 : 20),
  );
  data[4000].tps = null;
  const saved = structuredClone(data);
  const segments = displaySegments(data, "tps", 400);
  assert.equal(segments.length, 2);
  assert.ok(segments.flat().length <= 410);
  assert.ok(segments.flat().some((s) => s.tps === 1000));
  assert.equal(segments[0][0], data[0]);
  assert.equal(segments.at(-1)!.at(-1), data.at(-1));
  assert.deepEqual(data, saved);
  assert.equal(displaySegments(data, "tps", 400), segments);
  assert.equal(
    displaySegments([sample(1, 0), sample(20000, 1)], "tps").length,
    2,
  );
  assert.equal(displaySegments([sample(1, NaN)], "tps").length, 0);
});
test("source capture projection does not resample Paper on Host time", () => {
  const points = [
    {
      ...sample(1000, 20),
      sources: {
        paperHealth: 500,
        paperSystem: null,
        hostSystem: 1000,
        service: null,
      },
    },
    {
      ...sample(2000, 20),
      sources: {
        paperHealth: 500,
        paperSystem: null,
        hostSystem: 2000,
        service: null,
      },
    },
  ];
  assert.deepEqual(
    historyFor(points, "paperHealth").map((s) => s.at),
    [500],
  );
  assert.deepEqual(
    historyFor(points, "hostSystem").map((s) => s.at),
    [1000, 2000],
  );
});
test("cadence metadata is optional and validated; GC counter resets are not negative rates", () => {
  for (const value of [
    null,
    undefined,
    0,
    -1,
    "250",
    NaN,
    Infinity,
    1.5,
    3600001,
  ])
    assert.equal(cadence(value), null);
  assert.equal(cadence(250), 250);
  assert.equal(
    gcMovement([
      { ...sample(1, 20), gc: 100 },
      { ...sample(60001, 20), gc: 10 },
    ]),
    null,
  );
});
test("fleet node totals require matching authenticated identity, NODE scope and fresh Host; shared node counted once", () => {
  const now = Date.now(),
    state = makeFixture("healthy", now),
    id = "edfc80d2-c550-4dbd-b739-0121b71de224";
  state.ready!.server.nodeId = id;
  state.hostSystem.nodeId = id;
  state.hostSystem.metricScope = "NODE";
  assert.equal(
    verifiedNodes(
      [
        { phase: "live", state },
        { phase: "live", state: structuredClone(state) },
      ],
      now,
    ).length,
    1,
  );
  assert.equal(
    verifiedNodes([{ phase: "live", state }], now + 31000).length,
    0,
  );
  state.hostSystem.nodeId = "other";
  assert.equal(verifiedNodes([{ phase: "live", state }], now).length, 0);
});
test("time windows apply to each source capture rather than the latest unrelated packet", () => {
  const points = [
    {
      ...sample(20000, 20),
      sources: {
        paperHealth: 1000,
        paperSystem: 9000,
        hostSystem: 20000,
        service: null,
      },
    },
  ];
  assert.equal(historyFor(points, "paperHealth", 10000).length, 0);
  assert.equal(historyFor(points, "paperSystem", 10000).length, 0);
  assert.equal(historyFor(points, "hostSystem", 10000).length, 1);
});

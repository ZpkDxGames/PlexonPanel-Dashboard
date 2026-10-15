import assert from "node:assert/strict";
import test from "node:test";
import { chartMaximum, chartPaths, chartTimeAt } from "../src/components/charts/geometry";
import type { Sample } from "../src/adapter/control-state";

const sample = (at: number, tps: number | null): Sample => ({ at, tps, mspt: null, hostCpu: null, processCpu: null, heap: null, memory: null, players: null, gc: null });
const identity = (value: number) => value;

test("chart fills and strokes do not bridge nulls, nonfinite readings, or time gaps", () => {
  const paths = chartPaths([sample(0, 20), sample(3000, 19), sample(6000, null), sample(9000, 18), sample(12000, NaN), sample(15000, 20), sample(30000, 19)], "tps", identity, identity, 100);
  assert.equal(paths.length, 4);
  assert.equal(paths[0].line, "M0.00,20.00L3000.00,19.00");
  assert.equal(paths[0].area, "M0.00,20.00L3000.00,19.00L3000.00,100L0.00,100Z");
  assert.deepEqual(paths[1].point, { x: 9000, y: 18 });
  assert.equal(paths[3].line, "M30000.00,19.00");
  assert.ok(paths.every((path) => !path.area.includes("NaN")));
});

test("chart ranges keep a 20 TPS scale, contain outliers, and reserve the threshold", () => {
  assert.equal(chartMaximum([19, 20], 20), 20);
  assert.ok(chartMaximum([125], 100) >= 125);
  assert.ok(chartMaximum([12], undefined, 50) >= 50);
  assert.ok(chartMaximum([]) > 0);
  assert.ok(Number.isFinite(chartMaximum([Infinity, NaN])));
});

test("crosshair mapping accounts for plot padding and viewport scaling", () => {
  // SVG width 600, rendered at 300px; plot runs from x=46 to x=588.
  assert.equal(chartTimeAt(123, 100, 300, 600, 46, 588, 1000, 2000), 1000);
  assert.equal(chartTimeAt(394, 100, 300, 600, 46, 588, 1000, 2000), 2000);
  assert.equal(chartTimeAt(258.5, 100, 300, 600, 46, 588, 1000, 2000), 1500);
  assert.equal(chartTimeAt(90, 100, 300, 600, 46, 588, 1000, 2000), 1000);
});

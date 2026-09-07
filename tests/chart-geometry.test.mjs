import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSvgPaths,
  gapSegments,
  nearestValueIndex,
  resolveDomain,
  seriesStats,
  thinSegment,
  windowedPoints,
} from "../.test-dist/lib/chart-geometry.js";

test("series statistics preserve zero as a real value", () => {
  const stats = seriesStats([
    { at: 1, value: 0 },
    { at: 2, value: 0 },
    { at: 3, value: null },
  ]);
  assert.deepEqual(stats, {
    current: 0,
    minimum: 0,
    maximum: 0,
    average: 0,
    p95: 0,
    count: 2,
  });
});

test("empty and all-null series stay unavailable", () => {
  assert.equal(seriesStats([]).current, null);
  assert.equal(seriesStats([{ at: 1, value: null }]).count, 0);
});

test("gap segmentation never connects across missing samples", () => {
  const segments = gapSegments([
    { at: 1, value: 10 },
    { at: 2, value: 11 },
    { at: 3, value: null },
    { at: 4, value: 14 },
    { at: 5, value: null },
    { at: 6, value: 16 },
  ]);
  assert.deepEqual(segments.map((segment) => segment.map((point) => point.at)), [
    [1, 2],
    [4],
    [6],
  ]);
});

test("high-frequency SVG thinning stays bounded and preserves local extrema", () => {
  const points = Array.from({ length: 4_000 }, (_, index) => ({
    at: index,
    value: index === 1777 ? 999 : index === 2333 ? -50 : index % 100,
  }));
  const thinned = thinSegment(points, 800);
  assert.ok(thinned.length <= 800);
  assert.equal(thinned[0].at, 0);
  assert.equal(thinned.at(-1).at, 3999);
  assert.ok(thinned.some((point) => point.value === 999));
  assert.ok(thinned.some((point) => point.value === -50));
});

test("percentage, capacity and adaptive domains are stable and truthful", () => {
  assert.deepEqual(resolveDomain([23, 80], { percentage: true }), [0, 100]);
  assert.deepEqual(resolveDomain([100, 250], { capacity: 1000 }), [0, 1000]);
  assert.deepEqual(resolveDomain([19, 20], { fixed: [0, 20] }), [0, 20]);
  const adaptive = resolveDomain([5, 7], { reference: 50 });
  assert.ok(adaptive[0] >= 0);
  assert.ok(adaptive[1] >= 50);
});

test("nearest selection clamps naturally to first/last available value", () => {
  const points = [
    { at: 100, value: 1 },
    { at: 200, value: null },
    { at: 300, value: 3 },
  ];
  assert.equal(nearestValueIndex(points, -100), 0);
  assert.equal(nearestValueIndex(points, 1000), 2);
  assert.equal(nearestValueIndex(points, 240), 2);
  assert.equal(nearestValueIndex([{ at: 1, value: null }], 1), null);
});

test("window filtering uses the newest sample as the browser-local tail", () => {
  const end = 10 * 60_000;
  const history = [
    { at: end - 31 * 60_000, value: 1 },
    { at: end - 15 * 60_000, value: 2 },
    { at: end - 5 * 60_000, value: 3 },
    { at: end, value: 4 },
  ];
  assert.deepEqual(windowedPoints(history, 5).map((point) => point.value), [3, 4]);
  assert.deepEqual(windowedPoints(history, 15).map((point) => point.value), [2, 3, 4]);
  assert.equal(windowedPoints([], 5).length, 0);
});

test("SVG paths create separate subpaths and close area fills at the baseline", () => {
  const segments = gapSegments([
    { at: 0, value: 0 },
    { at: 1, value: 1 },
    { at: 2, value: null },
    { at: 3, value: 2 },
  ]);
  const paths = buildSvgPaths(
    segments,
    (at) => at * 10,
    (value) => 100 - value * 10,
    100,
  );
  assert.match(paths.line, /^M0\.0,100\.0 L10\.0,90\.0 M30\.0,80\.0$/);
  assert.equal((paths.area.match(/ Z/g) ?? []).length, 2);
});

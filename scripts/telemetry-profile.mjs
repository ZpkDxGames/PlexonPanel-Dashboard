import { performance } from "node:perf_hooks";
import { mkdir, writeFile } from "node:fs/promises";
import { chartPaths } from "../src/components/charts/geometry.ts";
import { displaySegments } from "../src/presentation/telemetry.ts";
const samples = Array.from({ length: 8192 }, (_, i) => ({
  at: i * 250,
  tps: i === 3131 ? 5 : i === 4000 ? null : 19.8 + Math.sin(i / 30) * 0.2,
  mspt: null,
  hostCpu: null,
  processCpu: null,
  heap: null,
  memory: null,
  players: null,
  gc: null,
}));
const x = (at) => (at / 2048000) * 1000,
  y = (value) => 200 - value * 10;
function measure(fn, count = 250) {
  const times = [];
  let chars = 0;
  for (let i = 0; i < count; i++) {
    const t = performance.now();
    chars = fn().join("").length;
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  return {
    iterations: count,
    medianMs: times[Math.floor(count * 0.5)],
    p95Ms: times[Math.floor(count * 0.95)],
    pathCharacters: chars,
  };
}
const baseline = measure(() =>
  chartPaths(samples, "tps", x, y, 200).map((p) => p.line + p.area),
);
const reduced = displaySegments(samples, "tps", 480);
const after = measure(() =>
  displaySegments(samples, "tps", 480).flatMap((segment) =>
    chartPaths(segment, "tps", x, y, 200).map((p) => p.line + p.area),
  ),
);
const cold = measure(() => {
  const copy = samples.map((s) => ({ ...s }));
  return displaySegments(copy, "tps", 480).flatMap((segment) =>
    chartPaths(segment, "tps", x, y, 200).map((p) => p.line + p.area),
  );
}, 100);
const report = {
  fixture: "synthetic 8192 observations; one null and one sharp drop",
  scope:
    "Display path generation only; excludes React, browser painting and transport",
  baseline,
  afterCached: after,
  afterColdIncludingCopy: cold,
  rawPoints: samples.length,
  renderedPoints: reduced.flat().length,
  rawUnchanged: samples[3131].tps === 5 && samples[4000].tps === null,
};
await mkdir("artifacts", { recursive: true });
await writeFile(
  "artifacts/telemetry-profile.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));

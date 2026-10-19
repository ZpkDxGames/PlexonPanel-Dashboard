import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  SERIES,
  GROUPS,
  seriesKey,
  shapeTelemetry,
  segments,
  gapsFor,
  sampleAt,
  decimate,
  memDomain,
  type Sample,
} from "../src/ui/telemetry/series";
import { crosshair, useCrosshair } from "../src/ui/telemetry/crosshair";
import { makeFixture } from "../src/development/fixtures";
import { validateViewSync } from "../src/ui/bindings/view-sync";
test("canonical signals retain aliases and share a memory scale while preserving CPU bursts", () => {
  assert.equal(GROUPS.flatMap((g) => g.series).length, 12);
  for (const [old, key] of Object.entries({
    mspt: "mean",
    heap: "heapUsed",
    cpu: "svcCpu",
    node: "nodeCpu",
    max: "committed",
    peak: "svcCpu",
  }))
    assert.equal(seriesKey(old), key);
  const rows: Sample[] = [
    {
      t: 1,
      epoch: "a",
      mean: 0.6,
      heapUsed: 2,
      committed: 5,
      cgroup: 8,
      svcCpu: 146,
    },
  ];
  assert.equal(SERIES.mean.domain(rows)[1], 16);
  assert.equal(SERIES.mean.budget!.value, 50);
  assert.ok(SERIES.mean.domain([{ ...rows[0], mean: 58 }])[1] >= 58);
  for (const key of ["heapUsed", "committed", "cgroup"] as const)
    assert.deepEqual(SERIES[key].domain(rows), memDomain(rows));
  assert.ok(SERIES.svcCpu.domain(rows)[1] > 146);
  assert.deepEqual(SERIES.nodeCpu.domain(rows), [0, 100]);
  assert.equal(SERIES.tps.fmt(null), "—");
  assert.equal(
    validateViewSync({
      studioMode: "split",
      activeSeries: "heapUsed",
      playerEventFilter: "death",
    }).studioMode,
    "split",
  );
});
test("telemetry shaping preserves independent clocks, missing values and GC epoch resets", () => {
  const fixture = makeFixture(),
    base = fixture.history[0];
  const paper = [
    {
      ...base,
      at: 1000,
      epoch: "paper-a",
      tps: 20,
      mspt: null,
      chunks: 77,
      sources: undefined,
    },
    { ...base, at: 3000, epoch: "paper-b", tps: 19, sources: undefined },
  ];
  const system = [
    {
      ...base,
      at: 1500,
      epoch: "sys-a",
      gc: 100,
      heap: 2 ** 30,
      committed: 2 * 2 ** 30,
      sources: undefined,
    },
    { ...base, at: 3500, epoch: "sys-a", gc: 110, sources: undefined },
    { ...base, at: 5500, epoch: "sys-b", gc: 5, sources: undefined },
  ];
  const host = [
      { ...base, at: 2200, epoch: "host-a", hostCpu: 14, sources: undefined },
    ],
    service = [
      {
        ...base,
        at: 2400,
        epoch: "host-a",
        serviceCpu: 146,
        serviceMemory: 4 * 2 ** 30,
        sources: undefined,
      },
    ];
  const out = shapeTelemetry({ paper, system, host, service });
  assert.equal(out.find((s) => s.t === 1000)?.mean, null);
  assert.equal(out.find((s) => s.t === 1500)?.heapUsed, 1);
  assert.equal(out.find((s) => s.t === 2400)?.svcCpu, 146);
  assert.equal(out.find((s) => s.t === 2400)?.cgroup, 4);
  assert.equal(out.find((s) => s.t === 1500)?.gc, null);
  assert.equal(out.find((s) => s.t === 3500)?.gc, 10);
  assert.equal(out.find((s) => s.t === 5500)?.gc, null);
  assert.equal(out.find((s) => s.t === 2200)?.nodeCpu, 14);
  assert.equal(out.find((s) => s.t === 2200)?.tps, undefined);
  assert.equal(segments(out, "tps").length, 2);
  assert.equal(segments(out, "nodeCpu").length, 1);
});
test("source-specific segments and crosshair lookups do not bridge nulls, restarts or time gaps", () => {
  const rows: Sample[] = [
    { t: 1000, epoch: "a", mean: 1 },
    { t: 2000, epoch: "host", svcCpu: 20 },
    { t: 3000, epoch: "a", mean: null },
    { t: 4000, epoch: "a", mean: 2 },
    { t: 6000, epoch: "b", mean: 3 },
    { t: 20000, epoch: "b", mean: 4 },
  ];
  assert.equal(segments(rows, "mean").length, 4);
  assert.deepEqual(gapsFor(rows, "mean"), [
    { from: 1000, to: 4000 },
    { from: 4000, to: 6000 },
    { from: 6000, to: 20000 },
  ]);
  for (const t of [2000, 3000, 5000, 15000])
    assert.equal(sampleAt(rows, t, "mean"), undefined);
  assert.equal(sampleAt(rows, 4000, "mean")?.mean, 2);
  assert.equal(sampleAt(rows, 2000, "svcCpu")?.svcCpu, 20);
});
test("crosshair does not extrapolate source values into unretained or unavailable time", () => {
  const rows: Sample[] = [
    { t: 1000, epoch: "a", mean: null },
    { t: 2000, epoch: "a", mean: 2 },
    { t: 3000, epoch: "host", svcCpu: 40 },
    { t: 4000, epoch: "a", mean: null },
  ];
  for (const t of [0, 1000, 1500, 3500, 4000, 5000])
    assert.equal(sampleAt(rows, t, "mean"), undefined);
  assert.equal(sampleAt(rows, 2000, "mean")?.mean, 2);
  assert.equal(sampleAt(rows, 3000, "svcCpu")?.svcCpu, 40);
});
test("decimation keeps first/last and interior dips/spikes", () => {
  const xs = Array.from({ length: 1000 }, (_, i) => ({
    i,
    v: i === 500 ? 1000 : i === 600 ? -1000 : 0,
  }));
  for (const peak of ["min", "max"] as const) {
    const out = decimate(xs, 30, (s) => s.v, peak);
    assert.equal(out.length, 30);
    assert.equal(out[0], xs[0]);
    assert.equal(out.at(-1), xs.at(-1));
    assert.ok(out.includes(xs[peak === "max" ? 500 : 600]));
  }
});
test("crosshair coalesces pointer updates once per frame and has a null SSR snapshot", () => {
  const original = globalThis.requestAnimationFrame;
  const callbacks: FrameRequestCallback[] = [];
  let notifications = 0;
  globalThis.requestAnimationFrame = (fn) => {
    callbacks.push(fn);
    return callbacks.length;
  };
  const off = crosshair.subscribe(() => notifications++);
  try {
    crosshair.set(100);
    crosshair.set(200);
    crosshair.set(300);
    assert.equal(callbacks.length, 1);
    callbacks.shift()!(0);
    assert.equal(crosshair.get(), 300);
    assert.equal(notifications, 1);
    function Probe() {
      return React.createElement("span", null, String(useCrosshair()));
    }
    assert.equal(
      renderToString(React.createElement(Probe)),
      "<span>null</span>",
    );
    crosshair.set(null);
    callbacks.shift()!(0);
    assert.equal(crosshair.get(), null);
  } finally {
    off();
    if (original) globalThis.requestAnimationFrame = original;
    else Reflect.deleteProperty(globalThis, "requestAnimationFrame");
  }
});

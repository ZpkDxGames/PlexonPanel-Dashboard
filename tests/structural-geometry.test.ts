import test from "node:test";
import assert from "node:assert/strict";
import { softBreak, stripSoftBreaks } from "../src/ui/console/softBreak";
import { monotone } from "../src/ui/studio/geometry";
test("semantic log breaks are fully reversible, including long coordinate tails", () => {
  const raw =
    "NEGUINCOMCEROL[/168.194.144.215:33319] logged in with entity id 186275 at ([world]454.339389, 73.0, 1168.182264153791)";
  assert.ok(softBreak(raw).includes("\u200B"));
  assert.equal(stripSoftBreaks(softBreak(raw)), raw);
  assert.equal(
    stripSoftBreaks(softBreak("https://example.org/a?x=12&y=3")),
    "https://example.org/a?x=12&y=3",
  );
});
test("monotone chart interpolation never introduces an extremum between same-direction samples", () => {
  for (const ys of [
    [1, 2, 3, 9],
    [9, 5, 4, 1],
    [1, 5, 2, 4],
    [3, 3, 3, 3],
  ]) {
    const pts = ys.map((y, x) => ({ x: x * 10, y })),
      d = monotone(pts);
    assert.ok(!/NaN|Infinity/.test(d));
    const groups = [
      ...d.matchAll(
        /C([\d.e+-]+),([\d.e+-]+) ([\d.e+-]+),([\d.e+-]+) ([\d.e+-]+),([\d.e+-]+)/g,
      ),
    ];
    assert.equal(groups.length, 3);
    groups.forEach((m, i) => {
      const low = Math.min(ys[i], ys[i + 1]),
        high = Math.max(ys[i], ys[i + 1]);
      for (const y of [Number(m[2]), Number(m[4])])
        assert.ok(y >= low && y <= high);
    });
  }
});
test("chart geometry handles absent and single point signals", () => {
  assert.equal(monotone([]), "");
  assert.equal(monotone([{ x: 3, y: 7 }]), "M3,7");
});

import { sourceLedger } from "../src/ui/bindings";
import { makeFixture } from "../src/development/fixtures";
test("a fresh health packet cannot conceal stale JVM or service evidence", () => {
  const now = Date.now(),
    s = makeFixture("healthy", now);
  s.system.capturedAt = new Date(now - 60000).toISOString();
  s.receipts!.paperSystem = now - 60000;
  (s.service.resources as Record<string, unknown>).capturedAt = new Date(
    now - 60000,
  ).toISOString();
  s.receipts!.service = now - 60000;
  const l = sourceLedger(s, now);
  assert.equal(l.paperHealth.state, "live");
  assert.equal(l.paperSystem.state, "stale");
  assert.equal(l.hostSystem.state, "live");
  assert.equal(l.service.state, "stale");
});

import { richBody, readableColor } from "../src/ui/console/rich-body";
import { parseLine } from "../src/ui/console/parse-line";
test("rich log formatting keeps color and weight after clock and plugin boilerplate removal", () => {
  const raw = "[12:03:04 INFO]: [LuckPerms] §a§lReady";
  const spans = richBody(raw, parseLine("id", raw));
  assert.equal(spans.map((s) => s.text).join(""), "Ready");
  assert.equal(spans[0].style.bold, true);
  assert.ok(spans[0].style.color);
});
test("Minecraft text colors adapt to the surface without accepting unsafe CSS", () => {
  assert.equal(readableColor("url(example)", true), undefined);
  assert.notEqual(readableColor("#55ff55", true), "rgb(85 255 85)");
  assert.equal(readableColor("#55ff55", false), "rgb(85 255 85)");
});

import { metricList } from "../src/ui/studio/TelemetryStudio";
import type { TelemetryView } from "../src/ui/bindings";
test("each studio view retains exactly five distinct metric selectors", () => {
  const t = {
    paper: [],
    system: [],
    host: [],
    service: [],
    raw: [],
    now: 0,
    since: 0,
    tps: 20,
    mspt: 10,
    p95: 15,
    p99: 20,
    gc: 0,
    heap: 1,
    committed: 2,
    max: 4,
    cgroup: 3,
    cpu: 1,
    nodeCpu: 2,
    cores: 1,
  } satisfies TelemetryView;
  for (const view of ["tick", "memory", "cpu"] as const) {
    const metrics = metricList(t, view);
    assert.equal(metrics.length, 5, view);
    assert.equal(new Set(metrics.map((m) => m.id)).size, 5, view);
  }
});

import { presentLine } from "../src/ui/console/present-line";
test("console timestamps honor UTC even when the producer embeds a different clock", () => {
  const raw = {
    id: "clock",
    content: "[22:15:00 INFO]: [Server] Ready",
    capturedAt: "2026-10-19T12:00:00Z",
    level: "INFO",
  };
  const row = presentLine(raw, "boot", "UTC");
  assert.equal(row.time, "12:00:00");
  assert.equal(row.iso, "2026-10-19T12:00:00.000Z");
  assert.equal(raw.content, "[22:15:00 INFO]: [Server] Ready");
});

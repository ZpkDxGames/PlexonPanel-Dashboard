import test from "node:test";
import assert from "node:assert/strict";
import { groupLogs, parseLog } from "../src/lib/log-parser";
import { domain, monotone, sampleStats, windowStart } from "../src/lib/chart";
import { duration, relative } from "../src/lib/format";
import { schedulePreview } from "../src/lib/cron-preview";
import { makeFixture } from "../src/development/fixtures";
import type { MaintenanceSettings } from "../src/adapter/maintenance";
test("console parser accepts modern, legacy, plugins and inert markup", () => {
  assert.equal(
    parseLog({ content: "[12:30:40] [Server thread/INFO]: [Paper] Ready" })
      .source,
    "Paper",
  );
  assert.equal(
    parseLog({ content: "[12:30:40 WARN]: Can't keep up!" }).kind,
    "lag",
  );
  assert.equal(
    parseLog({ content: "<img src=x onerror=alert(1)>" }).message,
    "<img src=x onerror=alert(1)>",
  );
});
test("console groups stack traces and identical lines without dropping first raw line", () => {
  const e = groupLogs([
    { content: "[WorldGuard] Failed", level: "ERROR" },
    { content: "\tat test.Class.run(Class.java:1)" },
    { content: "Caused by: java.lang.IllegalStateException: World" },
    { content: "Ready" },
    { content: "Ready" },
  ]);
  assert.equal(e.length, 2);
  assert.equal(e[0].trace.length, 2);
  assert.equal(e[1].count, 2);
  assert.match(e[0].raw, /WorldGuard/);
});
test("flat TPS stays legible and its lag threshold remains in view", () => {
  const [lo, hi] = domain([20, 20, 20], 3, 18);
  assert.ok(lo < 18 && hi > 20);
  assert.ok(hi - lo >= 3);
  const [cpuLo, cpuHi] = domain([0.2, 0.3], 20);
  assert.equal(cpuLo, 0);
  assert.ok(cpuHi >= 10);
});
test("chart monotone path preserves endpoints and avoids invalid values", () => {
  const p = monotone([
    [0, 3],
    [2, 5],
    [4, 4],
  ]);
  assert.match(p, /^M0\.00,3\.00C/);
  assert.ok(!p.includes("NaN"));
  assert.equal(monotone([]), "");
  assert.equal(windowStart([{ at: 1 }, { at: 4 }, { at: 8 }], 4), 1);
  assert.equal(windowStart([{ at: 1 }, { at: 4 }], 9), 2);
  assert.equal(sampleStats([0, 0])?.average, 0);
});
test("human formats retain zero and unknown states", () => {
  assert.equal(duration(0), "0m");
  assert.equal(duration(null), "—");
  assert.equal(relative("bad"), "Time unavailable");
  assert.equal(relative(0, 120000), "2 min ago");
});
test("maintenance preview respects declared timezone and disabled state", () => {
  const settings = {
    timezone: "America/Sao_Paulo",
    restart: {
      schedule: { enabled: true, type: "DAILY", weekdays: [], time: "04:00" },
    },
  } as unknown as MaintenanceSettings;
  assert.equal(
    schedulePreview(settings),
    "Every day at 04:00 · America/Sao_Paulo",
  );
  settings.restart.schedule.enabled = false;
  assert.equal(schedulePreview(settings), "Automatic restart is off");
});
test("demo idle has honest zero players and production adapter is not needed", () => {
  const idle = makeFixture("idle");
  assert.equal(idle.players.length, 0);
  assert.equal(idle.server.onlinePlayers, 0);
  assert.equal(idle.history.at(-1)?.tps, 20);
});

import { stableDomain, resample } from '../src/lib/chart';
test('quiet telemetry cannot repeatedly rescale its axis',()=>{
 const bounds=stableDomain([19.8,20],3);
 assert.deepEqual(stableDomain([19.81,19.99],3,bounds),bounds);
 const spike=stableDomain([12,20],3,bounds);
 assert.ok(spike[0]<=12&&spike[1]>=20);
 assert.deepEqual(stableDomain([19.9,20],3,spike),spike);
 assert.deepEqual(stableDomain([19.9,20],3,spike,true),bounds);
});
test('bounded chart geometry preserves endpoints and input samples',()=>{
 const points:[number,number][]=[[0,10],[10,30],[20,15]];
 const copy=JSON.stringify(points),out=resample(points,320);
 assert.equal(out.length,320);assert.deepEqual(out[0],points[0]);assert.deepEqual(out.at(-1),points.at(-1));assert.equal(JSON.stringify(points),copy);
 assert.ok(out.every(p=>p[1]>=10&&p[1]<=30));
});

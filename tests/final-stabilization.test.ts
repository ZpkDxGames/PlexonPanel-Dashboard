import assert from "node:assert/strict";
import test from "node:test";
import { applyControlMessage } from "../src/adapter/control-state";
import { makeFixture } from "../src/development/fixtures";
import { paperProcessUptime } from "../src/lib/uptime";
import { duration } from "../src/lib/format";
import {
  appendResource,
  collectResources,
  resourceWindow,
  resourceSegments,
  resourceScale,
  type ResourceSeries,
  type ResourcePoint,
} from "../src/lib/resource-series";
import { backupView, effectiveBackupPhase } from "../src/lib/backup-model";
const at = Date.now();
const point = (
  time: number,
  value: number | null = 10,
  session = "a",
  cadence = 1000,
): ResourcePoint => ({
  source: "paper",
  session,
  capturedAt: time,
  receivedAt: time + 200,
  sourceIntervalMillis: cadence,
  value,
});
test("Paper uptime uses the emitted field, accepts zero and stays unavailable when missing", () => {
  const s = makeFixture();
  s.system.processUptimeMillis = 0;
  s.system.capturedAt = new Date(at).toISOString();
  s.receipts!.paperSystem = at;
  assert.equal(paperProcessUptime(s, at), 0);
  delete s.system.processUptimeMillis;
  assert.equal(paperProcessUptime(s, at), null);
  assert.equal(duration(60000), "1m");
  assert.equal(duration(3600000), "1h 0m");
  assert.equal(duration(3 * 86400000 + 60000), "3d 0h 1m");
});
test("Paper restart clears uptime; same session reconnect preserves it; old session cannot overwrite", () => {
  let s = makeFixture();
  s.system.processUptimeMillis = 99000;
  const ready = { ...s.ready!, type: "dashboard.ready" };
  s = applyControlMessage(s, ready);
  assert.equal(s.system.processUptimeMillis, 99000);
  s = applyControlMessage(s, {
    ...ready,
    server: { ...ready.server, paperSession: "new" },
  });
  assert.equal(s.system.processUptimeMillis, undefined);
  const send = (session: string, value: number) => ({
    type: "server.event",
    serverId: s.serverId,
    agentKind: "PAPER",
    agentSession: session,
    eventType: "telemetry.system",
    body: {
      capturedAt: new Date(at).toISOString(),
      processUptimeMillis: value,
    },
  });
  s = applyControlMessage(s, send("new", 0));
  s = applyControlMessage(s, send("fixture-paper", 99000));
  assert.equal(s.system.processUptimeMillis, 0);
});
test("independent 250ms / 1s series retain their own clocks without fake rows", () => {
  let s = collectResources(
    {},
    "telemetry.system",
    "PAPER",
    "p",
    {
      capturedAt: new Date(at).toISOString(),
      sourceIntervalMillis: 250,
      processCpuPercent: 5,
    },
    at + 500,
  );
  s = collectResources(
    s,
    "telemetry.system",
    "HOST",
    "h",
    {
      capturedAt: new Date(at + 700).toISOString(),
      sourceIntervalMillis: 1000,
      hostCpuPercent: 90,
    },
    at + 1200,
  );
  assert.deepEqual(
    resourceWindow(s.processCpu, at, at + 5000).map((p) => p.capturedAt),
    [at],
  );
  assert.deepEqual(
    resourceWindow(s.hostCpu, at, at + 5000).map((p) => p.capturedAt),
    [at + 700],
  );
  assert.equal(s.processCpu!.pages[0][0].receivedAt, at + 500);
});
test("missing, gap, process restart and session rollover never connect", () => {
  assert.equal(
    resourceSegments(
      [point(0), point(1000), point(2000, null), point(3000), point(10000)],
      0,
      10000,
      200,
    ).length,
    3,
  );
  assert.equal(
    resourceSegments([point(0), point(250), point(1250)], 0, 2000, 200).length,
    1,
  );
  assert.equal(
    resourceSegments(
      [point(0, 10, "a", 250), point(1000, 10, "a", 250)],
      0,
      2000,
      200,
    ).length,
    2,
  );
  assert.equal(
    resourceSegments(
      [
        { ...point(0), processSession: "pid1" },
        { ...point(1000), processSession: "pid2" },
      ],
      0,
      2000,
      200,
    ).length,
    2,
  );
  let s = appendResource(undefined, point(1000));
  s = appendResource(s, point(2000, 20, "b"));
  assert.equal(resourceWindow(s, 0, 5000).length, 1);
  assert.equal(appendResource(s, point(1500, 30, "b")), s);
});
test("window selection covers all required ranges and append does not copy retained points", () => {
  let s: ResourceSeries | undefined;
  for (let i = 0; i < 8400; i++) s = appendResource(s, point(at + i * 250));
  for (const window of [30000, 60000, 300000, 600000]) {
    const end = at + 8399 * 250;
    const visible = resourceWindow(s, end - window, end);
    assert.equal(visible.length, window / 250 + 1);
  }
  const prior = s!;
  s = appendResource(s, point(at + 8400 * 250));
  assert.equal(s.pages[0], prior.pages[0]);
});
test("scale contraction depends on elapsed calm time, independent of packet count", () => {
  const initial = { max: 128, calmSince: null };
  let a = resourceScale(initial, 10, 0);
  for (let t = 1; t < 30000; t++) a = resourceScale(a, 10, t);
  assert.equal(a.max, 128);
  assert.equal(resourceScale(a, 10, 30000).max, 16);
  assert.equal(resourceScale(initial, 300, 0).max, 512);
});
test("durable recovery wins over missing preflight and stale progress, missing IDs do not match", () => {
  const input = {
    hostLive: true,
    preflight: {},
    maintenance: {
      jobRecoveryRequired: true,
      currentOperation: { jobId: "a", phase: "RECOVERY_REQUIRED" },
    },
    phasePush: {
      jobId: "a",
      phase: "ARCHIVING",
      capturedAt: new Date().toISOString(),
    },
    progress: { jobId: "a", phase: "ARCHIVING" },
    backups: [],
  };
  const view = backupView(input);
  assert.equal(view.health, "recovery");
  assert.equal(view.phase, "RECOVERY_REQUIRED");
  assert.equal(view.ready, false);
  assert.equal(effectiveBackupPhase({}, { phase: "ARCHIVING" }), "IDLE");
  assert.equal(
    backupView({ ...input, maintenance: {}, phasePush: {}, progress: null })
      .health,
    "checking",
  );
});
test("remote retry evidence never fabricates a completed maintenance job", () => {
  const view = backupView({
    hostLive: true,
    preflight: {},
    maintenance: {
      currentOperation: { jobId: "a", backupId: "b", phase: "DEGRADED" },
    },
    phasePush: {},
    progress: null,
    backups: [{ backupId: "b", offsite: true }],
  });
  assert.equal(view.resolvedAfterRetry, true);
  assert.equal(view.operation.phase, "DEGRADED");
});

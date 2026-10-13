import { test } from "node:test";
import assert from "node:assert/strict";
import { backupView } from "../src/lib/backup-model";
const base = { hostLive: true, preflight: {}, phasePush: {}, progress: null, backups: [] };
test("durable terminal failures remain visible while fresh preflight evidence is missing", () => {
  for (const phase of ["DEGRADED", "FAILED"]) {
    const model = backupView({ ...base, maintenance: { currentOperation: { jobId: "job-a", phase } } });
    assert.equal(model.health, phase.toLowerCase());
    assert.equal(model.ready, false);
  }
});
test("newer Host phase starts a distinct job without inheriting previous job fields", () => {
  const durable = { jobId: "old", phase: "COMPLETED", backupId: "previous", updatedAt: "2026-10-13T10:00:00Z" };
  const pushed = { jobId: "new", phase: "COUNTDOWN", phaseTimestamp: "2026-10-13T10:01:00Z" };
  const view = backupView({ ...base, maintenance: { currentOperation: durable }, phasePush: pushed });
  assert.equal(view.health, "running");
  assert.equal(view.operation.jobId, "new");
  assert.equal(view.operation.backupId, undefined);
  const delayed = backupView({ ...base, maintenance: { currentOperation: durable },
    phasePush: { ...pushed, phaseTimestamp: "2026-10-13T09:59:00Z", capturedAt: "2026-10-13T10:02:00Z" } });
  assert.equal(delayed.operation.jobId, "old");
});
test("phase push alone reconstructs an active job while the first query is pending", () => {
  const view = backupView({ ...base, maintenance: {},
    phasePush: { jobId: "new", phase: "ARCHIVING", capturedAt: "2026-10-13T10:01:00Z" } });
  assert.equal(view.health, "running");
  assert.equal(view.ready, false);
});

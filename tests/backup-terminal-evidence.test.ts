import { test } from "node:test";
import assert from "node:assert/strict";
import { backupView } from "../src/lib/backup-model";
test("durable terminal failures remain visible while fresh preflight evidence is missing", () => {
  for (const phase of ["DEGRADED", "FAILED"]) {
    const model = backupView({
      hostLive: true, preflight: {}, phasePush: {}, progress: null, backups: [],
      maintenance: { currentOperation: { jobId: "job-a", phase } },
    });
    assert.equal(model.health, phase.toLowerCase());
    assert.equal(model.ready, false);
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  BACKUP_TIMELINE,
  backupHealth,
  backupReady,
  backupRecoveryRequired,
  effectiveBackupPhase,
  retryUploadAvailable,
  stepState,
} from "../src/lib/backup-model";

test("durable maintenance recovery blocks backup readiness even when restore recovery is clear", () => {
  const preflight = {
    hostAuthenticated: true,
    operationBusy: false,
    recoveryRequired: false,
    backupRootWritable: true,
    commandChannelConfigured: true,
    hostConfigRestartRequired: false,
  };
  const maintenance = { jobRecoveryRequired: true, restoreRecoveryRequired: false };
  const operation = { phase: "RECOVERY_REQUIRED", restartRecoveryRequired: true };

  assert.equal(backupRecoveryRequired(preflight, maintenance, operation), true);
  assert.equal(backupReady(preflight, maintenance, operation), false);
  assert.equal(
    backupHealth({
      hostLive: true,
      ready: false,
      recovery: true,
      operation,
    }),
    "recovery",
  );
});

test("verified local degraded job exposes retry upload", () => {
  assert.equal(
    retryUploadAvailable({
      phase: "DEGRADED",
      backupId: "11111111-1111-1111-1111-111111111111",
      localBackupVerified: true,
      remoteBackupVerified: false,
    }),
    true,
  );
});

test("live backup progress may refine the durable phase for the same job", () => {
  assert.equal(
    effectiveBackupPhase(
      {
        jobId: "job-a",
        backupId: "backup-a",
        phase: "ARCHIVING",
      },
      {
        jobId: "job-a",
        backupId: "backup-a",
        phase: "UPLOADING_REMOTE",
      },
    ),
    "UPLOADING_REMOTE",
  );
  assert.equal(
    effectiveBackupPhase(
      {
        jobId: "job-a",
        backupId: "backup-a",
        phase: "ARCHIVING",
      },
      {
        jobId: "stale-job",
        backupId: "stale-backup",
        phase: "UPLOADING_REMOTE",
      },
    ),
    "ARCHIVING",
  );
});

test("timeline distinguishes completed, degraded and recovery outcomes", () => {
  const offsite = BACKUP_TIMELINE.find((step) => step.key === "offsite")!;
  const restart = BACKUP_TIMELINE.find((step) => step.key === "restart")!;
  const complete = BACKUP_TIMELINE.find((step) => step.key === "complete")!;

  assert.equal(
    stepState(offsite, "DEGRADED", 100, {
      phase: "DEGRADED",
      restartRecoveryRequired: false,
    }),
    "warning",
  );
  assert.equal(
    stepState(restart, "DEGRADED", 100, {
      phase: "DEGRADED",
      restartRecoveryRequired: false,
    }),
    "done",
  );
  assert.equal(
    stepState(complete, "RECOVERY_REQUIRED", 85, {
      phase: "RECOVERY_REQUIRED",
    }),
    "pending",
  );
});

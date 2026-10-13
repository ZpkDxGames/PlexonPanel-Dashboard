import { test } from "node:test";
import assert from "node:assert/strict";
import { backupView } from "../src/lib/backup-model";
const base = { hostLive: true, preflight: {}, maintenance: {}, phasePush: {}, progress: null, backups: [] };
test("known preflight failure is failed, missing evidence stays unknown", () => {
  assert.equal(backupView(base).health, "checking");
  assert.equal(backupView({ ...base, preflightFailure: "BACKUP_SOURCE_UNREADABLE" }).health, "failed");
  assert.equal(backupView({ ...base, preflightFailure: "RCLONE_UNAVAILABLE" }).health, "failed");
});
test("recovery and offline authority take precedence over preflight failure", () => {
  const failed = { ...base, preflightFailure: "BACKUP_SOURCE_UNREADABLE", maintenance: { jobRecoveryRequired: true } };
  assert.equal(backupView(failed).health, "recovery");
  assert.equal(backupView({ ...failed, hostLive: false }).health, "offline");
});

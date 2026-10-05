import assert from "node:assert/strict";
import { test } from "node:test";
import { backupCheckState, backupProviderReadiness, backupProviderSnapshot } from "../.test-dist/lib/backup-readiness.js";
const fresh = { hasSuccess: true, busy: false, error: "", data: { backupRootWritable: true }, failure: null };
test("a missing Drive provider does not invent storage or source failures", () => {
 const query = { ...fresh, hasSuccess: false, error: "No provider", data: {}, failure: { code: "RCLONE_UNAVAILABLE", stage: "provider" } };
 for (const check of ["storage", "source"]) assert.equal(backupCheckState(query, check), "Unknown");
});

test("new successful Drive preflight supersedes an older degraded provider snapshot", () => {
 const provider = { ...fresh, completedAt: 1, data: { configured: true, status: "DEGRADED" } };
 const preflight = { ...fresh, completedAt: 2, data: { providerStatus: "CONNECTED" } };
 assert.equal(backupProviderReadiness(provider, preflight), "Ready");
 assert.equal(backupProviderSnapshot(provider, preflight).data.status, "CONNECTED");
 assert.equal(backupProviderSnapshot(provider, preflight).fromPreflight, true);
 assert.equal(backupProviderReadiness({ ...provider, completedAt: 3 }, preflight), "Failed");
 assert.equal(backupProviderReadiness(provider, { ...preflight, busy: true }), "Unknown");
 assert.equal(backupProviderReadiness({ ...provider, busy: true }, preflight), "Unknown");
});

test("later provider failures and pending refreshes cannot reuse a successful Drive preflight", () => {
 const provider = { ...fresh, completedAt: 3, data: { configured: true, status: "CONNECTED" } };
 const preflight = { ...fresh, completedAt: 2, data: { providerStatus: "CONNECTED" } };
 assert.equal(backupProviderReadiness({ ...provider, error: "Timeout" }, preflight), "Unknown");
 assert.equal(backupProviderReadiness(provider, { ...preflight, completedAt: 4, error: "Drive failed", failure: { code: "RCLONE_TEST_FAILED", stage: "provider" } }), "Failed");
 assert.equal(backupProviderReadiness(provider, { ...preflight, completedAt: 4, error: "No provider", failure: { code: "RCLONE_UNAVAILABLE", stage: "provider" } }), "Not configured");
});
test("only the failing preflight stage is marked failed", () => {
 for (const [code, stage, failed] of [["BACKUP_SOURCE_UNREADABLE", "source", "source"], ["BACKUP_DISK_SPACE_INSUFFICIENT", "capacity", "storage"], ["BACKUP_STAGING_UNAVAILABLE", "storage", "storage"]]) {
  const query = { ...fresh, error: "Failure", failure: { code, stage } };
  assert.equal(backupCheckState(query, failed), "Failed");
  assert.equal(backupCheckState(query, failed === "source" ? "storage" : "source"), "Unknown");
 }
});
test("refresh and unclassified failure do not promote cached success to current readiness", () => {
 assert.equal(backupCheckState({ ...fresh, busy: true }, "storage"), "Unknown");
 assert.equal(backupCheckState({ ...fresh, error: "Timeout" }, "source"), "Unknown");
 assert.equal(backupCheckState(fresh, "storage"), "Ready");
 assert.equal(backupCheckState({ ...fresh, data: { missingIncludes: ["world"] } }, "source"), "Warning");
});

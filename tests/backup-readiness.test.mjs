import assert from "node:assert/strict";
import { test } from "node:test";
import { backupCheckState } from "../.test-dist/lib/backup-readiness.js";
const fresh = { hasSuccess: true, busy: false, error: "", data: { backupRootWritable: true }, failure: null };
test("a missing Drive provider does not invent storage or source failures", () => {
 const query = { ...fresh, hasSuccess: false, error: "No provider", data: {}, failure: { code: "RCLONE_UNAVAILABLE", stage: "provider" } };
 for (const check of ["storage", "source"]) assert.equal(backupCheckState(query, check), "Unknown");
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

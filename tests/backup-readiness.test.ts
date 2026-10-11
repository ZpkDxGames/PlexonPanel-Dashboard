import { test } from "node:test";
import assert from "node:assert/strict";
import {
  backupCheckState,
  backupProviderReadiness,
} from "../src/adapter/backup-readiness";
const base = {
  hasSuccess: false,
  busy: false,
  error: "",
  data: {},
  failure: null,
  completedAt: 0,
};
test("provider connectivity and source/storage failures remain separate", () => {
  assert.equal(backupProviderReadiness(base, base), "Unknown");
  assert.equal(
    backupCheckState(
      {
        ...base,
        error: "rclone failed",
        failure: { code: "REMOTE_VERIFY_FAILED", stage: "provider" },
      },
      "storage",
    ),
    "Unknown",
  );
  assert.equal(
    backupCheckState(
      {
        ...base,
        error: "disk full",
        failure: { code: "BACKUP_DISK_SPACE_LOW", stage: "capacity" },
      },
      "storage",
    ),
    "Failed",
  );
  assert.equal(
    backupCheckState(
      {
        ...base,
        hasSuccess: true,
        data: { backupRootWritable: true },
        completedAt: 10,
      },
      "storage",
    ),
    "Ready",
  );
});
test("new successful preflight supersedes older provider result", () => {
  const provider = {
    ...base,
    hasSuccess: true,
    data: { configured: true, status: "FAILED" },
    completedAt: 1,
  };
  const preflight = {
    ...base,
    hasSuccess: true,
    data: { providerStatus: "CONNECTED" },
    completedAt: 2,
  };
  assert.equal(backupProviderReadiness(provider, preflight), "Ready");
});

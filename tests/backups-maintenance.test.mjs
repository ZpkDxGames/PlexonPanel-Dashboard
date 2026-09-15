import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const BACKUPS_VIEW = "app/backups-view-3-4-1.tsx";

test("Step 8 promotes Fully Backup Now and retires ambiguous backup creation UI", async () => {
  const view = await source(BACKUPS_VIEW);
  for (const text of [
    "Fully Backup Now",
    "Confirm Fully Backup Now",
    "Destructive maintenance confirmation",
    "mandatory 30-minute player warning period",
    "save-all flush",
    "Google Drive/rclone destination",
    "Minecraft automatically restarts",
    "Closing this browser does not cancel the job",
  ]) assert.equal(view.includes(text), true, `missing Step 8 operator contract: ${text}`);

  for (const retired of [
    "Create full restore point",
    "Create live snapshot",
    "Scheduled full backup",
    "Next full restore point",
    "skipCountdown",
    "COORDINATING_PAPER",
  ]) assert.equal(view.includes(retired), false, `retired backup UI remains: ${retired}`);

  assert.equal(view.includes('runOperation("maintenance.full-backup.create", {})'), true);
});

test("Host preflight is authoritative and gates Fully Backup Now", async () => {
  const view = await source(BACKUPS_VIEW);
  for (const marker of [
    'useQuery(\n    "backup.preflight"',
    "preflight.hasSuccess",
    "preflight.data.hostAuthenticated === true",
    "preflight.data.operationBusy !== true",
    "preflight.data.recoveryRequired !== true",
    "preflight.data.backupRootWritable === true",
    "commandChannelConfigured",
    "minecraftReady",
    "canRunFullBackup",
    "maintenance.run",
    "disabled={!actionReady}",
  ]) assert.equal(view.includes(marker), true, `preflight gate missing ${marker}`);

  assert.equal(view.includes('props.can("maintenance.full-backup.create", "HOST")'), true);
  assert.equal(view.includes("Paper is informative only"), true);
  assert.equal(view.includes("Paper dependency"), true);
});

test("durable Host job reconstructs the active timeline after refresh", async () => {
  const view = await source(BACKUPS_VIEW);
  assert.equal(view.includes("status.data.currentOperation"), true);
  assert.equal(view.includes('window.setInterval(status.refresh, 2000)'), true);
  assert.equal(view.includes("phaseTimestamp"), true);
  assert.equal(view.includes("countdownRemainingSeconds"), true);
  assert.equal(view.includes("countdownDeadline"), true);
  assert.equal(view.includes("operationJobId"), true);
  assert.equal(view.includes('str(rawProgress.jobId, "") === operationJobId'), true);
  assert.equal(view.includes("This state is reconstructed from the durable Host job."), true);

  for (const phase of [
    "QUEUED",
    "PREFLIGHT",
    "COUNTDOWN",
    "FINAL_SAVE",
    "STOPPING_SERVER",
    "WAITING_FOR_STOP",
    "ARCHIVING",
    "VERIFYING_LOCAL",
    "UPLOADING_REMOTE",
    "VERIFYING_REMOTE",
    "STARTING_SERVER",
    "VERIFYING_STARTUP",
    "COMPLETED",
  ]) assert.equal(view.includes(`key: \"${phase}\"`), true, `missing Host phase ${phase}`);

  for (const label of [
    "30-minute warning period",
    "Saving server",
    "Confirming shutdown",
    "Creating backup",
    "Uploading to Google Drive",
    "Checking readiness",
  ]) assert.equal(view.includes(label), true, `missing human phase label ${label}`);
});

test("truthful progress and verification details do not invent an ETA", async () => {
  const view = await source(BACKUPS_VIEW);
  for (const marker of [
    "bytesUploaded",
    "totalBytes",
    "progressPercent",
    "localBackupVerified",
    "remoteBackupVerified",
    "Error code",
    "Safe message",
    "No live byte counter reported for this phase",
    "no ETA is invented",
  ]) assert.equal(view.includes(marker), true, `progress marker missing ${marker}`);
});

test("degraded and recovery-required states block or recover safely", async () => {
  const view = await source(BACKUPS_VIEW);
  assert.equal(view.includes('operationPhase === "DEGRADED"'), true);
  assert.equal(view.includes('operationPhase === "RECOVERY_REQUIRED"'), true);
  assert.equal(view.includes("Local backup verified; off-site copy is not current."), true);
  assert.equal(view.includes("Retry Upload does not stop Minecraft again."), true);
  assert.equal(view.includes('runOperation("backup.full.retry-upload"'), true);
  assert.equal(view.includes("Verify & resolve recovery"), true);
  assert.equal(view.includes('props.can("maintenance.recovery.resolve", "HOST")'), true);
  assert.equal(view.includes('runOperation("maintenance.recovery.resolve", {})'), true);
  assert.equal(view.includes("This does not mark the backup successful."), true);
  assert.equal(view.includes("recoveryResolveReady"), true);
  assert.equal(view.includes("!operationBlocking"), true);
  assert.equal(view.includes("!recoveryRequired"), true);
});

test("automatic backups stay retired while restart-only scheduling remains supported", async () => {
  const view = await source(BACKUPS_VIEW);
  assert.equal(view.includes("No automatic full-backup schedule"), true);
  assert.equal(view.includes("Automatic backups are retired."), true);
  assert.equal(view.includes("Restart-only schedule"), true);
  assert.equal(view.includes("Next restart"), true);
  assert.equal(view.includes('runOperation("maintenance.restart.now", {})'), true);
  assert.equal(view.includes("schedule: { ...activeDraft.fullRestorePoint.schedule, enabled: false }"), true);
  assert.equal(view.includes("restartAfter: true"), true);
  assert.equal(view.includes("Restart after backup"), true);
  assert.equal(view.includes("Required"), true);
});

test("restore point controls preserve only supported Host-backed operations", async () => {
  const view = await source(BACKUPS_VIEW);
  for (const action of [
    "backup.full.verify",
    "backup.full.retry-upload",
    "backup.full.restore.prepare",
    "backup.full.restore",
    "backup.full.delete",
    "provider.test",
  ]) assert.equal(view.includes(action), true, `missing supported action ${action}`);
  assert.equal(view.includes("Restore is a separate destructive workflow."), true);
});

test("safe failures remain structured and browser boundary retains provider secrecy", async () => {
  const view = await source(BACKUPS_VIEW);
  const dataSource = await source("lib/data-source.ts");
  for (const field of ["requestId", "action", "status", "code", "phase", "safeRelativePath", "retryable"])
    assert.equal(view.includes(field), true, `failure card missing ${field}`);
  assert.equal(view.includes("Last operation failure"), true);
  assert.equal(view.includes("sessionStorage"), true);
  assert.equal(view.includes("Host-local only"), true);
  assert.equal(view.includes("rcloneConfig"), false);
  assert.equal(view.includes("client_secret"), false);
  assert.equal(view.includes("refresh_token"), false);
  assert.equal(dataSource.includes("readonly requestId = \"\""), true);
});

test("destructive maintenance actions remain capability-gated at browser and relay boundaries", async () => {
  const view = await source(BACKUPS_VIEW);
  const browserScopes = await source("lib/scopes.ts");
  const relayScopes = await source("relay/src/scopes.ts");
  for (const action of [
    "backup.full.delete",
    "backup.full.restore",
    "maintenance.settings.update",
    "maintenance.restart.now",
    "maintenance.full-backup.create",
    "maintenance.recovery.resolve",
  ]) {
    assert.equal(view.includes(action), true, `workspace missing ${action}`);
    assert.equal(browserScopes.includes(`\"${action}\"`), true, `browser HIGH_RISK missing ${action}`);
    assert.equal(relayScopes.includes(`\"${action}\"`), true, `relay HIGH_RISK missing ${action}`);
  }
});

test("responsive Step 8 backup layout avoids global scaling and styles the confirmation surface", async () => {
  const css = await source("app/backups-scaffold.css");
  for (const selector of [
    ".cr341-readiness-grid",
    ".cr341-phase-list",
    ".cr-step8-primary",
    ".cr-step8-modal-backdrop",
    ".cr-step8-confirm-grid",
    ".cr-step8-recovery",
    ".cr-step8-degraded",
  ]) assert.equal(css.includes(selector), true, `missing responsive selector ${selector}`);
  assert.equal(css.includes("@container workspace (max-width: 820px)"), true);
  assert.equal(css.includes("@container workspace (max-width: 480px)"), true);
  assert.equal(/\bzoom\s*:/.test(css), false);
  assert.equal(/transform\s*:\s*scale\s*\(/.test(css), false);
});

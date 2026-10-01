import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const BACKUPS_VIEW = "app/backups-view-3-4-1.tsx";

test("3.5 promotes Fully Backup Now with selectable durable countdowns", async () => {
  const view = await source(BACKUPS_VIEW);
  for (const text of [
    "Fully Backup Now",
    "Confirm Fully Backup Now",
    "Destructive maintenance confirmation",
    "Initial player countdown",
    "30 minutes",
    "15 minutes",
    "10 minutes",
    "5 minutes",
    "save-all flush",
    "Google Drive/rclone destination",
    "Minecraft automatically restarts",
    "continues even if this browser closes or reconnects",
  ]) assert.equal(view.includes(text), true, `missing Step 8 operator contract: ${text}`);

  for (const retired of [
    "Create full restore point",
    "Create live snapshot",
    "Scheduled full backup",
    "Next full restore point",
    "skipCountdown",
    "COORDINATING_PAPER",
  ]) assert.equal(view.includes(retired), false, `retired backup UI remains: ${retired}`);

  assert.equal(view.includes("countdownSeconds: backupCountdownSeconds"), true);
  assert.equal(view.includes('"maintenance.full-backup.create"'), true);
  assert.equal(view.includes('"preconfirmed"'), true);
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
  assert.equal(view.includes("countdownInitialSeconds"), true);
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
    "HASHING",
    "VERIFYING_LOCAL",
    "UPLOADING_REMOTE",
    "VERIFYING_REMOTE",
    "CLEANING_LOCAL",
    "STARTING_SERVER",
    "VERIFYING_STARTUP",
    "COMPLETED",
  ]) assert.equal(view.includes(`key: \"${phase}\"`), true, `missing Host phase ${phase}`);

  for (const label of [
    "Player warning countdown",
    "Saving server",
    "Confirming shutdown",
    "Creating ZIP",
    "Verifying ZIP",
    "Uploading to Google Drive",
    "Removing VPS ZIP",
    "Checking readiness",
  ]) assert.equal(view.includes(label), true, `missing human phase label ${label}`);
});

test("truthful progress and verification details do not invent an ETA", async () => {
  const view = await source(BACKUPS_VIEW);
  for (const marker of [
    "bytesUploaded",
    "bytesPerSecond",
    "totalBytes",
    "progressPercent",
    "localBackupVerified",
    "remoteBackupVerified",
    "Error code",
    "Safe message",
    "No live byte counter reported for this phase",
    "Creating ZIP archive",
    "Uploading ZIP to Google Drive",
    "Removing temporary VPS ZIP",
    "<progress",
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
  assert.equal(view.includes('runOperation("maintenance.recovery.resolve", {}, "preconfirmed")'), true);
  assert.equal(view.includes("This does not mark the backup successful."), true);
  assert.equal(view.includes("recoveryResolveReady"), true);
  assert.equal(view.includes("status.data.commandChannel"), true);
  assert.equal(view.includes("statusCommandChannel.enabled === true"), true);
  assert.equal(view.includes("!operationBlocking"), true);
  assert.equal(view.includes("!recoveryRequired"), true);
});

test("automatic backups stay retired while restart-only scheduling remains supported", async () => {
  const view = await source(BACKUPS_VIEW);
  assert.equal(view.includes("No automatic full-backup schedule"), true);
  assert.equal(view.includes("Automatic backups are retired."), true);
  assert.equal(view.includes("Automatic restart schedule"), true);
  assert.equal(view.includes("Next restart"), true);
  assert.equal(view.includes('runOperation("maintenance.restart.now", {}, "preconfirmed")'), true);
  assert.equal(view.includes("restartCountdown(activeDraft.restart.warningSeconds)"), true);
  assert.equal(view.includes("warningSeconds: countdownWarnings(seconds)"), true);
  assert.equal(view.includes("SELECTED_WEEKDAYS"), true);
  assert.equal(view.includes("cr35-weekday-picker"), true);
  assert.equal(view.includes("Shutdown timeout"), true);
  assert.equal(view.includes("restartAfter: true"), true);
  assert.equal(view.includes("Restart after backup"), true);
  assert.equal(view.includes("Required"), true);
});

test("stable backup history exposes read-only-safe Host operations", async () => {
  const view = await source(BACKUPS_VIEW);
  for (const action of [
    "backup.full.verify",
    "backup.full.retry-upload",
    "backup.full.delete",
    "provider.test",
  ]) assert.equal(view.includes(action), true, `missing supported action ${action}`);
  assert.equal(view.includes('"backup.full.restore.prepare"'), false);
  assert.equal(view.includes('"backup.full.restore"'), false);
  assert.equal(view.includes("Direct server-tree restore is intentionally excluded"), true);
  assert.equal(view.includes("Minecraft tree read-only"), true);
  assert.equal(view.includes("VPS temp released"), true);
  assert.equal(view.includes("Google Drive · VPS temporary ZIP released"), true);
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
    "maintenance.settings.update",
    "maintenance.restart.now",
    "maintenance.full-backup.create",
    "maintenance.recovery.resolve",
  ]) {
    assert.equal(view.includes(action), true, `workspace missing ${action}`);
    assert.equal(browserScopes.includes(`\"${action}\"`), true, `browser HIGH_RISK missing ${action}`);
    assert.equal(relayScopes.includes(`\"${action}\"`), true, `relay HIGH_RISK missing ${action}`);
  }
  for (const compatibilityAction of ["backup.full.restore", "backup.full.restore.prepare"]) {
    assert.equal(view.includes(`"${compatibilityAction}"`), false, `stable view exposes ${compatibilityAction}`);
    assert.equal(browserScopes.includes(`"${compatibilityAction}"`), true, `browser compatibility scope missing ${compatibilityAction}`);
    assert.equal(relayScopes.includes(`"${compatibilityAction}"`), true, `relay compatibility scope missing ${compatibilityAction}`);
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
    ".cr35-backup-hero",
    ".cr35-countdown-grid",
    ".cr35-countdown-option",
    ".cr35-live-progress",
    ".cr35-weekday-picker",
  ]) assert.equal(css.includes(selector), true, `missing responsive selector ${selector}`);
  assert.equal(css.includes("@container workspace (max-width: 820px)"), true);
  assert.equal(css.includes("@container workspace (max-width: 480px)"), true);
  assert.equal(/\bzoom\s*:/.test(css), false);
  assert.equal(/transform\s*:\s*scale\s*\(/.test(css), false);
});

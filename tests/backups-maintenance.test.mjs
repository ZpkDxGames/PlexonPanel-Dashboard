import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const BACKUPS_VIEW = "app/backups-view-3-4-1.tsx";

test("Step 5 Backups workspace is manual-full-only and Host-authoritative", async () => {
  const view = await source(BACKUPS_VIEW);

  for (const text of [
    "Backups & Maintenance",
    "Manual full backup only",
    "Backup readiness",
    "Run backup diagnostics",
    'runOperation("backup.preflight", {})',
    "Current operation",
    "Backup inventory",
    "Restart schedule",
    "Test Google Drive",
    "Retry upload",
    "Create full restore point",
    "No automatic backup schedule",
    "Paper is not required for backup countdown, save flush, stop/start, archive, upload or recovery.",
    "unreadableDurableCount",
    "missingIncludes",
    "symlinkIssues",
    "backupRootWritable",
  ]) assert.equal(view.includes(text), true, `missing Step 5 backup contract: ${text}`);

  for (const retired of [
    "Create live snapshot",
    'useQuery(\n    "backup.list"',
    'runOperation("backup.create"',
    "Next full restore point",
    "legacyIntervalMinutes",
    "COORDINATING_PAPER",
    'runOperation("maintenance.full-backup.create", { skipCountdown: true })',
  ]) assert.equal(view.includes(retired), false, `retired backup behavior remains: ${retired}`);

  assert.equal(view.includes('runOperation("maintenance.full-backup.create", {})'), true);
  assert.equal(view.includes("props.state.backupProgress"), true);
  assert.equal(view.includes("status.data.nextRestart"), true);
});

test("provider and maintenance query failures never invent LOCAL, Idle or Clear authority", async () => {
  const view = await source(BACKUPS_VIEW);

  assert.equal(view.includes('queryAlert("Provider status unavailable", providerQuery)'), true);
  assert.equal(view.includes('queryAlert("Maintenance status unavailable", status)'), true);
  assert.equal(view.includes("Showing last confirmed data from"), true);
  assert.equal(view.includes("No authoritative state is available."), true);
  assert.equal(view.includes("providerQuery.hasSuccess ? providerQuery.data : {}"), true);
  assert.equal(view.includes('str(provider.status, "UNKNOWN")'), true);
  assert.equal(view.includes("status.hasSuccess"), true);

  assert.equal(view.includes('str(provider.provider, "LOCAL")'), false);
  assert.equal(view.includes('str(operation.phase, "Idle")'), false);
  assert.equal(view.includes('str(operation.phase, "Clear")'), false);
});

test("provider runtime transitions are explicit and Host-authoritative", async () => {
  const view = await source(BACKUPS_VIEW);
  for (const state of ["LOCAL", "CONNECTED", "DEGRADED", "ERROR", "CONFIGURED_UNTESTED"])
    assert.equal(view.includes(`\"${state}\"`), true, `missing provider transition ${state}`);
  assert.equal(view.includes("provider.configured === true"), true);
  assert.equal(view.includes("hostConfigRestartRequired"), true);
  assert.equal(view.includes("Last test"), true);
  assert.equal(view.includes("Last successful verification"), true);
  assert.equal(view.includes("lastSuccessfulVerificationAt"), true);
  assert.equal(view.includes("Credentials"), true);
  assert.equal(view.includes("Host-local only"), true);
});

test("ActionError and the backup failure card preserve safe structured diagnostics", async () => {
  const view = await source(BACKUPS_VIEW);
  const dataSource = await source("lib/data-source.ts");

  for (const field of ["requestId", "action", "status", "code", "phase", "safeRelativePath", "retryable"])
    assert.equal(view.includes(field), true, `failure card missing ${field}`);
  assert.equal(view.includes("Last operation failure"), true);
  assert.equal(view.includes("sessionStorage"), true);

  assert.equal(dataSource.includes("readonly requestId = \"\""), true);
  assert.equal(dataSource.includes("readonly action = \"\""), true);
  assert.equal(dataSource.includes("readonly data: Record<string, unknown> = {}"), true);
  assert.equal(dataSource.includes("result.data as Record<string, unknown>"), true);
});

test("operation timeline matches durable Host maintenance phases", async () => {
  const view = await source(BACKUPS_VIEW);
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
  ]) assert.equal(view.includes(`\"${phase}\"`), true, `missing operation phase ${phase}`);

  for (const marker of [
    "Skipped transient",
    "skippedTransientCount",
    "missingIncludeWarnings",
    "Warnings",
    "No ETA is invented",
  ]) assert.equal(view.includes(marker), true, `missing inventory/progress marker ${marker}`);
});

test("automatic backups are retired while restart-only scheduling remains configurable", async () => {
  const view = await source(BACKUPS_VIEW);
  assert.equal(view.includes("Next restart"), true);
  assert.equal(view.includes("Restart-only maintenance"), true);
  assert.equal(view.includes("Full backups"), true);
  assert.equal(view.includes("Manual only"), true);
  assert.equal(view.includes("Restart scheduling remains independent. It cannot trigger a backup."), true);
  assert.equal(view.includes("Automatic full-backup scheduling was retired."), true);
  assert.equal(view.includes("schedule: { ...activeDraft.fullRestorePoint.schedule, enabled: false }"), true);
});

test("host-offline, recovery-required and restore confirmation states remain explicit", async () => {
  const view = await source(BACKUPS_VIEW);
  assert.equal(view.includes("Backups & Maintenance needs the Host companion"), true);
  assert.equal(view.includes("Host recovery must be resolved before destructive operations."), true);
  assert.equal(view.includes("Type {restore.serverName} to continue"), true);
  assert.equal(view.includes("typed !== restore.serverName"), true);
  assert.equal(view.includes("confirmationToken"), true);
  assert.equal(view.includes("emergency pre-restore backup"), true);
});

test("destructive maintenance actions remain capability-gated and high-risk at browser and relay boundaries", async () => {
  const view = await source(BACKUPS_VIEW);
  const browserScopes = await source("lib/scopes.ts");
  const relayScopes = await source("relay/src/scopes.ts");
  const actions = [
    "backup.full.delete",
    "backup.full.restore",
    "maintenance.settings.update",
    "maintenance.restart.now",
    "maintenance.full-backup.create",
  ];
  for (const action of actions) {
    assert.equal(view.includes(action), true, `workspace missing ${action}`);
    assert.equal(browserScopes.includes(`\"${action}\"`), true, `browser HIGH_RISK missing ${action}`);
    assert.equal(relayScopes.includes(`\"${action}\"`), true, `relay HIGH_RISK missing ${action}`);
  }
  for (const action of [
    "maintenance.settings.update",
    "maintenance.restart.now",
    "maintenance.full-backup.create",
  ])
    assert.equal(view.includes(`props.can(\"${action}\"`), true, `workspace must gate concrete action ${action}`);
  assert.equal(view.includes('props.can("backup.full.restore.prepare", "HOST")'), true);
  assert.equal(view.includes('props.can("backup.full.delete", "HOST")'), true);
});

test("browser boundary retains provider secrecy", async () => {
  const view = await source(BACKUPS_VIEW);
  assert.equal(view.includes("Host-local only"), true);
  assert.equal(view.includes("rcloneConfig"), false);
  assert.equal(view.includes("client_secret"), false);
  assert.equal(view.includes("refresh_token"), false);
});

test("responsive Backups layout covers readiness and phase grids without global scaling", async () => {
  const css = await source("app/backups-scaffold.css");
  assert.equal(css.includes(".cr341-readiness-grid"), true);
  assert.equal(css.includes(".cr341-phase-list"), true);
  assert.equal(css.includes("@container workspace (max-width: 820px)"), true);
  assert.equal(css.includes("@container workspace (max-width: 480px)"), true);
  assert.equal(/\bzoom\s*:/.test(css), false);
  assert.equal(/transform\s*:\s*scale\s*\(/.test(css), false);
});

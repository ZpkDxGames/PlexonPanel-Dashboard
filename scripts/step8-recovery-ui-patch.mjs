import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, oldText, newText, label) {
  const source = await readFile(path, "utf8");
  if (!source.includes(oldText)) throw new Error(`${label} marker not found in ${path}`);
  await writeFile(path, source.replace(oldText, newText));
}

const viewPath = "app/backups-view-3-4-1.tsx";
await replaceOnce(
  viewPath,
  '  const canRunFullBackup = props.can("maintenance.full-backup.create", "HOST");\n',
  '  const canRunFullBackup = props.can("maintenance.full-backup.create", "HOST");\n  const canResolveRecovery = props.can("maintenance.recovery.resolve", "HOST");\n',
  "recovery capability",
);

await replaceOnce(
  viewPath,
  `  const recoveryKnown = status.hasSuccess || fullQuery.hasSuccess || preflight.hasSuccess;\n  const recoveryRequired =\n    operationPhase === "RECOVERY_REQUIRED" ||\n    operation.restartRecoveryRequired === true ||\n    status.data.jobRecoveryRequired === true ||\n    status.data.restoreRecoveryRequired === true ||\n    fullQuery.data.recoveryRequired === true ||\n    preflight.data.recoveryRequired === true ||\n    service.recoveryRequired === true;\n`,
  `  const recoveryKnown = status.hasSuccess || fullQuery.hasSuccess || preflight.hasSuccess;\n  const jobRecoveryRequired =\n    operationPhase === "RECOVERY_REQUIRED" ||\n    operation.restartRecoveryRequired === true ||\n    status.data.jobRecoveryRequired === true;\n  const restoreRecoveryRequired =\n    status.data.restoreRecoveryRequired === true ||\n    fullQuery.data.recoveryRequired === true ||\n    preflight.data.recoveryRequired === true ||\n    service.recoveryRequired === true;\n  const recoveryRequired = jobRecoveryRequired || restoreRecoveryRequired;\n  const recoveryResolveReady =\n    hostConnected &&\n    canResolveRecovery &&\n    jobRecoveryRequired &&\n    minecraftOnline &&\n    commandConfigured &&\n    minecraftReady;\n`,
  "recovery state split",
);

await replaceOnce(
  viewPath,
  `      {recoveryRequired && (\n        <div className="cr-step8-recovery" role="alert">\n          <div>\n            <strong>Recovery required</strong>\n            <span>A previous destructive operation is unresolved. New backups are blocked until Host recovery is completed.</span>\n          </div>\n          <Badge tone="red">Blocked</Badge>\n        </div>\n      )}\n`,
  `      {recoveryRequired && (\n        <div className="cr-step8-recovery" role="alert">\n          <div>\n            <strong>Recovery required</strong>\n            <span>\n              {jobRecoveryRequired\n                ? "The previous maintenance job failed after crossing the stop boundary. Verify Minecraft is running and Host-local RCON readiness is healthy, then acknowledge recovery. This does not mark the backup successful."\n                : "A restore recovery gate is unresolved. New backups remain blocked until Host recovery is completed."}\n            </span>\n          </div>\n          <div className="cr-actions">\n            <Badge tone="red">Blocked</Badge>\n            {jobRecoveryRequired && canResolveRecovery && (\n              <button\n                className="cr-button"\n                disabled={!recoveryResolveReady}\n                onClick={async () => {\n                  if (!window.confirm("Acknowledge this failed maintenance job after verifying Minecraft is online and Host-local RCON readiness is healthy? This will clear the recovery gate but will not mark the backup successful.")) return;\n                  await runOperation("maintenance.recovery.resolve", {});\n                  refreshAll();\n                  props.notice("Maintenance recovery acknowledged. The failed job remains recorded as failed.");\n                }}\n              >Verify & resolve recovery</button>\n            )}\n          </div>\n        </div>\n      )}\n`,
  "recovery banner",
);

const testPath = "tests/backups-maintenance.test.mjs";
await replaceOnce(
  testPath,
  `  assert.equal(view.includes("New backups are blocked until Host recovery is completed."), true);\n  assert.equal(view.includes("!operationBlocking"), true);\n`,
  `  assert.equal(view.includes("Verify & resolve recovery"), true);\n  assert.equal(view.includes('props.can("maintenance.recovery.resolve", "HOST")'), true);\n  assert.equal(view.includes('runOperation("maintenance.recovery.resolve", {})'), true);\n  assert.equal(view.includes("This does not mark the backup successful."), true);\n  assert.equal(view.includes("recoveryResolveReady"), true);\n  assert.equal(view.includes("!operationBlocking"), true);\n`,
  "recovery UI test",
);

await replaceOnce(
  testPath,
  `    "maintenance.full-backup.create",\n  ]) {\n`,
  `    "maintenance.full-backup.create",\n    "maintenance.recovery.resolve",\n  ]) {\n`,
  "high risk recovery action test",
);

const manifestPath = "protocol/action-scopes.json";
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.actionAliases["maintenance.recovery.resolve"] = "maintenance.run";
if (!manifest.highRisk.includes("maintenance.recovery.resolve")) {
  const index = manifest.highRisk.indexOf("maintenance.full-backup.create");
  manifest.highRisk.splice(index < 0 ? manifest.highRisk.length : index + 1, 0, "maintenance.recovery.resolve");
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Backups workspace renders real inventory, progress, scheduling and provider state", async () => {
  const view = await source("app/backups-view-3-0.tsx");
  for (const text of [
    "Backup inventory",
    "Current operation",
    "Maintenance settings",
    "Next restart",
    "Next full backup",
    "Provider",
    "Test Google Drive",
    "Retry upload",
    "Create full restore point",
    "Create live snapshot",
  ]) assert.equal(view.includes(text), true, `missing UI contract: ${text}`);
  assert.equal(view.includes("props.state.backupProgress"), true);
  assert.equal(view.includes("status.data.nextRestart"), true);
  assert.equal(view.includes("status.data.nextFullRestorePoint"), true);
  assert.equal(view.includes("providerQuery"), true);
});

test("Backups workspace exposes host-offline, recovery-required and explicit restore confirmation states", async () => {
  const view = await source("app/backups-view-3-0.tsx");
  assert.equal(view.includes("Backups & Maintenance needs the Host companion"), true);
  assert.equal(view.includes("Restore recovery is required on the Host"), true);
  assert.equal(view.includes("Type {restore.serverName} to continue"), true);
  assert.equal(view.includes("typed !== restore.serverName"), true);
  assert.equal(view.includes("confirmationToken"), true);
  assert.equal(view.includes("emergency pre-restore backup"), true);
});

test("destructive maintenance actions are capability-gated and high-risk at browser and relay boundaries", async () => {
  const view = await source("app/backups-view-3-0.tsx");
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
    "backup.full.restore.prepare",
    "backup.full.delete",
    "maintenance.settings.update",
    "maintenance.restart.now",
    "maintenance.full-backup.create",
  ])
    assert.equal(view.includes(`props.can(\"${action}\"`), true, `workspace must gate concrete action ${action}`);
});

test("full restore remains Owner-enforced by the Host and browser never receives provider credentials", async () => {
  const view = await source("app/backups-view-3-0.tsx");
  assert.equal(view.includes("Google Drive credentials remain in the Host"), true);
  assert.equal(view.includes("Host-local only"), true);
  assert.equal(view.includes("rcloneConfig"), false);
  assert.equal(view.includes("client_secret"), false);
  assert.equal(view.includes("refresh_token"), false);
});

test("responsive Backups layout has desktop and narrow-workspace rules without global scaling", async () => {
  const css = await source("app/backups-scaffold.css");
  assert.equal(css.includes("@container workspace (max-width: 820px)"), true);
  assert.equal(css.includes("@container workspace (max-width: 480px)"), true);
  assert.equal(/\bzoom\s*:/.test(css), false);
  assert.equal(/transform\s*:\s*scale\s*\(/.test(css), false);
});

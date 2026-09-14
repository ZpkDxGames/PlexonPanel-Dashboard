import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Dashboard 3.4.0 exposes the active control-room page set with a functional Backups workspace", async () => {
  const dashboard = await source("app/dashboard-2-1.tsx");
  const backups = await source("app/backups-view-3-0.tsx");
  const sections = dashboard.match(/const sections = \[([\s\S]*?)\] as const;/)?.[1] ?? "";
  assert.ok(sections.includes('"Overview"'));
  assert.ok(sections.includes('"Backups"'));
  assert.ok(sections.includes('"Settings"'));
  assert.equal(sections.includes('"Files"'), false);
  assert.equal(dashboard.includes("BackupsView30"), true);
  assert.equal(dashboard.includes('case "Backups"'), true);
  assert.equal(backups.includes("Backups & Maintenance"), true);
  assert.equal(backups.includes("Create live snapshot"), true);
  assert.equal(backups.includes("Create full restore point"), true);
  assert.equal(backups.includes("Restart now"), true);
});

test("Dashboard 3.4.0 Backups workspace is wired to Host maintenance actions", async () => {
  const backups = await source("app/backups-view-3-0.tsx");
  for (const action of [
    "maintenance.status",
    "maintenance.settings.get",
    "maintenance.settings.update",
    "maintenance.restart.now",
    "maintenance.full-backup.create",
    "backup.full.list",
    "backup.full.verify",
    "backup.full.retry-upload",
    "backup.full.restore.prepare",
    "backup.full.restore",
    "provider.status",
    "provider.test",
  ]) assert.equal(backups.includes(action), true, `missing ${action}`);
  assert.equal(backups.includes("props.run("), true);
  assert.equal(backups.includes("useQuery("), true);
  assert.equal(backups.includes("No backup action is sent from this page yet."), false);
  assert.equal(backups.includes("Scaffold only"), false);
  assert.equal(backups.includes("64 * 1024 * 1024"), true);
  assert.equal(backups.includes("Host-local only"), true);
});

test("Dashboard and relay expose identical maintenance/provider scopes", async () => {
  const dashboardScopes = await source("lib/scopes.ts");
  const relayScopes = await source("relay/src/scopes.ts");
  for (const scope of [
    "maintenance.view",
    "maintenance.configure",
    "maintenance.restart",
    "maintenance.run",
    "provider.view",
    "provider.test",
  ]) {
    assert.equal(dashboardScopes.includes(`\"${scope}\"`), true);
    assert.equal(relayScopes.includes(`\"${scope}\"`), true);
  }
  for (const action of [
    "backup.full.retry-upload",
    "maintenance.settings.update",
    "maintenance.full-backup.create",
    "provider.test",
  ]) {
    assert.equal(dashboardScopes.includes(`\"${action}\"`), true);
    assert.equal(relayScopes.includes(`\"${action}\"`), true);
  }
});

test("Dashboard 3.4.0 keeps protocol hooks compatible while Files remains dormant", async () => {
  const dashboard = await source("app/dashboard-2-1.tsx");
  assert.equal(dashboard.includes('action.startsWith("backup.")'), true);
  assert.equal(dashboard.includes('action.startsWith("files.")'), true);
  assert.equal(dashboard.includes("Open files"), false);
});

test("Dashboard visible version metadata matches package 3.4.1", async () => {
  const dashboard = await source("app/dashboard-2-1.tsx");
  const settings = await source("app/settings-view-2-1.tsx");
  const server = await source("app/server-view-2-1.tsx");
  const versionSource = await source("lib/dashboard-version.ts");
  const packageJson = JSON.parse(await source("package.json"));
  const version = versionSource.match(/DASHBOARD_VERSION = "([^"]+)"/)?.[1];
  assert.equal(version, packageJson.version);
  assert.equal(version, "3.4.1");
  assert.equal(dashboard.includes("DASHBOARD_VERSION"), true);
  assert.equal(settings.includes("DASHBOARD_LABEL"), true);
  assert.equal(server.includes("DASHBOARD_VERSION"), true);
  assert.equal(dashboard.includes("Control Room · 3.0.1"), false);
});

test("Dashboard 3.4.0 uses one console-style mark for dashboard branding and favicon identity", async () => {
  const dashboard = await source("app/dashboard-2-1.tsx");
  const favicon = await source("public/favicon.svg");
  assert.equal(dashboard.includes('panel:'), true);
  assert.equal(dashboard.includes("M7 12l2.5 2L7 16"), true);
  assert.equal(favicon.includes("M19 32L25 37L19 42"), true);
  assert.equal(favicon.includes("M31 42H42"), true);
});

test("Dashboard 3.4.0 responsive architecture does not globally scale the interface", async () => {
  const css = await source("app/control-room-3-0.css");
  assert.equal(/\bzoom\s*:/.test(css), false);
  assert.equal(/transform\s*:\s*scale\s*\(/.test(css), false);
  assert.equal(css.includes("container-name: workspace"), true);
  assert.equal(css.includes("@container workspace"), true);
  assert.equal(css.includes("100dvh"), true);
});

test("Dashboard 3.4.0 Backups workspace has responsive production layout", async () => {
  const css = await source("app/backups-scaffold.css");
  for (const selector of [
    ".cr30-backup-summary",
    ".cr30-backup-columns",
    ".cr30-backup-metrics",
    ".cr30-operation",
    ".cr30-settings-grid",
  ]) assert.equal(css.includes(selector), true, `missing ${selector}`);
  assert.equal(css.includes("@container workspace"), true);
});

test("Dashboard 3.4.0 display update rate exposes every supported browser cadence", async () => {
  const settings = await source("app/settings-view-2-1.tsx");
  const preferences = await source("lib/ui-preferences.ts");
  for (const value of [0, 250, 500, 1000, 2000]) {
    assert.equal(settings.includes(`value: ${value}`), true);
    assert.equal(preferences.includes(String(value)), true);
  }
  assert.equal(settings.includes("Controls how often accepted live telemetry is painted to this browser"), true);
  assert.equal(settings.includes("critical connection, authorization, lifecycle and action state is always applied immediately"), true);
});

test("Dashboard 3.4.0 authoritative and feature style layers are loaded after legacy presentation layers", async () => {
  const layout = await source("app/layout.tsx");
  const legacy = layout.indexOf('import "./player-workspace-2-3.css"');
  const controlRoom30 = layout.indexOf('import "./control-room-3-0.css"');
  const workspaces30 = layout.indexOf('import "./workspaces-3-0.css"');
  const overview30 = layout.indexOf('import "./overview-3-0.css"');
  const refinement = layout.indexOf('import "./visual-responsive-refinement.css"');
  const brand = layout.indexOf('import "./brand-console-icon.css"');
  const backups = layout.indexOf('import "./backups-scaffold.css"');
  assert.ok(legacy >= 0);
  assert.ok(controlRoom30 > legacy);
  assert.ok(workspaces30 > controlRoom30);
  assert.ok(overview30 > workspaces30);
  assert.ok(refinement > overview30);
  assert.ok(brand > refinement);
  assert.ok(backups > brand);
});

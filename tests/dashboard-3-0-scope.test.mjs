import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  if (path === "app/dashboard.tsx") return (await Promise.all([path, "app/use-dashboard-session.ts", "app/use-signed-operations.ts", "lib/workspace-navigation.ts", "app/shell.tsx", "app/workspaces.tsx"].map(file => readFile(new URL(`../${file}`, import.meta.url), "utf8")))).join("\n");
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const ACTIVE_BACKUPS_VIEW = "app/backups-view.tsx";

test("Dashboard 6.0.0 exposes the active manual-only Backups workspace", async () => {
  const dashboard = await source("app/dashboard.tsx");
  const backups = await source(ACTIVE_BACKUPS_VIEW);

  const sections = dashboard.match(/const sections = \[([\s\S]*?)\] as const;/)?.[1] ?? "";
  assert.ok(sections.includes('"Overview"'));
  assert.ok(sections.includes('"Backups"'));
  assert.ok(sections.includes('"Settings"'));
  assert.equal(sections.includes('"Files"'), false);
  assert.equal(dashboard.includes("BackupsView"), true);
  assert.equal(dashboard.includes('case "Backups"'), true);
  assert.equal(backups.includes("Backups & Maintenance"), true);
  assert.equal(backups.includes("Fully Backup Now"), true);
  assert.equal(backups.includes("Create full restore point"), false);
  assert.equal(backups.includes("Create live snapshot"), false);
  assert.equal(backups.includes('runOperation("backup.create"'), false);

});

test("Backups workspace is wired only to supported Host manual maintenance actions", async () => {
  const backups = await source(ACTIVE_BACKUPS_VIEW);
  for (const action of [
    "maintenance.status",
    "maintenance.settings.get",
    "maintenance.settings.update",
    "maintenance.restart.now",
    "maintenance.full-backup.create",
    "backup.preflight",
    "backup.full.list",
    "backup.full.verify",
    "backup.full.retry-upload",
    "backup.full.delete",
    "provider.status",
    "provider.test",
  ]) assert.equal(backups.includes(action), true, `missing ${action}`);
  assert.equal(backups.includes('"backup.full.restore.prepare"'), false);
  assert.equal(backups.includes('"backup.full.restore"'), false);
  assert.equal(backups.includes("Direct server-tree restore is intentionally excluded"), true);
  assert.equal(backups.includes("props.run("), true);
  assert.equal(backups.includes("useQuery("), true);
  assert.equal(backups.includes("Host-local only"), true);
  assert.equal(backups.includes("countdownSeconds: backupCountdownSeconds"), true);
  assert.equal(backups.includes("skipCountdown"), false);
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

test("legacy backup.create scope remains compatibility-only and is not an active dashboard action", async () => {
  const backups = await source(ACTIVE_BACKUPS_VIEW);
  const manifest = JSON.parse(await source("protocol/action-scopes.json"));
  const dashboardScopes = await source("lib/scopes.ts");
  const relayScopes = await source("relay/src/scopes.ts");

  assert.equal(manifest.scopes.includes("backup.create"), true);
  assert.equal(dashboardScopes.includes('"backup.full.retry-upload": "backup.create"'), true);
  assert.equal(relayScopes.includes('"backup.full.retry-upload": "backup.create"'), true);
  assert.equal(backups.includes('props.can("backup.create"'), false);
  assert.equal(backups.includes('runOperation("backup.create"'), false);
});

test("retired Paper coordination protocol cannot return", async () => {
  const protocol = await source("relay/src/protocol.ts");
  for (const type of [
    "backup.coordination",
    "backup.coordination.result",
    "maintenance.coordination",
    "maintenance.coordination.result",
  ]) assert.equal(protocol.includes(`\"${type}\"`), true, `retired denylist missing ${type}`);
  assert.equal(protocol.includes("RETIRED_COORDINATION_TYPES.has(type)"), true);
  assert.equal(protocol.includes("RETIRED_COORDINATION_TYPES.has(envelope.type)"), true);
});

test("Dashboard 6.0.0 keeps protocol hooks compatible with a selected-server Configuration workspace", async () => {
  const dashboard = await source("app/dashboard.tsx");
  assert.equal(dashboard.includes('action.startsWith("backup.")'), true);
  assert.equal(dashboard.includes('action.startsWith("files.")'), true);
  assert.ok(dashboard.includes('case "Configuration"'));
});

test("Dashboard visible version metadata matches package 6.0.0", async () => {
  const dashboard = await source("app/dashboard.tsx");
  const settings = await source("app/settings-view.tsx");
  const server = await source("app/server-view.tsx");
  const versionSource = await source("lib/dashboard-version.ts");
  const packageJson = JSON.parse(await source("package.json"));
  const version = versionSource.match(/DASHBOARD_VERSION = "([^"]+)"/)?.[1];
  assert.equal(version, packageJson.version);
  assert.equal(version, "6.0.0");
  assert.equal(dashboard.includes("DASHBOARD_VERSION"), true);
  assert.equal(settings.includes("DASHBOARD_LABEL"), true);
  assert.equal(server.includes("DASHBOARD_VERSION"), true);
});

test("Dashboard 6.0.0 responsive architecture does not globally scale the interface", async () => {
  const css = await source("app/ui/workspace.css");
  assert.equal(/\bzoom\s*:/.test(css), false);
  assert.doesNotMatch(css, /\.workspace-shell\s*\{[^}]*transform\s*:\s*scale\s*\(/);
  const shell = await source("app/styles/shell.css");
  assert.ok(shell.includes("@media (max-width: 1023px)"));
  assert.equal(css.includes("@media(max-width:767px)"), true);
  assert.ok(shell.includes("100dvh"));
});

test("Backups production layout uses the shared responsive workspace grid",async()=>{
  const css=await source('app/ui/workspace.css');
  for(const selector of ['.pp-data-grid','.pp-stat-grid','.pp-phase-list'])assert.ok(css.includes(selector));
});

test("Dashboard 6.0.0 display update rate exposes every supported browser cadence", async () => {
  const settings = await source("app/client-preferences.tsx");
  const preferences = await source("lib/ui-preferences.ts");
  for (const value of [0, 250, 500, 1000, 2000]) {
    assert.equal(settings.includes(`value: ${value}`), true);
    assert.equal(preferences.includes(String(value)), true);
  }
  assert.equal(settings.includes("Controls how often accepted live telemetry is painted to this browser"), true);
  assert.equal(settings.includes("critical connection, authorization, lifecycle and action state is always applied immediately"), true);
});

test("foundation is global and the current workspace skin stays out of the development gallery", async () => {
  const layout = await source("app/layout.tsx");
  assert.deepEqual([...layout.matchAll(/import "(\.\/[^"\n]+\.css)"/g)].map(m => m[1]), ["./styles/foundation.css"]);
  assert.doesNotMatch(await source("app/page.tsx"), /legacy-workspaces\.css/);
  assert.doesNotMatch(await source("app/workspaces.tsx"), /legacy-workspaces\.css/);
  assert.doesNotMatch(await source("app/activity/page.tsx"), /legacy-workspaces\.css/);
  const gallery = await source("app/dev/kitchen-sink/page.dev.tsx");
  assert.doesNotMatch(gallery, /dashboard\.css/);
  assert.match(await source("app/styles/foundation.css"), /@layer reset, tokens, base, primitives, workspaces, utilities;/);
  const css = await source("app/ui/workspace.css");
  assert.doesNotMatch(css, /(?:--cr|\.cr(?:\d+)?-)/);
  assert.doesNotMatch(css, /backdrop-filter:\s*blur/);
  assert.ok(css.includes(".pp-field"));
  assert.ok(css.includes(".pp-file-split"));
});

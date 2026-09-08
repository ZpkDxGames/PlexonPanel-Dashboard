import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Dashboard 3.0.2 exposes the active control-room page set with a scaffolded Backups workspace", async () => {
  const dashboard = await source("app/dashboard-2-1.tsx");
  const backups = await source("app/backups-view-3-0.tsx");
  const sections = dashboard.match(/const sections = \[([\s\S]*?)\] as const;/)?.[1] ?? "";
  assert.ok(sections.includes('"Overview"'));
  assert.ok(sections.includes('"Backups"'));
  assert.ok(sections.includes('"Settings"'));
  assert.equal(sections.includes('"Files"'), false);
  assert.equal(dashboard.includes("BackupsView30"), true);
  assert.equal(dashboard.includes('case "Backups"'), true);
  assert.equal(backups.includes("Create backup"), true);
  assert.equal(backups.includes("disabled>Create backup"), true);
});

test("Dashboard 3.0.2 Backups scaffold stays presentation-only until Host logic is wired", async () => {
  const backups = await source("app/backups-view-3-0.tsx");
  assert.equal(backups.includes("props.run("), false);
  assert.equal(backups.includes("useQuery("), false);
  assert.equal(backups.includes("backup.list · backup.view"), true);
  assert.equal(backups.includes("backup.restore · backup.delete"), true);
  assert.equal(backups.includes("No backup action is sent from this page yet."), true);
});

test("Dashboard 3.0.2 keeps protocol hooks compatible while Files remains dormant", async () => {
  const dashboard = await source("app/dashboard-2-1.tsx");
  assert.equal(dashboard.includes('action.startsWith("backup.")'), true);
  assert.equal(dashboard.includes('action.startsWith("files.")'), true);
  assert.equal(dashboard.includes("Open files"), false);
});

test("Dashboard visible version metadata matches package 3.0.2", async () => {
  const dashboard = await source("app/dashboard-2-1.tsx");
  const settings = await source("app/settings-view-2-1.tsx");
  const server = await source("app/server-view-2-1.tsx");
  const versionSource = await source("lib/dashboard-version.ts");
  const packageJson = JSON.parse(await source("package.json"));
  const version = versionSource.match(/DASHBOARD_VERSION = "([^"]+)"/)?.[1];
  assert.equal(version, packageJson.version);
  assert.equal(version, "3.0.2");
  assert.equal(dashboard.includes("DASHBOARD_VERSION"), true);
  assert.equal(settings.includes("DASHBOARD_LABEL"), true);
  assert.equal(server.includes("DASHBOARD_VERSION"), true);
  assert.equal(dashboard.includes("Control Room · 3.0.1"), false);
});

test("Dashboard 3.0.2 uses one console-style mark for dashboard branding and favicon identity", async () => {
  const dashboard = await source("app/dashboard-2-1.tsx");
  const favicon = await source("public/favicon.svg");
  assert.equal(dashboard.includes('panel:'), true);
  assert.equal(dashboard.includes("M7 12l2.5 2L7 16"), true);
  assert.equal(favicon.includes("M19 32L25 37L19 42"), true);
  assert.equal(favicon.includes("M31 42H42"), true);
});

test("Dashboard 3.0.2 responsive architecture does not globally scale the interface", async () => {
  const css = await source("app/control-room-3-0.css");
  assert.equal(/\bzoom\s*:/.test(css), false);
  assert.equal(/transform\s*:\s*scale\s*\(/.test(css), false);
  assert.equal(css.includes("container-name: workspace"), true);
  assert.equal(css.includes("@container workspace"), true);
  assert.equal(css.includes("100dvh"), true);
});

test("Dashboard 3.0.2 display update rate exposes every supported browser cadence", async () => {
  const settings = await source("app/settings-view-2-1.tsx");
  const preferences = await source("lib/ui-preferences.ts");
  for (const value of [0, 250, 500, 1000, 2000]) {
    assert.equal(settings.includes(`value: ${value}`), true);
    assert.equal(preferences.includes(String(value)), true);
  }
  assert.equal(settings.includes("Controls how often accepted live telemetry is painted to this browser"), true);
  assert.equal(settings.includes("critical connection, authorization, lifecycle and action state is always applied immediately"), true);
});

test("Dashboard 3.0.2 authoritative and feature style layers are loaded after legacy presentation layers", async () => {
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

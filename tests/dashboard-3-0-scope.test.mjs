import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Dashboard 3.0.1 exposes only the active control-room page set", async () => {
  const dashboard = await source("app/dashboard-2-1.tsx");
  const sections = dashboard.match(/const sections = \[([\s\S]*?)\] as const;/)?.[1] ?? "";
  assert.ok(sections.includes('"Overview"'));
  assert.ok(sections.includes('"Settings"'));
  assert.equal(sections.includes('"Files"'), false);
  assert.equal(sections.includes('"Backups"'), false);
  assert.equal(dashboard.includes("Open files"), false);
  assert.equal(dashboard.includes("Create backup"), false);
  assert.equal(dashboard.includes("Go to Backups"), false);
  assert.equal(dashboard.includes("Control Room · 3.0.1"), true);
});

test("Dashboard 3.0.1 keeps hidden workspace protocol hooks dormant rather than deleting compatibility", async () => {
  const dashboard = await source("app/dashboard-2-1.tsx");
  assert.equal(dashboard.includes('action.startsWith("backup.")'), true);
  assert.equal(dashboard.includes('action.startsWith("files.")'), true);
});

test("Dashboard 3.0.1 responsive architecture does not globally scale the interface", async () => {
  const css = await source("app/control-room-3-0.css");
  assert.equal(/\bzoom\s*:/.test(css), false);
  assert.equal(/transform\s*:\s*scale\s*\(/.test(css), false);
  assert.equal(css.includes("container-name: workspace"), true);
  assert.equal(css.includes("@container workspace"), true);
  assert.equal(css.includes("100dvh"), true);
});

test("Dashboard 3.0.1 display update rate exposes every supported browser cadence", async () => {
  const settings = await source("app/settings-view-2-1.tsx");
  const preferences = await source("lib/ui-preferences.ts");
  for (const value of [0, 250, 500, 1000, 2000]) {
    assert.equal(settings.includes(`value: ${value}`), true);
    assert.equal(preferences.includes(String(value)), true);
  }
  assert.equal(settings.includes("Controls how often accepted live telemetry is painted to this browser"), true);
  assert.equal(settings.includes("critical connection, authorization, lifecycle and action state is always applied immediately"), true);
});

test("Dashboard 3.0.1 authoritative style layers are loaded after legacy presentation layers", async () => {
  const layout = await source("app/layout.tsx");
  const legacy = layout.indexOf('import "./player-workspace-2-3.css"');
  const controlRoom30 = layout.indexOf('import "./control-room-3-0.css"');
  const workspaces30 = layout.indexOf('import "./workspaces-3-0.css"');
  const overview30 = layout.indexOf('import "./overview-3-0.css"');
  assert.ok(legacy >= 0);
  assert.ok(controlRoom30 > legacy);
  assert.ok(workspaces30 > controlRoom30);
  assert.ok(overview30 > workspaces30);
});

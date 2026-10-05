// DOM integration, not visual/browser certification. HTTP and loopback WebSocket,
// signed relay authentication, room routing and action completions are real; agents are simulated.
import assert from "node:assert/strict";
import { test } from "node:test";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import { IDBFactory } from "fake-indexeddb";
import WebSocket from "ws";
import { createFleetFixture } from "../scripts/support/fleet-fixture.mjs";
import Dashboard from "../.test-dist/app/dashboard.js";
import { saveRelayCredential, selectRelayCredential, loadRelayCredential } from "../.test-dist/lib/browser-store.js";
import { captureActionTarget, bindLiveSocket } from "../.test-dist/lib/data-source.js";
import { UiPreferencesProvider } from "../.test-dist/components/ui-preferences-provider.js";
import { UI_PREFERENCES_KEY } from "../.test-dist/lib/ui-preferences.js";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test("mounted Dashboard selects and operates independent signed instances without stale transitions", { timeout: 60_000 }, async t => {
  let simulateLifecycle = false;
  let backupMode = "missing", backupJob = null;
  let fileContent = "settings:\n  sample: true\n", fileHash = "a".repeat(64), simulateConflict = false;
  const fixture = await createFleetFixture({ names: ["PlexonCraft", "TonimSMP"], instanceKeys: ["plexoncraft", "tonimsmp"],
    async beforeActionResult({ room, kind, body, attach, sync, telemetry }) {
      if (body.action === "provider.status") return { data: { configured: backupMode !== "missing", status: backupMode === "missing" ? "LOCAL" : backupMode === "ready-old-provider" ? "DEGRADED" : "CONNECTED", remote: `gdrive:plexonpanel/${room.serverId}` } };
      if (body.action === "provider.test") return { status: "FAILED", code: "RCLONE_TEST_FAILED", message: "Fixture provider test failed", data: { phase: "PROVIDER_TEST", retryable: true } };
      if (body.action === "maintenance.status") return { data: { commandChannel: { enabled: true }, currentOperation: backupJob ?? {} } };
      if (body.action === "maintenance.settings.get") return { data: { settings: { schemaVersion: 3, timezone: "UTC", restart: {}, fullRestorePoint: { canonicalFilename: `${room.name}-Latest.zip` } } } };
      if (body.action === "backup.full.list") return { data: { backups: [], recoveryRequired: false } };
      if (body.action === "backup.preflight") {
        if (backupMode === "missing") return { status: "FAILED", code: "RCLONE_UNAVAILABLE", message: "No off-site rclone provider is configured on the running Host.", data: { stage: "provider", phase: "PREFLIGHT" } };
        if (backupMode === "source-failed") return { status: "FAILED", code: "BACKUP_SOURCE_UNREADABLE", message: "Fixture source unreadable", data: { stage: "source", phase: "PREFLIGHT" } };
        return { data: { hostAuthenticated: true, backupRootWritable: true, commandChannelConfigured: true, usableBytes: 10000000, requiredBytes: 1000, provider: "RCLONE", providerStatus: "CONNECTED", remote: `gdrive:plexonpanel/${room.serverId}` } };
      }
      if (body.action === "files.list") return { data: { roots: ["server"], entries: [{ name: "bukkit.yml", directory: false, editable: true }], hasMore: false } };
      if (body.action === "files.read") return { data: { content: fileContent, sha256: fileHash, editable: kind === "PAPER" } };
      if (body.action === "files.write") {
        if (simulateConflict || body.parameters.sha256 !== fileHash) return { status: "CONFLICT", code: "STALE_FILE", message: "Fixture file changed", data: {} };
        fileContent = body.parameters.content; fileHash = "b".repeat(64); return { data: { sha256: fileHash } };
      }
      if (!simulateLifecycle || kind !== "HOST" || !["server.stop", "server.start", "server.restart"].includes(body.action)) return;
      if (body.action !== "server.start") { room.paper.socket.close(); await sleep(120); }
      room.serviceState = body.action === "server.stop" ? "inactive" : "active";
      await telemetry(); await sleep(120);
      if (body.action !== "server.stop") { await attach(room, "PAPER"); await sync(room); await telemetry(); await sleep(120); }
    } });
  const dom = new JSDOM('<div id="root"></div>', { url: fixture.origin, pretendToBeVisual: true });
  const { window } = dom;
  window.scrollTo = () => {};
  window.matchMedia = query => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} });
  window.confirm = () => false;
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  const original = new Map();
  const nativeFetch = globalThis.fetch;
  let holdServerId = "", releaseGrant, grantStarted = false;
  const browserFetch = async (url, options = {}) => {
    const headers = new Headers(options.headers);
    headers.set("Origin", fixture.origin);
    const response = await nativeFetch(url, { ...options, headers });
    const held = fixture.credentials.find(credential => credential.serverId === holdServerId);
    if (held && headers.get("Authorization") === `Bearer ${held.accessToken}`) {
      grantStarted = true;
      await new Promise(resolve => { releaseGrant = resolve; });
    }
    return response;
  };
  const sockets = [];
  class BrowserSocket extends WebSocket {
    constructor(url, protocols) { super(url, protocols, { origin: fixture.origin }); sockets.push(this); this.on("error", () => {}); }
  }
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator,
    fetch: browserFetch, localStorage: window.localStorage, indexedDB: new IDBFactory(), WebSocket: BrowserSocket, IS_REACT_ACT_ENVIRONMENT: true })) {
    original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const priorRelay = process.env.NEXT_PUBLIC_PLEXON_RELAY_URL;
  process.env.NEXT_PUBLIC_PLEXON_RELAY_URL = fixture.base;
  const { createRoot } = await import("react-dom/client");
  const rootElement = window.document.getElementById("root");
  let root;
  const mount = async () => { root = createRoot(rootElement); await act(async () => root.render(React.createElement(UiPreferencesProvider, null, React.createElement(Dashboard)))); };
  const wait = async (condition, label) => {
    const until = Date.now() + 7000;
    while (!condition()) {
      assert.ok(Date.now() < until, `Timed out: ${label}; page: ${rootElement.textContent.slice(-3500)}`);
      await act(async () => { await sleep(25); });
    }
  };
  const text = () => rootElement.textContent;
  const button = name => [...rootElement.querySelectorAll("button")].find(node => node.textContent.trim() === name);
  const click = async node => { assert.ok(node, "Required button missing"); await act(async () => node.dispatchEvent(new window.MouseEvent("click", { bubbles: true }))); };
  const choose = async (node, value) => {
    assert.ok(node, "Required dropdown missing");
    await click(node);
    const option = [...window.document.querySelectorAll('[role="option"]')].find(item => item.dataset.value === value);
    await click(option);
  };
  const select = async id => choose(rootElement.querySelector('[role="combobox"]'), id);
  const currentName = () => rootElement.querySelector(".cr21-server-identity strong")?.textContent;
  const health = () => rootElement.querySelector(".workspace-health")?.dataset.state;
  const first = fixture.rooms[0], second = fixture.rooms[1];
  try {
    await saveRelayCredential(fixture.credentials[0]); await saveRelayCredential(fixture.credentials[1]); await selectRelayCredential(first.serverId);
    await mount();
    await t.test("opening selector shows live named cards and remembers the selected server", async () => {
      await wait(() => text().includes("PlexonCraft") && text().includes("TonimSMP") && text().includes("Continue to workspace"), "paired server selector");
      assert.ok(rootElement.querySelector(".paired-server-home"));
      await click(button("Client settings"));
      await wait(() => rootElement.querySelector(".client-preferences-dialog[open]"), "client settings dialog");
      for (const [label, value, attribute] of [["Accent", "violet", "plexonAccent"], ["Density", "spacious", "plexonDensity"], ["Chart style", "line", "plexonChartStyle"]]) {
        const field = [...rootElement.querySelectorAll('.client-preferences-dialog label')].find(node => node.querySelector('span')?.textContent === label).querySelector('[role="combobox"]');
        await choose(field, value);
        assert.equal(window.document.documentElement.dataset[attribute], value);
      }
      await click(button("Done"));
      assert.equal(JSON.parse(window.localStorage.getItem(UI_PREFERENCES_KEY)).accent, "violet");
      assert.equal(rootElement.querySelector('.fleet-card[data-selected="true"] h2').textContent, "PlexonCraft");
      await click(button("Continue to workspace"));
      await wait(() => currentName() === "PlexonCraft" && health() === "online", "PlexonCraft workspace");
      assert.equal(captureActionTarget(first.serverId).serverId, first.serverId);
    });
    await t.test("switch resets data and confirmation before a second signed workspace becomes live", async () => {
      await click(rootElement.querySelector(".cr21-quick-actions button"));
      await wait(() => rootElement.querySelector("dialog[open]"), "confirmation");
      assert.match(rootElement.querySelector("dialog").textContent, /PlexonCraft/);
      const oldSocket = sockets.find(socket => socket.protocol === "plexonpanel-v3" && socket.readyState === 1);
      await select(second.serverId);
      assert.equal(rootElement.querySelector("dialog[open]"), null);
      assert.throws(() => captureActionTarget(first.serverId));
      oldSocket.onmessage?.({ data: JSON.stringify({ type: "server.event", serverId: first.serverId, eventType: "telemetry.server", body: { serverName: "WRONG_INSTANCE_SENTINEL", onlinePlayers: 999 } }) });
      await wait(() => currentName() === "TonimSMP" && health() === "online", "TonimSMP workspace");
      assert.doesNotMatch(text(), /WRONG_INSTANCE_SENTINEL/);
      assert.equal((await loadRelayCredential()).serverId, second.serverId);
      await click(rootElement.querySelector(".cr21-quick-actions button"));
      await wait(() => rootElement.querySelector("dialog[open]"), "TonimSMP confirmation");
      assert.match(rootElement.querySelector("dialog").textContent, /TonimSMP/);
      await click(button("Confirm operation"));
      await wait(() => fixture.requests.some(request => request.action === "server.restart"), "room-bound completion");
      assert.deepEqual(fixture.requests.filter(request => request.action === "server.restart").map(request => [request.serverId, request.kind]), [[second.serverId, "HOST"]]);
    });
    await t.test("rapid A to B to A dropdown switches establish a fresh live command channel", async () => {
      for (const id of [first.serverId, second.serverId, first.serverId]) await select(id);
      await wait(() => currentName() === "PlexonCraft" && health() === "online", "rapid switches");
      assert.equal(captureActionTarget(first.serverId).serverId, first.serverId);
      await wait(() => currentName() === "PlexonCraft", "settled selection");
      assert.equal((await loadRelayCredential()).serverId, first.serverId);
    });
    await t.test("a delayed session grant for an abandoned selection cannot replace the current socket", async () => {
      holdServerId = second.serverId;
      await select(second.serverId);
      await wait(() => grantStarted, "held second-server session grant");
      await select(first.serverId);
      await wait(() => currentName() === "PlexonCraft" && health() === "online", "return while grant is pending");
      holdServerId = "";
      await act(async () => { releaseGrant(); await sleep(50); });
      assert.equal(currentName(), "PlexonCraft");
      assert.equal(captureActionTarget(first.serverId).serverId, first.serverId);
      assert.throws(() => captureActionTarget(second.serverId));
    });
    await t.test("reload returns to the selector while preserving selection and independent page history", async () => {
      await click(button("Players"));
      assert.equal(window.localStorage.getItem(`plexonpanel-section:${first.serverId}`), "Players");
      await act(async () => root.unmount()); await mount();
      await wait(() => text().includes("Your servers") && text().includes("Continue to workspace"), "remembered selector");
      assert.equal(rootElement.querySelector('.fleet-card[data-selected="true"] h2').textContent, "PlexonCraft");
      await click(button("Continue to workspace"));
      await wait(() => rootElement.querySelector(".cr21-page-head h1")?.textContent === "Players" && health() === "online", "remembered per-server page");
      await select(second.serverId);
      await wait(() => currentName() === "TonimSMP" && health() === "online", "second page scope");
      assert.equal(rootElement.querySelector(".cr21-page-head h1").textContent, "Overview");
    });
    await t.test("lifecycle commands complete across real signed Paper disconnect and reconnect events", async () => {
      simulateLifecycle = true;
      await click(button("Server"));
      for (const [label, action, expected] of [["Graceful stop", "server.stop", "stopped"], ["Start", "server.start", "online"], ["Restart", "server.restart", "online"]]) {
        await wait(() => button(label) && !button(label).disabled, `${label} available`);
        await click(button(label));
        if (action !== "server.start") { await wait(() => rootElement.querySelector("dialog[open]"), "lifecycle confirmation"); await click(button("Confirm operation")); }
        await wait(() => rootElement.querySelector(".cr-toast")?.textContent.includes("Simulated fixture response"), `${action} successful completion`);
        assert.doesNotMatch(rootElement.querySelector(".cr-toast").textContent, /connection changed|could not be completed/);
        await wait(() => rootElement.querySelector('.cr21-operation [data-state="current"]')?.textContent.includes("Complete"), `${action} observed success`);
        assert.equal(fixture.requests.filter(r => r.action === action && r.serverId === second.serverId).length, action === "server.restart" ? 2 : 1);
        await wait(() => health() === expected, `${action} connection state`);
        await click(rootElement.querySelector('.cr-toast button'));
      }
      simulateLifecycle = false;
      await click(button("Overview"));
    });
    await t.test("Owner configuration uses Paper editing, reviews changes and preserves conflicts and unsaved work", async () => {
      await click(button("Configuration"));
      const fileButton = () => [...rootElement.querySelectorAll('.cr-file-list button')].find(node => node.textContent.includes("bukkit.yml"));
      await wait(() => fileButton(), "configuration files");
      await click(fileButton());
      await wait(() => rootElement.querySelector('.cr-file-split textarea'), "configuration editor");
      const edit = async content => {
        const field = rootElement.querySelector('.cr-file-split textarea');
        await act(async () => { Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set.call(field, content); field.dispatchEvent(new window.Event("input", { bubbles: true })); });
      };
      const changed = "settings:\n  sample: false\n";
      await edit(changed);
      const saveButton = () => button("Review changes") || button("Save reviewed changes");
      await wait(() => saveButton(), "dirty editor");
      const before = fixture.requests.filter(r => r.action === "files.write").length;
      await click(saveButton());
      assert.equal(fixture.requests.filter(r => r.action === "files.write").length, before);
      await click(saveButton());
      await wait(() => fileContent === changed, "reviewed configuration save");
      const request = fixture.requests.find(r => r.action === "files.write");
      assert.equal(request.kind, "PAPER"); assert.equal(request.serverId, second.serverId);
      simulateConflict = true;
      await edit("settings:\n  sample: pending\n");
      await click(saveButton()); await click(saveButton());
      await wait(() => text().includes("Conflict: the server file changed"), "conflict keeps edits");
      assert.match(rootElement.querySelector('.cr-file-split textarea').value, /pending/);
      await select(first.serverId);
      assert.equal(currentName(), "TonimSMP");
      await edit(changed); simulateConflict = false;
      await click(button("Overview"));
      assert.equal(JSON.parse(window.localStorage.getItem(UI_PREFERENCES_KEY)).density, "spacious");
    });
    await t.test("backup setup is instance-specific, unverified checks stay unknown and cached preflight cannot authorize a new job", async () => {
      // Start backup interaction with a fresh authenticated session, like switching instances.
      await select(first.serverId); await wait(() => health() === "online", "first server connected");
      await select(second.serverId); await wait(() => health() === "online", "selected server connected");
      await click([...rootElement.querySelectorAll('.cr21-nav button')].find(node => node.textContent.trim() === "Backups"));
      await wait(() => text().includes("No off-site rclone provider"), "missing provider preflight");
      assert.match(text(), /TonimSMP backup destination/);
      assert.match(text(), /\/var\/backups\/plexonpanel\/instances\/tonimsmp/);
      const check = label => [...rootElement.querySelectorAll('.cr341-readiness-item')].find(node => node.querySelector('strong').textContent === label).querySelector('.cr-badge').textContent;
      assert.equal(check("Backup storage"), "Unknown"); assert.equal(check("Filesystem read contract"), "Unknown");
      assert.equal(button("Review & start backup").disabled, true);
      backupMode = "ready-old-provider";
      await wait(() => !rootElement.querySelector('.cr30-backup-toolbar button').disabled, "refresh available");
      await click(rootElement.querySelector('.cr30-backup-toolbar button'));
      await wait(() => !button("Review & start backup").disabled, "fresh authoritative preflight");
      assert.equal(check("Backup storage"), "Ready");
      await click(button("Re-run Host preflight"));
      await wait(() => check("Google Drive / rclone") === "Ready", "new preflight supersedes stale provider status");
      backupMode = "source-failed";
      await wait(() => !rootElement.querySelector('.cr30-backup-toolbar button').disabled, "refresh available");
      await click(rootElement.querySelector('.cr30-backup-toolbar button'));
      assert.equal(button("Review & start backup").disabled, true);
      await wait(() => text().includes("Fixture source unreadable"), "source failure replaces readiness");
      assert.equal(check("Filesystem read contract"), "Failed"); assert.equal(check("Backup storage"), "Unknown");
      assert.equal(button("Review & start backup").disabled, true);
      assert.equal(fixture.requests.some(request => request.action === "maintenance.full-backup.create"), false);
      await click(button("Test Google Drive"));
      await wait(() => text().includes("Last operation failure"), "server-bound safe diagnostic");
      assert.ok(window.sessionStorage.getItem(`plexonpanel.backup.last-safe-failure.v3:${second.serverId}`));
      await select(first.serverId);
      await wait(() => health() === "online", "first backup server connected");
      await click([...rootElement.querySelectorAll('.cr21-nav button')].find(node => node.textContent.trim() === "Backups"));
      await wait(() => text().includes("PlexonCraft backup destination"), "first instance backup view");
      assert.equal(text().includes("Last operation failure"), false);
      await select(second.serverId);
      await wait(() => text().includes("TonimSMP backup destination") && text().includes("Last operation failure"), "matching instance diagnostic restored");
      backupMode = "ready";
    });
    await t.test("signed upload progress is shown for the active Host job and ignored for other jobs", async () => {
      backupJob = { jobId: "11111111-1111-4111-8111-111111111111", phase: "UPLOADING_REMOTE", localBackupVerified: true };
      await wait(() => !rootElement.querySelector('.cr30-backup-toolbar button').disabled, "refresh available");
      await click(rootElement.querySelector('.cr30-backup-toolbar button'));
      await wait(() => text().includes("Uploading to Google Drive"), "durable upload job");
      await act(async () => second.host.send("backup.progress", { jobId: backupJob.jobId, phase: "UPLOADING_REMOTE", bytesUploaded: 512, totalBytes: 1024, progress: 0.5, bytesPerSecond: 256 }));
      await wait(() => text().includes("50%"), "live verified job transfer progress");
      await act(async () => second.host.send("backup.progress", { jobId: "22222222-2222-4222-8222-222222222222", phase: "UPLOADING_REMOTE", bytesUploaded: 999999, totalBytes: 999999, progress: 1 }));
      await act(async () => { await sleep(600); });
      assert.equal(text().includes("976.6 KiB"), false);
      backupJob = null;
      await click([...rootElement.querySelectorAll('.cr21-nav button')].find(node => node.textContent.trim() === "Server"));
    });
    await t.test("cold backup review cancels without a command and confirms only the selected Host", async () => {
      await select(first.serverId); await wait(() => health() === "online", "first backup session");
      await select(second.serverId); await wait(() => health() === "online", "second backup session");
      await click([...rootElement.querySelectorAll('.cr21-nav button')].find(node => node.textContent.trim() === "Backups"));
      await wait(() => button("Review & start backup") && !button("Review & start backup").disabled, "backup ready for review");
      const requests = () => fixture.requests.filter(request => request.action === "maintenance.full-backup.create");
      await click(button("Review & start backup"));
      await wait(() => rootElement.querySelector('dialog[open].cr-step8-modal'), "custom backup confirmation");
      assert.match(rootElement.querySelector('.cr-step8-modal').textContent, /TonimSMP/);
      assert.equal(requests().length, 0);
      await click([...rootElement.querySelectorAll('.cr-step8-modal button')].find(node => node.textContent === "Cancel"));
      assert.equal(requests().length, 0);
      await click(button("Review & start backup")); await click(button("Confirm Fully Backup Now"));
      await wait(() => requests().length === 1 && !rootElement.querySelector('.cr-step8-modal'), "confirmed backup queued");
      const request = requests()[0];
      assert.equal(request.serverId, second.serverId); assert.equal(request.kind, "HOST");
      assert.equal(request.parameters.confirmed, true); assert.equal(request.parameters.countdownSeconds, 1800);
      await click([...rootElement.querySelectorAll('.cr21-nav button')].find(node => node.textContent.trim() === "Server"));
    });
    await t.test("Host-confirmed stop, agent disconnect and relay disconnect are different UI states", async () => {
      second.serviceState = "inactive";
      await act(async () => { second.paper.socket.close(); await sleep(60); await fixture.telemetry(); });
      await wait(() => health() === "stopped", "Minecraft stopped");
      assert.match(text(), /Minecraft stopped/);
      await act(async () => { second.host.socket.close(); await sleep(60); });
      await wait(() => health() === "host-disconnected", "Host disconnected");
      assert.match(text(), /Minecraft process state is unknown/);
      second.serviceState = "active";
      await act(async () => { await fixture.attach(second, "PAPER"); await fixture.sync(second); await fixture.attach(second, "HOST"); await fixture.telemetry(); });
      await wait(() => health() === "online", "independent agent recovery");
      assert.equal(captureActionTarget(second.serverId).serverId, second.serverId);
    });
    await t.test("revoking one paired server keeps the other available and selectable", async () => {
      await act(async () => { await fixture.sync(second, []); await sleep(75); });
      await wait(() => text().includes("Pair this browser"), "revoked grant");
      assert.equal((await loadRelayCredential()), null);
      assert.throws(() => captureActionTarget(second.serverId));
      await select(first.serverId);
      await wait(() => currentName() === "PlexonCraft" && health() === "online", "remaining paired instance");
      assert.equal(captureActionTarget(first.serverId).serverId, first.serverId);
      await click(rootElement.querySelector('[role="combobox"]'));
      assert.equal(window.document.querySelectorAll('[role="option"]').length, 1);
      await click(rootElement.querySelector('[role="combobox"]'));
      await act(async () => { await fixture.close(); await sleep(50); });
      await wait(() => health() === "relay-unavailable", "relay outage");
      assert.match(text(), /Relay unavailable/);
      assert.throws(() => captureActionTarget(first.serverId));
    });
  } finally {
    holdServerId = ""; releaseGrant?.();
    if (root) await act(async () => root.unmount());
    bindLiveSocket(null);
    for (const socket of sockets) if (socket.readyState < 3) socket.terminate();
    await fixture.close(); dom.window.close();
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
    if (priorRelay === undefined) delete process.env.NEXT_PUBLIC_PLEXON_RELAY_URL;
    else process.env.NEXT_PUBLIC_PLEXON_RELAY_URL = priorRelay;
  }
});

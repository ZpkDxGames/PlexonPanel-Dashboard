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
import { saveRelayCredential, selectRelayCredential, loadRelayCredential, loadControlCache } from "../.test-dist/lib/browser-store.js";
import { captureActionTarget, bindLiveSocket } from "../.test-dist/lib/data-source.js";
import { UiPreferencesProvider } from "../.test-dist/components/ui-preferences-provider.js";
import { UI_PREFERENCES_KEY } from "../.test-dist/lib/ui-preferences.js";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test("mounted Dashboard selects and operates independent signed instances without stale transitions", { timeout: 90_000 }, async t => {
  let simulateLifecycle = false;
  let lifecycleBusy = false;
  let backupMode = "missing", backupJob = null, backupInventory=[];
  let fileContent = "settings:\n  sample: true\n", fileHash = "a".repeat(64), simulateConflict = false;
  let secondaryDeviceRevoked=false;const secondaryDeviceId="00000000-0000-4000-8000-000000000123";
  let holdCompletion = false, releaseCompletion;
  let gatedAction="", releaseSigned, signedStarted=false, signedSerial=0;
  const fixture = await createFleetFixture({ names: ["PlexonCraft", "TonimSMP"], instanceKeys: ["plexoncraft", "tonimsmp"],
    async beforeActionResult({ room, kind, body, attach, sync, telemetry }) {
      if (gatedAction && body.action === gatedAction) {
        signedStarted=true;
        await new Promise(resolve=>{releaseSigned=resolve;});
        if(body.action==='devices.revoke')secondaryDeviceRevoked=true;
        if(body.action==='files.write') { fileContent=body.parameters.content; fileHash='b'.repeat(64); }
        if(!simulateLifecycle || !body.action.startsWith("server.")) return { message:`Signed result ${signedSerial}: ${body.action}`, data:body.action==='files.write'?{sha256:fileHash}:{} };
      }
      if (holdCompletion && body.action === "server.restart") {
        await new Promise(resolve => { releaseCompletion = resolve; });
        return { message: "ABANDONED_RESULT_SENTINEL", data: {} };
      }
      if (lifecycleBusy && kind === "HOST" && body.action === "server.stop")
        return { status: "DENIED", code: "BUSY", message: "A backup operation is running. This request was not queued.", data: {} };
      if (body.action === "provider.status") return { data: { configured: backupMode !== "missing", status: backupMode === "missing" ? "LOCAL" : backupMode === "ready-old-provider" ? "DEGRADED" : "CONNECTED", remote: `gdrive:plexonpanel/${room.serverId}` } };
      if (body.action === "provider.test") return { status: "FAILED", code: "RCLONE_TEST_FAILED", message: "Fixture provider test failed", data: { phase: "PROVIDER_TEST", retryable: true } };
      if (body.action === "maintenance.status") return { data: { commandChannel: { enabled: true }, currentOperation: backupJob ?? {} } };
      if (body.action === "maintenance.settings.get") return { data: { settings: { schemaVersion: 3, timezone: "UTC", restart: {}, fullRestorePoint: { canonicalFilename: `${room.name}-Latest.zip` } } } };
      if (body.action === "backup.full.list") return { data: { backups: backupInventory, recoveryRequired: false } };
      if (body.action === "backup.preflight") {
        if (backupMode === "missing") return { status: "FAILED", code: "RCLONE_UNAVAILABLE", message: "No off-site rclone provider is configured on the running Host.", data: { stage: "provider", phase: "PREFLIGHT" } };
        if (backupMode === "source-failed") return { status: "FAILED", code: "BACKUP_SOURCE_UNREADABLE", message: "Fixture source unreadable", data: { stage: "source", phase: "PREFLIGHT" } };
        return { data: { hostAuthenticated: true, backupRootWritable: true, commandChannelConfigured: true, usableBytes: 10000000, requiredBytes: 1000, provider: "RCLONE", providerStatus: "CONNECTED", remote: `gdrive:plexonpanel/${room.serverId}` } };
      }
      if(body.action==='devices.list')return {data:{devices:[{...room.device,name:'Current fixture browser'},...(!secondaryDeviceRevoked?[{deviceId:secondaryDeviceId,name:'Fixture secondary browser',role:'Viewer',scopes:['overview.view'],issuedAt:Math.floor(Date.now()/1000)-60,expiresAt:Math.floor(Date.now()/1000)+3600,lastSeen:Date.now()}]:[])]}};
      if(body.action==='audit.list'||body.action==='audit.self')return {data:{entries:[{timestamp:new Date().toISOString(),actorLabel:'Fixture operator',role:'Owner',actionType:'server.status',target:room.key,outcome:'SUCCESS',requestId:'fixture-audit-request'}],hasMore:false}};
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
      if(gatedAction===body.action)return {message:`Signed result ${signedSerial}: ${body.action}`,data:{}};
    } });
  const dom = new JSDOM('<div id="root"></div>', { url: fixture.origin, pretendToBeVisual: true });
  const { window } = dom;
  window.scrollTo = () => {};
  // This DOM transport test does not rasterize; real canvas gates run in Chromium.
  window.HTMLCanvasElement.prototype.getContext = () => null;
  let navigationMedia, navigationChanged;
  window.matchMedia = query => { const media = { matches: false, media: query, addEventListener(_type, handler) { if (query.includes("1023")) navigationChanged = handler; }, removeEventListener() {} }; if (query.includes("1023")) navigationMedia = media; return media; };
  window.confirm = () => false;
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  window.HTMLElement.prototype.showPopover = function () { this.dataset.open = "true"; this.dispatchEvent(Object.assign(new window.Event("toggle"), { newState: "open" })); };
  window.HTMLElement.prototype.hidePopover = function () { delete this.dataset.open; this.dispatchEvent(Object.assign(new window.Event("toggle"), { newState: "closed" })); };
  window.HTMLElement.prototype.togglePopover = function () { if (this.dataset.open) this.hidePopover(); else this.showPopover(); };
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
    constructor(url, protocols) { super(url, protocols, { origin: fixture.origin }); sockets.push(this); this.on("error", () => {}); this.addEventListener("message", event => { const message = JSON.parse(event.data); if (message.type === "dashboard.ready") this.lastReady = message; }); }
  }
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator,
    CSS: { escape: value => value }, fetch: browserFetch, localStorage: window.localStorage, indexedDB: new IDBFactory(), WebSocket: BrowserSocket, IS_REACT_ACT_ENVIRONMENT: true })) {
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
  const armSigned = action => { gatedAction=action; signedStarted=false; signedSerial++; return `Signed result ${signedSerial}: ${action}`; };
  const finishSigned = async (action, before, expectedMessage, selector="dialog.shell-confirm[open]",whileHeld=()=>{}) => {
    assert.equal(fixture.requests.filter(r=>r.action===action).length,before,"Nothing dispatches before confirmation");
    const dialog=rootElement.querySelector(selector);
    assert.ok(dialog,"Bound confirmation");assert.ok(dialog.textContent.includes("TonimSMP"));assert.ok(dialog.textContent.includes(second.serverId));
    assert.ok(!text().includes(expectedMessage),"No optimistic result while confirming");
    await click(dialog.querySelector('button.pp-button-danger'));
    await wait(()=>signedStarted,"signed agent receives confirmed action");
    assert.ok(!text().includes(expectedMessage),"No optimistic result while response is held");
    const request=fixture.requests.filter(r=>r.action===action).at(-1);
    assert.equal(request.serverId,second.serverId);assert.equal(request.parameters.confirmed,true);
    whileHeld();
    await act(async()=>releaseSigned());
    await wait(()=>text().includes(expectedMessage),"Signed response shown");gatedAction="";
    if(rootElement.querySelector('.pp-toast button'))await click(rootElement.querySelector('.pp-toast button'));
  };
  const quickRestart = async () => {
    await click(button("Server"));
    await wait(() => button("Restart server") && !button("Restart server").disabled, "verified Host service makes restart available");
    await click(button("Restart server"));
  };
  const choose = async (node, value) => {
    assert.ok(node, "Required dropdown missing");
    await click(node);
    const option = [...window.document.querySelectorAll('[role="option"]')].find(item => item.dataset.value === value);
    await click(option);
  };
  const select = async id => choose(rootElement.querySelector('[role="combobox"]'), id);
  const currentName = () => rootElement.querySelector(".shell-server-identity")?.dataset.serverName;
  const health = () => rootElement.querySelector(".shell-health")?.dataset.state;
  const first = fixture.rooms[0], second = fixture.rooms[1];
  try {
    await saveRelayCredential(fixture.credentials[0]); await saveRelayCredential(fixture.credentials[1]); await selectRelayCredential(first.serverId);
    await mount();
    await t.test("opening selector shows live named cards and remembers the selected server", async () => {
      await wait(() => text().includes("PlexonCraft") && text().includes("TonimSMP") && text().includes("Continue to workspace"), "paired server selector");
      assert.ok(rootElement.querySelector(".shell"));
      await click(button("Client settings"));
      await wait(() => rootElement.querySelector(".client-preferences-dialog[open]"), "client settings dialog");
      for (const [label, value, attribute] of [["Accent", "violet", "plexonAccent"], ["Density", "spacious", "plexonDensity"], ["Chart style", "line", "plexonChartStyle"]]) {
        const field = [...rootElement.querySelectorAll('.client-preferences-dialog label')].find(node => node.querySelector('span')?.textContent === label).querySelector('[role="combobox"]');
        await choose(field, value);
        assert.equal(window.document.documentElement.dataset[attribute], value);
      }
      await click(button("Done"));
      assert.equal(JSON.parse(window.localStorage.getItem(UI_PREFERENCES_KEY)).accent, "violet");
      assert.equal(rootElement.querySelector('.fleet-card[data-selected="true"] > header h3').textContent, "PlexonCraft");
      await click(button("Continue to workspace"));
      await wait(() => currentName() === "PlexonCraft" && health() === "online", "PlexonCraft workspace");
      assert.equal(captureActionTarget(first.serverId).serverId, first.serverId);
    });
    await t.test("signed full shell agrees through skew at actual saved Display rates", async () => {
      await click(button("Overview"));
      first.suppressTelemetry=true;
      const restartPaper=async()=>{first.paper.socket.close();await act(async()=>{await fixture.attach(first,"PAPER");await fixture.sync(first);await sleep(120);});};
      const send=async(seconds,uptime=true)=>{
        const capturedAt=new Date(Date.now()+seconds*1000).toISOString();
        await act(async()=>{
          await first.paper.send("telemetry.server",{capturedAt,tps:[20],averageTickMillis:12,onlinePlayers:3,maximumPlayers:20});
          await first.paper.send("telemetry.system",{capturedAt,nodeId:first.nodeId,metricScope:"NODE",processRole:"MINECRAFT",jvmHeapUsedBytes:2e9,jvmHeapMaximumBytes:6e9,...(uptime?{processUptimeMillis:1000}:{})});
          await first.host.send("service.status",{nodeId:first.nodeId,state:"active",minecraftReady:true,resources:{capturedAt:new Date().toISOString(),scope:"MINECRAFT_SERVICE",source:"SYSTEMD_CGROUP",cpuUnit:"PERCENT_OF_ONE_CORE",cpuAvailable:true,cpuPercent:150,memoryAvailable:true,memoryBytes:4e9}});
        });
      };
      const paperTiles=()=>[...rootElement.querySelectorAll('[data-instrument="tps"], [data-instrument="mspt"], [data-instrument="players"], [data-instrument="heap"]')];
      for(const rate of [0,500,2000]){
        await click(button("Client settings"));
        const label=[...rootElement.querySelectorAll('.client-preferences-dialog label')].find(n=>n.querySelector('span')?.textContent==='Display update rate');
        await choose(label?.querySelector('[role="combobox"]'),String(rate));await click(button("Done"));
        assert.equal(JSON.parse(window.localStorage.getItem(UI_PREFERENCES_KEY)).displayUpdateRateMs,rate);
        await restartPaper();
        for(const seconds of [6,30,120]){
          await send(seconds);await wait(()=>health()==='skew'&&paperTiles().length===4&&paperTiles().every(n=>n.textContent.includes(`clock skew +${seconds} s`)),`signed +${seconds}s display ${rate}`);
          for(const tile of paperTiles()){assert.notEqual(tile.querySelector('strong').textContent,'—');assert.doesNotMatch(tile.textContent,/\blive\b/i);}
          for(const pulse of rootElement.querySelectorAll('.tick-pulse')){assert.match(pulse.textContent,/clock skew/);assert.doesNotMatch(pulse.textContent,/\blive\b/i);}
          assert.match(rootElement.querySelector('.shell-health').textContent,/Paper.*clock.*ahead/s);
          assert.equal(rootElement.querySelector('[data-instrument="serviceCpu"] strong').textContent,'150.0%');
        }
      }
      await restartPaper();await send(0,false);await wait(()=>health()==='online'&&rootElement.querySelector('.overview-identity').textContent.includes('Paper uptimeNot supplied'),'new session first captures');
      assert.doesNotMatch([...rootElement.querySelectorAll('.tick-pulse')].map(n=>n.textContent).join(' '),/clock skew/);
      const receipt=rootElement.querySelector('.tick-pulse-compact').dataset.pulseReceivedAt;
      await act(async()=>{await first.host.send('telemetry.system',{capturedAt:new Date().toISOString(),nodeId:first.nodeId,metricScope:'NODE',processRole:'HOST',hostCpuPercent:35});await sleep(2200);});
      assert.equal(rootElement.querySelector('.tick-pulse-compact').dataset.pulseReceivedAt,receipt,'Host packet must not replace Paper receipt');
      first.suppressTelemetry=false;await fixture.telemetry();await wait(()=>health()==='online','resume clocks');
    });
    await t.test("every mounted palette destination navigates without an operation, including server choices", async () => {
      // Workspace mounting may query existing authorized data. Every other request
      // is forbidden here, including future operations absent from a mutation regex.
      const navigationReads = new Set(["players.snapshot.request", "console.history", "console.history.errors", "files.list", "files.read", "server.status", "provider.status", "maintenance.status", "maintenance.settings.get", "backup.full.list", "backup.preflight", "audit.list", "audit.self", "devices.list", "settings.view"]);
      const mutations = () => fixture.requests.filter(r => !navigationReads.has(r.action));
      const before = mutations().map(r => r.action);
      for (const page of ["Overview", "Performance", "Players", "Console", "Chat", "Plugins", "Server", "Backups", "Configuration", "Access", "Audit", "Settings", "Fleet"]) {
        await click(rootElement.querySelector('button[aria-label="Open command palette"]'));
        await click(button("Go to " + page));
        await wait(() => rootElement.querySelector(".shell-page-heading h1")?.textContent === page, "palette navigation " + page);
        await wait(() => rootElement.querySelector(page === "Overview" ? "[data-ui6-overview]" : ["Fleet","Performance","Players","Console","Chat","Plugins","Server","Backups","Configuration","Access","Audit","Settings"].includes(page) ? "[data-ui6-workspace]" : "[data-ui6-workspace-mounted]")?.childElementCount > 0, "lazy workspace mounted " + page);
      }
      await click(rootElement.querySelector('button[aria-label="Open command palette"]'));
      await click([...rootElement.querySelectorAll('.shell-palette button')].find(b => b.textContent === "PlexonCraft"));
      await wait(() => currentName() === "PlexonCraft" && health() === "online", "palette server navigation");
      await click(button("Overview"));
      assert.deepEqual(mutations().map(r => r.action), before);
      assert.equal(rootElement.querySelector('dialog.shell-confirm[open]'), null);
    });
    await t.test("switch resets data and confirmation before a second signed workspace becomes live", async () => {
      await quickRestart();
      await wait(() => rootElement.querySelector("dialog[open]"), "confirmation");
      assert.match(rootElement.querySelector("dialog[open]").textContent, /PlexonCraft/);
      const oldSocket = sockets.find(socket => socket.protocol === "plexonpanel-v3" && socket.readyState === 1);
      await select(second.serverId);
      assert.equal(rootElement.querySelector("dialog[open]"), null);
      assert.throws(() => captureActionTarget(first.serverId));
      oldSocket.onmessage?.({ data: JSON.stringify({ type: "server.event", serverId: first.serverId, eventType: "telemetry.server", body: { serverName: "WRONG_INSTANCE_SENTINEL", onlinePlayers: 999 } }) });
      await wait(() => currentName() === "TonimSMP" && health() === "online", "TonimSMP workspace");
      assert.doesNotMatch(text(), /WRONG_INSTANCE_SENTINEL/);
      assert.equal((await loadRelayCredential()).serverId, second.serverId);
      await quickRestart();
      await wait(() => rootElement.querySelector("dialog[open]"), "TonimSMP confirmation");
      assert.match(rootElement.querySelector("dialog[open]").textContent, /TonimSMP/);
      await click(rootElement.querySelector("dialog.shell-confirm[open] button.pp-button-danger"));
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
      assert.equal(rootElement.querySelector('.fleet-card[data-selected="true"] > header h3').textContent, "PlexonCraft");
      await click(button("Continue to workspace"));
      await wait(() => rootElement.querySelector(".shell-page-heading h1")?.textContent === "Players" && health() === "online", "remembered per-server page");
      await select(second.serverId);
      await wait(() => currentName() === "TonimSMP" && health() === "online", "second page scope");
      assert.equal(rootElement.querySelector(".shell-page-heading h1").textContent, "Server");
    });
    await t.test("confirmation binds the original server, action and command parameters even if the form changes", async () => {
      await click(button("Console"));
      await wait(() => rootElement.querySelector('[aria-label="Console command"]'), "console command input");
      const editCommand = async value => { const input = rootElement.querySelector('[aria-label="Console command"]'); await act(async () => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, value); input.dispatchEvent(new window.Event("input", { bubbles: true })); }); };
      await editCommand("tps");
      const signedMessage=armSigned("console.execute");
      const before = fixture.requests.filter(r => r.action === "console.execute").length;
      await act(async () => rootElement.querySelector('.view-command-bar').dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
      await wait(() => rootElement.querySelector('dialog.shell-confirm[open]'), "bound console confirmation");
      const dialog = rootElement.querySelector('dialog.shell-confirm');
      assert.match(dialog.textContent, /TonimSMP.*Run command|Run command.*TonimSMP/s);
      assert.equal(dialog.querySelector('pre').textContent, "tps");
      assert.equal(fixture.requests.filter(r => r.action === "console.execute").length, before);
      await editCommand("list");
      await finishSigned("console.execute",before,signedMessage);
      const request = fixture.requests.filter(r => r.action === "console.execute").at(-1);
      assert.equal(request.serverId, second.serverId); assert.equal(request.kind, "PAPER");
      assert.deepEqual(request.parameters, { command: "tps", confirmed: true });
      await click(button("Overview"));
    });
    await t.test("player confirmation preserves the supplied name and short UUID when the roster changes",async()=>{
      const playerId="00000000-0000-0000-0000-000000000001";
      const send=async name=>second.paper.send("inventory.players",{snapshotId:"00000000-0000-0000-0000-000000000002",capturedAt:new Date().toISOString(),offset:0,complete:true,players:[{uuid:playerId,name,world:"Survival",gameMode:"SURVIVAL"}]});
      await click(button("Players"));await act(async()=>{await send("ImmutablePlayer");await sleep(100);});
      await wait(()=>button("Manage"),"current player");await click(button("Manage"));await click(button("Moderation"));const before=fixture.requests.filter(r=>r.action==="player.ban").length;const signedMessage=armSigned("player.ban");await click(button("Ban player"));
      await wait(()=>rootElement.querySelector("dialog.shell-confirm[open]"),"player confirmation");
      const confirmation=()=>rootElement.querySelector("dialog.shell-confirm[open]");
      assert.match(confirmation().textContent,/TonimSMP/);assert.match(confirmation().textContent,/ImmutablePlayer/);assert.match(confirmation().textContent,/00000000/);
      await act(async()=>{await send("LaterPlayer");await sleep(100);});
      assert.match(confirmation().textContent,/ImmutablePlayer/);assert.doesNotMatch(confirmation().textContent,/LaterPlayer/);
      await finishSigned("player.ban",before,signedMessage);
      await click(rootElement.querySelector('dialog[open] button[aria-label^="Close "]'));await click(button("Overview"));
    });
    await t.test("chat send and configured plugin reload confirm their bound server and await signed results",async()=>{
      await click(button("Chat"));await wait(()=>rootElement.querySelector('[data-ui6-workspace="Chat"] textarea'),"chat composer");
      const textarea=rootElement.querySelector('[data-ui6-workspace="Chat"] textarea');
      await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(textarea,'Signed fixture message');textarea.dispatchEvent(new window.Event('input',{bubbles:true}));});
      let before=fixture.requests.filter(r=>r.action==='chat.global.send').length;let message=armSigned('chat.global.send');
      await click(button('Send to global chat'));await wait(()=>rootElement.querySelector('dialog.shell-confirm[open]'),'chat confirmation');await finishSigned('chat.global.send',before,message);
      await click(button('Plugins'));await act(async()=>{await second.paper.send('inventory.plugins',{snapshotId:'00000000-0000-0000-0000-000000000009',capturedAt:new Date().toISOString(),offset:0,plugins:[{name:'FixturePlugin',version:'1',enabled:true}]});});
      await wait(()=>button('Details'),'plugin details');await click(button('Details'));await wait(()=>button('Run configured reload'),'configured reload');
      before=fixture.requests.filter(r=>r.action==='plugin.command.reload').length;message=armSigned('plugin.command.reload');await click(button('Run configured reload'));await wait(()=>rootElement.querySelector('dialog.shell-confirm[open]'),'plugin confirmation');assert.match(rootElement.querySelector('dialog.shell-confirm[open]').textContent,/FixturePlugin/);await finishSigned('plugin.command.reload',before,message);assert.equal(fixture.requests.filter(r=>r.action==='plugin.command.reload').at(-1).parameters.plugin,'FixturePlugin');
      await click(rootElement.querySelector('dialog[open] button[aria-label^="Close "]'));await click(button('Overview'));
    });
    await t.test("same-server target generation replacement cancels confirmation before dispatch", async () => {
      const before = fixture.requests.filter(r => r.action === "server.restart").length;
      const target = captureActionTarget(second.serverId, "HOST");
      await quickRestart();
      await wait(() => rootElement.querySelector('dialog.shell-confirm[open]'), "generation confirmation");
      await act(async () => { second.host.socket.close(); await sleep(60); });
      await wait(() => health() === "host-disconnected", "old Host session retired");
      await act(async () => { await fixture.attach(second, "HOST"); await fixture.telemetry(); });
      await wait(() => !rootElement.querySelector('dialog.shell-confirm[open]') && health() === "online", "new Host session cancels review");
      assert.notEqual(captureActionTarget(second.serverId, "HOST").generation, target.generation);
      assert.equal(fixture.requests.filter(r => r.action === "server.restart").length, before);
    });
    await t.test("a completion from an abandoned server is never displayed in the selected workspace", async () => {
      holdCompletion = true;
      await quickRestart();
      await wait(() => rootElement.querySelector('dialog.shell-confirm[open]'), "held completion confirmation");
      await click(rootElement.querySelector("dialog.shell-confirm[open] button.pp-button-danger"));
      await wait(() => releaseCompletion, "agent holds completion after dispatch");
      await select(first.serverId); await wait(() => currentName() === "PlexonCraft" && health() === "online", "switch during completion");
      holdCompletion = false; await act(async () => { releaseCompletion(); await sleep(100); });
      assert.doesNotMatch(text(), /ABANDONED_RESULT_SENTINEL/);
      assert.equal(captureActionTarget(first.serverId).serverId, first.serverId);
      await select(second.serverId); await wait(() => currentName() === "TonimSMP" && health() === "online", "return after abandoned result");
      await click(button("Overview"));
    });
    await t.test("reported grant expansion cannot expand the verified signed grant or dispatch", async () => {
      const socket = sockets.findLast(s => s.protocol === "plexonpanel-v3" && s.readyState === 1);
      assert.ok(socket.lastReady);
      await wait(() => rootElement.querySelector('[data-ui6-overview]'), "Overview mounted before grant test");
      await act(async () => { await sleep(150); });
      const before = fixture.requests.length;
      const message = structuredClone(socket.lastReady);
      message.device.scopes.push("UNSIGNED_SCOPE_SENTINEL");
      await act(async () => socket.onmessage({ data: JSON.stringify(message) }));
      await wait(() => text().includes("does not match this browser's signed grant"), "grant mismatch fails closed");
      await wait(() => { try { captureActionTarget(second.serverId); return false; } catch { return true; } }, "rejected socket closes and retires its target");
      assert.throws(() => captureActionTarget(second.serverId));
      assert.equal(fixture.requests.length, before);
      await wait(() => health() === "online", "valid signed reconnection");
    });
    await t.test("mounted navigation-only palette and lifecycle controls preserve unknown Host service state", async () => {
      const before = fixture.requests.filter(r => ["server.start", "server.stop", "server.restart"].includes(r.action)).length;
      second.serviceState = undefined;
      await act(async () => fixture.telemetry());
      await wait(() => [...rootElement.querySelectorAll('.shell-facts dt')].find(node => node.textContent === 'Host service state')?.nextElementSibling?.textContent === "unknown", "missing Host service sample is displayed");
      await click(rootElement.querySelector('button[aria-label="Open command palette"]'));
      await wait(() => rootElement.querySelector('dialog.shell-palette[open]'), "missing-state palette mounted");
      assert.equal([...rootElement.querySelectorAll('dialog.shell-palette button')].some(b => /Restart server|Refresh current|Copy diagnostics/.test(b.textContent)), false);
      await click(button("Go to Server"));
      await wait(() => button("Start server"), "unknown-state lifecycle workspace");
      for (const label of ["Start server", "Stop server", "Restart server"]) assert.equal(button(label).disabled, true);
      assert.equal(fixture.requests.filter(r => ["server.start", "server.stop", "server.restart"].includes(r.action)).length, before);
      second.serviceState = "active"; await act(async () => fixture.telemetry());
      await wait(() => button("Restart server") && !button("Restart server").disabled, "fresh Host state restores restart");
      await click(button("Overview"));
    });
    await t.test("lifecycle commands complete across real signed Paper disconnect and reconnect events", async () => {
      simulateLifecycle = true;
      await click(button("Server"));
      for (const [label, action, expected] of [["Stop server", "server.stop", "stopped"], ["Start server", "server.start", "online"], ["Restart server", "server.restart", "online"]]) {
        await wait(() => button(label) && !button(label).disabled, `${label} available`);
        const before=fixture.requests.filter(r=>r.action===action).length;const signedMessage=armSigned(action);
        await click(button(label));
        { await wait(() => rootElement.querySelector("dialog[open]"), "lifecycle confirmation"); await finishSigned(action,before,signedMessage); }

        await wait(() => rootElement.querySelector('.workspace-operation [data-state="current"]')?.textContent.includes("Complete"), `${action} observed success`);
        assert.equal(fixture.requests.filter(r => r.action === action && r.serverId === second.serverId).length, action === "server.restart" ? 3 : 1);
        await wait(() => health() === expected, `${action} connection state`);
      }
      simulateLifecycle = false;
      await click(button("Overview"));
    });
    await t.test("a busy stop stays visible in lifecycle controls without delayed or automatic replay", async () => {
      lifecycleBusy = true;
      await click(button("Server"));
      await wait(() => button("Stop server") && !button("Stop server").disabled, "stop control ready");
      const before = fixture.requests.filter(r => r.action === "server.stop" && r.serverId === second.serverId).length;
      await click(button("Stop server"));
      await wait(() => rootElement.querySelector("dialog[open]"), "busy stop confirmation");
      await click(rootElement.querySelector("dialog.shell-confirm[open] button.pp-button-danger"));
      await wait(() => rootElement.querySelector('.workspace-lifecycle-card [role="alert"]')?.textContent.includes("Server control is busy"), "persistent lifecycle rejection");
      assert.match(rootElement.querySelector('.workspace-lifecycle-card [role="alert"]').textContent, /will not run later/);
      await wait(() => button("Stop server") && !button("Stop server").disabled, "rejected stop releases controls");
      if (rootElement.querySelector('.pp-toast button')) await click(rootElement.querySelector('.pp-toast button'));
      assert.ok(rootElement.querySelector('.workspace-lifecycle-card [role="alert"]'));
      assert.equal(rootElement.querySelector(".workspace-operation"), null);
      assert.equal(health(), "online");
      assert.equal(fixture.requests.filter(r => r.action === "server.stop" && r.serverId === second.serverId).length, before + 1);
      lifecycleBusy = false;
      await click(button("Overview"));
    });
    await t.test("Owner configuration uses Paper editing, reviews changes and preserves conflicts and unsaved work", async () => {
      await click(button("Configuration"));
      const fileButton = () => [...rootElement.querySelectorAll('.pp-file-list button')].find(node => node.textContent.includes("bukkit.yml"));
      await wait(() => fileButton(), "configuration files");
      await click(fileButton());
      await wait(() => rootElement.querySelector('.pp-file-split textarea'), "configuration editor");
      const edit = async content => {
        const field = rootElement.querySelector('.pp-file-split textarea');
        await act(async () => { Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set.call(field, content); field.dispatchEvent(new window.Event("input", { bubbles: true })); });
      };
      const changed = "settings:\n  sample: false\n";
      await edit(changed);
      const saveButton = () => button("Review changes") || button("Save reviewed changes");
      await wait(() => saveButton(), "dirty editor");
      const before = fixture.requests.filter(r => r.action === "files.write").length;
      const message=armSigned("files.write");
      await click(saveButton());
      assert.equal(fixture.requests.filter(r => r.action === "files.write").length, before);
      await click(saveButton());
      await wait(()=>rootElement.querySelector("dialog.shell-confirm[open]"),"file/server save confirmation");
      assert.ok(rootElement.querySelector("dialog.shell-confirm[open]").textContent.includes("bukkit.yml"));
      await finishSigned("files.write",before,message,"dialog.shell-confirm[open]",()=>assert.notEqual(fileContent,changed,"File stays unchanged until signed completion"));
      await wait(() => fileContent === changed, "reviewed configuration save");
      const request = fixture.requests.find(r => r.action === "files.write");
      assert.equal(request.kind, "PAPER"); assert.equal(request.serverId, second.serverId);
      simulateConflict = true;
      await edit("settings:\n  sample: pending\n");
      await click(saveButton()); await click(saveButton());
      await wait(()=>rootElement.querySelector("dialog.shell-confirm[open]"),"conflict save confirmation");
      await click(rootElement.querySelector("dialog.shell-confirm[open] button.pp-button-danger"));
      await wait(() => text().includes("Conflict: the server file changed"), "conflict keeps edits");
      assert.match(rootElement.querySelector('.pp-file-split textarea').value, /pending/);
      const writesBeforeLeave = fixture.requests.filter(r => r.action === "files.write").length;
      await click(button("Overview"));
      assert.ok(rootElement.querySelector('.pp-file-split textarea'), "rail cannot discard a dirty file without approval");
      await click(rootElement.querySelector('button[aria-label="Open command palette"]'));
      await wait(() => rootElement.querySelector('dialog.shell-palette[open]'), "dirty palette");
      await click(button("Go to Overview"));
      assert.ok(rootElement.querySelector('.pp-file-split textarea'), "palette cannot discard a dirty file without approval");
      await act(async () => { navigationMedia.matches = true; navigationChanged(); });
      await click(rootElement.querySelector('button[aria-label="Open navigation"]'));
      await click([...rootElement.querySelectorAll('.shell-drawer button')].find(b => b.textContent === "Overview"));
      assert.ok(rootElement.querySelector('.pp-file-split textarea'), "drawer cannot discard a dirty file without approval");
      assert.ok(rootElement.querySelector('.shell-drawer[open]'), "blocked drawer navigation keeps the drawer open");
      await click(rootElement.querySelector('button[aria-label="Close Navigation"]'));
      await act(async () => { navigationMedia.matches = false; navigationChanged(); });
      await select(first.serverId);
      assert.equal(currentName(), "TonimSMP");
      assert.equal(fixture.requests.filter(r => r.action === "files.write").length, writesBeforeLeave);
      await edit(changed); simulateConflict = false;
      await click(button("Overview"));
      assert.equal(JSON.parse(window.localStorage.getItem(UI_PREFERENCES_KEY)).density, "spacious");
    });
    await t.test("backup setup is instance-specific, unverified checks stay unknown and cached preflight cannot authorize a new job", async () => {
      // Start backup interaction with a fresh authenticated session, like switching instances.
      await select(first.serverId); await wait(() => health() === "online", "first server connected");
      await select(second.serverId); await wait(() => health() === "online", "selected server connected");
      await click([...rootElement.querySelectorAll('.shell-nav button')].find(node => node.textContent.trim() === "Backups"));
      await wait(() => text().includes("No off-site rclone provider"), "missing provider preflight");
      assert.match(text(), /TonimSMP backup destination/);
      assert.match(text(), /\/var\/backups\/plexonpanel\/instances\/tonimsmp/);
      const check = label => [...rootElement.querySelectorAll('.pp-list-row')].find(node => node.querySelector('strong').textContent === label).querySelector('.pp-badge').textContent;
      assert.equal(check("Backup storage"), "Unknown"); assert.equal(check("Filesystem read contract"), "Unknown");
      assert.equal(button("Fully Backup Now").disabled, true);
      backupMode = "ready-old-provider";
      await wait(() => !rootElement.querySelector('.view-backup-toolbar button').disabled, "refresh available");
      await click(rootElement.querySelector('.view-backup-toolbar button'));
      await wait(() => !button("Fully Backup Now").disabled, "fresh authoritative preflight");
      assert.equal(check("Backup storage"), "Ready");
      await click(button("Re-run Host preflight"));
      await wait(() => check("Google Drive / rclone") === "Ready", "new preflight supersedes stale provider status");
      backupMode = "source-failed";
      await wait(() => !rootElement.querySelector('.view-backup-toolbar button').disabled, "refresh available");
      await click(rootElement.querySelector('.view-backup-toolbar button'));
      assert.equal(button("Fully Backup Now").disabled, true);
      await wait(() => text().includes("Fixture source unreadable"), "source failure replaces readiness");
      assert.equal(check("Filesystem read contract"), "Failed"); assert.equal(check("Backup storage"), "Unknown");
      assert.equal(button("Fully Backup Now").disabled, true);
      assert.equal(fixture.requests.some(request => request.action === "maintenance.full-backup.create"), false);
      await click(button("Test Google Drive"));
      await wait(() => text().includes("Last operation failure"), "server-bound safe diagnostic");
      assert.ok(window.sessionStorage.getItem(`plexonpanel.backup.last-safe-failure.v3:${second.serverId}`));
      await select(first.serverId);
      await wait(() => health() === "online", "first backup server connected");
      await click([...rootElement.querySelectorAll('.shell-nav button')].find(node => node.textContent.trim() === "Backups"));
      await wait(() => text().includes("PlexonCraft backup destination"), "first instance backup view");
      assert.equal(text().includes("Last operation failure"), false);
      await select(second.serverId);
      await wait(() => text().includes("TonimSMP backup destination") && text().includes("Last operation failure"), "matching instance diagnostic restored");
      backupMode = "ready";
    });
    await t.test("signed degraded job separates verification and retry from preflight-gated launch", async()=>{
      backupJob={jobId:'11111111-1111-4111-8111-111111111111',backupId:'fixture-backup',phase:'DEGRADED',result:'DEGRADED',errorCode:'REMOTE_VERIFY_FAILED',errorMessage:'Remote verification failed',retryable:true,localBackupVerified:true,remoteBackupVerified:false};
      for(const blocked of [false,true]){
        backupMode=blocked?'source-failed':'ready';
        await select(first.serverId);await wait(()=>health()==='online','fresh first backup session');await select(second.serverId);await wait(()=>health()==='online','fresh second backup session');
        await click([...rootElement.querySelectorAll('.shell-nav button')].find(n=>n.textContent.trim()==='Backups'));
        await wait(()=>text().includes('Local backup verified. Off-site copy not current.'),'degraded replay');
        await wait(()=>text().includes(blocked?'Fixture source unreadable':'Host preflight passed'),'preflight response');
        assert.match(text(),/The Host could not verify the remote copy/);assert.match(text(),/REMOTE_VERIFY_FAILED/);assert.match(text(),/Minecraft availability restored/);
        assert.equal(button('Retry Upload').disabled,false);await wait(()=>button('Fully Backup Now').disabled===blocked,'preflight launch gate');
      }
      backupJob=null;backupMode='ready';
    });
    await t.test("signed upload progress is shown for the active Host job and ignored for other jobs", async () => {
      backupJob = { jobId: "11111111-1111-4111-8111-111111111111", phase: "UPLOADING_REMOTE", localBackupVerified: true };
      await wait(() => !rootElement.querySelector('.view-backup-toolbar button').disabled, "refresh available");
      await click(rootElement.querySelector('.view-backup-toolbar button'));
      await wait(() => text().includes("Uploading to Google Drive"), "durable upload job");
      const statusBefore=fixture.requests.filter(r=>r.action==='maintenance.status').length;
      await act(async()=>root.unmount());await mount();await wait(()=>button('Continue to workspace'),'reload server selector');await click(button('Continue to workspace'));
      await wait(()=>text().includes(backupJob.jobId)&&fixture.requests.filter(r=>r.action==='maintenance.status').length>statusBefore,'reload reconstructs job from signed Host status');
      await act(async () => second.host.send("backup.progress", { jobId: backupJob.jobId, phase: "UPLOADING_REMOTE", bytesUploaded: 512, totalBytes: 1024, progress: 0.5, bytesPerSecond: 256 }));
      await wait(() => text().includes("50%"), "live verified job transfer progress");
      await act(async () => second.host.send("backup.progress", { jobId: "22222222-2222-4222-8222-222222222222", phase: "UPLOADING_REMOTE", bytesUploaded: 999999, totalBytes: 999999, progress: 1 }));
      await act(async () => { await sleep(600); });
      assert.equal(text().includes("976.6 KiB"), false);
      backupJob = null;
      await click([...rootElement.querySelectorAll('.shell-nav button')].find(node => node.textContent.trim() === "Server"));
    });
    await t.test("cold backup review cancels without a command and confirms only the selected Host", async () => {
      await select(first.serverId); await wait(() => health() === "online", "first backup session");
      await select(second.serverId); await wait(() => health() === "online", "second backup session");
      await click([...rootElement.querySelectorAll('.shell-nav button')].find(node => node.textContent.trim() === "Backups"));
      await wait(() => button("Fully Backup Now") && !button("Fully Backup Now").disabled, "backup ready for review");
      const requests = () => fixture.requests.filter(request => request.action === "maintenance.full-backup.create");
      await click(button("Fully Backup Now"));
      await wait(() => rootElement.querySelector('dialog[open].backup-ui-modal'), "custom backup confirmation");
      assert.match(rootElement.querySelector('.backup-ui-modal').textContent, /TonimSMP/);
      assert.equal(requests().length, 0);
      await click([...rootElement.querySelectorAll('.backup-ui-modal button')].find(node => node.textContent === "Cancel"));
      assert.equal(requests().length, 0);
      await click(button('Fully Backup Now'));await wait(()=>rootElement.querySelector('dialog.backup-ui-modal[open]'),'review before Host replacement');
      await act(async()=>{second.host.socket.close();await sleep(120);await fixture.attach(second,'HOST');await fixture.sync(second);await fixture.telemetry();await sleep(100);});
      await wait(()=>!rootElement.querySelector('dialog.backup-ui-modal[open]'),'changed Host invalidates the reviewed target');assert.equal(requests().length,0);
      await wait(()=>button('Fully Backup Now')&&!button('Fully Backup Now').disabled,'new Host ready for a new review');
      const signedMessage=armSigned('maintenance.full-backup.create');
      await click(button("Fully Backup Now"));
      await wait(()=>rootElement.querySelector('dialog.backup-ui-modal[open]'),'backup confirmation');
      await finishSigned('maintenance.full-backup.create',0,signedMessage,'dialog.backup-ui-modal[open]');
      await wait(() => requests().length === 1 && !rootElement.querySelector('.backup-ui-modal'), "confirmed backup queued");
      const request = requests()[0];
      assert.equal(request.serverId, second.serverId); assert.equal(request.kind, "HOST");
      assert.equal(request.parameters.confirmed, true); assert.equal(request.parameters.countdownSeconds, 1800);
      await click([...rootElement.querySelectorAll('.shell-nav button')].find(node => node.textContent.trim() === "Server"));
    });
    await t.test("Retry Upload and scheduler save keep their target and wait for signed completion",async()=>{
      backupInventory=[{backupId:'fixture-retained-backup',local:true,offsite:false,timestamp:new Date().toISOString()}];
      await click(button('Backups'));await wait(()=>button('Retry Upload'),'retained upload retry');
      let before=fixture.requests.filter(r=>r.action==='backup.full.retry-upload').length;let message=armSigned('backup.full.retry-upload');await click(button('Retry Upload'));
      await wait(()=>rootElement.querySelector('dialog.shell-confirm[open]'),'retry confirmation');assert.ok(rootElement.querySelector('dialog.shell-confirm').textContent.includes('fixture-retained-backup'));await finishSigned('backup.full.retry-upload',before,message);
      const timezone=[...rootElement.querySelectorAll('label')].find(n=>n.textContent.startsWith('Timezone')).querySelector('input');
      await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(timezone,'Europe/London');timezone.dispatchEvent(new window.Event('input',{bubbles:true}));});
      before=fixture.requests.filter(r=>r.action==='maintenance.settings.update').length;message=armSigned('maintenance.settings.update');await click(button('Save settings'));await wait(()=>rootElement.querySelector('dialog.shell-confirm[open]'),'scheduler confirmation');await finishSigned('maintenance.settings.update',before,message);
      assert.equal(fixture.requests.filter(r=>r.action==='maintenance.settings.update').at(-1).parameters.settings.timezone,'Europe/London');backupInventory=[];await click(button('Server'));
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
    await t.test('access revocation confirms the device and retains its row until the signed response',async()=>{
      await select(first.serverId);await wait(()=>health()==='online','fresh Access first session');await select(second.serverId);await wait(()=>health()==='online','fresh Access target');
      await click(button('Access'));await wait(()=>text().includes('Fixture secondary browser'),'paired device list');
      const row=()=>[...rootElement.querySelectorAll('tr')].find(n=>n.textContent.includes('Fixture secondary browser'));
      const before=fixture.requests.filter(r=>r.action==='devices.revoke').length;const message=armSigned('devices.revoke');await click([...row().querySelectorAll('button')].find(n=>n.textContent==='Revoke'));
      await wait(()=>rootElement.querySelector('dialog.shell-confirm[open]'),'revoke confirmation');assert.ok(rootElement.querySelector('dialog.shell-confirm').textContent.includes(secondaryDeviceId));
      await finishSigned('devices.revoke',before,message,'dialog.shell-confirm[open]',()=>assert.ok(row(),'No optimistic row removal while signed response is held'));
      await wait(()=>!row(),'signed refresh removes revoked device');assert.equal(fixture.requests.filter(r=>r.action==='devices.revoke').at(-1).parameters.deviceId,secondaryDeviceId);
    });
    await t.test('Settings clears selected-server chat and cache in memory and storage without an agent action',async()=>{
      await click(button('Chat'));await act(async()=>{await second.paper.send('chat.message',{messageId:'fixture-local-chat',capturedAt:new Date().toISOString(),playerName:'Fixture',content:'Local cache sentinel'});await sleep(100);});await wait(()=>text().includes('Local cache sentinel'),'received local chat');
      await click(button('Settings'));await wait(()=>button('Clear local chat cache'),'local privacy controls');await act(async()=>sleep(100));
      // Hold automatic source packets during the local-clear observation, then explicitly prove refill.
      const originalSend=[second.paper.send,second.host.send];
      [second.paper,second.host].forEach((agent,i)=>{agent.send=(type,body)=>/^(telemetry\.|service\.status)/.test(type)?Promise.resolve():originalSend[i](type,body);});
      await act(async()=>sleep(100));
      const other=await loadControlCache(first.serverId),credential=await loadRelayCredential(),prefs=window.localStorage.getItem(UI_PREFERENCES_KEY),before=fixture.requests.length;
      assert.ok(other);await click(button('Clear local chat cache'));await wait(()=>text().includes('Local chat cache cleared'),'chat cache completion');assert.equal((await loadControlCache(second.serverId)).chat.length,0);
      await click(button('Chat'));assert.ok(!text().includes('Local cache sentinel'),'memory chat cleared');await click(button('Settings'));await click(button('Clear local cache'));await wait(()=>text().includes('Local cache cleared for this server'),'cache completion');
      const cleared=await loadControlCache(second.serverId);assert.ok(!cleared||(cleared.chat.length===0&&cleared.history.length===0&&cleared.console.length===0));assert.notEqual(health(),"online","Cleared telemetry is not fabricated as healthy");
      assert.deepEqual(await loadControlCache(first.serverId),other);assert.deepEqual(await loadRelayCredential(),credential);assert.equal(window.localStorage.getItem(UI_PREFERENCES_KEY),prefs);assert.equal(fixture.requests.length,before,'Local controls never ask an agent to clear data');
      [second.paper,second.host].forEach((agent,i)=>{agent.send=originalSend[i];});
      await act(async()=>fixture.telemetry());await wait(()=>health()==='online','new telemetry refills live state');await click(button('Server'));
    });
    await t.test("revoking one paired server keeps the other available and selectable", async () => {
      await act(async () => { await fixture.sync(second, []); await sleep(75); });
      await wait(() => text().includes("Pair this browser"), "revoked grant");
      for(let i=0;i<40 && await loadRelayCredential();i++)await act(async()=>sleep(25));
      assert.equal((await loadRelayCredential()), null);
      assert.throws(() => captureActionTarget(second.serverId));
      await select(first.serverId);
      await wait(() => currentName() === "PlexonCraft" && health() === "online", "remaining paired instance");
      assert.equal(captureActionTarget(first.serverId).serverId, first.serverId);
      await click(rootElement.querySelector('[role="combobox"]'));
      const selectorPopup=window.document.getElementById(rootElement.querySelector('[role="combobox"]').getAttribute('aria-controls'));
      assert.equal(selectorPopup.querySelectorAll('[role="option"]').length, 1);
      await click(rootElement.querySelector('[role="combobox"]'));
      await act(async () => { await fixture.close(); await sleep(50); });
      await wait(() => health() === "relay-unavailable", "relay outage");
      assert.match(text(), /Relay unavailable/);
      assert.throws(() => captureActionTarget(first.serverId));
    });
  } finally {
    releaseCompletion?.();
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

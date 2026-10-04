// DOM integration, not visual/browser certification. HTTP and loopback WebSocket,
// signed relay authentication, room routing and action completions are real; agents are simulated.
import assert from "node:assert/strict";
import { test } from "node:test";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import { IDBFactory } from "fake-indexeddb";
import WebSocket from "ws";
import { createFleetFixture } from "../scripts/support/fleet-fixture.mjs";
import Dashboard from "../.test-dist/app/dashboard-2-1.js";
import { saveRelayCredential, selectRelayCredential, loadRelayCredential } from "../.test-dist/lib/browser-store.js";
import { captureActionTarget, bindLiveSocket } from "../.test-dist/lib/data-source.js";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test("mounted Dashboard selects and operates independent signed instances without stale transitions", { timeout: 40_000 }, async t => {
  const fixture = await createFleetFixture({ names: ["PlexonCraft", "TonimSMP"], instanceKeys: ["plexoncraft", "tonimsmp"] });
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
  const mount = async () => { root = createRoot(rootElement); await act(async () => root.render(React.createElement(Dashboard))); };
  const wait = async (condition, label) => {
    const until = Date.now() + 7000;
    while (!condition()) {
      assert.ok(Date.now() < until, `Timed out: ${label}`);
      await act(async () => { await sleep(25); });
    }
  };
  const text = () => rootElement.textContent;
  const button = name => [...rootElement.querySelectorAll("button")].find(node => node.textContent.trim() === name);
  const click = async node => { assert.ok(node, "Required button missing"); await act(async () => node.dispatchEvent(new window.MouseEvent("click", { bubbles: true }))); };
  const select = async id => {
    const node = rootElement.querySelector('select'); assert.ok(node);
    await act(async () => { node.value = id; node.dispatchEvent(new window.Event("change", { bubbles: true })); });
  };
  const currentName = () => rootElement.querySelector(".cr21-server-identity strong")?.textContent;
  const health = () => rootElement.querySelector(".workspace-health")?.dataset.state;
  const first = fixture.rooms[0], second = fixture.rooms[1];
  try {
    await saveRelayCredential(fixture.credentials[0]); await saveRelayCredential(fixture.credentials[1]); await selectRelayCredential(first.serverId);
    await mount();
    await t.test("opening selector shows live named cards and remembers the selected server", async () => {
      await wait(() => text().includes("PlexonCraft") && text().includes("TonimSMP") && text().includes("Continue to workspace"), "paired server selector");
      assert.ok(rootElement.querySelector(".paired-server-home"));
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
    await t.test("same-tick A to B to A switches establish a fresh live command channel", async () => {
      await act(async () => {
        const node = rootElement.querySelector("select");
        for (const id of [first.serverId, second.serverId, first.serverId]) {
          node.value = id; node.dispatchEvent(new window.Event("change", { bubbles: true }));
        }
      });
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
      assert.equal(rootElement.querySelector("select").options.length, 1);
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

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test from "node:test";
import { clearBrowserWorkspace, loadRelayCredential } from "../src/adapter/browser-store";
import { configureRelay, pairDashboardServer } from "../src/adapter/data-source";

test("pairing claims a one-time code and persists only a same-relay credential", async () => {
  const originalFetch = globalThis.fetch;
  configureRelay("https://relay.example");
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://relay.example/v1/pairings/claim");
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), { code: "ABCD-1234", name: "Desk browser" });
    return new Response(JSON.stringify({
      ok: true,
      fingerprint: "synthetic-fingerprint",
      protocolVersion: 3,
      serverId: "server-pairing-test",
      deviceId: "device-pairing-test",
      name: "Desk browser",
      role: "Viewer",
      scopes: ["overview.view"],
      accessToken: "synthetic-pairing-token",
      websocketUrl: "wss://relay.example/v1/dashboard",
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    assert.deepEqual(await pairDashboardServer("ABCD-1234", "Desk browser"), { serverId: "server-pairing-test" });
    const stored = await loadRelayCredential();
    assert.equal(stored?.serverId, "server-pairing-test");
    assert.equal(stored?.websocketUrl, "wss://relay.example/v1/dashboard");
  } finally {
    await clearBrowserWorkspace("server-pairing-test");
    globalThis.fetch = originalFetch;
  }
});

test("pairing rejects a credential whose WebSocket belongs to another relay", async () => {
  const originalFetch = globalThis.fetch;
  configureRelay("https://relay.example");
  globalThis.fetch = async () => new Response(JSON.stringify({
    ok: true,
    fingerprint: "synthetic-fingerprint",
    protocolVersion: 3,
    serverId: "server-unsafe-test",
    deviceId: "device-unsafe-test",
    name: "Desk browser",
    role: "Viewer",
    scopes: ["overview.view"],
    accessToken: "synthetic-pairing-token",
    websocketUrl: "wss://different-relay.example/v1/dashboard",
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
  }), { status: 200, headers: { "Content-Type": "application/json" } });
  try {
    await assert.rejects(pairDashboardServer("ABCD-1234", "Desk browser"), /unsafe WebSocket URL/);
    assert.equal((await loadRelayCredential())?.serverId, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

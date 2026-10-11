import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { saveRelayCredential, loadRelayCredential, type RelayCredential } from "../src/adapter/browser-store";
import { configureRelay, requestLiveConnection } from "../src/adapter/data-source";
import { RelayConfigurationError } from "../src/adapter/relay-config";
import { session } from "../src/adapter/session";
import { makeFixture } from "../src/development/fixtures";
import { ACTION_CONTRACT_ID } from "../src/adapter/scopes";

const values = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {configurable: true, value: {getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key)}});
const fixture = makeFixture();
const credential: RelayCredential = {protocolVersion: 3, serverId: fixture.serverId, deviceId: "fixture-device", name: "Contract test", role: "Owner", scopes: fixture.ready!.device.scopes, accessToken: "synthetic-integration-token", websocketUrl: "wss://relay.integration.test/v1/dashboard", expiresAt: new Date(Date.now() + 600_000).toISOString()};
class Socket {
  static OPEN = 1; static CLOSING = 2;
  static all: Socket[] = [];
  readyState = 1;
  onopen: (() => void) | null = null;
  onclose: ((event: {code: number}) => void) | null = null;
  onmessage: ((event: {data: string}) => void) | null = null;
  onerror: (() => void) | null = null;
  sent: Record<string, unknown>[] = [];
  constructor(readonly url: string, readonly protocols: string[]) {
    Socket.all.push(this);
    queueMicrotask(() => {this.onopen?.(); this.receive({...fixture.ready, type: "dashboard.ready"});});
  }
  receive(message: unknown) {this.onmessage?.({data: JSON.stringify(message)});}
  close(code = 1000) {this.readyState = 3; queueMicrotask(() => this.onclose?.({code}));}
  send(text: string) {
    const request = JSON.parse(text); this.sent.push(request);
    if (request.type === "dashboard.action") queueMicrotask(() => this.receive({type: "server.event", serverId: credential.serverId, agentKind: request.agentKind, eventType: "action.result", body: {requestId: request.requestId, action: request.action, status: "SUCCESS", code: "OK", message: "Synthetic contract response", data: {lines: []}}}));
  }
}
async function until(check: () => boolean) {
  for (let i = 0; i < 100 && !check(); i++) await new Promise(r => setTimeout(r, 10));
  assert.ok(check(), "expected connection state was not reached");
}
test("relay mismatch sends no token and retains the stored credential", async () => {
  await saveRelayCredential(credential);
  configureRelay("https://different.integration.test");
  let requested = false; const original = globalThis.fetch;
  globalThis.fetch = async () => {requested = true; throw new Error("unexpected request");};
  try { await assert.rejects(requestLiveConnection(credential), RelayConfigurationError); assert.equal(requested, false); assert.equal((await loadRelayCredential())?.serverId, credential.serverId); }
  finally { globalThis.fetch = original; }
});
test("stored protocol 3 pairing reconnects, receives telemetry, completes a bound query and repairs its endpoint without re-pairing", async () => {
  const originalFetch = globalThis.fetch, originalSocket = globalThis.WebSocket;
  Object.defineProperty(globalThis, "WebSocket", {configurable: true, writable: true, value: Socket});
  let requests = 0, denied = false;
  globalThis.fetch = async (input, init) => {
    requests++; assert.equal(String(input), "https://relay.integration.test/v1/dashboard/session");
    assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${credential.accessToken}`);
    return denied ? new Response(JSON.stringify({error: "Device revoked"}), {status: 401}) : new Response(JSON.stringify({ok: true, protocolVersion: 3, actionContract: ACTION_CONTRACT_ID, serverId: credential.serverId, deviceId: credential.deviceId, role: credential.role, scopes: credential.scopes, expiresAt: credential.expiresAt}));
  };
  try {
    await session.start(); await until(() => session.getSnapshot().phase === "live");
    assert.equal(session.getSnapshot().relay.source, "pairing");
    const socket = Socket.all.at(-1)!;
    assert.equal(socket.url, credential.websocketUrl);
    assert.deepEqual(socket.protocols, ["plexonpanel-v3", `auth.${credential.accessToken}`]);
    socket.receive({type: "server.event", serverId: credential.serverId, agentKind: "PAPER", agentSession: "fixture-paper", eventType: "telemetry.server", body: {capturedAt: new Date().toISOString(), tps: [17.25], onlinePlayers: 4}});
    await until(() => {const tps = session.getSnapshot().state.server.tps; return Array.isArray(tps) && tps[0] === 17.25;});
    assert.equal((await session.query("console.history", {limit: 10}, "HOST")).status, "SUCCESS");
    await session.setRelayOrigin("https://wrong.integration.test");
    await until(() => session.getSnapshot().phase === "configuration-required");
    assert.equal((await loadRelayCredential())?.serverId, credential.serverId);
    const before = requests;
    await session.setRelayOrigin(null); await until(() => session.getSnapshot().phase === "live");
    assert.equal(requests, before + 1);
    denied = true; session.reconnect(); await until(() => session.getSnapshot().phase === "revoked");
    const deniedRequests = requests;
    await new Promise(r => setTimeout(r, 2200));
    assert.equal(requests, deniedRequests, "revocation must stop retries");
    assert.equal(session.getSnapshot().grant, null);
  } finally {session.close(); globalThis.fetch = originalFetch; globalThis.WebSocket = originalSocket;}
});

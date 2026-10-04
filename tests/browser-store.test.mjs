import assert from "node:assert/strict";
import { test } from "node:test";
import { clearBrowserWorkspace, loadRelayCredential, listRelayCredentials, selectRelayCredential, loadServerLabels, saveServerLabel } from "../.test-dist/lib/browser-store.js";
function storage(values, delays = []) {
  const data = new Map(Object.entries(values));
  const database = { close() {}, transaction() {
    const tx = { objectStore: () => store }; let pending = 0;
    const request = fn => {
      const result = {}; pending++;
      setImmediate(() => { result.result = fn(); result.onsuccess?.(); pending--; if (!pending) setImmediate(() => { if (!pending) tx.oncomplete?.(); }); });
      return result;
    };
    const store = { get: key => request(() => data.get(key)), getAll: () => request(() => [...data.values()]),
      put: (value, key) => request(() => data.set(key, value)), delete: key => request(() => data.delete(key)) };
    return tx;
  } };
  globalThis.indexedDB = { open() { const request = {}; setTimeout(() => { request.result = database; request.onsuccess(); }, delays.shift() ?? 0); return request; }, deleteDatabase() {} };
  return data;
}
const c = id => ({ protocolVersion: 3, serverId: id, deviceId: "browser", accessToken: "synthetic-private-grant", scopes: ["server.status"], expiresAt: new Date(Date.now() + 60_000).toISOString() });
test("removing background A atomically preserves selected B and B's credential/cache", async () => {
  const data = storage({ selected: "B", "credential:A": c("A"), "cache:A": { serverId: "A" }, "credential:B": c("B"), "cache:B": { serverId: "B" } });
  try {
    await clearBrowserWorkspace("A");
    assert.equal(data.get("selected"), "B"); assert.equal((await loadRelayCredential()).serverId, "B");
    assert.equal(data.has("credential:A"), false); assert.equal(data.has("cache:A"), false); assert.equal(data.has("cache:B"), true);
    assert.deepEqual((await listRelayCredentials()).map(c => c.serverId), ["B"]);
    await clearBrowserWorkspace("B"); assert.equal(data.has("selected"), false);
  } finally { delete globalThis.indexedDB; }
});
test("a slow earlier selection cannot overwrite a newer selection in browser storage", async () => {
  const data = storage({ selected: "A", "credential:A": c("A"), "credential:B": c("B") }, [20, 0]);
  try {
    await Promise.all([selectRelayCredential("A"), selectRelayCredential("B")]);
    assert.equal(data.get("selected"), "B");
  } finally { delete globalThis.indexedDB; }
});

test("server labels are presentation metadata, persist independently and are removed only with their server", async () => {
  const data = storage({ selected: "B", "credential:A": c("A"), "credential:B": c("B") });
  try {
    await saveServerLabel("A", "PlexonCraft"); await saveServerLabel("B", "TonimSMP");
    await saveServerLabel("A", "unsafe\nlabel");
    assert.deepEqual(await loadServerLabels(), { A: "PlexonCraft", B: "TonimSMP" });
    assert.deepEqual((await listRelayCredentials()).map(c => c.serverId), ["A", "B"]);
    assert.equal(data.get("selected"), "B");
    await clearBrowserWorkspace("A");
    assert.deepEqual(await loadServerLabels(), { B: "TonimSMP" });
    assert.equal(data.get("credential:B").accessToken, "synthetic-private-grant");
  } finally { delete globalThis.indexedDB; }
});

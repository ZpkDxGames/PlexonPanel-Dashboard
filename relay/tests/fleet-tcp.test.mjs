import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createFleetFixture } from "../../scripts/support/fleet-fixture.mjs";

test("actual standalone TCP fleet isolates two signed rooms, completions and credential revocation", async () => {
  const f = await createFleetFixture();
  try {
    const a = await f.browser(0), b = await f.browser(1);
    await f.telemetry();
    const eventA = await a.next(m => m.eventType === "telemetry.server");
    const eventB = await b.next(m => m.eventType === "telemetry.server");
    assert.equal(eventA.serverId, f.rooms[0].serverId); assert.equal(eventA.body.onlinePlayers, 3);
    assert.equal(eventB.serverId, f.rooms[1].serverId); assert.equal(eventB.body.onlinePlayers, 7);
    const requestId = randomUUID();
    a.socket.send(JSON.stringify({ type: "dashboard.action", requestId, action: "server.start", parameters: {} }));
    const result = await a.next(m => m.eventType === "action.result" && m.body.requestId === requestId);
    assert.equal(result.serverId, f.rooms[0].serverId);
    assert.deepEqual(f.requests.filter(r => r.requestId === requestId).map(r => [r.serverId, r.kind]), [[f.rooms[0].serverId, "HOST"]]);
    let revoked = new Promise(resolve => a.socket.once("close", code => resolve(code)));
    await f.sync(f.rooms[0], []);
    assert.equal(await revoked, 4003);
    const sessionB = await fetch(`${f.base}/v1/dashboard/session`, { headers: { Origin: f.origin, Authorization: `Bearer ${f.credentials[1].accessToken}` } });
    assert.equal(sessionB.status, 200);
    const sessionA = await fetch(`${f.base}/v1/dashboard/session`, { headers: { Origin: f.origin, Authorization: `Bearer ${f.credentials[0].accessToken}` } });
    assert.equal(sessionA.status, 401);
  } finally { await f.close(); }
});

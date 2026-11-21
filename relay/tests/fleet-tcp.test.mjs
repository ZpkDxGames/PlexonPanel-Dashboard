import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";
import { publicKeyFingerprint } from "../dist/protocol.js";
import { createFleetFixture, inbox } from "./support/fleet-fixture.mjs";

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
    const revoked = once(a.socket, "close");
    await f.sync(f.rooms[0], []);
    assert.equal((await revoked)[0].code, 4003);
    const sessionB = await fetch(`${f.base}/v1/dashboard/session`, { headers: { Origin: f.origin, Authorization: `Bearer ${f.credentials[1].accessToken}` } });
    assert.equal(sessionB.status, 200);
    const sessionA = await fetch(`${f.base}/v1/dashboard/session`, { headers: { Origin: f.origin, Authorization: `Bearer ${f.credentials[0].accessToken}` } });
    assert.equal(sessionA.status, 401);
  } finally { await f.close(); }
});

test("legacy HTTP pairing requires signed Paper approval and consumes the code once", async () => {
  const fixture = await createFleetFixture();
  try {
    const room = fixture.rooms[0];
    const receive = inbox(room.paper.socket, true);
    const requestId = randomUUID();
    const code = "382614";
    const fingerprint = await publicKeyFingerprint(room.paperKeys.publicKey);
    await room.paper.send("agent.pairing_begin", {
      requestId, code, fingerprint, scopes: ["server.status"], role: "Owner",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await receive((message) => message.envelope.type === "pairing.registered");
    const postPair = () => fetch(`${fixture.base}/v1/pairings/claim`, {
      method: "POST", headers: { Origin: fixture.origin, "Content-Type": "application/json" },
      body: JSON.stringify({ code, name: "Legacy fixture browser" }),
    });
    const response = postPair();
    const { body: consume } = await receive((message) => message.envelope.type === "pairing.consume");
    assert.equal(consume.requestId, requestId);
    const issuedAt = Math.floor(Date.now() / 1000);
    await room.paper.send("pairing.accepted", {
      requestId, generation: 1, revision: room.revision++,
      device: {
        deviceId: consume.deviceId, name: consume.name, role: "Owner", scopes: ["server.status"],
        issuedAt, expiresAt: issuedAt + 3600, lastSeen: issuedAt,
      },
    });
    const paired = await response;
    assert.equal(paired.status, 200);
    const grant = await paired.json();
    assert.equal(grant.serverId, room.serverId);
    assert.equal(grant.fingerprint, fingerprint);
    assert.deepEqual(grant.scopes, ["server.status"]);
    const session = await fetch(`${fixture.base}/v1/dashboard/session`, {
      headers: { Origin: fixture.origin, Authorization: `Bearer ${grant.accessToken}` },
    });
    assert.equal(session.status, 200);
    assert.equal((await postPair()).status, 403);
  } finally {
    await fixture.close();
  }
});

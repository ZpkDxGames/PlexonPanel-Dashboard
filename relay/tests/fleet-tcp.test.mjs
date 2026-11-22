import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";
import { publicKeyFingerprint } from "../dist/protocol.js";
import { FLEET_CONTRACT_ID } from "../dist/fleet-contract.js";
import { assertFleetAssociation, assertNodeTelemetry, fleetFromHello } from "../dist/fleet-association.js";
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

test("available 6.0 agents and mixed 5.0/6.0 peers use the same signed Java routing", async () => {
  const fixture = await createFleetFixture({
    componentVersion: (key, kind) => key === "bravo" && kind === "PAPER" ? "5.0.0" : "6.0.0",
  });
  try {
    for (const [index, room] of fixture.rooms.entries()) {
      const browser = await fixture.browser(index);
      await fixture.telemetry();
      const status = await browser.next((message) => message.eventType === "service.status");
      assert.equal(status.serverId, room.serverId);
      assert.equal(status.body.nodeId, room.nodeId);
      const requestId = randomUUID();
      browser.socket.send(JSON.stringify({ type: "dashboard.action", requestId, action: "server.start", parameters: {} }));
      const result = await browser.next((message) => message.eventType === "action.result" && message.body.requestId === requestId);
      assert.equal(result.serverId, room.serverId);
      assert.deepEqual(fixture.requests.filter((request) => request.requestId === requestId)
        .map((request) => [request.serverId, request.kind]), [[room.serverId, "HOST"]]);
    }
  } finally {
    await fixture.close();
  }
});

test("6.0 still requires the fleet identity and rejects future or substituted Java authority", () => {
  const serverId = randomUUID();
  const nodeId = randomUUID();
  const hello = { pluginVersion: "6.0.0", fleetContract: FLEET_CONTRACT_ID, nodeId, instanceKey: "alpha", serverName: "Alpha" };
  const fleet = fleetFromHello(serverId, hello);
  assert.equal(fleet.nodeId, nodeId);
  assert.throws(() => fleetFromHello(serverId, { pluginVersion: "6.0.0" }), /fleet contract/);
  assert.throws(() => fleetFromHello(serverId, { ...hello, pluginVersion: "6.1.0" }), /component version/);
  assert.equal(fleetFromHello(serverId, { pluginVersion: "4.0.0" }), undefined);
  assert.throws(() => assertFleetAssociation({ pluginVersion: "4.0.0" }, { pluginVersion: "6.0.0", fleet }, undefined), /downgrade/);
  assert.throws(() => assertNodeTelemetry({ pluginVersion: "6.0.0", fleet }, { nodeId: randomUUID() }, "HOST"), /identity mismatch/);
});

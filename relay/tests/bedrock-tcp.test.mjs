import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";
import { signDashboardAccess, verifyDashboardAccess } from "../dist/security.js";
import { createMixedFixture, hostKeys } from "./support/bedrock-fixture.mjs";

async function waitForClose(socket) {
  const timer = setTimeout(() => socket.close(), 3000);
  try { return (await once(socket, "close"))[0].code; }
  finally { clearTimeout(timer); }
}

function session(fixture, token) {
  return fetch(`${fixture.base}/v1/dashboard/session`, {
    headers: { Origin: fixture.origin, Authorization: `Bearer ${token}` },
  });
}

test("host-only room pairs out of band beside three signed Paper and Host rooms", async () => {
  const f = await createMixedFixture({ autoHost: false });
  try {
    assert.equal((await f.claim()).status, 403);
    const host = await f.attach();
    const response = await f.claim();
    assert.equal(response.status, 200);
    const credential = await response.json();
    assert.equal(credential.serverId, f.registration.serverId);
    assert.deepEqual(credential.scopes, ["overview.view", "telemetry.view", "server.status", "console.view.full"]);
    assert.equal((await f.claim()).status, 403, "enrollment is single-use");
    assert.equal((await session(f, credential.accessToken)).status, 200);
    const secret = f.relay.config.accessTokenSecret;
    const access = await verifyDashboardAccess(credential.accessToken, secret);
    for (const mismatch of [{ serverId: f.rooms[0].serverId }, { deviceId: randomUUID() }, { generation: 2 }, { scopes: [...access.scopes, "server.restart"] }]) {
      assert.equal((await session(f, await signDashboardAccess({ ...access, ...mismatch }, secret))).status, 401);
    }
    const bedrock = await f.browser(credential);
    const ready = await bedrock.next(message => message.type === "dashboard.ready");
    assert.deepEqual(ready.agents, { paper: false, host: true, hostInstalled: true });
    assert.equal(ready.server.roomMode, "HOST_ONLY");
    assert.equal(ready.server.nodeId, f.rooms[0].nodeId);
    assert.equal(ready.server.hostSession, host.session);
    assert.equal(ready.server.instanceKey, "tonimbedrock");
    const java = await Promise.all(f.rooms.map((_, index) => f.javaBrowser(index)));
    await f.samples(host);
    const status = await bedrock.next(m => m.eventType === "bedrock.status");
    const logs = await bedrock.next(m => m.eventType === "bedrock.logs");
    assert.equal(status.serverId, credential.serverId);
    assert.equal(status.agentSession, host.session);
    assert.equal(status.body.containerCpuPercent, 137.5);
    assert.equal(status.body.containerMemoryBytes, 524288000);
    assert.equal(status.body.version, "1.26.66.1");
    assert.equal(status.body.gameplayReady, null);
    assert.equal(status.body.playersOnline, null);
    assert.equal(logs.body.lines[0].content, "Bedrock fixture ready 🧱");
    assert.match(logs.body.lines[0].id, /^[a-z0-9-]+$/);
    assert.deepEqual(
      await Promise.all(java.map(async (browser, index) => {
        const event = await browser.next(m => m.type === "server.event");
        assert.equal(event.serverId, f.rooms[index].serverId);
        assert.equal(event.eventType.startsWith("bedrock."), false);
        const telemetry = event.eventType === "telemetry.server" ? event : await browser.next(m => m.eventType === "telemetry.server");
        return telemetry.body.onlinePlayers;
      })), [3, 7, 5],
    );
    const requestId = randomUUID();
    bedrock.socket.send(JSON.stringify({ type: "dashboard.action", action: "server.restart", requestId, parameters: {} }));
    assert.equal((await bedrock.next(m => m.type === "relay.error")).code, "BEDROCK_READ_ONLY");
    assert.equal(f.requests.some(request => request.requestId === requestId), false);
    host.socket.close();
    const offline = await bedrock.next(m => m.type === "dashboard.ready" && !m.agents.host);
    assert.equal(offline.server.roomMode, "HOST_ONLY");
    assert.equal(offline.server.hostSession, undefined);
    const replacement = await f.attach();
    assert.equal((await bedrock.next(m => m.type === "dashboard.ready" && m.agents.host)).server.hostSession, replacement.session);
  } finally { await f.close(); }
});

test("Bedrock admission denies other signers, identity substitutions and signed replays", async () => {
  const f = await createMixedFixture({ autoHost: false });
  try {
    for (const attempt of [{ key: hostKeys() }, { overrides: { nodeId: randomUUID() } },
      { overrides: { instanceKey: "alpha" } }, { overrides: { capabilities: ["server.restart"] } }]) {
      const rejected = await f.attach({ ...attempt, authenticate: false });
      assert.equal(await waitForClose(rejected.socket), 4008);
    }
    const host = await f.attach();
    const wire = await host.send("bedrock.status", {
      capturedAt: new Date().toISOString(), source: "DOCKER_ENGINE", containerState: "absent", cpuUnit: "PERCENT_OF_ONE_CORE",
    });
    host.socket.send(wire);
    assert.equal(await waitForClose(host.socket), 4008);
    const replacement = await f.attach();
    replacement.socket.send(wire);
    assert.equal(await waitForClose(replacement.socket), 4008);
    const stale = await f.attach();
    await stale.send("bedrock.status", {
      capturedAt: new Date(Date.now() - 60_000).toISOString(), source: "DOCKER_ENGINE", containerState: "running", cpuUnit: "PERCENT_OF_ONE_CORE",
    });
    assert.equal(await waitForClose(stale.socket), 4008);
  } finally { await f.close(); }
});

// Hermetic TCP relay fixture. Paper/Host payloads are simulated; no game or systemd commands run.
import assert from "node:assert/strict";
import { once } from "node:events";
import { generateKeyPairSync, randomBytes, randomUUID, sign } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import { createStandaloneRelay } from "../../relay/dist/standalone/server.js";
import { loadStandaloneConfig } from "../../relay/dist/standalone/config.js";
import { decodeEnvelope, importAgentPublicKey, publicKeyFingerprint, signEnvelope, verifyEnvelope } from "../../relay/dist/protocol.js";
import { signDashboardAccess } from "../../relay/dist/security.js";
import { SCOPES } from "../../relay/dist/scopes.js";
import { FLEET_CONTRACT_ID } from "../../relay/dist/fleet-contract.js";

function keys() {
  const pair = generateKeyPairSync("ed25519");
  return { raw: pair.privateKey, privateKey: pair.privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
    publicKey: pair.publicKey.export({ format: "der", type: "spki" }).toString("base64") };
}
export function inbox(socket, signed = false) {
  const messages = [], waiters = [];
  socket.on("message", data => {
    const text = data.toString(); const value = signed ? decodeEnvelope(text) : JSON.parse(text);
    const i = waiters.findIndex(w => w.match(value));
    if (i < 0) messages.push(value); else { const [w] = waiters.splice(i, 1); clearTimeout(w.timer); w.resolve(value); }
  });
  return match => {
    const i = messages.findIndex(match); if (i >= 0) return Promise.resolve(messages.splice(i, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = { match, resolve, timer: setTimeout(() => { const i = waiters.indexOf(waiter); if (i >= 0) waiters.splice(i, 1); reject(new Error("FIXTURE_MESSAGE_TIMEOUT")); }, 5000) };
      waiters.push(waiter);
    });
  };
}
export async function createFleetFixture({ port = 0, origin = "http://127.0.0.1:3000", separateNodes = false, names, instanceKeys, beforeActionResult } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "plexonpanel-fleet-tcp-"));
  const relayKeys = keys(); const nodeId = randomUUID();
  const config = await loadStandaloneConfig({ PLEXON_RELAY_HOST: "127.0.0.1", PLEXON_RELAY_PORT: "8787",
    PLEXON_RELAY_DATABASE_PATH: join(directory, "relay.db"), PLEXON_RELAY_DASHBOARD_ORIGINS: origin,
    PAIRING_CODE_PEPPER: randomBytes(48).toString("base64"), ACCESS_TOKEN_SECRET: randomBytes(48).toString("base64"),
    GATEWAY_ED25519_PRIVATE_KEY: relayKeys.privateKey, GATEWAY_ED25519_PUBLIC_KEY: relayKeys.publicKey });
  const relay = createStandaloneRelay({ ...config, port }); const sockets = new Set(), requests = [];
  const rooms = ["alpha", "bravo"].map((key, i) => ({ serverId: randomUUID(), nodeId: separateNodes && i ? randomUUID() : nodeId,
    key: instanceKeys?.[i] ?? key, name: names?.[i] ?? `Simulated ${i ? "Bravo" : "Alpha"}`, players: i ? 7 : 3, paperKeys: keys(), hostKeys: keys(),
    deviceId: randomUUID(), revision: 1, serviceState: "active" }));
  let interval, closed = false;
  const gatewayKey = await importAgentPublicKey(relayKeys.publicKey);
  async function attach(room, kind) {
    const key = kind === "HOST" ? room.hostKeys : room.paperKeys;
    const socket = new WebSocket(`${base.replace("http:", "ws:")}/v1/agent?serverId=${room.serverId}&agentKind=${kind}`, { headers: { "X-PlexonPanel-Protocol": "3" } });
    sockets.add(socket); socket.on("error", () => {}); socket.on("close", () => sockets.delete(socket));
    const next = inbox(socket, true); await once(socket, "open");
    let sequence = 0; let messages = Promise.resolve(); const session = randomUUID();
    const agent = { socket, session, send(type, body) {
      messages = messages.then(async () => { if (socket.readyState !== WebSocket.OPEN) return;
        socket.send(await signEnvelope(type, room.serverId, { ...body, _session: session, _sequence: ++sequence }, key.privateKey)); });
      return messages;
    } };
    await agent.send("agent.hello", { agentKind: kind, protocolVersion: 3, publicKey: key.publicKey,
      publicKeyFingerprint: await publicKeyFingerprint(key.publicKey), pluginVersion: "5.0.0", paperVersion: "Paper fixture",
      minecraftVersion: "26.2", javaVersion: "25", operatingSystem: "Linux fixture",
      capabilities: Object.fromEntries(SCOPES.map(scope => [scope, true])), hostPublicKey: kind === "PAPER" ? room.hostKeys.publicKey : "",
      fleetContract: FLEET_CONTRACT_ID, nodeId: room.nodeId, instanceKey: room.key, serverName: room.name });
    const challenge = await next(m => m.envelope.type === "gateway.challenge");
    assert.equal(await verifyEnvelope(challenge.envelope, gatewayKey), true);
    await agent.send("agent.challenge_response", { nonce: challenge.body.nonce,
      proof: sign(null, Buffer.from(`challenge:${challenge.body.nonce}`), key.raw).toString("base64url") });
    await next(m => m.envelope.type === "gateway.authenticated");
    socket.on("message", data => { void (async () => {
      const message = decodeEnvelope(data.toString());
      assert.equal(await verifyEnvelope(message.envelope, gatewayKey), true);
      if (message.envelope.type === "action.request") {
        const body = message.body; requests.push({ serverId: room.serverId, kind, action: body.action, requestId: body.requestId, parameters: body.parameters });
        let result = {};
        if (body.action === "players.snapshot.request") result = { snapshotId: randomUUID(), capturedAt: new Date().toISOString(), players: [] };
        if (body.action.startsWith("console.history")) result = { lines: [], hasMore: false };
        if (body.action === "server.status") result = { state: room.serviceState };
        const response = await beforeActionResult?.({ room, kind, body, attach, sync, telemetry });
        await agent.send("action.result", { requestId: body.requestId, deviceId: body.deviceId, action: body.action,
          status: "SUCCESS", code: "OK", message: "Simulated fixture response", data: result, ...response });
      }
    })().catch(() => socket.close(4008, "FIXTURE_GATEWAY_FAILURE")); });
    room[kind.toLowerCase()] = agent; return agent;
  }
  let base;
  async function sync(room, devices = [room.device]) {
    await room.paper.send("access.sync", { protocolVersion: 3, serverId: room.serverId, generation: 1, revision: room.revision++, devices });
    // Round-trip message verifies the preceding access snapshot was processed on the same signed connection.
    await room.paper.send("agent.heartbeat", {});
  }
  async function telemetry() {
    const capturedAt = new Date().toISOString();
    for (const room of rooms) {
      await room.paper?.send("telemetry.server", { capturedAt, serverName: room.name, onlinePlayers: room.players, maximumPlayers: 20,
        tps: [20, 20, 20], averageTickMillis: room === rooms[0] ? 12 : 18 });
      await room.host.send("telemetry.system", { capturedAt, nodeId: room.nodeId, metricScope: "NODE", processRole: "HOST",
        hostCpuPercent: 35, physicalMemoryUsedBytes: 8e9, physicalMemoryTotalBytes: 24e9, diskUsedBytes: 39e9, diskTotalBytes: 145e9 });
      await room.host.send("service.status", { nodeId: room.nodeId, state: room.serviceState, mainPid: 100,
        resources: { capturedAt, scope: "MINECRAFT_SERVICE", source: "SYSTEMD_CGROUP", cpuUnit: "PERCENT_OF_ONE_CORE",
          cpuAvailable: true, cpuPercent: room === rooms[0] ? 150 : 80, memoryAvailable: true, memoryBytes: room === rooms[0] ? 4e9 : 2e9 } });
    }
  }
  async function close() {
    if (closed) return; closed = true; clearInterval(interval);
    for (const socket of sockets) socket.terminate();
    await relay.close(); await rm(directory, { recursive: true, force: true });
  }
  try {
    await relay.start(); base = `http://127.0.0.1:${relay.server.address().port}`;
    for (const room of rooms) {
      const now = Math.floor(Date.now() / 1000);
      room.device = { deviceId: room.deviceId, name: "Local fixture browser", role: "Owner", scopes: [...SCOPES], issuedAt: now, expiresAt: now + 3600, lastSeen: now };
      await attach(room, "PAPER"); await attach(room, "HOST"); await sync(room);
      const access = { version: 3, protocolVersion: 3, audience: "plexonpanel-relay", serverId: room.serverId, deviceId: room.deviceId,
        role: room.device.role, scopes: room.device.scopes, generation: 1, issuedAt: now, expiresAt: now + 3600 };
      room.credential = { protocolVersion: 3, serverId: room.serverId, deviceId: room.deviceId, name: room.name, role: room.device.role,
        scopes: room.device.scopes, accessToken: await signDashboardAccess(access, config.accessTokenSecret),
        websocketUrl: `${base.replace("http:", "ws:")}/v1/dashboard`, expiresAt: new Date((now + 3600) * 1000).toISOString() };
    }
    await telemetry(); interval = setInterval(() => { void telemetry().catch(() => {}); }, 1000);
    return { relay, rooms, base, requests, telemetry, close, sync, attach, origin, credentials: rooms.map(room => room.credential),
      async browser(index) {
        const credential = rooms[index].credential;
        const socket = new WebSocket(credential.websocketUrl, ["plexonpanel-v3", `auth.${credential.accessToken}`], { origin });
        sockets.add(socket); socket.on("error", () => {}); socket.on("close", () => sockets.delete(socket));
        const next = inbox(socket); await once(socket, "open"); await next(m => m.type === "dashboard.ready"); return { socket, next };
      } };
  } catch (failure) { await close(); throw failure; }
}

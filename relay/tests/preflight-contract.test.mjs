import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ServerRoom } from "../dist/index.js";
import { decodeEnvelope, publicKeyFingerprint, signEnvelope } from "../dist/protocol.js";
import { loadStandaloneConfig } from "../dist/standalone/config.js";
import { CoordinationStore } from "../dist/standalone/persistence.js";
import { RoomManager } from "../dist/standalone/room-manager.js";

function keys() {
  const pair = generateKeyPairSync("ed25519");
  return {
    privateKey: pair.privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
    publicKey: pair.publicKey.export({ format: "der", type: "spki" }).toString("base64"),
  };
}

function ownerDevice() {
  const now = Math.floor(Date.now() / 1000);
  return {
    deviceId: randomUUID(),
    name: "Owner browser",
    role: "Owner",
    scopes: ["backup.view"],
    issuedAt: now,
    expiresAt: now + 3600,
    lastSeen: now,
  };
}

function access(serverId, device, generation = 7) {
  return {
    version: 3,
    protocolVersion: 3,
    audience: "plexonpanel-relay",
    serverId,
    deviceId: device.deviceId,
    role: device.role,
    scopes: device.scopes,
    generation,
    issuedAt: device.issuedAt,
    expiresAt: device.expiresAt,
  };
}

class MemoryStorage {
  values = new Map();
  async get(key) { return structuredClone(this.values.get(key)); }
  async put(key, value) { this.values.set(key, structuredClone(value)); }
  async getAlarm() { return null; }
  async setAlarm() {}
  async deleteAlarm() {}
}

class WorkerSocket {
  sent = [];
  closed = null;
  attachment;
  serializeAttachment(value) { this.attachment = structuredClone(value); }
  deserializeAttachment() { return structuredClone(this.attachment); }
  send(text) { this.sent.push(JSON.parse(text)); }
  close(code, reason) { this.closed = { code, reason }; }
}

function workerState() {
  return {
    storage: new MemoryStorage(),
    sockets: [],
    getWebSockets(tag) {
      return this.sockets.filter((socket) => !socket.closed && (!tag || socket.attachment.role === tag));
    },
    acceptWebSocket(socket) { this.sockets.push(socket); },
  };
}

function agentIdentity(publicKey, hostPublicKey = "") {
  return {
    publicKey,
    fingerprint: "test-fingerprint",
    pluginVersion: "3.5.0",
    paperVersion: "Paper 1.21.10",
    minecraftVersion: "1.21.10",
    javaVersion: "25",
    operatingSystem: "Linux",
    capabilities: { "backup.view": true },
    hostPublicKey,
  };
}

function workerAgent(state, serverId, kind, key) {
  const socket = new WorkerSocket();
  socket.serializeAttachment({
    role: "agent",
    serverId,
    kind,
    authenticated: true,
    authenticatedAt: Date.now(),
    publicKey: key.publicKey,
    fingerprint: "test-fingerprint",
    sessionNonce: randomUUID(),
    sequence: 0,
    recent: [],
  });
  state.sockets.push(socket);
  return socket;
}

function workerDashboard(state, serverId, device) {
  const socket = new WorkerSocket();
  socket.serializeAttachment({
    role: "dashboard",
    serverId,
    deviceId: device.deviceId,
    generation: 7,
    access: access(serverId, device),
    rate: [],
    transferRate: [],
  });
  state.sockets.push(socket);
  return socket;
}

async function workerFixture() {
  const state = workerState();
  const relay = keys();
  const paperKey = keys();
  const hostKey = keys();
  const serverId = randomUUID();
  const device = ownerDevice();
  const observer = { ...ownerDevice(), deviceId: randomUUID() };
  await state.storage.put("room-metadata", {
    protocolVersion: 3,
    paired: true,
    generation: 7,
    revision: 2,
    devices: [device, observer],
    identity: agentIdentity(paperKey.publicKey, hostKey.publicKey),
    hostIdentity: agentIdentity(hostKey.publicKey),
  });
  const env = {
    ACCESS_TOKEN_SECRET: "access-".repeat(8),
    PAIRING_CODE_PEPPER: "pepper-".repeat(8),
    DASHBOARD_ORIGINS: "https://dashboard.example",
    GATEWAY_ED25519_PRIVATE_KEY: relay.privateKey,
    GATEWAY_ED25519_PUBLIC_KEY: relay.publicKey,
  };
  const room = new ServerRoom(state, env);
  const paper = workerAgent(state, serverId, "PAPER", paperKey);
  const host = workerAgent(state, serverId, "HOST", hostKey);
  const browser = workerDashboard(state, serverId, device);
  const other = workerDashboard(state, serverId, observer);
  return { room, serverId, device, browser, other, paper, host, hostKey };
}

test("Worker routes Owner backup.preflight to Host and returns only the private success result", async () => {
  const f = await workerFixture();
  const requestId = randomUUID();
  await f.room.webSocketMessage(f.browser, JSON.stringify({
    type: "dashboard.action",
    requestId,
    action: "backup.preflight",
    agentKind: "HOST",
    parameters: {},
  }));

  const queued = f.browser.sent.find((message) => message.type === "dashboard.action_queued");
  assert.equal(queued?.requestId, requestId);
  assert.equal(queued?.agentKind, "HOST");
  assert.equal(f.browser.sent.some((message) => message.code === "SCOPE_DENIED"), false);

  const requestEnvelope = f.host.sent.find((message) => message.type === "action.request");
  assert.ok(requestEnvelope, "Host must receive action.request");
  const request = decodeEnvelope(JSON.stringify(requestEnvelope)).body;
  assert.equal(request.requestId, requestId);
  assert.equal(request.action, "backup.preflight");
  assert.equal(request.deviceId, f.device.deviceId);

  const hostAttachment = f.host.deserializeAttachment();
  const result = await signEnvelope("action.result", f.serverId, {
    requestId,
    action: "backup.preflight",
    deviceId: f.device.deviceId,
    status: "SUCCESS",
    code: "OK",
    message: "Preflight ready",
    data: { backupRootWritable: true },
    _session: hostAttachment.sessionNonce,
    _sequence: 1,
  }, f.hostKey.privateKey);
  await f.room.webSocketMessage(f.host, result);

  const success = f.browser.sent.find((message) => message.eventType === "action.result");
  assert.equal(success?.body?.status, "SUCCESS");
  assert.equal(success?.body?.requestId, requestId);
  assert.equal(success?.body?.data?.backupRootWritable, true);
  assert.equal(f.other.sent.some((message) => message.eventType === "action.result"), false);
});

class NodeSocketStub {
  sent = [];
  closed = null;
  send(text) {
    this.sent.push(JSON.parse(text));
    return true;
  }
  close(code, reason) { this.closed = { code, reason }; }
}

async function standaloneFixture() {
  const directory = await mkdtemp(join(tmpdir(), "plexonpanel-preflight-contract-"));
  const relayKey = keys();
  const paperKey = keys();
  const hostKey = keys();
  const config = await loadStandaloneConfig({
    PLEXON_RELAY_HOST: "127.0.0.1",
    PLEXON_RELAY_PORT: "8787",
    PLEXON_RELAY_DATABASE_PATH: join(directory, "relay.db"),
    PLEXON_RELAY_DASHBOARD_ORIGINS: "https://dashboard.example",
    PAIRING_CODE_PEPPER: "p".repeat(48),
    ACCESS_TOKEN_SECRET: "a".repeat(48),
    GATEWAY_ED25519_PRIVATE_KEY: relayKey.privateKey,
    GATEWAY_ED25519_PUBLIC_KEY: relayKey.publicKey,
  });
  const store = new CoordinationStore(config.databasePath);
  const serverId = randomUUID();
  const device = ownerDevice();
  const observer = { ...ownerDevice(), deviceId: randomUUID() };
  store.saveRoom(serverId, {
    protocolVersion: 3,
    paired: true,
    generation: 7,
    revision: 2,
    devices: [device, observer],
    identity: agentIdentity(paperKey.publicKey, hostKey.publicKey),
    hostIdentity: agentIdentity(hostKey.publicKey),
  });
  const counters = {
    startedAt: Date.now(), connectionsAccepted: 0, connectionsRejected: 0,
    duplicateAgentsReplaced: 0, authenticationFailures: 0, protocolFailures: 0,
    pairingClaims: 0, pairingClaimFailures: 0, rateLimitedPairingClaims: 0,
    messagesAccepted: 0, messagesRejected: 0, recentDisconnects: [],
  };
  const manager = new RoomManager(store, config, counters);
  const room = manager.room(serverId);
  const hostSocket = new NodeSocketStub();
  const paperSocket = new NodeSocketStub();
  const browserSocket = new NodeSocketStub();
  const otherSocket = new NodeSocketStub();
  const hostSession = {
    socket: hostSocket,
    kind: "HOST",
    serverId,
    authenticated: true,
    authenticatedAt: Date.now(),
    publicKey: hostKey.publicKey,
    fingerprint: await publicKeyFingerprint(hostKey.publicKey),
    challenge: "",
    challengeExpiry: 0,
    sessionNonce: randomUUID(),
    sequence: 0,
    recent: [],
    chain: Promise.resolve(),
    authTimer: setTimeout(() => {}, 60_000),
  };
  room.host = hostSession;
  const paperSession = {
    ...hostSession,
    socket: paperSocket,
    kind: "PAPER",
    publicKey: paperKey.publicKey,
    sessionNonce: randomUUID(),
    sequence: 0,
    recent: [],
    chain: Promise.resolve(),
  };
  room.paper = paperSession;
  const browser = { socket: browserSocket, access: access(serverId, device), rate: [], transferRate: [], snapshotRate: 0, chain: Promise.resolve() };
  const other = { socket: otherSocket, access: access(serverId, observer), rate: [], transferRate: [], snapshotRate: 0, chain: Promise.resolve() };
  room.dashboards.set(device.deviceId, browser);
  room.dashboards.set(observer.deviceId, other);
  return { directory, store, room, serverId, device, browser, other, hostSession, hostSocket, hostKey, paperSession, paperSocket, paperKey };
}

test("standalone relay satisfies the same backup.preflight Host contract", async () => {
  const f = await standaloneFixture();
  try {
    const requestId = randomUUID();
    await f.room.dashboardMessage(f.browser, JSON.stringify({
      type: "dashboard.action",
      requestId,
      action: "backup.preflight",
      agentKind: "HOST",
      parameters: {},
    }));
    assert.equal(f.browser.socket.sent.some((message) => message.code === "SCOPE_DENIED"), false);
    const queued = f.browser.socket.sent.find((message) => message.type === "dashboard.action_queued");
    assert.equal(queued?.requestId, requestId);
    const requestEnvelope = f.hostSocket.sent.find((message) => message.type === "action.request");
    assert.ok(requestEnvelope, "standalone Host must receive action.request");
    const request = decodeEnvelope(JSON.stringify(requestEnvelope)).body;
    assert.equal(request.requestId, requestId);
    assert.equal(request.action, "backup.preflight");
    assert.equal(request.deviceId, f.device.deviceId);

    const result = await signEnvelope("action.result", f.serverId, {
      requestId,
      action: "backup.preflight",
      deviceId: f.device.deviceId,
      status: "SUCCESS",
      code: "OK",
      message: "Preflight ready",
      data: { backupRootWritable: true },
      _session: f.hostSession.sessionNonce,
      _sequence: 1,
    }, f.hostKey.privateKey);
    await f.room.agentMessage(f.hostSession, result);
    const success = f.browser.socket.sent.find((message) => message.eventType === "action.result");
    assert.equal(success?.body?.status, "SUCCESS");
    assert.equal(success?.body?.requestId, requestId);
    assert.equal(success?.body?.data?.backupRootWritable, true);
    assert.equal(f.other.socket.sent.some((message) => message.eventType === "action.result"), false);
  } finally {
    clearTimeout(f.hostSession.authTimer);
    f.store.close();
    await rm(f.directory, { recursive: true, force: true });
  }
});

test("standalone relay mirrors Paper authorization to Host and enforces refresh direction", async () => {
  const f = await standaloneFixture();
  try {
    const snapshot = {
      protocolVersion: 3,
      serverId: f.serverId,
      generation: 7,
      revision: 3,
      devices: [f.device],
      _session: f.paperSession.sessionNonce,
      _sequence: 1,
    };
    const sync = await signEnvelope("access.sync", f.serverId, snapshot, f.paperKey.privateKey);
    await f.room.agentMessage(f.paperSession, sync);
    const mirroredEnvelope = f.hostSocket.sent.find((message) => message.type === "access.authority.sync");
    assert.ok(mirroredEnvelope, "standalone Host must receive Paper access authority");
    const mirrored = decodeEnvelope(JSON.stringify(mirroredEnvelope)).body;
    assert.equal(mirrored.revision, 3);
    assert.equal(mirrored.devices[0].deviceId, f.device.deviceId);

    f.paperSocket.sent.length = 0;
    f.hostSocket.sent.length = 0;
    const request = await signEnvelope(
      "access.authority.request",
      f.serverId,
      { _session: f.hostSession.sessionNonce, _sequence: 1 },
      f.hostKey.privateKey,
    );
    await f.room.agentMessage(f.hostSession, request);
    const cachedEnvelope = f.hostSocket.sent.find((message) => message.type === "access.authority.sync");
    assert.ok(cachedEnvelope, "standalone Host refresh must replay current relay authority");
    const cached = decodeEnvelope(JSON.stringify(cachedEnvelope)).body;
    assert.equal(cached.generation, 7);
    assert.equal(cached.revision, 3);
    assert.equal(cached.devices[0].deviceId, f.device.deviceId);
    const refresh = f.paperSocket.sent.find((message) => message.type === "access.authority.request");
    assert.ok(refresh, "standalone Paper must receive Host refresh request");

    const forgedRequest = await signEnvelope(
      "access.authority.request",
      f.serverId,
      { _session: f.paperSession.sessionNonce, _sequence: 2 },
      f.paperKey.privateKey,
    );
    await assert.rejects(
      f.room.agentMessage(f.paperSession, forgedRequest),
      /Only Host requests access authority refresh/,
    );
  } finally {
    clearTimeout(f.hostSession.authTimer);
    f.store.close();
    await rm(f.directory, { recursive: true, force: true });
  }
});

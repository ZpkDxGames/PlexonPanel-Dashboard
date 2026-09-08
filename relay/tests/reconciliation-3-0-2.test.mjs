import assert from "node:assert/strict";
import { test } from "node:test";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { ServerRoom } from "../dist/index.js";
import {
  decodeEnvelope,
  publicKeyFingerprint,
  signEnvelope,
} from "../dist/protocol.js";
import { SCOPES } from "../dist/scopes.js";

class Storage {
  values = new Map();
  alarm = null;
  async get(key) {
    return structuredClone(this.values.get(key));
  }
  async put(key, value) {
    this.values.set(key, structuredClone(value));
  }
  async delete(key) {
    for (const k of Array.isArray(key) ? key : [key]) this.values.delete(k);
  }
  async list() {
    return structuredClone(this.values);
  }
  async getAlarm() {
    return this.alarm;
  }
  async setAlarm(at) {
    this.alarm = at;
  }
  async deleteAlarm() {
    this.alarm = null;
  }
}

class Socket {
  sent = [];
  closed = null;
  attachment;
  serializeAttachment(value) {
    this.attachment = structuredClone(value);
  }
  deserializeAttachment() {
    return structuredClone(this.attachment);
  }
  send(text) {
    this.sent.push(JSON.parse(text));
  }
  close(code, reason) {
    this.closed = { code, reason };
  }
}

function keys() {
  const pair = generateKeyPairSync("ed25519");
  return {
    raw: pair.privateKey,
    privateKey: pair.privateKey
      .export({ format: "der", type: "pkcs8" })
      .toString("base64"),
    publicKey: pair.publicKey
      .export({ format: "der", type: "spki" })
      .toString("base64"),
  };
}

function state() {
  return {
    storage: new Storage(),
    sockets: [],
    getWebSockets(tag) {
      return this.sockets.filter(
        (socket) =>
          !socket.closed && (!tag || socket.attachment.role === tag),
      );
    },
    acceptWebSocket(socket) {
      this.sockets.push(socket);
    },
  };
}

function environment() {
  const gateway = keys();
  return {
    ACCESS_TOKEN_SECRET: "test-access-secret-".repeat(4),
    PAIRING_CODE_PEPPER: "test-pepper-".repeat(4),
    DASHBOARD_ORIGINS: "https://dashboard.example",
    GATEWAY_ED25519_PRIVATE_KEY: gateway.privateKey,
    GATEWAY_ED25519_PUBLIC_KEY: gateway.publicKey,
  };
}

function device(name = "Existing device", scopes = ["telemetry.view"]) {
  const now = Math.floor(Date.now() / 1000);
  return {
    deviceId: randomUUID(),
    name,
    role: "Owner",
    scopes,
    issuedAt: now,
    expiresAt: now + 3600,
    lastSeen: now,
  };
}

async function fixture(devices = [device()]) {
  const st = state();
  const env = environment();
  const serverId = randomUUID();
  const paper = keys();
  const host = keys();
  const metadata = {
    protocolVersion: 3,
    paired: true,
    generation: 7,
    revision: 5,
    devices,
    identity: {
      publicKey: paper.publicKey,
      fingerprint: await publicKeyFingerprint(paper.publicKey),
      pluginVersion: "3.0.2",
      paperVersion: "Paper 26.2",
      minecraftVersion: "26.2",
      javaVersion: "25",
      operatingSystem: "Linux aarch64",
      capabilities: Object.fromEntries(SCOPES.map((scope) => [scope, true])),
      hostPublicKey: host.publicKey,
    },
  };
  await st.storage.put("room-metadata", metadata);
  return {
    st,
    env,
    serverId,
    host,
    metadata,
    room: new ServerRoom(st, env),
  };
}

async function attachHost(f) {
  const socket = new Socket();
  socket.serializeAttachment({
    role: "agent",
    serverId: f.serverId,
    kind: "HOST",
    authenticated: false,
    recent: [],
  });
  f.st.sockets.push(socket);
  const session = randomUUID();
  let sequence = 0;
  const send = async (type, body) => {
    const text = await signEnvelope(
      type,
      f.serverId,
      { ...body, _session: session, _sequence: ++sequence },
      f.host.privateKey,
    );
    await f.room.webSocketMessage(socket, text);
  };
  await send("agent.hello", {
    agentKind: "HOST",
    protocolVersion: 3,
    publicKey: f.host.publicKey,
    publicKeyFingerprint: await publicKeyFingerprint(f.host.publicKey),
    pluginVersion: "3.0.2",
    paperVersion: "",
    minecraftVersion: "",
    javaVersion: "25",
    operatingSystem: "Linux aarch64",
    capabilities: f.metadata.identity.capabilities,
    hostPublicKey: "",
  });
  const challengeEnvelope = socket.sent.find(
    (event) => event.type === "gateway.challenge",
  );
  assert.ok(challengeEnvelope, "Host should receive a challenge");
  const challenge = decodeEnvelope(JSON.stringify(challengeEnvelope)).body.nonce;
  await send("agent.challenge_response", {
    nonce: challenge,
    proof: sign(
      null,
      Buffer.from(`challenge:${challenge}`),
      f.host.raw,
    ).toString("base64url"),
  });
  assert.equal(socket.attachment.authenticated, true);
  return { socket, send };
}

async function sync(host, f, generation, revision, devices) {
  await host.send("access.sync", {
    protocolVersion: 3,
    serverId: f.serverId,
    generation,
    revision,
    devices,
  });
  return f.st.storage.get("room-metadata");
}

test("Host stale generation is ignored without disconnecting transport", async () => {
  const f = await fixture();
  const host = await attachHost(f);
  const next = await sync(host, f, 6, 99, f.metadata.devices);
  assert.equal(host.socket.closed, null);
  assert.equal(next.generation, 7);
  assert.equal(next.revision, 5);
});

test("Host stale revision is ignored without rolling metadata backward", async () => {
  const f = await fixture();
  const host = await attachHost(f);
  const next = await sync(host, f, 7, 4, f.metadata.devices);
  assert.equal(host.socket.closed, null);
  assert.equal(next.generation, 7);
  assert.equal(next.revision, 5);
});

test("Host may confirm the same known grants at a newer revision", async () => {
  const f = await fixture();
  const host = await attachHost(f);
  const next = await sync(host, f, 7, 6, f.metadata.devices);
  assert.equal(host.socket.closed, null);
  assert.equal(next.revision, 6);
  assert.deepEqual(
    next.devices.map((entry) => entry.deviceId),
    f.metadata.devices.map((entry) => entry.deviceId),
  );
});

test("Host may publish a real local revocation but cannot restore it", async () => {
  const first = device("Keep");
  const second = device("Revoke");
  const f = await fixture([first, second]);
  const host = await attachHost(f);
  let next = await sync(host, f, 7, 6, [first]);
  assert.equal(host.socket.closed, null);
  assert.deepEqual(next.devices.map((entry) => entry.deviceId), [first.deviceId]);

  next = await sync(host, f, 7, 7, [first, second]);
  assert.equal(host.socket.closed, null);
  assert.deepEqual(next.devices.map((entry) => entry.deviceId), [first.deviceId]);
  assert.equal(next.revision, 6);
});

test("Host unknown grant is diagnosed and ignored without transport rejection", async () => {
  const f = await fixture();
  const host = await attachHost(f);
  const invented = device("Invented", SCOPES);
  const next = await sync(host, f, 7, 6, [...f.metadata.devices, invented]);
  assert.equal(host.socket.closed, null);
  assert.equal(next.revision, 5);
  assert.deepEqual(
    next.devices.map((entry) => entry.deviceId),
    f.metadata.devices.map((entry) => entry.deviceId),
  );
});

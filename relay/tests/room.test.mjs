import assert from "node:assert/strict";
import { test } from "node:test";
import { generateKeyPairSync, sign, randomUUID } from "node:crypto";
import {
  ServerRoom,
  PairingDirectory,
  currentAccess,
  filterEvent,
} from "../dist/index.js";
import {
  signEnvelope,
  decodeEnvelope,
  publicKeyFingerprint,
} from "../dist/protocol.js";
import { pairingLookupId } from "../dist/security.js";
import { SCOPES } from "../dist/scopes.js";

export class Storage {
  values = new Map();
  alarm = null;
  writes = [];
  async get(key) {
    return structuredClone(this.values.get(key));
  }
  async put(key, value) {
    this.writes.push(key);
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
  listener;
  serializeAttachment(value) {
    assert.ok(
      Buffer.byteLength(JSON.stringify(value)) < 16000,
      "Cloudflare attachment must fit within 16 KiB",
    );
    this.attachment = structuredClone(value);
  }
  deserializeAttachment() {
    return structuredClone(this.attachment);
  }
  send(text) {
    this.sent.push(JSON.parse(text));
    this.listener?.(text);
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
        (s) => !s.closed && (!tag || s.attachment.role === tag),
      );
    },
    acceptWebSocket(s) {
      this.sockets.push(s);
    },
  };
}
function environment() {
  const key = keys();
  return {
    ACCESS_TOKEN_SECRET: "test-access-secret-".repeat(4),
    PAIRING_CODE_PEPPER: "test-pepper-".repeat(4),
    DASHBOARD_ORIGINS: "https://dashboard.example",
    GATEWAY_ED25519_PRIVATE_KEY: key.privateKey,
    GATEWAY_ED25519_PUBLIC_KEY: key.publicKey,
  };
}
function internal(path, env, body) {
  return new Request(`https://internal.example${path}`, {
    method: "POST",
    headers: { "X-Plexon-Internal": env.ACCESS_TOKEN_SECRET },
    body: JSON.stringify(body),
  });
}
function device(scopes = ["telemetry.view"], role = "Observer") {
  const now = Math.floor(Date.now() / 1000);
  return {
    deviceId: randomUUID(),
    name: "Test browser",
    role,
    scopes,
    issuedAt: now,
    expiresAt: now + 3600,
    lastSeen: now,
  };
}
function dashboard(st, serverId, d, generation = 7) {
  const socket = new Socket();
  const access = {
    version: 3,
    protocolVersion: 3,
    audience: "plexonpanel-relay",
    serverId,
    deviceId: d.deviceId,
    role: d.role,
    scopes: d.scopes,
    generation,
    issuedAt: d.issuedAt,
    expiresAt: d.expiresAt,
  };
  socket.serializeAttachment({
    role: "dashboard",
    serverId,
    deviceId: d.deviceId,
    generation,
    access,
    rate: [],
  });
  st.sockets.push(socket);
  return socket;
}
async function fixture(scopes = ["telemetry.view"], role = "Observer") {
  const st = state(),
    env = environment(),
    serverId = randomUUID(),
    key = keys(),
    host = keys(),
    d = device(scopes, role);
  const metadata = {
    protocolVersion: 3,
    paired: true,
    generation: 7,
    revision: 1,
    devices: [d],
    identity: {
      publicKey: key.publicKey,
      fingerprint: await publicKeyFingerprint(key.publicKey),
      pluginVersion: "2.0.0",
      paperVersion: "Paper 26.2",
      minecraftVersion: "26.2",
      javaVersion: "25",
      operatingSystem: "Linux aarch64",
      capabilities: Object.fromEntries(SCOPES.map((s) => [s, true])),
      hostPublicKey: host.publicKey,
    },
  };
  await st.storage.put("room-metadata", metadata);
  const room = new ServerRoom(st, env),
    browser = dashboard(st, serverId, d);
  return { st, env, serverId, key, host, d, room, browser, metadata };
}
async function attach(
  f,
  kind = "PAPER",
  key = kind === "HOST" ? f.host : f.key,
) {
  const socket = new Socket();
  socket.serializeAttachment({
    role: "agent",
    serverId: f.serverId,
    kind,
    authenticated: false,
    recent: [],
  });
  f.st.sockets.push(socket);
  const session = randomUUID();
  let sequence = 0;
  const encode = async (type, body) =>
    signEnvelope(
      type,
      f.serverId,
      { ...body, _session: session, _sequence: ++sequence },
      key.privateKey,
    );
  const send = async (type, body) => {
    const text = await encode(type, body);
    await f.room.webSocketMessage(socket, text);
    return text;
  };
  await send("agent.hello", {
    agentKind: kind,
    protocolVersion: 3,
    publicKey: key.publicKey,
    publicKeyFingerprint: await publicKeyFingerprint(key.publicKey),
    pluginVersion: "2.0.0",
    paperVersion: "Paper 26.2",
    minecraftVersion: "26.2",
    javaVersion: "25",
    operatingSystem: "Linux aarch64",
    capabilities: f.metadata.identity.capabilities,
    hostPublicKey: kind === "PAPER" ? f.host.publicKey : "",
  });
  if (socket.closed) return { socket, send, encode };
  const challenge = decodeEnvelope(
    JSON.stringify(socket.sent.find((e) => e.type === "gateway.challenge")),
  ).body.nonce;
  await send("agent.challenge_response", {
    nonce: challenge,
    proof: sign(null, Buffer.from(`challenge:${challenge}`), key.raw).toString(
      "base64url",
    ),
  });
  return { socket, send, encode };
}
async function action(
  f,
  action,
  parameters = {},
  socket = f.browser,
  requestId = randomUUID(),
  agentKind,
) {
  await f.room.webSocketMessage(
    socket,
    JSON.stringify({
      type: "dashboard.action",
      requestId,
      action,
      parameters,
      ...(agentKind ? { agentKind } : {}),
    }),
  );
  return requestId;
}

test("Paper and pinned host authenticate independently; wrong server and host keys fail", async () => {
  const f = await fixture();
  const paper = await attach(f);
  assert.equal(paper.socket.attachment.authenticated, true);
  const host = await attach(f, "HOST");
  assert.equal(host.socket.attachment.authenticated, true);
  assert.equal(paper.socket.closed, null);
  assert.equal((await attach(f, "HOST", keys())).socket.closed.code, 4008);
  assert.equal((await attach(f, "PAPER", keys())).socket.closed.code, 4008);
});
test("replay is rejected while a long transfer keeps its attachment bounded", async () => {
  const f = await fixture();
  const agent = await attach(f);
  let last;
  for (let i = 0; i < 600; i++)
    last = await agent.send("telemetry.system", { hostCpuPercent: 0 });
  assert.equal(agent.socket.closed, null);
  await f.room.webSocketMessage(agent.socket, last);
  assert.equal(agent.socket.closed.code, 4008);
});
test("old session packets are rejected after reconnect and hibernation", async () => {
  const f = await fixture();
  const old = await attach(f);
  const packet = await old.send("telemetry.system", { hostCpuPercent: 42 });
  const next = await attach(f);
  assert.equal(old.socket.closed.code, 4002);
  f.room = new ServerRoom(f.st, f.env);
  await f.room.webSocketMessage(next.socket, packet);
  assert.equal(next.socket.closed.code, 4008);
});
test("wrong room, tampered signature and stale timestamp fail before routing", async () => {
  for (const change of [
    (e) => ({ ...e, serverId: randomUUID() }),
    (e) => ({ ...e, signature: "A".repeat(86) }),
    (e) => ({ ...e, timestamp: new Date(Date.now() - 60000).toISOString() }),
  ]) {
    const f = await fixture();
    const agent = await attach(f);
    const raw = JSON.parse(
      await agent.encode("telemetry.system", { value: 1 }),
    );
    await f.room.webSocketMessage(agent.socket, JSON.stringify(change(raw)));
    assert.equal(agent.socket.closed.code, 4008);
  }
});
test("relay checks device scope, local capability and high-risk confirmation", async () => {
  const f = await fixture(["player.kick", "player.op"], "Owner");
  await attach(f);
  await action(f, "files.write", {});
  assert.equal(f.browser.sent.at(-1).code, "SCOPE_DENIED");
  const m = await f.st.storage.get("room-metadata");
  m.identity.capabilities["player.kick"] = false;
  await f.st.storage.put("room-metadata", m);
  await action(f, "player.kick", {});
  assert.equal(f.browser.sent.at(-1).code, "CAPABILITY_DISABLED");
  await action(f, "player.op", {});
  assert.equal(f.browser.sent.at(-1).code, "CONFIRMATION_REQUIRED");
});
test("queued is not completed; results are private to the requesting device and survive hibernation", async () => {
  const f = await fixture(["files.read"]);
  const agent = await attach(f);
  const other = device(["files.read"]);
  const m = await f.st.storage.get("room-metadata");
  m.devices.push(other);
  await f.st.storage.put("room-metadata", m);
  const second = dashboard(f.st, f.serverId, other);
  const id = await action(f, "files.read", {
    root: "server",
    path: "config.yml",
  });
  assert.equal(f.browser.sent.at(-1).type, "dashboard.action_queued");
  f.room = new ServerRoom(f.st, f.env);
  await agent.send("action.result", {
    requestId: id,
    action: "files.read",
    deviceId: f.d.deviceId,
    status: "SUCCESS",
    data: { content: "private file result" },
  });
  assert.equal(f.browser.sent.at(-1).body.data.content, "private file result");
  assert.ok(!JSON.stringify(second.sent).includes("private file result"));
  assert.ok(
    !JSON.stringify([...f.st.storage.values]).includes("private file result"),
  );
});
test("revocation closes the browser immediately and old generations cannot roll it back", async () => {
  const f = await fixture();
  const agent = await attach(f);
  await agent.send("access.sync", {
    protocolVersion: 3,
    serverId: f.serverId,
    generation: 8,
    revision: 2,
    devices: [],
  });
  assert.equal(f.browser.closed.code, 4003);
  await agent.send("access.sync", {
    protocolVersion: 3,
    serverId: f.serverId,
    generation: 7,
    revision: 999,
    devices: [f.d],
  });
  assert.equal((await f.st.storage.get("room-metadata")).generation, 8);
});
test("expiry alarms reject expired devices and a host cannot invent a grant", async () => {
  const f = await fixture();
  await attach(f);
  const host = await attach(f, "HOST");
  await host.send("access.sync", {
    protocolVersion: 3,
    serverId: f.serverId,
    generation: 7,
    revision: 2,
    devices: [f.d, device(SCOPES, "Owner")],
  });
  assert.equal(host.socket.closed.code, 4008);
  const m = await f.st.storage.get("room-metadata");
  m.devices[0].expiresAt = Math.floor(Date.now() / 1000) - 1;
  await f.st.storage.put("room-metadata", m);
  await f.room.alarm();
  assert.equal(f.browser.closed.code, 4003);
});
test("client cannot exceed command, transfer, parameter or in-flight request limits", async () => {
  const f = await fixture(["files.download"]);
  await attach(f);
  for (let i = 0; i < 20; i++) await action(f, "files.download", {});
  await action(f, "files.download", {});
  assert.equal(f.browser.sent.at(-1).code, "RATE_LIMITED");
  const a = f.browser.deserializeAttachment();
  a.transferRate = Array(160).fill(Date.now());
  f.browser.serializeAttachment(a);
  await action(f, "files.download.chunk", {});
  assert.equal(f.browser.sent.at(-1).code, "RATE_LIMITED");
  await action(f, "files.download", { x: "a".repeat(50000) });
  assert.equal(f.browser.sent.at(-1).code, "INVALID_PARAMETERS");
});
test("one-use pairing is consumed only after the locally selected grant is persisted", async () => {
  const f = await fixture();
  const agent = await attach(f);
  const registration = {
    lookupId: "lookup",
    challengeId: randomUUID(),
    requestId: randomUUID(),
    expiresAt: Date.now() + 60000,
  };
  const m = await f.st.storage.get("room-metadata");
  m.currentPairing = registration;
  await f.st.storage.put("room-metadata", m);
  const newId = randomUUID();
  agent.socket.listener = (text) => {
    const msg = decodeEnvelope(text);
    if (msg.envelope.type === "pairing.consume")
      void agent.send("pairing.accepted", {
        requestId: registration.requestId,
        generation: 7,
        revision: 2,
        device: { ...device(["telemetry.view"], "Observer"), deviceId: newId },
      });
  };
  const request = () =>
    internal("/claim", f.env, {
      lookupId: "lookup",
      challengeId: registration.challengeId,
      deviceId: newId,
      name: "Browser",
    });
  const responses = await Promise.all([
    f.room.fetch(request()),
    f.room.fetch(request()),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 403]);
  assert.equal(
    (await responses.find((r) => r.status === 200).json()).device.role,
    "Observer",
  );
});
test("pairing rejects local revocation racing approval", async () => {
  const f = await fixture();
  const agent = await attach(f);
  const registration = {
    lookupId: "lookup",
    challengeId: randomUUID(),
    requestId: randomUUID(),
    expiresAt: Date.now() + 60000,
  };
  const m = await f.st.storage.get("room-metadata");
  m.currentPairing = registration;
  await f.st.storage.put("room-metadata", m);
  const newId = randomUUID();
  agent.socket.listener = (text) => {
    if (decodeEnvelope(text).envelope.type !== "pairing.consume") return;
    void (async () => {
      await f.st.storage.put("room-metadata", {
        ...m,
        revision: 3,
        devices: [],
      });
      await agent.send("pairing.accepted", {
        requestId: registration.requestId,
        generation: 7,
        revision: 2,
        device: { ...device(), deviceId: newId },
      });
    })();
  };
  assert.equal(
    (
      await f.room.fetch(
        internal("/claim", f.env, {
          lookupId: "lookup",
          challengeId: registration.challengeId,
          deviceId: newId,
          name: "Browser",
        }),
      )
    ).status,
    403,
  );
});
test("events filter player addresses, locations, console levels and local capabilities", () => {
  const body = {
    players: [{ name: "Player", address: "203.0.113.1", position: { x: 10 } }],
  };
  const caps = Object.fromEntries(SCOPES.map((s) => [s, true]));
  assert.deepEqual(
    filterEvent("inventory.players", body, ["players.view"], caps).players,
    [{ name: "Player" }],
  );
  assert.equal(
    filterEvent(
      "console.lines",
      { lines: [{ level: "INFO" }, { level: "WARN" }] },
      ["console.view.errors"],
      caps,
    ).lines.length,
    1,
  );
  assert.equal(
    filterEvent("telemetry.system", {}, ["telemetry.view"], {}),
    null,
  );
});
test("directory rate limit, code expiry and internal route authentication are enforced", async () => {
  const st = state(),
    env = environment(),
    directory = new PairingDirectory(st, env);
  assert.equal(
    (
      await directory.fetch(
        new Request("https://internal.example/resolve", {
          method: "POST",
          body: "{}",
        }),
      )
    ).status,
    403,
  );
  for (let i = 0; i < 10; i++)
    assert.equal(
      (
        await directory.fetch(
          internal("/resolve", env, {
            code: "123456",
            clientKey: "same-client",
          }),
        )
      ).status,
      404,
    );
  assert.equal(
    (
      await directory.fetch(
        internal("/resolve", env, { code: "123456", clientKey: "same-client" }),
      )
    ).status,
    429,
  );
  const lookup = await pairingLookupId("654321", env.PAIRING_CODE_PEPPER);
  await st.storage.put(`code:${lookup}`, { expiresAt: Date.now() - 1 });
  assert.equal(
    (
      await directory.fetch(
        internal("/resolve", env, {
          code: "654321",
          clientKey: "another-client",
        }),
      )
    ).status,
    404,
  );
  assert.equal(st.storage.values.has(`code:${lookup}`), false);
});
test("malformed claims fail closed without throwing", () => {
  assert.equal(
    currentAccess(
      { generation: 7, devices: [] },
      { protocolVersion: 3, generation: 7, expiresAt: Infinity },
    ),
    false,
  );
});

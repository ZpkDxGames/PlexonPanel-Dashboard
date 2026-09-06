// Actual local workerd integration; no deployed relay or account secrets.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  generateKeyPairSync,
  randomBytes,
  randomUUID,
  sign,
} from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import {
  decodeEnvelope,
  publicKeyFingerprint,
  signEnvelope,
} from "../relay/dist/protocol.js";
const root = dirname(dirname(fileURLToPath(import.meta.url))),
  out = resolve(root, ".test-dist/relay-bundle");
const bundle = spawnSync(
  process.execPath,
  [
    resolve(root, "node_modules/wrangler/bin/wrangler.js"),
    "deploy",
    "--dry-run",
    "--config",
    resolve(root, "relay/wrangler.jsonc"),
    "--outdir",
    out,
  ],
  {
    cwd: root,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    stdio: "inherit",
  },
);
if (bundle.error) throw bundle.error;
if (bundle.status !== 0) throw new Error("Relay dry-run bundle failed");
function keys() {
  const k = generateKeyPairSync("ed25519");
  return {
    raw: k.privateKey,
    privateKey: k.privateKey
      .export({ format: "der", type: "pkcs8" })
      .toString("base64"),
    publicKey: k.publicKey
      .export({ format: "der", type: "spki" })
      .toString("base64"),
  };
}
function inbox(socket, signed = false) {
  const messages = [],
    waiters = [];
  socket.addEventListener("message", (e) => {
    const raw = JSON.parse(e.data),
      value = signed
        ? { type: raw.type, body: decodeEnvelope(e.data).body }
        : raw;
    const i = waiters.findIndex((w) => w.predicate(value));
    if (i >= 0) {
      const [w] = waiters.splice(i, 1);
      clearTimeout(w.timer);
      w.resolve(value);
    } else messages.push(value);
  });
  socket.accept();
  return (predicate) => {
    const i = messages.findIndex(predicate);
    if (i >= 0) return Promise.resolve(messages.splice(i, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, timer: null };
      waiter.timer = setTimeout(() => {
        const i = waiters.indexOf(waiter);
        if (i >= 0) waiters.splice(i, 1);
        reject(new Error(`Timed out waiting for ${predicate}`));
      }, 10000);
      waiters.push(waiter);
    });
  };
}
const relay = keys(),
  key = keys(),
  serverId = randomUUID(),
  session = randomUUID(),
  base = "https://relay.example",
  origin = "https://dashboard.example";
const mf = new Miniflare(
  convertV4MiniflareOptions({
    name: "plexonpanel-relay",
    modules: true,
    scriptPath: resolve(out, "index.js"),
    compatibilityDate: "2026-08-15",
    durableObjects: {
      SERVER_ROOMS: { className: "ServerRoom", useSQLite: true },
      PAIRING_DIRECTORY: { className: "PairingDirectory", useSQLite: true },
    },
    bindings: {
      DASHBOARD_ORIGINS: origin,
      ACCESS_TOKEN_SECRET: randomBytes(48).toString("base64"),
      PAIRING_CODE_PEPPER: randomBytes(48).toString("base64"),
      GATEWAY_ED25519_PRIVATE_KEY: relay.privateKey,
      GATEWAY_ED25519_PUBLIC_KEY: relay.publicKey,
    },
  }),
);
let paper,
  browser,
  sequence = 0;
const send = async (type, body) =>
  paper.send(
    await signEnvelope(
      type,
      serverId,
      { ...body, _session: session, _sequence: ++sequence },
      key.privateKey,
    ),
  );
try {
  assert.equal(
    (await (await mf.dispatchFetch(`${base}/healthz`)).json()).protocolVersion,
    3,
  );
  assert.equal(
    (
      await mf.dispatchFetch(`${base}/v1/agent?serverId=${serverId}`, {
        headers: { Upgrade: "websocket", "X-PlexonPanel-Protocol": "2" },
      })
    ).status,
    426,
  );
  const upgrade = await mf.dispatchFetch(
    `${base}/v1/agent?serverId=${serverId}`,
    { headers: { Upgrade: "websocket", "X-PlexonPanel-Protocol": "3" } },
  );
  assert.equal(upgrade.status, 101);
  paper = upgrade.webSocket;
  const nextAgent = inbox(paper, true),
    fingerprint = await publicKeyFingerprint(key.publicKey);
  await send("agent.hello", {
    agentKind: "PAPER",
    protocolVersion: 3,
    publicKey: key.publicKey,
    publicKeyFingerprint: fingerprint,
    pluginVersion: "2.0.0",
    paperVersion: "Paper 26.2",
    minecraftVersion: "26.2",
    javaVersion: "25",
    operatingSystem: "Linux",
    capabilities: { "overview.view": true, "telemetry.view": true },
    hostPublicKey: "",
  });
  const nonce = (await nextAgent((m) => m.type === "gateway.challenge")).body
    .nonce;
  await send("agent.challenge_response", {
    nonce,
    proof: sign(null, Buffer.from(`challenge:${nonce}`), key.raw).toString(
      "base64url",
    ),
  });
  await nextAgent((m) => m.type === "gateway.authenticated");
  await send("agent.pairing_begin", {
    requestId: randomUUID(),
    code: "739152",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    fingerprint,
    role: "Observer",
    scopes: ["overview.view", "telemetry.view"],
  });
  await nextAgent((m) => m.type === "pairing.registered");
  const pending = mf.dispatchFetch(`${base}/v1/pairings/claim`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ code: "739152", name: "Local smoke browser" }),
  });
  const consume = (await nextAgent((m) => m.type === "pairing.consume")).body,
    now = Math.floor(Date.now() / 1000);
  await send("pairing.accepted", {
    requestId: consume.requestId,
    generation: 1,
    revision: 1,
    device: {
      deviceId: consume.deviceId,
      name: consume.name,
      role: "Observer",
      scopes: ["overview.view", "telemetry.view"],
      issuedAt: now,
      expiresAt: now + 3600,
      lastSeen: now,
    },
  });
  const response = await pending;
  assert.equal(response.status, 200);
  const grant = await response.json();
  assert.equal(grant.role, "Observer");
  const b = await mf.dispatchFetch(`${base}/v1/dashboard`, {
    headers: {
      Origin: origin,
      Upgrade: "websocket",
      "Sec-WebSocket-Protocol": `plexonpanel-v3, auth.${grant.accessToken}`,
    },
  });
  assert.equal(b.status, 101);
  browser = b.webSocket;
  const nextBrowser = inbox(browser);
  assert.equal(
    (await nextBrowser((m) => m.type === "dashboard.ready")).device.role,
    "Observer",
  );
  for (let i = 0; i < 100; i++)
    await send("telemetry.system", { hostCpuPercent: i === 99 ? 0 : i + 1 });
  await nextBrowser(
    (m) =>
      m.type === "server.event" &&
      m.eventType === "telemetry.system" &&
      m.body.hostCpuPercent === 0,
  );
  browser.send(
    JSON.stringify({
      type: "dashboard.action",
      requestId: randomUUID(),
      action: "console.execute",
      parameters: { command: "tps" },
    }),
  );
  assert.equal(
    (await nextBrowser((m) => m.type === "dashboard.action_rejected")).code,
    "SCOPE_DENIED",
  );
  const closed = new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Revocation did not close browser")),
      10000,
    );
    browser.addEventListener(
      "close",
      (e) => {
        clearTimeout(timer);
        resolve(e.code);
      },
      { once: true },
    );
  });
  await send("access.sync", {
    protocolVersion: 3,
    serverId,
    generation: 2,
    revision: 2,
    devices: [],
  });
  assert.equal(await closed, 4003);
  assert.equal(
    (
      await mf.dispatchFetch(`${base}/v1/dashboard/session`, {
        headers: {
          Origin: origin,
          Authorization: `Bearer ${grant.accessToken}`,
        },
      })
    ).status,
    401,
  );
  console.log(
    "PASS workerd: v3 authentication, one-use local grant, browser session, bounded telemetry, scoped denial, live revocation",
  );
} finally {
  try {
    browser?.close(1000, "Test finished");
  } catch {}
  try {
    paper?.close(1000, "Test finished");
  } catch {}
  await mf.dispose();
}

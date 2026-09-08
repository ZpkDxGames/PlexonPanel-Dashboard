import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadStandaloneConfig } from "../dist/standalone/config.js";
import { CoordinationStore } from "../dist/standalone/persistence.js";
import { createStandaloneRelay } from "../dist/standalone/server.js";

function keys() {
  const pair = generateKeyPairSync("ed25519");
  return {
    privateKey: pair.privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
    publicKey: pair.publicKey.export({ format: "der", type: "spki" }).toString("base64"),
  };
}

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "plexonpanel-relay-"));
  const key = keys();
  const config = await loadStandaloneConfig({
    PLEXON_RELAY_HOST: "127.0.0.1",
    PLEXON_RELAY_PORT: "8787",
    PLEXON_RELAY_DATABASE_PATH: join(directory, "relay.db"),
    PLEXON_RELAY_DASHBOARD_ORIGINS: "https://dashboard.example.test",
    PAIRING_CODE_PEPPER: "p".repeat(48),
    ACCESS_TOKEN_SECRET: "a".repeat(48),
    GATEWAY_ED25519_PRIVATE_KEY: key.privateKey,
    GATEWAY_ED25519_PUBLIC_KEY: key.publicKey,
  });
  return { directory, config };
}

test("configuration is loopback-first and rejects wildcard origins", async () => {
  const { directory, config } = await fixture();
  try {
    assert.equal(config.host, "127.0.0.1");
    assert.equal(config.port, 8787);
    assert.equal(config.trustedProxy, "cloudflare-loopback");
    await assert.rejects(
      loadStandaloneConfig({
        PLEXON_RELAY_HOST: "0.0.0.0",
        PLEXON_RELAY_DATABASE_PATH: join(directory, "bad.db"),
        PLEXON_RELAY_DASHBOARD_ORIGINS: "*",
        PAIRING_CODE_PEPPER: "p".repeat(48),
        ACCESS_TOKEN_SECRET: "a".repeat(48),
        GATEWAY_ED25519_PRIVATE_KEY: config.relayPrivateKey,
        GATEWAY_ED25519_PUBLIC_KEY: config.relayPublicKey,
      }),
      /loopback/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("coordination store persists only bounded room metadata and rate limits pairing", async () => {
  const { directory, config } = await fixture();
  const store = new CoordinationStore(config.databasePath);
  try {
    const serverId = randomUUID();
    const room = store.loadRoom(serverId);
    room.revision = 4;
    store.saveRoom(serverId, room);
    assert.equal(store.loadRoom(serverId).revision, 4);

    for (let attempt = 0; attempt < 10; attempt++)
      assert.equal(store.consumePairingRateLimit("client", 1_000), true);
    assert.equal(store.consumePairingRateLimit("client", 1_000), false);

    const registration = {
      lookupId: "lookup",
      serverId,
      requestId: randomUUID(),
      challengeId: randomUUID(),
      fingerprint: "AA:BB",
      expiresAt: Date.now() + 60_000,
    };
    assert.equal(store.registerPairing(registration), "ok");
    assert.equal(store.resolvePairingByLookup("lookup")?.serverId, serverId);
    assert.deepEqual(store.counts(), { rooms: 1, pairings: 1, rateLimits: 1 });
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("standalone health route is safe and advertises Protocol 3", async () => {
  const { directory, config } = await fixture();
  const relay = createStandaloneRelay({ ...config, port: 0 });
  try {
    await relay.start();
    const address = relay.server.address();
    assert.ok(address && typeof address === "object");
    const response = await fetch(`http://127.0.0.1:${address.port}/healthz`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.runtime, "standalone");
    assert.equal(body.protocolVersion, 3);
    assert.equal(body.storage, "coordination-only");
    assert.equal(Object.hasOwn(body, "gatewayPublicKey"), false);
    assert.equal(Object.hasOwn(body, "accessTokenSecret"), false);
  } finally {
    await relay.close();
    await rm(directory, { recursive: true, force: true });
  }
});

import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";

import {
  assertFreshEnvelope,
  decodeEnvelope,
  importAgentPublicKey,
  signEnvelope,
  verifyEnvelope,
} from "../dist/protocol.js";
import {
  normalizePairingCode,
  pairingLookupId,
  signDashboardAccess,
  verifyDashboardAccess,
} from "../dist/security.js";

test("signs and verifies protocol v3 envelopes with Ed25519", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privateKeyBase64 = privateKey
    .export({ format: "der", type: "pkcs8" })
    .toString("base64");
  const publicKeyBase64 = publicKey
    .export({ format: "der", type: "spki" })
    .toString("base64");
  const encoded = await signEnvelope(
    "gateway.snapshot_request",
    "4e34679e-30b6-4f68-a50e-a10dfdb2724d",
    { requestedAt: new Date().toISOString() },
    privateKeyBase64,
  );
  const decoded = decodeEnvelope(encoded);
  assert.equal(decoded.envelope.protocolVersion, 3);
  assert.equal(decoded.envelope.type, "gateway.snapshot_request");
  assertFreshEnvelope(decoded.envelope);
  assert.equal(
    await verifyEnvelope(
      decoded.envelope,
      await importAgentPublicKey(publicKeyBase64),
    ),
    true,
  );
});

test("issues scoped dashboard credentials and rejects expiry", async () => {
  const secret = "a".repeat(64);
  const issuedAt = 1_700_000_000;
  const access = {
    version: 3,
    protocolVersion: 3,
    role: "Observer",
    scopes: ["telemetry.view"],
    audience: "plexonpanel-relay",
    serverId: "4e34679e-30b6-4f68-a50e-a10dfdb2724d",
    deviceId: "92435470-1a9d-4dfc-a0e9-0b66f229a504",
    generation: 3,
    issuedAt,
    expiresAt: issuedAt + 3600,
  };
  const token = await signDashboardAccess(access, secret);
  assert.deepEqual(
    await verifyDashboardAccess(token, secret, issuedAt + 10),
    access,
  );
  await assert.rejects(
    () => verifyDashboardAccess(token, secret, issuedAt + 3601),
    /expired/i,
  );
});

test("pairing lookups are deterministic, peppered, and six-digit only", async () => {
  assert.equal(normalizePairingCode(" 042137 "), "042137");
  assert.throws(() => normalizePairingCode("42137"), /six-digit/i);
  const first = await pairingLookupId("042137", "b".repeat(64));
  const second = await pairingLookupId("042137", "b".repeat(64));
  const different = await pairingLookupId("042137", "c".repeat(64));
  assert.equal(first, second);
  assert.notEqual(first, different);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test("v2 claims and client-invented scopes are never upgraded implicitly", async () => {
  const base = {
    version: 3,
    protocolVersion: 3,
    role: "Observer",
    scopes: ["telemetry.view"],
    audience: "plexonpanel-relay",
    serverId: "4e34679e-30b6-4f68-a50e-a10dfdb2724d",
    deviceId: "92435470-1a9d-4dfc-a0e9-0b66f229a504",
    generation: 1,
    issuedAt: 1700000000,
    expiresAt: 1700000600,
  };
  for (const changed of [
    { version: 1, protocolVersion: 2 },
    { scopes: ["shell.execute"] },
    { role: "" },
    { generation: -1 },
  ]) {
    const token = await signDashboardAccess(
      { ...base, ...changed },
      "x".repeat(64),
    );
    await assert.rejects(() =>
      verifyDashboardAccess(token, "x".repeat(64), 1700000010),
    );
  }
});

test("verifies the shared Java/TypeScript canonical vector", async () => {
  const { readFile } = await import("node:fs/promises");
  const fixture = JSON.parse(
    await readFile(
      new URL("../fixtures/v3-envelope.json", import.meta.url),
      "utf8",
    ),
  );
  const decoded = decodeEnvelope(JSON.stringify(fixture.envelope));
  assert.deepEqual(decoded.body, fixture.body);
  assert.equal(
    await verifyEnvelope(
      decoded.envelope,
      await importAgentPublicKey(fixture.publicKey),
    ),
    true,
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizePairingCode,
  pairingLookupId,
  pairingVerificationHash,
  signDashboardAccessToken,
  verifyDashboardAccessToken,
  verifyPairingHash,
} from "../dist/crypto.js";

const secret = "s".repeat(64);

test("pairing hashes are deterministic without storing the code", () => {
  const lookup = pairingLookupId("481927", secret);
  const verification = pairingVerificationHash("challenge-1", "481927", secret);

  assert.equal(lookup.length, 64);
  assert.equal(verifyPairingHash(verification, "challenge-1", "481927", secret), true);
  assert.equal(verifyPairingHash(verification, "challenge-1", "481928", secret), false);
  assert.equal(normalizePairingCode(" 481927 "), "481927");
  assert.throws(() => normalizePairingCode("48192"));
});

test("dashboard access tokens are signed, scoped, and short-lived", () => {
  const payload = {
    version: 1,
    audience: "plexonpanel-gateway",
    scope: "dashboard:read",
    serverId: "66431911-ce8c-48f3-9846-4754a8af21ef",
    deviceId: "device-1234567890abcdef",
    issuedAt: 1_000,
    expiresAt: 1_300,
  };
  const token = signDashboardAccessToken(payload, secret);

  assert.deepEqual(verifyDashboardAccessToken(token, secret, 1_100), payload);
  assert.throws(() => verifyDashboardAccessToken(`${token}x`, secret, 1_100));
  assert.throws(() => verifyDashboardAccessToken(token, secret, 1_301));
});

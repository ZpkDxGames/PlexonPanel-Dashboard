import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import {
  PROTOCOL_VERSION,
  ReplayWindow,
  decodeEnvelope,
  loadGatewayIdentity,
  signEnvelope,
  verifyEnvelope,
} from "../dist/protocol.js";

const serverId = "66431911-ce8c-48f3-9846-4754a8af21ef";

function identity() {
  const keys = generateKeyPairSync("ed25519");
  const encoded = keys.privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
  return loadGatewayIdentity(encoded);
}

test("protocol v2 envelopes round-trip and verify", () => {
  const keys = identity();
  const encoded = signEnvelope("gateway.challenge", serverId, { nonce: "example" }, keys);
  const decoded = decodeEnvelope(encoded);

  assert.equal(decoded.envelope.protocolVersion, PROTOCOL_VERSION);
  assert.equal(decoded.body.nonce, "example");
  assert.equal(verifyEnvelope(decoded.envelope, keys.publicKey), true);
});

test("tampering with signed metadata invalidates the signature", () => {
  const keys = identity();
  const decoded = decodeEnvelope(signEnvelope("gateway.challenge", serverId, { nonce: "example" }, keys));
  decoded.envelope.type = "action.request";

  assert.equal(verifyEnvelope(decoded.envelope, keys.publicKey), false);
});

test("replay window rejects duplicate message IDs", () => {
  const replay = new ReplayWindow();
  assert.equal(replay.accept("message-1", 1_000), true);
  assert.equal(replay.accept("message-1", 1_001), false);
});

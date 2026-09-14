import assert from "node:assert/strict";
import test from "node:test";
import { decodeEnvelope } from "../dist/protocol.js";

const retired = [
  "backup.coordination",
  "backup.coordination.result",
  "maintenance.coordination",
  "maintenance.coordination.result",
];

function envelope(type) {
  return JSON.stringify({
    protocolVersion: 3,
    type,
    messageId: "2c36edc8-56ab-4d8f-a48c-8cbdf06e7bd1",
    serverId: "e58519e2-d69e-4c30-b879-9de70ae4190a",
    timestamp: new Date().toISOString(),
    body: Buffer.from("{}").toString("base64url"),
    signature: "A".repeat(86),
  });
}

test("Step 5 rejects every retired Paper backup coordination message", () => {
  for (const type of retired) {
    assert.throws(
      () => decodeEnvelope(envelope(type)),
      /Retired coordination message type/,
      type,
    );
  }
});

test("Step 5 denylist remains narrow enough for normal Host events", () => {
  assert.equal(decodeEnvelope(envelope("telemetry.system")).envelope.type, "telemetry.system");
});

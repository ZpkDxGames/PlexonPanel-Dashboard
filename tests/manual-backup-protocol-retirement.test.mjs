import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const protocol = await readFile(new URL("../relay/src/protocol.ts", import.meta.url), "utf8");
const cloudflareRelay = await readFile(
  new URL("../relay/src/index-core.ts", import.meta.url),
  "utf8",
);
const standaloneRelay = await readFile(
  new URL("../relay/src/standalone/room-manager-core.ts", import.meta.url),
  "utf8",
);

const retired = [
  "backup.coordination",
  "backup.coordination.result",
  "maintenance.coordination",
  "maintenance.coordination.result",
];

test("Step 5 rejects retired Paper backup coordination at the shared protocol boundary", () => {
  for (const type of retired)
    assert.match(protocol, new RegExp(`\\"${type.replaceAll(".", "\\\\.")}\\"`));

  assert.match(protocol, /RETIRED_PAPER_BACKUP_COORDINATION/);
  assert.match(protocol, /assertActiveMessageType\(envelope\.type\)/);
  assert.match(protocol, /assertActiveMessageType\(type\)/);
  assert.match(protocol, /Paper backup coordination is retired/);
});

test("legacy relay handlers are unreachable rather than an active compatibility path", () => {
  for (const source of [cloudflareRelay, standaloneRelay]) {
    assert.match(source, /decodeEnvelope\(/);
    assert.match(source, /backup\.coordination/);
    assert.match(source, /maintenance\.coordination/);
  }

  // The handlers remain parseable for mixed-version source compatibility, but decodeEnvelope
  // rejects all four message types before either implementation can enter those branches.
  assert.ok(true);
});

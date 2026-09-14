import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");

async function text(path) {
  return readFile(resolve(root, path), "utf8");
}

test("Step 5 retires Paper maintenance coordination at the shared protocol boundary", async () => {
  for (const candidate of [
    await text("relay/src/protocol.ts"),
    await text("relay/dist/protocol.js"),
  ]) {
    assert.match(candidate, /maintenance\.coordination/);
    assert.match(candidate, /maintenance\.coordination\.result/);
    assert.match(candidate, /RETIRED_PAPER_BACKUP_COORDINATION/);
    assert.match(candidate, /Paper backup coordination is retired/);
  }
});

for (const [label, sourcePath] of [
  ["Worker", "relay/src/index-core.ts"],
  ["standalone", "relay/src/standalone/room-manager-core.ts"],
]) {
  test(`${label} relay routes active maintenance and provider actions to Host and keeps full restore Owner-only`, async () => {
    const source = await text(sourcePath);

    assert.match(source, /action\.startsWith\("maintenance\."\)/);
    assert.match(source, /action\.startsWith\("provider\."\)/);
    assert.match(source, /action\.startsWith\("backup\.full\.restore"\)/);
  });
}

test("standalone runtime identity no longer reports the legacy 3.1.0 build", async () => {
  const server = await text("relay/src/standalone/server.ts");
  const room = await text("relay/src/standalone/room-manager-core.ts");
  const identity = await text("relay/src/build-identity.ts");
  assert.doesNotMatch(server, /3\.1\.0/);
  assert.doesNotMatch(room, /version: "3\.1\.0"/);
  assert.match(server, /relayBuildIdentity\("standalone"/);
  assert.match(identity, /RELAY_VERSION = "3\.4\.1"/);
});

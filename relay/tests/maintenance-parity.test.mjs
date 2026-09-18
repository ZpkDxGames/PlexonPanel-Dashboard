import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");

async function text(path) {
  return readFile(resolve(root, path), "utf8");
}

for (const [label, sourcePath, distPath] of [
  ["Worker", "relay/src/index-core.ts", "relay/dist/index-core.js"],
  [
    "standalone",
    "relay/src/standalone/room-manager-core.ts",
    "relay/dist/standalone/room-manager-core.js",
  ],
]) {
  test(`${label} relay preserves 3.3 maintenance coordination in the 3.4 console release`, async () => {
    const source = await text(sourcePath);
    const compiled = await text(distPath);

    for (const candidate of [source, compiled]) {
      assert.match(candidate, /maintenance\.coordination/);
      assert.match(candidate, /maintenance\.coordination\.result/);
      assert.match(candidate, /Only Host coordinates maintenance/);
      assert.match(candidate, /Only Paper reports maintenance coordination/);
    }
  });

  test(`${label} relay routes maintenance and provider actions to Host and keeps full restore Owner-only`, async () => {
    const source = await text(sourcePath);

    assert.match(source, /action\.startsWith\("maintenance\."\)/);
    assert.match(source, /action\.startsWith\("provider\."\)/);
    assert.match(source, /action\.startsWith\("backup\.full\.restore"\)/);
  });
}

test("standalone runtime identity reports the matched 3.5.0 build", async () => {
  const server = await text("relay/src/standalone/server.ts");
  const room = await text("relay/src/standalone/room-manager-core.ts");
  const identity = await text("relay/src/build-identity.ts");
  assert.doesNotMatch(server, /3\.1\.0/);
  assert.doesNotMatch(room, /version: "3\.1\.0"/);
  assert.match(server, /relayBuildIdentity\("standalone"/);
  assert.match(identity, /RELAY_VERSION = "3\.5\.0"/);
});

test("Cloudflare room migration preserves storage while forcing the 3.5.0 class", async () => {
  const config = JSON.parse(await text("relay/wrangler.jsonc"));
  const roomBinding = config.durable_objects.bindings.find(
    (binding) => binding.name === "SERVER_ROOMS",
  );
  assert.equal(roomBinding?.class_name, "ServerRoomV350");
  assert.deepEqual(config.migrations.at(-1), {
    tag: "v2-room-v350",
    renamed_classes: [{ from: "ServerRoom", to: "ServerRoomV350" }],
  });
  assert.match(await text("relay/src/index.ts"), /export class ServerRoomV350/);
});

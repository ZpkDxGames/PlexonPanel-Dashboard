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

test("standalone runtime identity no longer reports the legacy 3.1.0 build", async () => {
  const server = await text("relay/src/standalone/server.ts");
  const room = await text("relay/src/standalone/room-manager-core.ts");
  assert.match(server, /const VERSION = "3\.4\.0"/);
  assert.match(room, /version: "3\.4\.0"/);
});

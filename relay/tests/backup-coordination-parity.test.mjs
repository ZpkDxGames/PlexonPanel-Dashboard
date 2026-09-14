import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const text = (path) => readFile(resolve(root, path), "utf8");

for (const [label, sourcePath, distPath] of [
  ["Worker", "relay/src/index-core.ts", "relay/dist/index-core.js"],
  [
    "standalone",
    "relay/src/standalone/room-manager-core.ts",
    "relay/dist/standalone/room-manager-core.js",
  ],
]) {
  test(`${label} relay immediately reports failed Paper backup coordination`, async () => {
    for (const candidate of [await text(sourcePath), await text(distPath)]) {
      assert.match(candidate, /PAPER_COORDINATION_UNAVAILABLE/);
      assert.match(candidate, /COORDINATING_PAPER/);
      assert.match(candidate, /backup\.coordination\.result/);
    }
  });
}

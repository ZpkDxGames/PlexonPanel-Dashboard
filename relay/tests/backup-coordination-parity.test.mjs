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
  test(`${label} relay rejects retired Paper backup coordination without forwarding`, async () => {
    for (const candidate of [await text(sourcePath), await text(distPath)]) {
      assert.match(candidate, /Retired Paper backup coordination message/);
      assert.doesNotMatch(candidate, /PAPER_COORDINATION_UNAVAILABLE/);
      assert.doesNotMatch(candidate, /COORDINATING_PAPER/);
      assert.doesNotMatch(candidate, /sendToAgent\("PAPER", "backup\.coordination"/);
      assert.doesNotMatch(candidate, /sendToAgent\("HOST", "backup\.coordination\.result"/);
      assert.doesNotMatch(candidate, /sendToAgent\("PAPER", "maintenance\.coordination"/);
      assert.doesNotMatch(candidate, /sendToAgent\("HOST", "maintenance\.coordination\.result"/);
    }
  });
}

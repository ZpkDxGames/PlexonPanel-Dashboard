import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const text = (path) => readFile(resolve(root, path), "utf8");

test("Step 5 retires Paper backup coordination in source and compiled protocol", async () => {
  for (const candidate of [
    await text("relay/src/protocol.ts"),
    await text("relay/dist/protocol.js"),
  ]) {
    assert.match(candidate, /backup\.coordination/);
    assert.match(candidate, /backup\.coordination\.result/);
    assert.match(candidate, /RETIRED_PAPER_BACKUP_COORDINATION/);
    assert.match(candidate, /Paper backup coordination is retired/);
  }
});

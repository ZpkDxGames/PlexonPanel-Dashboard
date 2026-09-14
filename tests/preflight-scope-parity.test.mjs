import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("backup.preflight maps to backup.view at both browser and relay boundaries", async () => {
  const browserScopes = await source("lib/scopes.ts");
  const relayScopes = await source("relay/src/scopes.ts");
  const alias = '"backup.preflight": "backup.view"';

  assert.equal(browserScopes.includes(alias), true, "browser scope alias missing");
  assert.equal(relayScopes.includes(alias), true, "relay scope alias missing");
});

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  ACTION_CONTRACT_ID,
  ACTION_SCOPES,
  canAction,
} from "../.test-dist/lib/scopes.js";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("backup.preflight is authorized by the canonical backup.view contract", () => {
  assert.equal(ACTION_SCOPES["backup.preflight"], "backup.view");
  assert.equal(canAction("backup.preflight", ["backup.view"], { "backup.view": true }), true);
  assert.equal(canAction("backup.preflight", [], { "backup.view": true }), false);
  assert.equal(canAction("backup.preflight", ["backup.view"], { "backup.view": false }), false);
});

test("browser and relay scope modules are generated from one checked-in manifest", async () => {
  const [browserScopes, relayScopes, manifest] = await Promise.all([
    source("lib/scopes.ts"),
    source("relay/src/scopes.ts"),
    source("protocol/action-scopes.json"),
  ]);
  assert.equal(browserScopes, relayScopes, "generated scope artifacts diverged");
  assert.match(browserScopes, /^\/\/ GENERATED FILE — source: protocol\/action-scopes\.json/m);
  const parsed = JSON.parse(manifest);
  assert.equal(parsed.actionAliases["backup.preflight"], "backup.view");
  assert.equal(
    parsed.actionAliases["maintenance.recovery.resolve"],
    "maintenance.run",
  );
  assert.equal(
    ACTION_CONTRACT_ID,
    `sha256:${createHash("sha256").update(JSON.stringify(parsed)).digest("hex")}`,
  );
});

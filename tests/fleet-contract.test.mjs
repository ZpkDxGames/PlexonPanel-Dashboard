import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  FLEET_CONTRACT_ID, parseFleetIdentity, sameFleetTarget, minecraftUnit,
} from "../.test-dist/lib/fleet-contract.js";
import { parseFleetIdentity as parseRelayIdentity } from "../relay/dist/fleet-contract.js";

const manifest = JSON.parse(await readFile(new URL("../protocol/fleet-contract-v1.json", import.meta.url), "utf8"));
test("fleet fixtures cover two servers on one node and independent nodes in both runtimes", () => {
  const identities = manifest.fixtures.map(parseFleetIdentity);
  assert.deepEqual(identities, manifest.fixtures.map(parseRelayIdentity));
  assert.equal(identities[0].nodeId, identities[1].nodeId);
  assert.notEqual(identities[0].nodeId, identities[2].nodeId);
  assert.equal(sameFleetTarget(identities[0], identities[1]), false);
  assert.equal(FLEET_CONTRACT_ID, "sha256:" + createHash("sha256").update(JSON.stringify(manifest)).digest("hex"));
});
test("renaming keeps routing identities and exact systemd target unchanged", () => {
  const first = parseFleetIdentity(manifest.fixtures[0]);
  const renamed = parseFleetIdentity({ ...first, serverName: "Another label" });
  assert.equal(sameFleetTarget(first, renamed), true);
  assert.equal(minecraftUnit(first), minecraftUnit(renamed));
  assert.equal(minecraftUnit(first), "minecraft@plexoncraft.service");
});
test("same server on a substituted node is a different target", () => {
  const first = parseFleetIdentity(manifest.fixtures[0]);
  assert.equal(sameFleetTarget(first, { ...first, nodeId: manifest.fixtures[2].nodeId }), false);
});
test("unit injection, invalid identifiers and control characters fail without echoing input", () => {
  for (const instanceKey of ["../server2", "x.service", "x@server2", "x;stop", "UPPER", "", "x\n"])
    assert.throws(() => parseFleetIdentity({ ...manifest.fixtures[0], instanceKey }), /Invalid instanceKey/);
  assert.throws(() => parseFleetIdentity({ ...manifest.fixtures[0], nodeId: "1-1-1-1-1" }), /Invalid nodeId/);
  assert.throws(() => parseFleetIdentity({ ...manifest.fixtures[0], serverName: "secret\nvalue" }), /^Error: Invalid serverName$/);
});

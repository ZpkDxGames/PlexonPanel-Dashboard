import { test } from "node:test";
import assert from "node:assert/strict";
import { bytes, entityDensity, metric } from "../src/store/selectors";
import { actionCapability } from "../src/features/capabilities";

test("formatters preserve zero and distinguish unavailable measurements", () => {
  assert.deepEqual(metric(0, "ms", 1), { value: "0.0", unit: "ms", available: true });
  assert.equal(metric(undefined, "ms").available, false);
  assert.equal(bytes(0).value, "0");
  assert.equal(bytes(undefined).available, false);
});

test("entity density is derived only from a positive known denominator", () => {
  assert.equal(entityDensity(12, 4), 3);
  assert.equal(entityDensity(0, 4), 0);
  assert.equal(entityDensity(12, 0), null);
  assert.equal(entityDensity(undefined, 4), null);
});

test("capability gates intersect scope, agent advertisement, presence and evidence", () => {
  const base = { action: "server.stop", scopes: ["server.stop"], advertised: { "server.stop": true }, agentOnline: true, evidenceUsable: true };
  assert.equal(actionCapability(base).state, "available");
  assert.equal(actionCapability({ ...base, scopes: [] }).state, "denied");
  assert.equal(actionCapability({ ...base, agentOnline: false }).state, "agent-offline");
  assert.equal(actionCapability({ ...base, advertised: { "server.stop": false } }).state, "unsupported");
  assert.equal(actionCapability({ ...base, evidenceUsable: false }).state, "stale");
});

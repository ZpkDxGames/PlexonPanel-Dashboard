import { test } from "node:test";
import assert from "node:assert/strict";
import { bytes, entityDensity, metric } from "../src/store/selectors";
import { resolveActionAuthority } from "../src/adapter/authority";

test("formatters preserve zero and distinguish unavailable measurements", () => {
  assert.deepEqual(metric(0, "ms", 1), {
    value: "0.0",
    unit: "ms",
    available: true,
  });
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

test("action authority grants every known scope to verified owners", () => {
  const owner = {
    deviceId: "owner",
    role: "Owner",
    scopes: [] as string[],
    metadataMatches: false,
  };
  assert.equal(
    resolveActionAuthority({
      action: "server.stop",
      grant: owner,
      capabilities: { "server.stop": true },
    }).state,
    "available",
  );
  assert.equal(
    resolveActionAuthority({
      action: "server.stop",
      grant: { ...owner, role: "Viewer" },
      capabilities: { "server.stop": true },
    }).state,
    "denied",
  );
  assert.equal(
    resolveActionAuthority({
      action: "server.stop",
      grant: owner,
      capabilities: { "server.stop": false },
    }).state,
    "unsupported",
  );
});

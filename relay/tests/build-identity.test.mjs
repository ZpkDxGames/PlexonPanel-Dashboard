import assert from "node:assert/strict";
import test from "node:test";
import worker from "../dist/index.js";
import { relayBuildIdentity } from "../dist/build-identity.js";

test("relay build identity exposes only bounded non-secret metadata", () => {
  assert.deepEqual(
    relayBuildIdentity("cloudflare-worker", {
      BUILD_GIT_COMMIT: "8b68f32423efb56eda1c535b7c3e36ea5a30a5e7",
      BUILD_TIMESTAMP: "2026-09-14T02:17:15Z",
    }),
    {
      version: "3.5.1",
      gitCommit: "8b68f32423efb56eda1c535b7c3e36ea5a30a5e7",
      buildTimestamp: "2026-09-14T02:17:15.000Z",
      protocolVersion: 3,
      runtimeKind: "cloudflare-worker",
    },
  );
  assert.equal(relayBuildIdentity("standalone", { BUILD_GIT_COMMIT: "secret=value" }).gitCommit, "unavailable");
});

test("Worker health advertises the deployed commit and runtime kind", async () => {
  const response = await worker.fetch(
    new Request("https://relay.example/healthz", {
      headers: { Origin: "https://dashboard.example" },
    }),
    {
      DASHBOARD_ORIGINS: "https://dashboard.example",
      GATEWAY_ED25519_PUBLIC_KEY: "test-public-key",
      BUILD_GIT_COMMIT: "8b68f32423efb56eda1c535b7c3e36ea5a30a5e7",
      BUILD_TIMESTAMP: "2026-09-14T02:17:15Z",
    },
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.version, "3.5.1");
  assert.equal(body.gitCommit, "8b68f32423efb56eda1c535b7c3e36ea5a30a5e7");
  assert.equal(body.runtimeKind, "cloudflare-worker");
  assert.equal(body.protocolVersion, 3);
  assert.equal(Object.hasOwn(body, "ACCESS_TOKEN_SECRET"), false);
});

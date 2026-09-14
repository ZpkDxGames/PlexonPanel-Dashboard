import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const view = () =>
  readFile(new URL("../app/backups-view-3-4-1.tsx", import.meta.url), "utf8");

test("provider view keeps latest test and last successful verification as distinct Host-authoritative fields", async () => {
  const source = await view();

  assert.equal(source.includes("<dt>Last test</dt>"), true);
  assert.equal(source.includes("time(provider.lastTestAt)"), true);
  assert.equal(source.includes("<dt>Last successful verification</dt>"), true);
  assert.equal(source.includes("time(provider.lastSuccessfulVerificationAt)"), true);
  assert.equal(source.includes("providerQuery.hasSuccess ? time(provider.lastSuccessfulVerificationAt) : \"—\""), true);
});

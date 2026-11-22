import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadBedrockConfig, parseBedrockConfig } from "../dist/standalone/bedrock-config.js";
import { BedrockGrants } from "../dist/standalone/bedrock-grants.js";
import { bedrockEvent } from "../dist/standalone/bedrock-events.js";
import { hostKeys } from "./support/bedrock-fixture.mjs";

function configuration(now = Date.now()) {
  return { serverId: randomUUID(), nodeId: randomUUID(), instanceKey: "tonimbedrock",
    publicKey: hostKeys().publicKey, generation: 1, revokedDevices: [], enrollment: {
      id: randomUUID(), lookupId: "a".repeat(64), issuedAt: now, expiresAt: now + 60_000,
    } };
}

test("durable pairing consumes the enrollment across restarts, while operator revocations cannot revive access", async () => {
  const directory = await mkdtemp(join(tmpdir(), "plexon-bedrock-grants-"));
  const path = join(directory, "relay.db");
  const now = Date.now();
  const config = configuration(now);
  try {
    let grants = new BedrockGrants(path, config);
    assert.equal(grants.claim("b".repeat(64), "wrong", now), null);
    const first = grants.claim(config.enrollment.lookupId, "reviewed browser", now);
    assert.ok(first);
    grants.close();
    assert.equal((await stat(`${path}.bedrock`)).mode & 0o777, 0o600);
    grants = new BedrockGrants(path, config);
    assert.ok(grants.device(first.access, now));
    assert.equal(grants.claim(config.enrollment.lookupId, "duplicate", now), null);
    assert.equal(grants.device(first.access, first.access.expiresAt * 1000), null);
    grants.close();
    grants = new BedrockGrants(path, { ...config, revokedDevices: [first.access.deviceId] });
    assert.equal(grants.device(first.access, now), null);
    grants.close();
    grants = new BedrockGrants(path, { ...config, generation: 2 });
    assert.equal(grants.device(first.access, now), null);
    grants.close();
    assert.throws(() => new BedrockGrants(path, config), /authority or generation/);
    assert.throws(() => new BedrockGrants(path, { ...config, publicKey: hostKeys().publicKey, generation: 2 }), /authority or generation/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("enrollment expiry and global attempt limits fail closed", () => {
  const now = Date.now();
  const config = configuration(now);
  const grants = new BedrockGrants(":memory:", config);
  try {
    assert.equal(grants.claim(config.enrollment.lookupId, "expired", now + 60_000), null);
    assert.equal(grants.claim(config.enrollment.lookupId, "future", now - 1), null);
    for (let i = 0; i < 30; i++) assert.equal(grants.claim("b".repeat(64), "invalid", now), null);
    assert.equal(grants.claim(config.enrollment.lookupId, "exhausted", now), null);
  } finally { grants.close(); }
});

test("private registration validates exact arguments and refuses symbolic links and public modes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "plexon-bedrock-registration-"));
  try {
    const config = configuration();
    const path = join(directory, "bedrock.json");
    await writeFile(path, JSON.stringify(config), { mode: 0o600 });
    assert.deepEqual(await loadBedrockConfig(path), config);
    const link = join(directory, "link.json");
    await symlink(path, link);
    await assert.rejects(loadBedrockConfig(link));
    const publicFile = join(directory, "public.json");
    await writeFile(publicFile, JSON.stringify(config), { mode: 0o600 });
    const { chmod } = await import("node:fs/promises");
    await chmod(publicFile, 0o644);
    await assert.rejects(loadBedrockConfig(publicFile), /private regular file/);
    assert.throws(() => parseBedrockConfig({ ...config, instanceKey: "another-container" }));
    assert.throws(() => parseBedrockConfig({ ...config, generation: 0 }));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("status and log validation rejects inconsistent resource data and unsafe lines", () => {
  const now = Date.now();
  const capturedAt = new Date(now).toISOString();
  const raw = { capturedAt, source: "DOCKER_ENGINE", containerState: "exited", cpuUnit: "PERCENT_OF_ONE_CORE" };
  assert.equal(bedrockEvent("bedrock.status", raw, now).containerCpuPercent, null);
  assert.throws(() => bedrockEvent("bedrock.status", { ...raw, containerCpuPercent: 1 }, now), /resource/);
  assert.throws(() => bedrockEvent("bedrock.status", { ...raw, source: "PAPER" }, now), /source/);
  const log = { capturedAt, source: "DOCKER_ENGINE", available: true, recentWindow: true };
  assert.throws(() => bedrockEvent("bedrock.logs", { ...log, lines: [
    { capturedAt, stream: "combined", content: "\u001b[31m", truncated: false },
  ] }, now), /console line/);
  assert.throws(() => bedrockEvent("bedrock.logs", { ...log, lines: Array(41).fill(null) }, now), /bounded/);
});

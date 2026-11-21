import { test } from "node:test";
import assert from "node:assert/strict";
import { instanceEdition, bedrockContainerMetrics } from "../src/ui/bedrock/edition";

test("Bedrock edition requires explicit advertisement; names do not infer it", () => {
  assert.equal(instanceEdition({ edition: "BEDROCK", serverName: "Survival" }), "BEDROCK");
  assert.equal(instanceEdition({ serverName: "Bedrock", pluginVersion: "" }), "UNKNOWN");
  assert.equal(instanceEdition({ edition: "MODDED", pluginVersion: "5.0.0" }), "UNKNOWN");
  assert.equal(instanceEdition(null), "UNKNOWN");
});
test("legacy Paper remains Java and explicit Paper is supported", () => {
  assert.equal(instanceEdition({ pluginVersion: "5.0.0" }), "JAVA_PAPER");
  assert.equal(instanceEdition({ edition: "PAPER" }), "JAVA_PAPER");
  assert.equal(instanceEdition({ edition: "JAVA_PAPER" }), "JAVA_PAPER");
});
test("fresh Docker measurements are distinct from JVM/host metrics", () => {
  const now = Date.parse("2026-11-21T23:00:00Z");
  assert.deepEqual(bedrockContainerMetrics({
    containerStatsCapturedAt: new Date(now - 1_000).toISOString(),
    containerCpuPercent: 106.5,
    containerMemoryBytes: 750_000_000,
    jvmHeapUsedBytes: 1024,
  }, now), { cpuPercent: 106.5, memoryBytes: 750_000_000 });
});
test("missing, stale, future and invalid telemetry stays unavailable", () => {
  const now = 200_000;
  const empty = { cpuPercent: null, memoryBytes: null };
  assert.deepEqual(bedrockContainerMetrics({}, now), empty);
  assert.deepEqual(bedrockContainerMetrics({containerStatsCapturedAt: now - 45_000, containerCpuPercent: 5},now),empty);
  assert.deepEqual(bedrockContainerMetrics({containerStatsCapturedAt: now + 60_000, containerCpuPercent: 5},now),empty);
  assert.deepEqual(bedrockContainerMetrics({containerStatsCapturedAt: now, containerCpuPercent: -1, containerMemoryBytes: "5000"},now),empty);
  assert.deepEqual(bedrockContainerMetrics({containerStatsCapturedAt: now, containerCpuPercent: 0, containerMemoryBytes: 0},now),{cpuPercent:0,memoryBytes:0});
});

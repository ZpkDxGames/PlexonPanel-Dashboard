import assert from "node:assert/strict";
import { test } from "node:test";
import { assertNodeTelemetry, assertServiceTelemetry, assertFleetAssociation, fleetReadyFields, fleetTargetCompatible } from "../dist/fleet-association.js";
const fleet = { serverId: "10000000-0000-4000-8000-000000000001", nodeId: "20000000-0000-4000-8000-000000000001", instanceKey: "plexoncraft", serverName: "PlexonCraft" };
const agent = { pluginVersion: "5.0.0", fleet };
test("node telemetry binds source role to authenticated kind and requires the declared node scope", () => {
  const host = { nodeId: fleet.nodeId, processRole: "HOST", metricScope: "NODE" };
  assert.doesNotThrow(() => assertNodeTelemetry(agent, host, "HOST"));
  assert.throws(() => assertNodeTelemetry(agent, host, "PAPER"));
  assert.throws(() => assertNodeTelemetry(agent, { ...host, metricScope: "PROCESS" }, "HOST"));
  assert.doesNotThrow(() => assertNodeTelemetry(agent, { ...host, processRole: "MINECRAFT" }, "PAPER"));
  assert.throws(() => assertNodeTelemetry(agent, { ...host, nodeId: "20000000-0000-4000-8000-000000000002" }, "HOST"));
});
test("service accounting is Host-only and binds the node and service metric contract", () => {
  const body = { nodeId: fleet.nodeId, state: "active", resources: { scope: "MINECRAFT_SERVICE", source: "SYSTEMD_CGROUP", cpuUnit: "PERCENT_OF_ONE_CORE" } };
  assert.doesNotThrow(() => assertServiceTelemetry(agent, body, "HOST"));
  assert.throws(() => assertServiceTelemetry(agent, body, "PAPER"));
  assert.throws(() => assertServiceTelemetry(agent, { ...body, nodeId: "other" }, "HOST"));
  assert.throws(() => assertServiceTelemetry(agent, { ...body, resources: { ...body.resources, scope: "HOST_PROCESS" } }, "HOST"));
  assert.throws(() => assertServiceTelemetry(agent, { ...body, resources: null }, "HOST"));
});
test("legacy Host node/service status remains readable while Paper cannot impersonate systemd", () => {
  const legacy = { pluginVersion: "3.5.0" };
  assert.doesNotThrow(() => assertNodeTelemetry(legacy, { hostCpuPercent: 0 }, "HOST"));
  assert.doesNotThrow(() => assertServiceTelemetry(legacy, { state: "active" }, "HOST"));
  assert.throws(() => assertServiceTelemetry(legacy, { state: "active" }, "PAPER"));
});

test("fleet controls require exact 5.0 association while legacy rooms remain compatible", () => {
  const legacy = { pluginVersion: "3.5.0" };
  assert.equal(fleetTargetCompatible("HOST", legacy, legacy), true);
  assert.equal(fleetTargetCompatible("PAPER", agent, legacy), true);
  assert.equal(fleetTargetCompatible("HOST", agent, legacy), false);
  assert.equal(fleetTargetCompatible("PAPER", legacy, agent), false);
  assert.equal(fleetTargetCompatible("HOST", legacy, agent), false);
  assert.equal(fleetTargetCompatible("HOST", agent, agent), true);
  assert.equal(fleetTargetCompatible("HOST", agent, { ...agent, fleet: { ...fleet, nodeId: "other" } }), false);
  assert.equal(fleetReadyFields(agent, legacy).hostTargetCompatible, false);
  assert.throws(() => assertFleetAssociation(legacy, undefined, agent));
  assert.throws(() => assertFleetAssociation({ ...legacy, fleet }, agent, undefined));
  assert.doesNotThrow(() => assertFleetAssociation(agent, undefined, legacy));
});

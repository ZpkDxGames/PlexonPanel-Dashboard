import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyControlMessage,
  emptyControlState,
} from "../src/adapter/control-state";
import { FLEET_CONTRACT_ID } from "../src/adapter/fleet-contract";
import { ACTION_CONTRACT_ID } from "../src/adapter/scopes";
import {
  bedrockContainerView,
  bedrockLogsView,
} from "../src/ui/bedrock/edition";

const serverId = "2ecf5939-87b2-4d39-ad3e-01a69cdd72b9";
const nodeId = "1bcf5939-87b2-4d39-ad3e-01a69cdd72ba";
const otherId = "0acf5939-87b2-4d39-ad3e-01a69cdd72ba";
const scopes = ["server.status", "console.view.full"];
const hostCapabilities = Object.fromEntries(
  scopes.map((scope) => [scope, true]),
);
const ready = {
  type: "dashboard.ready",
  protocolVersion: 3,
  actionContract: ACTION_CONTRACT_ID,
  version: "bedrock-host-v1",
  serverId,
  device: { deviceId: "fixture-browser", role: "Owner", scopes },
  agents: { paper: false, host: true, hostInstalled: true },
  server: {
    serverId,
    bedrockContract: "bedrock-host-v1",
    edition: "BEDROCK",
    roomMode: "HOST_ONLY",
    runtime: "DOCKER",
    fleetContract: FLEET_CONTRACT_ID,
    instanceKey: "tonimbedrock",
    nodeId,
    serverName: "TonimBedrock",
    hostSession: "this-host",
    hostCapabilities,
  },
};

function event(
  eventType: string,
  body: Record<string, unknown> = {},
  at = Date.now(),
) {
  return {
    type: "server.event",
    agentSession: "this-host",
    agentKind: "HOST",
    eventType,
    serverId,
    body: {
      capturedAt: new Date(at).toISOString(),
      bedrockContract: "bedrock-host-v1",
      edition: "BEDROCK",
      runtime: "DOCKER",
      source: "DOCKER_ENGINE",
      nodeId,
      instanceKey: "tonimbedrock",
      ...body,
    },
  };
}
function status(at: number) {
  return event(
    "bedrock.status",
    {
      containerState: "running",
      containerStartedAt: new Date(at - 5_000).toISOString(),
      containerUptimeSeconds: 5,
      cpuUnit: "PERCENT_OF_ONE_CORE",
      containerCpuPercent: 125.6,
      containerMemoryBytes: 512,
      containerMemoryLimitBytes: 1_024,
      containerStatsCapturedAt: new Date(at).toISOString(),
      version: "1.26.66.1",
      versionCapturedAt: new Date(at - 4_000).toISOString(),
    },
    at,
  );
}

test("Bedrock requires explicit host-only fleet identity and cannot be rebound to a second node or Paper", () => {
  const empty = emptyControlState(serverId);
  for (const invalid of [
    { ...ready, actionContract: undefined },
    { ...ready, server: { ...ready.server, nodeId: "invalid" } },
    { ...ready, server: { ...ready.server, fleetContract: "invalid" } },
    { ...ready, server: { ...ready.server, hostSession: "" } },
    { ...ready, server: { ...ready.server, roomMode: undefined } },
    { ...ready, agents: { ...ready.agents, paper: true } },
    { ...ready, serverId: otherId },
  ])
    assert.equal(applyControlMessage(empty, invalid), empty);
  const room = applyControlMessage(empty, ready);
  assert.equal(room.bedrock?.identity.nodeId, nodeId);
  assert.equal(
    applyControlMessage(room, {
      ...ready,
      server: { ...ready.server, nodeId: otherId },
    }),
    room,
  );
  assert.equal(
    applyControlMessage(room, { ...ready, server: { pluginVersion: "5.0.0" } }),
    room,
  );
});

test("Bedrock evidence requires the current room, Host session, capability, and scope", () => {
  const now = Date.now();
  const empty = emptyControlState(serverId);
  const sample = status(now);
  assert.equal(applyControlMessage(empty, sample), empty);
  const room = applyControlMessage(empty, ready);
  for (const invalid of [
    { ...sample, agentKind: "PAPER" },
    { ...sample, agentSession: "old-host" },
    { ...sample, serverId: otherId },
    { ...sample, body: { ...sample.body, nodeId: otherId } },
    { ...sample, body: { ...sample.body, source: "SYSTEMD_CGROUP" } },
    { ...sample, body: { ...sample.body, bedrockContract: "future" } },
    {
      ...sample,
      body: {
        ...sample.body,
        capturedAt: new Date(now + 20_000).toISOString(),
      },
    },
  ])
    assert.equal(applyControlMessage(room, invalid), room);

  for (const unavailable of [
    { ...ready, device: { ...ready.device, scopes: ["console.view.full"] } },
    { ...ready, server: { ...ready.server, hostCapabilities: {} } },
    { ...ready, agents: { ...ready.agents, host: false } },
  ]) {
    const denied = applyControlMessage(room, unavailable);
    assert.equal(applyControlMessage(denied, sample), denied);
  }
  const updated = applyControlMessage(room, sample);
  assert.equal(updated.bedrock?.status?.containerState, "running");
  assert.equal(updated.bedrock?.status?.gameplayReady, null);
  assert.deepEqual(updated.server, {});
  assert.deepEqual(updated.service, {});
  assert.equal(applyControlMessage(updated, sample), updated);
  assert.equal(
    applyControlMessage(updated, { ...sample, eventType: "telemetry.server" }),
    updated,
  );
  const container = bedrockContainerView(updated.bedrock, true, now);
  assert.equal(container.cpuPercent, 125.6);
  assert.equal(container.uptimeMs, 5_000);
  assert.equal(container.version, "1.26.66.1");
  assert.equal(
    bedrockContainerView(updated.bedrock, true, now + 30_001).state,
    null,
  );
  assert.equal(
    bedrockContainerView(updated.bedrock, false, now).cpuPercent,
    null,
  );
  assert.equal(
    applyControlMessage(updated, {
      ...ready,
      server: { ...ready.server, hostSession: "next-host" },
    }).bedrock?.status,
    undefined,
  );
});

test("Docker log windows reject terminal controls and clear on unavailability, disconnection, and expiry", () => {
  const now = Date.now();
  const room = applyControlMessage(emptyControlState(serverId), ready);
  const timestamp = new Date(now - 1_000).toISOString();
  const logs = event(
    "bedrock.logs",
    {
      available: true,
      recentWindow: true,
      lines: [
        {
          id: "unicode",
          timestamp,
          content: "日本語 <script>literal only</script>",
        },
        { id: "escape", timestamp, content: "\u001b[31munsafe" },
        { id: "unicode", timestamp, content: "duplicate" },
      ],
    },
    now,
  );
  const updated = applyControlMessage(room, logs);
  assert.deepEqual(
    bedrockLogsView(updated.bedrock, true, now)?.lines.map(({ id }) => id),
    ["unicode"],
  );
  assert.equal(bedrockLogsView(updated.bedrock, false, now), null);
  assert.equal(bedrockLogsView(updated.bedrock, true, now + 30_001), null);
  assert.equal(
    applyControlMessage(updated, {
      ...ready,
      agents: { ...ready.agents, host: false },
    }).bedrock?.logs,
    undefined,
  );
  const unavailable = applyControlMessage(
    updated,
    event(
      "bedrock.logs",
      {
        available: false,
        recentWindow: true,
        lines: [],
      },
      now + 1,
    ),
  );
  assert.deepEqual(unavailable.bedrock?.logs?.lines, []);
  assert.equal(unavailable.bedrock?.logs?.available, false);
});

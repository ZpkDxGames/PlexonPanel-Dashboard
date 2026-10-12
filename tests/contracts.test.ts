import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bindLiveSocket,
  unbindLiveSocket,
  captureActionTarget,
  sendDashboardAction,
  handleRelayControlMessage,
  liveConnectionGrantFromSession,
  ActionError,
} from "../src/adapter/data-source";
import { ACTION_CONTRACT_ID, SCOPES } from "../src/adapter/scopes";
import { resolveActionAuthority } from "../src/adapter/authority";
import { reconcileDeviceGrant } from "../src/adapter/device-grant";
import {
  applyControlMessage,
  emptyControlState,
  number,
} from "../src/adapter/control-state";
import { makeFixture } from "../src/development/fixtures";
class Socket {
  readyState = 1;
  sent: Record<string, unknown>[] = [];
  send(value: string) {
    this.sent.push(JSON.parse(value));
  }
}
(globalThis as unknown as { WebSocket: { OPEN: number } }).WebSocket = {
  OPEN: 1,
};
const context = { authorization: "grant", PAPER: "paper1", HOST: "host1" };
test("grant validation enforces server, protocol, device, expiry and scope identity", () => {
  const c = {
    serverId: "a",
    deviceId: "d",
    accessToken: "secret-test",
    websocketUrl: "wss://relay.example/v1/dashboard",
  };
  const valid = {
    ok: true,
    protocolVersion: 3,
    actionContract: ACTION_CONTRACT_ID,
    serverId: "a",
    deviceId: "d",
    role: "Owner",
    scopes: ["server.restart"],
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  };
  assert.equal(liveConnectionGrantFromSession(valid, c).serverId, "a");
  for (const patch of [
    { serverId: "b" },
    { deviceId: "x" },
    { protocolVersion: 2 },
    { scopes: ["invented.scope"] },
    { expiresAt: "2001-01-01" },
    { actionContract: "other" },
  ])
    assert.throws(() =>
      liveConnectionGrantFromSession({ ...valid, ...patch }, c),
    );
});
test("effective authority intersects signed and reported grants", () => {
  const signed = {
    deviceId: "d",
    role: "Owner",
    scopes: ["server.restart", "players.view"],
  };
  assert.deepEqual(
    reconcileDeviceGrant(signed, { ...signed, scopes: ["players.view"] })
      ?.scopes,
    ["players.view"],
  );
  assert.deepEqual(
    reconcileDeviceGrant(signed, { ...signed, role: "Viewer" })?.scopes,
    [],
  );
  assert.equal(
    resolveActionAuthority({
      action: "server.restart",
      grant: { ...signed, metadataMatches: true },
      capabilities: { "server.restart": false },
    }).state,
    "unsupported",
  );
});
test("queued acknowledgement is not completion; only bound result resolves", async () => {
  const socket = new Socket();
  bindLiveSocket(socket as unknown as WebSocket, "a", context);
  const target = captureActionTarget("a", "HOST");
  const promise = sendDashboardAction("server.restart", {}, "HOST", target);
  const requestId = String(socket.sent[0].requestId);
  let done = false;
  promise.then(() => {
    done = true;
  });
  handleRelayControlMessage(
    { type: "dashboard.action_queued", serverId: "a", requestId },
    socket as unknown as WebSocket,
  );
  await Promise.resolve();
  assert.equal(done, false);
  handleRelayControlMessage(
    {
      type: "server.event",
      serverId: "b",
      agentKind: "HOST",
      eventType: "action.result",
      body: {
        requestId,
        action: "server.restart",
        status: "SUCCESS",
        code: "OK",
        data: {},
      },
    },
    socket as unknown as WebSocket,
  );
  await Promise.resolve();
  assert.equal(done, false);
  handleRelayControlMessage(
    {
      type: "server.event",
      serverId: "a",
      agentKind: "HOST",
      eventType: "action.result",
      body: {
        requestId,
        action: "server.restart",
        status: "SUCCESS",
        code: "OK",
        data: {},
      },
    },
    socket as unknown as WebSocket,
  );
  assert.equal((await promise).status, "SUCCESS");
  unbindLiveSocket(socket as unknown as WebSocket);
});
test("scope switch invalidates prepared targets and pending operation; no resend", async () => {
  const socket = new Socket();
  bindLiveSocket(socket as unknown as WebSocket, "a", context);
  const target = captureActionTarget("a", "PAPER");
  const promise = sendDashboardAction(
    "player.kick",
    { playerId: "uuid" },
    "PAPER",
    target,
  );
  const rejects = assert.rejects(promise, /changed|closed|authorization/i);
  bindLiveSocket(socket as unknown as WebSocket, "a", {
    ...context,
    PAPER: "paper2",
  });
  await rejects;
  await assert.rejects(
    sendDashboardAction("player.kick", {}, "PAPER", target),
    /changed/,
  );
  assert.equal(socket.sent.length, 1);
  unbindLiveSocket(socket as unknown as WebSocket);
});
test("agent denial preserves code, scope and execution boundary", async () => {
  const socket = new Socket();
  bindLiveSocket(socket as unknown as WebSocket, "a", context);
  const promise = sendDashboardAction(
    "server.stop",
    {},
    "HOST",
    captureActionTarget("a", "HOST"),
  );
  const id = socket.sent[0].requestId;
  const rejected = assert.rejects(
    promise,
    (e: unknown) =>
      e instanceof ActionError &&
      e.code === "SCOPE_DENIED" &&
      e.data.requiredScope === "server.stop",
  );
  handleRelayControlMessage(
    {
      type: "dashboard.action_rejected",
      serverId: "a",
      requestId: id,
      action: "server.stop",
      status: "DENIED",
      code: "SCOPE_DENIED",
    },
    socket as unknown as WebSocket,
  );
  await rejected;
  unbindLiveSocket(socket as unknown as WebSocket);
});
test("missing differs from zero; cross-server and superseded sessions are discarded", () => {
  assert.equal(number(undefined), null);
  assert.equal(number(0), 0);
  const state = makeFixture();
  assert.equal(
    applyControlMessage(state, {
      type: "server.event",
      serverId: "other",
      eventType: "telemetry.server",
      body: { tps: [0] },
    }),
    state,
  );
  assert.equal(
    applyControlMessage(state, {
      type: "server.event",
      serverId: state.serverId,
      agentKind: "PAPER",
      agentSession: "old",
      eventType: "telemetry.server",
      body: { capturedAt: new Date().toISOString(), tps: [0] },
    }),
    state,
  );
});
test("new Paper session clears roster and receipts, Host online survives stopped Paper", () => {
  const state = makeFixture();
  const next = applyControlMessage(state, {
    ...state.ready,
    type: "dashboard.ready",
    server: { ...state.ready!.server, paperSession: "new" },
    agents: { paper: false, host: true, hostInstalled: true },
  });
  assert.equal(next.players.length, 0);
  assert.equal(next.receipts?.paperHealth, undefined);
  assert.equal(next.ready?.agents.host, true);
  assert.equal(next.server.tps, undefined);
});
test("console batches are stamped with browser receipt time", () => {
  const state = makeFixture();
  const before = Date.now();
  const next = applyControlMessage(state, {
    type: "server.event",
    serverId: state.serverId,
    agentKind: "HOST",
    agentSession: "fixture-host",
    eventType: "console.lines",
    body: {
      lines: [
        {
          capturedAt: new Date(0).toISOString(),
          level: "INFO",
          source: "HOST_JOURNAL",
          content: "receipt evidence",
          journalCursor: "s=receipt;i=1",
        },
      ],
    },
  });
  assert.equal(typeof next.console.at(-1)?.receivedAt, "number");
  assert.ok((next.console.at(-1)?.receivedAt as number) >= before);
});
test("control histories and high-rate console are bounded", () => {
  let state = makeFixture();
  for (let i = 0; i < 40; i++) {
    state = applyControlMessage(state, {
      type: "server.event",
      serverId: state.serverId,
      agentKind: "HOST",
      agentSession: "fixture-host",
      eventType: "console.lines",
      body: {
        lines: Array.from({ length: 100 }, (_, j) => ({
          streamSession: "journal",
          sourceSequence: i * 100 + j,
          capturedAt: new Date().toISOString(),
          content: `line ${i * 100 + j}`,
        })),
      },
    });
  }
  assert.equal(state.console.length, 2500);
  assert.ok(state.history.length <= 8192);
});
import { projectHistory } from "../src/adapter/history";
test("independent captures keep placement; missing timestamps never become chart samples", () => {
  const fixture = makeFixture();
  const sample = fixture.history[0];
  const samePaper = { ...sample, at: sample.at + 5000, hostCpu: 90 };
  const missing = {
    ...sample,
    at: sample.at + 10000,
    sources: {
      paperHealth: null,
      paperSystem: null,
      hostSystem: sample.at + 10000,
      service: null,
    },
  };
  const projected = projectHistory([sample, samePaper, missing], "paperHealth");
  assert.equal(projected.length, 1);
  assert.equal(projected[0].at, sample.sources!.paperHealth);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  ActionError,
  DashboardRequestError,
  bindLiveSocket,
  handleRelayControlMessage,
  liveConnectionGrantFromSession,
  sendDashboardAction,
} from "../.test-dist/lib/data-source.js";
import { operationMessage } from "../.test-dist/lib/operation-messages.js";

class FakeSocket {
  readyState = 1;
  sent = [];
  send(text) { this.sent.push(JSON.parse(text)); }
  close() {}
}

const credential = {
  serverId: "8f41205c-94ac-4bb5-95f2-af97efcdbb29",
  deviceId: "9d17a4fa-7f54-4831-8bd1-e05269b1c6f8",
  accessToken: "signed-token",
  websocketUrl: "wss://relay.example/v1/dashboard",
};

test("verified legacy session payload keeps signed claims without requiring deviceId", () => {
  const grant = liveConnectionGrantFromSession(
    {
      ok: true,
      protocolVersion: 3,
      serverId: credential.serverId,
      role: "Owner",
      scopes: ["maintenance.view", "maintenance.run"],
      expiresAt: "2030-01-01T00:00:00.000Z",
    },
    credential,
    Date.parse("2029-01-01T00:00:00.000Z"),
  );

  assert.deepEqual(grant, {
    serverId: credential.serverId,
    deviceId: credential.deviceId,
    role: "Owner",
    scopes: ["maintenance.view", "maintenance.run"],
    token: credential.accessToken,
    websocketUrl: credential.websocketUrl,
    expiresAt: "2030-01-01T00:00:00.000Z",
  });
});

test("invalid signed session contract reports the safe field without deleting credentials", () => {
  assert.throws(
    () =>
      liveConnectionGrantFromSession(
        {
          ok: true,
          protocolVersion: 3,
          serverId: credential.serverId,
          deviceId: credential.deviceId,
          role: "Owner",
          scopes: ["not-a-real-scope"],
          expiresAt: "2030-01-01T00:00:00.000Z",
        },
        credential,
        Date.parse("2029-01-01T00:00:00.000Z"),
      ),
    (error) => {
      assert.ok(error instanceof DashboardRequestError);
      assert.equal(error.status, 502);
      assert.match(error.message, /\(scopes\)/);
      return true;
    },
  );
});

test("relay SCOPE_DENIED preserves boundary, action, scope, agent and request ID", async () => {
  const previousWebSocket = globalThis.WebSocket;
  globalThis.WebSocket = { OPEN: 1, CLOSING: 2 };
  const socket = new FakeSocket();
  bindLiveSocket(socket);
  try {
    const completion = sendDashboardAction("backup.preflight", {}, "HOST");
    const request = socket.sent.at(-1);
    assert.equal(request.action, "backup.preflight");

    assert.equal(
      handleRelayControlMessage({
        type: "dashboard.action_rejected",
        requestId: request.requestId,
        code: "SCOPE_DENIED",
        error: "Your device does not have this scope.",
      }),
      true,
    );

    await assert.rejects(completion, (error) => {
      assert.ok(error instanceof ActionError);
      assert.equal(error.action, "backup.preflight");
      assert.equal(error.data.rejectionBoundary, "RELAY_SCOPE");
      assert.equal(error.data.requiredScope, "backup.view");
      assert.equal(error.data.agentKind, "HOST");
      const rendered = operationMessage(error);
      assert.match(rendered.detail, /Boundary: RELAY_SCOPE/);
      assert.match(rendered.detail, /Scope: backup\.view/);
      assert.match(rendered.detail, new RegExp(`Request: ${request.requestId}`));
      return true;
    });
  } finally {
    bindLiveSocket(null);
    globalThis.WebSocket = previousWebSocket;
  }
});

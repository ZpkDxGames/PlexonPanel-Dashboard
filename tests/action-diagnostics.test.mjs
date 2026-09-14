import assert from "node:assert/strict";
import test from "node:test";
import {
  ActionError,
  bindLiveSocket,
  handleRelayControlMessage,
  sendDashboardAction,
} from "../.test-dist/lib/data-source.js";
import { operationMessage } from "../.test-dist/lib/operation-messages.js";

class FakeSocket {
  readyState = 1;
  sent = [];
  send(text) { this.sent.push(JSON.parse(text)); }
  close() {}
}

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

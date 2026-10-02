import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  bindLiveSocket,
  sendDashboardAction,
  handleRelayControlMessage,
  unbindLiveSocket,
  captureActionTarget,
} from "../.test-dist/lib/data-source.js";
class TestSocket {
  static OPEN = 1;
  readyState = 1;
  sent = [];
  send(s) {
    this.sent.push(JSON.parse(s));
  }
}
globalThis.WebSocket = TestSocket;
afterEach(() => bindLiveSocket(null));

test("confirmation captured for Server A cannot send on Server B after an asynchronous switch", async () => {
  const a = new TestSocket();
  const b = new TestSocket();
  bindLiveSocket(a, "server-a", "paper-session-a");
  const confirmation = captureActionTarget("server-a");
  await Promise.resolve(); // Simulate the operator reviewing an open dialog.
  bindLiveSocket(b, "server-b", "paper-session-b");
  await assert.rejects(sendDashboardAction("server.stop", { confirmed: true }, "HOST", confirmation), /connection changed/);
  assert.equal(a.sent.length, 0);
  assert.equal(b.sent.length, 0);
  assert.throws(() => captureActionTarget("server-a"), /selected server connection changed/);
});

test("a confirmation cannot survive agent or grant replacement on the same Dashboard socket", async () => {
  const socket = new TestSocket();
  bindLiveSocket(socket, "server-a", "host-session-one");
  const confirmation = captureActionTarget("server-a");
  bindLiveSocket(socket, "server-a", "host-session-two");
  await assert.rejects(sendDashboardAction("server.restart", { confirmed: true }, "HOST", confirmation), /connection changed/);
  assert.equal(socket.sent.length, 0);
});

test("action completion must match the original server, socket, action and source authority", async () => {
  const a = new TestSocket();
  const b = new TestSocket();
  bindLiveSocket(a, "server-a", "live-a");
  let completed = false;
  const completion = sendDashboardAction("server.stop", {}, "HOST", captureActionTarget("server-a"))
    .then((value) => { completed = true; return value; });
  const result = { type: "server.event", serverId: "server-a", agentKind: "HOST", eventType: "action.result",
    body: { requestId: a.sent[0].requestId, action: "server.stop", status: "SUCCESS", data: {} } };
  for (const [message, socket] of [
    [{ ...result, serverId: "server-b" }, a],
    [result, b],
    [{ ...result, agentKind: "PAPER" }, a],
    [{ ...result, body: { ...result.body, action: "server.start" } }, a],
  ]) {
    handleRelayControlMessage(message, socket);
    await Promise.resolve();
    assert.equal(completed, false);
  }
  handleRelayControlMessage(result, a);
  await completion;
  assert.equal(completed, true);
});

test("legacy relay rejection without a server field is accepted only from its original bound socket", async () => {
  const a = new TestSocket();
  bindLiveSocket(a, "server-a", "legacy-a");
  const completion = sendDashboardAction("server.stop", {}, "HOST");
  const rejection = { type: "dashboard.action_rejected", requestId: a.sent[0].requestId,
    action: "server.stop", code: "SCOPE_DENIED", error: "Denied" };
  handleRelayControlMessage(rejection, new TestSocket());
  handleRelayControlMessage(rejection); // Missing server and missing source cannot resolve it.
  handleRelayControlMessage(rejection, a);
  await assert.rejects(completion, (error) => error.code === "SCOPE_DENIED");
});

test("relay queue acknowledgement never reports an operation completed", async () => {
  const ws = new TestSocket();
  bindLiveSocket(ws);
  let completed = false;
  const promise = sendDashboardAction("files.write", {
    path: "config.yml",
  }).then((r) => {
    completed = true;
    return r;
  });
  const request = ws.sent[0];
  handleRelayControlMessage({
    type: "dashboard.action_queued",
    requestId: request.requestId,
  });
  await Promise.resolve();
  assert.equal(completed, false);
  handleRelayControlMessage({
    type: "server.event",
    eventType: "action.result",
    body: {
      requestId: request.requestId,
      action: "files.write",
      status: "SUCCESS",
      data: { sha256: "hash" },
    },
  });
  assert.equal((await promise).data.sha256, "hash");
});
test("file conflicts reject with structured status so unsaved edits can be retained", async () => {
  const ws = new TestSocket();
  bindLiveSocket(ws);
  const p = sendDashboardAction("files.write", {});
  handleRelayControlMessage({
    type: "server.event",
    eventType: "action.result",
    body: {
      requestId: ws.sent[0].requestId,
      status: "CONFLICT",
      code: "STALE_FILE",
      message: "Reload and review edits",
    },
  });
  await assert.rejects(
    p,
    (e) => e.status === "CONFLICT" && e.code === "STALE_FILE",
  );
});
test("disconnect rejects uncertain completion and never replays the command", async () => {
  const first = new TestSocket();
  bindLiveSocket(first);
  const promise = sendDashboardAction("console.execute", { command: "tps" });
  const second = new TestSocket();
  bindLiveSocket(second);
  await assert.rejects(promise, /will not be resent/);
  assert.equal(second.sent.length, 0);
});
test("a stale socket cannot unbind the current authorized connection", async () => {
  const stale = new TestSocket();
  const current = new TestSocket();
  bindLiveSocket(stale);
  bindLiveSocket(current);
  assert.equal(unbindLiveSocket(stale), false);
  const promise = sendDashboardAction("files.write", { path: "config.yml" });
  assert.equal(stale.sent.length, 0);
  assert.equal(current.sent.length, 1);
  const request = current.sent[0];
  handleRelayControlMessage({
    type: "server.event",
    eventType: "action.result",
    body: {
      requestId: request.requestId,
      action: "files.write",
      status: "SUCCESS",
      data: {},
    },
  });
  await promise;
});

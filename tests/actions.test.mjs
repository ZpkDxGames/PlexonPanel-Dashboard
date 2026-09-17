import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  bindLiveSocket,
  sendDashboardAction,
  handleRelayControlMessage,
  unbindLiveSocket,
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

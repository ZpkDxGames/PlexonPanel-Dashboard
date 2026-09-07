import { test } from "node:test";
import assert from "node:assert/strict";
import {
  capturePresenceHistoryMessage,
  clearActivityHistory,
  listActivityHistoryServers,
  loadActivityHistory,
} from "../.test-dist/lib/activity-history.js";

function fakeBrowser() {
  const values = new Map();
  const localStorage = {
    get length() {
      return values.size;
    },
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
  };
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  globalThis.CustomEvent = class {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  };
  globalThis.window = {
    localStorage,
    dispatchEvent() {},
    addEventListener() {},
    removeEventListener() {},
  };
  return () => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousCustomEvent === undefined) delete globalThis.CustomEvent;
    else globalThis.CustomEvent = previousCustomEvent;
  };
}

function presence(overrides = {}) {
  return {
    type: "server.event",
    serverId: "server-a",
    agentKind: "PAPER",
    eventType: "players.presence",
    body: {
      eventId: "event-1",
      sessionId: "session-1",
      uuid: "11111111-1111-1111-1111-111111111111",
      name: "Alex",
      state: "JOINED",
      observedAt: "2026-09-07T20:00:00.000Z",
    },
    ...overrides,
  };
}

test("presence history is browser-local, server-scoped and deduplicated", () => {
  const restore = fakeBrowser();
  try {
    capturePresenceHistoryMessage(presence());
    capturePresenceHistoryMessage(presence());
    capturePresenceHistoryMessage(
      presence({
        serverId: "server-b",
        body: {
          ...presence().body,
          eventId: "event-2",
          state: "LEFT",
          observedAt: "2026-09-07T20:05:00.000Z",
        },
      }),
    );

    assert.equal(loadActivityHistory("server-a").length, 1);
    assert.equal(loadActivityHistory("server-a")[0].state, "JOINED");
    assert.equal(loadActivityHistory("server-b").length, 1);
    assert.deepEqual(listActivityHistoryServers(), ["server-a", "server-b"]);

    clearActivityHistory("server-a");
    assert.equal(loadActivityHistory("server-a").length, 0);
    assert.deepEqual(listActivityHistoryServers(), ["server-b"]);
  } finally {
    restore();
  }
});

test("invalid or host presence messages are not persisted", () => {
  const restore = fakeBrowser();
  try {
    capturePresenceHistoryMessage(presence({ agentKind: "HOST" }));
    capturePresenceHistoryMessage(
      presence({ body: { ...presence().body, observedAt: "not-a-date" } }),
    );
    capturePresenceHistoryMessage({ type: "server.event", eventType: "players.presence" });
    assert.deepEqual(listActivityHistoryServers(), []);
  } finally {
    restore();
  }
});

test("presence history follows the active Paper agent session", () => {
  const restore = fakeBrowser();
  try {
    capturePresenceHistoryMessage({
      type: "dashboard.ready",
      protocolVersion: 3,
      serverId: "server-session-test",
      server: { paperSession: "paper-session-current" },
    });

    capturePresenceHistoryMessage(
      presence({
        serverId: "server-session-test",
        agentSession: "paper-session-stale",
        body: {
          ...presence().body,
          eventId: "stale-event",
        },
      }),
    );
    assert.equal(loadActivityHistory("server-session-test").length, 0);

    capturePresenceHistoryMessage(
      presence({
        serverId: "server-session-test",
        agentSession: "paper-session-current",
        body: {
          ...presence().body,
          eventId: "current-event",
          observedAt: "2026-09-07T20:10:00.000Z",
        },
      }),
    );
    assert.equal(loadActivityHistory("server-session-test").length, 1);
    assert.equal(
      loadActivityHistory("server-session-test")[0].eventId,
      "current-event",
    );
  } finally {
    restore();
  }
});

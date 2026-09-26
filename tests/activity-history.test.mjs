import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  clearActivityHistory, listActivityHistoryServers, loadActivityHistory,
} from "../.test-dist/lib/activity-history.js";
import {
  activityPage, activityParameters, liveActivity, observation,
} from "../.test-dist/lib/durable-activity.js";

function fakeBrowser() {
  const values = new Map();
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  globalThis.CustomEvent = class {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
  };
  globalThis.window = {
    localStorage: {
      get length() { return values.size; },
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
      key: (index) => [...values.keys()][index] ?? null,
    },
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

const row = (id, state = "JOINED", observedAt = "2026-09-26T18:00:00Z") => ({
  eventId: id, uuid: "11111111-1111-1111-1111-111111111111",
  name: "Alex", state, observedAt, termination: "NORMAL",
});
const filters = { query: "", status: "ALL", from: "", to: "" };

test("legacy browser archive remains read-only, isolated and unverified", () => {
  const restore = fakeBrowser();
  try {
    window.localStorage.setItem("plexonpanel.activity-history.v1:server-a",
      JSON.stringify([{ ...row("a"), recordedAt: Date.now() }]));
    assert.equal(loadActivityHistory("server-a")[0].eventId, "a");
    assert.deepEqual(listActivityHistoryServers(), ["server-a"]);
    assert.deepEqual(loadActivityHistory("server-b"), []);
    clearActivityHistory("server-a");
    assert.deepEqual(listActivityHistoryServers(), []);
  } finally { restore(); }
});

test("display cadence cannot persist live presence to the legacy archive", async () => {
  const source = await readFile(new URL("../lib/display-cadence.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /activity-history|localStorage|capturePresence/);
  const legacy = await readFile(new URL("../lib/activity-history.ts", import.meta.url), "utf8");
  assert.doesNotMatch(legacy, /setItem\(|capturePresenceHistoryMessage/);
});

test("server-side filters use bounded Paper parameters and opaque cursors", () => {
  assert.deepEqual(activityParameters({ query: " alex ", status: "OFFLINE", from: "", to: "" }, "opaque"), {
    query: "alex", status: "OFFLINE", limit: 50, cursor: "opaque",
  });
});

test("a live duplicate is replaced by the journal record; pages never mix", () => {
  const now = Date.parse("2026-09-26T18:01:00Z");
  const live = liveActivity([row("a"), row("a"), row("b", "LEFT")], filters, now);
  assert.equal(live.length, 2);
  const durable = [observation(row("a"), true)].filter(Boolean);
  const first = activityPage(durable, live, true);
  assert.equal(first.length, 2);
  assert.equal(first.find((entry) => entry.eventId === "a").durable, true);
  assert.deepEqual(activityPage(durable, live, false).map((entry) => entry.eventId), ["a"]);
  assert.equal(liveActivity([row("old", "JOINED", "2026-09-26T10:00:00Z")], filters, now).length, 0);
});

test("live filters reject malformed rows and do not invent a leave", () => {
  const now = Date.parse("2026-09-26T18:01:00Z");
  const result = liveActivity([row("a"), { ...row("bad"), observedAt: "invalid" }],
    { ...filters, status: "OFFLINE" }, now);
  assert.deepEqual(result, []);
});

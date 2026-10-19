import test from "node:test";
import { scopedSnapshot, type SessionSnapshot } from "../src/ui/bindings";
import { makeFixture } from "../src/development/fixtures";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  DEFAULT_VIEW,
  VIEW_SYNC_KEY,
  validateViewSync,
  updateViewSync,
  getViewSyncSnapshot,
  subscribeViewSync,
  useViewSync,
} from "../src/ui/bindings/view-sync";
import {
  withAppliedSkins,
  skinCandidates,
  skinProxyTargets,
  isOfflineUuid,
  validTexture,
  validUuid,
  validUsername,
} from "../src/ui/bindings/skins";
import {
  adaptiveMsptMax,
  stageBounds,
  scaleInStage,
  gapLabelPositions,
} from "../src/ui/studio/stages";
import { GET } from "../app/api/skins/[uuid]/route";
const offline = "b50ad385-829d-3141-a216-7e7d7539ba7f",
  online = "8667ba71-b85a-4004-af54-457a9734eed7",
  hash = "a".repeat(64);
test("view choices are whitelisted and reject malformed or content-bearing payloads", () => {
  assert.deepEqual(validateViewSync(null), DEFAULT_VIEW);
  assert.deepEqual(
    validateViewSync({
      horizon: "bad",
      ideWrap: "false",
      backupCountdownMinutes: 7,
      activeSeries: "secret command",
      idePlugin: "x".repeat(129),
    }),
    DEFAULT_VIEW,
  );
  const state = validateViewSync({
    horizon: "2h",
    studioView: "cpu",
    idePane: "chat",
    rosterScope: "all",
    backupCountdownMinutes: 30,
    idePlugin: "LuckPerms",
    lines: ["secret"],
    history: ["secret"],
  });
  assert.equal(state.horizon, "2h");
  assert.equal(state.idePlugin, "LuckPerms");
  assert.equal(state.backupCountdownMinutes, 30);
  assert.equal(Object.keys(state).length, 14);
  assert.ok(!JSON.stringify(state).includes("secret"));
  assert.ok(!/console|chat/i.test(VIEW_SYNC_KEY));
});
test("view store SSR snapshot is stable, hydrates, broadcasts changes, and observes storage clear/cross-tab events", () => {
  function Probe() {
    return React.createElement("span", null, useViewSync().horizon);
  }
  assert.equal(renderToString(React.createElement(Probe)), "<span>15m</span>");
  const original = Object.getOwnPropertyDescriptor(globalThis, "window"),
    entries = new Map<string, string>(),
    handlers = new Map<string, (e: any) => void>();
  const storage = {
    getItem: (k: string) => entries.get(k) ?? null,
    setItem: (k: string, v: string) => entries.set(k, v),
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: storage,
      addEventListener: (k: string, fn: any) => handlers.set(k, fn),
      removeEventListener: (k: string) => handlers.delete(k),
    },
  });
  try {
    entries.set(
      VIEW_SYNC_KEY,
      JSON.stringify({ horizon: "1m", ideWrap: false }),
    );
    let calls = 0;
    const off = subscribeViewSync(() => calls++);
    assert.equal(getViewSyncSnapshot().horizon, "1m");
    assert.equal(getViewSyncSnapshot().ideWrap, false);
    updateViewSync({ studioView: "memory", activeSeries: "heap" });
    assert.equal(JSON.parse(entries.get(VIEW_SYNC_KEY)!).activeSeries, "heap");
    entries.set(
      VIEW_SYNC_KEY,
      JSON.stringify({ horizon: "35m", rosterScope: "all" }),
    );
    handlers.get("storage")!({ key: VIEW_SYNC_KEY, storageArea: storage });
    assert.equal(getViewSyncSnapshot().horizon, "35m");
    assert.equal(getViewSyncSnapshot().rosterScope, "all");
    entries.clear();
    handlers.get("storage")!({ key: null, storageArea: storage });
    assert.deepEqual(getViewSyncSnapshot(), DEFAULT_VIEW);
    assert.equal(calls, 4);
    off();
    assert.equal(handlers.size, 0);
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
test("staged domains magnify sub-millisecond samples, clamp budgets, allocate disjoint lanes and decollide epochs", () => {
  assert.equal(adaptiveMsptMax([0.2, 0.6, null, NaN]), 2);
  assert.equal(adaptiveMsptMax([10, 20]), 27);
  assert.equal(adaptiveMsptMax([1000]), 60);
  const stages = stageBounds(8, 315, [26, 52, 22]);
  assert.equal(stages.length, 3);
  assert.ok(Math.abs((stages[0].bottom - 8) / 307 - 0.26) < 1e-9);
  stages.forEach((b, i) => {
    assert.ok(b.plotTop >= b.top + 8);
    assert.ok(b.plotBottom <= b.bottom - 8);
    assert.equal(scaleInStage(50, 0, 45, b), b.plotTop);
    assert.equal(scaleInStage(-1, 0, 45, b), b.plotBottom);
    if (i) assert.equal(b.top, stages[i - 1].bottom);
  });
  assert.deepEqual(gapLabelPositions([10, 30, 124, 125, 250]), [
    true,
    false,
    false,
    true,
    true,
  ]);
});
test("offline UUIDs and applied textures resolve in the selected provider order with safe identity bounds", () => {
  assert.ok(isOfflineUuid(offline));
  assert.ok(isOfflineUuid(offline.replaceAll("-", "")));
  assert.ok(!isOfflineUuid(online));
  assert.ok(validTexture(hash));
  assert.ok(validTexture("b".repeat(56)));
  assert.ok(!validTexture("b".repeat(65)));
  assert.ok(!validUuid("not-a-uuid"));
  assert.ok(!validUsername("a/b"));
  const base = {
    uuid: offline,
    name: "Notch",
    skinTexture: hash,
    provider: "proxy" as const,
    size: 32,
  };
  const candidates = skinCandidates(base);
  assert.ok(candidates[0].startsWith(`/api/skins/${hash}?`));
  assert.ok(candidates[1].startsWith("/api/skins/Notch?"));
  assert.deepEqual(skinCandidates({ ...base, provider: "disabled" }), []);
  assert.ok(
    skinCandidates({ ...base, provider: "crafatar" }).every(
      (v) => !v.includes("crafatar"),
    ),
  );
  assert.ok(
    skinCandidates({
      ...base,
      uuid: online,
      skinTexture: null,
      provider: "crafatar",
    })[0].includes("crafatar.com"),
  );
  assert.deepEqual(skinProxyTargets(offline, "Notch"), [
    "https://mc-heads.net/avatar/Notch/64",
    "https://minotar.net/helm/Notch/64",
  ]);
  assert.ok(skinProxyTargets(online, "Notch", hash)[0].includes(hash));
});
test("skin proxy rejects invalid identities/params before fetch and uses bounded fixed-host PNG fallbacks", async () => {
  const original = globalThis.fetch,
    calls: { url: string; options: RequestInit }[] = [],
    png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  globalThis.fetch = (async (
    url: string | URL | Request,
    options: RequestInit,
  ) => {
    calls.push({ url: String(url), options });
    return calls.length === 1
      ? new Response("missing", { status: 404 })
      : new Response(png, { headers: { "content-type": "image/png" } });
  }) as typeof fetch;
  const get = (id: string, query = "") =>
    GET(new Request(`http://localhost/api/skins/${id}${query}`), {
      params: Promise.resolve({ uuid: id }),
    });
  try {
    for (const [id, q] of [
      ["not-a-uuid", ""],
      ["../bad", ""],
      [online, "?name=bad-name"],
      [online, "?texture=bad"],
      [online, "?size=999"],
      [online, "?size=-1"],
    ])
      assert.equal((await get(id, q)).status, 400);
    assert.equal(calls.length, 0);
    const response = await get(offline, "?name=Notch&size=32");
    assert.equal(response.status, 200);
    assert.deepEqual(
      calls.map((c) => c.url),
      [
        "https://mc-heads.net/avatar/Notch/32",
        "https://minotar.net/helm/Notch/32",
      ],
    );
    assert.ok(
      calls.every((c) => c.options.redirect === "error" && c.options.signal),
    );
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    globalThis.fetch = (async () =>
      new Response(new Uint8Array(262145), {
        headers: { "content-type": "image/png" },
      })) as typeof fetch;
    assert.equal((await get(hash)).status, 502);
    globalThis.fetch = (async () =>
      new Response("html", {
        headers: { "content-type": "image/png" },
      })) as typeof fetch;
    assert.equal((await get(hash)).status, 502);
  } finally {
    globalThis.fetch = original;
  }
});

test("applied join skins reconcile only the exact active session while fresh inventories and scope filtering remain authoritative", () => {
  const row = {
      uuid: offline,
      sessionId: "current",
      presenceObservedAt: "now",
      name: "Notch",
    },
    delta = {
      uuid: offline,
      sessionId: "current",
      observedAt: "now",
      state: "JOINED",
      skinTexture: hash.toUpperCase(),
    };
  assert.equal(withAppliedSkins([row], [delta])[0].skinTexture, hash);
  assert.equal(
    withAppliedSkins([row], [{ ...delta, skinTexture: null }])[0].skinTexture,
    null,
  );
  for (const patch of [
    { sessionId: "old" },
    { uuid: online },
    { observedAt: "older" },
    { state: "LEFT" },
    { skinTexture: "bad" },
  ])
    assert.equal(withAppliedSkins([row], [{ ...delta, ...patch }])[0], row);
  const inventory = {
    uuid: offline,
    sessionId: "current",
    name: "Notch",
    skinTexture: "b".repeat(64),
  };
  assert.equal(withAppliedSkins([inventory], [delta])[0], inventory);
  assert.deepEqual(withAppliedSkins([], [delta]), []);
  assert.ok(!("skinTexture" in row));
  const state = makeFixture();
  state.players = [row];
  state.presenceDeltas = [delta];
  const raw: SessionSnapshot = {
    state,
    initialized: true,
    phase: "live",
    error: "",
    revision: 1,
    credentials: [],
    labels: {},
    fleet: [],
    fixture: "test",
    grant: state.ready!.device,
    relay: { origin: "", source: "unconfigured", error: "" },
  };
  assert.equal(scopedSnapshot(raw).state.players[0].skinTexture, hash);
  const revoked = { ...state.ready!.device, scopes: [] };
  raw.grant = revoked;
  state.ready = { ...state.ready!, device: revoked };
  assert.deepEqual(scopedSnapshot(raw).state.players, []);
});

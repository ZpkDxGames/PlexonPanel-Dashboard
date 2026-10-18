import test from "node:test";
import assert from "node:assert/strict";
import { playerHistoryPage } from "../src/presentation/player-history";
test("player history keeps exact UUID identity, a bounded page and opaque cursors", () => {
  const entries = Array.from({ length: 30 }, (_, i) => ({
    uuid: i === 0 ? "other" : "selected",
    state: "JOINED",
    sessionDurationMillis: null,
  }));
  const page = playerHistoryPage(
    {
      entries,
      historyEnabled: true,
      hasMore: true,
      nextCursor: "opaque+/==",
      boundedWindow: true,
    },
    "selected",
  );
  assert.equal(page.entries.length, 24);
  assert.ok(page.entries.every((e) => e.uuid === "selected"));
  assert.equal(page.entries[0].sessionDurationMillis, null);
  assert.equal(page.cursor, "opaque+/==");
  assert.equal(page.bounded, true);
});
test("missing history, disabled source and malformed cursors cannot imply evidence", () => {
  assert.deepEqual(playerHistoryPage(undefined, "x").entries, []);
  assert.equal(playerHistoryPage({}, "x").enabled, null);
  assert.equal(
    playerHistoryPage({ hasMore: true, nextCursor: "a".repeat(513) }, "x")
      .cursor,
    null,
  );
  assert.equal(
    playerHistoryPage({ hasMore: false, nextCursor: "opaque" }, "x").cursor,
    null,
  );
});

test("Host player inspection keeps exact UUID and current boot isolation", async () => {
  const { bootPlayerEvents } =
    await import("../src/presentation/player-history");
  const data = {
    bootEpochId: "boot-a",
    events: [
      { playerUuid: "uuid-a", action: "JOINED", eventId: "a" },
      { playerUuid: "uuid-b", action: "JOINED", eventId: "b" },
      { playerUuid: "uuid-a", action: "LEFT", eventId: "c" },
      { uuid: "uuid-a", action: "JOINED", eventId: "paper" },
    ],
  };
  assert.deepEqual(
    bootPlayerEvents(data, "boot-a", "uuid-a").map((e) => e.eventId),
    ["a", "c"],
  );
  assert.deepEqual(bootPlayerEvents(data, "boot-b", "uuid-a"), []);
  assert.deepEqual(bootPlayerEvents(data, undefined, "uuid-a"), []);
});

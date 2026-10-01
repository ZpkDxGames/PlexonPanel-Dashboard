import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("recent player activity is presented by the Players workspace", async () => {
  const management = await source("app/management-views-2-1.tsx");
  const players = await source("app/players-view-3-0.tsx");
  assert.equal(
    management.includes('PlayersView30 as PlayersView21'),
    true,
  );
  assert.equal(players.includes('title="Recent player activity"'), true);
  assert.equal(players.includes("liveActivity"), true);
  assert.equal(players.includes("ActivityHistoryModal"), true);
  assert.equal(players.includes("Browse activity history"), true);
});

test("Overview activity card is visually removed after the transfer", async () => {
  const css = await source("app/player-activity-3-0.css");
  assert.equal(css.includes(".cr30-overview-columns > .cr-panel:has(.cr30-activity-actions)"), true);
  assert.equal(css.includes("display: none"), true);
  assert.equal(css.includes(".cr31-player-activity-panel"), true);
});

test("the 3.x Activity modal queries Paper and suppresses the duplicate History tab", async () => {
  const players30 = await source("app/players-view-3-0.tsx");
  const modal = await source("app/activity-history-modal.tsx");
  assert.equal(players30.includes("showHistoryTab={false}"), true);
  assert.equal(modal.includes('"players.history.list"'), true);
  assert.equal(modal.includes('"PAPER"'), true);
  assert.equal(modal.includes("loadActivityHistory"), false);
});

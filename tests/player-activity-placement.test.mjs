import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("recent player activity is presented by the Players workspace", async () => {
  const management = await source("app/workspaces.tsx");
  const players = await source("app/players-view.tsx");
  assert.equal(
    management.includes('PlayersView'),
    true,
  );
  assert.equal(players.includes('title="Recent player activity"'), true);
  assert.equal(players.includes("liveActivity"), true);
  assert.equal(players.includes("ActivityHistoryModal"), true);
  assert.equal(players.includes("Browse activity history"), true);
});

test("Overview uses a brief observed activity summary without hidden legacy cards", async () => {
  const css = await source("app/ui/workspace.css");
  const overview = await source("app/overview-view.tsx");
  assert.equal(overview.includes("presenceDeltas.slice(-6)"), true);
  assert.equal(css.includes(":has(.view-activity-actions)"), false);
  assert.equal(css.includes(".player-activity-body"), false);
});

test("the 3.x Activity modal queries Paper and suppresses the duplicate History tab", async () => {
  const players30 = await source("app/players-view.tsx");
  const modal = await source("app/activity-history-modal.tsx");
  assert.equal(players30.includes("showHistoryTab={false}"), true);
  assert.equal(modal.includes('"players.history.list"'), true);
  assert.equal(modal.includes('"PAPER"'), true);
  assert.equal(modal.includes("loadActivityHistory"), false);
});

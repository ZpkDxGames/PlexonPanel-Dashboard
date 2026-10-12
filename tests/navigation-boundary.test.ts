import assert from "node:assert/strict";
import test from "node:test";
import { routes, workspaceRoutes } from "../src/router";

test("Fleet is a top-level selector, not an in-server workspace route", () => {
  assert.equal(routes[0], "Fleet");
  assert.equal(workspaceRoutes.includes("Fleet" as never), false);
  assert.deepEqual(workspaceRoutes.slice(0, 5), [
    "Overview",
    "Console",
    "Players",
    "Performance",
    "Worlds",
  ]);
  assert.deepEqual(workspaceRoutes.slice(-2), ["Access", "Settings"]);
});

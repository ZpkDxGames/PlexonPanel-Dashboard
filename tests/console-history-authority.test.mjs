import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ACTION_SCOPES, canAction } from "../.test-dist/lib/scopes.js";

const root = new URL("../", import.meta.url);
const source = async (path) => readFile(new URL(path, root), "utf8");

test("console history actions reuse the existing least-privilege view scopes", () => {
  assert.equal(ACTION_SCOPES["console.history"], "console.view.full");
  assert.equal(ACTION_SCOPES["console.history.errors"], "console.view.errors");
  assert.equal(
    canAction(
      "console.history",
      ["console.view.full"],
      { "console.view.full": true },
    ),
    true,
  );
  assert.equal(
    canAction(
      "console.history",
      ["console.view.errors"],
      { "console.view.errors": true },
    ),
    false,
  );
  assert.equal(
    canAction(
      "console.history.errors",
      ["console.view.errors"],
      { "console.view.errors": true },
    ),
    true,
  );
});

test("console UI queries Host explicitly and discloses journald retention", async () => {
  const view = await source("app/console-view-3-0.tsx");
  assert.match(view, /props\.run\(historyAction, parameters, "HOST"\)/);
  assert.match(view, /Load older history/);
  assert.match(view, /systemd-journald/);
  assert.match(view, /at most 100 lines per page/);
  assert.match(view, /bounded Paper fallback/);
  assert.match(view, /retained history becomes available again only after Host reconnects/);
  assert.match(view, /const historyKey = JSON\.stringify/);
  assert.match(view, /Search loaded lines/);
  assert.match(view, /result\.data\.nextCursor/);
  assert.match(view, /Search, copy and export cover loaded visible lines only/);
});

test("relay adapters expose explicit Host, Paper fallback, and unavailable authority states", async () => {
  for (const path of [
    "relay/src/index.ts",
    "relay/src/standalone/room-manager.ts",
  ]) {
    const runtime = await source(path);
    assert.match(runtime, /hostAuthoritative/);
    assert.match(runtime, /HOST_OFFLINE/);
    assert.match(runtime, /PAPER_FALLBACK/);
    assert.match(runtime, /UNAVAILABLE/);
    assert.match(runtime, /console\.authority/);
  }
});

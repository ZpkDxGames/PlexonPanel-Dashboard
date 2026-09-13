import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { test } from "node:test";
import { filterEvent } from "../dist/index.js";

const root = new URL("../../", import.meta.url);
const source = async (path) => readFile(new URL(path, root), "utf8");

test("console error and full scopes retain existing event filtering semantics", () => {
  const body = {
    lines: [
      { level: "INFO", content: "boot", capturedAt: "2026-09-13T17:00:00Z" },
      { level: "WARN", content: "warning", capturedAt: "2026-09-13T17:00:01Z" },
      { level: "ERROR", content: "failure", capturedAt: "2026-09-13T17:00:02Z" },
    ],
  };
  const errors = filterEvent(
    "console.lines",
    body,
    ["console.view.errors"],
    { "console.view.errors": true },
  );
  assert.deepEqual(
    errors.lines.map((line) => line.level),
    ["WARN", "ERROR"],
  );
  const full = filterEvent(
    "console.lines",
    body,
    ["console.view.full"],
    { "console.view.full": true },
  );
  assert.equal(full.lines.length, 3);
});

test("Worker and standalone both implement Host console authority and Paper-only execution", async () => {
  const worker = await source("relay/src/index.ts");
  const standalone = await source("relay/src/standalone/room-manager.ts");
  for (const runtime of [worker, standalone]) {
    assert.match(runtime, /console\.source/);
    assert.match(runtime, /console\.lines/);
    assert.match(runtime, /HOST_JOURNAL/);
    assert.match(runtime, /console\.view\.full/);
    assert.match(runtime, /console\.execute/);
    assert.match(runtime, /agentKind === "HOST"/);
    assert.match(runtime, /PAPER_FALLBACK/);
    assert.match(runtime, /3\.4\.0/);
  }
});

test("3.4 adapters preserve the certified 3.3 relay cores as explicit source units", async () => {
  const workerCore = await source("relay/src/index-core.ts");
  const standaloneCore = await source("relay/src/standalone/room-manager-core.ts");
  assert.match(workerCore, /export class ServerRoom/);
  assert.match(standaloneCore, /export class Room/);
  assert.match(standaloneCore, /maintenance\.coordination/);
});

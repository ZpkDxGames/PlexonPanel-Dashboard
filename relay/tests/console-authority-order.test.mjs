import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("Worker and standalone tolerate valid Host replay before console.source authority", async () => {
  const files = [
    await source("relay/src/index.ts"),
    await source("relay/src/standalone/room-manager.ts"),
    await source("relay/dist/index.js"),
    await source("relay/dist/standalone/room-manager.js"),
  ];

  for (const content of files) {
    assert.doesNotMatch(content, /Event not allowed while host console source is unavailable/);
    assert.match(content, /consoleHealthy !== true\)\s*return/);
  }
});

test("Worker and standalone accept Host 3.4.0 empty replay snapshots as no-ops", async () => {
  const files = [
    await source("relay/src/index.ts"),
    await source("relay/src/standalone/room-manager.ts"),
    await source("relay/dist/index.js"),
    await source("relay/dist/standalone/room-manager.js"),
  ];

  for (const content of files) {
    assert.doesNotMatch(content, /body\.lines\.length < 1/);
    assert.match(content, /body\.lines\.length === 0\)\s*return/);
    assert.match(content, /body\.lines\.length > 100/);
  }
});

test("console ordering tolerance does not remove 3.3 maintenance parity", async () => {
  const compiled = [
    await source("relay/dist/index-core.js"),
    await source("relay/dist/standalone/room-manager-core.js"),
  ];

  for (const content of compiled) {
    assert.match(content, /maintenance\.coordination/);
    assert.match(content, /maintenance\.coordination\.result/);
    assert.match(content, /action\.startsWith\("maintenance\."\)/);
    assert.match(content, /action\.startsWith\("provider\."\)/);
  }
});

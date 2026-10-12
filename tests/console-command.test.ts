import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeConsoleCommand,
  parseCommandHistory,
  recordCommand,
  removeCommand,
  requiresAgentConfirmation,
  requiresTypedConfirmation,
} from "../src/lib/console-command";

test("console confirmation policy separates safe, dangerous and lifecycle actions", () => {
  assert.equal(
    requiresTypedConfirmation("console.execute", { command: "/stop" }),
    true,
  );
  assert.equal(
    requiresTypedConfirmation("console.execute", { command: "list" }),
    false,
  );
  assert.equal(requiresAgentConfirmation("server.stop", {}), true);
  assert.equal(requiresAgentConfirmation("server.restart", {}), true);
  assert.equal(requiresTypedConfirmation("server.stop", {}), false);
});

test("console history keeps only normalized, unique, bounded commands", () => {
  assert.equal(normalizeConsoleCommand("  //list\n"), "list");
  assert.deepEqual(parseCommandHistory(["/list", "list", 42, "", " tps "]), [
    "list",
    "tps",
  ]);
  assert.deepEqual(recordCommand(["list", "tps"], "/tps"), ["tps", "list"]);
  assert.deepEqual(removeCommand(["list", "tps"], "/list"), ["tps"]);
  const bounded = Array.from({ length: 205 }, (_, i) => `say ${i}`);
  assert.equal(recordCommand(bounded, "list").length, 200);
});

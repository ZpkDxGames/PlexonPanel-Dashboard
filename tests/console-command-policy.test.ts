import assert from "node:assert/strict";
import test from "node:test";
import {
  isServerConfirmationRequired,
  normalizeConsoleCommand,
  requiresTypedConfirmation,
} from "../src/lib/console-command";

test("Paper confirmation challenges are recognized without guessing command risk", () => {
  assert.equal(
    isServerConfirmationRequired({
      status: "DENIED",
      code: "CONFIRMATION_REQUIRED",
    }),
    true,
  );
  assert.equal(
    isServerConfirmationRequired({
      status: "DENIED",
      code: "COMMAND_NOT_ALLOWED",
    }),
    false,
  );
});

test("console normalization strips slash/newlines while local typed confirmation remains narrow", () => {
  assert.equal(normalizeConsoleCommand("/tps\n"), "tps");
  assert.equal(requiresTypedConfirmation("console.execute", { command: "tps" }), false);
  assert.equal(requiresTypedConfirmation("console.execute", { command: "stop" }), true);
});

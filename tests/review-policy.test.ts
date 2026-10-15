import test from "node:test";
import assert from "node:assert/strict";
import { reviewPolicy } from "../src/presentation/review-policy";
import { HIGH_RISK } from "../src/adapter/scopes";
test("reviewed dispatch supplies the Protocol 3 high-risk confirmation flag and Paper confirmation-mode command flag", () => {
  for (const action of HIGH_RISK)
    assert.equal(reviewPolicy(action).confirmed, true, action);
  for (const action of ["console.execute", "plugin.command.reload"])
    assert.equal(reviewPolicy(action).confirmed, true, action);
  for (const action of [
    "backup.preflight",
    "maintenance.status",
    "audit.list",
    "devices.list",
    "backup.full.verify",
    "player.message",
  ])
    assert.equal(reviewPolicy(action).confirmed, false, action);
});
test("existing typed subject safeguards are preserved independently of agent confirmation metadata", () => {
  for (const action of [
    "player.ban",
    "player.kill",
    "player.op",
    "player.deop",
    "backup.full.delete",
  ])
    assert.equal(reviewPolicy(action).typed, true, action);
  assert.deepEqual(reviewPolicy("server.restart"), {
    typed: false,
    confirmed: true,
  });
});

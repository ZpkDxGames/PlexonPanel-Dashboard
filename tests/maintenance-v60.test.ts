import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMaintenance,
  remainingCountdown,
  formatMmSs,
} from "../src/ui/bindings/maintenance-model";
import {
  toSelectionKey,
  matchesSelection,
} from "../src/ui/bindings/player-selection";
import { DEFAULT_VIEW, validateViewSync } from "../src/ui/bindings/view-sync";
test("countdowns prefer Host remaining time and advance monotonically without client-clock skew", () => {
  const s = normalizeMaintenance(
    {
      countdownState: "ACTIVE",
      countdownKind: "BACKUP",
      countdownRemainingSeconds: 258,
      countdownEndsAt: "1900-01-01",
    },
    1000,
    9999999999999,
  );
  assert.equal(remainingCountdown(s, 1000), 258);
  assert.equal(remainingCountdown(s, 3999), 256);
  assert.equal(remainingCountdown(s, 9999999), 0);
  assert.equal(remainingCountdown(s, 500), 258);
  assert.equal(formatMmSs(258), "04:18");
  assert.equal(formatMmSs(-5), "00:00");
});
test("maintenance handles old countdown keys, missing and malformed values, recovery and idle", () => {
  assert.equal(normalizeMaintenance(null, 0).countdownState, "IDLE");
  assert.equal(
    normalizeMaintenance(
      { countdownState: "ACTIVE", countdownRemainingSeconds: NaN },
      0,
    ).remainingAtSnapshot,
    null,
  );
  const s = normalizeMaintenance(
    {
      countdownState: "ACTIVE",
      countdownDeadline: "2026-10-19T00:05:00Z",
      currentOperation: { kind: "RESTART", phase: "COUNTDOWN" },
    },
    0,
    Date.parse("2026-10-19T00:00:00Z"),
  );
  assert.equal(s.countdownKind, "RESTART");
  assert.equal(s.remainingAtSnapshot, 300);
  assert.ok(s.jobBusy);
  assert.equal(remainingCountdown(normalizeMaintenance({}, 0), 4000), null);
  assert.ok(
    normalizeMaintenance({ jobRecoveryRequired: true }, 0).recoveryRequired,
  );
  assert.ok(
    normalizeMaintenance({ currentOperation: { phase: "STOPPING_SERVER" } }, 0)
      .jobBusy,
  );
});
test("player selection is case insensitive and supports name-only event rows", () => {
  const id = "8667ba71-b85a-4004-af54-457a9734eed7";
  assert.equal(toSelectionKey({ uuid: id.toUpperCase(), name: "Steve" }), id);
  assert.equal(
    toSelectionKey({ name: "NEGUINCOMCEROL" }),
    "name:neguincomcerol",
  );
  assert.equal(toSelectionKey({}), "");
  assert.ok(matchesSelection({ uuid: id }, id.toUpperCase()));
  assert.ok(
    matchesSelection({ name: "NEGUINCOMCEROL" }, "name:neguincomcerol"),
  );
  assert.ok(!matchesSelection({ name: "Steve" }, ""));
  assert.ok(!matchesSelection({ name: "Steve" }, "name:Alex"));
});
test("selection persistence is backward compatible and rejects malformed identities", () => {
  assert.equal(DEFAULT_VIEW.selectedPlayerUuid, "");
  assert.equal(validateViewSync({}).selectedPlayerUuid, "");
  assert.equal(
    validateViewSync({ selectedPlayerUuid: "name:Steve" }).selectedPlayerUuid,
    "name:Steve",
  );
  for (const value of [null, 5, "x".repeat(65), "name:<script>", "name:a\n"])
    assert.equal(
      validateViewSync({ selectedPlayerUuid: value }).selectedPlayerUuid,
      "",
    );
});

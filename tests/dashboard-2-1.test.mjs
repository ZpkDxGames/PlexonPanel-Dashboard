import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lifecycleActionAllowed,
  normalizeServiceState,
} from "../.test-dist/lib/lifecycle-state.js";
import {
  diagnostics,
  emptyControlState,
} from "../.test-dist/lib/control-state.js";
import { ActionError } from "../.test-dist/lib/data-source.js";
import {
  operationMessage,
  operationText,
} from "../.test-dist/lib/operation-messages.js";

test("active service disables Start and allows stop/restart", () => {
  const state = normalizeServiceState("active", true);
  assert.equal(state, "active");
  assert.equal(lifecycleActionAllowed("start", state), false);
  assert.equal(lifecycleActionAllowed("stop", state), true);
  assert.equal(lifecycleActionAllowed("restart", state), true);
});

test("inactive service allows only Start", () => {
  const state = normalizeServiceState("inactive", false);
  assert.equal(state, "inactive");
  assert.equal(lifecycleActionAllowed("start", state), true);
  assert.equal(lifecycleActionAllowed("stop", state), false);
  assert.equal(lifecycleActionAllowed("restart", state), false);
});

test("transitioning and unknown service states block lifecycle actions", () => {
  for (const state of ["activating", "deactivating", "unknown"]) {
    for (const action of ["start", "stop", "restart"])
      assert.equal(lifecycleActionAllowed(action, state), false);
  }
});

test("failed service permits recovery Start but not stop/restart", () => {
  const state = normalizeServiceState("failed", false);
  assert.equal(state, "failed");
  assert.equal(lifecycleActionAllowed("start", state), true);
  assert.equal(lifecycleActionAllowed("stop", state), false);
  assert.equal(lifecycleActionAllowed("restart", state), false);
});

test("Paper connection only fills missing service state and never overrides explicit inactive", () => {
  assert.equal(normalizeServiceState(undefined, true), "active");
  assert.equal(normalizeServiceState(undefined, false), "unknown");
  assert.equal(normalizeServiceState("inactive", true), "inactive");
});

test("known action codes map to safe actionable guidance", () => {
  const denied = operationMessage(
    new ActionError("raw denied", "SCOPE_DENIED", "DENIED"),
  );
  assert.equal(denied.title, "Permission unavailable");
  assert.match(denied.detail, /scope/i);
  assert.ok(!denied.detail.includes("raw denied"));

  const stopped = operationText(
    new ActionError("raw host detail", "SERVER_MUST_BE_STOPPED", "FAILED"),
  );
  assert.match(stopped, /Server must be stopped/i);
  assert.match(stopped, /Stop Paper gracefully/i);
  assert.ok(!stopped.includes("raw host detail"));
});

test("unknown action codes retain the sanitized agent message", () => {
  const mapped = operationMessage(
    new ActionError("Operation was rejected safely", "SOMETHING_NEW", "DENIED"),
  );
  assert.equal(mapped.title, "Operation denied");
  assert.equal(mapped.detail, "Operation was rejected safely");
});

test("safe diagnostics identify Dashboard 3.0.2 without changing protocol 3", () => {
  const output = diagnostics(emptyControlState("test-server"));
  assert.match(output, /PlexonPanel Dashboard 3\.0\.2 \/ Protocol 3/);
  assert.doesNotMatch(output, /Dashboard 2\.2\.0/);
});

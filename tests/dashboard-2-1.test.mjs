import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

const dashboardSource = async () => (await Promise.all(["app/dashboard.tsx", "app/use-dashboard-session.ts", "app/use-signed-operations.ts", "app/shell.tsx", "app/workspaces.tsx"].map(path => readFile(new URL(`../${path}`, import.meta.url), "utf8")))).join("\n");

test("active service disables Start and allows stop/restart", () => {
  const state = normalizeServiceState("active");
  assert.equal(state, "active");
  assert.equal(lifecycleActionAllowed("start", state), false);
  assert.equal(lifecycleActionAllowed("stop", state), true);
  assert.equal(lifecycleActionAllowed("restart", state), true);
});

test("inactive service allows only Start", () => {
  const state = normalizeServiceState("inactive");
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
  const state = normalizeServiceState("failed");
  assert.equal(state, "failed");
  assert.equal(lifecycleActionAllowed("start", state), true);
  assert.equal(lifecycleActionAllowed("stop", state), false);
  assert.equal(lifecycleActionAllowed("restart", state), false);
});

test("missing Host service state stays unknown regardless of Paper connectivity", () => {
  for (const missing of [undefined, null, "", "unrecognized"]) assert.equal(normalizeServiceState(missing), "unknown");
  assert.equal(normalizeServiceState("inactive"), "inactive");
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

test("lifecycle busy explains rejection without suggesting a deferred stop", () => {
  const busy = operationMessage(new ActionError("raw details", "BUSY", "DENIED", "", "server.stop"));
  assert.equal(busy.title, "Server control is busy");
  assert.match(busy.detail, /rejected and will not run later/);
  assert.doesNotMatch(busy.detail, /raw details/);
  assert.equal(operationMessage(new ActionError("raw", "BUSY", "DENIED", "", "backup.full.retry-upload")).title,
    "Another operation is running");
});

test("safe diagnostics identify Dashboard 6.0.0 without changing protocol 3", () => {
  const output = diagnostics(emptyControlState("test-server"));
  assert.match(output, /PlexonPanel Dashboard 6\.0\.0 \/ Protocol 3/);
  assert.doesNotMatch(output, /Dashboard 2\.2\.0/);
});

test("live actions are bound to the exact signed socket grant", async () => {
  const dashboard = await dashboardSource();
  for (const contract of [
    "requestLiveConnection(credential)",
    "grant.deviceId !== credential.deviceId",
    "message.actionContract !== undefined",
    "message.actionContract !== ACTION_CONTRACT_ID",
    "message.actionContract !== grant.actionContract",
    "ready.actionContract !== undefined",
    "ready.actionContract !== ACTION_CONTRACT_ID",
    "const effective = reconcileDeviceGrant(grant, reportedGrant)",
    "effective?.metadataMatches",
    "bindLiveSocket(candidate, grant.serverId, readyContext)",
    "unbindLiveSocket(candidate)",
  ])
    assert.equal(
      dashboard.includes(contract),
      true,
      `missing live socket/grant contract: ${contract}`,
    );
});

test("preconfirmed maintenance actions are sent once with confirmation", async () => {
  const dashboard = await dashboardSource();
  assert.equal(
    dashboard.includes(
      'confirmationMode: "default" | "preconfirmed" = "default"',
    ),
    true,
  );
  assert.equal(
    dashboard.includes('confirmationMode !== "preconfirmed" &&'),
    true,
  );
  assert.equal(
    dashboard.includes('if (confirmationMode === "preconfirmed")'),
    true,
  );
});

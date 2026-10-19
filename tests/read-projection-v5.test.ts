import test from "node:test";
import assert from "node:assert/strict";
import {
  scopedSnapshot,
  serviceMetrics,
  observedSessionPeak,
} from "../src/ui/hooks/useControl";
import { makeFixture } from "../src/development/fixtures";
import type { SessionSnapshot } from "../src/adapter/session";
import { serverState } from "../src/ui/chrome/server-view";
const snapshot = (): SessionSnapshot => {
  const state = makeFixture();
  return {
    state,
    initialized: true,
    phase: "live",
    error: "",
    revision: 1,
    credentials: [],
    labels: {},
    fleet: [],
    fixture: "test",
    grant: state.ready!.device,
    relay: { origin: "", source: "unconfigured", error: "" },
  };
};
test("revoked read scopes hide retained roster, chat and non-error logs", () => {
  const s = snapshot(),
    device = {
      ...s.state.ready!.device,
      scopes: [
        "overview.view",
        "telemetry.view",
        "console.view.errors",
      ] as const,
    };
  s.grant = { ...device, scopes: [...device.scopes] };
  s.state.ready = {
    ...s.state.ready!,
    device: { ...device, scopes: [...device.scopes] },
  };
  const view = scopedSnapshot(s);
  assert.equal(view.state.players.length, 0);
  assert.equal(view.state.chat.length, 0);
  assert.ok(
    view.state.console.every((l) =>
      ["WARN", "ERROR", "FATAL"].includes(String(l.level)),
    ),
  );
  assert.ok(s.state.players.length > 0);
});
test("server status requires fresh source and readiness evidence", () => {
  const s = makeFixture();
  assert.equal(serverState(s, false, false), "unknown");
  assert.equal(serverState(s, false, true), "online");
  s.service.minecraftReady = false;
  assert.equal(serverState(s, false, true), "starting");
  s.service.state = "inactive";
  assert.equal(serverState(s, false, true), "stopped");
  assert.equal(serverState(s, true, false), "online");
});
test("mismatched grant metadata fails closed for all scoped readings", () => {
  const raw = snapshot();
  raw.grant = { ...raw.grant!, role: "Viewer" };
  const view = scopedSnapshot(raw);
  assert.deepEqual(view.state.server, {});
  assert.deepEqual(view.state.hostSystem, {});
  assert.equal(view.state.players.length, 0);
  assert.equal(view.state.console.length, 0);
});

test("Host process values cannot masquerade as Minecraft service metrics", () => {
  assert.deepEqual(
    serviceMetrics({
      scope: "HOST",
      source: "PROCESS",
      cpuAvailable: true,
      cpuUnit: "PERCENT_OF_ONE_CORE",
      cpuPercent: 70,
      memoryAvailable: true,
      memoryBytes: 100,
    }),
    { cpu: null, memory: null },
  );
  assert.deepEqual(
    serviceMetrics({
      scope: "MINECRAFT_SERVICE",
      source: "SYSTEMD_CGROUP",
      cpuAvailable: true,
      cpuUnit: "PERCENT_OF_ONE_CORE",
      cpuPercent: 146,
      memoryAvailable: true,
      memoryBytes: 100,
    }),
    { cpu: 146, memory: 100 },
  );
});
test("session peak excludes earlier epochs and preserves absent values", () => {
  const h = makeFixture().history;
  assert.equal(observedSessionPeak([], null), null);
  assert.equal(
    observedSessionPeak(
      [
        { ...h[0], epoch: "old", players: 200 },
        { ...h[1], epoch: "new", players: 4 },
      ],
      3,
    ),
    4,
  );
});
test("retained location and address vanish immediately after read scope shrink", () => {
  const raw = snapshot();
  raw.state.players[0] = {
    ...raw.state.players[0],
    position: { x: 1 },
    address: "redacted-test-address",
  };
  const device = {
    ...raw.state.ready!.device,
    scopes: ["players.view" as const],
  };
  raw.grant = device;
  raw.state.ready = { ...raw.state.ready!, device };
  const view = scopedSnapshot(raw);
  assert.ok(view.state.players.length > 0);
  assert.equal(view.state.players[0].position, undefined);
  assert.equal(view.state.players[0].address, undefined);
  assert.ok(raw.state.players[0].position);
});

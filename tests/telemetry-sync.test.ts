import assert from "node:assert/strict";
import test from "node:test";
import { applyControlMessage } from "../src/adapter/control-state";
import { makeFixture } from "../src/development/fixtures";
import { playerPingMillis } from "../src/lib/player-telemetry";
import {
  DASHBOARD_TIMEZONE,
  chartWindowLabel,
  formatTime,
} from "../src/lib/time";

test("protocol player pingMillis is authoritative with legacy ping fallback", () => {
  assert.equal(playerPingMillis({ pingMillis: 37, ping: 999 }), 37);
  assert.equal(playerPingMillis({ ping: 52 }), 52);
  assert.equal(playerPingMillis({ pingMillis: -1 }), null);
});

test("Sao Paulo is the canonical dashboard display timezone", () => {
  assert.equal(DASHBOARD_TIMEZONE, "America/Sao_Paulo");
  assert.equal(
    formatTime("2026-10-12T18:00:00.000Z", { seconds: true }),
    "15:00:00",
  );
  assert.equal(chartWindowLabel(30_000), "30s");
  assert.equal(chartWindowLabel(60_000), "1min");
  assert.equal(chartWindowLabel(600_000), "10min");
});

test("older player inventory snapshots cannot overwrite a newer roster", () => {
  let state = makeFixture();
  const newer = "2026-10-12T18:00:10.000Z";
  state = applyControlMessage(state, {
    type: "server.event",
    serverId: state.serverId,
    agentKind: "PAPER",
    agentSession: "fixture-paper",
    eventType: "inventory.players",
    body: {
      snapshotId: "newer",
      capturedAt: newer,
      offset: 0,
      complete: true,
      players: [
        {
          uuid: "00000000-0000-4000-8000-000000000001",
          name: "Fresh",
          pingMillis: 41,
        },
      ],
    },
  });
  assert.equal(state.players[0]?.name, "Fresh");
  assert.equal(state.inventoryCapturedAt?.players, newer);

  const stale = applyControlMessage(state, {
    type: "server.event",
    serverId: state.serverId,
    agentKind: "PAPER",
    agentSession: "fixture-paper",
    eventType: "inventory.players",
    body: {
      snapshotId: "older",
      capturedAt: "2026-10-12T18:00:05.000Z",
      offset: 0,
      complete: true,
      players: [
        {
          uuid: "00000000-0000-4000-8000-000000000002",
          name: "Stale",
          pingMillis: 999,
        },
      ],
    },
  });
  assert.equal(stale.players[0]?.name, "Fresh");
  assert.equal(stale.inventoryCapturedAt?.players, newer);
});

test("new Paper sessions clear old Paper-owned inventory state", () => {
  const state = makeFixture();
  state.plugins = [{ name: "OldPlugin" }];
  state.worlds = [{ name: "old_world" }];
  state.inventoryIds = { players: "old-players", plugins: "old-plugins" };
  state.inventoryCapturedAt = {
    players: "2026-10-12T18:00:00Z",
    plugins: "2026-10-12T18:00:00Z",
    worlds: "2026-10-12T18:00:00Z",
  };

  const next = applyControlMessage(state, {
    ...state.ready,
    type: "dashboard.ready",
    server: { ...state.ready!.server, paperSession: "replacement-session" },
    agents: { paper: true, host: true, hostInstalled: true },
  });

  assert.deepEqual(next.players, []);
  assert.deepEqual(next.plugins, []);
  assert.deepEqual(next.worlds, []);
  assert.deepEqual(next.inventoryIds, {
    players: undefined,
    plugins: undefined,
  });
  assert.equal(next.inventoryCapturedAt, undefined);
});

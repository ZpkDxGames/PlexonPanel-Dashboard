import test from "node:test";
import type { Sample } from "../src/adapter/control-state";
import assert from "node:assert/strict";
import { consoleMessage } from "../src/presentation/console-text";
import { chartRows } from "../src/presentation/recharts-data";
import { makeFixture } from "../src/development/fixtures";
import { permissionCommand } from "../src/lib/playerCommands";
test("console removes only duplicate leading metadata and preserves plugin tags / embedded text", () => {
  assert.equal(
    consoleMessage("[06:31:47 INFO]: Loading 0 chunks"),
    "Loading 0 chunks",
  );
  assert.equal(
    consoleMessage("[06:31:47] [Server thread/INFO]: [TAB] Enabling"),
    "[TAB] Enabling",
  );
  assert.equal(
    consoleMessage("[TAB] Enabling v6.2.0"),
    "[TAB] Enabling v6.2.0",
  );
  assert.equal(
    consoleMessage("Player said [06:31:47 INFO]: hello"),
    "Player said [06:31:47 INFO]: hello",
  );
  assert.equal(
    consoleMessage("[06:31:47 ERROR]: \n  stack frame"),
    "\n  stack frame",
  );
  assert.equal(
    consoleMessage("[06:31:47 INFO]: <script>alert(1)</script>"),
    "<script>alert(1)</script>",
  );
});
test("Recharts projection does not turn visual decimation into disconnect gaps or lose real missing observations", () => {
  const base = makeFixture().history[0],
    raw: Sample[] = Array.from({ length: 8192 }, (_, i) => ({
      ...base,
      at: i * 250,
      sources: undefined,
      tps: 20,
      mspt: i === 3131 ? 900 : 10,
    }));
  raw[4000].mspt = null;
  const rows = chartRows(raw, "paperHealth", ["mspt"], 0, 400);
  assert(rows.length < 420);
  assert(rows.some((r) => r.mspt === 900));
  assert(rows.some((r) => r.at === 1000000 && r.mspt === null));
  assert(!rows.some((r) => r.gap));
  assert.equal(raw.length, 8192);
  const gap = chartRows(
    [raw[0], { ...raw[1], at: 30000 }],
    "paperHealth",
    ["mspt"],
    0,
  );
  assert(gap.some((r) => r.gap === true && r.mspt === null));
});
test("Recharts memory projections retain the source capture clock, never a neighboring producer's clock", () => {
  const sample = {
    ...makeFixture().history[0],
    at: 20000,
    sources: {
      paperHealth: 1000,
      paperSystem: 9000,
      hostSystem: 20000,
      service: 15000,
    },
  };
  assert.deepEqual(
    chartRows([sample], "paperSystem", ["heap"], 0).map((r) => r.at),
    [9000],
  );
  assert.deepEqual(
    chartRows([sample], "service", ["serviceMemory"], 0).map((r) => r.at),
    [15000],
  );
  assert.equal(chartRows([sample], "paperSystem", ["heap"], 10000).length, 0);
});
test("LuckPerms builder accepts the exact immutable UUID and still rejects control characters", () => {
  const player = "19f50206-26de-410c-a1bc-000000000000";
  assert.equal(
    permissionCommand({ player, node: "essentials.fly", mode: "set" }),
    `lp user ${player} permission set essentials.fly true`,
  );
  assert.throws(() =>
    permissionCommand({ player: player + "\n", node: "*", mode: "set" }),
  );
});

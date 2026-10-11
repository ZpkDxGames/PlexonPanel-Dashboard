import assert from "node:assert/strict";
import test from "node:test";
import { permissionCommand, playerCommand } from "../src/lib/playerCommands";

const player = { name: "LumaCraft", uuid: "19f50206-26de-410c-a1bc-000000000001" };

test("player command replaces structured identity placeholders", () => {
  assert.equal(playerCommand("/tell {player} hello", player), "tell LumaCraft hello");
  assert.equal(playerCommand("inspect {uuid}", player), `inspect ${player.uuid}`);
});

test("player command rejects control characters and unknown placeholders", () => {
  assert.throws(() => playerCommand("kick {player}\nstop", player), /control/);
  assert.throws(() => playerCommand("tell {target}", player), /unknown placeholder/);
});

test("permission builder produces bounded LuckPerms commands", () => {
  assert.equal(permissionCommand({ player: "LumaCraft", node: "essentials.fly", mode: "set" }), "lp user LumaCraft permission set essentials.fly true");
  assert.throws(() => permissionCommand({ player: "LumaCraft", node: "x\nstop", mode: "set" }), /Permission nodes/);
});

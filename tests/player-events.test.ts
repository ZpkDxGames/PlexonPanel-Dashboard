import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  __resetPlayerEvents,
  parseConsoleLine,
  resolveClock,
  ingestConsole,
  ingestPresence,
  ingestRoster,
  selectEvents,
} from "../src/ui/players/player-events";
const tz = "America/Sao_Paulo",
  anchor = Date.UTC(2026, 9, 19, 18, 30),
  ctx = { bootId: "b1", tz, anchor };
const L = (seq: number, text: string) => ({ seq, text });
beforeEach(() => __resetPlayerEvents());
test("parse joins, address-bearing logins, leaves and disconnect reasons", () => {
  for (const text of [
    "ZpkDxGames joined the game",
    "ZpkDxGames[/10.0.0.5:5555] logged in with entity id 12 at (1.0, 64.0, 2.0)",
    "[Server] ZpkDxGames joined the game",
  ]) {
    const ev = parseConsoleLine(L(1, `[15:14:20 INFO]: ${text}`), ctx)!;
    assert.equal(ev.kind, "join");
    assert.equal(ev.player, "ZpkDxGames");
    assert.ok(!JSON.stringify(ev).includes("10.0.0.5"));
  }
  assert.equal(
    parseConsoleLine(
      L(2, "[15:20:00 INFO]: ZpkDxGames lost connection: Disconnected"),
      ctx,
    )?.detail,
    "Disconnected",
  );
  assert.equal(
    parseConsoleLine(
      L(3, "[15:20:00] [Server thread/INFO]: ZpkDxGames left the game"),
      ctx,
    )?.kind,
    "leave",
  );
});
test("event details and IDs never expose IPv4 or IPv6 addresses", () => {
  for (const text of [
    "A[/10.0.0.5:5555] logged in with entity id 12 at (1, 64, 2)",
    "A lost connection: Reconnect to 10.0.0.5:25565",
    "A issued server command: /connect [2001:db8::1]:25565",
    "[Command] A: /connect ::ffff:192.168.1.2",
  ]) {
    const ev = parseConsoleLine({ seq: text, text }, ctx)!;
    assert.ok(ev);
    assert.doesNotMatch(
      JSON.stringify(ev),
      /10\.0\.0\.5|2001:db8|192\.168\.1\.2/,
    );
  }
});
test("parse vanilla and companion advancement, challenge, goal, death and command events", () => {
  const cases = [
    ["Steve has made the advancement [Stone Age]", "advancement", "Stone Age"],
    [
      "Steve has completed the challenge [How Did We Get Here?]",
      "advancement",
      "How Did We Get Here?",
    ],
    [
      "Steve has reached the goal [Sky's the Limit]",
      "advancement",
      "Sky's the Limit",
    ],
    ["[Advancement] Steve: Diamonds!", "advancement", "Diamonds!"],
    ["Steve fell from a high place", "death", "fell from a high place"],
    ["[Death] Steve was slain by Zombie", "death", "was slain by Zombie"],
    [
      "Steve issued server command: /gamemode creative",
      "command",
      "/gamemode creative",
    ],
    ["[Command] Steve: /tp 0 64 0", "command", "/tp 0 64 0"],
  ] as const;
  for (const [text, kind, detail] of cases) {
    const ev = parseConsoleLine(L(1, text), ctx);
    assert.equal(ev?.kind, kind, text);
    assert.equal(ev?.detail, detail);
  }
});
test("death parser covers environmental, combat and world-boundary deaths", () => {
  for (const death of [
    "drowned",
    "died",
    "suffocated in a wall",
    "starved to death",
    "withered away",
    "froze to death",
    "burned to death",
    "blew up",
    "fell off a ladder",
    "fell out of the world",
    "hit the ground too hard",
    "tried to swim in lava",
    "went up in flames",
    "walked into fire whilst fighting Zombie",
    "experienced kinetic energy",
    "discovered the floor was lava",
    "didn't want to live in the same world as Zombie",
    "left the confines of this world",
    "was roasted in dragon breath",
    "was shot by Skeleton",
    "was impaled on a stalagmite",
    "was squished too much",
  ])
    assert.equal(
      parseConsoleLine(L(1, `Steve ${death}`), ctx)?.kind,
      "death",
      death,
    );
});
test("ignore chat, unsigned chat, terminal warnings and unrelated plugin messages", () => {
  for (const text of [
    "[15:24:00 INFO]: <Steve> I died lol",
    "[15:24:00 INFO]: [Not Secure] <Steve> joined the game",
    "[15:24:00 WARN]: Advanced terminal features are not available",
    "[spark] Saved profile",
    "Done (1.234s)! For help, type help",
  ])
    assert.equal(parseConsoleLine(L(1, text), ctx), null, text);
});
test("resolve Sao Paulo clock, previous-day midnight and explicit producer timestamps", () => {
  assert.equal(
    new Date(
      parseConsoleLine(L(1, "[15:14:20 INFO]: A joined the game"), ctx)!.ts,
    ).toISOString(),
    "2026-10-19T18:14:20.000Z",
  );
  assert.equal(
    new Date(
      resolveClock("23:59:59", Date.UTC(2026, 9, 20, 3, 0, 10), tz),
    ).toISOString(),
    "2026-10-20T02:59:59.000Z",
  );
  assert.equal(resolveClock("bad", anchor, tz), anchor);
  assert.equal(
    parseConsoleLine(
      { ...L(2, "[15:14:20 INFO]: A joined the game"), ts: 123456 },
      ctx,
    )?.ts,
    123456,
  );
});
test("login, join and presence deduplicate in either source order with console priority", () => {
  for (const reverse of [false, true]) {
    __resetPlayerEvents();
    const ts = Date.UTC(2026, 9, 19, 18, 14, 24),
      presence = () =>
        ingestPresence("b1", [{ ts, kind: "join", player: "A" }]),
      console = () =>
        ingestConsole(
          "b1",
          [
            L(
              1,
              "[15:14:20 INFO]: A[/1.1.1.1:1] logged in with entity id 1 at (0, 0, 0)",
            ),
            L(2, "[15:14:20 INFO]: A joined the game"),
          ],
          { tz, anchor },
        );
    if (reverse) {
      console();
      presence();
    } else {
      presence();
      console();
    }
    assert.equal(selectEvents("b1").length, 1);
    assert.equal(selectEvents("b1")[0].source, "console");
  }
});
test("merge lost-connection reason regardless of leave line order", () => {
  for (const reverse of [false, true]) {
    __resetPlayerEvents();
    let lines = [
      L(1, "[15:20:00 INFO]: A lost connection: Timed out"),
      L(2, "[15:20:00 INFO]: A left the game"),
    ];
    if (reverse) lines.reverse();
    ingestConsole("b1", lines, { tz, anchor });
    const events = selectEvents("b1");
    assert.equal(events.length, 1);
    assert.equal(events[0].detail, "Timed out");
  }
});
test("repeated inventory snapshots retain event history and stable online timestamps", () => {
  ingestPresence("b1", [{ ts: anchor - 60000, kind: "join", player: "A" }]);
  const roster = [
    { name: "A", sessionStartedAt: anchor - 60000 },
    { name: "ZpkDxGames" },
  ];
  ingestRoster("b1", roster, anchor);
  const before = selectEvents("b1");
  ingestRoster("b1", roster, anchor + 5000);
  ingestRoster("b1", roster, anchor + 10000);
  assert.deepEqual(selectEvents("b1"), before);
  assert.equal(before.find((e) => e.player === "ZpkDxGames")?.ts, anchor);
  assert.equal(before.filter((e) => e.player === "A").length, 1);
});
test("synthesize online for an existing roster player; roster transitions append without wiping", () => {
  ingestRoster(
    "b1",
    [{ name: "ZpkDxGames", sessionStartedAt: anchor - 180000 }],
    anchor,
  );
  assert.equal(selectEvents("b1")[0].kind, "online");
  ingestConsole("b1", [L(1, "[Advancement] Steve: Stone Age")], { tz, anchor });
  ingestRoster("b1", [{ name: "Alex" }], anchor + 5000);
  assert.deepEqual(
    selectEvents("b1")
      .map((e) => e.kind)
      .sort(),
    ["advancement", "join", "leave"],
  );
  ingestRoster("b1", [], anchor + 10000);
  assert.equal(selectEvents("b1").length, 4);
});
test("idempotent console sequences, distinct commands and bounded last-two-boot buckets", () => {
  const lines = [L(1, "[15:14:20 INFO]: A joined the game")];
  ingestConsole("b1", lines, { tz, anchor });
  ingestConsole("b1", lines, { tz, anchor });
  assert.equal(selectEvents("b1").length, 1);
  ingestConsole(
    "b1",
    [L(2, "[Command] A: /home"), L(3, "[Command] A: /spawn")],
    { tz, anchor },
  );
  assert.equal(selectEvents("b1").length, 3);
  assert.equal(selectEvents("b2").length, 0);
  ingestRoster("b2", [{ name: "B" }], anchor);
  assert.equal(selectEvents("b1").length, 3);
  ingestRoster("b3", [{ name: "C" }], anchor);
  assert.equal(selectEvents("b1").length, 0);
  assert.equal(selectEvents("b2").length, 1);
  ingestConsole(
    "b3",
    Array.from({ length: 700 }, (_, i) => ({
      ...L(i, `[Command] C: /test ${i}`),
      ts: anchor + i * 3000,
    })),
    { tz, anchor },
  );
  assert.equal(selectEvents("b3").length, 500);
});

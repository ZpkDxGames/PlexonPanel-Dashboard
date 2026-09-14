import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const workerCorePath = resolve(root, "relay/src/index-core.ts");
const standaloneCorePath = resolve(root, "relay/src/standalone/room-manager-core.ts");
const roomTestPath = resolve(root, "relay/tests/room.test.mjs");

async function replaceExactly(path, before, after, label) {
  const source = await readFile(path, "utf8");
  const count = source.split(before).length - 1;
  if (count === 0 && source.includes(after)) {
    process.stdout.write(`${label}: already applied\n`);
    return;
  }
  if (count !== 1)
    throw new Error(`${label}: expected exactly one source match, found ${count}`);
  await writeFile(path, source.replace(before, after), "utf8");
  process.stdout.write(`${label}: applied\n`);
}

const retiredCoordinationGuard = `    if (
      envelope.type === "backup.coordination" ||
      envelope.type === "backup.coordination.result" ||
      envelope.type === "maintenance.coordination" ||
      envelope.type === "maintenance.coordination.result"
    )
      throw new Error("Retired Paper backup coordination message");
`;

async function retireCoordination(path, label) {
  const source = await readFile(path, "utf8");
  if (source.includes(retiredCoordinationGuard)) {
    process.stdout.write(`${label}: already retired\n`);
    return;
  }
  const startMarker = `    if (envelope.type === "backup.coordination") {`;
  const endMarker = `    if (!AGENT_EVENTS.has(envelope.type)) return;`;
  const start = source.indexOf(startMarker);
  const end = start < 0 ? -1 : source.indexOf(endMarker, start);
  if (start < 0 || end < 0)
    throw new Error(`${label}: coordination block was not found exactly where expected`);
  const retired = source.slice(0, start) + retiredCoordinationGuard + source.slice(end);
  for (const forbidden of [
    `sendToAgent("PAPER", "backup.coordination"`,
    `sendToAgent("HOST", "backup.coordination.result"`,
    `sendToAgent("PAPER", "maintenance.coordination"`,
    `sendToAgent("HOST", "maintenance.coordination.result"`,
    "PAPER_COORDINATION_UNAVAILABLE",
    "COORDINATING_PAPER",
  ]) {
    if (retired.includes(forbidden))
      throw new Error(`${label}: retired coordination forwarding remains: ${forbidden}`);
  }
  await writeFile(path, retired, "utf8");
  process.stdout.write(`${label}: retired\n`);
}

async function retireRoomCoordinationTest() {
  const source = await readFile(roomTestPath, "utf8");
  const replacementTitle = `test("retired Paper backup and maintenance coordination are rejected and never forwarded"`;
  if (source.includes(replacementTitle)) {
    process.stdout.write("relay room coordination test: already retired\n");
    return;
  }
  const startMarker = `test("broken Paper peer delivery cannot retroactively reject healthy Host"`;
  const nextMarker = `test("client cannot exceed command, transfer, parameter or in-flight request limits"`;
  const start = source.indexOf(startMarker);
  const next = start < 0 ? -1 : source.indexOf(nextMarker, start);
  if (start < 0 || next < 0)
    throw new Error("relay room coordination test: legacy test block not found");
  const replacement = `test("retired Paper backup and maintenance coordination are rejected and never forwarded", async () => {
  const backupFixture = await fixture();
  const backupPaper = await attach(backupFixture, "PAPER");
  const backupHost = await attach(backupFixture, "HOST");
  backupPaper.socket.sent.length = 0;
  await backupHost.send("backup.coordination", {
    requestId: randomUUID(),
    leaseId: randomUUID(),
    operation: "prepare",
  });
  assert.equal(backupHost.socket.closed?.code, 4008);
  assert.equal(
    backupPaper.socket.sent.some((message) => message.type === "backup.coordination"),
    false,
  );

  const maintenanceFixture = await fixture();
  const maintenancePaper = await attach(maintenanceFixture, "PAPER");
  const maintenanceHost = await attach(maintenanceFixture, "HOST");
  maintenancePaper.socket.sent.length = 0;
  await maintenanceHost.send("maintenance.coordination", {
    requestId: randomUUID(),
    operation: "flush",
    automatic: false,
  });
  assert.equal(maintenanceHost.socket.closed?.code, 4008);
  assert.equal(
    maintenancePaper.socket.sent.some((message) => message.type === "maintenance.coordination"),
    false,
  );
});
`;
  await writeFile(roomTestPath, source.slice(0, start) + replacement + "\n" + source.slice(next), "utf8");
  process.stdout.write("relay room coordination test: retired\n");
}

await retireCoordination(standaloneCorePath, "standalone Paper backup coordination");
await retireCoordination(workerCorePath, "worker Paper backup coordination");
await retireRoomCoordinationTest();

await replaceExactly(
  standaloneCorePath,
  `        (action === "player.op" || action === "player.deop" || action.startsWith("backup.restore")) &&
        session.access.role !== "Owner"`,
  `        (action === "player.op" ||
          action === "player.deop" ||
          action.startsWith("backup.restore") ||
          action.startsWith("backup.full.restore")) &&
        session.access.role !== "Owner"`,
  "standalone full restore Owner gate",
);

await replaceExactly(
  workerCorePath,
  `        (action === "player.op" ||
          action === "player.deop" ||
          action.startsWith("backup.restore")) &&
        a.access!.role !== "Owner"`,
  `        (action === "player.op" ||
          action === "player.deop" ||
          action.startsWith("backup.restore") ||
          action.startsWith("backup.full.restore")) &&
        a.access!.role !== "Owner"`,
  "worker full restore Owner gate",
);

await replaceExactly(
  standaloneCorePath,
  `        action.startsWith("backup.") || (action.startsWith("server.") && action !== "server.status")
          ? "HOST"
          : "PAPER";`,
  `        action.startsWith("backup.") ||
        action.startsWith("maintenance.") ||
        action.startsWith("provider.") ||
        (action.startsWith("server.") && action !== "server.status")
          ? "HOST"
          : "PAPER";`,
  "standalone Host action routing",
);

await replaceExactly(
  workerCorePath,
  `        action.startsWith("backup.") ||
        (action.startsWith("server.") && action !== "server.status")
          ? "HOST"
          : "PAPER";`,
  `        action.startsWith("backup.") ||
        action.startsWith("maintenance.") ||
        action.startsWith("provider.") ||
        (action.startsWith("server.") && action !== "server.status")
          ? "HOST"
          : "PAPER";`,
  "worker Host action routing",
);

await replaceExactly(
  standaloneCorePath,
  '      version: "3.1.0",',
  '      version: "3.4.0",',
  "standalone ready version",
);

process.stdout.write(
  "Relay sources prepared with Step 5 manual-backup authority and retired Paper backup coordination.\n",
);

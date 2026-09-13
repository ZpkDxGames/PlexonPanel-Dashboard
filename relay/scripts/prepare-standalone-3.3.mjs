import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const roomPath = resolve(root, "relay/src/standalone/room-manager.ts");
const serverPath = resolve(root, "relay/src/standalone/server.ts");

async function replaceExactly(path, before, after, label) {
  const source = await readFile(path, "utf8");
  const count = source.split(before).length - 1;
  if (count === 0 && source.includes(after)) {
    process.stdout.write(`${label}: already applied\n`);
    return;
  }
  if (count !== 1) throw new Error(`${label}: expected exactly one source match, found ${count}`);
  await writeFile(path, source.replace(before, after), "utf8");
  process.stdout.write(`${label}: applied\n`);
}

await replaceExactly(
  serverPath,
  'const VERSION = "3.1.0";',
  'const VERSION = "3.3.0";',
  "standalone health version",
);

await replaceExactly(
  roomPath,
  '      version: "3.1.0",',
  '      version: "3.3.0",',
  "dashboard ready version",
);

await replaceExactly(
  roomPath,
  `    if (envelope.type === "backup.coordination.result") {
      if (session.kind !== "PAPER") throw new Error("Only Paper reports save leases");
      await this.sendToAgent("HOST", "backup.coordination.result", body);
      this.counters.messagesAccepted += 1;
      return;
    }
    if (envelope.type === "action.result") {`,
  `    if (envelope.type === "backup.coordination.result") {
      if (session.kind !== "PAPER") throw new Error("Only Paper reports save leases");
      await this.sendToAgent("HOST", "backup.coordination.result", body);
      this.counters.messagesAccepted += 1;
      return;
    }
    if (envelope.type === "maintenance.coordination") {
      if (session.kind !== "HOST") throw new Error("Only Host coordinates maintenance");
      requiredUuid(body.requestId, "requestId");
      const operation = requiredText(body.operation, "operation", 24);
      if (operation !== "notice" && operation !== "flush")
        throw new Error("Invalid maintenance operation");
      if (typeof body.automatic !== "boolean") throw new Error("Invalid maintenance mode");
      if (body.deviceId !== undefined) requiredUuid(body.deviceId, "deviceId");
      if (
        body.generation !== undefined &&
        (!Number.isSafeInteger(body.generation) || Number(body.generation) < 1)
      )
        throw new Error("Invalid maintenance generation");
      if (operation === "notice") {
        const message = requiredText(body.message, "message", 512);
        if (/[\\0\\r\\n]/.test(message)) throw new Error("Invalid maintenance message");
        if (body.title !== undefined && body.title !== null) {
          const title = requiredText(body.title, "title", 160);
          if (/[\\0\\r\\n]/.test(title)) throw new Error("Invalid maintenance title");
        }
      }
      await this.sendToAgent("PAPER", "maintenance.coordination", body);
      this.counters.messagesAccepted += 1;
      return;
    }
    if (envelope.type === "maintenance.coordination.result") {
      if (session.kind !== "PAPER") throw new Error("Only Paper reports maintenance coordination");
      requiredUuid(body.requestId, "requestId");
      const operation = requiredText(body.operation, "operation", 24);
      if (operation !== "notice" && operation !== "flush")
        throw new Error("Invalid maintenance operation");
      if (typeof body.success !== "boolean") throw new Error("Invalid maintenance result");
      await this.sendToAgent("HOST", "maintenance.coordination.result", body);
      this.counters.messagesAccepted += 1;
      return;
    }
    if (envelope.type === "action.result") {`,
  "maintenance coordination routing",
);

await replaceExactly(
  roomPath,
  `        (action === "player.op" || action === "player.deop" || action.startsWith("backup.restore")) &&
        session.access.role !== "Owner"`,
  `        (action === "player.op" ||
          action === "player.deop" ||
          action.startsWith("backup.restore") ||
          action.startsWith("backup.full.restore")) &&
        session.access.role !== "Owner"`,
  "full restore Owner gate",
);

await replaceExactly(
  roomPath,
  `        action.startsWith("backup.") || (action.startsWith("server.") && action !== "server.status")
          ? "HOST"
          : "PAPER";`,
  `        action.startsWith("backup.") ||
        action.startsWith("maintenance.") ||
        action.startsWith("provider.") ||
        (action.startsWith("server.") && action !== "server.status")
          ? "HOST"
          : "PAPER";`,
  "Host action routing",
);

process.stdout.write("Standalone relay source is prepared for PlexonPanel 3.3.0 compatibility.\n");

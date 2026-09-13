import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const workerCorePath = resolve(root, "relay/src/index-core.ts");
const standaloneCorePath = resolve(root, "relay/src/standalone/room-manager-core.ts");
const standaloneServerPath = resolve(root, "relay/src/standalone/server.ts");

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

const standaloneMaintenanceBefore = `    if (envelope.type === "backup.coordination.result") {
      if (session.kind !== "PAPER") throw new Error("Only Paper reports save leases");
      await this.sendToAgent("HOST", "backup.coordination.result", body);
      this.counters.messagesAccepted += 1;
      return;
    }
    if (envelope.type === "action.result") {`;

const standaloneMaintenanceAfter = `    if (envelope.type === "backup.coordination.result") {
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
    if (envelope.type === "action.result") {`;

const workerMaintenanceBefore = `    if (envelope.type === "backup.coordination.result") {
      if (a.kind !== "PAPER") throw new Error("Only Paper reports save leases");
      await this.sendToAgent("HOST", "backup.coordination.result", body);
      return;
    }
    if (envelope.type === "action.result") {`;

const workerMaintenanceAfter = `    if (envelope.type === "backup.coordination.result") {
      if (a.kind !== "PAPER") throw new Error("Only Paper reports save leases");
      await this.sendToAgent("HOST", "backup.coordination.result", body);
      return;
    }
    if (envelope.type === "maintenance.coordination") {
      if (a.kind !== "HOST") throw new Error("Only Host coordinates maintenance");
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
      return;
    }
    if (envelope.type === "maintenance.coordination.result") {
      if (a.kind !== "PAPER") throw new Error("Only Paper reports maintenance coordination");
      requiredUuid(body.requestId, "requestId");
      const operation = requiredText(body.operation, "operation", 24);
      if (operation !== "notice" && operation !== "flush")
        throw new Error("Invalid maintenance operation");
      if (typeof body.success !== "boolean") throw new Error("Invalid maintenance result");
      await this.sendToAgent("HOST", "maintenance.coordination.result", body);
      return;
    }
    if (envelope.type === "action.result") {`;

await replaceExactly(
  standaloneCorePath,
  standaloneMaintenanceBefore,
  standaloneMaintenanceAfter,
  "standalone maintenance coordination",
);

await replaceExactly(
  workerCorePath,
  workerMaintenanceBefore,
  workerMaintenanceAfter,
  "worker maintenance coordination",
);

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
  standaloneServerPath,
  'const VERSION = "3.1.0";',
  'const VERSION = "3.4.0";',
  "standalone health version",
);

await replaceExactly(
  standaloneCorePath,
  '      version: "3.1.0",',
  '      version: "3.4.0",',
  "standalone ready version",
);

process.stdout.write("Relay sources prepared with PlexonPanel 3.3 maintenance parity and 3.4 console support.\n");

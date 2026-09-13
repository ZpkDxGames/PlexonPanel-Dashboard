import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const workerAdapterPath = resolve(root, "relay/src/index.ts");
const standaloneAdapterPath = resolve(root, "relay/src/standalone/room-manager.ts");

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

for (const [path, label] of [
  [workerAdapterPath, "worker empty console snapshot tolerance"],
  [standaloneAdapterPath, "standalone empty console snapshot tolerance"],
]) {
  await replaceExactly(
    path,
    `  if (!Array.isArray(body.lines) || body.lines.length < 1 || body.lines.length > 100)\n    throw new Error("Event not allowed for host console batch");`,
    `  if (!Array.isArray(body.lines) || body.lines.length > 100)\n    throw new Error("Event not allowed for host console batch");`,
    label,
  );
}

await replaceExactly(
  workerAdapterPath,
  `  validateConsoleBatch(body);\n  if (attachment.consoleHealthy !== true)\n    throw new Error("Event not allowed while host console source is unavailable");`,
  `  validateConsoleBatch(body);\n  // SnapshotBatches intentionally emits a terminal empty batch for an empty replay. Host 3.4.0\n  // can therefore send console.lines with zero lines while the Minecraft service is stopped.\n  // Accept that authenticated empty snapshot as a no-op instead of tearing down the Host session.\n  if (Array.isArray(body.lines) && body.lines.length === 0) return;\n  // A freshly authenticated Host 3.4.0 can replay buffered lines immediately before its\n  // console.source status reaches the relay. Treat that valid ordering race as a bounded drop,\n  // not a protocol violation that tears down the authenticated Host session.\n  if (attachment.consoleHealthy !== true) return;`,
  "worker pre-authority console replay tolerance",
);

await replaceExactly(
  standaloneAdapterPath,
  `  validateConsoleBatch(body);\n  if (session.consoleHealthy !== true)\n    throw new Error("Event not allowed while host console source is unavailable");`,
  `  validateConsoleBatch(body);\n  // SnapshotBatches intentionally emits a terminal empty batch for an empty replay. Host 3.4.0\n  // can therefore send console.lines with zero lines while the Minecraft service is stopped.\n  // Accept that authenticated empty snapshot as a no-op instead of tearing down the Host session.\n  if (Array.isArray(body.lines) && body.lines.length === 0) return;\n  // A freshly authenticated Host 3.4.0 can replay buffered lines immediately before its\n  // console.source status reaches the relay. Treat that valid ordering race as a bounded drop,\n  // not a protocol violation that tears down the authenticated Host session.\n  if (session.consoleHealthy !== true) return;`,
  "standalone pre-authority console replay tolerance",
);

process.stdout.write("Relay console authority ordering and empty replay tolerance applied.\n");

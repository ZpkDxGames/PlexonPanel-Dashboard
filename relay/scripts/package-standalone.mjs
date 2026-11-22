import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { RELAY_VERSION } from "../dist/build-identity.js";

const root = resolve(import.meta.dirname, "../..");
const output = resolve(root, "artifacts/plexonpanel-relay");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true, mode: 0o755 });
await cp(resolve(root, "relay/dist"), resolve(output, "relay/dist"), { recursive: true });
await mkdir(resolve(output, "relay/scripts"));
await cp(
  resolve(root, "relay/scripts/bedrock-enrollment.mjs"),
  resolve(output, "relay/scripts/bedrock-enrollment.mjs"),
);
for (const example of ["plexonpanel-relay.service", "relay.env.example"]) {
  await cp(resolve(root, "relay/standalone", example), resolve(output, example));
}
await writeFile(resolve(output, "package.json"), `${JSON.stringify({
  name: "plexonpanel-standalone-relay",
  private: true,
  type: "module",
  engines: { node: "24.x" },
  version: RELAY_VERSION,
  scripts: { start: "node relay/dist/standalone/server.js" },
}, null, 2)}\n`, { mode: 0o644 });
process.stdout.write(`Standalone relay package: ${output}\n`);

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const output = resolve(root, "artifacts/plexonpanel-relay");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true, mode: 0o755 });
await cp(resolve(root, "relay/dist"), resolve(output, "relay/dist"), { recursive: true });
await cp(
  resolve(root, "relay/standalone/plexonpanel-relay.service"),
  resolve(output, "plexonpanel-relay.service"),
);
await cp(
  resolve(root, "relay/standalone/relay.env.example"),
  resolve(output, "relay.env.example"),
);
await cp(
  resolve(root, "relay/standalone/cloudflared-config.example.yml"),
  resolve(output, "cloudflared-config.example.yml"),
);
const sourcePackage = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
await writeFile(
  resolve(output, "package.json"),
  `${JSON.stringify(
    {
      name: "plexonpanel-standalone-relay",
      private: true,
      type: "module",
      engines: sourcePackage.engines,
      version: sourcePackage.version,
      scripts: { start: "node relay/dist/standalone/server.js" },
    },
    null,
    2,
  )}\n`,
  { mode: 0o644 },
);
process.stdout.write(`Standalone relay deployment directory: ${output}\n`);

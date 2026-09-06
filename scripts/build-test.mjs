import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const nextBin = join(projectRoot, "node_modules", "next", "dist", "bin", "next");

const result = spawnSync(process.execPath, [nextBin, "build"], {
  cwd: projectRoot,
  env: {
    ...process.env,
    NODE_ENV: "production",
    NEXT_PUBLIC_PLEXON_RELAY_URL: "https://relay.example.invalid",
  },
  stdio: "inherit",
});

if (result.error) throw result.error;
if (result.signal) {
  console.error(`Next.js test build stopped by ${result.signal}.`);
  process.exit(1);
}
process.exit(result.status ?? 1);

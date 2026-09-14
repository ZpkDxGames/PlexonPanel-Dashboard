import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(root, "relay/wrangler.jsonc");
const outputPath = resolve(root, "relay/wrangler.production.jsonc");
const gitCommit = (process.env.GITHUB_SHA ?? process.env.PLEXON_BUILD_GIT_COMMIT ?? "").trim();
const buildTimestamp = (process.env.PLEXON_BUILD_TIMESTAMP ?? new Date().toISOString()).trim();

if (!/^[0-9a-f]{40}$/i.test(gitCommit)) {
  throw new Error("A full 40-character accepted git commit is required to stamp the relay deployment.");
}
if (!Number.isFinite(Date.parse(buildTimestamp))) {
  throw new Error("A valid build timestamp is required to stamp the relay deployment.");
}

const source = await readFile(sourcePath, "utf8");
const config = JSON.parse(source);
config.vars = {
  ...(config.vars ?? {}),
  BUILD_GIT_COMMIT: gitCommit,
  BUILD_TIMESTAMP: new Date(buildTimestamp).toISOString(),
};
await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
process.stdout.write(`Stamped relay deployment for ${gitCommit.slice(0, 12)}\n`);

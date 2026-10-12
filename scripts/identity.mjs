import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const referenceCore = process.env.PLEXON_REFERENCE_CORE_COMMIT?.trim() || null;

writeFileSync(
  "dist/build.json",
  JSON.stringify(
    {
      dashboard: `PlexonPanel ${version}`,
      version,
      commit,
      builtAt: new Date().toISOString(),
      protocolVersion: 3,
      referenceDashboard: commit,
      referenceCore,
    },
    null,
    2,
  ),
);

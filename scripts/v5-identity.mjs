import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
let commit = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA;
if (!commit)
  try {
    commit = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    commit = "archive-source";
  }
mkdirSync("public", { recursive: true });
writeFileSync(
  "public/build.json",
  JSON.stringify(
    {
      dashboard: "PlexonPanel 5.0 Workbench",
      commit,
      builtAt: new Date().toISOString(),
      protocolVersion: 3,
      configurationSchema: 5,
    },
    null,
    2,
  ),
);

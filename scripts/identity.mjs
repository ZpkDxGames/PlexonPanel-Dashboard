import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
writeFileSync(
  "dist/build.json",
  JSON.stringify(
    {
      dashboard: "PlexonPanel 6.0.0",
      version: "6.0.0",
      commit,
      builtAt: new Date().toISOString(),
      protocolVersion: 3,
      referenceDashboard: "d19f94f8e0092bf7ab802be0977959a5c65b7641",
      referenceCore: "09deffc568e36828b4cb56c91f576b7f8524122c",
    },
    null,
    2,
  ),
);

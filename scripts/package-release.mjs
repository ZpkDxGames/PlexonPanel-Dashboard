import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFile, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { FLEET_CONTRACT_ID } from "../relay/dist/fleet-contract.js";
import { ACTION_CONTRACT_ID } from "../relay/dist/scopes.js";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "artifacts/plexonpanel-relay");
const sourcePackage = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
await copyFile(resolve(root, "package-lock.json"), resolve(output, "source-package-lock.json"));
const sourceCommit = (
  process.env.PLEXON_SOURCE_COMMIT ??
  process.env.GITHUB_SHA ??
  execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" })
).trim();
if (!/^[0-9a-f]{40}$/i.test(sourceCommit)) throw new Error("A full source commit is required");

// This is source-browser evidence only; production browser/runtime gates stay separate.
let browserEvidence = null;
await unlink(resolve(output, "ui-browser-evidence.json")).catch(error => { if (error.code !== "ENOENT") throw error; });
try {
  const path = resolve(root, "docs/ui-evidence/after/browser-results.json");
  const evidence = JSON.parse(await readFile(path, "utf8"));
  if (evidence.schemaVersion === 1 && evidence.sourceCommit === sourceCommit &&
      evidence.status === "PASS" && evidence.views?.length > 0 &&
      Array.isArray(evidence.errors) && evidence.errors.length === 0 &&
      evidence.accessibility?.length > 0 && evidence.accessibility.every(scan => Array.isArray(scan.violations) && scan.violations.length === 0)) {
    browserEvidence = { environment: evidence.environment, layouts: evidence.views.length,
      accessibilityScans: evidence.accessibility.length, browserVersion: evidence.browserVersion,
      productionRuntime: "NOT_EXECUTED" };
    await copyFile(path, resolve(output, "ui-browser-evidence.json"));
  }
} catch {
  // Missing/stale/malformed evidence cannot claim verification for this source.
}

async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else if (entry.isFile()) result.push(path);
  }
  return result.sort();
}

async function details(path) {
  const body = await readFile(path);
  return {
    sha256: createHash("sha256").update(body).digest("hex"),
    bytes: (await stat(path)).size,
  };
}

const artifacts = {};
for (const path of await files(output)) {
  const name = relative(output, path).replaceAll("\\", "/");
  if (name === "release-manifest.json" || name === "SHA256SUMS.txt") continue;
  artifacts[name] = await details(path);
}
const timestamp = execFileSync("git", ["show", "-s", "--format=%cI", sourceCommit], {
  cwd: root,
  encoding: "utf8",
}).trim();
const manifest = {
  version: sourcePackage.version,
  protocolVersion: 3,
  fleetContract: FLEET_CONTRACT_ID,
  actionContract: ACTION_CONTRACT_ID,
  configurationSchemas: { paper: 5, host: 5 },
  dashboardSourceCommit: sourceCommit,
  relaySourceCommit: sourceCommit,
  dashboardCiRun: /^\d+$/.test(process.env.GITHUB_RUN_ID ?? "")
    ? Number(process.env.GITHUB_RUN_ID)
    : null,
  node: process.versions.node,
  buildTimestamp: new Date(timestamp).toISOString(),
  runtimes: ["vercel-nextjs", "cloudflare-worker", "standalone-node"],
  certification: {
    source: "SOURCE_VERIFIED",
    ci: process.env.GITHUB_RUN_ID ? "CI_RUNNING" : "LOCAL_VERIFIED",
    deployment: "NOT_EXECUTED",
    runtime: "NOT_EXECUTED",
    migration: "NOT_EXECUTED",
    security: "SOURCE_TESTED_RUNTIME_NOT_EXECUTED",
    backup: "NOT_EXECUTED",
    browser: browserEvidence ? "SOURCE_BROWSER_VERIFIED_RUNTIME_NOT_EXECUTED" : "NOT_EXECUTED",
  },
  browserEvidence,
  artifacts,
};
await writeFile(
  resolve(output, "release-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(output, "SHA256SUMS.txt"),
  `${Object.entries(artifacts).map(([name, value]) => `${value.sha256}  ${name}`).join("\n")}\n`,
  "utf8",
);
process.stdout.write(`Packaged Dashboard/relay ${sourcePackage.version} manifest for ${sourceCommit}\n`);

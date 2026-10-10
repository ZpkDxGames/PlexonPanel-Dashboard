import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { dashboardProductionDecision, DASHBOARD_PRODUCTION_PATH, DASHBOARD_PREVIEW_PATH } from "../scripts/coordinated-deployment-policy.mjs";

const parent = "a".repeat(40);
const receipt = { ...JSON.parse(readFileSync(DASHBOARD_PRODUCTION_PATH, "utf8")), state: "READY",
  acceptedDashboardSourceCommit: parent, dashboardCiRun: 123,
  evidence: { check: "PASS", build: "PASS", browser: "PASS", axe: "PASS", audit: "PASS" } };
receipt.operatorDecision.approved = true;
const decide = changes => dashboardProductionDecision({ version: "6.0.0", receipt, parent,
  changedPaths: [DASHBOARD_PRODUCTION_PATH], environment: "production", branch: "main", ...changes });

test("six production requires exact source, automated evidence and scoped operator authorization", () => {
  assert.deepEqual(decide({}), { allowed: true, code: "OPERATOR_AUTHORIZED_SIX_DASHBOARD_PRODUCTION" });
  for (const changes of [
    { version: "5.0.0" }, { environment: "preview" }, { environment: null },
    { branch: "release/6.0.0" }, { receipt: null }, { parent: "c".repeat(40) },
    { changedPaths: [] }, { changedPaths: [DASHBOARD_PRODUCTION_PATH, "app/page.tsx"] },
    { changedPaths: [DASHBOARD_PREVIEW_PATH] },
  ]) assert.equal(decide(changes).allowed, false);
  for (const override of [
    { state: "HOLD" }, { schemaVersion: 2 }, { version: "5.0.0" }, { target: "dashboard-preview" },
    { branch: "release/6.0.0" }, { runtimeCertification: "PASS" },
    { acceptedCoreSourceCommit: "b".repeat(40) }, { acceptedDashboardSourceCommit: "invalid" },
    { dashboardCiRun: 0 }, { dashboardCiRun: 1.5 }, { dashboardCiRun: null }, { operatorDecision: null },
  ]) assert.equal(decide({ receipt: { ...receipt, ...override } }).allowed, false);
  for (const key of Object.keys(receipt.evidence))
    assert.equal(decide({ receipt: { ...receipt, evidence: { ...receipt.evidence, [key]: "NOT_EXECUTED" } } }).allowed, false);
  for (const key of Object.keys(receipt.scope))
    assert.equal(decide({ receipt: { ...receipt, scope: { ...receipt.scope, [key]: "other" } } }).allowed, false);
  for (const override of [
    { approved: false }, { intent: "DASHBOARD_PREVIEW" }, { deferLiveCertification: false },
    { confirmedAt: "invalid" }, { reason: " " }, { reason: "x".repeat(501) },
  ]) assert.equal(decide({ receipt: { ...receipt, operatorDecision: { ...receipt.operatorDecision, ...override } } }).allowed, false);
  for (const key of Object.keys(receipt.manualChecks))
    assert.equal(decide({ receipt: { ...receipt, manualChecks: { ...receipt.manualChecks, [key]: "PASS" } } }).allowed, false);
});

function fixture(callback) {
  const directory = mkdtempSync(join(tmpdir(), "plexon-six-production-"));
  try {
    mkdirSync(join(directory, "scripts")); mkdirSync(join(directory, "docs"));
    for (const file of ["coordinated-deployment.mjs", "coordinated-deployment-policy.mjs"])
      copyFileSync(join("scripts", file), join(directory, "scripts", file));
    writeFileSync(join(directory, "package.json"), JSON.stringify({ type: "module", version: "6.0.0" }));
    const config = { framework: "nextjs", buildCommand: "npm run build", installCommand: "npm ci" };
    writeFileSync(join(directory, "vercel.json"), JSON.stringify(config, null, 2) + "\n");
    writeFileSync(join(directory, DASHBOARD_PRODUCTION_PATH), JSON.stringify({ ...receipt, state: "HOLD" }));
    writeFileSync(join(directory, DASHBOARD_PREVIEW_PATH), JSON.stringify({ state: "HOLD" }));
    const git = args => execFileSync("git", args, { cwd: directory, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    git(["init", "-q"]); git(["config", "user.name", "Production fixture"]); git(["config", "user.email", "fixture@example.invalid"]);
    git(["add", "."]); git(["commit", "-qm", "Synthetic production source"]);
    const actualReceipt = { ...receipt, acceptedDashboardSourceCommit: git(["rev-parse", "HEAD"]) };
    writeFileSync(join(directory, DASHBOARD_PRODUCTION_PATH), JSON.stringify(actualReceipt));
    git(["add", "."]); git(["commit", "-qm", "Synthetic production activation"]);
    const run = (flag, extra = {}, cwd = directory) => spawnSync(process.execPath, ["scripts/coordinated-deployment.mjs", flag], {
      cwd, encoding: "utf8", env: { ...process.env, VERCEL: "1", VERCEL_ENV: "production",
        VERCEL_GIT_COMMIT_REF: "main", ...extra },
    });
    callback({ directory, git, config, run });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

test("six production CLI builds only its activation and never publishes the Worker", () => fixture(({ directory, run }) => {
  assert.equal(run("--require").status, 0);
  assert.match(run("--require").stdout, /OPERATOR_AUTHORIZED_SIX_DASHBOARD_PRODUCTION/);
  assert.equal(run("--vercel-ignore").status, 1);
  assert.equal(run("--require", { VERCEL: "0" }).status, 1);
  assert.equal(run("--require", { VERCEL_ENV: "preview" }).status, 1);
  assert.equal(run("--require", { VERCEL_GIT_COMMIT_REF: "other" }).status, 1);
  assert.equal(run("--require-worker").status, 1);
  assert.match(run("--require-worker").stdout, /WORKER_PUBLICATION_NOT_AUTHORIZED_FOR_DASHBOARD_RELEASE/);
  const output = join(directory, "github-output");
  assert.equal(run("--github-output", { GITHUB_OUTPUT: output }).status, 0);
  assert.equal(readFileSync(output, "utf8"), "allowed=true\nworker_allowed=false\n");
}));

test("six production rejects source changes and dirty activation worktrees", () => fixture(({ directory, git, run }) => {
  writeFileSync(join(directory, "unaccepted.mjs"), "export const changed = true;");
  assert.equal(run("--require").status, 1);
  assert.equal(run("--vercel-ignore").status, 0);
  git(["add", "."]); git(["commit", "--amend", "--no-edit", "-q"]);
  assert.equal(run("--require").status, 1);
  assert.match(run("--require").stdout, /ACTIVATION_COMMIT_CHANGED_SOURCE/);
}));

test("six production permits provider formatting alone and rejects changed config or missing ancestry", () => fixture(({ directory, config, run }) => {
  writeFileSync(join(directory, "vercel.json"), JSON.stringify(config));
  assert.equal(run("--require").status, 0);
  assert.equal(run("--require", { VERCEL: "0" }).status, 1);
  writeFileSync(join(directory, "vercel.json"), JSON.stringify({ ...config, buildCommand: "echo different" }));
  assert.equal(run("--require").status, 1);
  assert.match(run("--require").stdout, /ACTIVATION_VERCEL_CONFIG_CHANGED_KEYS/);
  const shallow = join(directory, "shallow-checkout");
  execFileSync("git", ["clone", "--quiet", "--depth", "1", pathToFileURL(directory).href, shallow], { stdio: "ignore" });
  assert.equal(run("--require", {}, shallow).status, 1);
  assert.match(run("--require", {}, shallow).stdout, /COORDINATION_CHECK_UNAVAILABLE/);
  assert.equal(run("--require-worker", {}, shallow).status, 1);
  assert.match(run("--require-worker", {}, shallow).stdout, /WORKER_PUBLICATION_NOT_AUTHORIZED_FOR_DASHBOARD_RELEASE/);
}));

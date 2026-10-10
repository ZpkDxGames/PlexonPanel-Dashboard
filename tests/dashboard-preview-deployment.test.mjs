import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { dashboardPreviewDecision, DASHBOARD_PREVIEW_PATH } from "../scripts/coordinated-deployment-policy.mjs";

const parent = "a".repeat(40);
const receipt = { schemaVersion: 1, version: "6.0.0", state: "READY", target: "dashboard-preview",
  branch: "release/6.0.0", acceptedDashboardSourceCommit: parent, acceptedCoreSourceCommit: "b".repeat(40),
  runtimeCertification: "NOT_EXECUTED", operatorDecision: { approved: true, intent: "DASHBOARD_PREVIEW",
    confirmedAt: "2026-10-10T14:47:42Z", reason: "Synthetic fixture: authorize only the Dashboard preview." } };
const decide = changes => dashboardPreviewDecision({ version: "6.0.0", receipt, parent,
  changedPaths: [DASHBOARD_PREVIEW_PATH], environment: "preview", branch: "release/6.0.0", ...changes });

test("six preview authorization is exact-source, branch-bound and never production certification", () => {
  assert.deepEqual(decide({}), { allowed: true, code: "DASHBOARD_ONLY_SIX_PREVIEW_DEPLOYMENT" });
  for (const changes of [
    { version: "6.0.0-rc.1" }, { environment: "production" }, { environment: null },
    { environment: "development" }, { branch: "main" }, { branch: "other" }, { receipt: null },
    { parent: "c".repeat(40) }, { changedPaths: [] }, { changedPaths: [DASHBOARD_PREVIEW_PATH, "app/page.tsx"] },
  ]) assert.equal(decide(changes).allowed, false);
  for (const override of [
    { state: "HOLD" }, { schemaVersion: 2 }, { version: "5.0.0" }, { target: "production" },
    { branch: "main" }, { runtimeCertification: "PASS" }, { acceptedCoreSourceCommit: "invalid" },
    { acceptedDashboardSourceCommit: "invalid" }, { operatorDecision: null },
  ]) assert.equal(decide({ receipt: { ...receipt, ...override } }).allowed, false);
  for (const override of [
    { approved: false }, { intent: "STABLE_RELEASE" }, { confirmedAt: "invalid" }, { reason: " " },
  ]) assert.equal(decide({ receipt: { ...receipt, operatorDecision: { ...receipt.operatorDecision, ...override } } }).allowed, false);
  assert.equal(decide({ environment: "production" }).code, "SIX_PRODUCTION_CERTIFICATION_REQUIRED");
});

function fixture(callback) {
  const directory = mkdtempSync(join(tmpdir(), "plexon-six-preview-"));
  try {
    mkdirSync(join(directory, "scripts")); mkdirSync(join(directory, "docs"));
    for (const file of ["coordinated-deployment.mjs", "coordinated-deployment-policy.mjs"])
      copyFileSync(join("scripts", file), join(directory, "scripts", file));
    writeFileSync(join(directory, "package.json"), JSON.stringify({ type: "module", version: "6.0.0" }));
    const config = { framework: "nextjs", buildCommand: "npm run build", installCommand: "npm ci" };
    writeFileSync(join(directory, "vercel.json"), JSON.stringify(config, null, 2) + "\n");
    writeFileSync(join(directory, DASHBOARD_PREVIEW_PATH), JSON.stringify({ ...receipt, state: "HOLD" }));
    const git = args => execFileSync("git", args, { cwd: directory, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    git(["init", "-q"]); git(["config", "user.name", "Preview fixture"]); git(["config", "user.email", "fixture@example.invalid"]);
    git(["add", "."]); git(["commit", "-qm", "Synthetic six source"]);
    const actualReceipt = { ...receipt, acceptedDashboardSourceCommit: git(["rev-parse", "HEAD"]) };
    writeFileSync(join(directory, DASHBOARD_PREVIEW_PATH), JSON.stringify(actualReceipt));
    git(["add", "."]); git(["commit", "-qm", "Synthetic preview-only activation"]);
    const run = (flag, extra = {}, cwd = directory) => spawnSync(process.execPath, ["scripts/coordinated-deployment.mjs", flag], {
      cwd, encoding: "utf8", env: { ...process.env, VERCEL: "1", VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "release/6.0.0", ...extra },
    });
    callback({ directory, git, config, actualReceipt, run });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

test("six CLI permits only the authorized preview and keeps Worker and production held", () => fixture(({ directory, run }) => {
  assert.equal(run("--require").status, 0);
  assert.match(run("--require").stdout, /DASHBOARD_ONLY_SIX_PREVIEW_DEPLOYMENT/);
  assert.equal(run("--vercel-ignore").status, 1);
  assert.equal(run("--require", { VERCEL: "0" }).status, 1);
  assert.equal(run("--require", { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" }).status, 1);
  assert.equal(run("--require", { VERCEL_GIT_COMMIT_REF: "another-branch" }).status, 1);
  assert.equal(run("--require-worker").status, 1);
  assert.match(run("--require-worker").stdout, /WORKER_PUBLICATION_NOT_AUTHORIZED_FOR_DASHBOARD_RELEASE/);
  const output = join(directory, "github-output");
  assert.equal(run("--github-output", { GITHUB_OUTPUT: output }).status, 0);
  assert.equal(readFileSync(output, "utf8"), "allowed=true\nworker_allowed=false\n");
}));

test("six CLI rejects dirty worktrees and activation commits that also change source", () => fixture(({ directory, git, run }) => {
  writeFileSync(join(directory, "unaccepted.mjs"), "export const changed = true;");
  assert.equal(run("--require").status, 1);
  assert.match(run("--require").stdout, /ACTIVATION_WORKTREE_PATHS/);
  git(["add", "."]); git(["commit", "--amend", "--no-edit", "-q"]);
  assert.equal(run("--require").status, 1);
  assert.match(run("--require").stdout, /ACTIVATION_COMMIT_CHANGED_SOURCE/);
}));

test("six provider formatting is tolerated only when config values agree; shallow ancestry stays held", () => fixture(({ directory, config, run }) => {
  writeFileSync(join(directory, "vercel.json"), JSON.stringify(config));
  assert.equal(run("--require").status, 0);
  assert.equal(run("--require", { VERCEL: "0" }).status, 1);
  writeFileSync(join(directory, "vercel.json"), JSON.stringify({ ...config, buildCommand: "echo different" }));
  assert.equal(run("--require").status, 1);
  assert.match(run("--require").stdout, /ACTIVATION_VERCEL_CONFIG_CHANGED_KEYS=\["buildCommand"\]/);
  const shallow = join(directory, "shallow-checkout");
  execFileSync("git", ["clone", "--quiet", "--depth", "1", pathToFileURL(directory).href, shallow], { stdio: "ignore" });
  assert.equal(run("--require", {}, shallow).status, 1);
  assert.match(run("--require", {}, shallow).stdout, /COORDINATION_CHECK_UNAVAILABLE/);
  assert.equal(run("--require-worker", {}, shallow).status, 1);
  assert.match(run("--require-worker", {}, shallow).stdout, /WORKER_PUBLICATION_NOT_AUTHORIZED_FOR_DASHBOARD_RELEASE/);
}));

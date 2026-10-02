import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { deploymentDecision, RECEIPT_PATH } from "../scripts/coordinated-deployment-policy.mjs";

const parent = "a".repeat(40);
const receipt = { schemaVersion: 1, version: "5.0.0", state: "READY", acceptedDashboardSourceCommit: parent,
  acceptedCoreSourceCommit: "b".repeat(40), dashboardCiRun: 1, coreCiRun: 2,
  evidence: { currentOperationalBackup: "PASS", offVpsIntegrity: "PASS", rollbackRehearsal: "PASS",
    operatorDeploymentReady: "PASS", ociBackup: "SKIPPED_OPERATOR_DECISION" } };
const decide = changes => deploymentDecision({ version: "5.0.0", receipt, parent, changedPaths: [RECEIPT_PATH], ...changes });

test("five is held until exact accepted source and executed coordination evidence", () => {
  assert.equal(decide({}).allowed, true);
  assert.equal(decide({ receipt: { ...receipt, state: "HOLD" } }).allowed, false);
  assert.equal(decide({ parent: "c".repeat(40) }).allowed, false);
  assert.equal(decide({ changedPaths: [RECEIPT_PATH, "relay/core.ts"] }).allowed, false);
  assert.equal(decide({ changedPaths: [] }).allowed, false);
  assert.equal(decide({ receipt: { ...receipt, evidence: { ...receipt.evidence, offVpsIntegrity: "NOT_VERIFIED" } } }).allowed, false);
  assert.equal(decide({ receipt: { ...receipt, coreCiRun: null } }).allowed, false);
  assert.equal(decide({ receipt: { ...receipt, acceptedCoreSourceCommit: "invalid" } }).allowed, false);
  assert.equal(decide({ version: "5.0.0-rc.1" }).allowed, false);
});
test("committed hold receipt cannot accidentally authorize five", () => {
  const committed = JSON.parse(readFileSync(RECEIPT_PATH, "utf8"));
  assert.equal(decide({ receipt: committed }).allowed, false);
});
test("Vercel exit convention and explicit deployment requirement agree with actual version", () => {
  const version = JSON.parse(readFileSync("package.json", "utf8")).version;
  const allowed = version === "4.0.0";
  const run = flag => spawnSync(process.execPath, ["scripts/coordinated-deployment.mjs", flag], { encoding: "utf8" });
  assert.equal(run("--vercel-ignore").status, allowed ? 1 : 0);
  assert.equal(run("--require").status, allowed ? 0 : 1);
  assert.equal(deploymentDecision({ version: "4.0.0" }).allowed, true);
});
test("actual activation ancestry, dirty source, preview hold and Vercel exit codes", () => {
  const directory = mkdtempSync(join(tmpdir(), "plexon-coordination-"));
  try {
    mkdirSync(join(directory, "scripts")); mkdirSync(join(directory, "docs"));
    for (const file of ["coordinated-deployment.mjs", "coordinated-deployment-policy.mjs"])
      copyFileSync(join("scripts", file), join(directory, "scripts", file));
    writeFileSync(join(directory, "package.json"), JSON.stringify({ type: "module", version: "5.0.0" }));
    writeFileSync(join(directory, RECEIPT_PATH), JSON.stringify({ ...receipt, state: "HOLD" }));
    const git = args => execFileSync("git", args, { cwd: directory, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    git(["init", "-q"]); git(["config", "user.name", "Coordination fixture"]); git(["config", "user.email", "fixture@example.invalid"]);
    git(["add", "."]); git(["commit", "-qm", "Synthetic source fixture"]);
    const actualParent = git(["rev-parse", "HEAD"]);
    writeFileSync(join(directory, RECEIPT_PATH), JSON.stringify({ ...receipt, acceptedDashboardSourceCommit: actualParent }));
    git(["add", "."]); git(["commit", "-qm", "Synthetic activation fixture"]);
    const run = (flag, extra = {}) => spawnSync(process.execPath, ["scripts/coordinated-deployment.mjs", flag], {
      cwd: directory, encoding: "utf8", env: { ...process.env, VERCEL: "0", ...extra },
    });
    assert.equal(run("--require").status, 0);
    assert.equal(run("--vercel-ignore").status, 1);
    const preview = { VERCEL: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feature" };
    assert.equal(run("--vercel-ignore", preview).status, 0);
    assert.equal(run("--require", preview).status, 1);
    assert.equal(run("--require", { VERCEL: "1", VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" }).status, 0);
    writeFileSync(join(directory, "unaccepted-source.mjs"), "export const changed = true;");
    assert.equal(run("--require").status, 1);
    rmSync(join(directory, "unaccepted-source.mjs"));
    writeFileSync(join(directory, "package.json"), JSON.stringify({ type: "module", version: "5.0.0", changed: true }));
    assert.equal(run("--require").status, 1);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

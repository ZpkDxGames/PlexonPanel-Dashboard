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

const exceptionReceipt = {
  ...receipt, schemaVersion: 2, legacyInstallationsRetained: true, runtimeCertification: "NOT_EXECUTED",
  evidence: { ...receipt.evidence, currentOperationalBackup: "SKIPPED_OPERATOR_DECISION",
    offVpsIntegrity: "SKIPPED_OPERATOR_DECISION", rollbackRehearsal: "NOT_EXECUTED_OPERATOR_ACCEPTED" },
  operatorDecision: { approved: true, intent: "STAGED_VPS_MIGRATION", confirmedAt: "2026-10-03T19:00:00Z",
    reason: "Synthetic fixture: operator accepts a staged rollout with explicit unverified evidence.",
    acceptedDashboardSourceCommit: parent, acceptedCoreSourceCommit: receipt.acceptedCoreSourceCommit,
    scope: { nodeId: "11111111-1111-4111-8111-111111111111", serverId: "22222222-2222-4222-8222-222222222222", instanceKey: "fixture" },
    exceptions: ["currentOperationalBackup", "offVpsIntegrity", "rollbackRehearsal"] },
};

test("operator exceptions distinguish staged deployment from executed evidence", () => {
  assert.deepEqual(decide({ receipt: exceptionReceipt }), { allowed: true, code: "OPERATOR_EXCEPTION_FIVE_STAGING_DEPLOYMENT" });
  const backupOnly = { ...exceptionReceipt, evidence: { ...exceptionReceipt.evidence, rollbackRehearsal: "PASS" },
    operatorDecision: { ...exceptionReceipt.operatorDecision, exceptions: ["currentOperationalBackup", "offVpsIntegrity"] } };
  assert.equal(decide({ receipt: backupOnly }).allowed, true);
  assert.equal(decide({ receipt: { ...backupOnly, evidence: { ...backupOnly.evidence, rollbackRehearsal: "NOT_EXECUTED" } } }).allowed, false);
  assert.equal(decide({ receipt: { ...exceptionReceipt, state: "HOLD" } }).allowed, false);
  assert.equal(decide({ receipt: { ...exceptionReceipt, schemaVersion: 1 } }).allowed, false);
  assert.equal(decide({ receipt: { ...exceptionReceipt, schemaVersion: 3 } }).allowed, false);
  assert.equal(decide({ receipt: { ...exceptionReceipt, legacyInstallationsRetained: false } }).allowed, false);
  assert.equal(decide({ receipt: { ...exceptionReceipt, runtimeCertification: "PASS" } }).allowed, false);
  assert.equal(decide({ receipt: { ...exceptionReceipt, coreCiRun: null } }).allowed, false);
  assert.equal(decide({ receipt: exceptionReceipt, parent: "c".repeat(40) }).allowed, false);
  assert.equal(decide({ receipt: exceptionReceipt, changedPaths: [RECEIPT_PATH, "app/page.tsx"] }).allowed, false);
});

test("incomplete, unapproved and overbroad operator exceptions fail closed", () => {
  for (const override of [
    { approved: false }, { approved: undefined }, { intent: "STABLE_RELEASE" },
    { confirmedAt: "invalid" }, { confirmedAt: "2026-10-03" }, { reason: " " },
    { scope: {} }, { scope: { ...exceptionReceipt.operatorDecision.scope, instanceKey: "../other" } },
    { acceptedDashboardSourceCommit: "c".repeat(40) }, { acceptedCoreSourceCommit: "c".repeat(40) },
    { exceptions: [] }, { exceptions: ["operatorDeploymentReady"] }, { exceptions: ["ociBackup"] },
    { exceptions: ["unknown"] }, { exceptions: ["currentOperationalBackup", "currentOperationalBackup"] },
    { exceptions: ["currentOperationalBackup"] },
  ]) assert.equal(decide({ receipt: { ...exceptionReceipt, operatorDecision: { ...exceptionReceipt.operatorDecision, ...override } } }).allowed, false);
  assert.equal(decide({ receipt: { ...exceptionReceipt, operatorDecision: null } }).allowed, false);
  for (const key of ["currentOperationalBackup", "offVpsIntegrity", "rollbackRehearsal", "operatorDeploymentReady", "ociBackup"])
    assert.equal(decide({ receipt: { ...exceptionReceipt, evidence: { ...exceptionReceipt.evidence, [key]: "NOT_VERIFIED" } } }).allowed, false);
});

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
test("committed receipt cannot authorize unrelated fixture ancestry", () => {
  const committed = JSON.parse(readFileSync(RECEIPT_PATH, "utf8"));
  assert.equal(decide({ receipt: committed }).allowed, false);
});
test("Vercel ignore and explicit build exit conventions agree for the current receipt", () => {
  const run = flag => spawnSync(process.execPath, ["scripts/coordinated-deployment.mjs", flag], {
    encoding: "utf8", env: { ...process.env, VERCEL: "0" },
  });
  const ignore = run("--vercel-ignore"), require = run("--require");
  assert.ok([0, 1].includes(require.status));
  assert.equal(ignore.status, require.status === 0 ? 1 : 0);
  assert.equal(ignore.stdout, require.stdout);
  assert.equal(deploymentDecision({ version: "4.0.0" }).allowed, true);
});
test("actual activation ancestry, dirty source, preview hold and Vercel exit codes", () => {
  for (const fixtureReceipt of [receipt, exceptionReceipt]) {
  const directory = mkdtempSync(join(tmpdir(), "plexon-coordination-"));
  const output = `${directory}-github-output`;
  try {
    mkdirSync(join(directory, "scripts")); mkdirSync(join(directory, "docs"));
    for (const file of ["coordinated-deployment.mjs", "coordinated-deployment-policy.mjs"])
      copyFileSync(join("scripts", file), join(directory, "scripts", file));
    writeFileSync(join(directory, "package.json"), JSON.stringify({ type: "module", version: "5.0.0" }));
    const vercelConfig = { framework: "nextjs", buildCommand: "npm run build", installCommand: "npm ci" };
    writeFileSync(join(directory, "vercel.json"), JSON.stringify(vercelConfig, null, 2) + "\n");
    writeFileSync(join(directory, RECEIPT_PATH), JSON.stringify({ ...fixtureReceipt, state: "HOLD" }));
    const git = args => execFileSync("git", args, { cwd: directory, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    git(["init", "-q"]); git(["config", "user.name", "Coordination fixture"]); git(["config", "user.email", "fixture@example.invalid"]);
    git(["add", "."]); git(["commit", "-qm", "Synthetic source fixture"]);
    const actualParent = git(["rev-parse", "HEAD"]);
    writeFileSync(join(directory, RECEIPT_PATH), JSON.stringify({ ...fixtureReceipt, acceptedDashboardSourceCommit: actualParent,
      ...(fixtureReceipt.operatorDecision ? { operatorDecision: { ...fixtureReceipt.operatorDecision, acceptedDashboardSourceCommit: actualParent } } : {}) }));
    git(["add", "."]); git(["commit", "-qm", "Synthetic activation fixture"]);
    const run = (flag, extra = {}) => spawnSync(process.execPath, ["scripts/coordinated-deployment.mjs", flag], {
      cwd: directory, encoding: "utf8", env: { ...process.env, VERCEL: "0", ...extra },
    });
    assert.equal(run("--require").status, 0);
    assert.equal(run("--vercel-ignore").status, 1);
    const preview = { VERCEL: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feature" };
    assert.equal(run("--vercel-ignore", preview).status, 0);
    assert.equal(run("--require", preview).status, 1);
    const production = { VERCEL: "1", VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" };
    assert.equal(run("--require", production).status, 0);
    writeFileSync(join(directory, "vercel.json"), JSON.stringify(vercelConfig));
    assert.equal(run("--require").status, 1);
    assert.equal(run("--require", production).status, 0);
    assert.equal(run("--require", preview).status, 1);
    writeFileSync(join(directory, "vercel.json"), JSON.stringify({ ...vercelConfig, buildCommand: "echo unexpected" }));
    assert.equal(run("--require", production).status, 1);
    assert.match(run("--require", production).stdout, /ACTIVATION_VERCEL_CONFIG_CHANGED_KEYS=\["buildCommand"\]/);
    writeFileSync(join(directory, "vercel.json"), JSON.stringify(vercelConfig, null, 2) + "\n");
    assert.equal(run("--github-output", { GITHUB_OUTPUT: output }).status, 0);
    assert.equal(readFileSync(output, "utf8"), `allowed=true\nworker_allowed=${fixtureReceipt.schemaVersion === 1}\n`);
    writeFileSync(output, "");
    assert.equal(run("--github-output", { ...preview, GITHUB_OUTPUT: output }).status, 0);
    assert.equal(readFileSync(output, "utf8"), "allowed=false\nworker_allowed=false\n");
    writeFileSync(join(directory, "unaccepted-source.mjs"), "export const changed = true;");
    assert.equal(run("--require").status, 1);
    assert.match(run("--require").stdout, /ACTIVATION_WORKTREE_PATHS=\["unaccepted-source.mjs"\]/);
    writeFileSync(output, "");
    assert.equal(run("--github-output", { GITHUB_OUTPUT: output }).status, 0);
    assert.equal(readFileSync(output, "utf8"), "allowed=false\nworker_allowed=false\n");
    rmSync(join(directory, "unaccepted-source.mjs"));
    writeFileSync(join(directory, "package.json"), JSON.stringify({ type: "module", version: "5.0.0", changed: true }));
    assert.equal(run("--require").status, 1);
  } finally { rmSync(output, { force: true }); rmSync(directory, { recursive: true, force: true }); }
  }
});

test("Cloudflare deployment consumes the Worker-specific authorization", () => {
  const workflow = readFileSync(".github/workflows/deploy-relay.yml", "utf8");
  assert.match(workflow, /worker_allowed: \$\{\{ steps\.gate\.outputs\.worker_allowed \}\}/);
  assert.match(workflow, /needs\.coordination\.outputs\.worker_allowed == 'true'/);
  assert.doesNotMatch(workflow, /needs\.coordination\.outputs\.allowed == 'true'/);
});

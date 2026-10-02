import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { deploymentDecision, RECEIPT_PATH } from "./coordinated-deployment-policy.mjs";

const root = resolve(import.meta.dirname, "..");
let result = { allowed: false, code: "COORDINATION_CHECK_UNAVAILABLE" };
try {
  const version = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).version;
  let receipt = null, parent = null, changedPaths = null;
  if (version === "5.0.0") {
    receipt = JSON.parse(readFileSync(resolve(root, RECEIPT_PATH), "utf8"));
    // No private data or provider credentials are read by this gate.
    if (receipt.state === "READY") {
      const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      parent = git(["rev-parse", "HEAD^"]);
      changedPaths = git(["diff", "--name-only", "HEAD^", "HEAD", "--"]).split("\n").filter(Boolean);
      // Local unstaged changes cannot ride an accepted activation commit.
      if (git(["status", "--porcelain", "--untracked-files=all"])) changedPaths.push("WORKTREE_CHANGED");
    }
  }
  result = deploymentDecision({ version, receipt, parent, changedPaths });
  if (version === "5.0.0" && process.env.VERCEL === "1"
      && (process.env.VERCEL_ENV !== "production" || process.env.VERCEL_GIT_COMMIT_REF !== "main"))
    result = { allowed: false, code: "FIVE_PREVIEW_DEPLOYMENT_HELD" };
} catch { /* Fail closed without printing parser input or command output. */ }

process.stdout.write(`${result.code}\n`);
if (process.argv.includes("--github-output")) {
  if (!process.env.GITHUB_OUTPUT) process.exit(1);
  appendFileSync(process.env.GITHUB_OUTPUT, `allowed=${result.allowed}\n`);
} else if (process.argv.includes("--vercel-ignore")) {
  process.exit(result.allowed ? 1 : 0);
} else {
  process.exit(result.allowed ? 0 : 1);
}

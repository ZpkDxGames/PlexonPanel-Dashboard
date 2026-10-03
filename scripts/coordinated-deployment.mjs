import { execFileSync } from "node:child_process";
import { appendFileSync, lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { deploymentDecision, RECEIPT_PATH } from "./coordinated-deployment-policy.mjs";

const root = resolve(import.meta.dirname, "..");
let result = { allowed: false, code: "COORDINATION_CHECK_UNAVAILABLE" };
let workerAllowed = false;
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
      const status = git(["status", "--porcelain", "--untracked-files=all"]);
      let equivalentVercelConfig = false;
      if (status === "M vercel.json" && process.env.VERCEL === "1"
          && process.env.VERCEL_ENV === "production" && process.env.VERCEL_GIT_COMMIT_REF === "main") {
        const info = lstatSync(resolve(root, "vercel.json"));
        if (info.isFile() && !info.isSymbolicLink() && !(info.mode & 0o111)) {
          const original = JSON.parse(git(["show", "HEAD:vercel.json"]));
          const current = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8"));
          equivalentVercelConfig = isDeepStrictEqual(original, current);
          if (!equivalentVercelConfig) {
            const keys = [...new Set([...Object.keys(original), ...Object.keys(current)])]
              .filter(key => !isDeepStrictEqual(original[key], current[key]));
            process.stdout.write(`ACTIVATION_VERCEL_CONFIG_CHANGED_KEYS=${JSON.stringify(keys)}\n`);
          }
        }
      }
      // Vercel rewrites this JSON while building. Only identical parsed values are accepted.
      // Local formatting edits, other files, and actual configuration changes still fail closed.
      if (status && !equivalentVercelConfig) {
        changedPaths.push("WORKTREE_CHANGED");
        // File names only: never print a diff, environment values, or file contents.
        const paths = [git(["diff", "--name-only", "HEAD", "--"]),
          git(["ls-files", "--others", "--exclude-standard"])].join("\n").split("\n").filter(Boolean);
        process.stdout.write(`ACTIVATION_WORKTREE_PATHS=${JSON.stringify(paths.slice(0, 30))}\n`);
      }
    }
  }
  result = deploymentDecision({ version, receipt, parent, changedPaths });
  if (version === "5.0.0" && process.env.VERCEL === "1"
      && (process.env.VERCEL_ENV !== "production" || process.env.VERCEL_GIT_COMMIT_REF !== "main"))
    result = { allowed: false, code: "FIVE_PREVIEW_DEPLOYMENT_HELD" };
  // Schema 2 authorizes a staged VPS migration; Worker publication is a separate target.
  workerAllowed = result.allowed && (version === "4.0.0" || receipt?.schemaVersion === 1);
} catch { /* Fail closed without printing parser input or command output. */ }

process.stdout.write(`${result.code}\n`);
if (process.argv.includes("--github-output")) {
  if (!process.env.GITHUB_OUTPUT) process.exit(1);
  appendFileSync(process.env.GITHUB_OUTPUT, `allowed=${result.allowed}\nworker_allowed=${workerAllowed}\n`);
} else if (process.argv.includes("--vercel-ignore")) {
  process.exit(result.allowed ? 1 : 0);
} else {
  process.exit(result.allowed ? 0 : 1);
}

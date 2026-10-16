import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], {encoding:"utf8"}).trim();
await mkdir("artifacts/nextgen/logs", { recursive: true });
const results = [];
const existing = [
  "browser-check",
  "control-plane-check",
  "reconstruction-check",
  "reference-check",
  "review-confirmation-check",
 ];
const names = process.argv.includes("--contracts-only") ? existing : [...existing,
  "nextgen-check", "nextgen-isolation-check", "nextgen-keyboard", "nextgen-action-parity", "visual-proofs", "extended-visual-proofs"
];
for (const name of names) {
  const p = spawn(process.execPath, [`scripts/${name}.mjs`], {
    env: process.env,
  });
  let out = "";
  p.stdout.on("data", (d) => (out += d));
  p.stderr.on("data", (d) => (out += d));
  const code = await new Promise((r) => p.on("exit", r));
  await writeFile(`artifacts/nextgen/logs/${name}.log`, out);
  results.push({ name, code, sourceHead, completedAt: new Date().toISOString() });
  console.log(JSON.stringify({ name, code, tail: out.slice(-1200) }));
  if (code) break;
}
await writeFile(
  "artifacts/nextgen/suite.json",
  JSON.stringify(results, null, 2),
);
if (results.some((r) => r.code)) process.exitCode = 1;

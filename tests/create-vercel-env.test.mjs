import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const generator = join(projectRoot, "scripts", "create-vercel-env.mjs");

function runGenerator(argumentsList) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [generator, ...argumentsList], {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => resolve({ code, stdout, stderr }));
  });
}

test("creates the one-variable Vercel import without Firebase credentials", async () => {
  const directory = await mkdtemp(join(tmpdir(), "plexonpanel-env-"));
  const outputPath = join(directory, ".env.vercel");
  const result = await runGenerator([
    "--relay-url", "https://plexonpanel-relay.example.workers.dev/",
    "--output", outputPath,
  ]);
  assert.equal(result.code, 0, result.stderr);
  const environment = await readFile(outputPath, "utf8");
  assert.equal(
    environment,
    "# Import into Vercel for PlexonPanel rc.2.\nNEXT_PUBLIC_PLEXON_RELAY_URL=\"https://plexonpanel-relay.example.workers.dev\"\n",
  );
  assert.doesNotMatch(environment, /FIREBASE|PRIVATE_KEY|SECRET|TOKEN/);
  if (process.platform !== "win32") assert.equal((await stat(outputPath)).mode & 0o777, 0o600);
});

test("rejects non-HTTPS relay URLs and accidental overwrites", async () => {
  const directory = await mkdtemp(join(tmpdir(), "plexonpanel-env-reject-"));
  const outputPath = join(directory, ".env.vercel");
  const insecure = await runGenerator(["--relay-url", "http://relay.example.com", "--output", outputPath]);
  assert.equal(insecure.code, 1);
  assert.match(insecure.stderr, /HTTPS/);
  const pathUrl = await runGenerator(["--relay-url", "https://relay.example.com/not-root", "--output", outputPath]);
  assert.equal(pathUrl.code, 1);
  assert.match(pathUrl.stderr, /without credentials, path/);
  const first = await runGenerator(["--relay-url", "https://relay.example.com", "--output", outputPath]);
  assert.equal(first.code, 0, first.stderr);
  const overwrite = await runGenerator(["--relay-url", "https://other.example.com", "--output", outputPath]);
  assert.equal(overwrite.code, 1);
  assert.match(overwrite.stderr, /Refusing to overwrite/);
});

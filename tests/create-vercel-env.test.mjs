import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
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
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code) => resolve({ code, stdout, stderr }));
  });
}

test("creates a complete Vercel env file without logging credentials", async () => {
  const directory = await mkdtemp(join(tmpdir(), "plexonpanel-env-"));
  const serviceAccountPath = join(directory, "service-account.json");
  const webConfigPath = join(directory, "web-config.json");
  const outputPath = join(directory, ".env.vercel");
  const fakePrivateKey =
    "-----BEGIN PRIVATE KEY-----\nTEST-PRIVATE-MATERIAL\n-----END PRIVATE KEY-----\n";

  await writeFile(
    serviceAccountPath,
    JSON.stringify({
      project_id: "test-project",
      client_email: "firebase-admin@example.invalid",
      private_key: fakePrivateKey,
    }),
  );
  await writeFile(
    webConfigPath,
    JSON.stringify({
      apiKey: "public-test-api-key",
      authDomain: "test-project.firebaseapp.com",
      projectId: "test-project",
      storageBucket: "test-project.firebasestorage.app",
      messagingSenderId: "123456789",
      appId: "1:123456789:web:test",
    }),
  );

  const result = await runGenerator([
    "--service-account",
    serviceAccountPath,
    "--web-config",
    webConfigPath,
    "--gateway-url",
    "https://gateway.example.com/",
    "--gateway-audience",
    "plexonpanel-gateway",
    "--output",
    outputPath,
  ]);

  assert.equal(result.code, 0, result.stderr);
  assert.doesNotMatch(result.stdout + result.stderr, /TEST-PRIVATE-MATERIAL/);

  const environment = await readFile(outputPath, "utf8");
  assert.match(environment, /NEXT_PUBLIC_FIREBASE_PROJECT_ID="test-project"/);
  assert.match(environment, /NEXT_PUBLIC_PLEXON_GATEWAY_URL="https:\/\/gateway\.example\.com"/);
  assert.match(environment, /FIREBASE_ADMIN_CLIENT_EMAIL="firebase-admin@example\.invalid"/);
  assert.match(environment, /FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n/);
  assert.match(environment, /PAIRING_CODE_PEPPER="[A-Za-z0-9_-]{64}"/);
  assert.match(environment, /SESSION_COOKIE_SECRET="[A-Za-z0-9_-]{80,}"/);

  if (process.platform !== "win32") {
    assert.equal((await stat(outputPath)).mode & 0o777, 0o600);
  }
});

test("rejects Firebase files from different projects", async () => {
  const directory = await mkdtemp(join(tmpdir(), "plexonpanel-env-mismatch-"));
  const serviceAccountPath = join(directory, "service-account.json");
  const webConfigPath = join(directory, "web-config.json");

  await writeFile(
    serviceAccountPath,
    JSON.stringify({
      project_id: "admin-project",
      client_email: "firebase-admin@example.invalid",
      private_key: "-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----\n",
    }),
  );
  await writeFile(
    webConfigPath,
    JSON.stringify({
      apiKey: "public-test-api-key",
      authDomain: "web-project.firebaseapp.com",
      projectId: "web-project",
      storageBucket: "web-project.firebasestorage.app",
      messagingSenderId: "123456789",
      appId: "1:123456789:web:test",
    }),
  );

  const result = await runGenerator([
    "--service-account",
    serviceAccountPath,
    "--web-config",
    webConfigPath,
    "--output",
    join(directory, ".env.vercel"),
  ]);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /belong to different projects/);
  assert.doesNotMatch(result.stderr, /TEST/);
});

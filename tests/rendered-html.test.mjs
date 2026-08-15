import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const nextBin = join(projectRoot, "node_modules", "next", "dist", "bin", "next");

let appProcess;
let baseUrl;
let processOutput = "";

async function getAvailablePort() {
  const server = createServer();
  server.unref();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const { port } = address;
  server.close();
  await once(server, "close");
  return port;
}

async function waitForApplication(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (appProcess.exitCode !== null) {
      throw new Error(`Next.js exited before becoming ready.\n${processOutput}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The production server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error(`Next.js did not become ready in time.\n${processOutput}`);
}

before(async () => {
  const port = await getAvailablePort();
  baseUrl = `http://127.0.0.1:${port}`;
  appProcess = spawn(
    process.execPath,
    [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        NODE_ENV: "production",
        FIREBASE_ADMIN_PROJECT_ID: "test-project",
        FIREBASE_ADMIN_CLIENT_EMAIL: "test@example.invalid",
        FIREBASE_ADMIN_PRIVATE_KEY:
          "-----BEGIN PRIVATE KEY-----\\nTEST\\n-----END PRIVATE KEY-----\\n",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const capture = (chunk) => {
    processOutput = `${processOutput}${chunk}`.slice(-12_000);
  };
  appProcess.stdout.on("data", capture);
  appProcess.stderr.on("data", capture);

  await waitForApplication(baseUrl);
}, { timeout: 45_000 });

after(async () => {
  if (!appProcess || appProcess.exitCode !== null) return;

  appProcess.kill("SIGTERM");
  const stopped = once(appProcess, "exit");
  const forcedStop = new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (appProcess.exitCode === null) appProcess.kill("SIGKILL");
      resolve();
    }, 5_000);
    timer.unref();
  });
  await Promise.race([stopped, forcedStop]);
});

test("renders the PlexonPanel dashboard shell", async () => {
  const response = await fetch(baseUrl, {
    headers: { accept: "text/html" },
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");

  const html = await response.text();
  assert.match(html, /<title>PlexonPanel Dashboard<\/title>/i);
});

test("reports Firebase Admin readiness without exposing credentials", async () => {
  const response = await fetch(`${baseUrl}/api/system/status`, {
    headers: { accept: "application/json" },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    service: "plexonpanel-dashboard",
    firebaseAdminConfigured: true,
  });
});

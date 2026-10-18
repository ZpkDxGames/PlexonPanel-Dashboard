import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { contentSecurityPolicy } from "../src/lib/csp";
test("production nonce CSP restricts relay HTTP/WSS origins without eval or wildcard", () => {
  const csp = contentSecurityPolicy(
    "test-nonce",
    "https://tonimserver.ddns.net",
  );
  assert.match(
    csp,
    /connect-src 'self' https:\/\/tonimserver\.ddns\.net wss:\/\/tonimserver\.ddns\.net;/,
  );
  assert.match(csp, /'nonce-test-nonce'/);
  assert.doesNotMatch(csp, /unsafe-eval|connect-src[^;]*\*/);
  assert.match(csp, /frame-ancestors 'none'/);
  const v = JSON.parse(
    readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
  );
  assert.equal(v.framework, "nextjs");
  assert.equal(
    v.outputDirectory,
    ".next",
    "Vercel must use Next output rather than a retained project-level dist override",
  );
  assert.equal(v.git.deploymentEnabled.main, true);
  assert.equal(v.git.deploymentEnabled["release/v5-nextjs-20261017"], false);
});

test("Next configuration migrates the installed public relay origin without exposing other environment keys", async () => {
  const previous = {
    next: process.env.NEXT_PUBLIC_PLEXON_RELAY_URL,
    vite: process.env.VITE_PLEXON_RELAY_URL,
  };
  try {
    delete process.env.NEXT_PUBLIC_PLEXON_RELAY_URL;
    process.env.VITE_PLEXON_RELAY_URL = "https://legacy-relay.example";
    const config = (
      await import(
        new URL("../next.config.mjs?legacy-relay-contract", import.meta.url)
          .href
      )
    ).default;
    assert.deepEqual(config.env, {
      NEXT_PUBLIC_PLEXON_RELAY_URL: "https://legacy-relay.example",
    });
  } finally {
    const original: [string, string | undefined][] = [
      ["NEXT_PUBLIC_PLEXON_RELAY_URL", previous.next],
      ["VITE_PLEXON_RELAY_URL", previous.vite],
    ];
    for (const [key, value] of original) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("build identity creates the public directory in a clean checkout", () => {
  const cwd = mkdtempSync(`${tmpdir()}/plexon-identity-`),
    env: NodeJS.ProcessEnv = {
      ...process.env,
      GITHUB_SHA: "0123456789012345678901234567890123456789",
    };
  delete env.VERCEL_GIT_COMMIT_SHA;
  try {
    execFileSync(
      process.execPath,
      [fileURLToPath(new URL("../scripts/v5-identity.mjs", import.meta.url))],
      { cwd, env },
    );
    const identity = JSON.parse(
      readFileSync(`${cwd}/public/build.json`, "utf8"),
    );
    assert.equal(identity.commit, env.GITHUB_SHA);
    assert.equal(identity.protocolVersion, 3);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

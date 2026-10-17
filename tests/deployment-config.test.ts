import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { harness } from "./v5-harness.mjs";
await harness(
  async ({ origin, output }) => {
    const results = [];
    const nonces = new Set();
    for (const route of [
      "overview",
      "console",
      "backups",
      "settings",
      "overview",
    ]) {
      const response = await fetch(`${origin}/${route}`);
      assert.equal(response.status, 200);
      const csp = response.headers.get("content-security-policy") ?? "";
      const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
      assert(nonce);
      assert(!nonces.has(nonce), "Every HTML request needs a fresh nonce");
      nonces.add(nonce);
      assert(!csp.includes("unsafe-eval"));
      assert(
        csp.includes(
          "connect-src 'self' https://tonimserver.ddns.net wss://tonimserver.ddns.net;",
        ),
      );
      assert(csp.includes("frame-ancestors 'none'"));
      assert.match(response.headers.get("cache-control") ?? "", /no-store/);
      assert.equal(response.headers.get("x-powered-by"), null);
      const html = await response.text();
      const scripts = [...html.matchAll(/<script\b([^>]*)>/g)];
      assert(scripts.length > 0);
      assert(
        scripts.every(([, attributes]) =>
          attributes.includes(`nonce="${nonce}"`),
        ),
        "Next bootstrap scripts require the request nonce",
      );
      assert(!html.includes("DEVELOPMENT FIXTURE"));
      results.push({
        route,
        status: "PASS",
        nonceAppliedToScripts: scripts.length,
        noStore: true,
      });
    }
    const result = {
      scope:
        "Local Next production HTTP responses only; no relay/Vercel request",
      perRequestNonces: nonces.size,
      results,
    };
    writeFileSync(`${output}/result.json`, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  },
  {
    tag: "v5-production-security",
    port:4313,
    production: true,
    env: { NEXT_PUBLIC_PLEXON_RELAY_URL: "https://tonimserver.ddns.net" },
  },
);

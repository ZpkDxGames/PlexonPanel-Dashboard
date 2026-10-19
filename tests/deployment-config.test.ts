import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("production CSP permits only the verified relay HTTP and WebSocket origins", () => {
  const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8"),
    csp = proxy.match(/const csp = `([^`]+)`/)?.[1];
  assert.ok(proxy.includes('r.headers.set("Content-Security-Policy", csp)'));

  assert.equal(typeof csp, "string");
  assert.ok(csp);
  assert.match(
    csp,
    /connect-src 'self' https:\/\/tonimserver\.ddns\.net wss:\/\/tonimserver\.ddns\.net;/,
  );
  assert.doesNotMatch(csp, /connect-src[^;]*\*/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("production CSP permits only the verified relay HTTP and WebSocket origins", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const csp = config.headers
    .flatMap((entry: { headers?: { key?: string; value?: string }[] }) => entry.headers ?? [])
    .find((header: { key?: string }) => header.key === "Content-Security-Policy")?.value;

  assert.equal(typeof csp, "string");
  assert.match(
    csp,
    /connect-src 'self' https:\/\/tonimserver\.ddns\.net wss:\/\/tonimserver\.ddns\.net;/,
  );
  assert.doesNotMatch(csp, /connect-src[^;]*\*/);
});

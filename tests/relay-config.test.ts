import { test } from "node:test";
import assert from "node:assert/strict";
import { publicRelayOrigin } from "../scripts/relay-env";
import { normalizeRelayOrigin, relayOriginFromPairing, resolveRelayConfiguration, browserRelayConfiguration } from "../src/adapter/relay-config";

test("the working deployment's public relay variable migrates without exposing private credentials", () => {
  const env = {NEXT_PUBLIC_PLEXON_RELAY_URL: " https://relay.example ", CLOUDFLARE_API_TOKEN: "synthetic-private-token", RELAY_SIGNING_PRIVATE_KEY: "synthetic-private-key"};
  assert.equal(publicRelayOrigin(env), "https://relay.example");
  assert.equal(publicRelayOrigin({...env, VITE_PLEXON_RELAY_URL: "https://override.example"}), "https://override.example");
  assert.equal(publicRelayOrigin({CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN}), "");
});
test("relay selection preserves explicit browser overrides, legacy deployment defaults and bound pairing fallback", () => {
  const credential = {websocketUrl: "wss://paired.example/v1/dashboard"};
  assert.deepEqual(resolveRelayConfiguration({credential}), {origin: "https://paired.example", source: "pairing", error: ""});
  assert.equal(resolveRelayConfiguration({credential, deploymentOrigin: "https://deployment.example"}).source, "deployment");
  assert.equal(resolveRelayConfiguration({credential, deploymentOrigin: "https://deployment.example", browserOrigin: "https://manual.example"}).origin, "https://manual.example");
  const invalid = resolveRelayConfiguration({credential, browserOrigin: "http://untrusted.example"});
  assert.equal(invalid.origin, ""); assert.equal(invalid.source, "browser"); assert.match(invalid.error, /HTTPS/);
});
test("relay origins reject credential-bearing URLs and unsafe stored WebSocket endpoints", () => {
  for (const origin of ["https://user:password@relay.example", "https://relay.example/path", "https://relay.example?token=synthetic", "https://relay.example#fragment", "http://remote.example", "file:///tmp/relay"]) assert.throws(() => normalizeRelayOrigin(origin));
  for (const websocketUrl of ["wss://relay.example/wrong", "wss://relay.example/v1/dashboard?token=synthetic", "ws://remote.example/v1/dashboard", "wss://user:password@relay.example/v1/dashboard"]) assert.throws(() => relayOriginFromPairing({websocketUrl}));
  assert.equal(normalizeRelayOrigin("https://relay.example/"), "https://relay.example");
  assert.equal(relayOriginFromPairing({websocketUrl: "ws://[::1]:8080/v1/dashboard"}), "http://[::1]:8080");
});
test("a blocked preference store does not prevent recovery of an existing browser pairing", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {configurable: true, get() { throw new Error("storage blocked"); }});
  try { assert.equal(browserRelayConfiguration({websocketUrl: "wss://paired.example/v1/dashboard"} as never).origin, "https://paired.example"); }
  finally { if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor); else Reflect.deleteProperty(globalThis, "localStorage"); }
});

import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadStandaloneConfig } from "../dist/standalone/config.js";
import { createStandaloneRelay } from "../dist/standalone/server.js";

const directory = await mkdtemp(join(tmpdir(), "plexonpanel-standalone-smoke-"));
const pair = generateKeyPairSync("ed25519");
const encode = (key, type) => key.export({ format: "der", type }).toString("base64");
const config = await loadStandaloneConfig({
  PLEXON_RELAY_HOST: "127.0.0.1",
  PLEXON_RELAY_PORT: "8787",
  PLEXON_RELAY_DATABASE_PATH: join(directory, "relay.db"),
  PLEXON_RELAY_DASHBOARD_ORIGINS: "https://dashboard.example.test",
  PAIRING_CODE_PEPPER: "p".repeat(48),
  ACCESS_TOKEN_SECRET: "a".repeat(48),
  GATEWAY_ED25519_PRIVATE_KEY: encode(pair.privateKey, "pkcs8"),
  GATEWAY_ED25519_PUBLIC_KEY: encode(pair.publicKey, "spki"),
});
const relay = createStandaloneRelay({ ...config, port: 0 });
try {
  await relay.start();
  const address = relay.server.address();
  if (!address || typeof address !== "object") throw new Error("Relay did not bind");
  const response = await fetch(`http://127.0.0.1:${address.port}/healthz`);
  const body = await response.json();
  if (!response.ok || body.runtime !== "standalone" || body.protocolVersion !== 3)
    throw new Error(`Unexpected standalone health response: ${JSON.stringify(body)}`);
  process.stdout.write(`standalone relay smoke ok on ephemeral port ${address.port}\n`);
} finally {
  await relay.close();
  await rm(directory, { recursive: true, force: true });
}

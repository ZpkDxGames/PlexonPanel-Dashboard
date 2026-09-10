import { access, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { constants } from "node:fs";
import { fromBase64 } from "../protocol.js";

export interface StandaloneConfig {
  host: string;
  port: number;
  databasePath: string;
  dashboardOrigins: ReadonlySet<string>;
  pairingCodePepper: string;
  accessTokenSecret: string;
  relayPrivateKey: string;
  relayPublicKey: string;
  dashboardLimit: number;
  unauthenticatedLimit: number;
  handshakeTimeoutMs: number;
  gracefulShutdownMs: number;
  trustedProxy: "none" | "cloudflare-loopback";
  allowPublicBind: boolean;
}

const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost"]);

export async function loadStandaloneConfig(
  env: NodeJS.ProcessEnv = process.env,
): Promise<StandaloneConfig> {
  const host = text(env.PLEXON_RELAY_HOST, "PLEXON_RELAY_HOST", "127.0.0.1");
  const allowPublicBind = boolean(env.PLEXON_RELAY_ALLOW_PUBLIC_BIND, false);
  if (!LOOPBACK.has(host) && !allowPublicBind) {
    throw new Error(
      "PLEXON_RELAY_HOST must be loopback unless PLEXON_RELAY_ALLOW_PUBLIC_BIND=true is set intentionally.",
    );
  }

  const port = integer(env.PLEXON_RELAY_PORT, "PLEXON_RELAY_PORT", 8787, 1, 65535);
  const databasePath = resolve(
    text(
      env.PLEXON_RELAY_DATABASE_PATH,
      "PLEXON_RELAY_DATABASE_PATH",
      "./relay.db",
    ),
  );
  if (databasePath === "/" || databasePath.endsWith("/.."))
    throw new Error("PLEXON_RELAY_DATABASE_PATH is unsafe");

  const origins = csv(env.PLEXON_RELAY_DASHBOARD_ORIGINS);
  if (!origins.length) throw new Error("PLEXON_RELAY_DASHBOARD_ORIGINS is required");
  const dashboardOrigins = new Set<string>();
  for (const originText of origins) {
    if (originText === "*") throw new Error("Wildcard dashboard origins are forbidden");
    const origin = new URL(originText);
    if (origin.origin !== originText || !["https:", "http:"].includes(origin.protocol))
      throw new Error(`Invalid exact dashboard origin: ${originText}`);
    if (origin.protocol === "http:" && !LOOPBACK.has(origin.hostname))
      throw new Error(`Non-loopback dashboard origin must use HTTPS: ${originText}`);
    dashboardOrigins.add(origin.origin);
  }

  const pairingCodePepper = secret(env.PAIRING_CODE_PEPPER, "PAIRING_CODE_PEPPER");
  const accessTokenSecret = secret(env.ACCESS_TOKEN_SECRET, "ACCESS_TOKEN_SECRET");
  const relayPrivateKey = required(env.GATEWAY_ED25519_PRIVATE_KEY, "GATEWAY_ED25519_PRIVATE_KEY");
  const relayPublicKey = required(env.GATEWAY_ED25519_PUBLIC_KEY, "GATEWAY_ED25519_PUBLIC_KEY");
  await verifyRelayKeyPair(relayPrivateKey, relayPublicKey);

  const trustedProxyRaw = text(
    env.PLEXON_RELAY_TRUSTED_PROXY,
    "PLEXON_RELAY_TRUSTED_PROXY",
    "cloudflare-loopback",
  );
  if (trustedProxyRaw !== "none" && trustedProxyRaw !== "cloudflare-loopback")
    throw new Error("PLEXON_RELAY_TRUSTED_PROXY must be none or cloudflare-loopback");

  const config: StandaloneConfig = {
    host,
    port,
    databasePath,
    dashboardOrigins,
    pairingCodePepper,
    accessTokenSecret,
    relayPrivateKey,
    relayPublicKey,
    dashboardLimit: integer(
      env.PLEXON_RELAY_DASHBOARD_LIMIT,
      "PLEXON_RELAY_DASHBOARD_LIMIT",
      12,
      1,
      64,
    ),
    unauthenticatedLimit: integer(
      env.PLEXON_RELAY_UNAUTHENTICATED_LIMIT,
      "PLEXON_RELAY_UNAUTHENTICATED_LIMIT",
      8,
      1,
      32,
    ),
    handshakeTimeoutMs: integer(
      env.PLEXON_RELAY_HANDSHAKE_TIMEOUT_MS,
      "PLEXON_RELAY_HANDSHAKE_TIMEOUT_MS",
      15_000,
      5_000,
      60_000,
    ),
    gracefulShutdownMs: integer(
      env.PLEXON_RELAY_GRACEFUL_SHUTDOWN_MS,
      "PLEXON_RELAY_GRACEFUL_SHUTDOWN_MS",
      10_000,
      1_000,
      60_000,
    ),
    trustedProxy: trustedProxyRaw,
    allowPublicBind,
  };

  await mkdir(dirname(databasePath), { recursive: true, mode: 0o750 });
  await access(dirname(databasePath), constants.R_OK | constants.W_OK);
  return config;
}

async function verifyRelayKeyPair(privateBase64: string, publicBase64: string): Promise<void> {
  try {
    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      fromBase64(privateBase64),
      { name: "Ed25519" },
      false,
      ["sign"],
    );
    const publicKey = await crypto.subtle.importKey(
      "spki",
      fromBase64(publicBase64),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const probe = crypto.getRandomValues(new Uint8Array(32));
    const signature = await crypto.subtle.sign("Ed25519", privateKey, probe);
    if (!(await crypto.subtle.verify("Ed25519", publicKey, signature, probe)))
      throw new Error("Relay keypair does not match");
  } catch (error) {
    throw new Error(
      `Invalid relay Ed25519 keypair: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

function csv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function required(value: string | undefined, name: string): string {
  const result = value?.trim() ?? "";
  if (!result) throw new Error(`${name} is required`);
  return result;
}

function secret(value: string | undefined, name: string): string {
  const result = required(value, name);
  if (result.length < 32) throw new Error(`${name} must contain at least 32 characters`);
  return result;
}

function text(value: string | undefined, name: string, fallback: string): string {
  const result = value?.trim() || fallback;
  if (result.length > 4096) throw new Error(`${name} is too long`);
  return result;
}

function integer(
  value: string | undefined,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = value === undefined || value.trim() === "" ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum)
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  return parsed;
}

function boolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("Boolean environment values must be true or false");
}

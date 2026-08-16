import { fromBase64Url, toBase64Url } from "./protocol.js";

const SIX_DIGIT_CODE = /^\d{6}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface DashboardAccess {
  version: 1;
  audience: "plexonpanel-relay";
  serverId: string;
  deviceId: string;
  generation: number;
  issuedAt: number;
  expiresAt: number;
}

export function normalizePairingCode(value: unknown): string {
  const code = typeof value === "string" ? value.trim() : "";
  if (!SIX_DIGIT_CODE.test(code)) throw new Error("A six-digit pairing code is required");
  return code;
}

export async function pairingLookupId(code: string, pepper: string): Promise<string> {
  return hmacHex(`pairing:${normalizePairingCode(code)}`, pepper);
}

export async function opaqueClientKey(address: string, pepper: string): Promise<string> {
  return hmacHex(`client:${address}`, pepper);
}

export async function signDashboardAccess(access: DashboardAccess, secret: string): Promise<string> {
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(access)));
  const signature = await hmacBytes(encoded, secret);
  return `${encoded}.${toBase64Url(signature)}`;
}

export async function verifyDashboardAccess(
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<DashboardAccess> {
  const [encoded, supplied, extra] = token.split(".");
  if (!encoded || !supplied || extra) throw new Error("Malformed dashboard token");
  const key = await hmacKey(secret, ["verify"]);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    fromBase64Url(supplied),
    new TextEncoder().encode(encoded),
  );
  if (!valid) throw new Error("Invalid dashboard token");
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded)));
  } catch {
    throw new Error("Invalid dashboard token payload");
  }
  if (!isAccess(parsed)) throw new Error("Invalid dashboard token claims");
  if (parsed.issuedAt > nowSeconds + 30 || parsed.expiresAt <= nowSeconds || parsed.expiresAt - parsed.issuedAt > 2_592_000) {
    throw new Error("Dashboard token expired");
  }
  return parsed;
}

async function hmacHex(value: string, secret: string): Promise<string> {
  return [...await hmacBytes(value, secret)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacBytes(value: string, secret: string): Promise<Uint8Array> {
  const key = await hmacKey(secret, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

function hmacKey(secret: string, usages: KeyUsage[]): Promise<CryptoKey> {
  if (secret.length < 32) throw new Error("Relay secret is not configured securely");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
}

function isAccess(value: unknown): value is DashboardAccess {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const access = value as Record<string, unknown>;
  return access.version === 1
    && access.audience === "plexonpanel-relay"
    && typeof access.serverId === "string"
    && UUID.test(access.serverId)
    && typeof access.deviceId === "string"
    && UUID.test(access.deviceId)
    && Number.isInteger(access.generation)
    && Number(access.generation) >= 1
    && Number.isInteger(access.issuedAt)
    && Number.isInteger(access.expiresAt);
}

import { createHmac, timingSafeEqual } from "node:crypto";

const SIX_DIGIT_CODE = /^\d{6}$/;

export interface DashboardAccessToken {
  version: 1;
  audience: "plexonpanel-gateway";
  scope: "dashboard:read";
  serverId: string;
  deviceId: string;
  issuedAt: number;
  expiresAt: number;
}

function hmac(value: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(value, "utf8").digest();
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function safeEqualText(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function normalizePairingCode(value: unknown): string {
  const code = typeof value === "string" ? value.trim() : "";
  if (!SIX_DIGIT_CODE.test(code)) {
    throw new Error("A six-digit pairing code is required");
  }
  return code;
}

export function pairingLookupId(code: string, pepper: string): string {
  return hmac(`lookup:${normalizePairingCode(code)}`, pepper).toString("hex");
}

export function pairingVerificationHash(challengeId: string, code: string, pepper: string): string {
  return hmac(`verify:${challengeId}:${normalizePairingCode(code)}`, pepper).toString("base64url");
}

export function verifyPairingHash(
  expected: string,
  challengeId: string,
  code: string,
  pepper: string,
): boolean {
  const actual = pairingVerificationHash(challengeId, code, pepper);
  return safeEqualText(expected, actual);
}

export function signDashboardAccessToken(
  payload: DashboardAccessToken,
  secret: string,
): string {
  const encoded = encodeJson(payload);
  return `${encoded}.${hmac(encoded, secret).toString("base64url")}`;
}

export function verifyDashboardAccessToken(
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): DashboardAccessToken {
  const segments = token.split(".");
  if (segments.length !== 2 || !segments[0] || !segments[1]) {
    throw new Error("Malformed dashboard access token");
  }
  const [encoded, signature] = segments;
  const expected = hmac(encoded, secret).toString("base64url");
  if (!safeEqualText(signature, expected)) {
    throw new Error("Invalid dashboard access token signature");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid dashboard access token payload");
  }
  if (!isDashboardAccessToken(parsed)) {
    throw new Error("Invalid dashboard access token claims");
  }
  if (parsed.issuedAt > nowSeconds + 30 || parsed.expiresAt <= nowSeconds || parsed.expiresAt - parsed.issuedAt > 600) {
    throw new Error("Expired or invalid dashboard access token lifetime");
  }
  return parsed;
}

function isDashboardAccessToken(value: unknown): value is DashboardAccessToken {
  if (value === null || typeof value !== "object") return false;
  const token = value as Record<string, unknown>;
  return token.version === 1
    && token.audience === "plexonpanel-gateway"
    && token.scope === "dashboard:read"
    && typeof token.serverId === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token.serverId)
    && typeof token.deviceId === "string"
    && token.deviceId.length >= 16
    && token.deviceId.length <= 128
    && typeof token.issuedAt === "number"
    && Number.isInteger(token.issuedAt)
    && typeof token.expiresAt === "number"
    && Number.isInteger(token.expiresAt);
}

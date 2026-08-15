import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "plexonpanel_session";
const SESSION_LIFETIME_SECONDS = 30 * 24 * 60 * 60;

export interface DashboardSession {
  version: 1;
  serverId: string;
  deviceId: string;
  issuedAt: number;
  expiresAt: number;
}

function sessionSecret(): string {
  const secret = process.env.SESSION_COOKIE_SECRET?.trim() ?? "";
  if (secret.length < 32) throw new Error("SESSION_COOKIE_SECRET is not configured securely");
  return secret;
}

export function hasDashboardSessionEnvironment(): boolean {
  try {
    sessionSecret();
    return true;
  } catch {
    return false;
  }
}

function signature(value: string): Buffer {
  return createHmac("sha256", sessionSecret()).update(value, "utf8").digest();
}

export function createDashboardSession(serverId: string, deviceId: string, now = Date.now()): string {
  const issuedAt = Math.floor(now / 1000);
  const payload: DashboardSession = {
    version: 1,
    serverId,
    deviceId,
    issuedAt,
    expiresAt: issuedAt + SESSION_LIFETIME_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${signature(encoded).toString("base64url")}`;
}

export function readDashboardSession(request: NextRequest): DashboardSession | null {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [encoded, suppliedSignature] = parts;
  const actual = Buffer.from(suppliedSignature, "base64url");
  const expected = signature(encoded);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!isDashboardSession(payload) || payload.expiresAt <= Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function setDashboardSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_LIFETIME_SECONDS,
    priority: "high",
  });
}

export function clearDashboardSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function requireSameOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || origin !== request.nextUrl.origin || (fetchSite && fetchSite !== "same-origin")) {
    throw new Error("Cross-origin request rejected");
  }
}

function isDashboardSession(value: unknown): value is DashboardSession {
  if (value === null || typeof value !== "object") return false;
  const session = value as Record<string, unknown>;
  return session.version === 1
    && typeof session.serverId === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(session.serverId)
    && typeof session.deviceId === "string"
    && session.deviceId.length >= 16
    && session.deviceId.length <= 128
    && typeof session.issuedAt === "number"
    && Number.isInteger(session.issuedAt)
    && typeof session.expiresAt === "number"
    && Number.isInteger(session.expiresAt)
    && session.expiresAt > session.issuedAt
    && session.expiresAt - session.issuedAt <= SESSION_LIFETIME_SECONDS;
}

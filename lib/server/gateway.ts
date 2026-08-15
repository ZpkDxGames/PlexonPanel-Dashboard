import "server-only";

import { createHmac } from "node:crypto";

interface GatewayResponse extends Record<string, unknown> {
  ok?: boolean;
  error?: string;
}

function internalGatewayUrl(): URL {
  const raw = process.env.PLEXON_GATEWAY_HTTP_URL?.trim()
    || process.env.NEXT_PUBLIC_PLEXON_GATEWAY_URL?.trim()
    || "";
  if (!raw) throw new Error("PlexonPanel gateway URL is not configured");
  const url = new URL(raw);
  if (url.protocol === "wss:") url.protocol = "https:";
  if (url.protocol === "ws:") url.protocol = "http:";
  const local = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !local) throw new Error("Gateway URL must use HTTPS");
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

function internalKey(): string {
  const value = process.env.PLEXON_GATEWAY_INTERNAL_KEY?.trim() ?? "";
  if (value.length < 32) throw new Error("PLEXON_GATEWAY_INTERNAL_KEY is not configured securely");
  return value;
}

function dashboardTokenSecret(): string {
  const value = process.env.GATEWAY_DASHBOARD_TOKEN_SECRET?.trim() ?? "";
  if (value.length < 32) throw new Error("GATEWAY_DASHBOARD_TOKEN_SECRET is not configured securely");
  return value;
}

async function gatewayRequest(path: string, init: RequestInit = {}): Promise<GatewayResponse> {
  const url = new URL(path.replace(/^\//, ""), internalGatewayUrl());
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${internalKey()}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  let body: GatewayResponse;
  try {
    body = await response.json() as GatewayResponse;
  } catch {
    throw new Error("Gateway returned an invalid response");
  }
  if (!response.ok) {
    const error = new Error(typeof body.error === "string" ? body.error : "Gateway request failed") as Error & { statusCode?: number };
    error.statusCode = response.status;
    throw error;
  }
  return body;
}

export async function claimGatewayPairing(input: {
  code: string;
  deviceId: string;
  deviceLabel: string;
  clientAddress: string;
}): Promise<{ serverId: string; deviceId: string }> {
  const body = await gatewayRequest("/v1/pairings/claim", {
    method: "POST",
    headers: { "X-Plexon-Client-Address": input.clientAddress },
    body: JSON.stringify({
      code: input.code,
      deviceId: input.deviceId,
      deviceLabel: input.deviceLabel,
    }),
  });
  if (typeof body.serverId !== "string" || typeof body.deviceId !== "string") {
    throw new Error("Gateway pairing response is incomplete");
  }
  return { serverId: body.serverId, deviceId: body.deviceId };
}

export async function getGatewayState(serverId: string, deviceId: string): Promise<GatewayResponse> {
  return gatewayRequest(`/v1/servers/${encodeURIComponent(serverId)}/state`, {
    headers: { "X-Plexon-Device-Id": deviceId },
  });
}

export async function sendGatewayAction(input: {
  serverId: string;
  deviceId: string;
  action: string;
  parameters: Record<string, unknown>;
}): Promise<{ requestId: string }> {
  const body = await gatewayRequest(`/v1/servers/${encodeURIComponent(input.serverId)}/actions`, {
    method: "POST",
    body: JSON.stringify({
      deviceId: input.deviceId,
      action: input.action,
      parameters: input.parameters,
    }),
  });
  if (typeof body.requestId !== "string") throw new Error("Gateway action response is incomplete");
  return { requestId: body.requestId };
}

export async function revokeGatewayDevice(serverId: string, deviceId: string): Promise<boolean> {
  const body = await gatewayRequest(`/v1/servers/${encodeURIComponent(serverId)}/devices/revoke`, {
    method: "POST",
    body: JSON.stringify({ deviceId }),
  });
  return body.revoked === true;
}

export function createGatewayLiveToken(serverId: string, deviceId: string, now = Date.now()): string {
  const issuedAt = Math.floor(now / 1000);
  const payload = {
    version: 1,
    audience: "plexonpanel-gateway",
    scope: "dashboard:read",
    serverId,
    deviceId,
    issuedAt,
    expiresAt: issuedAt + 300,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", dashboardTokenSecret()).update(encoded, "utf8").digest("base64url");
  return `${encoded}.${signature}`;
}

export function publicGatewayWebSocketUrl(): string {
  const url = internalGatewayUrl();
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/v1/dashboard";
  return url.toString();
}

export function hasGatewayEnvironment(): boolean {
  try {
    internalGatewayUrl();
    internalKey();
    dashboardTokenSecret();
    return true;
  } catch {
    return false;
  }
}

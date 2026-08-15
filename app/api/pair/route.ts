import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { claimGatewayPairing, revokeGatewayDevice } from "@/lib/server/gateway";
import {
  createDashboardSession,
  readDashboardSession,
  requireSameOrigin,
  setDashboardSessionCookie,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = await request.json() as { code?: unknown };
    const code = typeof body.code === "string" ? body.code.replace(/\D/g, "").slice(0, 6) : "";
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ ok: false, error: "Enter the six-digit code shown by the plugin." }, { status: 400 });
    }
    const deviceId = randomUUID();
    const userAgent = request.headers.get("user-agent") ?? "Browser";
    const deviceLabel = /mobile|android|iphone|ipad/i.test(userAgent) ? "Mobile browser" : "Desktop browser";
    const clientAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip")
      ?? "unknown";
    const previousSession = readDashboardSession(request);
    const claim = await claimGatewayPairing({ code, deviceId, deviceLabel, clientAddress });
    if (previousSession) {
      try {
        await revokeGatewayDevice(previousSession.serverId, previousSession.deviceId);
      } catch {
        // The new device claim is authoritative. A stale prior device can still
        // be revoked from the old server with /plexonpanel unpair.
      }
    }
    const response = NextResponse.json({ ok: true, serverId: claim.serverId });
    setDashboardSessionCookie(response, createDashboardSession(claim.serverId, claim.deviceId));
    return response;
  } catch (error) {
    const statusCode = error !== null && typeof error === "object" && "statusCode" in error
      ? Number((error as { statusCode: unknown }).statusCode)
      : 500;
    const status = [400, 401, 403, 409, 429].includes(statusCode) ? statusCode : 503;
    const message = error instanceof Error && status !== 503
      ? error.message
      : "The pairing service is temporarily unavailable.";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

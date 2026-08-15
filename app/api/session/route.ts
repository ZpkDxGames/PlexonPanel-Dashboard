import { NextRequest, NextResponse } from "next/server";
import { getGatewayState } from "@/lib/server/gateway";
import { clearDashboardSessionCookie, readDashboardSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = readDashboardSession(request);
  if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });
  try {
    const state = await getGatewayState(session.serverId, session.deviceId);
    return NextResponse.json({
      authenticated: true,
      serverId: session.serverId,
      state,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const statusCode = error !== null && typeof error === "object" && "statusCode" in error
      ? Number((error as { statusCode: unknown }).statusCode)
      : 503;
    const response = NextResponse.json({
      authenticated: statusCode !== 401 && statusCode !== 403,
      error: statusCode === 401 || statusCode === 403
        ? "This dashboard device is no longer authorized."
        : "The server gateway is temporarily unavailable.",
    }, { status: statusCode === 401 || statusCode === 403 ? 401 : 503 });
    if (statusCode === 401 || statusCode === 403) clearDashboardSessionCookie(response);
    return response;
  }
}

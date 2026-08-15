import { NextRequest, NextResponse } from "next/server";
import { revokeGatewayDevice } from "@/lib/server/gateway";
import { clearDashboardSessionCookie, readDashboardSession, requireSameOrigin } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
  } catch {
    return NextResponse.json({ ok: false, error: "Cross-origin request rejected" }, { status: 403 });
  }
  const session = readDashboardSession(request);
  let gatewayRevoked = false;
  if (session) {
    try {
      gatewayRevoked = await revokeGatewayDevice(session.serverId, session.deviceId);
    } catch {
      // The local credential is still removed. The gateway re-checks device
      // authorization on every future HTTP and WebSocket connection.
    }
  }
  const response = NextResponse.json({ ok: true, gatewayRevoked });
  clearDashboardSessionCookie(response);
  return response;
}

import { NextRequest, NextResponse } from "next/server";
import {
  createGatewayLiveToken,
  getGatewayState,
  publicGatewayWebSocketUrl,
} from "@/lib/server/gateway";
import { readDashboardSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = readDashboardSession(request);
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    await getGatewayState(session.serverId, session.deviceId);
    return NextResponse.json({
      token: createGatewayLiveToken(session.serverId, session.deviceId),
      websocketUrl: publicGatewayWebSocketUrl(),
      expiresIn: 300,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to authorize the live connection" }, { status: 403 });
  }
}

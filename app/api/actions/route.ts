import { NextRequest, NextResponse } from "next/server";
import { sendGatewayAction } from "@/lib/server/gateway";
import { readDashboardSession, requireSameOrigin } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const session = readDashboardSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";
    const parameters = body.parameters;
    if (!/^[a-z][a-z0-9_.-]{0,63}$/.test(action)
        || parameters === null
        || typeof parameters !== "object"
        || Array.isArray(parameters)) {
      return NextResponse.json({ ok: false, error: "Invalid action request" }, { status: 400 });
    }
    const result = await sendGatewayAction({
      serverId: session.serverId,
      deviceId: session.deviceId,
      action,
      parameters: parameters as Record<string, unknown>,
    });
    return NextResponse.json({ ok: true, requestId: result.requestId }, { status: 202 });
  } catch (error) {
    const statusCode = error !== null && typeof error === "object" && "statusCode" in error
      ? Number((error as { statusCode: unknown }).statusCode)
      : 503;
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "The action could not be sent",
    }, { status: [400, 401, 403, 409, 429].includes(statusCode) ? statusCode : 503 });
  }
}

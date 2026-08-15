import { hasGatewayEnvironment } from "@/lib/server/gateway";
import { hasDashboardSessionEnvironment } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const gatewayConfigured = hasGatewayEnvironment();
  const sessionConfigured = hasDashboardSessionEnvironment();
  const ready = gatewayConfigured && sessionConfigured;

  return Response.json(
    {
      service: "plexonpanel-dashboard",
      gatewayConfigured,
      sessionConfigured,
      protocolVersion: 2,
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

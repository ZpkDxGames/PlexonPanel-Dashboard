import { hasFirebaseAdminEnvironment } from "@/lib/server/firebase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const firebaseAdminConfigured = hasFirebaseAdminEnvironment();

  return Response.json(
    {
      service: "plexonpanel-dashboard",
      firebaseAdminConfigured,
    },
    {
      status: firebaseAdminConfigured ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

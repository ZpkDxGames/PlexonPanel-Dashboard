import { NextResponse } from "next/server";
import { DASHBOARD_VERSION } from "../../../lib/dashboard-version";
import { ACTION_CONTRACT_ID } from "../../../lib/scopes";
import { FLEET_CONTRACT_ID } from "../../../lib/fleet-contract";

export const dynamic = "force-dynamic";

function safeCommit(value: string | undefined): string {
  const commit = value?.trim() ?? "";
  return /^[0-9a-f]{7,64}$/i.test(commit) ? commit : "unavailable";
}

function safeTimestamp(value: string | undefined): string {
  const timestamp = value?.trim() ?? "";
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) return "unavailable";
  return new Date(timestamp).toISOString();
}

export function GET() {
  return NextResponse.json(
    {
      version: DASHBOARD_VERSION,
      gitCommit: safeCommit(
        process.env.VERCEL_GIT_COMMIT_SHA ??
          process.env.PLEXON_BUILD_GIT_COMMIT ??
          process.env.GITHUB_SHA,
      ),
      buildTimestamp: safeTimestamp(
        process.env.PLEXON_BUILD_TIMESTAMP ?? process.env.VERCEL_BUILD_TIMESTAMP,
      ),
      protocolVersion: 3,
      actionContract: ACTION_CONTRACT_ID,
      fleetContract: FLEET_CONTRACT_ID,
      configurationSchemas: { paper: 5, host: 5 },
      runtimeKind: "vercel-nextjs",
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

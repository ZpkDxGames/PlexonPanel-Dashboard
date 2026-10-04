# Coordinated 5.0 deployment gate

The Git/Vercel ignored build step, Vercel build command and Worker workflow hold 5.0 by default while ordinary 4.0 deployment behavior remains available. CI builds/tests and internal artifacts continue; no stable tag/release is implied. Missing files, malformed receipts, unsupported preview versions or incomplete evidence fail closed with value-free codes.

Before 5.0 deployment, verify current operational backup coverage, off-VPS integrity, rollback rehearsal and operator readiness for the coordinated instance/relay migration. OCI is intentionally skipped by operator decision. Record exact passing 5.0 Core/Dashboard source commits and CI run IDs in `docs/coordinated-deployment-5.0.0.json`. Its READY activation commit must have the accepted Dashboard source as its immediate parent and change only that receipt. Source changes require a fresh accepted source and activation receipt. No private values belong in the receipt.

Deployment readiness precedes actual deployed runtime certification. The receipt does not assert that runtime/security/browser tests already passed: those execute after coordinated deployment, and stable publishing remains separately gated by them. This avoids requiring deployed-runtime evidence before the initial coordinated deployment can occur.

Vercel's ignore command returns 0 to cancel or 1 to build; its explicit build guard checks the same policy again. Five previews remain held even with a READY receipt; Vercel activation requires the production environment and main branch. Worker deployment reads the gate before using deployment credentials and requires its source checks before publishing, on main only. An explicit workflow dispatch cannot override HOLD. Vercel project access, intended team/project and actual production rollback remain independently required; the current connector's inaccessible intended project is not repaired by this source gate.

The accepted Core commit/CI IDs and operator evidence must be verified against their actual systems before committing READY. The local policy validates receipt structure and exact Dashboard activation ancestry; it does not fabricate or independently execute those external checks. Actual deployment execution and production gates remain NOT_EXECUTED until evidence is recorded.

Official Vercel exit semantics: [vercel.json ignoreCommand](https://vercel.com/docs/project-configuration/vercel-json#ignorecommand).

## Workers Builds with the VPS standalone relay

`relay:deploy` remains a legacy alias for `relay:worker:deploy`. Both now require `--require-worker`, matching the separate `worker_allowed` authorization consumed by GitHub Actions. Schema 2 explicitly returns `WORKER_PUBLICATION_NOT_AUTHORIZED_FOR_VPS_TARGET` before inspecting Git ancestry. A valid Dashboard activation cannot authorize publishing a Cloudflare Worker through these npm commands. Schema 1 and ordinary 4.0 keep their existing Worker eligibility; all required source/evidence checks still apply.

The 2026-10-04 Cloudflare log for merged Dashboard `85a0e43` showed `relay:build` succeeding, then the old `relay:deploy` command exiting with `COORDINATION_CHECK_UNAVAILABLE` before Wrangler. That code means the gate could not read required inputs or ancestry; the provider log does not expose which operation failed. A depth-one checkout reproduces it because `HEAD^` is unavailable. Missing history still holds Dashboard/schema-1 activation; the guard does not fetch history, weaken checks or turn a blocked deployment into a success.

For the current VPS relay target, disconnect the retired Worker's automatic repository build integration in Cloudflare: Workers & Pages → `plexonpanel-relay` → Settings → Builds → Disconnect. This disconnects future repository builds, not the retained Worker itself. Do not delete the Worker, replace the VPS relay, change secrets/origins, rerun migration or bypass the gate to clear a check. See [Cloudflare's build-disconnection instructions](https://developers.cloudflare.com/workers/ci-cd/builds/#disconnecting-builds).

After merging this guard fix, accept the new exact main source and passing CI, then make a separate receipt-only Dashboard activation commit. The earlier `85a0e43` acceptance no longer covers the changed source. Keep the approved scope and historical evidence accurate, runtime certification `NOT_EXECUTED`, and current VPS server states unchanged. Vercel production rollout follows the existing policy; Cloudflare Worker publication remains held for schema 2.

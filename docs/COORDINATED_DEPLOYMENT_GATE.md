# Coordinated 5.0 deployment gate

The Git/Vercel ignored build step, Vercel build command and Worker workflow hold 5.0 by default while ordinary 4.0 deployment behavior remains available. CI builds/tests and internal artifacts continue; no stable tag/release is implied. Missing files, malformed receipts, unsupported preview versions or incomplete evidence fail closed with value-free codes.

Before 5.0 deployment, verify current operational backup coverage, off-VPS integrity, rollback rehearsal and operator readiness for the coordinated instance/relay migration. OCI is intentionally skipped by operator decision. Record exact passing 5.0 Core/Dashboard source commits and CI run IDs in `docs/coordinated-deployment-5.0.0.json`. Its READY activation commit must have the accepted Dashboard source as its immediate parent and change only that receipt. Source changes require a fresh accepted source and activation receipt. No private values belong in the receipt.

Deployment readiness precedes actual deployed runtime certification. The receipt does not assert that runtime/security/browser tests already passed: those execute after coordinated deployment, and stable publishing remains separately gated by them. This avoids requiring deployed-runtime evidence before the initial coordinated deployment can occur.

Vercel's ignore command returns 0 to cancel or 1 to build; its explicit build guard checks the same policy again. Five previews remain held even with a READY receipt; Vercel activation requires the production environment and main branch. Worker deployment reads the gate before using deployment credentials and requires its source checks before publishing, on main only. An explicit workflow dispatch cannot override HOLD. Vercel project access, intended team/project and actual production rollback remain independently required; the current connector's inaccessible intended project is not repaired by this source gate.

The accepted Core commit/CI IDs and operator evidence must be verified against their actual systems before committing READY. The local policy validates receipt structure and exact Dashboard activation ancestry; it does not fabricate or independently execute those external checks. Actual deployment execution and production gates remain NOT_EXECUTED until evidence is recorded.

Official Vercel exit semantics: [vercel.json ignoreCommand](https://vercel.com/docs/project-configuration/vercel-json#ignorecommand).

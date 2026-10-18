# PlexonPanel 5 dashboard

The owner's 2026-10-18 visual rebuild directive supersedes all historical Strata / Control Room visual plans and tests. Preserve Protocol 3 and headless authority/state contracts. The existing main/Vercel deployment authorization remains in docs/v5/DEPLOYMENT_AUTHORIZATION.md.

Use Next.js App Router, React, Tailwind CSS, shadcn-style Radix primitives, lucide-react, Recharts, and TanStack Virtual. The workspace uses a 240px collapsible left sidebar, compact source-status popover, KPI-first Overview, one 360px chart with segmented tabs, and an integrated console command bar. Do not restore old CSS, numbered route bands, source accordions, SVG chart components, or old visual test locks.

Every mutation must use session.reason → session.prepare → ActionReview → session.execute. Preserve exact identities, grant/session invalidation, source clocks, missing values and epoch gaps. Never persist operational data in the browser or expose bearer credentials. Fixtures are local development/test only and absent from production builds.

Run npm run check, npm run build, desktop/mobile dark/light browser and interaction checks, and the production security/performance verification. Read installed Next.js docs before changing its APIs. No agents/delegation are required.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

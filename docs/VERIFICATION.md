# Verification

Date: 2026-10-11 UTC

## Executed

- `npm run check`: 35 tests passed, 0 failed. Covers grant reconciliation, bound actions, relay mismatch/repair, reducer bounds and gaps, skew freshness, maintenance validation, player/permission command validation, text formatting and the virtual 30-minute soak.
- `npm run build`: passed with TypeScript checking and Vite production output. Vite reported non-fatal module-directive warnings from Motion dependencies.
- `npm run test:perf`: passed; initial-route JS 125,500 gzip bytes against a 184,320-byte budget.
- `npm audit --omit=dev --audit-level=high`: passed; 0 vulnerabilities.
- Static source scan for `dangerouslySetInnerHTML`, direct `innerHTML`, `eval`, `new Function` and browser console logging: no matches under `src/`.
- Owner-private Site publish: succeeded at `https://plexonpanel-command-center.newpond128.chatgpt.site` (deployment `appgdep_6acb0fb2682481918b27ee7a534aed4f`).
- Separate temporary Vercel QA preview build: passed and served the fixture-enabled application at `https://temporary-snappy-ochre-jq495z7.vercel.app` (deployment `dpl_HasbaBWHohNQigo5jG8w2tN98xYx`; expires 2026-10-11T05:26:52Z unless claimed).
- Deployed Chromium visual inspection at 1363 × 936: Overview disconnected/healthy/skew, Performance dark/light, Players, Console, Chat, Plugins, Backups, Access and Settings; details in `VISUAL_REVIEW.md`.
- Deployed route overflow check: 0 horizontal pixels on every later-inspected operational route.
- Deployed browser console: 0 application-origin warnings/errors. Four extension-origin metadata errors were observed from the remote inspection extension and excluded from the application result.

## Not executed

- `npm run test:browser`: not executed to completion. The Playwright Chromium executable was absent; `npx playwright install chromium` received an invalid zero-byte archive from the permitted network path. Therefore automated 1440/390 journeys, axe results and screenshots are not claimed.
- Live relay CORS, pairing, Cloudflare-protected relay, real Paper/Host telemetry and real action dispatch: not executed because no relay origin/new-origin allowlist/pairing was supplied.
- Backup download hash/save, restore and recovery resolution: not executed.
- Physical phone, Safari, Firefox and screen-reader verification: not executed.
- LCP, INP, browser long-task and 60-fps console profiling: not executed.

Production fixture exclusion is structurally enforced by the `import.meta.env.DEV` dynamic import and was confirmed by the absence of a fixture chunk in normal production output. A separate verification build deliberately includes fixtures and labels them in-product.

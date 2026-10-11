# Verification

Date: 2026-10-11 UTC

## Executed

- `npm run check`: 43 tests passed, 0 failed. Covers safe scheduling for 30-day grants, pairing claim persistence and cross-relay rejection, first-run routing, grant reconciliation, bound actions, relay mismatch/repair, reducer bounds and gaps, skew freshness, maintenance validation, player/permission command validation, text formatting and the virtual 30-minute soak.
- `npm run build`: passed with TypeScript checking and Vite production output. Vite reported non-fatal module-directive warnings from Motion dependencies.
- `npm run test:perf`: passed; initial-route JS 127,032 gzip bytes against a 184,320-byte budget.
- `npm audit --omit=dev --audit-level=high`: passed; 0 vulnerabilities.
- Static source scan for `dangerouslySetInnerHTML`, direct `innerHTML`, `eval`, `new Function` and browser console logging: no matches under `src/`.
- Owner-private Site publish: succeeded at `https://plexonpanel-command-center.newpond128.chatgpt.site` (deployment `appgdep_6acb0fb2682481918b27ee7a534aed4f`).
- Separate temporary Vercel QA preview build: passed and served the fixture-enabled application at `https://temporary-snappy-ochre-jq495z7.vercel.app` (deployment `dpl_HasbaBWHohNQigo5jG8w2tN98xYx`; expires 2026-10-11T05:26:52Z unless claimed).
- Deployed Chromium visual inspection at 1363 × 936: Overview disconnected/healthy/skew, Performance dark/light, Players, Console, Chat, Plugins, Backups, Access and Settings; details in `VISUAL_REVIEW.md`.
- Deployed route overflow check: 0 horizontal pixels on every later-inspected operational route.
- Deployed browser console: 0 application-origin warnings/errors. Four extension-origin metadata errors were observed from the remote inspection extension and excluded from the application result.
- Production relay boundary check: `https://tonimserver.ddns.net/healthz` returned HTTP 200, protocol 3, standalone relay 5.0.0, two rooms, one Paper connection and two Host connections. The relay returned the exact production dashboard origin in CORS and rejected an unauthenticated dashboard WebSocket upgrade with the expected protocol-3 authentication error.
- Production CSP fix: GitHub `main` commit `8afe81d2d7887de2f0b5d1ab581d5d7458736a32` deployed to Vercel as `dpl_CtGDpg8UZwPyppeFhaZQx5bSrDvK` with status `READY`. The live response contains `connect-src 'self' https://tonimserver.ddns.net wss://tonimserver.ddns.net`; the rendered Settings workspace reports the same commit and relay origin, has no horizontal overflow, and produced no application-origin console warnings or errors.
- First-run production rollout: GitHub `main` commit `9e04c59ac494ad80252ee9d56ae351133aab77f0` deployed to Vercel as `dpl_BJsiLH2s7cAVT4ZaW1ThQUsiN1ww` with status `READY`. `/build.json` reports the same commit and protocol 3.
- First-run rendered inspection at 1363 × 936: the initialization splash appeared immediately, remained for the 2.8-second minimum, and transitioned to the dedicated pairing gate because the inspection browser had zero valid pairings. The gate showed the production relay, required device name and one-time code, enabled its action only after both were present, and had zero horizontal overflow.
- Production pairing preflight: `OPTIONS https://tonimserver.ddns.net/v1/pairings/claim` with origin `https://plexon-panel-dashboard.vercel.app` returned HTTP 204 with exact `access-control-allow-origin`, `POST` and `Content-Type` permission. Relay health simultaneously reported protocol 3, two rooms, one Paper agent and two Host agents.
- First-run browser console: 0 application-origin warnings/errors. Two extension-origin metadata errors were observed from the remote inspection extension and excluded from the application result.
- Long-grant hotfix preview: GitHub branch `hotfix/long-grant-reconnect` commit `889a3cc35384cd5b931800979cc6fc31083451bc` built `READY` as Vercel preview `dpl_73acd6gcpWEHuAt3gjZRxjwwe9of`. Visual access was not executed because the preview was protected by Vercel SSO and the connected account could not mint a temporary browser bypass.
- Long-grant production rollout: the same GitHub commit deployed `READY` as Vercel production `dpl_HvrfBDf1nqykyTWnMg5mLA6p8Axr`. `/build.json` reports the exact commit and protocol 3; the public response retained the exact relay CSP. The 1363 × 936 splash and zero-pairing page rendered without visible regression.
- Post-rollout relay health: HTTP 200, protocol 3, two rooms, one Paper and two Host agents. Dashboard count was zero before the user's paired browser reloaded the hotfix.

## Not executed

- `npm run test:browser`: not executed to completion. The Playwright Chromium executable was absent; `npx playwright install chromium` received an invalid zero-byte archive from the permitted network path. Therefore automated 1440/390 journeys, axe results and screenshots are not claimed.
- The real TonimSMP claim succeeded before the hotfix, but post-hotfix authenticated `dashboard.ready`, per-room Paper/Host telemetry and real action dispatch are not executed because the credential exists only in the user's browser.
- Backup download hash/save, restore and recovery resolution: not executed.
- Physical phone, Safari, Firefox and screen-reader verification: not executed.
- LCP, INP, browser long-task and 60-fps console profiling: not executed.

Production fixture exclusion is structurally enforced by the `import.meta.env.DEV` dynamic import and was confirmed by the absence of a fixture chunk in normal production output. A separate verification build deliberately includes fixtures and labels them in-product.

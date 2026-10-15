# Verification

Date: 2026-10-15 UTC
Branch: `ui/refinement-20261015`

## Executed

- `npm ci`: passed; 43 packages installed from the lockfile.
- Baseline `npm run check`: passed; 43 tests, 0 failures.
- Stage and final `npx tsc --noEmit`: passed. The repository has no separate `lint` or `typecheck` scripts.
- Final `npm run check`: passed; 45 tests, 0 failures. The two added tests cover legacy `reduceMotion` migration and rejection of unsupported persisted preference values.
- `npm run build`: passed with Vite 8.3.4. Motion emits its existing non-fatal module-directive warnings while bundling.
- `npm run test:browser`: passed in Playwright Firefox; 37 route/matrix cases, zero axe violations, zero document overflow and zero console/page errors. Command-palette navigation and mobile-drawer Escape behavior passed.
- `npm run test:perf`: passed; initial-route JavaScript is 114,222 gzip bytes against a 184,320-byte budget. Baseline was 127,234 bytes, a reduction of 13,012 bytes (10.2%). Heavy workspaces remain lazy chunks.
- `npm audit --omit=dev --audit-level=high`: passed; zero vulnerabilities.
- `git diff --check`: passed.
- Baseline and after screenshots were rendered and manually inspected. Full matrix and review notes are in `docs/VISUAL_REVIEW.md`.

## Browser environment note

The installed Playwright Chromium executable was absent. Both Chromium installation attempts received a truncated/zero-byte archive from the available CDN path. Playwright Firefox 157 downloaded from the fallback Microsoft CDN and was used for the complete suite. In this managed execution environment the dev server and browser must run in one network namespace; Firefox also requires `MOZ_DISABLE_CONTENT_SANDBOX=1`. `scripts/browser-check.mjs` now tries Chromium first and Firefox second without weakening any assertion.

## Source boundary checks

- No adapter, protocol, relay, reducer, authorization or data-contract file was changed.
- No dependency or public environment variable was added.
- Production fixtures remain excluded by the existing Vite environment boundary.
- Command-palette results only navigate or select an existing paired room; no command or gated action can execute from the palette.
- Backup progress, chart gaps, unavailable values, Paper/Host CPU separation and console authority labels remain source-derived.

## Not executed

- Live Paper/Host acceptance, authenticated real-server telemetry and real action dispatch.
- Physical phone, Safari and screen-reader testing.
- DevTools frame-by-frame 60 fps profiling on a mid-range hardware profile. The performance budget, bounded console renderer, transform/opacity animation rules and rendered Firefox journeys passed, but this is not a hardware performance certification.
- A Vercel preview or production rollout. This branch contains source-level and local fixture evidence only.

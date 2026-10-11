# PlexonPanel 6.0.0 report

## Delivered

Thirteen lazy routes: Overview, Console/Chat, Players, Performance, Files, Backups, Settings, Plugins, Worlds, Schedules, Logs, Fleet, Access & audit. Light glass and dark variants share prototype tokens, cards, KPIs, charts, terminal treatment, navigation and motion. Existing auth, endpoints, signed checks, server isolation and reviewed actions are retained. Self-hosted Plus Jakarta Sans replaces Manrope; no chart/editor/icon library was added.

[Audit](REVAMP_AUDIT.md), [design system](DESIGN_SYSTEM.md), [review scores](REVAMP_REVIEW.md), [before](revamp/before), [after](revamp/after). Scores: 45–47/50 per page, no category below 4.

## Verification

- TypeScript and 52 unit/contract tests pass: pairing/reconnect, signed action generation, freshness, bounded history, safe formatting, log grouping, domains, formats, schedule preview.
- Vite production build passes; initial JS ~96 KiB gzipped, below the 180 KiB budget. Demo/styleguide are absent from production output.
- Built theme script matches the allowlisted CSP SHA-256; relay origins/security headers remain preserved.
- 156 screenshot/axe cases, plus 130 additional responsive captures. Final machine evidence: [visual-matrix.json](revamp/qa/visual-matrix.json).
- All 19 browser checks pass: palette/search, traces, autocomplete, safe confirmation focus, dirty-draft navigation, inert injected HTML, source freshness, motion, themes and no demo relay requests.
- 100,000-line burst: 2,500 retained, 17 DOM rows, ~420ms total stress time in the final run. This is not a physical-device 60fps certificate.
- Reduced motion: zero running animations. Numeric, thumb and live-chart movement receive separate behavior checks.
- Lighthouse standard mobile pairing entry: 99 Performance / 100 Accessibility / 100 Best Practices, LCP 1.96s, CLS 0.017. Desktop thresholds with the same default throttle: 83/100/100; retained in the evidence.

## Run / build / deploy

Node 24: `npm ci`, `npm run dev`; open `http://127.0.0.1:4173/?demo=1`. Add `&idle=1` or `&offline=1`; choose theme in the UI. Existing fixture flags remain development-only. `npm run build` produces the normal Vercel Vite `dist`. Reproduce with `npm run test:visual` and `npm run test:revamp`; install Playwright Chromium or set `PLEXON_CHROMIUM`.

Branch: `revamp/6.0.0`, separate phase commits. Main is not merged/promoted. GitHub’s Vercel check reports successful deployment of verified UI commit `cc87a13660b436a531dfa5862abfa036f14f2f73`: [deployment](https://vercel.com/zpkdxgames-projects/plexon-panel-dashboard/536xmmZrxY1CaFkjX89ZaLrYUBp1). Direct deployment inspection returned a team-scope 403; no authenticated CLI fallback is available. The hosted runtime and live server actions remain unverified. A preview needs the relay’s exact origin allowlist and a browser-held pairing; no credential is copied into source/docs.

## Parity and limitations

All eight original route workflows remain. Plugins is also first-class while its Console tab remains. Files exposes existing signed text contracts and original-hash saves/create/upload/rename/delete; write authority can choose Paper when Host is read-only. Text limit: 24 KiB. Existing verified browser transfer adapter limit: 64 MiB. Full backup restore/download/recovery UI, arbitrary schedules, world editing, plugin toggles, longer-range history and IDE-style editing are explicit gaps/capability states rather than invented functionality.

Fresh captures, cached history, zero, unavailable and offline are distinct. Chart aggregates are sample statistics; daily totals/network/per-core data and tick percentiles are not fabricated. Retained charts cover at most 35 minutes.

Next acceptance: authenticated PlexonCraft/TonimSMP preview, then physical mobile/browser compatibility checks. Local UI threshold is met; production/server certification remains unexecuted.

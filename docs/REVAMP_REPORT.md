# PlexonPanel 6.0.0 report

## Delivered

Eleven lazy routes: Overview, Console/Chat, Players, Performance, Backups, Settings, Worlds, Schedules, Activity (Logs hash), Fleet, Access & audit. Files and Plugins destinations were removed at the owner’s request. The original Console plugin tab remains. Light glass and dark variants share prototype tokens, cards, KPIs, charts, terminal treatment, navigation and motion. Existing auth, endpoints, signed checks, server isolation and reviewed actions are retained. Self-hosted Plus Jakarta Sans replaces Manrope; no chart/editor/icon library was added.

[Audit](REVAMP_AUDIT.md), [design system](DESIGN_SYSTEM.md), [review scores](REVAMP_REVIEW.md), [before](revamp/before), [after](revamp/after). Scores: 45–47/50 per page, no category below 4.

## Verification

- TypeScript and 54 unit/contract tests pass: pairing/reconnect, signed action generation, freshness, bounded history, safe formatting, log grouping, domains, formats, schedule preview.
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

All eight original route workflows remain. Owner refinements add stable chart ranges, short geometry transitions with attached endpoints, independent hover, 50–1000ms local display buffering, graph format/curve/detail and interface accent settings, custom dropdowns/scrollbars, automatic skin-provider fallback and additional existing Host metrics. Activity retains eight initially visible relevant events, with explicit expansion and filters.

Server icons load automatically when the signed file-download capability is permitted; Settings also offers Load server-icon.png, a local 64×64 PNG and Reset. Icons are transfer-verified, decoded, and stored per instance in this browser. The actual server file/live skin lookup still needs authenticated runtime acceptance. Provider fallback is browser-tested against controlled responses. Full backup restore/download/recovery UI, arbitrary schedules, world editing, plugin toggles and longer-range history remain unavailable/deferred capability states.

Latest refinement captures and browser evidence are in [refinement](revamp/refinement). The original review records remain as historical evidence; use the appended owner-refinement score table for the revised pages.

Fresh captures, cached history, zero, unavailable and offline are distinct. Chart aggregates are sample statistics; daily totals/network/per-core data and tick percentiles are not fabricated. Retained charts cover at most 35 minutes.

Next acceptance: authenticated PlexonCraft/TonimSMP preview, then physical mobile/browser compatibility checks. Local UI threshold is met; production/server certification remains unexecuted.

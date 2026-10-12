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

Latest refinement: 84 screenshot/axe cases pass, 16 refinement and 17 retained browser checks pass, and all seven revised pages score 45–46 with no category below 4. Captures and browser evidence are in [refinement](revamp/refinement). The original review records remain as historical evidence; use the appended owner-refinement score table for the revised pages.

Fresh captures, cached history, zero, unavailable and offline are distinct. Chart aggregates are sample statistics; daily totals/network/per-core data and tick percentiles are not fabricated. Retained charts cover at most 35 minutes.

Next acceptance: authenticated PlexonCraft/TonimSMP preview, then physical mobile/browser compatibility checks. Local UI threshold is met; production/server certification remains unexecuted.

## PlexonPanel 6.5.0 release report

### Delivered

6.5.0 keeps the eleven-route 6.0 dashboard and makes its telemetry, authority and shell release-safe. Overview, Performance and Fleet now use fixed requested time windows, bounded settling axes, denser width-aware geometry, current-value legends, richer plot surfaces and sample-snapped inspection local to each chart. Charts show only received measurements; interpolated points shape the line without becoming telemetry.

Owner authority now has one resolver. A verified, reconciled Owner receives all 54 scopes known to the negotiated Dashboard contract, and Access reports full control. Console command dispatch selects the capable Paper action target even when Host supplies the visible stream. Agent presence, instance binding, data freshness, capability support, high-risk confirmation and the server's final action result remain enforced.

Console interaction is complete: ordinary commands dispatch without a redundant modal, destructive commands retain typed target confirmation, and commands enter bounded per-server history only after dispatch returns a completion. Cancelled reviews are not recorded. Arrow recall restores an unfinished draft; the History control supports recall, individual removal and clear-all. Stop and Restart now send the relay-required `confirmed: true` parameter after their single review dialog.

The shell now has explicit top-bar/content rows, scroll position resets on route changes, bounded Console sizing, compact chart/header/tooltip layouts and corrected mobile gutters. All routes were verified from 320×568 through 1920×1080, including the exact supplied 1577×929 Console viewport. Card highlights, controls and chart depth were refined within the supplied token system; obsolete Files-route CSS and the superseded authority helper were deleted instead of covered by another compatibility layer.

### Feature parity and intentional differences

Pairing, stored credentials, relay endpoints, signed actions, selected-server generation binding, lifecycle/player/chat/backup/device flows, Console Plugins and Vercel's static Vite deployment shape are unchanged. Files and standalone Plugins remain intentionally absent at the owner's request. `#Logs` remains the compact Activity destination for join/leave, world-generation and backup-critical events.

Verified Owner means full client-side scope for all actions in the current contract; it does not manufacture a backend handler. An immutable credential created by an older server can still receive an authoritative server-side `SCOPE_DENIED`. Re-pair that Owner after the Core grant migration if this occurs.

### Dependencies

No runtime dependency was added. The release stays on React/Vite/TypeScript with project-owned SVG charts and the existing Motion package. Browser and Lighthouse runtimes are QA-only.

### Run, build, deploy and demo

Use Node 24: `npm ci`, `npm run dev`, `npm run check`, `npm run build`. For design review, open `http://127.0.0.1:4173/?demo=1`; append `&idle=1` or `&offline=1` and select either theme. Demo/styleguide code is compile-time gated out of production and never supplies production values. Run `npm run test:revamp`, `npm run test:refinement`, `npm run test:release65` and `npm run test:perf` for the recorded checks. `npx vite preview` serves the production bundle locally; Vercel continues to publish `dist` with the existing CSP and relay configuration.

Release branch: [`revamp/6.5.0`](https://github.com/ZpkDxGames/PlexonPanel-Dashboard/tree/revamp/6.5.0). GitHub commit `ca8ee48c5f1782f88361ddf83d32fb4a97b98d2a` has the exact same tree SHA as the locally verified release. Vercel reports its production deployment `dpl_4Grdqbh1nXYvbCfMzTNQLCPJdGkF` as `READY`, with [plexon-panel-dashboard.vercel.app](https://plexon-panel-dashboard.vercel.app) assigned. The Vercel API connection could inspect deployment metadata but could not obtain an authenticated page-fetch bypass for the team-protected alias, so the hosted page body and live paired-server operations are not claimed as independently exercised here.

### Verification result

All eleven pages pass the independent visual gate at 45–49/50 with no category below 4. The final 132-screen matrix has no overflow, runtime errors or axe violations; the 88-case viewport sweep has no failures. All 56 unit/contract tests, 43 retained/refinement browser checks and the production build pass. The post-fix Console review remains 47/50 and confirms the mobile input/history/macros/navigation fit without severed controls. Lighthouse on the production bundle is 99/100/100 mobile and 100/100/100 desktop. Initial-route JavaScript is 99,871 bytes gzip against the 180 KiB budget.

### Known limitations and next steps

- No paired live VPS session was available, so real Host telemetry, server-side Owner migration, live skin-provider resolution and signed server-icon transfer still need an authenticated acceptance pass.
- The current Host schema does not provide per-core CPU, network throughput or disk I/O rates. Add those fields to the relayer/Core contract before exposing them; the dashboard deliberately does not infer them.
- Run a final physical-device, Safari/Firefox and screen-reader pass. Mobile wide tables are contained and labelled but still require horizontal swipe.
- Retained in-browser history is at most 35 minutes. Long-range charts require a server-side history endpoint or metrics store.

Release references: [current-state and operating guide](PLEXONPANEL_DASHBOARD_6_5_CURRENT_STATE.md), [audit](REVAMP_AUDIT.md), [design system](DESIGN_SYSTEM.md), [review and scores](REVAMP_REVIEW.md), [changelog](../CHANGELOG.md), [6.5 screenshots](revamp/6.5.0/final), [6.0 before](revamp/before) and [6.0 final](revamp/after).

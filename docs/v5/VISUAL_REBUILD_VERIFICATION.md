# Sidebar dashboard rebuild verification

Baseline: `ZpkDxGames/PlexonPanel-Dashboard` main `9c302a5d1f3071297ab773e9f6144ed6980c4346`. Backend main remains `24ea336cc0f6ce04fd47dfa4b2b2ba54ee9fb206`; no backend or VPS deployment is part of this visual correction.

## Removed

The requested Strata CSS, style directory, nextgen component directory, legacy Shell and ui barrel, TimeSeries implementation, next-gen docs/assets, and all nextgen-* scripts were deleted. Obsolete SVG geometry/inspection visual tests and unused visual scripts were removed. Protocol/authority/epoch/review, credential persistence, signed action and data-isolation contract coverage remains.

## Rebuilt

All eight routes use the new Tailwind component system and Radix/shadcn-style primitives. A 240px sidebar collapses to 72px; mobile navigation is a modal drawer with 44px targets. Source health uses a compact header popover. Cmd+K, G1–G8, theme preferences and the server selector remain functional.

Overview places server lifecycle actions and the four requested KPI cards before the single 360px Recharts plot. Tick, memory and CPU/chunk views are actual Radix tab panels. Charts use gradient fills, floating tooltips, padded axes, source-specific capture clocks and explicit missing/restart gaps. Performance keeps eight synchronized tracks with a shared, isolated Recharts time brush and raw evidence table. The brush navigator updates every ten seconds while visible telemetry tracks continue at source cadence.

The Console uses dynamically measured TanStack Virtual rows, severity/query filters, Host SQLite cursor reads, live-follow/pause controls and an integrated reviewed command bar. Only recognized duplicate leading metadata is stripped from displayed messages. Paused snapshots are bound to server, grant revision, scopes and boot epoch.

Players retain immutable UUID selection, a boot timeline and reviewed moderation/gameplay/command tools. LuckPerms commands now accept validated UUID targets; arbitrary names/control characters cannot bypass the builder. Access provides both agent audit sources, paired devices and the authority matrix. Backups retain manual cold-backup review, durable job status, preflight, periodic scheduling, retry/verify/delete, and archive verification truth. Settings retain all eight allowed preferences, relay/OTP configuration, privacy and credential-free diagnostics.

## Verification status

- Type checking + 71 unit/contract tests: PASS.
- Next production build: PASS.
- Production intercepted workload: PASS. 8,192 retained captures, 2,500 console lines, eight Recharts tracks. 240 display frames measured: main-thread work p95 4.47ms, max 46.54ms; frame interval p95 16.8ms; no >50ms tasks or page errors. The aggregate 125ms work windows are separately retained (p95 38.88ms), and are not mislabeled as per-frame latency.
- Complete 32-case browser matrix: PASS, zero page errors, accessibility violations or horizontal overflow.
- State/interaction/focus/UUID/mobile verification: PASS, including pointer/keyboard brush zoom and 22 secondary-panel/theme cases.
- Production nonce CSP/no-store/fixture isolation: PASS. Per-request nonces are applied to Next scripts and only the exact relay HTTPS/WSS origins are allowed.

Browser tests use labeled development fixtures or fully intercepted production transport. They do not pair to or mutate the real relay, Host, Paper, systemd, RCON, or Google Drive. Browser rendering uses pinned Chrome for Testing 155.0.8059.84; CI checks the archive SHA-256 before use. React checklist review covers hooks, identity-bound state, stable source projections, safe text, focus and accessible controls.

Machine-readable local results: [evidence/rebuild-checks.json](evidence/rebuild-checks.json). Final immutable source and CI status: [PR93](https://github.com/ZpkDxGames/PlexonPanel-Dashboard/pull/93).

The first remote build caught the removed-last-public-asset clean-checkout case; the identity script now creates `public/` and a fresh-directory regression test covers it. The Vercel preview subsequently reports Ready. Preview content and build logs are protected by Vercel team permissions unavailable to this connection (403), so production acceptance additionally verifies the public deployment's exact build commit, HTML security headers and anonymous desktop/mobile rendering. Deployment Protection is preserved.

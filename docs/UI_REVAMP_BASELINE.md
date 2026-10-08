# UI revamp baseline

Audited current clean main: Dashboard `c59b2f7508d738e1adae860db9fa7a6d0a3193c2`; Core `09deffc568e36828b4cb56c91f576b7f8524122c`. Both match the directive. Dashboard has no open PR; Core #95–97 remain open and are not incorporated. Core #98 lifecycle responsiveness is merged. No deployed receipts or production runtime status inferred from Git.

Mounted graph: page → Dashboard → Fleet or selected workspace. Dashboard owns pairing, selection revision, live transport, confirmation and navigation. `control-state` owns signed-room reduction; `browser-store` owns per-UUID credentials/safe cache. `fleet-feed` supplies bounded nonselected sessions. `ui-preferences` and its provider remain the sole preference authority. One global CSS file currently contains 7,092 lines, historical selectors, duplicate UI palette vocabulary and dead shell selectors. Select and the standalone Activity route have scoped CSS. No UI dependency beyond React/Next.

Baseline `npm run check` passed: 79 relay tests and 177 Dashboard tests, generated contracts, lint, TypeScript, optimized production build and HTTP/security-header checks (Node 24.19.0). Evidence numbers are in `ui-revamp-baseline.json`; native visual and interaction results will be recorded separately. The developer fixture uses signed real loopback relay sessions with simulated agents, never the running VPS.

## Deletion candidates, traced before edits

- `monitoring-views-2-1`: unmounted OverviewView21, Sparkline and HealthSummary have no production caller. Keep Performance and its gap math, remove this duplicate overview.
- `overview-view-3-0`: active Overview. Replace indexed sparkPath with capture-time chart geometry; stale snapshots currently appear as current health.
- `management-views-2-1`: seven-line re-export bridge, callers Dashboard/tests. Remove after callers use actual semantic modules.
- Version-suffixed page files: active, preserve control behavior and move all imports/tests to semantic filenames.
- `dashboard.css`: replace entire file; do not import its old rules. Replace versioned classes in callers, then rebuild feature layouts against one token vocabulary.
- Tailwind/PostCSS: no Tailwind utility use in active TSX; remove compiler and import after canonical CSS replacement.

## Authority and command boundary

Paper: health every 40 ticks, JVM system snapshots (5 s default), players, chat, plugins, files under local policy. Host: node system (250 ms), exact systemd service resources/status (5 s), lifecycle, journal, backup/provider jobs. Every metric can be null. Capture timestamps remain independent of receipt. Device scopes ∩ capability ∩ compatible target ∩ local policy gate each action; immutable target/session confirmation, signed result reconciliation, 10 s connection timeout, no uncertain/BUSY replay remain unchanged. Browser history is bounded to 35 minutes / 8,192 entries; player history stays private and transient. No 24 h persistence planned.

Core already emits systemd CPU in percent of one core and service RAM. The browser currently omits service values from its chart history and combines sources under packet arrival capture time. Solve this omission in the browser reducer/series adapter, with regression tests; no agent JAR or protocol update required.

## Observed source CI

Dashboard main [run 37418922144](https://github.com/ZpkDxGames/PlexonPanel-Dashboard/actions/runs/37418922144) passed. Core main [run 37419700051](https://github.com/ZpkDxGames/PlexonPanel/actions/runs/37419700051) **failed on Linux x64**: `ResponsiveHostControlTest.independentWorkersStillEnforceCapabilityConfirmationGenerationAndReplay`, line 135 (`CAPABILITY_DISABLED` assertion); 90 protocol tests, one failure. The ARM64 build/package job passed. This predates the Dashboard diff; it is not silently corrected or certified here. No new Core JAR is required. Coordinated production activation must still satisfy its Core CI policy.

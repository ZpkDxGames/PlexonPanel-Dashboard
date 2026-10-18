# PlexonPanel 5.0

A Next.js App Router dashboard for Paper and the 24/7 Linux Host Companion over signed Protocol 3.

The dashboard uses a 240px collapsible left sidebar, grouped navigation, a KPI-first Overview, Recharts telemetry, and a virtualized live terminal with an integrated reviewed command bar. The old Strata interface, CSS, custom charts, planning assets, and visual locks have been removed.

## Development

Use Node 24. Run `npm ci`, `npm run dev`, `npm run check`, and `npm run build`.

Set the public `NEXT_PUBLIC_PLEXON_RELAY_URL` HTTPS origin for deployment. The installed legacy public `VITE_PLEXON_RELAY_URL` remains a migration fallback. No private service credentials belong in the dashboard.

## Verification

- `npm run check`: type checking and adapter, authority, storage, projection and contract tests.
- `npm run test:browser`: all eight routes, desktop/mobile, dark/light, accessibility, reflow and Overview placement checks.
- `npm run test:interactions`: denied/offline/stale/skew states, sidebar, chart tabs, shared brush, command palette, exact UUID selection, review focus and mobile navigation.
- `npm run test:perf`: a production build with all relay traffic intercepted; full 8,192-point retention, 2,500 console lines and eight Recharts tracks; actual display-frame work and aggregate 125ms utilization are measured separately.
- `node scripts/v5-production-security.mjs`: production nonce CSP, exact relay origins, no-store HTML and fixture exclusion.
- `npm run test:flow`: optional browser → synthetic loopback relay → real Java HostSessionStore SQLite/JSON contract. Requires the matching Java 25 Host JAR through `PLEXON_HOST_JAR` and `PLEXON_JAVA`.

Set `PLEXON_CHROME_PATH` to an installed Chrome/Chromium executable when needed. CI installs a pinned Chrome for Testing binary. Fixtures are development-only; production bundles exclude fixture hooks and data.

## Trust and data boundaries

Mutations use `session.reason` → `session.prepare` → ActionReview → `session.execute`. A queued receipt is not completion. Credentials remain origin-bound in IndexedDB. Console, chat and player events are never persisted in browser storage. Source clocks and epoch gaps remain independent; absent values remain unknown.

The backend SQLite/session-reset and manual/periodic Google Drive cold-backup implementation is already merged in PlexonPanel main. This visual rebuild changes only the dashboard.

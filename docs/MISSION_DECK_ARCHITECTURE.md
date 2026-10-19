# Obsidian Mission Deck

The presentation layer was removed and recreated. The original adapters, presentation projections, preferences, selectors, capability model and library helpers are byte-for-byte preserved.

## Boundaries

`src/ui/bindings/index.ts` owns scoped read projections and typed hooks. `bindings/pure.ts` is the pure export seam. `bindings/startup.ts` initializes the existing session; fixture installation is behind `NODE_ENV === development`. Components do not import the headless modules directly.

The supplied parser, history window and chart scale functions remain at their original public paths so the existing regression tests remain meaningful. `hooks/useControl.ts` and `chrome/server-view.ts` retain pure compatibility exports only; no former visual component or layout CSS survived.

The preference store retains exactly eight keys. DOM attribute aliases are supported in CSS without broadening the stored unions. Rail expansion is session state. Console, chat, command history, raw samples and read query results are memory-only.

## Architecture

The shell is a 64px rail and 56px header. Below 760px, the rail becomes a 56px bottom bar. Rounded bordered shells occur at one level: a deck, pane or standalone fleet blade. Their internals use hairline separators. Floating dialogs and tooltips use portals.

| Route | Structure |
| --- | --- |
| Fleet | Verified node ledger and standalone instance blades |
| Overview | 148px instruments, full-width studio, 62/38 console and roster/world dock |
| Performance | Selected primary signal, eight subsystem lanes, shared readout/axis and raw-sample drawer |
| Players | Virtualized roster, epoch-separated events, exact UUID inspector |
| Console | Full-height four-row terminal, plugin inventory and memory-only chat |
| Backups | Host's 14 stages, manual/periodic deck, archive ledger |
| Access | Device blades, scope authority matrix, dual-agent audit ledger |
| Settings | Eight preferences and a fixed-data preview using the real components |

## Protocol reconciliation

The canonical adapter is authoritative: `session.reason()` returns an empty string when allowed, and `session.prepare()` returns a synchronous `Prepared` object. UI mutation hooks map the empty gate to null but preserve nonempty reasons verbatim. Every mutation enters the global review host, calls `session.valid()` at confirmation, and dispatches the exact prepared target with `session.execute(prepared, true)`.

Reviews expire after 60 seconds and block if the target source is no longer live. Typed confirmation follows `reviewPolicy`; restore also requires the exact server name. Restore first obtains a Host-issued `confirmationToken` through `backup.full.restore.prepare`, and passes the token and returned name to `backup.full.restore`. Sensitive tokens are redacted in the parameter preview.

Lifecycle uses `server.start`, `maintenance.restart.now` and `server.stop` on HOST. A conservative UI transition guard additionally blocks Restart during starting/stopping/unknown phases. Session gate text always takes precedence. Quick backup uses `backup.create` with a 300-second countdown; full backups use `maintenance.full-backup.create` after preflight evidence.

## Data truth and supported limits

- Each metric reads its own source history, freshness clock and source epoch projection. The header reports the weakest clock per agent. Host process CPU cannot masquerade as Minecraft service CPU.
- SVG paths are split by epoch and unavailable samples, with gap hatching. Monotone interpolation cannot overshoot. GC interval deltas reset at source boundaries.
- The backend retains at most 35 minutes of telemetry. The 2h analyzer selector therefore shows the retained window and states that limit.
- Protocol 3 exposes device list/revoke, not a scope-update action. The scope matrix is inspect-only. Editing it would imply unsupported authority.
- The store allows three accents (teal/blue/violet) and two timezone modes (browser/UTC), not arbitrary IANA choices. UI controls honor those unions.
- The same-origin avatar proxy accepts exact UUIDs, uses a fixed provider, refuses redirects and caps response size. All providers reset their fallback by provider and UUID.
- Per-player ping history is not supplied. The inspector shows current ping and identifies the missing historical series.
- Pipeline fallback stage labels are copied from `BackupStage.java`; reported Host stage definitions take precedence.
- Fixtures are development-only and never substitute for production data or real server validation.

## Verification

`npm run verify:structure` runs Playwright and axe against all eight routes at 1545×911, 1280×800, 1920×1080 and 390×844 in dark and light themes. It also exercises source staleness, lifecycle phases, gate focus, keyboard navigation, command review/execute, command history, chat, volume virtualization, restore preparation, UUID inspection and reduced motion.

`CHROME_PATH` can select a locally installed Chromium executable. Otherwise install the matching browser with `npx playwright install chromium`.

`bash scripts/verify-purge.sh`, `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` are the source and production checks. `.purge/core-sha256.json` is the untouched-core checksum baseline; `.purge/tokens.css` contains only the preserved token blocks.

Backend verification requires Java 25 and access to the pinned Gradle 9.7.0 distribution. The source archive is included unchanged; this environment could not execute that build. No live relay credentials or Minecraft server were provided for operational validation.

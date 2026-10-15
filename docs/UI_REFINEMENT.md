# Dashboard UI refinement

## Scope

Based on `main` at `0ccb709`. The supplied screenshot shows an older interface than this branch. This change refines the current React Command Center source, rather than restoring that older implementation.

## Changes

- Navy surfaces and a restrained cyan accent, distinct light-theme chart colors, lighter borders, consistent spacing, and a clearer type hierarchy.
- Grouped sidebar navigation, visible selected-server context, a device identity footer, and mobile navigation with safe-area spacing.
- Working page search with filtering, Enter-to-open, keyboard navigation, native modal focus containment, Escape dismissal, and scroll locking.
- Overview organized into server identity and controls, four key metrics, a primary tick chart, a health summary, two resource charts, world activity, and a compact player list.
- A choice of tick rate or tick duration on Overview; separate unit-specific charts on Performance. Time-window controls affect the overview charts and evidence.
- Responsive SVG coordinate spaces keep chart text at readable sizes. Memory axes and tooltips use GiB/MiB, gaps break both lines and fills, singleton samples remain visible, pointer mapping accounts for plot padding, and charts retain keyboard inspection and sample tables.
- Explicit empty and stale states; missing data is not replaced by invented readings. Motion respects both the operating system and the dashboard preference.

## Preserved behavior

No changes to the relay, pairing credentials, grant validation, telemetry transport, API contracts, or deployment configuration. Lifecycle actions still use `session.prepare`, existing scope/evidence checks, and `ActionReview`; the update never sends operations automatically. Development fixtures remain excluded from production builds.

## Verification

- `npm run check`: TypeScript and 46 tests passed, including three chart geometry regressions (missing-data fills, scales/outliers, pointer coordinates).
- `npm run build`: production build passed. Existing Motion dependency `use client` bundler warnings remain nonfatal.
- `npm run test:perf`: initial JavaScript gzip size below the existing 180 KiB budget.
- `git diff --check`: passed.
- Browser visual/accessibility checks were not run: the supported browser-control integration is unavailable in this managed environment. No desktop/mobile screenshots or live Minecraft acceptance are claimed.

## Review before production

Run `npm ci`, start `npm run dev`, and use `?fixture=healthy#Overview` for an isolated preview. Also review `stale`, `partial`, `stopped`, `offline`, and `denied` fixtures. Fixtures block server operations. Run the existing `npm run test:browser` with Playwright available, then check light/dark themes, 390px/820px/1440px widths, page search, keyboard chart inspection, and the collapsed sidebar. Verify the live paired-server experience before promoting.

## Delivery state

Local branch: `codex/dashboard-ui-polish`. The GitHub connector returns `Unknown tool`, and Git reports no HTTPS write credentials, so the changes have not been pushed, merged, or deployed. The handoff archive includes the full tracked source and a commit patch suitable for `git am` on the recorded baseline.

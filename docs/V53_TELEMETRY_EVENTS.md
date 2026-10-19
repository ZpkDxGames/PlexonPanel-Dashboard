# v5.3 — Selected signals and boot player events

Clicking a telemetry ribbon tab now selects the chart that is drawn. Overview defaults to one 300px plot; Split shows one 110px plot per signal. Tick/MSPT, memory and CPU/world groups share the existing display-choice store. Memory lanes use the same scale. Missing readings remain unavailable, GC deltas reset at boot/gap boundaries, and service CPU retains multi-core bursts.

Performance now has a 280px primary stage and a hairline 2×2 subsystem deck: GC, three memory lanes, two CPU lanes, and chunks/entities. Nine stages read one rAF-coalesced hover timestamp. One sticky FOLLOW/SCRUB readout replaces floating chart overlays, and one clock axis serves the workbench. Pause, the virtualized raw drawer and CSV export are retained. A 2h request still cannot exceed the core's 35-minute retention.

One app-shell feeder combines current presence deltas, roster differences and parsed history/live console lines. It shares the console-history query and paging window with the terminal. Repeated roster snapshots do not replace events; a player already online gets a stable synthetic online row. The stream stores at most 500 events and the last two server/boot buckets in memory. Login addresses are discarded; addresses in disconnect/command details are redacted. Current events require roster or overview access. Only older event paging uses the history scope; the existing exact-UUID history query retains its protocol permission checks.

## Changes replaced

- The hard-coded multi-series Studio and five-track Performance renderer.
- Repeated per-track axes and floating chart readouts, including their CSS.
- Route-local console-history querying and the raw presence-only events branch.
- The history-scope check that incorrectly hid current presence deltas.

The pure parser, geometry/scale and older stage-helper exports remain for compatibility. The Settings preview uses the same new Stage primitive. The backup pipeline's numbered marker was renamed to avoid colliding with the chart Stage class.

No dependencies were added. All 27 checksum-locked core files, the eight preference keys and the backend are unchanged. Only whitelisted display choices are persisted (`studioMode` and `playerEventFilter` add two keys to `plexon:view-sync`); event/console/chat content remains volatile.

## Verification

```sh
bash scripts/verify-purge.sh
npm run typecheck
npm run lint
npm test
npm run build
npm run verify:production
npm run verify:structure
node scripts/polish-checks.mjs
```

The structural matrix retains all 25 invariant groups across eight routes, four viewports and both themes (64 configurations). The chart assertions now verify one signal per stage, subpaths that stop at boot gaps, budget placement, nine synchronized crosshairs and a single axis/readout. The browser interaction checks cover Focus/Split, keyboard tabs, pause/raw samples, cross-route/reload/cross-tab choices, current online players without history/console permission, and selector accessibility. Extra screenshots cover 1555×916 and 1280×800.

Development-only `normal-load` and `roster-events` fixtures exercise the off-scale MSPT budget and roster fallback without changing the headless fixtures. Production continues to ignore every fixture query parameter. The release archive contains before/after screenshots and command/browser receipts. Fixture checks do not establish the state of a live Minecraft server.

Local release validation passed: 113/113 unit tests, all 25 structural invariant groups across 64 route/theme/viewport configurations, zero axe violations/browser exceptions, the production smoke test and the standalone interaction/persistence suite. All 27 core SHA-256 hashes match the locked baseline. CI and production deployment identifiers are included in the delivered verification metadata.

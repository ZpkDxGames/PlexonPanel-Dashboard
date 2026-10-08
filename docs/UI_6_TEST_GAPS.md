# 6.0 parity test gaps and acceptance ownership

Untouched check executed:79 relay +183 dashboard tests, no failures/skips. UI_6_TEST_CATALOGUE.md lists all31 dashboard suites and every source test title. This document distinguishes existing tests from **planned, not executed** 6.0 regressions. No baseline tests were rewritten.

| Gate / existing evidence | Gap to close | Milestone |
|---|---|---|
| action targets, token/ready intersection, relay full/errors scope, signed two-room mounted flow | Repeat actual bound confirm after server/socket/agent/grant replacement; ensure shell extraction preserves the mounted transport and no replay | M3 |
| dashboard-2-1 historical assertion | Approved revise missing service state to unknown; mounted palette/quick-action unavailable despite connected Paper and missing Host state; stable Host inactive/active gating | M3 |
| palette source checks and bound restart | Navigation-only mounted palette; no dispatch side effect, current workspace/server preservation, navigation shortcuts suppressed in inputs | M3 |
| ui-preferences parsing/provider tests | Each saved accent/density/text/motion/chart/display-rate field survives additive upgrade; OS default only when no saved prefs; malformed partial values do not wipe valid fields | M2/M7 |
| metric-reports, geometry, source timestamp, display cadence tests | Pulse real Paper-health captures only, exact duplicates replace, out-of-order insert, source outages/future captures/nulls/real0, no artificial live beat, 1/5/15/30-window parity, threshold boundaries19/15 and50ms, keyboard/table equal data | M4 |
| performance metric labels and telemetry-adapter tests | All9 charts kept; Host/Paper/service CPU unit independence incl service150%; shared crosshair nearest-by-own-source without fabricated sample; GC export remains | M4 |
| Fleet shared-node and mounted two-room tests | All instances’ mini Pulse from existing FleetFeed, not second store; shared infrastructure once; expired/mismatched grant visible; fix definition-list serious axe finding | M4 |
| player presence snapshot/session tests and roster action gating | Authorized AND supplied location/address DOM matrix incl absent fields and grant reduction; all13 actions with correct Owner-only/confirmation rules; active history modal bounded cursor/search; UUID/mobile/card-table preferences | M5 |
| console live-only fallback/replay/scopes/invocation/source dedupe tests | Host console remains readable while Paper offline with disabled command; full/errors exports no leak; pause delivery continues; resume unseen count/local clear copy truthful; sticky composer small-height/safe-area/IME; no scroll hijack during selection | M5 |
| chat action/safe-cache source assertions | Keep max100 local chat cache; visible Clear local chat cache clears stored chat only, pre-clear content cannot re-cache on a telemetry-only update, selected-server/live-view behavior explained, no grant/history/server deletion; MiniMessage requires both scope and capability | M5/M7 |
| backup-readiness and failed-job/status tests | All15 phases +3 outcomes plus unknown supplied phase; one progress display and absent counters; mismatch/late job progress ignored; reload and disconnected status reconstruction; countdown-before-bound-confirm once; provider-test vs verified time | M6 |
| settings/backup action aliases and static view tests | Scope maintenance.restart distinct from maintenance.run; schedule cannot create backup; local-only/offsite/emergency verify/retry/delete parity; no restore/automatic controls | M6 |
| file-conflict and signed actions | Real diff→existing bound save confirmation; immutable target with preserved dirty edits after SHA conflict/denial/disconnect; dirty leave through every switch; Host read-only; create/upload/rename/delete/download-cancel/SHA parity | M7 |
| audit/device source and query gates | Full-vs-self on Paper/Host, stale completion cannot overwrite new source/page; bounded filters/copy no secrets; no self revoke, immutable grant explanation, active Files/Backups copy | M7 |
| legacy read/clear and avatars | Settings legacy link until retirement criteria actually proved; no live archive writes; heads provider disabled means zero remote requests, fallback retained | M7/M8 |
| browser script signed fixtures, source/interaction checks, axe and timed soak | New full matrix also includes forbidden/stale/offline/partial/busy/error/loading/empty, 200% zoom, keyboard/focus, reduced/off motion, high contrast + forced colors, 360min width, safe area, real Chromium performance profile | M8 |
| 120 baseline scans configured WCAG2A/AA/2.1AA | No WCAG2.2 manual certificate: target sizing, focus obscuration, IME, screen reader and keyboard dialogs require explicit checks; serious Fleet finding must become0 at acceptance | M8 |
| lib/cpu-load.js old fallback test | Approved remove unused helper and obsolete tests, preserve metric-source independent tests | M8 |

## Existing browser-script scope

`scripts/verify-ui-browser.mjs` starts actual Next and signed local relay, seeds scoped roster/chat/plugin/configuration/audit/device responses, captures all workspaces, validates drawer keyboard/inert behavior, switching, gaps, metrics table/export and scoped exports, stale/Paper-offline/stopped service and an uploading durable job, runs axe and a Performance soak. Its accepted5.0 evidence directory was preserved. **The unchanged script was not rerun in this session**; the M0 harness uses the same signed fixture support with a separate120-page width/theme capture matrix and per-page axe. Reusing fixture support is not proof that every existing script assertion was executed.

All future regressions above remain not executed. Separate release build, Vercel preview, bundle diff, CPU/memory soak, live VPS/systemd/RCON/Drive acceptance and human 3-second comprehension are not executed in M0/M1. No live certification is inferred from fixture checks.

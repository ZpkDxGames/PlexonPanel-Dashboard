# 6.0.0 discovery baseline — M0 complete

Date: 2026-10-08 UTC. Branch `release/6.0.0`; production source `86b6a0cefb2c5e420c9c862a7897705e1ea59146` (accepted5.0.0 activation). M0 discovery is complete: the required inventories, untouched check, complete screenshot matrix and baseline axe execution exist. **Baseline accessibility is not clean**: Fleet has one serious rule violation in all8 variants. Recording that defect completes discovery; it does not pass a later zero-violation UI acceptance gate. No production UI/logic/tests/dependencies were changed.

## Authority and resolved stop

[UI_6_DECISIONS.md](UI_6_DECISIONS.md) overrides the brief. The earlier mandatory §0.9 stop is resolved by maintainer decision1: correct Host-only service state and the contradictory dashboard-2-1 test in M3, not now. Existing `normalizeServiceState(undefined,true)` returns active; shell restart/palette callers use it, while Server uses false. This approved future correction remains an explicit baseline defect. Decisions preserve six Overview tiles, nine Performance charts, one real backup-progress stream, stored accents, bounded chat cache, active Files/Backups, existing file diff/conflict/dirty guards and navigation-only future palette. Unused CPU fallback removal is approved M8.

## Executed gates and provenance

| Gate | Result | Evidence / limits |
|---|---|---|
| Entire brief, AGENTS.md, CLAUDE.md | Read completely | Root brief exact supplied copy; CLAUDE delegates AGENTS |
| Rollback anchor / isolation | Passed | Exact sourceSHA above in UI_6_ROLLOUT.md; new release worktree; main untouched; no tag created |
| Untouched `npm ci && npm run check` | Passed |415 packages, Node24.19/npm11.9;79 relay+183 dashboard tests,0 failed/skipped |
| Installed Next16.3.8 docs | Read relevant guides | Font/CSS/lazy-loading/server/client guides; no Next code written |
| Playwright bundled Chromium1248 install | Failed | Invalid/truncated ZIP retries; with-deps apt lacked setgroups/seteuid privileges |
| Native headless-shell one-page smoke before matrix | Passed | Chromium153.0.8010.0 via isolated @sparticuz/chromium153; local page load + smokePNG |
| Full workspace/route matrix | Passed capture gate |120 full-page screenshots:15 pages×2 themes×4 widths; no pageerror;0 root horizontal overflow |
| Axe execution on every capture | Executed, findings present |120 scans with WCAG2A/AA/2.1AA tags;8 serious definition-list findings, all Fleet;112 other scans0 violations |
| Source/control/data/state/test inventories | Complete discovery artifacts | Linked catalogues below; per-state source review distinguished from executed healthy/empty screenshots |
| M0 end `npm run check` | Passed | Exit0;79 relay+183 dashboard,0 failures/skips; Next production-mode test build passed |
| Unchanged test:browser / performance soak | Not executed | M0 capture harness is separate; no inferred existing-script execution |
| Manual WCAG2.2 / screen reader / live systemd/RCON/Drive | Not executed | Baseline scans are not full certification |
| M1 design experiments / M2+ | Not executed at M0 commit | M1 follows this checkpoint; no production deployment |

## Screenshot environment and reproduction

Standard Playwright download could not be used in this container. The working executable is genuine Linux Chromium **headless shell**153 (rather than the Playwright1.64 expected Chromium156 build). Playwright drives it with `--disable-gpu --use-angle=swiftshader --enable-unsafe-swiftshader`, plus `--no-sandbox --no-zygote --single-process --disable-dev-shm-usage --disable-webgl --disable-software-rasterizer`; the additional flags bypass unsupported EGL initialization. CSS/HTML/native SVG render in software. `ldd` resolved all required libraries. Native deps installation was attempted and blocked by container privileges; no unexecuted install is claimed successful. Font rasterization/system-font fallback is environment-specific. This proves this native engine capture matrix, not browser-engine parity with the expected bundled build.

The archive includes `capture.mjs`, raw `browser-results.json`, all120 PNGs, review contact sheets, smoke script/log/image and command logs. Extract its ui6-baseline directory to repository `artifacts/ui6-baseline/`; the harness imports existing `scripts/support/fleet-fixture.mjs`. On a normal machine:

```sh
npm ci
npx playwright install --with-deps --only-shell chromium
npm run relay:build
PLEXON_SOURCE_COMMIT=86b6a0cefb2c5e420c9c862a7897705e1ea59146 node artifacts/ui6-baseline/capture.mjs
```

The harness automatically uses Playwright's bundled engine when PLEXON_CHROMIUM_EXECUTABLE is unset. In this container the executable/library path points to the isolated software-rendering shell. The harness starts Next development on loopback3000 and a signed standalone relay8788. Two simulated agents supply actual signed fixture envelopes with random ephemeral identities/grants; Minecraft/systemd/RCON/Drive are not contacted. No real credentials, entered pairing codes, tokens or keys are in screenshots. The pairing capture uses an empty placeholder, not an issued code.

Development captures contain the Next dev indicator and some genuine signed read-result notices. They are documented baseline environment artifacts, not desired production UI. Fleet's earliest light capture includes a waiting-for-first-telemetry second instance; later widths have received it. Console fixture ready state chooses signed PAPER_FALLBACK while scoped Host history responses are supplied; no real journald authority acceptance is claimed. Backup history is an honest empty fixture; no invented operation was added to the normal matrix.

## Complete screenshot matrix

All files live in `artifacts/ui6-baseline/`, separate from accepted5.0 evidence `docs/ui-evidence/after/`. [UI_6_SCREENSHOT_MANIFEST.json](UI_6_SCREENSHOT_MANIFEST.json) records sourceSHA, browser version, capture timestamp, width/theme, root geometry, DOM count, every per-page axe finding, byte size and SHA256 for all120 PNGs.

| Page | File prefix | Light widths | Dark widths |
|---|---|---|---|
| Fleet | fleet |390/768/1280/1920 |390/768/1280/1920 |
| Overview | overview |same4 |same4 |
| Performance | performance |same4 |same4 |
| Players | players |same4 |same4 |
| Console | console |same4 |same4 |
| Chat | chat |same4 |same4 |
| Plugins | plugins |same4 |same4 |
| Server | server |same4 |same4 |
| Backups | backups |same4 |same4 |
| Configuration | configuration |same4 |same4 |
| Audit | audit |same4 |same4 |
| Access | access |same4 |same4 |
| Settings | settings |same4 |same4 |
| Pairing | pairing |same4 |same4 |
| /activity | legacy-archive |same4 |same4 |

Filename format `<prefix>-<width>-<light|dark>.png`. Viewport height844 below800px,1080 otherwise; full-page images include all content. Local prefs use100% text, standard contrast, motion off, optional remote heads disabled. Saved preference migration/high-contrast/zoom/reduced-motion cross-state matrix remains later acceptance, not silently part of this baseline.

## Baseline accessibility result

Fleet: `definition-list`, serious, both server-card `<dl>` elements in each width/theme. Direct `<small>` children break valid dt/dd or grouping structure; fix markup while preserving source details during M4. Other112 scans found0 configured-rule violations. Axe does not prove manual target sizes, keyboard state transitions or WCAG2.2 focus obscuration. Access390 remains severely unusable from per-character text wrapping despite no root overflow and no axe finding: this is a concrete reason visual and manual acceptance must accompany automation.

## Route and owner map

The app has `/` (server selector and selected-server workspaces), `/activity` (read/clear-only legacy archive), and `/api/build` (nonsecret deployment build identity). Boot, pairing, confirmations and command palette live in `app/dashboard.tsx`, not separate routes.

Canonical `ViewProps` in `app/control-views.tsx`: `state: ControlState`, optional `deviceGrant: EffectiveDeviceGrant`, `can(action, kind?)`, `run(action, parameters, kind?, confirmationMode?)`, `notice`, `connected`, optional `setUnsaved`. Production availability is live session + reconciled signed grant + compatible target + connected authority + canonical scope/capability intersection; op/deop are Owner-only. High-risk actions, console execution and configured plugin reload use server/action/parameter-bound confirmations, with target generation checked before dispatch/completion.

| Workspace | Current owner / extra props | Principal data owners and gates |
|---|---|---|
| Fleet | `app/fleet-overview.tsx`; credentials/selected/connected/openServer/pair/labels/rememberName/phase | Existing FleetFeed + fleet-model + connection-state; authenticated per-instance feeds, shared node totals once |
| Overview | `app/overview-view.tsx`; ViewProps | metric-reports/chart-geometry/telemetry-freshness/fleet-model; per-source freshness, safe diagnostics, Paper history entry |
| Performance | `app/performance-view.tsx`; props/resetHistory | metric-reports/chart-geometry/shared telemetry-clock/preferences; browser-local pause/reset/export; no long history |
| Players | `app/players-view.tsx` + `player-roster.tsx`; ViewProps | durable-activity/device grant; players.view, players.history.view plus Paper capability; player.* through can/run |
| Console | `app/console-view.tsx`; ViewProps | signed data-source/control-state; Host history full/errors; Paper-only execute; bounded local view controls |
| Chat | `app/communication-views.tsx` ChatView; ViewProps | control-state; chat.view, chat.send alias, optional MiniMessage scope |
| Plugins | `app/communication-views.tsx` PluginsView; ViewProps | Paper inventory; plugins.view and configured plugin.command.reload → plugins.reload |
| Server | `app/server-view.tsx`; ViewProps | lifecycle-state/operation-messages; Host server.status/start/stop/restart, stable state + busy |
| Backups | `app/backups-view.tsx`; ViewProps | backup-readiness; Host maintenance/provider/full backup actions, durable job and matching live job ID |
| Configuration | `app/configuration-view.tsx` + `advanced-views.tsx` FilesView; ViewProps | Signed files workflow; prefers Paper listing; selected agent pinned; Host policy read-only; edit/create/upload/rename/delete/download existing gates |
| Audit | `app/governance-views.tsx` AuditView; ViewProps | useQuery; selected Paper/Host audit.list or audit.self; bounded 50-record pages |
| Access | governance AccessView; ViewProps + forget/pair | generated scopes + effective grant; devices.list/revoke; immutable grant disclosure; local forget |
| Settings | `app/settings-view.tsx`; ViewProps + reconnect | existing single ui-preferences provider; diagnostics/build/version metadata; local appearance controls |
| Pair/boot/shell | `app/dashboard.tsx` | data-source/browser-store/control-state/device-grant/display-cadence; pairing and immutable bound operations |
| Legacy archive | `app/activity/page.tsx` | activity-history/avatar-provider; bounded existing unverified entries, local clear only, no Paper journal merge |

## Completed parity inventories

- [UI_6_MODULE_INVENTORY.md](UI_6_MODULE_INVENTORY.md): every29 TSX presentation module, function/props signature and direct imported owners; workspace map above supplies canonical state/action props.
- [UI_6_CONTROL_AUDIT.md](UI_6_CONTROL_AUDIT.md): every228 control declaration, authorization, confirmation and local-vs-server effect, including mapped actions/weekday/window/preferences and production-hidden history controls. Exact ancestor conditions/callbacks in raw index retain action-specific parameters.
- [UI_6_DATA_INVENTORY.md](UI_6_DATA_INVENTORY.md): every reducer/result domain with source/units/cadence/nullable behavior; exact field-read index covers aliases; service CPU/RAM, tick metrics, roster, console authority, durable15-phase backups and optional counters explicitly resolved.
- [UI_6_STATE_MATRIX.md](UI_6_STATE_MATRIX.md): all15 pages×8 requested states; identifies complete, partial and missing current designs. Source review is not execution of every state scenario.
- [UI_6_TEST_CATALOGUE.md](UI_6_TEST_CATALOGUE.md): all31 dashboard suites/titles; [UI_6_TEST_GAPS.md](UI_6_TEST_GAPS.md) maps remaining mounted parity gaps to milestones and accurately states browser-script coverage.
- [UI_6_SOURCE_CATALOGUE.json](UI_6_SOURCE_CATALOGUE.json): reproducible TypeScript AST index of imports, function parameters,228 controls and2328 read expressions. No user secrets/runtime data are included.

## Visual findings that drive M1

| Screen | Observed pain point | Design consequence |
|---|---|---|
| Fleet | Repeated connection sentences/status rows per instance, equal emphasis for every metric, large blank wide-screen margins; serious dl markup | Compact source-aware instrument rows and useful shared infrastructure, no duplicate node totals |
| Overview | Six equal rounded cards followed by large sparse TPS/MSPT charts, repeated server/service/source identity | Keep all6 metrics but privilege tick health/Pulse, narrow secondary instrument row; details on demand |
| Performance | Nine tall chart panels create a long mobile page; repeated statistics/source lines and short observed coverage | Retain9, group by source/job, make low-history/gap truth prominent and stats concise; chart layout pref survives |
| Players | Mobile Manage button consumes a separate action row per player; fresh-vs-last snapshot age not obvious | Entire row opens drawer, compact identity/session data, keep supplied-only details and all13 gated actions |
| Console | Several toolbar rows consume reading space; timestamp wraps across lines; replay explanation dominates; local operations look like server commands | Console-first log well, compact filter drawer, sticky explicitly Paper-only command composer, readable timestamp columns |
| Chat | Multiple pill controls and large composer leave little chat reading area on phone; cache/privacy not visible | Plain message stream, compact local toolbar, explicit bounded cache control in Settings |
| Plugins | Narrow phone table hides detail/actions behind internal scrolling; Refresh sounds like an RPC but is notice-only | Compact inventory rows with metadata drawer; retain truthful pushed-snapshot behavior |
| Server | Large connection card duplicates shell authority; start/stop/restart equal visual footprint with sparse content | Host state as decisive instrument, one clear safe operation strip, pending stages and bound effects |
| Backups | Very long stacked readiness/forms on mobile; destination/capability prose repeated; settings compete with active workflow | Readiness summary + one durable phase progress, settings/history collapsed by intent, no lost safe diagnostics/actions |
| Configuration | Long introduction before list/editor; create/upload controls dominate tiny phone editor; review/save distinction subtle | File browser→editor mobile flow, pinned source/path and dirty state, actual diff plus existing bound action path |
| Audit | Date/actor filters split from local search meaning; event detail copy is distant | Query-vs-loaded-search labels, actual timestamped event rows with safe expandable detail |
| Access |390px this-device panel wraps role, connection and expiry one character per line; obsolete Advanced/Future copy | Stacked semantic key/value metadata, immutable grant visual intersection, active Files/Backups wording |
| Settings | One long all-settings grid with repeated browser-local explanations | Group Appearance/Charts/Players/Data & privacy; saved values intact; cache clear separate from visual reset |
| Pairing | Marketing headline competes with operational pairing form; mobile form below explanation | Pairing task first, brief trust explanation and real approval states |
| Legacy | Four empty metric cards overemphasize archive; back link/copy stylistically inconsistent | Small unverified cleanup surface reached from Settings until retirement criteria proved |

Observed screenshot review used all15 pages at390light/1280dark contact sheets, plus individual screenshots and the manifest for all120 dimensions. It is not a timed 3-second operator study. No measured performance improvement is claimed; baseline CPU/memory profiling remains not executed. Source shows bounds/geometry controls, not measured speed.

## Reconciliation with brief

All ten maintainer overrides are applied to planning. The brief’s “live compression + upload” description does not create two supplied progress streams; current code has only one latest phase payload. Overview/Performance counts exceed simplified later wording, and are preserved by decisions2/3. Palette currently executes restart; plan navigates. Defaults currently light/monochrome/compact; OS-following/new labels cannot overwrite stored choices. Chat cache100 remains. Active Files/Backups wording is corrected later. New local privacy controls require no protocol change. Undisclosed local policy/agent-last-seen cannot be separately fabricated for explainers; show known gates or “not supplied”. Configuration save confirmation must use existing bound path without replacing diff/conflict/dirty protections. No unresolved backend change is required by this M1 plan.

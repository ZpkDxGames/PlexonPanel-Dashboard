# Visual QA and performance plan

Version 1.0 · applies to every stage and final review-ready PR. This is an execution plan, not a claim that the future UI has passed.

## 1. Evidence levels and planning results

| Level | Meaning | Planning status |
| --- | --- | --- |
| SOURCE | Read immutable source/handlers and verified Git identity | Executed on both pinned commits |
| LOCAL TEST | TypeScript, unit/contract tests and local build | Executed:61 tests pass, build pass, initial JS 89, 808 B under 184, 320 B existing budget |
| FIXTURE BROWSER | Real browser rendering of labeled local synthetic fixtures; no external requests | Executed:32 main-route captures (8×2 sizes×2 themes), zero reported axe/overflow/page errors |
| HISTORICAL REPORT | Existing repo's PR90 results |61 tests/37 browser cases/25 control groups/12 reconstruction/7 reference/5 reviewed simulations reported; only the checks above independently rerun in planning |
| DESIGN PLATE | Static rendered composition guidance, no app and no readings | Included for concept/route discussion; not browser or functional proof |
| LIVE RUNTIME | Real paired agents/VPS/provider round trips | NOT_EXECUTED; outside planning authorization |
| PHYSICAL / AT | Actual devices, virtual keyboards, screen-reader hardware | NOT_EXECUTED during planning |

Baseline capture filenames and result JSON are in `evidence/baseline/`. Planning used Node 24.19.0 and the repository's pinned Playwright Firefox. Do not copy historical p95 values into the new PR as if remeasured. Test results identify source SHA, command, browser/build, fixture, time and limitations.

## 2. Reproduce source and fixture gates

Use a clean worktree at the implementation base, then the candidate under the same tool/runtime versions. Inspect scripts before invoking them. No live credentials or browser profile should be reused for QA. Existing script selectors may require updating to match intentional layout changes; equivalent or stronger behavior assertions must remain.

```bash
node --version
npm ci
npm run check
npm run build
npm run test:perf
npx playwright install firefox
node scripts/qa-local.mjs
node scripts/qa-local.mjs scripts/control-plane-check.mjs
node scripts/qa-local.mjs scripts/reconstruction-check.mjs
node scripts/qa-local.mjs scripts/reference-check.mjs
node scripts/qa-local.mjs scripts/review-confirmation-check.mjs
node scripts/qa-local.mjs scripts/visual-proofs.mjs
node scripts/qa-local.mjs scripts/extended-visual-proofs.mjs
MOZ_DISABLE_CONTENT_SANDBOX=1 node scripts/production-check.mjs
git diff --check
```

`npm run check` runs TypeScript plus `node --import tsx --test tests/*.test.ts`; no existing lint command. `npm run build` also typechecks and writes build identity. Do not replace a failing test with a mocked success. Package audit is an additional security check if network permits; record the actual result/version/date.

Development fixture URLs are localhost only, e.g. `http://127.0.0.1:4173/?fixture=healthy#Overview`. Existing named states include healthy/stale/partial/stopped/offline/denied/skew; inspect their definitions before assuming what they simulate. “healthy” contains a degraded backup job and does not mean every subsystem is healthy. Add narrowly scoped fixture scenarios in `src/development/fixtures.ts` or a localhost harness for missing cases. Keep all fixture imports behind the development boundary. Production fixture-bypass tests are mandatory after adding any scenario.

Browser interception must block all nonlocal requests in fixture tests. Disable skins except in explicit intercepted provider tests. Safe synthetic command/backup simulations must never call real relay/provider services. Fixture success is not agent/VPS success.

## 3. Required screenshot matrix

### 3.1 Main routes — equal completion gate

For each R01–R08 capture **1440×900 dark, 1440×900 light, 390×844 dark, 390×844 light** at 100% zoom, comfortable density, standard text, motion off and fixed fixture input. Save viewport and full-page images when the route extends below the fold. If dynamic clocks prevent pixel equality, use bounded masks for timestamps only and retain unmasked truth screenshots; never mask state, values, permissions or layout defects.

| Route | First-viewport acceptance | Additional required state proof |
| --- | --- | --- |
| Fleet | Selected instance, passive labels, search and verified-node context legible |16 instances/shared node; legacy; stale; selection error; no matches |
| Overview | Entity, 4 readings, primary chart and ≥6 console lines at desktop 900px | Host-only stopped service; zero players; stale heap/no meter; service CPU 150%; denied roster/console |
| Performance | Signal/source/unit/range, readable axes and fixed inspection shelf | One sample/no samples/gap/spike/skew; pinned sample; all 8 tracks; data table |
| Players | Roster identity/search/world/sort; profile exact UUID and current session | Full profile; all 3 tool tabs; history denied/disabled/empty/older page; vanished UUID |
| Console | Authority, usable output, footer and review composer on desktop | Chat and Plugins tabs; errors-only; pause/scroll-up/wrap; command unavailable; long text |
| Backups | Current job/proof before inventory; degraded reason/retry in first mobile viewport | Every durable phase family; expired/failed preflight; remote-only archive; recovery-required |
| Access | Audit source/scope label and immutable target/outcome; all 3 views | Self-only audit; Host device mirror; missing capability; current browser; exact revoke review |
| Settings | Current section, readable choices/feedback and truthful specimen | All 4 sections; all 8 preferences; storage failure; unavailable build; invalid relay; skins disabled |

### 3.2 Shared and nested surfaces

At desktop/mobile and dark/light, capture PairingGate, PairingForm rejected/connecting, splash, navigation dialog, command palette no-results, action review ordinary/typed/invalidated/queued/unknown-result, player profile, Chat, Plugin inventory, Backups degraded/recovery and all Settings chapters. These are additions to the 32 main-route proofs, not replacements.

At minimum record the following viewport checks across **all eight routes**:320×800, 390×844, 640×960, 820×1180, 1024×768, 1440×900, 1920×1080. Run overflow/focus/axe assertions at every width. Capture all eight at 820×1180 light as explicit tablet proof; save any failing width before/after fixing. At320 use large text in one pass and standard text in another. At1920 verify max-content width rather than enormous empty plots.

### 3.3 Preferences and state coverage without an uncontrolled Cartesian product

- Main 32: comfortable/standard/motion off, both themes, two sizes.
- All 8 routes at 390 dark compact/small and 390 light spacious/large.
- All 8 at 820 light spacious/large and 1024 dark comfortable/standard.
- Both accents blue/violet plus teal at 1440/390 for Overview, Performance, Settings and ActionReview; audit token contrast for shared surfaces across all routes.
- Motion full/reduced/off plus OS reduce on navigation/dialog/profile transitions; no telemetry animation in any mode.
- Browser/UTC on every timestamp-bearing route; verify actual capture instants unchanged.
- Each skin provider with intercepted success/failure, and disabled with zero external requests; do not call providers for fictitious UUIDs during automated tests.
- Chart fill true/false in focus and compare with gaps; no orphan fill polygon across a gap.
- On all routes exercise local no-data/denied/disconnected; use route-specific states from section 4 for deeper controls.

Actual browser zoom at 200% is a separate manual or browser-supported test. DeviceScaleFactor or a smaller viewport is **not** proof of real zoom. Check effective 320px reflow and keyboard visibility; record browser limitations rather than using CSS zoom to simulate compliance.

## 4. Critical regression scenarios

Each scenario specifies an observable behavior, not an implementation-mirroring unit test.

| ID | Scenario | Required assertion / test placement |
| --- | --- | --- |
| Q01 | Prepare restart on A, select B, then attempt old dispatch | No outgoing action; invalid-target message; contracts/review browser |
| Q02 | Paper session changes while Host stays online | Paper plot/history/profile state resets, Host retained evidence remains valid; epochs/isolation tests |
| Q03 | Signed grant loses a scope after review opens | Dispatch disabled/rejected; no role bypass; contracts/device-grant |
| Q04 | Relay action_queued without action.result | Busy/unknown state, no success and no automatic resend; contracts |
| Q05 | Host create action SUCCESS with data.state QUEUED | Receipt says accepted job, job not completed; new browser assertion in reviewed-action suite |
| Q06 | Disconnect/timeout after dispatch | Outcome unknown, request context retained, audit/status route offered, no resend |
| Q07 | Two player history requests, late first response | Exact current UUID/server only; old response ignored; reference-check |
| Q08 | Selected UUID leaves roster | No first-player fallback; controls cannot switch target; Back focus fallback works |
| Q09 | Direct skin provider fails then preference changes | Loading/failure resets for provider+UUID, fixed size, only chosen provider requested; new PlayerHead scenario |
| Q10 | Error-only console grant with INFO in forbidden fixture stream | Protected filtering cannot reveal/export unauthorized INFO; source contract remains server-side too |
| Q11 | Console scroll-up/pause during ingestion | Retention continues bounded; display freeze/tail status truthful; Return to live restores bottom |
| Q12 | Text-size large + resized terminal | Correct visible range and scroll position, no clipped/overlapping virtual rows; no observer loop |
| Q13 | Safe text adversarial payloads | HTML/script/URLs/ANSI/MiniMessage remain bounded inert segments; text-format tests |
| Q14 | Plugin reload disabled by Paper or command policy | No generic reload fallback; exact operation target and denial |
| Q15 | Preflight provider fails before source/storage checks | Failure shown at known stage only; later checks Unknown, create disabled |
| Q16 | Fresh preflight expires after 30s | Creation disabled; preserved historical facts labeled expired; no green readiness |
| Q17 | JobB receives late JobA progress | Ignore mismatched jobId; verification unaffected |
| Q18 | Transfer 100%, remoteVerified absent/false | No completed/verified claim; verify phase stays explicit |
| Q19 | Degraded local-verified archive with retryable true/false | Show local proof; only permitted true case can prepare retry-upload; no new shutdown |
| Q20 | RECOVERY_REQUIRED | Destructive creation blocked by authoritative gate, no journal reset or fake completion |
| Q21 | Partial backup query failure | Successful inventory/status remain independently labeled; rejected read not empty success |
| Q22 | Switch audit Host→Paper with late Host response | No cross-source row leak; source label never mismatches records |
| Q23 | Current device in Host mirror list | Self-revoke disabled; other revoke still Paper-only and reviewed |
| Q24 | Owner but absent scope/capability | Authority ledger says unavailable; dispatch fails closed |
| Q25 | Fresh import after persisted preferences | All fields restored; oneOf initialization order safe; preferences-startup |
| Q26 | localStorage denied but IndexedDB pairing exists | Existing pairing recoverable; preferences apply in-memory without false saved proof |
| Q27 | Malformed/changed relay origin | No token goes to mismatched/unsafe origin; credential retained; relay-session |
| Q28 | Future capture >5s ahead of receipt | Skew label, receipt-based expiry, no immortal “live” reading; freshness |
| Q29 | Null/NaN/gap/spike/one-point chart | Truthful gap, extrema, isolated point, correct table; geometry/presentation tests |
| Q30 | Shared node with different/unbound/stale identity | No unverified aggregation; cgroup not machine CPU; fleet tests |
| Q31 | Production request with ?fixture=healthy | Unpaired gate remains; fixture module/data absent; production-check |
| Q32 | Mobile review/dialog with long target and keyboard | Full target accessible, focused field/footer visible, Escape/Back returns focus |

Use the existing test file owners: `contracts.test.ts`, `pairing.test.ts`, `relay-session.test.ts`, `relay-config.test.ts`, `review-policy.test.ts`, `entry-state.test.ts`, `freshness.test.ts`, `fleet.test.ts`, `presentation-{epochs,isolation,telemetry}.test.ts`, `chart-geometry.test.ts`, `player-{commands,history}.test.ts`, `backup-readiness.test.ts`, `preferences*.test.ts`, `text-format.test.ts`, `selectors.test.ts`, `soak.test.ts`, and the browser scripts. Add tests only where behavior changes or a concrete risk lacks coverage; do not add thousands of snapshots for trivial CSS values.

## 5. Accessibility acceptance

Run axe and manual keyboard review. Automated zero violations is necessary but insufficient. WCAG 2.2 AA is the target; no formal conformance claim without complete assessment.

- Text contrast ≥4.5:1 for normal text and ≥3:1 for large text; meaningful controls/focus/graph traces ≥3:1 against adjacent surfaces. Token contrast report must include both themes, all accents, semantic badges and disabled explanatory text.
- 44px minimum touch targets; compact desktop 36px controls allowed with adequate spacing. Small table copy controls get 44px touch hit area without overlapping adjacent targets.
- Keyboard access to all controls, focus visible and not hidden by sticky headers/composers; skip link reaches main. No focus change on telemetry tick.
- Native dialog trap/return/Escape; typed confirmation announced with exact target. Only one modal interaction at a time.
- Tabs have correct selected state and arrow/Home/End support. Profile Back restores inspected row or stable heading.
- Tables have captions/headers; scroll regions labeled/focusable. Mobile record replacements preserve semantic label/value associations.
- Chart summaries and latest 50 sample table provide nonpointer alternatives. Key/touch inspection announces on user input, not continuous streaming.
- Errors use associated messages; denied controls have accessible reasons independent of tooltip/hover. Source state uses words/icons, not color alone.
- Reduced/off motion and forced-colors mode preserve meaning. Do not use shimmer/loading loops or animated value interpolation.
- 320px reflow, large text and 200% actual zoom preserve task completion. Internal table/terminal horizontal scrolling is permissible; document horizontal overflow is not.

Reference basis: [W3C WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG 22/quickref/), [reflow](https://www.w3.org/WAI/WCAG 22/Understanding/reflow.html), [target size](https://www.w3.org/WAI/WCAG 22/Understanding/target-size-minimum.html). Product choices exceed the minimum where specified.

## 6. Performance budgets

Use these as project gates, not real-world SLAs. `scripts/performance.mjs` uses Node zlib defaults; use that same method for comparable bytes rather than comparing the Vite terminal summary (which can differ). Freeze Node/browser versions between base and candidate.

| Measure | Known baseline | Candidate gate | Target / response to failure |
| --- | --- | --- | --- |
| Initial route JS gzip |89, 808 B independently reproduced |≤104, 448 B (102KiB); existing 184, 320 B absolute gate remains | Preserve lazy routes; justify any growth; no chart/UI framework |
| All emitted JS gzip |125, 911 B historical PR90 measurement |≤148, 480 B (145KiB), measured same method | Inspect chunk duplication; keep route modules lazy |
| CSS gzip |20, 666 B historical; recompute at P0 |≤24, 576 B | Remove obsolete selectors; no override appendix |
| New original vectors |None required baseline |≤24, 576 B gzip total | SVG/block geometry; no decorative raster payload |
| Fonts |Existing self-hosted Manrope/JetBrains |No added font family or external CDN request | Retain subsets/current loading unless measured optimization justified |
| Raw memory bounds |35m/8192 samples, 2500 console, 512 roster, 64 worlds, 200 chat |No increase; teardown releases obsolete sessions/observers | Contract/soak tests; no fake24h retention |
| Console DOM |Viewport virtual rows; latest 400 wrap |No-wrap≤ceil(viewportHeight/measuredRowHeight)+16; wrap≤400 | Resize/text-size proof; no full 2500 DOM rows |
| Default chart count |Overview 2 main plots; Performance 1 |Do not add animated mini-charts everywhere | Supplementary sparse sparklines remain bounded |
| Focus Performance p95 frame interval |17.22ms historical short replay |Same-environment median of 3≤max(25ms, 1.10×new baseline) | Target≤25ms; inspect crosshair/projection work |
| Overview p95 frame interval |33.28ms historical |Median of 3≤max(40ms, 1.10×new baseline) | Target≤40ms; no broad subscriptions for pointer state |
| Eight-track p95 frame interval |83.50ms historical median3 |Median of 3≤max(83.50ms, 1.10×new baseline); must be reported separately | Target≤66.7ms; isolate inspection renders, avoid hidden path churn |
| User-input→visible feedback |Not previously measured |p95≤100ms desktop,≤200ms defined CPU-throttled mobile; network completion excluded | Instrument search/filter/tab/pin; announce pending immediately |
| Layout stability after load |Not independently measured |No graph/terminal height changes on sample/hover; CLS≤0.05 in controlled replay | Reserve units/avatar/skeleton/evidence shelf geometry |
| Route transition after chunk available |Not independently measured |p95≤200ms on baseline test machine | No blocked-main-thread transitions |

If the new baseline itself exceeds an absolute target, report the environment and source cause rather than silently relaxing numbers. The max expressions permit the inherited baseline while preventing an unexplained >10% regression above the practical ceiling. A slow inherited mode is an explicit limitation, not an advertised 60fps experience. If baseline/candidate runs vary >25%, run five paired trials and investigate load; never cherry-pick the fastest run.

## 7. Measurement protocol

1. Use two clean worktrees (actual verified base/candidate), same Node 24, same lockfile/browser/CPU, no simultaneous profiling. Record viewport 1440×900 and mobile 390×844, motion off, skins disabled, fixture health/gap input.
2. Build both; measure initial/allJS/CSS gzip with the existing script method. Record source and build identities, asset count and compression settings. Browser cold/warm timings are separate.
3. Run inherited replay with 8192 raw observations, 2500 console lines and 24 events spaced 125ms. Record p50/p95 frame interval, plot count, DOM nodes and input traces. This is a short replay, not a soak or end-to-end latency SLA.
4. Add a 60-second steady-input replay and a 10-minute bound/teardown session using the same workload on base/candidate. Sample at start/end; switch servers/routes repeatedly; verify listeners/observers/socket cleanup. Heap measurement is browser-dependent; if unsupported, say so and report bounds/DOM rather than claiming zero memory growth.
5. Exercise focus/crosshair separately from ingestion. Pin a sample, resize, change range and reconnect source. A speedup that drops samples/spikes/gaps or suppresses valid updates fails.
6. For comparison, keep all 8 signals available, record mounted/visible track count and consistent layout. Do not improve numbers by hiding tracks without declaring it. Rendering offscreen views may be optimized only with correct focus/data access and test coverage.
7. Measure terminal nowrap/wrap, text-size large and source/severity filtering under 2500-line retention. Confirm row measurements agree with layout and output remains bounded.
8. Report display-path microbenchmark separately (`node --import tsx scripts/telemetry-profile.mjs`). It excludes React/paint/transport and must not be advertised as whole-app speedup.

Do not infer wire telemetry delay from browser frame statistics. Separate agent capture→browser receipt, receipt→presentation and input→feedback if instrumented. Clock skew means capture→receipt is not a trustworthy latency measurement without synchronization; show evidence rather than a fabricated p95 network chart.

## 8. Evidence naming and review gate

Use `route-state-widthxheight-theme-density-text-motion.png`, with an accompanying JSON row: base/head SHA, browser/version, viewport, zoom, actual theme, fixture/state, timestamps, scenario ID, axe/overflow/page errors and result. Screenshots should show the development label. Keep logs/JSON and image hashes in the PR artifact manifest; no credentials, real pairing codes or private console data.

For each R01–R08, reviewer records layout fidelity, readability at 100%, task completion, source/state truth, narrow-screen behavior, keyboard result and screenshot references. Each category must pass; no averaging a failed Backups route against a strong Overview. A missing route/theme/critical-state proof blocks review readiness.

**Not executed live by this project without separate authorization:** real Host lifecycle, save-all/stop/cold archive/provider verification/restart, real device revoke, production pairing/origin changes, deployed-version comparison requiring private access, physical mobile/Safari/assistive hardware and actual24h runtime soak. List these separately; do not claim they block all read-only design work or certify them from source tests.

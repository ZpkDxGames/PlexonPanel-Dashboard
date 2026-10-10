# M4a — Overview and Tick Pulse

Status: implementation and evidence complete for maintainer review. The dense stress run **fails the brief's long-task budget**, so M4a is not a fully green milestone. Final `npm run check` is green. M4b is unstarted and requires maintainer approval. Branch: `release/6.0.0`; local commits only. Decisions 17–19 are recorded in `UI_6_DECISIONS.md`; the optional push clause remains unselected.

## Implemented scope

Overview has one renderer. Tick Pulse leads, followed by dominant TPS/MSPT, a presence row and quieter JVM heap, service CPU and service RAM rows. These use `lib/metric-reports` source provenance, thinning and gap segmentation. Source controls expose units, captured time, freshness and the latest browser receipt, explicitly identifying that receipt as any packet. Existing instance identity, Host-only service state, Paper uptime/Minecraft/agent versions, presence history, world activity, refresh and safe diagnostics remain. The original TPS/MSPT history charts remain in a disclosure. Overview-specific legacy cards and CSS are retired; other workspaces remain unchanged.

Below 1024 px, one normal-case state/count chip opens the existing four-source authority disclosure. It never uses Paper connectivity to determine Host service state. The compact Pulse fills the reserved header slot. The desktop rail occupies the viewport, remains sticky on long pages and scrolls its own content on short viewports. Singular world copy is corrected. The conditional attention strip links only existing Server/Backups destinations and reads backup state through the existing grant-gated, bound `maintenance.status` path; no mutation, capability or polling owner was added.

Tick Pulse uses Paper-health source capture times. Raw marks require at least 2 CSS px separation; otherwise approximately 3 px buckets show capture count, worst known TPS category and MSPT min/max. Visible Raw/Summarized labels show count and window. Category shapes accompany colors; null remains unknown, real zero reaches the baseline, true gaps are crosshatched and unknown time is vertically hatched. Neither the Pulse nor its sparklines interpolate a gap. The exact lens and 100-row paged table retain all valid nonfuture retained captures, including captures outside the visible window, with identical full-precision values.

The header/full views share the existing window preference and a capture-anchored end. Age ticks, Host-only receipts, retention pruning and disconnect metadata do not repaint the capture snapshot or advance its time window. New captures update the raster; explicit mount, size, theme and window changes necessarily repaint it. Pointer/keyboard cursors use DOM overlays. Raster geometry is bounded by plot pixels and device pixel ratio is capped at 2. The dev-only kitchen sink includes raw, dense, gap/unknown/zero, lagging/overflow, stale, disconnected and empty specimens.

## Gate ledger

The final screenshot matrix, updated foundation and complete check passed. Production inspection, reduced motion and hydration CLS executed successfully. Performance measurements executed, but the whole-page long-task budget failed. The browser harness's `status: passed` describes its executed correctness/CLS assertions; it does not assert the long-task limit. [Measurement summary](ui6-m4a/measurement-summary.json) records that separate failed gate. The milestone remains failed on that budget and stops here for review.

| Gate | Result | Evidence / limit |
|---|---|---|
| Pre-M4 authority/case/plural/rail fixes | passed | [Two screenshots/scans and geometry assertions](ui6-m4a/pre-fixes/shell-verification.json) |
| Requested Overview state/theme/width matrix | passed | 10 states ×2 themes ×5 widths =100 final production captures/scans; five successful 20-case commands on frozen source. [All screenshots](ui6-m4a/README.md), [hashes](ui6-m4a/screenshot-manifest.json) |
| Axe for the full matrix | passed configured automated scans | 0 violations/page errors; 900 controlled references and 64 incomplete glyph contrasts independently reviewed. Raw 810 native-reference incomplete nodes and 64 contrast incomplete nodes retained; minimum reviewed contrast 10.485750:1 |
| Keyboard and pointer exact inspection | passed | Home/End/arrows, Enter, Next/Previous, Escape focus restore; tooltip/lens/table parity; no inspection raster work |
| Reduced motion / idle clock | passed | No canvas animation; 2.4-second idle raster count unchanged; mounted age/Host-retention regressions |
| Hydration-inclusive production CLS | passed | All four samples <0.05; exact values below |
| 4× CPU draw measurements | executed | Canvas command timings plus whole-page Paint/RasterTask trace and CPU profiles; not a claim of exclusive Pulse raster cost |
| Dense whole-page long-task budget | **failed** | 394 ms at390 /284 ms at1920; budget100 ms. Realtime hardware certification not executed |
| Required palette / new composites | passed | 116 pairs; text≥5.136208:1, boundary≥3.876348:1. M4a introduces no composite colors |
| Updated dev foundation/kitchen sink | passed | [Final-source run](ui6-m4a/foundation/kitchen-verification.json):20 scans,0 violations/page errors,480 controlled references, keyboard/theme/read-only/disabled/forced-colors/200% text checks; four rendered popover contrasts reviewed |
| Cold-cache production fonts | passed | [Trace](ui6-m4a/production-fonts/production-font-trace.json); emitted range faces, adjusted fallback stacks, Latin-only Hanken for English/Portuguese; extended demand and system fallback verified |
| Actual production dev exclusion | passed | [Manifest/chunk scan](ui6-m4a/build-exclusion.json), 98 emitted files, zero gallery/fixture markers or gallery CSS; three build tests pass, production dev URL404 |
| Invariant/model/renderer tests | passed | 22 focused tests: raw/summary boundary, half-open buckets, zero/null, gaps, order/future timestamps, Paper-only adapter, CPU meanings and no idle/Host-only raster work; included in full check |
| Signed mounted flow | passed | [19 signed subcases plus parent](ui6-m4a/mounted-flow-status.json),0 failures/skips; navigation never mutates and original target/confirmation/dirty-leave safety remains |
| Final full `npm run check` | passed | [Exit0](ui6-m4a/check-status.json),[complete transcript](ui6-m4a/check-command.txt):79 relay+221 dashboard tests,0 failures/skips; scopes/fleet generation checks, lint, TypeScript and actual production build |
| Original `verify-ui-browser.mjs` after M4a | not executed | Script is unchanged; M3 pass is historical, not an M4a execution |
| Real devices / other engines / screen readers / comprehension test | not executed | No hardware, AT or user-study certificate |
| LCP / INP / Realtime mid-tier profile / live service commands | not executed | No live deployment/Host/Paper certification |

Executed pre-fix smoke: 2 screenshots, 2 whole-page axe scans with zero violations; all four authority sources reachable; short-viewport rail overflow/stickiness checked. Executed palette calculation: 116 required pairs pass, minimum text 5.136208:1 and essential boundary 3.876348:1; no new composite colors. The eight quiet decorative boundary pairs are not used as sole essential control boundaries.

Screenshot and font/exclusion evidence used production build `50gvVyic8Wy-k31o34A84`. Only Hanken Latin is preloaded (34,704 bytes). Commit Mono400 (48,128 bytes) is demanded by visible permitted monospaced text on the initial root page; it is not preloaded. English/Portuguese did not request Hanken extended. The Ł probe requested the extended face once (19,588 bytes); Ж used DejaVu Sans system fallback. No universal script coverage is claimed. Both DS stacks retain the metric-adjusted `hankenLatin Fallback` immediately after Hanken; emitted CSS assertions remained strict.

The final foundation rerun first stopped after five scans because Turbopack's generated development cache contained a truncated block. Its failed result and panic log remain in `attempts/foundation-final-empty-response*`. Clearing only `.next/dev` resolved it; the complete retry exited0 with20 scans. No application/source fix or ignored assertion was used for that environment failure.

The first final full check found an outdated navigation-test mount selector: it required the legacy wrapper for Overview, which the authorized new renderer deliberately leaves. The optional old charts now mount only while open, so they no longer happened to satisfy that observation. The test now observes `[data-ui6-overview]` for Overview and the unchanged wrapper for other destinations. No navigation/operation/target assertion was removed. The signed19-subcase rerun and complete check passed; the failed transcript remains in `attempts/check-final-mounted-flow-failure.txt`. Runtime-source fingerprint is unchanged across the final matrix, measurements and test-only adjustment ([scope audit](ui6-m4a/scope-audit.json)).

### Production inspection and stability

Home/End/Left/Right, Enter, keyboard Next/Previous capture, Escape and focus restoration passed. Pointer tooltip → lens → table timestamp/TPS/MSPT parity passed. Inspection changes a DOM cursor, not the canvas. The idle raster counter stayed 10 → 10 over 2.4 seconds; mounted tests additionally cover Host-only samples and retention pruning. The retained TPS/MSPT charts open by keyboard, mount two charts, and unmount both when closed. Reduced-motion media plus the saved motion-off preference produced no canvas animation. Five production inspection/CLS-page axe scans had zero violations; incomplete references and glyph contrast were independently reviewed against live DOM/rendered colors.

Cold-cache production CLS used buffered LayoutShift observations without recent input, the standard maximum session window, a 1,200 ms font delay and hydration plus synthetic server selection. The synthetic DOM click is not a trusted input exclusion, so the navigation shift is included. Raw sources/timing are in [production/overview-verification.json](ui6-m4a/production/overview-verification.json).

| Theme | 390 px | 1280 px | Gate |
|---|---:|---:|---|
| Light | 0.043824 | 0.022451 | passed: < 0.05 |
| Dark | 0.044046 | 0.021675 | passed: < 0.05 |

The first attempt exceeded 0.05; its raw failure remains in `attempts/production-initial-metrics-failure.json`. Reserving the header/plot geometry and moving the ordinary Overview connection message into its status semantics removed the banner-collapse shift. Error, stale and disconnected banners remain visible. No failed result was relabelled passed.

### Draw cost and failed performance gate

The production software-rendering run used 6,000 synthetic retained Paper captures and CDP 4× CPU throttle at 390 and 1920. Twelve new captures were traced, then twelve were measured without CPU profiling/tracing. Canvas timings below measure command submission, **not** the entire frame or exclusive raster cost. Whole-page CDP Paint/RasterTask samples are separately retained with CPU profiles.

| Viewport | Full canvas median / maximum | Compact median / maximum | Untraced whole-page longest task |
|---|---:|---:|---:|
| 390 | 2.45 / 20.10 ms | 3.10 / 16.60 ms | **394 ms — failed** |
| 1920 | 9.30 / 33.60 ms | 8.70 / 48.00 ms | **284 ms — failed** |

Summary geometry/hatching stays pixel-bounded. Full/header normalization is shared through weak immutable-history keys; source-only changes update derived geometry, and the legacy history charts compute only while open. These optimizations did not make the whole-page stress gate green. They do not justify subtracting unrelated costs from the budget. The run used the existing Balanced display preference, not a certified mid-tier device at Realtime. Realtime certification, LCP and INP are **not executed**. A follow-up should profile the remaining capture-update React/history work on a clean mobile profile before accepting the performance gate; no backend change is needed or proposed.

## Source limits and brief reconciliation

- Service uptime is not in the current signed packets. It reads “Not supplied”; Paper uptime is separately sourced and freshness-gated.
- The ready packet supplies Minecraft and Paper agent/plugin versions, not an independent Paper build version. Labels identify the available fields.
- Host agent version is supplied in ready metadata and remains in existing safe diagnostics; it does not supply service uptime or a separate service build version.
- The world reducer does not retain world capture time. The original fresh-Paper-health gate is preserved, and world source details explicitly say capture time is unavailable. A fresh world-specific timestamp is not invented.
- Per-capture browser receipt time is not retained. Exact lens/tooltip say “Not supplied”; the latest any-packet receipt remains separately labelled.
- Service CPU is the Host systemd cgroup value (100% means one core), never Host machine CPU or Paper process CPU. The existing separate Performance series are untouched.
- Original TPS below 18 / MSPT above 50 warnings remain, alongside the Pulse's separate category thresholds (19 and 15 TPS). Neither is derived by parsing formatted text.
- Live raster is a snapshot of the most recent capture frame; the exact table uses the current bounded retained list. Host-only retention pruning does not trigger raster work. Explicit inspection remains exact rather than pretending all summarized marks are single captures.

## Screenshot self-review against section 6.2

Hierarchy is deliberate: the time instrument comes first, TPS/MSPT share an unequal primary band, players form a separate row and the three resource rows are quieter. There are no six identical cards, delta chips, decorative gradients/glows, count animations or hover lifts. Dark and light use the accepted Quartz/Deepslate tones, radius scale and essential boundaries. Headings use the selected Hanken font, with tabular numbers; Commit Mono is limited to permitted identifiers. Shell/Overview sources use normal case, not tracked all-caps tags. Status shapes, explicit words and hatching prevent color-only interpretation. Empty states use text, never stock imagery or shipped fixture data.

The accessory removed was the old row of Paper/Host uppercase tags: source names live beside each relevant measurement and in its disclosure. Safe diagnostics and the retained large history charts stay closed by default, keeping the current instruments ahead of technical details.

Weakest choices: mobile Pulse explanations and six source controls make the page long; the first viewport reserves room for the title and both Pulse variants, but the instrument readings follow below. Dense min/max marks are necessarily a summary and can look like a band; the mode label and exact lens must carry that distinction. The tiny header Pulse is a quick pattern cue rather than an exact reading. The lens's neighboring captures use equal capture spacing, explicitly labelled as capture order rather than elapsed time; the main plot retains the true time geometry. These deserve maintainer visual review, not a claim of user-tested comprehension.

The quieter resource rows rely on separators; this is the closest visual risk to the brief's prohibition on broadsheet rule layouts. Their explicit source/readout/sparkline columns and the stronger tonal TPS/MSPT band provide instrument hierarchy, but this needs screenshot review. The mobile exact table scrolls horizontally; the selected capture's complete values stay in the facts above it. The retained optional history charts use their existing scoped skin, and the accepted shell activity tray retains its existing middle-dot metadata copy. Neither is evidence that all later workspace presentation debt is already removed.

## Evidence limits and stopping point

Browser history fixtures are explicitly synthetic and seeded into the real bounded browser cache. Current states, grants and read results come from local signed fixture agents. This is renderer/safety regression evidence, not a live Host/Paper deployment certificate. Other engines, screen readers, physical phones and real service/backup commands are not executed. M4b Fleet/Performance and later milestones are not executed.

The accepted5.0 Fleet definition-list failure remains untouched and assigned to M4b under decision13. Zero Overview axe violations do not claim that the legacy Fleet is already rebuilt or clean. All M4a captures are in a separate evidence directory. Earlier failed/interrupted runs remain as raw attempt records; only the final five successful production batches certify the100-case matrix.

The checkout initially had a `.git` pointer into a vanished scratch directory. Accepted source/evidence was preserved in recovery commit `ef33927` with self-contained Git metadata. Unpublished prior commit objects were unavailable; their recorded evidence is preserved, not claimed reconstructed. No main, remote ref, tag, dependency or deployment was changed.

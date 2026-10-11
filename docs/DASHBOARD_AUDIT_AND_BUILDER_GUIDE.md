# PlexonPanel dashboard — deep audit and execution guide

Date: 2026-10-11. Target: a professional operations dashboard for Minecraft server instances.

**Delivery status:** the source improvements described in §4 are implemented on `codex/dashboard-audit-refinement`. TypeScript, 50 tests, production build and the bundle budget pass. This is a review candidate. Authenticated live-server acceptance, rendered inspection of the revised workspaces, browser accessibility testing and production promotion remain **not executed**. Passing a build does not establish that the complete dashboard has passed professional visual or live operational acceptance.

## 1. Exact sources and evidence boundaries

| Source | Inspected identity | What it establishes |
| --- | --- | --- |
| Dashboard `main` | `0ccb709038d17209a50db4fddf70a35948c4988f` | Protocol adapter, first-run pairing, long-grant hotfix and existing tests. |
| Actually deployed redesign | `cf3a86d0f8a1cfba3fca5c861caf4265962fc41e`, branch `revamped-dashboard` | Current presentation, eight workspaces, both themes and existing interaction implementations. This is the parent of this refinement. |
| Production dashboard | `https://plexon-panel-dashboard.vercel.app/` | Public splash/pairing layout observed in Chromium at 1363 × 936. `/build.json` identifies the redesign SHA above. |
| Production deployment | `dpl_FpETXK6wXERmQkssRdJxgA9HQukt` | Vercel reports `READY`, production, and branch `revamped-dashboard`. |
| Paper/Host repository | `ZpkDxGames/PlexonPanel` at `09deffc568e36828b4cb56c91f576b7f8524122c` | Protocol-3 contracts, Minecraft action parameters, telemetry cadences and maintenance event names. Source inspection only. |

Repository: [ZpkDxGames/PlexonPanel-Dashboard](https://github.com/ZpkDxGames/PlexonPanel-Dashboard). Agent repository: [ZpkDxGames/PlexonPanel](https://github.com/ZpkDxGames/PlexonPanel).

The initial checkout was `main`. The production build was newer, so the implementation was rebased by starting from `revamped-dashboard` **before any edits**. Do not merge this work into an older checkout in a way that removes the deployed design.

Evidence terms in this document:

- **Observed live:** actually inspected public rendered state or deployment metadata.
- **Confirmed in source:** directly demonstrated by code or a documented agent contract.
- **Regression checked:** exercised by the current test suite or a build/check command.
- **Implemented:** the change exists and compiles; this alone is not visual/live certification.
- **Not executed:** a required check was unavailable or not performed. It is never equivalent to passed.

No production credential was retrieved. The inspection browser had no paired server. Real TonimSMP telemetry, controls, pairing completion and measured end-to-end latency were not available in this session.

## 2. Current structure and capability inventory

### Architecture

React 19.3.0 + TypeScript 7.0.2 + Vite 8.3.4, Node 24.x, Motion 14.1.0. Versions remain pinned by the existing lockfile. Self-hosted Manrope and JetBrains Mono; project-owned SVG icons; custom SVG charts. Eight lazy hash routes. Static Vercel hosting with explicit CSP and security headers.

`App` controls splash / zero-pairing gate / dashboard. `Shell` provides navigation and server context. `src/adapter/session.ts` owns selected-room transport and authority; passive fleet feeds have their own read-only connections. The external store publishes ordinary telemetry at about 500 ms and operational events immediately. Presentation does not create additional data sockets.

The adapter already includes source-aligned history projection (`src/adapter/history.ts`), but the original chart did not use source capture clocks. This refinement fixes presentation projection without modifying the adapter.

| Workspace / capability | Existing behavior and actual limitation | Refinement / remaining acceptance |
| --- | --- | --- |
| Splash | Minimum 2.8 seconds, plus initialization readiness. This is an intentional first-run preference, not a measured loading time. | Preserved. Measure actual ready time separately; do not report the splash timer as performance. |
| Zero-server onboarding | Device name and one-time code; relay field only when public origin is absent; claim → IndexedDB → fresh grant → authenticated socket. | Preserved. Public rendered gate observed. Real claim and `dashboard.ready` after this refinement: not executed. |
| Fleet | Selected room plus up to 16 passive observations; original list omitted paired rooms without feed state and mixed room connection with health. | Includes stored paired instance identities, search, selection, Host-only state, source freshness and explicit unobserved rows. Native table supports bounded internal scroll. |
| Overview | Six KPIs; TPS/MSPT, CPU, memory; world density; lifecycle review. | Correct axes, source timestamps, zero/missing handling, five KPI sparklines and balanced resource panels. Start/stop/restart retain the existing authority gates. |
| Performance | 5/15/35-minute retained history; correlated charts; spike strip; GC calculation. | Source-deduplicated evidence, drag zoom, freeze/resume, keyboard inspection, truthful empty states, reset-aware GC and readable units. Real performance profiling remains outstanding. |
| Players | Live roster, name/UUID search, world filter, skins, player actions, command templates and LuckPerms commands. | Message/reason/gamemode input forms; exact UUID review; unban/remove-whitelist surfaced through existing contracts; permission controls gated. No offline-player directory, full permission tree, cursor history UI or 3D viewer is claimed. |
| Console | Host journal / Paper fallback, formatted text, filtering, pause, wrap, virtualized no-wrap output, export, clear view and reviewed commands. | Automatic following, scroll hold, jump to latest, bounded unseen-ID count and Enter-to-review command input. Wrapping still limits rendering to the latest 400 matching lines. |
| Chat / Plugins | Global stream/send and plugin inventory/reload inside Console. | Existing contracts preserved. View-switch semantics corrected. Unknown/failed skin sources use local fallback. |
| Backups | Preflight, current status, create, list, verify, retry upload and delete. Previously one read at entry, generic timeline names and an optimistic empty heading. | Unknown evidence stays unknown; exact Host phase names; live phase events and periodic read queries during active jobs; separate verification facts and post-action refresh. No restore/download/schedule editor is newly implemented. |
| Access & Audit | Devices, self-revoke protection, reviewed revoke, scopes and filtered audit. | Server-selection revision now resets route-local query results. Partial query failure handling and an expanded audit detail view are follow-up work. |
| Settings | Relay, pairing, themes, density, reduced motion, timezone, skins and diagnostics. | System theme now reacts to OS changes; charts honor UTC preference; native search/dialog focus; existing secrets boundary preserved. The timezone preference is still not universal across every table and console timestamp. |
| Configuration / Files | Intentionally absent: user edits files from their own PC. | Preserve this product decision. Do not add a file editor to satisfy a generic dashboard checklist. |
| Economy, anti-cheat, AI, predictive analytics | No authoritative product contracts. | Deferred. Do not add fabricated charts or empty navigation destinations. |

### Graph instances

Six full chart instances share `TimeSeries`: Overview tick/CPU/memory and Performance tick/CPU/memory. Overview also has five lightweight sparklines. Crosshairs synchronize within the current page. Full charts provide source counts, latest/min/max, exact capture times, series toggles and a 50-row source-instant table. Performance adds a mean-MSPT heat strip and event list; these are observations, not per-tick distributions.

## 3. Deep findings and priorities

Priorities: **P0** operational correctness or misleading evidence; **P1** core usability/data interpretation; **P2** polish or expansion.

| ID | Priority | Baseline finding and operator impact | Outcome / evidence |
| --- | --- | --- | --- |
| F01 | P0 | Charts plotted every mixed reducer row at `sample.at`, carrying Paper measurements onto Host capture times. Spike counts also counted repeated means. | Implemented source-clock projection, deduplication and distinct spike observations; new regression tests. |
| F02 | P0 | Gradient area closure could connect separate path segments across missing data even when the stroke had gaps. | Every area/stroke segment is independently closed. Null/large-gap regression checks. |
| F03 | P0 | Message prepared an empty `message`; Gamemode omitted required `gameMode`. Buttons did not complete the supported task. | Input dialogs emit documented, bounded parameters before existing target review. Live execution not executed. |
| F04 | P0 | No samples could show “Within tick budget.” Missing evidence was presented as a healthy conclusion. | Unknown state displays “Awaiting tick samples”; no-spike language explicitly applies to observed samples. |
| F05 | P0 | Backup entry could say “Ready for a restore point” before a successful preflight. | Loading/unknown and unmet preflight have separate headings. Existing strict create gate unchanged. |
| F06 | P0 | Access/backup route-local query data could survive server selection and temporarily describe the previous instance. | Workspaces key on server ID + selection revision; old route state cannot populate the new workspace. |
| F07 | P1 | TPS and MSPT shared 0–100, placing normal TPS near the bottom and implying common units. | Independent 0–20 TPS axis and automatic MSPT axis; 50 ms line belongs to MSPT. |
| F08 | P1 | Memory axes showed huge byte counts; tooltip/table values were difficult to compare. | Byte/KiB/MiB/GiB formatting across chart axes/readings/tables. |
| F09 | P1 | Hover mapped the full SVG width instead of the plot region; keyboard endpoints and a single sample were weak. | Plot-margin mapping, Home/End/Escape, exact arrow inspection, independent capture annotations and single-point markers. |
| F10 | P1 | Same-scale CPU chart ignored values >100%, even though process/node accounting has distinct semantics. | Automatic axis includes supplied extrema. Same-unit series retain separate labels; service per-core accounting must remain separate. |
| F11 | P1 | GC first/last subtraction could become negative across process counter reset. | Only valid, continuous, nondecreasing counter intervals contribute; reset/gap tests. This is observed pause rate, not pause percentiles. |
| F12 | P1 | `observedPeak || '—'` converted a legitimate zero-player peak to unavailable. Chunk totals treated unknown counts as zero. | Zero stays zero; incomplete world counts yield a partial/unknown total. |
| F13 | P1 | Header called Host “available” without source age and derived Paper freshness from room connectivity alone. | Independent Paper/JVM/Host/service ages; Paper connectivity checked independently. Tooltip explains skew and timestamp offset. |
| F14 | P1 | Palette input was read-only; it looked searchable. Custom dialog/drawer lacked native modal focus handling. | Actual query filtering, keyboard selection, native modal search/drawer, Escape and return focus. |
| F15 | P1 | Theme `system` did not track OS changes; Motion transforms were not explicitly controlled by reduced-motion preference. | Live media-query listener, MotionConfig, CSS reduced-motion paths and hidden-tab CSS animation pause. |
| F16 | P1 | Console claimed to follow live IDs but did not scroll to new output. New-line count broke when retention evicted old rows. | Follow/hold/latest controls and ID-set comparison. Verify with a sustained log stream. |
| F17 | P1 | Query-only backup state ignored newer streamed phases. Timeline labels did not match Host (`ARCHIVING`, `VERIFYING_LOCAL`, `VERIFYING_REMOTE`). | Source-backed phases, live updates and read-only status reconciliation while a job exists. Terminal events absent from the frozen reducer are reconciled by query. |
| F18 | P1 | Local/offsite inventory booleans were labelled “Verified” without explicit verification evidence. | Inventory says Present/Unavailable/Not reported; the current-job view shows supplied verification booleans separately. |
| F19 | P1 | Query/action/transport errors could be visually treated alike; failed review could offer another dispatch in-place. | Result tone follows actual status, invalid targets are explained, duplicate click is blocked, failed dispatch closes without automatic retry. Check unknown outcomes against audit before preparing anew. |
| F20 | P2 | CPU/memory secondary panels inherited the uneven tick/evidence grid. Small tertiary text and absent trends reduced scanning quality. | Symmetric half-width resource panels, enhanced text contrast and lightweight source-faithful sparklines. Responsive inspection remains not executed. |
| F21 | P2 | Skin failure persisted when UUID/provider changed; invalid UUID could enter provider URLs. | Failure state is keyed to exact source URL; UUID validated before request. Bedrock/unverified/local fallback retained. Same-origin proxy not implemented. |
| F22 | P2 | Existing “initial-route JS” budget only measures the entry chunk; it excludes lazily imported Overview/shared-chart code, CSS and fonts. | Report the exact metric honestly; broader cold-load/LCP/INP profiling is still required. |
| F23 | P2 | Presence-history pagination, real permissions tree, 3D skins, backup download, maintenance editor and advanced chart annotations are incomplete. | Explicit follow-up backlog; implement only with proven inputs and unchanged authority. |

## 4. Implemented changes and boundaries

Main implementation surfaces:

- `src/lib/telemetryView.ts`: source-faithful points, gap segmentation, bucket-extrema plot reduction, summaries, spike observation, GC rate and unit formatting.
- `src/components/charts/TimeSeries.tsx`, `Sparkline.tsx`, `presets.ts`: responsive SVG, independent axes, clipped plot, gap-safe fills, keyboard/pointer inspection, readable values and zoom support.
- `src/routes/Overview.tsx`, `Performance.tsx`: corrected evidence and new inspection workflows.
- `TelemetryStatus.tsx`, `WorkspacePalette.tsx`, `Shell.tsx`: source ages, searchable workspace dialog and native modal drawer.
- `PlayerActionForm.tsx`, `Players.tsx`, `PlayerHead.tsx`: complete action inputs and reliable avatar fallback.
- `ActionReview.tsx`: target invalidation, duplicate-click protection and accurate result states.
- `Console.tsx`, `Fleet.tsx`, `Backups.tsx`: operational follow/search/job improvements.
- `App.tsx`: system-theme changes, Motion preference, hidden-tab CSS pause and server/revision isolation for route state.
- `src/styles.css`: integrated presentation refinements using the deployed design tokens.
- `tests/telemetry-view.test.ts`: seven additional behavioral regressions. Existing tests unchanged.

**Untouched:** all `src/adapter/*`, generated scopes/action contracts, credential storage, relay/Paper/Host/Core source, `package.json`, `package-lock.json`, router, deployment configuration, CSP and existing regression tests. Backend sampling cadence and ordinary 500 ms publication cadence remain unchanged. This is a presentation/orchestration refinement rather than a new wire contract.

## 5. Telemetry delay: what the dashboard can honestly say

### Pipeline and configured cadence

| Stage / source | Current source evidence | Interpretation |
| --- | --- | --- |
| Paper server health | 40 Minecraft ticks | About 2 s at 20 TPS; longer when the main tick thread slows. Do not convert this to a guaranteed wall-clock interval. |
| Paper JVM/system | 5 s | Independently scheduled resource capture. |
| Player roster reconciliation | 30 s | Presence events can arrive between full snapshots. Absence of an event is not proof of disconnect. |
| Worlds | 10 s | World counts are slower than tick-health samples. |
| Plugins | 60 s | Inventory is intentionally slower. |
| Host/service capture | Independent Host scheduler/configuration | Do not claim a measured live cadence from the Paper defaults. |
| Relay transport | Authenticated HTTP/WebSocket, independent Paper and Host | Transit/queue behavior needs real capture and browser receipt measurements. |
| Browser publication | Ordinary telemetry coalesced ~500 ms; operational messages flush immediately | Up to one additional visual publication period under normal conditions; not a network guarantee. |
| Freshness display | Shared UI clock once per second | The displayed age has coarse 1-second resolution. |
| Freshness classes | Live ≤10 s; delayed >10 s; stale >30 s | Existing adapter semantics preserved. A stale class cannot be replaced with a pulsing live badge. |

Capture-to-receipt offset combines network delay, source clock offset, queueing and capture scheduling. **It is not network RTT.** “Sample age” is a truthful product label. The diagnostics tooltip discloses the distinction.

If capture is over five seconds ahead of the browser, the existing classifier expires by receipt time. Raw capture timestamps remain unchanged. Performance includes the latest observed capture even when its clock is ahead; the source status still discloses skew.

The recent long-grant hotfix used safe deadline scheduling. Retain it: a 30-day expiry cannot be passed directly to a signed 32-bit browser timeout. Do not alter reconnect/expiry behavior while tuning animation.

### Measurement plan for the next live acceptance

1. Use a disposable or explicitly designated paired Minecraft instance. Record dashboard/Paper/Host/relay commits, instance UUID/key, OS/Java/browser and configured cadences.
2. Capture at least ten minutes of Paper-health, JVM, Host and service capture/receipt/publish/render instants with clocks checked beforehand. Store sanitized measurements only.
3. Report per-source sample cadence, receipt age, capture-to-receipt offset and publish-to-paint separately. Summarize p50/p95/p99 **of measured delay**; do not infer per-tick MSPT percentiles from mean-MSPT observations.
4. Exercise busy ticks, brief network interruption, reconnect, stopped Paper with Host alive and the long-lived grant path. Record packet gaps and actual recovery, without replaying mutations.
5. Profile five comparable cold/warm loads, a full retained-history workspace and a high-rate console. Report workload, median/tail, long tasks and main-thread/memory behavior.

No real-server latency reduction or millisecond improvement is claimed by this change. It removes misleading resampling and improves inspection/render bounds; it does not accelerate Minecraft's capture thread or relay.

## 6. Design and UX acceptance specification

Preserve the deployed graphite/violet identity, self-hosted type pair and consistent icons. This work refines an existing Minecraft operations product; a generic equal-card dashboard or a replacement backend is outside scope.

### Required operator journey

Pair / select instance → inspect source health → investigate an observed change → choose a supported action → review exact server/subject → dispatch once → inspect signed outcome / audit → return to the workspace.

### Visual hierarchy

- Persistent instance context and source ages, then a compact KPI strip.
- One dominant TPS/MSPT view, concise evidence column and balanced CPU/memory views.
- Numeric typography with units and meaningful axes. Keep exact measurements; do not animate between stale/missing readings.
- Dense roster/terminal/audit views where density helps work; restrained panel elevation and radii.
- Responsive tables have their own scroll regions. Essential server/action targets remain readable.
- Errors explain an actionable recovery; low-level contracts belong in diagnostics and this guide.

### Motion

Retain short route transitions, focused dialog entrances, initial chart fade, hover/focus feedback and live-source indicators. Use transform/opacity rather than layout-affecting animation. Reduced-motion preference must affect both Motion and CSS; hidden tabs pause decorative CSS animation. Values/gaps must never be cosmetically smoothed into invented measurements.

Next refinement candidates: FLIP roster movement, short verified-result transitions and lifecycle progress feedback. Add them only after measuring the current large-roster/console cost. “Fancy” must not delay source updates, obscure actions or introduce continuous decorative load.

### Browser gate

Inspect both themes at 360, 390, 768, 1024, 1440 and 1920 CSS pixels, plus 200% zoom. Cover all eight routes and splash/pairing; healthy, empty, partial, stale, clock-ahead, denied, stopped and reconnecting states. Include long names, legitimate zeros, a single sample and full retention.

Manually verify native modal focus/return, search keys, touch controls, sample table, pointer zoom, keyboard crosshair, console hold/follow, permission explanations and action review. Run automated axe checks, then manually inspect contrast, keyboard order and screen-reader meaning. A zero console-error count does not establish accessibility.

## 7. Remaining work, ordered by value

| Work | Scope / acceptance requirement |
| --- | --- |
| Revised-page browser acceptance | Highest priority. Run current source in a working browser environment and inspect the new layouts/interactions, not the old production build. |
| TonimSMP read-only/live acceptance | Confirm `dashboard.ready`, separate Paper/Host clocks, long-grant stability and fleet isolation from the user's paired browser or a least-privilege test pairing. Do not extract the existing credential. |
| Actual supported action acceptance | Message/gamemode/console review on a test account, safe lifecycle on a disposable instance, audit verification and no automatic resend. |
| Backup completion/recovery | Live long job, terminal-phase status reconciliation, reload/reconnect, failure, retry upload, verified metadata and safe delete in a designated test environment. |
| Partial read failures | Access/Backups currently combine related queries. Independently show successful subsets and their own errors/refresh state. |
| Player presence history | Implement declared cursor-based `players.history.list` only after inspecting actual response fields, privacy gates and retention limits. Do not invent duration analytics. |
| Timezone consistency | Apply one formatter to console, audit, fleet, backups and diagnostics. This change wires the chart preference only. |
| Maintenance settings UI | Existing validator/contract exists, but editing/schedules need a complete scoped review/conflict/recovery journey. Full backups are manual-only. |
| Chart extension | Zoom presets and accessible brush alternatives; per-source gaps/coverage detail; event overlays only where exact event timestamps exist. Per-tick distributions remain backend-required. |
| Rendering efficiency | Selector subscriptions for high-frequency workspaces, measured roster virtualization, hidden-tab clock pause, cached projections for many series; justify changes using profiles. |
| Optional skin proxy | Currently selectable but no proxy endpoint exists. Implement and verify same-origin fetch bounds/CSP/privacy or label it unavailable. 3D remains optional. |
| Backup download | Existing transfer/hash contract requires a complete user-save/checksum/error journey. Restore and direct Host writes remain retired/deferred as specified by the current contracts. |
| Broader animation pass | Add restrained roster/result/lifecycle motion after functional and performance gates pass. |

Do not call this candidate “fully production-certified” until the first five rows have executed evidence. Do not turn missing access into a fake passing state.

## 8. AI builders and effort recommendations

These are task-fit recommendations, not a benchmark ranking or a promise of availability. Use an agent that can read the complete repository, edit an isolated branch, run shell checks and inspect the browser. A chat-only generated ZIP is insufficient for integration acceptance.

| Builder | Recommended model / effort | Best role for this dashboard |
| --- | --- | --- |
| **Codex** | GPT-6 Astra where available; **High** for implementation/integration. Use **xhigh** for a difficult independent correctness review if its benefit justifies time/cost. GPT-6.1 Sol is a practical alternate; use High for complex work, Medium for bounded UI polish. | Repository audit, state/authority reasoning, source-faithful charts, regression checks and measured final review. |
| **Claude Code** | Available **Opus** model; current docs list Opus 5.5. Start this edge-case-heavy task at **High** (`/effort high`); use xhigh only where supported and useful. Medium suits small visual iteration. | Coherent component/layout design plus complete existing-repository implementation and browser iteration. |
| **Gemini CLI** | Choose **Pro** in `/model` or `--model pro`. Preserve documented model thinking defaults unless the installed model/configuration explicitly supports a higher setting. There is no universal Claude/Codex-style effort flag to copy. | Broad source review, a second design critique and implementation with explicit verification requirements. |

One builder should own the implementation branch. An independent review can use another builder on the exact committed candidate, with no concurrent edits to the same files. Keep evidence and constraints in the repository so a model change does not lose the task state.

Suggested effort by phase: High for audit and integration; Medium/High for the visual proof; High for regression and browser acceptance; xhigh only for unresolved difficult failures or a final deep review. Do not default every tiny styling edit to maximum effort.

Official sources checked 2026-10-11:

- [OpenAI reasoning guide](https://developers.openai.com/api/docs/guides/reasoning): effort values are model-dependent; higher effort is appropriate for hard agentic work. API settings and product UI availability are not identical.
- [Claude Code model configuration](https://code.claude.com/docs/en/model-config): `/model`, `/effort`, supported levels and version/account-dependent behavior.
- [Gemini CLI model selection](https://geminicli.com/docs/cli/model/): Pro for complex reasoning, Auto for mixed work.
- [Gemini CLI advanced model configuration](https://geminicli.com/docs/cli/generation-settings/): model-specific thinking settings; avoid unsupported parameter combinations.

## 9. Instructions to the next autonomous builder

### Read first

This guide; `REDESIGN_REPORT.md`; `docs/ARCHITECTURE.md`, `CAPABILITIES.md`, `VERIFICATION.md`, `MIGRATION_ROLLBACK.md`; current `src/adapter/*`; relevant current tests; current Paper/Host documentation for any operation being completed. Pin the actual heads again. Treat historical documents as evidence, not permission to alter contracts.

### Scope and immutable boundaries

1. Continue the deployed design and this refinement. Do not rebuild the transport or replace React/Vite merely to change appearance.
2. Preserve protocol 3, `/v1` routes, `ACTION_CONTRACT_ID`, server/node/instance identity, signed grant intersection, capability gates and exact agent selection.
3. Preserve IndexedDB credential contract. Tokens never enter URLs, localStorage, output, exports or screenshots. Non-secret preferences remain local.
4. Preserve relay precedence, exact allowlisting, CSP/security headers, 16 passive-room limit, 8,192 history-point/35-minute limit, roster/world/console bounds and long-grant timer fix.
5. A relay queued/accepted message is not execution completion. Mutations are dispatched once, with a pinned target. Timeout/connection change after dispatch means unknown outcome; inspect status/audit before preparing anew.
6. Never modify Core/Paper/Host/relay or change backend capture cadence in a frontend task. Put concrete backend needs in a separate document.
7. Do not add a Configuration/Files editor, automatic full-backup scheduler, fake economics/security/AI pages or inferred MSPT percentiles.
8. Keep existing tests intact and add meaningful regressions for behavioral changes. Dependencies and deployment security remain unchanged unless a separate, justified task explicitly authorizes them.
9. Routine UI/read-only refinements may proceed autonomously. Production promotion is a separate release decision after evidence is ready; do not silently replace the current production alias.

### Execute

1. Establish the exact current checkout and reproduce checks. Resolve genuine failures first.
2. Run the revised dashboard in a working browser environment. Use labelled, action-isolated development fixtures for visual state coverage; they must remain excluded from production.
3. Inspect Overview/Performance in both themes at desktop and phone widths. Fix proportions, data readability, tooltip containment and interactions before duplicating changes across routes.
4. Complete the highest-value remaining verified workflows from §7. Classify each as implemented/verified, backend-required or deferred.
5. Verify all eight routes, native dialogs and consequential actions against a designated test instance. Capture sanitized results tied to exact commits.
6. Measure cold load, real telemetry delay and sustained high-rate rendering. Optimize causes rather than concealing data or weakening truth.
7. Deliver a review branch/PR, design notes, capability matrix, evidence record and rollback instructions. State every unrun check literally as **not executed**.

### Paste-ready builder prompt

```text
Take ownership of PlexonPanel-Dashboard and execute docs/DASHBOARD_AUDIT_AND_BUILDER_GUIDE.md.
Start from the current deployed redesign plus codex/dashboard-audit-refinement; verify exact commits before changing anything.
The goal is a complete, polished Minecraft instance operations dashboard with trustworthy live data, usable existing controls,
rich source-faithful graphs and purposeful accessible motion.

Read the pinned adapter/contracts, current tests and this guide first. Preserve pairing/auth/IndexedDB, protocol 3,
immutable server identity, capability/scopes, action binding and outcomes, telemetry clocks/bounds, relay configuration,
dependencies and deployment security. Do not modify backend services or add file editing/fake metrics.

First finish rendered browser acceptance of the implemented refinements. Then complete the ordered verified backlog in §7,
using working test-server access for operational claims. Use clearly labelled development fixtures only for visual state tests.
Inspect both themes and phone/tablet/desktop layouts, complete inputs and result/recovery paths, run the checks/build,
measure actual telemetry and rendering delays, and continue through routine implementation without repeated planning stops.

Return the exact branch/commit/PR, implemented changes, evidence, explicit backend-required/deferred capabilities,
all checks marked passed/failed/not executed, remaining blockers and a concrete rollout/rollback plan.
Do not claim professional production acceptance from screenshots or a build alone, and do not promote production silently.
```

## 10. Verification record for this refinement

| Gate | Current result |
| --- | --- |
| Baseline `npm run check` | Passed: 43 tests before modifications. |
| Revised `npm run check` | Passed: 50 tests, zero failures; existing suite plus seven source/chart regressions. |
| TypeScript + `npm run build` | Passed. Existing non-fatal Motion module-directive warnings remain. |
| `npm run test:perf` | Passed: about 129 KB gzip for the entry JavaScript chunk vs 184,320-byte budget. Exact latest value is in `artifacts/performance.json`. This excludes CSS/fonts/lazy-route dependencies. |
| `npm audit --omit=dev --audit-level=high` | Passed: zero reported vulnerabilities. |
| Frozen-boundary diff | No changes to adapter, package manifests/lock, Vercel/CSP or existing tests. |
| `git diff --check` | Passed. |
| Old deployed pairing/splash | Observed in Chromium, 1363 × 936; browser had no pairing. This verifies the baseline, not new workspace appearance. |
| New route browser / axe matrix | **Not executed.** Chromium download returned invalid zero-byte archives; cloud browser cannot reach the local Vite server (`ERR_CONNECTION_REFUSED`). |
| Protected Vercel preview access | **Not executed.** Authenticated share-link lookup returned 403 for the known project/team. Protection was not weakened. |
| Real server telemetry/pairing/actions | **Not executed.** No authenticated paired browser/device available in this session. |
| Browser LCP/INP, 60 fps, physical phone, screen reader | **Not executed.** Run on a declared working environment/profile. |
| Production promotion | **Not executed.** Changes are delivered for review; existing production remains on the inspected redesign. |

The next concrete acceptance step is a working-browser checkout of this exact branch, followed by a least-privilege test-server pairing. The public production gate alone cannot expose or validate authenticated workspaces.

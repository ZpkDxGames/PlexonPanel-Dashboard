# PlexonPanel Next Generation — master work directive

Version 1.0 · planning baseline 2026-10-16 · selected design: **Strata**.

## Outcome and execution boundary

GPT-6.1 Sol in ChatGPT Work: execute this plan through a complete, review-ready frontend PR. Use model-agnostic engineering practices; the named model is the execution recipient, not a dependency of the software. The full eight-route redesign, states, tests, visual evidence and performance comparison are one deliverable. Do not stop after Overview or a token replacement.

Read the adjacent `AGENTS.md`, `SOURCE_AUDIT.md`, `SKILL.md`, design specification, parity/risk matrix, QA plan and checklist. If this directive is attached alone, request the package or locate the explicitly supplied package before implementing; this file is an index and execution contract, not a substitute for the route specifications. All filenames below are relative to the frontend repository unless clearly marked as package evidence.

No backend code, relay worker, protocol/schema/scopes, VPS files, production configuration, credentials or provider configuration changes belong to this milestone. No deployment, merge, auto-merge or live destructive action is authorized by this directive. A review-ready PR is required; **production requires separate owner authorization after review of the concrete result**. A changed frontend origin must not be used to bypass an existing origin allowlist or trigger re-pairing automatically.

## Planning baseline and live source verification

Frontend `ZpkDxGames/PlexonPanel-Dashboard` at `4357a66bc674fddce7432cbc27a4fead00ac8234`, merged PR #90, tree `17f44ce9ca5d282b5b9236dd35be451066a9cad2`. Backend `ZpkDxGames/PlexonPanel` at `209f8b41d4fe6360a8dcf2f9cdabe7b7df6cc128`, tree `4754ccb1a80c69eacde903a1883b40454cab7c32`.

The package contains `source/` Git archives produced from verified local Git objects, not edited reconstructions. ZIPs do not have repository history. For actual implementation, use a real authenticated checkout if available, verify current `origin/main` and local HEAD, and branch from the reconciled current base. Do not assume these planning commits are still latest. Do not implement on a detached archive and later replace main wholesale.

Record branch name `design/strata-next-gen` (use a unique suffix if it already exists), remote base and actual backend ref in `docs/next-gen/BASELINE.md`. Read existing AGENTS rules before installing the package's root rules. If main moved, produce a concise tree/action/preference delta; resolve compatible differences and update evidence. If current behavior contradicts the pinned safety contract, stop only the affected work and ask the owner to resolve the concrete conflict.

## Definition of done

1. All eight route tables R01–R08 in the design specification implemented, including nested/profile/tab/entry/review surfaces.
2. Every implemented row of the parity matrix retained; no new active control without existing authorized backing.
3. All critical state and authority scenarios pass; no fabricated source values or success.
4. Paired same-environment performance comparison meets QA gates; actual browser captures satisfy desktop/mobile dark/light and required width tests.
5. Reproducible production artifact retains fixture isolation and protected pairing; no production deployment performed.
6. Review-ready PR with exact SHAs, diff, report, screenshots, limitations and rollback instructions. Blocked external/runtime checks are explicitly separated from local readiness.

## Change classes

| Class | Examples | Required handling |
| --- | --- | --- |
| P — Presentation | Grid, tokens, headers, ledger layout, disclosures, tool labels, focus behavior, exact existing value formatting | Implement within owned route/component files; visual and accessibility checks |
| Q — Frontend query/presentation behavior | Split backup partial read states, preserve safe preflight details, source-labeled audit switching, display timestamp formatter | Same actions/scopes; add isolation/unknown-state tests; document per-field provenance |
| C — Protected frontend correctness/performance | Chart projection/epoch changes, dispatch error model, preference persistence result contract, adapter subscription changes | Avoid by default. If strictly necessary, isolate a small commit with rationale and meaningful contract tests; never weaken authorization or silently change protocol |
| B — Backend/operations extension | Restore, schedule backups, new history statistics, skin proxy deployment, field not supplied by backend | Record proposal under `docs/next-gen/DEFERRED_BACKEND.md`; leave feature inactive and out of this PR |

Use existing exported helpers first. For example, Backups can show successful preflight fields without modifying transport. If current query errors lose structured stage metadata, display code/message plus Unknown checks and document the limit; do not infer stages from arbitrary strings. Do not call generated-scope regeneration comments as commands: this package.json has no `scopes:generate` script.

## P0 — Reconnaissance, baseline and evidence scaffold

**Owned files:** documentation and evidence only. No product edits.

- Verify repos/HEADs, dirty state, Node 24.x and package pins. Confirm eight route IDs, four Settings section keys and eight preference fields.
- Inspect source map in `SOURCE_AUDIT.md`, actual backend handlers and current scope manifest. Do not trust stale version text in documentation over code.
- Run `npm ci`, `npm run check`, `npm run build`, `npm run test:perf`. There is no lint script. Record baseline failures before attributing any to the redesign.
- Install/use the pinned Playwright browsers. Capture all main routes at 1440×900 and 390×844 in dark/light using existing visual scripts. Restrict browser requests to localhost and disable skins for fixture QA.
- Read profiling scripts before execution. `scripts/browser-profile.mjs` hardcodes `../baseline` and names the older candidate; adapt the QA harness to explicit baseline/candidate worktree paths, not product code. Compare the actual implementation base to the candidate, not an old Operations Desk checkout.
- Create `docs/next-gen/{BASELINE,SOURCE_DELTA,PARITY_STATUS,DECISIONS,VALIDATION,PERFORMANCE,REVIEW,ROLLBACK,DEFERRED_BACKEND}.md` and an evidence manifest. Copy planning files under `docs/next-gen/planning/`; integrate root AGENTS with current rules.

**Gate:** identity/source drift resolved, baseline checks recorded, fixture isolation confirmed. If tooling is unavailable, diagnose and document it; do not label unrun tests passed. Security/contract baseline failures block dependent implementation until understood.

**Rollback:** none; leave clean source baseline and original user changes intact.

## P1 — Visual system foundation

**Owned files:** `src/styles.css`; new `src/styles/{tokens,base,layout,components,motion,preferences}.css`; `src/components/{ui,Brand,Icon,Modal,EmptyState}.tsx`; new `src/components/nextgen/{WorkspaceHeader,SourceRibbon,EvidenceValue,WorkSurface,StateBlock,ActionAvailability,EvidenceDisclosure,RecordList,CopyValue}.tsx`; small new local SVG assets if not embedded in Brand/Icon.

- Implement the design spec token/spacing/type/component inventory. Retain the two existing self-hosted fonts and current preference enum values.
- Use `src/styles.css` as the deterministic import entry: tokens → base → layout → shared components → shell → route files → preferences → motion/accessibility. Add each route file only in the stage that owns it. Maintain one definition owner per migrated selector; remove obsolete rules with that migration. No second 5, 000-line override appendix.
- Build evidence/state primitives with supplied values, not network logic. Import existing source projections; prevent UI-to-adapter circular dependencies.
- Extend existing SVG icon family and block-cut brand grammar. Keep art within asset budgets and both themes; no image CDN, WebGL or giant hero graphics.
- Establish semantic buttons/tabs/fields, copy feedback, focus and dialogs. Preserve accessible native dialog mechanics rather than replacing with an untested animation wrapper.

**Gate:** check/build, light/dark token contrast report, small/large text specimen, all three accents and density modes, OS reduced/stored motion behavior. Existing routes remain functional through compatibility wrappers. No fixture content added to production modules.

**Rollback:** revert the foundation commit if it changes preference parsing, loses control contrast or leaks unscoped data; do not compensate inside protected adapters.

## P2 — Shell, pairing and shared review frame

**Owned files:** Shell, PairingGate, PairingForm, Splash, App presentation, router labels only if needed; `src/styles/shell.css`; ActionReview layout (policy/dispatch unchanged).

- Implement full-width 64px masthead + 48px desktop route band at ≥1280; native labeled Workspace dialog below. Preserve all route hashes, command palette, target selection and keyboard shortcuts.
- Keep target ID/name visible in selector/review and data-source context accessible. Clear unrelated presentation state through existing revision/session boundaries, not remount on every telemetry packet.
- Retain 2800ms startup/storage gate and origin-bound pairing semantics. Style actual error/accepted/connecting states; no forced fixture dashboard on successful form submission.
- Restyle single ActionReview with exact target/parameters, typed safeguards and operation-specific result copy. Distinguish backup queued job acceptance from durable completion without changing execute semantics.

**Gate:** entry/pairing/relay-session/review-policy tests; control-plane browser checks; fresh/rejected pairing, nav/palette focus/Escape, long target, 320px/200% zoom, review invalidation, queued-without-result, disconnect/timeout, repeated dispatch prevention. No live pairing/credential actions.

**Rollback:** revert shell/review commit if identity/focus/entry behavior regresses. Keep original credential database and preferences untouched.

## P3 — Fleet, Overview and Performance

**Owned files:** `src/routes/{Fleet,Overview,Performance}.tsx`, Telemetry, ConsolePreview, TimeSeries; new `src/styles/routes/{fleet,overview,performance}.css`; optional presentation-only modules under `src/presentation/nextgen/`.

- Implement R01 ledger/node register; one selected target, passive observations only, legacy identity states and one empty state.
- Implement R02 compact target, connected measurement strip, 7:5 instrument/terminal first row, source-layer resources, world/player ledgers and retained tick observations. Preserve every existing fact/action.
- Implement R03 focused instrument/catalog and optional eight-track comparison; stable inspection shelf, exact-sample table, accessible touch/keyboard inspection and source-aware gaps. No data resampling, smoothing or clamped cgroup percentages.
- Memoize stable display work and avoid per-frame whole-chart geometry rebuild for pointer-only changes. Do not suppress true incoming samples. Protect source-specific epoch isolation in fleet and active plots.

**Gate:** check/build; contracts/fleet/freshness/chart-geometry/presentation tests; baseline and candidate replay; R01–R03 screenshots at all required widths; source reconnect/switch, one/null/zero/outlier data, 150% CPU, stale meter and exact sample truth. Main chart + console first-view budget is a blocking visual gate.

**Rollback:** revert one route at a time using stage commits. A performance failure does not justify increasing reduction loss or dropping comparison capability.

## P4 — Players and Console workflows

**Owned files:** Players, Console, PlayerHead, PlayerHistory and FormattedText presentation; new `src/styles/routes/{players,console}.css`.

- Implement R04 roster/profile with exact UUID, stable Back focus, tool grouping and 25-entry paged history. Keep every typed player action and the two existing command builders. Never expose unsupported fields.
- Reset skin image load/error state on provider+UUID change; preserve direct-provider disclosure, fixed dimensions, lazy fetch and disabled local fallback.
- Implement R05 one-surface terminal with authority, filters, visible follow state/Return to live, bounded rows, safe export, review composer and separate Chat/Plugins tabs.
- Align terminal JS virtualization geometry with actual font/row height and resized viewport. Preserve latest-400 wrap mode bound and 2500 retained lines. Use ResizeObserver or equivalent measured viewport, with cleanup and no observer loop.
- Keep plugin reload only through the existing action/policy, not generic Paper reload. Keep safe formatted segments and bounded input sizes.

**Gate:** player-command/history/text-format/selectors tests; reference/reconstruction/review browser checks; every player mutation family reviewed; exact-UUID late response, vanished player, skin failure/change, pause while ingesting, tail return, filtered export, malicious formatting, chat MiniMessage denial and plugin search/reload. Dark/light profile/chat/plugin captures at desktop/mobile mandatory.

**Rollback:** revert affected route/component if target isolation, formatter security or console bounds change. No adapters may be loosened to make preview actions work.

## P5 — Backups and Access

**Owned files:** Backups, Access, ActionReview result presentation; `src/styles/routes/{backups,access}.css`; presentation-only backup query state/authority ledger helpers if required.

- Implement R06 current-job/recovery-first composition, manual create, expanded safe preflight, archive records and exact existing review operations.
- Represent independent read states for preflight/status/inventory. Preserve successful evidence from one query without treating a rejected sibling as empty success. On server/agent changes clear incompatible query results; ignore old tickets.
- Expose only safe fields already returned by Host. Do not add provider calls just to decorate a dashboard. Provider connectivity and archive verification stay distinct.
- Keep job ID matching, actual phase/progress/verification flags and stale status labeling. No percentage-based completion, new countdown clock or auto-retry. Restore/recovery execution stays out of scope.
- Implement R07 audit/devices/authority tabs with accurate source labels, immutable grants, current-device protection, exact Paper revoke and conservative capability explanations. Maintain audit limit 50 and source/ticket isolation.

**Gate:** backup-readiness/contracts/review-policy tests; prepared verify/delete/retry simulations; old/new job mismatch, stale/partial reads, completed vs degraded vs recovery, Paper-down/Host-live; Access self/full audit, Host mirror, missing grant/capability, current-device revoke disabled and switched-source late reply. No live backup/revoke/lifecycle test.

**Rollback:** revert presentation/query-state commit if safety/read distinctions weaken. A missing backend field is marked Unknown or deferred, never synthesized.

## P6 — Settings and cross-route polish

**Owned files:** Settings; `src/styles/routes/settings.css`; preferences/motion styles; shared display timestamp helper; targeted fixes in earlier route presentation only.

- Implement R08 all sections/preferences and deep links. Preserve parser initialization, defaults, origin recovery, disabled skin behavior, diagnostic redaction and no-store build identity fetch.
- Use neutral “Applied in this browser” feedback when persistence cannot be confirmed. Do not introduce a storage schema migration for design purposes.
- Apply browser/UTC preference to all user-facing timestamps with exact ISO in source details; preserve data timestamps unchanged.
- Finish loading/empty/denied/stale/skew/offline/unknown states, long strings, 320px layout, 200% real browser zoom, virtual keyboard, focus order, reduced motion and every accent. Remove obsolete CSS only after parity checks.

**Gate:** preferences/preferences-startup/relay-config/relay-session tests; all four settings sections at desktop/mobile; blocked storage/provider/clipboard/build.json; complete cross-route screenshot matrix and axe/manual keyboard checks. No route may be declared finished with only desktop dark proof.

**Rollback:** revert offending preference presentation or CSS extraction; no reset of existing persisted values.

## P7 — Certification, PR and release preparation

**Owned files:** tests/scripts and `docs/next-gen/*`; final source fixes only for concrete failures.

- Run the complete existing command suite and new meaningful regressions from the QA plan. Preserve and update assertions for moved layouts, never remove actual behavior tests.
- Capture baseline/candidate frames with identical fixtures/clocks where the harness supports it; keep screenshot provenance. Check all eight route compositions and shared dialogs at 100% scale.
- Measure gzip/DOM/frame/input/retention behavior with the documented workload; report medians and variability. Separate source tests, local browser tests, simulated soak and pending physical/live runtime acceptance.
- Review the final diff for protected-area changes, fixture imports, credentials, network additions, package drift and deployment side effects. `git diff --check` must pass.
- Create a review-ready PR targeting verified main with concise problem/change/result description, screenshots, table of gates, exact base/head/backend refs, no-production statement and rollback plan. If required checks remain blocked, create a clearly labeled draft/report rather than claim review readiness.
- Record how to revert feature commits or restore the previous immutable frontend artifact on the same origin after separate authorization. No storage migration; never rollback by deleting pairings. Preserve audit/job state on the server.

**Merge gate:** all source/fixture critical cases pass; all eight routes complete; budgets met; current main delta reconciled; owner can review concrete artifacts. **Merge itself and production are separate authorized actions.** Pending physical-device/live-runtime checks remain explicit even if the PR is code-review-ready.

## Required report and evidence files

| Artifact | Contents |
| --- | --- |
| `docs/next-gen/BASELINE.md` | Actual base/head/backend SHAs, runtime/tool versions, baseline checks |
| `SOURCE_DELTA.md` | Planning→implementation-base differences; action/preference changes or none |
| `PARITY_STATUS.md` | Every matrix ID, implementation path, tests, evidence, result |
| `DECISIONS.md` | Only deviations/necessary refinements with source/measurement rationale |
| `VALIDATION.md` | Commands, exit codes, counts, browser/platform and blocked/not-executed items |
| `PERFORMANCE.md` | Baseline/candidate bytes, replay distributions, DOM/input/retention results |
| `REVIEW.md` | Before/after critique and all eight route acceptance summaries |
| `ROLLBACK.md` | Previous immutable frontend ref, feature commits, same-origin rollback; no server changes |
| `DEFERRED_BACKEND.md` | Unsupported proposals and exact missing contract; no active placeholder controls |
| Evidence folder + manifest | PNG screenshots, JSON/log outputs, capture parameters, SHA-256 hashes |

Do not report completion merely because compilation passes. The delivered UI must visibly match Strata's composition and retain the operational contract.

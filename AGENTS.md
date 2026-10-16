# PlexonPanel Next Generation — agent contract

Planning package v1.0 · 2026-10-16 · selected concept: **Strata**.

## Mission and authority

Implement a new visual generation of all eight existing dashboard routes, preserving the actual Protocol 3 product. This file is intended for the root of the later frontend checkout. Read any existing repository and ancestor instructions before integrating it; reconcile them, do not overwrite them blindly. The supplied `SKILL.md` is a portable project playbook, not an installed ChatGPT skill.

Planning is complete only as documentation. This package does not authorize production. Later execution must produce a review-ready PR on a fresh feature branch. **Do not merge, enable auto-merge, promote a deployment, alter VPS/Host/Paper/relay, change credentials or allowlists, or perform live destructive tests without separate owner authorization.** Creating the implementation branch, local changes/tests and the requested PR are within the later implementation scope. If pushing the branch would trigger production, stop before the push and deliver the concrete local diff and evidence.

## Immutable planning references

| Repository | Planning commit | Tree |
| --- | --- | --- |
| `ZpkDxGames/PlexonPanel-Dashboard` | `4357a66bc674fddce7432cbc27a4fead00ac8234` | `17f44ce9ca5d282b5b9236dd35be451066a9cad2` |
| `ZpkDxGames/PlexonPanel` | `209f8b41d4fe6360a8dcf2f9cdabe7b7df6cc128` | `4754ccb1a80c69eacde903a1883b40454cab7c32` |

Both remote `main` refs matched these commits during planning. Re-query current remote HEAD and local branch HEAD before editing. Record dirty state, branch, base SHA and backend SHA. If main advanced, compare both trees, update the source audit and parity matrix, and branch from verified current main. Routine compatible drift can be reconciled autonomously. Pause only for incompatible product/security changes, unexplained source identity or an authorization conflict. Do not reset or discard owner changes.

The frontend baseline is **Control Room, merged PR #90**, not Operations Desk. Historical candidate text in README and `docs/NEW_DASHBOARD_VERIFICATION.md` is not current branch identity. Backend documents containing 4.0.0 or staged schema activation are historical context where inconsistent with actual 5.0.0 prepared source. Source version is not deployed runtime proof.

## Read order and conflict handling

1. This file, the supplied `source/brief/INSTRUCTIONS.md`, `SOURCE_AUDIT.md`, and the actual local source instructions.
2. `PLEXONPANEL_NEXT_GEN_MASTER_WORK_DIRECTIVE.md`.
3. `PLEXONPANEL_NEXT_GEN_DESIGN_SPEC.md`, then `SKILL.md`.
4. `FEATURE_PARITY_AND_RISK_MATRIX.md` and `VISUAL_QA_AND_PERFORMANCE_PLAN.md`.
5. `DELIVERY_CHECKLIST.md`; inspect the planning boards and baseline screenshots.

Explicit current owner direction takes precedence. Actual signed source contracts take precedence over visual wishes. Within this package, this file governs safety, the design spec governs appearance/interaction, the matrix governs parity, and the QA plan governs evidence. A discovered conflict must be recorded and resolved, never concealed by making the UI report success.

## Architecture to retain

React 19.3.0 / TypeScript 7.0.2 / Vite 8.3.4 / Node 24.x; eight lazy hash routes; existing session/adapter store and project SVG charts. No Next.js migration, new backend, replacement router, state framework, chart framework or skin-rendering engine. Keep pinned dependencies unless a separately documented measured need requires a change. Keep Manrope Variable and JetBrains Mono self-hosted.

`session.reason` is the mutation gate, `session.prepare` captures the target, `ActionReview` reviews it, and `session.execute` revalidates it. `hasScope` is only a read-scope helper; it is not sufficient mutation authorization. `actionCapability` is not a substitute for the fail-closed session gate.

## Nonnegotiable invariants

- Preserve Protocol 3, action names, canonical scopes, action contract ID, signed server association, grant intersection and command policy. Owner does not bypass a disabled capability.
- Preserve origin-bound IndexedDB credentials and pairing. Do not move tokens into localStorage, URL parameters, analytics, screenshots, logs or diagnostic payloads. Preserve `plexon:preferences` keys, values, defaults and legacy parsing.
- Prepared action identity remains server ID, session/generation, agent kind, scope and cloned parameters. A changed server/session/grant invalidates review. Retain exact UUID/device/backup targets. Never silently retarget a vanished player.
- Relay queued acknowledgement is transport acceptance only. Even agent SUCCESS for manual backup creation can mean **job accepted**, with `data.state=QUEUED`; only later durable Host status certifies completion. No automatic mutation retries after timeout/disconnect/unknown outcome.
- Paper owns players, chat, plugin inventory, game telemetry and command execution. Host owns the exact Minecraft service, cgroup/node telemetry, retained console, manual backups and durable recovery. Host journal output does not make Host a command shell.
- Keep independent capture/receipt clocks and source epochs. Live ≤10 seconds, delayed >10–30, stale >30; future capture more than 5 seconds ahead of receipt is skew. Preserve actual classifier behavior; it is not an absolute clock-difference test. Never stamp Paper data with a Host capture.
- Missing ≠ zero. Stopped service ≠ Paper offline ≠ Host offline ≠ relay disconnected. Denied ≠ empty. Unknown progress ≠ 0%. Archive available ≠ verified. An earlier phase position ≠ proven completion.
- Retain 35-minute/8, 192-point raw history bound, 2, 500 console lines, 512 players, 64 worlds, ≤16 simultaneous fleet sessions. Do not increase retention to disguise performance problems.
- Service CPU is percent of one core and may exceed 100%. Node CPU, Paper process CPU, cgroup memory, JVM heap and node memory are separate scopes. Meters require usable source, finite numerator and fresh known positive denominator; over-capacity values remain visible as evidence, not silently clipped.
- Backups remain manually initiated Host cold backups with 30/15/10/5-minute warnings. Host controls countdown, save/stop proof, archive, verification, upload, cleanup and recovery. Match progress to durable job ID. Do not implement browser restore, backup scheduling, credential entry, file upload or recovery-journal clearing.
- Keep source text safely rendered through React/text segments. Never use `dangerouslySetInnerHTML`, unsanitized SVG/URLs or executable formatting. Respect skin provider privacy and disabled mode.
- Fixtures remain development-only, prominently labeled, non-operational and absent from production artifacts. Screenshots and tests must not use a real pairing or reach nonlocal operational services.
- Keep keyboard focus, semantic controls, native dialog behavior, OS/stored reduced motion, reflow and both themes. A disabled control needs a visible explanation outside its nonfocusable hit area.

## File ownership and change boundaries

| Owner / stage | Files owned | Conditions |
| --- | --- | --- |
| Foundation P1 | `src/styles.css`; new `src/styles/{tokens,base,layout,components,motion,preferences}.css`; `src/components/{ui,Icon,Brand,EmptyState,Modal}.tsx`; new `src/components/nextgen/*` | Extract then replace styles by ownership; no duplicate old/new rules for a migrated component |
| Shell P2 | `src/components/{Shell,PairingGate,PairingForm,Splash}.tsx`, `src/App.tsx`, `src/router.ts`, `src/features/ActionReview.tsx` shared frame; new `src/styles/shell.css` | Preserve entry gate and 2, 800ms minimum splash; route IDs remain unchanged |
| Monitoring P3 | `src/routes/{Fleet,Overview,Performance}.tsx`, `src/components/{Telemetry,ConsolePreview}.tsx`, `src/components/charts/TimeSeries.tsx`; route CSS | Geometry/projection helpers only with dedicated semantic/performance regression evidence |
| Community P4 | `src/routes/{Players,Console}.tsx`, `src/components/{PlayerHead,PlayerHistory,FormattedText}.tsx`; route CSS | Commands, safe formatting, UUID isolation, console bounds remain intact |
| Operations P5 | `src/routes/{Backups,Access}.tsx`, `src/features/ActionReview.tsx` result presentation only after P2; route CSS | Review and query-result presentation may improve; protected dispatch implementation remains unchanged |
| Preferences P6 | `src/routes/Settings.tsx`, preference CSS, presentation time formatting | Preserve storage/parser and origin recovery; all eight preference fields covered |
| Evidence P0–P7 | `tests/*`, `scripts/*`, `docs/next-gen/*`, package planning files | Strengthen assertions; never remove meaningful gates just to pass |
| Protected by default | `src/adapter/**`, `src/lib/**`, `src/presentation/{authority,epochs,review-policy}.ts`, `src/features/capabilities.ts`, `src/entry-state.ts`, `src/store/preferences.ts`, deployment/protocol/config/lock files | No silent edits. A required frontend correction needs a separate documented rationale, exact diff and relevant contract tests. Backend/deployment/security policy changes are out of scope |

New presentation-only projections belong in `src/presentation/nextgen/`. Reuse existing helpers without making adapter imports point into UI. No concurrent edits to shared files; this plan does not require multiple agents.

## Execution discipline

Run P0 through P7 in the directive. At each stage, record changed files, before/after proof, checks and unresolved issues. There is no existing lint script: use `npm run check` and `npm run build`; do not claim `npm run lint` passed. Inspect scripts before running them, especially those containing old relative checkout paths.

For every UI decision, state the source, target/authority, interaction, narrow layout and denied/unknown behavior. A route is not done until its table in the parity matrix is covered and its screenshot tasks pass. All eight routes are release blockers of equal priority.

## Stop, rollback and finish

Stop mutation work for unexpected production access, secrets exposure, backend requirement, broken identity isolation, data falsification or unsafe auto-retry. Continue unrelated presentation work when safe. Revert the offending stage on the feature branch; never delete credentials or change source truth to make a screenshot pass.

Finish with a review-ready PR, immutable base/head SHAs, full parity report, before/after desktop/mobile dark/light screenshots, exact test/performance logs, accessibility limitations and rollback instructions. Mark tests `PASS`, `FAIL`, `BLOCKED` or `NOT_EXECUTED`; source review is not runtime acceptance. Await separate owner authorization for merge/production.

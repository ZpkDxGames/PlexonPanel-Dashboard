# PlexonPanel Dashboard 6.0.0 — UI/UX Fast Track

**Purpose:** finish the 6.0.0 appearance and experience upgrade quickly. Take the dashboard from "new shell with some legacy screens" to "one consistent, modern, professional product," with the least process possible.

**Status of this document:** it replaces the *process* of `PLEXONPANEL_6.0.0_REVAMP.md` (milestones M4b–M9, evidence matrices, performance tiers, review stops). The *design language* (tokens, Hanken Grotesk + Commit Mono, Deepslate palette, Tick Pulse decisions 11–12) and the *safety invariants* (Section 2) still apply. If this file and the old process conflict, **this file wins**.

---

## 0. Ground rules

1. **Start from the current `release/6.0.0` branch.** Keep everything already built: tokens and CSS layers, fonts, primitives (`Button`, `Panel`, `Badge`, `Field`, `Select`, `Dialog`, `Popover`, `Menu`, `Tabs`, `Table`, `Toast`, `Skeleton`, `EmptyState`, `Disclosure`, `Icon`), the new shell (rail, header, command palette, drawer, connection authority), boot/pairing screens, Overview and Tick Pulse.
2. **Restyle in place. Do not rewrite logic.** Each remaining workspace keeps its existing hooks, reducers, state and signed-operation flow. Replace its markup and CSS with the primitives and tokens. Move or rename files only when that makes the work simpler.
3. **No new runtime dependencies. No protocol, relay, Core or Host changes. Nothing on `main`, no tags, no deploys.**
4. **Time-box.** One pass per workspace. "Good and consistent" beats "perfect." Do not gold-plate, do not re-litigate earlier decisions, do not write essays.
5. **Stop and ask only when:** an invariant in Section 2 conflicts with a design change; `npm run check` cannot be made green; or a change would need a backend/protocol change. Otherwise keep going.
6. **Be honest.** Anything you did not run is reported as "not executed," never as passed.
7. **Push is unavailable** (no credential in this environment). Never retry `git push`. Commit per batch and write one `git bundle` at the end of each batch (outside the repo), run `git bundle verify`, and report its path, SHA-256 and head SHA.

---

## 1. What to stop doing (explicit cuts)

These were useful for the foundation but are now **cancelled**:

- Per-state screenshot matrices across 5 widths × 2 themes × many fixtures.
- Two-tier performance tiers, 5-run repeats, stress profiling at 6,000–8,192 captures, trace attribution reports, bundle-size tables, per-milestone CLS campaigns.
- Long milestone reports and review stops between workspaces.
- Anti-template essays (a 10-line checklist at the end is enough).
- Building new caching/ownership architecture. **Do not add any more machinery for the Pulse** (see Section 3).
- Re-verifying already accepted foundation, shell or font work unless a change touches it.

---

## 2. Do-not-break invariants (compact)

Existing tests cover these. Keep them green; add a test only where you change a rule's presentation.

**Data truth**
- Host CPU (machine) and Paper process CPU are always separate, separately labeled. Service CPU/RAM is the systemd value, never merged with either.
- Unknown/unavailable is never shown as zero. A real zero is shown as a real zero. No interpolation across gaps; gaps are hatched.
- Shared-node totals appear once (Fleet). Reports show only browser-observed 1/5/15/30-minute windows. No invented history.
- Missing Host service state stays "unknown" (never inferred active from Paper).

**Authorization and actions**
- Effective permission = scope ∩ agent kind ∩ capability ∩ local policy ∩ action rules ∩ confirmation. The browser never invents capability.
- Confirmations stay bound to the immutable server/session target and action, and must display that target.
- No optimistic success for any signed action. Show pending → result from the signed response.
- Navigation (rail, drawer, palette, server switcher) never executes actions, and dirty-leave/target-invalidation applies to every navigation surface.

**Console / Backups / Server**
- Console: Host authoritative (replay/history), Paper fallback live-only, `console.execute` Paper-only. Pause/copy/export/search/filter/clear are local only and must say so. Buffer bounds stay.
- Backups: manual full backup only. Primary action label **Fully Backup Now**, retry label **Retry Upload**; keep these exact. No restore or file-mutation controls. Preflight blocks unsafe starts; countdown (30/15/10/5 min) chosen before confirming; reload never cancels the job; progress accepted only for the current job ID; one progress display keyed to the real phase keys (never invent simultaneous counters; show "not supplied" when absent).
- Restart scheduler cannot create a backup.

**Privacy and storage**
- No tokens, pairing codes, keys, provider credentials or sensitive content in DOM, audit, exports or logs. No analytics, no third-party assets (player heads only via the existing template). No service worker caching authenticated data.
- Preferences keep the v1 key and saved values (accent enums monochrome/cyan/violet/emerald/amber stay valid). Chat keeps its bounded local cache (max 100) and gets a visible **Clear local chat cache** control in Settings.

---

## 3. Step 0 — Stabilize (one pass, then move on)

1. **Pulse and sparklines performance — one cheap fix, no new architecture.**
   - Make the Pulse, header Pulse and Overview sparklines consume **only the visible-window slice** of the ordered history (find the window bounds by binary search), not the full retained history. Convert/normalize only that slice.
   - Recompute at the user's Display update rate cadence (not faster), and memoize unchanged instruments so Host-only updates do not re-render Paper/JVM rows.
   - If the earlier weak-lineage/bridge/anchor machinery is committed and its tests pass, **leave it, do not extend it**. If it is flaky or in the way, delete it in favor of the simple slice-per-update approach.
   - Acceptance: one 4×-throttled run at 390 px Balanced with the realistic seed. If the whole-page long task is **≤ 150 ms**, accept and write the number down. Do not chase stress cases. If it is still above 150 ms after this single fix, report the number and move on; the maintainer will decide.
2. Run `npm run check` and the browser verifier (`npm run test:browser`). Fix only what your changes broke.
3. Commit and bundle.

---

## 4. The global UX system (apply to every remaining screen)

Build or finish these shared patterns first (small, in `app/ui/`), then use them everywhere. Do not create one-off styles in workspaces.

### 4.1 Page anatomy
- **Page header:** title (left), one short status sentence under it, primary action (right, one only). Secondary actions go in a "More" menu.
- **First screen on mobile (390 px)** must show: title, the most important status, and the primary action. Anything explanatory moves into a `Disclosure` or a help popover. No paragraph longer than two lines above the fold.
- **Content width:** readable max-width for forms/prose (≈ 72 characters); data views use the full width.
- **Section rhythm:** one spacing scale only (tokens). Group related controls; separate groups with space, not with rules everywhere.

### 4.2 Hierarchy and density
- Three text levels only: page title, panel title, body. Muted text for secondary info. No tracked ALL-CAPS eyebrows, no middle-dot metadata strings, no trailing arrows on links/buttons.
- Numbers are tabular, right-aligned in tables, units in muted color, no layout shift on update.
- Panels are quiet: tone + 1 px border, radius scale by role, no stacked shadows, no gradients.

### 4.3 Status and freshness
- One `Badge` pattern everywhere: icon + word + color (never color-only). Source (Paper/Host) is normal-case text or icon + word.
- Stale data dims and shows "stale · 12 s". Unavailable shows an explicit "unavailable" glyph + word. Disconnected panels show a clear degraded state, not last-known values as current.
- Every live value can reveal source, unit, captured-at vs received-at in a small disclosure.

### 4.4 Actions and confirmation
- Pattern: idle → confirm (dialog showing the **bound target** and plain-language effect) → pending (inline, button busy) → result (toast + inline status).
- Destructive actions use the danger button and a clearly worded confirm button ("Stop server", not "OK").
- Dialogs: focus trap, Escape, restore focus (already in `Dialog`; do not re-implement).

### 4.5 "Why is this disabled?"
- Wherever an action is disabled, show the reason right there using one shared `DisabledReason` component (tooltip/popover + visible text on touch). **Reuse the existing reason strings and logic**; only unify the presentation and wording. Do not add authorization logic. If a reason cannot be determined from existing data, say "Not available right now" rather than guessing.

### 4.6 Tables and lists
- One `Table` pattern: sticky header where it helps, row hover/focus states, consistent sort/search/filter controls where they already exist.
- Below 768 px, tables with more than 3 columns become **card lists** (label–value pairs). Horizontal scrolling only inside a named, focusable container as a last resort.

### 4.7 Forms
- Visible labels, help text attached, inline errors with icon + text, unsaved-changes indicator, disabled vs read-only clearly different (fill + non-color cue) in both themes.
- Primary action at the bottom-right (desktop) or a sticky bottom bar (mobile) when the form is long.

### 4.8 States
Every panel has: loading (skeleton shaped like the content), empty (says what, offers the next action), error (says what happened and what to do, with Retry), stale, disconnected, forbidden-by-scope (names the missing scope and that re-pairing is needed for newly introduced scopes). Add a per-workspace error boundary with a recover button. **Only build states that really occur** in the app; do not invent fixtures for the rest.

### 4.9 Motion and feedback
- Instant feedback on press (≤ 100 ms), dialogs/drawers ≤ 240 ms, new console/chat/presence rows get a brief highlight. No count-up numbers, no ambient animation. Respect the motion preference and `prefers-reduced-motion`.

### 4.10 Microcopy
- Sentence case, plain verbs, active voice. One action keeps one name from button to confirmation to toast. Errors say what happened and what to do. Empty states invite the next step. Fix pluralization ("1 world").
- Keep **Fully Backup Now** and **Retry Upload** exactly.

### 4.11 Keyboard and accessibility
- Visible focus ring on everything, logical order, no keyboard traps, named icon buttons, text alternatives for charts (the table), contrast from tokens (already verified). Command palette stays navigation-only.

---

## 5. Per-workspace enhancements

Keep each workspace's existing capabilities and gating. The list below is **what to improve**, not what to rebuild.

### 5.1 Fleet
- Instance list with a list/grid toggle: name, connection-authority summary (one chip), player count, mini Pulse (reuse), last seen. Shared-node totals shown once above the list.
- States: none paired (guided empty state with the pairing link), all offline, partial.
- **Exit requirements:** zero axe `definition-list` violation (use proper table/list semantics) and no layout shift on hydration at 390 px (reserve space with skeletons).

### 5.2 Performance
- Window selector (1/5/15/30 min), the nine existing charts in a container-query grid, shared crosshair, threshold bands for TPS/MSPT, gap hatching (never a connecting line), direct labels instead of legends, keyboard-navigable points, table alternative.
- Report panel: sample count, observed coverage, sample-based p95, gaps; bounded data table; CSV/JSON export unchanged in meaning.
- Host CPU and Paper process CPU always visibly different. Mobile: charts stack, table becomes cards.

### 5.3 Players
- Roster: search, sort, avatar (existing `player-head` behavior), online duration, location/address only if authorized and supplied. Row opens a detail drawer (profile, actions, history entry).
- Actions menu grouped by risk; disabled actions use `DisabledReason`; confirmations show server + player name + short UUID. History modal restyled (same gating).
- Join/quit rows highlight briefly when they appear.

### 5.4 Console
- Full-height log pane (sunken surface, mono), sticky toolbar, command bar pinned to the bottom (also on mobile, above the safe area).
- Authority badge **HOST / PAPER fallback / UNAVAILABLE** with a one-line meaning. Startup/invocation separators.
- Auto-follow that pauses when the user scrolls up, with a "N new lines · jump to latest" button (no middot; write "N new lines. Jump to latest"). Search with highlight and next/previous. Level filter chips. Wrap and timestamp toggles. Copy and export.
- Clear shows "Clears this view only. Server logs are not deleted." Pause says it is local.
- Command bar is Paper-only; when Paper is offline it is disabled with the reason, history stays readable.
- Window the log rendering so 2,500 lines stay smooth (simple windowing in-house is fine). Level styling never color-only. The log region is not a live region announcing every line.

### 5.5 Chat
- Message list with sender heads, timestamps on hover/focus, grouped consecutive messages, clear empty/disconnected states, gated send. No new persistence.

### 5.6 Plugins
- Clean list: name, version, enabled state, author if supplied; search and filter; keep every existing action and its gating.

### 5.7 Server
- Host-authoritative systemd status and lifecycle controls, with Paper connectivity displayed separately. Lifecycle actions follow the action pattern with explicit consequences ("Players will be disconnected."), BUSY handling and bound confirmation.

### 5.8 Backups and maintenance
- **Preflight panel** always visible: each check (Host, device, service, RCON, storage, recovery) as pass/fail/unknown with the reason. **Fully Backup Now** is disabled with the reason when unsafe.
- Countdown selector is part of the confirmation.
- Active-operation view reconstructed from Host status: a phase timeline from the **real phase keys** and one progress display with exact counters when supplied ("not supplied" otherwise). Degraded/retryable banner and **Retry Upload** (states it will not shut the server down).
- Separate timestamps for last provider test vs last verified remote backup. Backup list, retention/deletion as they exist. Restart scheduler editor clearly separate, with copy that it cannot create a backup. No restore controls.

### 5.9 Configuration
- File tree + editor pane (split on desktop, stacked on mobile), clear read-only vs writable, unsaved indicator, client-side diff of pending changes (UI only), save confirmation bound to file + server. Keep hash-conflict and dirty-leave protection. Mono only for file content and paths.

### 5.10 Access
- Devices and roles with a visual effective-permission explanation (scope ∩ agent ∩ capability ∩ policy ∩ rules), built only from existing data. Immutable grants shown as immutable; revocation with bound confirmation. **Fix the stale "Advanced / Future" wording** (Files and Backups are active). No tokens or keys displayed.

### 5.11 Audit
- Filterable timeline (actor, action, target, result, time), redaction preserved, bounded pagination, accessible table alternative.

### 5.12 Settings
- Appearance (theme, accent, density, text size, motion, chart options) with live preview; Display update rate; Data and privacy (clear local cache, **Clear local chat cache**, legacy activity cleanup only if still required); About (version 6.0.0, protocol 3, relay hostname only).

---

## 6. Order of work (batches)

Work through these in order. Commit after each batch.

| Batch | Work |
|---|---|
| 0 | Section 3 stabilize |
| 1 | Global UX system (Section 4) + Fleet + Performance |
| 2 | Players + Console + Chat + Plugins |
| — | **One review stop** after Batch 2: report in ≤ 15 lines with 4 screenshots per workspace (see Section 7); then continue unless told otherwise |
| 3 | Server + Backups + Configuration |
| 4 | Access + Audit + Settings |
| 5 | Polish and release wrap-up (Section 8) |

For each workspace: replace markup/CSS with primitives → delete that workspace's legacy CSS → `npm run lint && npm run typecheck && npm test`. Do not move to the next workspace with the check failing.

---

## 7. Verification (light, but real)

- Per workspace: **four screenshots** of its main state (390 and 1280 px × light and dark) saved to `docs/ui6-final/`, one axe scan on the main state (zero serious/critical), and a quick keyboard pass of its primary flow.
- Per batch: `npm run check` green. After Batch 2 and at the end, run the browser verifier (`npm run test:browser`).
- At the end: `npm run build` and `npm run check` once more from a clean install.
- Parity: every control that existed before still exists, is reachable, and keeps its gating. Use the existing control inventory (`docs/UI_6_CONTROL_AUDIT.md`) as the checklist. Add or adjust tests only where you changed behavior or presentation of an invariant.
- Phone check: if no real device is available, say "real-device check not executed." The maintainer will test on a phone.

---

## 8. Release wrap-up (Batch 5)

1. Delete remaining legacy CSS, dead exports and version-prefixed class names; remove `lib/cpu-load.js` and its tests (approved); confirm no workspace still uses the legacy skin.
2. Microcopy sweep across the whole app: ALL-CAPS eyebrows, middle dots, trailing arrows, pluralization, consistent action names.
3. Mobile sweep at 360/390: no horizontal page scroll, first screen rules from 4.1, 44 px targets.
4. `package.json` version → `6.0.0`; UI shows "Control room 6.0.0".
5. Update `README.md` for 6.0.0 (short) and add `RELEASE_NOTES_6.0.0.md` (what changed for operators, compatibility: still Protocol 3 / `/v1`, no identity reset, no Paper/Host JAR or VPS restart required; devices paired before a scope existed still need re-pairing for that scope).
6. Update `docs/UI_6_PROGRESS.md` with one short line per batch. Leave earlier evidence docs as they are.
7. Final bundle: `git bundle create`, `git bundle verify`, report path, SHA-256, head SHA.

---

## 9. Final report (≤ 30 lines)

1. What was done (one paragraph) and the head commit.
2. Gate table: `npm run check`, `npm run build`, `npm run test:browser`, axe per workspace → passed / failed / not executed.
3. Deviations from this file, with reasons.
4. Known rough edges and anything deliberately left (e.g., Pulse performance number, real-device check not executed).
5. Bundle path, SHA-256 and head SHA.
6. What the maintainer should test manually on the real server: a phone pass through every workspace, a **Fully Backup Now** with a browser reload during it, console with Paper stopped, and one player action with a confirmation.

---

## Appendix — 10-line UX quality checklist (check each screen before moving on)

1. Does the first screen on a phone show the title, the key status and the primary action?
2. Is there exactly one primary action, and is its name consistent end to end?
3. Is every status shown with icon + word, never color alone?
4. Can I tell what is live, stale or unavailable without reading a paragraph?
5. Does every disabled control say why?
6. Does every dangerous action show its bound target before confirming?
7. Are there loading, empty and error states that tell me what to do next?
8. Are numbers tabular and stable when they change?
9. Is anything on the screen decorative only? Remove it.
10. Could this screen belong to any generic admin template? If yes, find what makes it specific to a Minecraft server control room (the Pulse, real source labels, plain operational wording) and make that clearer.

# 6.0.0 maintainer decisions

Approved by the maintainer on 2026-10-08. This document overrides `PLEXONPANEL_6.0.0_REVAMP.md` wherever they conflict. M0–M3 are accepted. The latest authorization permits the pre-M4 fixes and **M4a only**. Stop after M4a for maintainer review; M4b requires another approval.

1. **Service-state conflict: APPROVED option 1.** Missing Host service state always stays unknown; all lifecycle callers use Host state only; revise the contradictory dashboard-2-1 assertion and add a mounted palette gating regression. Implement this in **M3, not now**. Continue M0/M1 with current code unchanged.
2. **Overview** keeps its existing six tiles (TPS, MSPT, online players, JVM heap, service CPU, service RAM) in a designed hierarchy. **Performance keeps all nine charts.** Host CPU and Paper process CPU stay separately labeled in Performance.
3. **Backups:** one progress display keyed to the 15 real phase keys (QUEUED through COMPLETED) plus DEGRADED, FAILED and RECOVERY_REQUIRED. Never invent simultaneous compression/upload counters; show **“not supplied”** when absent.
4. **Command palette navigates only.** Restart is reachable through Server with its bound confirmation.
5. **Preferences:** keep the stored accent enums (`monochrome/cyan/violet/emerald/amber`) and the existing storage key. Any new accent names or OS-following default apply only when no saved preference exists. Parsing is additive and migration-tested.
6. **Chat:** keep the existing bounded local cache (max 100) and add a visible **“Clear local chat cache”** control in Settings > data & privacy.
7. **Access copy** must reflect that Files and Backups are active. Remove the **“Advanced / Future”** wording.
8. **`lib/cpu-load.js` and its tests:** approved for removal in **M8**.
9. **Configuration save confirmation** goes through the existing bound action path only; keep the existing diff, hash-conflict preservation and dirty-leave protection.
10. **Push:** the maintainer authorizes pushing branch **`release/6.0.0`** (docs and later work) to **origin**. Never push to main; never create tags without telling the maintainer.

11. **Typeface:** Hanken Grotesk (UI) + Commit Mono 400 (console, UUIDs, hostnames, paths, commands only). Vendor with OFL licenses. Generate range-qualified faces so Latin loads normally and Latin-extended loads only on demand; preload only the Hanken Latin face. Verify production-emitted CSS and a cold-cache network trace from next build + start. Do not claim universal script coverage.
12. **Tick Pulse rendering:** raw one-mark-per-capture only when captures are at least approximately 2 CSS px apart. Otherwise draw a pixel-bounded aggregated summary (approximately 3 px marks), showing capture count, worst TPS category and MSPT min/max, explicitly labelled summarized with its time span. True gaps and unknown time stay hatched; never smooth or interpolate. Exact-capture lens and paged table keep every retained capture. Redraw only on a new capture; bound raster work by plot pixels. Keep a visible raw/summarized mode label. M4 tests cover bucket boundaries, real zero, null MSPT/TPS, gaps, out-of-order and future timestamps.
13. **Fleet accessibility:** the baseline 5.0 definition-list axe failure must be zero in rebuilt Fleet as an M4 exit criterion. Preserve the 5.0 evidence.

14. **M3 is split.** M3a is behavior-preserving extraction of signed-operation, selection, bound-confirmation, target-invalidation and dirty-leave logic out of `app/dashboard.tsx`, with **no markup/CSS change**. First characterize the existing behavior and run those tests green before extracting. Keep the signed two-room mounted flow as anchor; `scripts/verify-ui-browser.mjs` must pass unchanged. Apply decision 1 in a separate commit after extraction. Exit gates are `npm run check`, mounted flow, browser verifier, and diff review showing no visual change. If every gate is green, continue to M3b without waiting; otherwise stop and report.
15. **M2 follow-ups come first.** Give read-only/disabled fields and selects non-color cues in both themes and repeat foundation axe/contrast. Verify `hankenLatin Fallback` follows `Plexon Hanken` in the design-system font stacks, correcting any omission; measure kitchen-sink and production-shell CLS before/after. Reconcile M2's 116 contrast pairs with M1's 134. Record a one-line decision about the toast stripe; a retained stripe must never be the sole status cue.
16. **Optional push clause remains unselected.** The message includes the literal conditional text, “Include only if you want it: You are authorized to push branch release/6.0.0 (only) to origin. No tags, no main.” This work proceeds with local commits and no push; no push is needed for the requested gates. The preceding explicit no-push rule remains the operational constraint.

17. **M4 is split.** M4a = Overview, Tick Pulse UI per decision 12, and compact header Pulse in the reserved slot. Stop after M4a for maintainer review. M4b = Fleet and Performance, only after the maintainer's approval.
18. **Pre-M4 fixes come first.** Below 1024, replace the four-source authority line with one status chip (state word and healthy-source count) opening the existing Connection authority disclosure. The first 390 px viewport must show the page title and Pulse. Keep all four sources reachable; Paper connectivity never establishes Host service state. Remove tracked ALL-CAPS eyebrows/tags in shell and Overview; use normal-case source words or icon + word. Fix singular/plural world copy. Verify desktop rail is viewport-height sticky on tall pages and scrolls itself on short viewports.
19. **Optional push clause remains unselected.** The message includes the literal conditional text, “Include only if you want it: You are authorized to push branch release/6.0.0 (only) to origin. No tags, no main.” Continue with local commits; no push is necessary for M4a. No main writes or tags.

### Latest M4a authorization

Replace the equal Overview cards with Tick Pulse first and six instruments (TPS, MSPT, online players, JVM heap, service CPU, service RAM) sized by importance, with sparklines from the existing metric-report adapter. Preserve identity, Host service state, Paper uptime/version, recent presence and View history, world activity, sources/safe diagnostics, refresh and unknown/stale/disconnected gates. Show attention only for actionable supplied conditions, linking to their workspace.

Pulse uses raw marks at ≥2 CSS px separation, otherwise a visibly labelled pixel-bounded summary with span/count. True gaps/unknown time are hatched; no interpolation. Keyboard/pointer exact-capture lens and 100-row paged table retain identical actual values. Redraw only on a new capture; bound raster work by plot pixels. TPS is never color-only. All numbers use tabular figures/reserved geometry without tweening; capture and receipt remain distinct. No per-sample receipt time is invented.

Retire replaced Overview code/CSS, keep one renderer, and extend the excluded dev kitchen sink with Pulse/sparkline states. Evidence: light/dark ×360/390/768/1280/1920 for healthy, lagging, outage gap, stale, Host offline/Paper fallback, Paper offline, backup degraded attention, empty/no-data, dense 30-minute summarized and lens-open states; axe for all; keyboard inspection, reduced motion, 4× CPU draw costs, hydration-inclusive CLS <0.05 at390/1280, data-truth/bucket-boundary tests, full check and honest section-6.2 review. No runtime dependency or protocol/relay/Core/Host change. Report each gate passed/failed/not executed and stop before M4b.

### Earlier M3 authorization (accepted)

M3b replaces the shell: global Fleet; Monitor/Operate/Manage rail; server header/switcher and Connection authority disclosure; navigation-only Ctrl/Cmd+K palette and shortcuts dialog; drawer below 1024 with focus trap, inert background and restore; boot and pairing presentation with the existing flow; session-only activity tray capped at 50 metadata entries without content; reserved compact Pulse slot (Pulse UI is M4). Workspaces load lazily after shell paint; existing views remain in one scoped legacy wrapper until rebuilt. All navigation surfaces retain dirty-leave and target invalidation. No feature flags or parallel old shell.

Evidence: light/dark shell at 360/390/768/1024/1280/1920; axe on shell, open drawer/palette/authority/shortcuts, boot and pairing; keyboard walkthrough; bundle sizes and paint/chunk order; mounted navigation-never-executes-action tests. Stop after M3b for maintainer review, with screenshots and honest section-6.2 self-review. No new runtime dependencies, protocol/relay/Core/Host changes, tags, main writes or production deployment. Unexecuted gates stay **not executed**.

### Earlier M2 authorization and push rule (completed)

M2 is approved: tokens/CSS layers, fonts per decision 11, saved-preference-compatible theme switching, all specified primitives and icon set, dev-only kitchen sink excluded from the production manifest and emitted chunks with an automated test, then a pure raw/aggregated Tick Pulse model with unit tests only. No Pulse UI or M3 shell work. No new runtime dependencies or protocol/relay/Core/Host changes. Run npm run check and commit locally at milestone end.

**The latest maintainer instruction overrides decision 10: pushing is unauthorized until the maintainer says otherwise.** Do not push this M2 work. Main, force pushes, tags and production deployments remain outside authorization.

Stop and report after M2: kitchen-sink light/dark screenshots at 390/1280, axe results, contrast for new composite colors, cold-cache production font trace and automated build-exclusion result. Report unexecuted gates as not executed.

## Earlier M0/M1 task order (completed history)

### A. Screenshot environment

Fix the screenshot environment. Use Playwright's headless-shell Chromium with software rendering (`--disable-gpu`, `--use-angle=swiftshader`, `--enable-unsafe-swiftshader`), install missing system dependencies if possible, and verify with **one page load before the full matrix**. If it truly cannot run in this environment, stop and tell the maintainer exactly what to run on their machine.

### B. Finish M0

Capture the full matrix: all workspaces plus pairing/legacy route, light/dark, 390/768/1280/1920. Do not overwrite accepted 5.0 evidence. Run axe on each page and complete the state matrices, per-control authorization audit and test-gap list from the brief. Update `UI_6_BASELINE.md`; replace “interrupted checkpoint” only when the gates truly pass.

### C. M1

Produce `UI_6_DESIGN.md` with tokens, the typeface decision, wireframes, Tick Pulse specification and anti-template self-review.

Then stop and report baseline findings, design direction with the riskiest choices, and any conflicts. Do not start M2 without approval. Report unexecuted gates as **not executed**.

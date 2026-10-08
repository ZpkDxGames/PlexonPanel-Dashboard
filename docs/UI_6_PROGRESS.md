# 6.0.0 progress

## Session boundary

2026-10-08 UTC. M0 and M1 only. Stop for maintainer approval before M2. Production UI, main, relay, protocol, Core and Host stay untouched.

## M0 in progress

- Read the entire attached specification, AGENTS.md and CLAUDE.md (CLAUDE delegates to AGENTS).
- Verified remote accepted 5.0.0 SHA and absence of v5.0.0 tag; recorded rollback anchor in UI_6_ROLLOUT.md. Created isolated release/6.0.0 worktree.
- Executed npm ci then npm run check on clean untouched source: PASS; 79 relay and 183 dashboard tests, zero failures. Node v24.19.0, npm 11.9.0.
- Read installed Next 16.3.8 font, CSS, lazy-loading and server/client guidance before planning any Next changes. No Next code written.
- Native screenshot attempt failed because Playwright Chromium was absent; install attempted but returned truncated/invalid archives. Local fallback acquisition in progress. No screenshot gate is yet passed.

## Mandatory stop / discovery checkpoint

- Found a test conflict with §3 service-state truth: dashboard-2-1 requires missing service state to become active from Paper connection. Shell restart availability still uses that fallback. §0.9 requires stopping before guessing/changing the test.
- Added UI_6_BASELINE.md as an explicitly incomplete discovery report, plus raw source control/read-expression catalogue and test-title catalogue. Inventories are preliminary, not accepted M0 parity coverage.
- Screenshot attempts failed: missing Playwright browser; invalid download archives; local npm-isolated Chromium 153 fallback reached EGL initialization errors. Zero screenshots, zero axe scans. The fixture used ephemeral signed identities and no real credentials.
- Restored Next-dev-generated next-env.d.ts to the exact source anchor. Production UI/logic/tests/dependencies unchanged.
- M0 remains incomplete. M1/M2 not started; no font/contrast experiments or design decision claimed. Await maintainer decision on proposed frontend-only service-state correction, with implementation deferred until the approved later milestone.

- Remote push was attempted but rejected by automatic approval review: working/committing on the branch was not treated as authorization to export repository contents to the remote. No workaround attempted. Read-only git ls-remote confirmed no remote release/6.0.0 branch. Checkpoint is local and awaits explicit push authorization if desired.

## Resume: maintainer decisions

- Maintainer approved Host-only service-state correction for M3, leaving all current production code/tests unchanged during M0/M1. UI_6_DECISIONS.md is the authoritative override for all ten decisions and the A/B/C task order.
- Explicit authorization now covers pushing release/6.0.0 to origin. The earlier rejection is superseded by this new authorization; main and tags remain untouched.
- Resume begins with a native headless-shell one-page smoke test; the full matrix will not run until it succeeds.

## M0 completed

- Native one-page smoke passed before full matrix using Chromium headless shell153.0.8010.0 driven by Playwright, software-rendering flags. Bundled Chromium156 download failed invalid ZIP; apt system-deps attempt blocked privileges. These environment limits remain recorded, not passed.
- Captured120 PNGs and executed120 per-page axe scans under artifacts/ui6-baseline; accepted5.0 evidence untouched. All15 pages×light/dark×390/768/1280/1920,0 pageerrors/overflow.
- Axe recorded serious definition-list on Fleet in all 8 variants; other112 scans0 configured violations. Accessibility cleanup gate is not passed. Mobile Access visual wrapping defect documented despite axe0.
- Completed source/module/data inventories,228-control authorization/confirmation audit, eight-state matrix for all 15 pages and prioritized test gaps. Scenario matrix is source review, not a claim all states were browser-executed.
- Repeated npm run check at milestone end: exit0;79 relay+183 dashboard tests,0 failures/skips. Production-mode Next test build executed by npm test also passed.
- Restored generated next-env.d.ts exactly; production source, tests, manifests, generated contracts unchanged. M0 complete; M1 begins after this milestone commit.
- Authorized remote release branch created through connected GitHub integration because git CLI lacks credentials; documentation commits will be mirrored with equal trees, no force/main/tag changes.

## M1 design work

- Produced UI_6_DESIGN.md with measured palette/type/spacing/radius/elevation/motion, all 15 workspace/route desktop+mobile vector wireframes, Tick Pulse truth/inspection/rendering contract, per-workspace anti-template revision pass and specific risks. Rendered vector sketches replace ASCII geometry for legible labels;30 layouts are documented, not built UI.
- Executed134 required opaque contrast pairs: all passed, min text 5.1362 and essential boundary 3.8763. Decorative border failures are explicitly restricted.
- Screened five UI font files for glyph coverage; rendered exactly three UI candidates (Hanken,Schibsted,Noto) and two mono (JetBrains,Commit) at 12/13 px×400/500/600 in light/dark.30 loaded/tabular cases pass; no pageerrors. Noto chosen for full 128A/208B, Commit Mono for code/identifiers with Noto fallback. Public/Source Sans received binary screening only; no visual comparison claimed.
- Noto chosen assets203,780 bytes; performance/CLS/preload risk documented, no speed gate claimed. All fonts/tests are throwaway artifacts or docs; no production font/code/manifests changed.
- M0 documentation mirrored to origin through authorized connected GitHub, with identical local/remote trees and fast-forward refs. Main/tags untouched. M1 publication follows final checks.
- Full6.0 states/accessibility cleanup, signed-flow implementation regressions, migration tests, performance profiling, preview/live acceptance and M2 remain not executed.

## M1 completed — stop before M2

- All15 rendered SVGs decoded and text bounds checked in native Chromium; mobile and desktop each included.30 rendered font cases passed; all documentation links resolve.
- npm run check at milestone end returned exit0 and reported79 relay tests. Its spec output omitted complete dashboard totals; independent TAP rerun passed183 dashboard tests,0 failures/skips. Validation ledger preserves this distinction.
- Refined manual audit: Forget has dirty-leave guard but no general confirmation; operation Retry Upload and listed-row readiness differ; MiniMessage checkbox uses ready scope/capability and needs explicit effective-grant DOM coverage; non-button chart/select/keyboard paths included. No production behavior changed.
- Design risks: exact high-cadence Pulse/mobile inspection, full-coverage font payload, disclosure discoverability, signed shell/file-confirmation extraction and virtualized text selection. Backend-unavailable history/policy/last-seen/receipt details omitted, never invented.
- M0/M1 evidence packages preserve120 baseline captures, logs and portable experiments. Documentation-only milestone committed and authorized release branch published with identical local/remote trees; no force push, main/tag edit, deployment or M2 work.
- Await maintainer approval before M2. All final/live acceptance and unbuilt6.0 accessibility/performance gates remain not executed.

- Final M1 clarification: new system-theme/cyan defaults apply only to an absent preference key; existing malformed/partial blobs retain legacy fallbacks. Chat cache clear is selected-server scoped and must prevent old observations reappearing through the next telemetry persistence update; added the explicit test gap. This is a documentation refinement only, not M2/M7 implementation.

## Conditional M1 acceptance — pre-M2 review completed

- Reconciled the M0 baseline against all 120 original PNG hashes and 120 axe entries, with per-workspace/theme/width results. Capture and source-inventory gates passed; zero-serious axe still failed on Fleet in all eight variants. The state inventory and 228-control audit are source reviews; full browser-state/mounted authorization permutations remain not executed.
- Fixed both malformed dark hex values and Markdown spacing. Read canonical tokens.json for fresh contrast calculation: all 19 documented palette/accent rows match, 134 required pairs pass; text minimum 5.1362 and boundary 3.8763.
- Reopened the UI font decision under Portuguese/English requirements. Eight real mounted Overview header + fixture Pulse captures at 390/1280 in light/dark show Hanken and Noto without Portuguese fallback. Recommend Hanken for compactness; final selection pending. No fonts vendored.
- Cold HTTP traces confirm Latin-only demand for tested Portuguese/English, extended demand on Ł and system fallback on Ж. Explicit extended preload defeats demand. Future Next per-subset integration remains not executed; current installed local-font defaults/source were inspected.
- Built documentation-only loopback Pulse prototype and captured 390/1920 light/dark normal/dense cases. 870 normal captures and exact 8192 stress captures keep one mark each with 12 SVG nodes. Individual 30-minute marks fail mobile readability; dense desktop also fails. Traces show substantial raster work and one 131.57 ms renderer task in mobile dark 4× stress. Product performance gates remain not executed.
- Demonstrated exact-capture lens/table, with 140 ms spike recoverable. Pixel-bounded full-window summary is proposed for approval, not implemented or silently substituted for the raw mark contract.
- npm run check passed: exit 0, 79 relay + 183 dashboard, zero failures/skips. Its actual production-mode Next test build contains no documentation-prototype routes/markers. Current kitchen-sink page is not built and its future exclusion gate is not executed.
- All production source, accepted 5.0 evidence, dependencies and main remain unchanged. UI_6_PRE_M2_REVIEW.md, gallery, reproducible experiments and raw results are the review handoff. Stop before M2; next scope is tokens/layers, chosen fonts, theme switching, primitives/icons and verified dev-only kitchen sink only after the maintainer replies.

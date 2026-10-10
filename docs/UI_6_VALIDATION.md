# 6.0 validation ledger — M0/M1

Source `86b6a0cefb2c5e420c9c862a7897705e1ea59146`; branch release/6.0.0. This ledger certifies only the commands/methods executed below. It does not certify unbuilt6.0 UI or a live Minecraft/Host deployment. Original accepted5.0 screenshots were preserved.

| Gate | Command / method | Result | Evidence / limitation |
|---|---|---|---|
| Untouched install | npm ci | passed |415 packages; source unchanged before command |
| Untouched checks | npm run check | passed | scopes/fleet checks, lint/typecheck,79 relay+183 dashboard tests;0 failed/skipped |
| M0 end checks | npm run check | passed | Exit0 and same79+183 totals; includes actual Next production-mode test build |
| Bundled Playwright install | npx playwright install --with-deps --only-shell chromium; download-only retry | failed | System-deps apt privilege failure; bundled archives invalid/truncated. Not claimed installed |
| Software headless-shell smoke | smoke-browser.mjs; loopback one page | passed | Chromium153 actual load+PNG before full matrix; all requested software flags used |
| Full M0 capture | artifacts/ui6-baseline/capture.mjs | passed |120 screenshots+120 scans;15 pages×2themes×4 widths;0 pageerror/overflow; native153 differs from expected bundled156 |
| Baseline zero-serious/critical axe gate | per-page WCAG2A/AA/2.1AA axe | failed | Fleet definition-list serious in all 8 variants; other112 scans0 configured findings. Discovery is complete; accessibility remediation deferred |
| Source review | AST index + manual module/control/data/state/test audit | passed discovery audit |228 declarations/2328 reads; source matrix is not execution of every scenario |
| Font binary coverage | FontTools cmap/GSUB/fvar + actual chosen WOFF2 SHA | passed chosen UI requirement | Noto Sans LatinA128/128+B208/208;400/500/600 supported; Portuguese corpus present. Mono broader glyph fallback explicit |
| Rendered font comparison | Native Chromium; fonts.ready, glyph faces via CDP, digit DOM widths | passed |30 rows:3UI+2mono×12/13 px×400/500/600; all loaded/tabular,0 pageerrors; light/dark PNG. Visual preference is design review, not user study |
| Color contrast | WCAG relative sRGB luminance, unrounded comparisons | passed token experiment |134 required pairs; min text 5.1362/boundary 3.8763.8 decorative pairs intentionally unsuitable for essential boundaries; no rendered-product certificate |
| Wireframes |15SVG desktop/mobile + browser image decode/text bounds | passed documentation QA |30 sketches, well-formed; rendered vector rather than original ASCII-format request; no production behavior implied |
| M1 end checks | npm run check | passed | Exit0; relay79 reported; spec output omitted full dashboard tally, so independently rerun below |
| M1 full dashboard tally | node --test --test-concurrency=1 --test-reporter=tap tests/*.test.mjs | passed |183 tests,0 failed/cancelled/skipped; complete TAP summary |
| Existing unchanged browser regression script | npm run test:browser | not executed | M0 used separate capture harness; do not infer assertions/soak from shared fixture support |
| Standalone/relay release smoke/package | npm run relay:smoke; relay:standalone:smoke; relay:standalone:package | not executed | Final release/M8–M9 gates, not M0/M1 certification |
| Separate final release build/bundle comparison | npm run build + before/after sizes | not executed | npm test did execute a production-mode Next test build; no6.0 renderer/bundle exists |
| Mobile performance budgets | cold mid-tier shell/Overview/Console traces, LCP/CLS/INP/steady-state tasks | not executed | No performance-improvement claim; exact Pulse and203,780-byte UI font payload need measurement |
| Full6.0 browser state/motion/zoom/forced-colors matrix | planned360/390/768/1024/1440/1920 × themes/motion/states | not executed | M8 acceptance; M0 normal/empty fixtures and source matrix are narrower |
| Keyboard/screen-reader/IME/3-second comprehension | real primary task walkthrough/user review | not executed | Proposed plan, no built6.0 UI |
| Vercel preview / CI result | deployment/CI inspection | not executed | No deploy command issued; authorized docs pushed only; remote push does not prove CI |
| Live Host journald/systemd/RCON/rclone/full-backup/reconnect/retry | maintainer live acceptance | not executed | No VPS/production command or real credentials; fixture agents simulated |
| M2 implementation | tokens/fonts/primitives in production app | not executed | Approval required after M1 report |

## Evidence package and command provenance

`PlexonPanel-6.0-M0-evidence.zip` contains all 120 captures, raw results, review sheets, smoke, baseline logs and reproducible separate harness. Repository tracks UI_6_SCREENSHOT_MANIFEST.json with individual hashes rather than overwriting5.0 artifacts. `PlexonPanel-6.0-M1-design-evidence.zip` will contain design/contrast/font/wireframe records and portable throwaway font assets/licenses/scripts; production files unchanged.

The container uses isolated npm/pip tooling outside repository manifests; no runtime dependency added. Actual native headless shell render limitations/flags are documented in UI_6_BASELINE.md. M0 final command was rerun with explicit subprocess exit capture after an earlier log ended before complete dashboard totals; only the full 79+183 result is accepted. M1 check returned0 but its spec-report log omitted the dashboard summary. Independent TAP execution confirmed all183 dashboard tests with0 failures/skips; this distinction is retained rather than inventing a missing summary.

## Conditional M1 review checkpoint

| Gate | Command / method | Result | Evidence / limitation |
|---|---|---|---|
| M0 record reconciliation | Original manifest/raw scans + SHA256 | passed | All 120 PNG hashes and 120 scan combinations; Fleet cleanliness still failed, full state execution not executed |
| Corrected token equivalence / contrast | review-experiments/contrast.py reads tokens.json | passed | 19 Markdown rows match; 134 required pairs, minima text 5.1362/boundary 3.8763 |
| Mounted Overview + Pulse type comparison | 390/1280 × light/dark × Hanken/Noto | passed execution | 8 screenshots; custom faces verified for header/Portuguese, zero page errors/overflow; fonts remain unvendored |
| Subset demand/preload controls | Cold HTTP traces; exact rendered-font inspection | passed | Both Latin-only for tested English/Portuguese; Ł triggers extended; Ж uses system fallback; preload bypasses demand. Next integration not executed |
| 30-minute Pulse spike | 390/1920 × light/dark × 870/8192 × CPU1/4; 30 forced redraws | executed; dense readability failed | 12 SVG nodes; exact mark count; raw paths expensive to rasterize; one 131.57 ms renderer task in dense mobile stress. Product performance not certified |
| Prototype build exclusion | Actual production-mode test build manifest/emitted JS | passed for current documentation prototype | No route/markers; future dev-only kitchen-sink page not built, its exclusion gate not executed |
| End review check | npm run check | passed | Exit 0; 79 relay + 183 dashboard tests, 0 failures/skips; production-mode Next test build |
| M2 fonts/theme/primitives/icons/kitchen sink | No implementation | not executed | Wait for maintainer's font/rendering reply |

Detailed results and limitations: [UI_6_PRE_M2_REVIEW.md](UI_6_PRE_M2_REVIEW.md).

## M2 executed validation (2026-10-08 UTC)

[UI_6_M2_REPORT.md](UI_6_M2_REPORT.md) contains all foundation evidence and the remaining later-milestone gates. `npm run check` exited 0: 79/79 relay and 201/201 dashboard tests, zero failures/skips ([complete transcript](ui6-m2/check.txt), [status](ui6-m2/command-status.json)). Kitchen sink light/dark at 390/1280 px: four main captures, 20 axe scans with zero violations; raw incomplete entries retained and independently reviewed with live-DOM references and opaque rendered popover colors. Keyboard/dialog/selection/OS-and-saved-theme flows, forced colors and text at 200% pass. Required palette: 116 pairs pass (text≥5.1362:1, boundaries≥3.8763:1); overlay/shadow composites measured. Actual production cold-cache font/range/preload trace passes. [Build exclusion proof](ui6-m2/build-exclusion.json): production manifest omits kitchen sink, 88 emitted files have zero marker/gallery-CSS matches, URL 404; automated test included in check. Pure Pulse: 12 unit tests pass, including 8192 exact captures and pixel-bounded summaries at 390/1920 px. Rendered Pulse/draw cost, M3 lifecycle correction, M4 Fleet definition-list zero, other engines/AT/real devices and production deployment remain **not executed**. No push or M3 work.

## M4a executed validation (2026-10-08 UTC)

Historical M0–M2 entries above describe those checkpoints, not current implementation status. M3 was accepted. [M4a report](UI_6_M4A_REPORT.md) and [all screenshots](ui6-m4a/README.md) describe the new Overview and full/compact Pulse. **M4a is not fully green: the dense whole-page long-task budget failed.** M4b remains unstarted.

| Gate | Result | Executed evidence / limit |
|---|---|---|
| Final complete check | passed | [Exit 0](ui6-m4a/check-status.json): 79 relay + 221 dashboard tests, zero failures/skips; lint, TypeScript, scopes/fleet checks and actual production build |
| Signed mounted anchor | passed | [19 subcases plus parent](ui6-m4a/mounted-flow-status.json); navigation never mutates; target/confirmation/dirty-leave assertions preserved |
| Pulse and Overview invariants | passed | 22 focused tests included in check: buckets, zero/null, gaps, order/future time, source separation, exact parity and no idle/Host-only redraw |
| Pre-M4 mobile/rail/case/plural fixes | passed | Two screenshots/scans; four-source disclosure, 390 first viewport, viewport rail stickiness/short-height scrolling |
| Requested Overview matrix | passed | [100 production captures and default axe scans](ui6-m4a/overview/overview-verification.json): 10 states × light/dark × 360/390/768/1280/1920; five successful 20-case commands on frozen runtime source |
| Axe incompletes | independently reviewed | Zero violations; raw 810 native-reference and 64 glyph-contrast incomplete nodes retained. 900 live controlled references checked; 64 rendered contrasts ≥ 10.485750:1. Not an AT certificate |
| Pulse keyboard/pointer | passed | Home/End/arrows, Enter, Next/Previous, Escape focus restore; exact tooltip/lens/table parity; no inspection raster work; optional old charts keyboard mount/unmount |
| Motion and idle updates | passed | Reduced-motion + saved off: no canvas animation. Idle raster counter unchanged for 2.4 s; mounted tests cover age/Host-only repeats and pruning |
| Hydration CLS | passed | Cold production with 1,200 ms font delay and synthetic server selection: light/dark 390 = 0.043824/0.044046; 1280 = 0.022451/0.021675; all < 0.05 |
| 4× CPU draw cost | executed | 6,000 retained synthetic captures; 12 traced then 12 untraced updates at 390/1920. Canvas command timings and whole-page Paint/RasterTask/CPU profiles kept separately |
| Whole-page dense long-task budget | **failed** | [Untraced maxima](ui6-m4a/measurement-summary.json): 394 ms at 390, 284 ms at 1920; 100 ms budget. Balanced display cadence; Realtime hardware certification not executed |
| Updated kitchen sink | passed | [20 axe scans](ui6-m4a/foundation/kitchen-verification.json), zero violations/page errors, 480 controlled references, keyboard/theme/non-color modes/forced-colors/200% text checks; four rendered popover contrasts |
| Palette/composites | passed | [116 required pairs](ui6-m4a/foundation/contrast.json), text ≥ 5.136208:1, boundary ≥ 3.876348:1; eight quiet separators remain decorative. No M4a composite colors |
| Cold-cache production fonts | passed | [Actual build/start trace](ui6-m4a/production-fonts/production-font-trace.json): only Hanken Latin preload; no Hanken extended for English/Portuguese; Ł demands extended; Ж uses system fallback; Mono demanded, not preloaded |
| Development build exclusion | passed | [Production manifest + 98 emitted files](ui6-m4a/build-exclusion.json), zero gallery/fixture markers or gallery CSS; three automated build tests; dev URL 404 |
| Protected source/evidence scope | passed | [Audit](ui6-m4a/scope-audit.json): dependencies/contracts/relay/transport/state/signed hooks/metric adapter/Pulse model/original browser verifier/accepted evidence unchanged; runtime fingerprint stable |
| Original browser verifier after M4a | not executed | Unchanged script; M3 execution does not certify M4a |
| LCP/INP/Realtime hardware/other engines/AT/comprehension/live commands | not executed | No live-device, user-study or actual Host/Paper deployment certificate |
| M4b Fleet/Performance and later milestones | not executed | Await maintainer review; accepted 5.0 Fleet axe evidence untouched and its rebuild gate remains in M4b |

Prior failures/interrupted runs are retained under `ui6-m4a/attempts/`, including initial CLS, development cache panic and outdated Overview mount observation. Successful retries did not discard assertions. Local release branch commit only; no push, main, tags or deployment.

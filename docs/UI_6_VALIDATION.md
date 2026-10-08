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

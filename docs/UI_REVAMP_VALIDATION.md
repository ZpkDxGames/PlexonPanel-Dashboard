# UI revamp acceptance evidence

This is source and local native-browser verification of the Dashboard implementation, **not a stable release or production certification**. Agents/operations in local fixtures are simulated; transport uses the real signed standalone relay. Production PlexonCraft and TonimSMP were not contacted or interrupted. No Core/Host, relay runtime, identity, scope contract or deployment receipt was changed. No JAR update is required.

## Source checks

| Gate | Status | Evidence |
|---|---|---|
| Generated fleet/scope contracts, ESLint and TypeScript | PASS | `npm run check`, Node 24.19.0 |
| Relay regression | PASS | 79 tests; Worker and standalone contract fixtures |
| Dashboard regression | PASS | 183 tests, including six new source/report tests; 177 baseline tests retained |
| Worker relay smoke | PASS | `npm run relay:smoke`; compatibility only, no publication |
| Standalone smoke and packaging | PASS | `npm run relay:standalone:smoke`, `npm run relay:standalone:package` |
| Optimized production build | PASS | `npm run build`; clean build sizes/hashes in `ui-evidence/build-metrics.json` |
| Production dependency audit | PASS | `npm audit --omit=dev --audit-level=high`: zero vulnerabilities; sharp override 0.35.5 patches GHSA-wq5f-xc86-pv6w |
| Full development dependency audit | FAIL | Five high findings from the unpatched braces dependency chain in ESLint globbing; see `ui-evidence/dependency-audit.json`. Production audit remains clear |
| Implementation GitHub CI | PASS | [37707924887](https://github.com/ZpkDxGames/PlexonPanel-Dashboard/actions/runs/37707924887), exact frozen implementation/test commit `89b7aa67faed1cd9d3bc3efe3b4774a9db79f1ff`; 262 tests + 162 native checks + 26 axe scans; final delivery head must also pass CI |
| Existing Core main Linux x64 CI | FAIL | [37419700051](https://github.com/ZpkDxGames/PlexonPanel/actions/runs/37419700051): authorization assertion in ResponsiveHostControlTest, line 135; ARM64 passed. No Core diff |

CI artifact IDs, SHA-256 digests and expiration dates are recorded in `ui-evidence/source-ci.json`. The frozen source run verifies both relay smokes, standalone packaging, clean build, browser checks and coordinated release packaging. Later delivery commits update documentation/evidence and test tooling; application source remains unchanged.

## Native viewport, accessibility and interactions

Local Chromium, software GPU, Next development server, signed two-instance fixture: **162 viewport/theme checks pass**, zero JavaScript errors and zero automated WCAG 2 A/AA + 2.1 AA findings in **26 scans**. See `ui-evidence/after/browser-results.json`. Twelve selected pages cover 360/390/768/1024/1440/1920 px in light and dark/high-contrast/125% text/motion-off. Fleet covers six light widths; the bounded read/clear-only legacy archive route covers both themes at all six widths; desktop Fleet and pairing screens are captured. Populated Players/Console/Chat/Plugins/Configuration/Audit/Access, filtering, keyboard chart inspection, scoped CSV/JSON downloads, mobile drawer focus wrapping/Escape, appearance modal Escape, server selector round trip and selected-server journal labels, fresh/stale/Paper-disconnected/stopped state and durable upload-job visibility execute in Chromium. The native checks run automatically in CI and publish artifacts. Automated axe results do not certify a manual screen-reader audit.

Representative screenshots: [desktop Overview](ui-evidence/after/overview-1440-light.png), [mobile Overview](ui-evidence/after/overview-390-light.png), [dark 125%](ui-evidence/after/overview-390-dark-125.png), [Fleet](ui-evidence/after/fleet-1440-light.png), [stale](ui-evidence/after/overview-stale.png), [Paper offline](ui-evidence/after/overview-paper-offline.png), [stopped](ui-evidence/after/overview-stopped.png), [durable upload](ui-evidence/after/backup-uploading.png). All active pages have desktop/mobile captures. [Before screenshots](ui-evidence/before/) are the actual main source on the same simulated fixture/browser, with matching fonts. No visual source test is presented as a screenshot.

## Critical scenarios

PASS here applies to the stated local/source test boundary. VPS equivalents remain NOT_EXECUTED.

| Scenario | Status | Evidence and boundary |
|---|---|---|
| First pairing / stored grant / no credential exposure | PASS | Relay pairing/grant tests; browser-store and mounted dashboard-flow; native stored-grant load + unpaired screenshot |
| PlexonCraft → TonimSMP → PlexonCraft isolation | PASS | Signed mounted dashboard-flow rejects abandoned selection and cancels confirmation; native selector round trip + TonimSMP journal label check |
| Shared VPS node deduplicated; separate service values | PASS | fleet-overview tests deduplicate exact bound node and distinguish one-core service CPU; fixture uses one shared node |
| Paper offline / Host live | PASS | Native screenshot + connection-state/console-history authority tests |
| Host offline / Paper live | PASS | connection-state and device/capability tests; native lifecycle on real VPS NOT_EXECUTED |
| Relay unavailable / expired or revoked grant | PASS | Relay grant/expiry/revocation tests, fleet subscription timeout, action failure tests |
| Fresh/stale/late/out-of-order/future capture | PASS | telemetry-freshness and metric-reports tests; native stale state |
| Background then foreground | PASS | telemetry-freshness clock/cadence tests; sustained native background scheduling NOT_EXECUTED |
| Host lifecycle across Paper reconnect | PASS | Signed mounted dashboard-flow + actions tests; systemd runtime NOT_EXECUTED |
| BUSY / timeout / failed / uncertain lifecycle, no replay | PASS | dashboard-2-1, actions and mounted dashboard-flow tests |
| Full backup / durable upload retry / operation binding | PASS | backups-maintenance, control-state, mounted dashboard-flow; native durable upload job. ZIP/Drive runtime NOT_EXECUTED |
| Healthy Drive preflight is not a verified backup | PASS | backup-readiness / provider-verification tests; native screenshot shows no confirmed backups |
| Role changes, revocation, disabled local policy | PASS | device-grant, player/configuration capability, relay authorization tests |
| Configuration conflict and unsaved server switch | PASS | Mounted Paper edit/review/conflict/selection flow + actions tests |
| Host console → Paper fallback → Host return | PASS | console-history-authority, reducer duplicate/epoch tests and both relay runtimes |
| Six widths and 125% text | PASS | Native 162-check matrix; document overflow asserted at each viewport |
| Light/dark/high contrast/off motion | PASS | Native matrix; reduced-motion floor in preference tests and CSS |
| Two-server 250 ms long-session profile | PASS | 900,031 ms stationary Performance; all nine charts live; zero JS errors/unexpected steady socket closures; 20 navigation + five dialog + four server-switch actions, then garbage collection |
| One shell/theme/chart renderer, no old override cascade | PASS | Complete CSS replacement, semantic import migration, source hygiene test/search; removed historical page files and duplicate Overview renderer |
| Real TLS/WSS, Caddy/CSP/CORS on production | NOT_EXECUTED | Local HTTP/security-header tests do not prove production deployment |
| Actual systemd/journal/Linux accounts and isolation | NOT_EXECUTED | Core source CI contains existing x64 failure; no VPS access attempted |
| Actual ZIP/Drive verification, restore/recovery and rollback rehearsal | NOT_EXECUTED | Requires isolated staging/authorized maintenance and operator evidence |
| Manual screen-reader and physical touch-device audit | NOT_EXECUTED | Native keyboard/axe/emulated viewport checks only |
| Production activation / stable publishing | BLOCKED | Separate exact-main receipt-only activation, Core CI and runtime gates remain required |

## Clean before/after build measurements

Both use Node 24.19.0 / Next 16.3.8 and clean optimized production output. Sums are emitted assets, **not a network transfer or Lighthouse measurement**. Initial HTML references are a useful comparable subset; later dynamic loads are additional.

| Measurement | Before main | Revamp | Change |
|---|---:|---:|---:|
| Canonical CSS source | 169,733 B / 7,092 lines | 53,921 B / 616 lines | −68.2% bytes |
| Emitted production CSS | 166,534 B | 52,328 B | −68.6% |
| All emitted JavaScript | 882,930 B | 893,879 B | +1.2% |
| All JS gzip, per chunk | 268,371 B | 277,898 B | +3.5% |
| Initial HTML JS references | 801,426 B | 700,527 B | −12.6% |
| Initial HTML JS gzip references | 241,584 B | 216,964 B | −10.2% |

Total JS includes nine charts, reports and lazy workspaces; initial route loads less JS. No chart, animation or UI runtime dependency was added. Removed Tailwind/PostCSS compiler dependencies; patched same-major brace-expansion 1.1.21 / 5.0.12 and undici 7.29.1 as well as sharp. The unpatched [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) remains in development-only ESLint globbing; no patched release is published. Playwright/axe are development verification tools. Repeated builds left old hashed chunks in the output, so these figures were recomputed after moving caches aside. Individual production chunk SHA-256s are recorded in both build JSONs; CI separately packages exact-source relay/build metadata and hashes.

## Native performance limitations

The matched fixture stresses all simulated sources at 250 ms, faster than real Paper health and service status. The old source shows six performance charts; the new source shows nine. Development mode, software GPU, unthrottled headless Chromium and uncontrolled host scheduling are explicit constraints. CDP TaskDuration approximates browser main-thread occupied time, not host/VPS CPU. Heap samples include garbage-collection fluctuations. Route timings include test settling delays and are not production interaction p95.

Lighthouse, actual network transfer, dropped-frame traces and real VPS collection overhead: NOT_EXECUTED. No collector frequency or periodic backend task changed. The completed 900,031 ms stationary run keeps all nine chart states Live at 91 checkpoints, with zero JavaScript errors and zero unexpected steady-state socket closures. Rendered DOM remains 739 nodes. Sampled JS heap ranges 27.4–120.3 MB (decimal); the last stationary sample is 42.1 MB and forced-GC retained heap after 20 route changes, five appearance dialogs and four server switches is 21.5 MB. The final SVG path payload is 93,716 bytes across 41 paths including shell icons. This is evidence of bounded behavior within this fixture, not a production leak-free certification.

Matched first-minute development measurements are recorded below. The baseline renders six performance charts; the revamp renders nine, larger readable chart canvases and extra report statistics. Browser task time rises, so this is **not a CPU reduction claim**.

| First ~60 s selected workspace | Before (6 charts) | Revamp (9 charts) |
|---|---:|---:|
| Browser task time | 9,642.7 ms | 12,487.7 ms |
| Script time | 8,488.9 ms | 11,066.3 ms |
| Approximate main-thread occupied time | 16.1% | 20.8% |
| Layout counter delta | 239 | 278 |
| Style recalculation counter delta | 1,162 | 465 |

Full 15-minute main-thread occupied time is 23.1%. Measurements are development mode and do not estimate VPS CPU, production frame rate or interaction p95. Raw data is in `ui-evidence/benchmarks/before.json` and `after.json`.

A separate matched two-server Fleet run lasts 60,009 ms before and 60,005 ms after, with zero JS errors or unexpected steady socket closures. Browser task time is 2,331.1 ms before and 2,411.0 ms after (~3.9% / 4.0% occupied). Rendered Fleet DOM is constant at 123 / 131 nodes respectively. The revamp retains 19.4 MB JS heap after four Fleet/workspace round trips and forced GC. See `before-fleet.json` / `after-fleet.json`; these are short comparisons, separate from the 15-minute selected-workspace profile.

## Reproduction and rollout

Run the commands in [rollout/rollback](UI_REVAMP_ROLLOUT.md). After a clean production build, `node scripts/measure-ui-build.mjs` reproduces the asset inventory. `npm run test:browser` starts only loopback fixtures; do not run a production build concurrently against that same `.next` directory. CI performs these steps sequentially. Use a fresh `.next/dev` cache when switching between development bundlers; aborted local runs and cache failures are not accepted evidence. Artifact provenance in release packaging distinguishes source-browser verification from unexecuted production browser/runtime gates and ignores stale evidence for a different SHA.

No production receipt, Vercel/Worker publication, service restart, JAR replacement, credentials, ports, ACLs, polkit, Caddy, UDP 24455 or worlds were changed.

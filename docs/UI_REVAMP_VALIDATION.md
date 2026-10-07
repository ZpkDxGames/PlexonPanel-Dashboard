# UI revamp acceptance evidence

This is source and local native-browser verification of the Dashboard implementation, **not a stable release or production certification**. Agents/operations in local fixtures are simulated; transport uses the real signed standalone relay. Production PlexonCraft and TonimSMP were not contacted or interrupted. No Core/Host, relay runtime, identity, scope contract or deployment receipt was changed. No JAR update is required.

## Source checks

| Gate | Status | Evidence |
|---|---|---|
| Generated fleet/scope contracts, ESLint and TypeScript | PASS | `npm run check`, Node 24.19.0 |
| Relay regression | PASS | 79 tests; Worker and standalone contract fixtures |
| Dashboard regression | PASS | 182 tests, including five new source/report tests; 177 baseline tests retained |
| Worker relay smoke | PASS | `npm run relay:smoke`; compatibility only, no publication |
| Standalone smoke and packaging | PASS | `npm run relay:standalone:smoke`, `npm run relay:standalone:package` |
| Optimized production build | PASS | `npm run build`; clean build sizes/hashes in `ui-evidence/build-metrics.json` |
| Production dependency audit | PASS | `npm audit --omit=dev --audit-level=high`: zero vulnerabilities; sharp override 0.35.5 patches GHSA-wq5f-xc86-pv6w |
| Exact PR-head GitHub CI | NOT_EXECUTED | Recorded after the branch is pushed; a local pass does not substitute for CI |
| Existing Core main Linux x64 CI | FAIL | [37419700051](https://github.com/ZpkDxGames/PlexonPanel/actions/runs/37419700051): authorization assertion in ResponsiveHostControlTest, line 135; ARM64 passed. No Core diff |

## Native viewport, accessibility and interactions

Local Chromium, software GPU, Next development server, signed two-instance fixture: **150 viewport/theme checks pass**, zero JavaScript errors and zero automated WCAG 2 A/AA + 2.1 AA findings in **24 scans**. See `ui-evidence/after/browser-results.json`. Twelve selected pages cover 360/390/768/1024/1440/1920 px in light and dark/high-contrast/125% text/motion-off. Fleet covers six light widths; desktop Fleet and pairing screens are captured. Drawer Escape, appearance modal Escape, server selector round trip, fresh/stale/Paper-disconnected/stopped state and durable upload-job visibility execute in Chromium. The native checks run automatically in CI and publish artifacts. Automated axe results do not certify a manual screen-reader audit.

Representative screenshots: [desktop Overview](ui-evidence/after/overview-1440-light.png), [mobile Overview](ui-evidence/after/overview-390-light.png), [dark 125%](ui-evidence/after/overview-390-dark-125.png), [Fleet](ui-evidence/after/fleet-1440-light.png), [stale](ui-evidence/after/overview-stale.png), [Paper offline](ui-evidence/after/overview-paper-offline.png), [stopped](ui-evidence/after/overview-stopped.png), [durable upload](ui-evidence/after/backup-uploading.png). All active pages have desktop/mobile captures. [Before screenshots](ui-evidence/before/) are the actual main source on the same simulated fixture/browser, with matching fonts. No visual source test is presented as a screenshot.

## Critical scenarios

PASS here applies to the stated local/source test boundary. VPS equivalents remain NOT_EXECUTED.

| Scenario | Status | Evidence and boundary |
|---|---|---|
| First pairing / stored grant / no credential exposure | PASS | Relay pairing/grant tests; browser-store and mounted dashboard-flow; native stored-grant load + unpaired screenshot |
| PlexonCraft → TonimSMP → PlexonCraft isolation | PASS | Signed mounted dashboard-flow rejects abandoned selection and cancels confirmation; native selector round trip |
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
| Six widths and 125% text | PASS | Native 150-check matrix; document overflow asserted at each viewport |
| Light/dark/high contrast/off motion | PASS | Native matrix; reduced-motion floor in preference tests and CSS |
| Two-server 250 ms long-session profile | NOT_EXECUTED | 15-minute profile in progress; measurements recorded before acceptance |
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
| Canonical CSS source | 169,733 B / 7,092 lines | 53,355 B / 608 lines | −68.6% bytes |
| Emitted production CSS | 166,534 B | 51,882 B | −68.8% |
| All emitted JavaScript | 882,930 B | 893,118 B | +1.2% |
| All JS gzip, per chunk | 268,371 B | 277,616 B | +3.4% |
| Initial HTML JS references | 801,426 B | 699,814 B | −12.7% |
| Initial HTML JS gzip references | 241,584 B | 216,697 B | −10.3% |

Total JS includes nine charts, reports and lazy workspaces; initial route loads less JS. No chart, animation or UI runtime dependency was added. Removed Tailwind/PostCSS compiler dependencies; Playwright/axe are development verification tools. Repeated builds left old hashed chunks in the output, so these figures were recomputed after moving caches aside. Individual production chunk SHA-256s are recorded in both build JSONs; CI separately packages exact-source relay/build metadata and hashes.

## Native performance limitations

The matched fixture stresses all simulated sources at 250 ms, faster than real Paper health and service status. The old source shows six performance charts; the new source shows nine. Development mode, software GPU, unthrottled headless Chromium and uncontrolled host scheduling are explicit constraints. CDP TaskDuration approximates browser main-thread occupied time, not host/VPS CPU. Heap samples include garbage-collection fluctuations. Route timings include test settling delays and are not production interaction p95.

Lighthouse, actual network transfer, dropped-frame traces and real VPS collection overhead: NOT_EXECUTED. No collector frequency or periodic backend task changed. Long-session measurements will be added from `ui-evidence/benchmarks/` after completion; do not infer leak-free production behavior from a short local run.

## Reproduction and rollout

Run the commands in [rollout/rollback](UI_REVAMP_ROLLOUT.md). `npm run test:browser` starts only loopback fixtures; do not run a production build concurrently against that same `.next` directory. CI performs these steps sequentially. Artifact provenance in release packaging distinguishes source-browser verification from unexecuted production browser/runtime gates and ignores stale evidence for a different SHA.

No production receipt, Vercel/Worker publication, service restart, JAR replacement, credentials, ports, ACLs, polkit, Caddy, UDP 24455 or worlds were changed.

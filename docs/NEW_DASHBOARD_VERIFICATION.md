# Verification · Signal Atlas

Source baseline: Dashboard `1b9463e18b0e7dac6c5209760d5510732d6d62b0`; backend reference `209f8b41d4fe6360a8dcf2f9cdabe7b7df6cc128`. Dedicated review branch `design/new-control-plane-20261015`. No production rollout or VPS operation.

## Executed checks

| Check | Result |
| --- | --- |
| npm ci | PASS from the unchanged lockfile |
| npm run check | PASS · 57 tests, including original 48 |
| npm run build | PASS · Node 24 / Vite 8; lazy routes retained |
| npm run test:perf | PASS · 89,698 initial JS gzip bytes / 184,320-byte budget |
| npm run test:browser via qa-local | PASS · 37 Firefox route/matrix cases; zero axe violations, overflow or console errors |
| control-plane-check | PASS · 25 groups, including 64 route/viewport checks, scoped data, reviewed fixture completion, invalidated target, unknown preflight, source epochs, touch and pairing rejection |
| review-confirmation-check | PASS · five reviewed session.execute calls carry required confirmation; typed ban remains disabled until subject matches |
| visual-proofs | PASS · 32 dark/light desktop/mobile route captures; zero axe/overflow findings |
| npm audit --omit=dev --audit-level=high | PASS · zero reported vulnerabilities |
| git diff --check | PASS |
| Production fixture exclusion | PASS · fixture implementation/names absent from production JS |
| Protected-boundary diff | PASS · adapters/store/validators/capabilities/hosting/dependencies and original tests unchanged |

Browser: headless Firefox 157. All operational data is synthetic. Harnesses block non-localhost requests before loading and disable third-party skins. Browser and server launch together because execution namespaces isolate independent localhost sessions. There is no lint script; TypeScript checks are part of check/build and were also run between stages.

## Measured performance

| Measurement | Baseline | Signal Atlas |
| --- | ---: | ---: |
| Initial-route JS, gzip | 114,221 B | 89,698 B (21.5% smaller) |
| Display-path benchmark, 8192 raw points | 8192 rendered | 474 rendered; raw retained |
| Line/area path characters, pure benchmark | 194,828 | 11,316 |
| Median path generation | 1.52 ms | 0.081 ms cached; 0.394 ms cold including sample copy |
| Development Performance page DOM | 485 nodes | 914 nodes; more independent instruments |
| Development SVG path characters | 595,270 | 52,162 |
| Development frame interval median | 17.08 ms | 17.12 ms |
| Development frame interval p95 | 50.42 ms | 66.66 ms |
| Rendered rows with 2500 retained console lines | 35 | 26 |

Reproduction: `scripts/telemetry-profile.mjs` and `scripts/browser-profile.mjs`; raw JSON is in the evidence bundle. Pure geometry and browser replay are different measurements. No hardware frame-rate improvement is claimed. The richer Performance page reduced path volume but increased DOM and tail frame time in this headless development replay. Production-build and representative-device profiling remain an acceptance gate; existing buffers, telemetry publication cadence and safety evaluation are unchanged. The original virtual 30-minute reducer soak continues to pass; no actual 24-hour soak or process-heap measurement was performed.

## Flow evidence and limits

- Pairing UI → existing /v1 claim → same-relay credential validation/IndexedDB → signed session: source/contract tests pass; isolated browser rejected-claim recovery passes. A fresh live accepted claim is PENDING LIVE ACCEPTANCE.
- Operational UI → prepare → review → execute → agent-bound result: contract tests pass; browser verifies correct Paper target, typed risk guard, server-switch discard and simulated agent result. Actual server mutation is PENDING LIVE ACCEPTANCE.
- Signed source state → independent source capture projection → source epoch → display reduction → charts/tables: new regressions and browser inspection pass. Actual telemetry correlation is PENDING LIVE ACCEPTANCE.
- Host durable job → queried state/matched progress → journal/verification → reviewed actions: mock/contract evidence passes. Actual systemd/RCON/rclone/backups remain PENDING LIVE ACCEPTANCE.

No backend changes were needed or prepared. Runtime versions and existing 5.0 release coordination gates are not certified by this frontend work. Direct Vercel project inspection returned a scoped 403. Git integration subsequently reported the nonproduction preview Ready; see NEW_DASHBOARD_RELEASE_RECEIPT.md for the exact evidence and URL. See rollout and risk documents.

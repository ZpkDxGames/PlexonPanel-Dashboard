# Verification / Operations Desk

Source baseline: Dashboard main `1b9463e18b0e7dac6c5209760d5510732d6d62b0`. Reconstruction base: `4295d16e6ecac0be27b0142e20b1b69c78862c66`. Core source: `209f8b41d4fe6360a8dcf2f9cdabe7b7df6cc128`. Exact published implementation and review receipt are recorded in NEW_DASHBOARD_RELEASE_RECEIPT.

## Executed gates

| Check | Actual result |
| --- | --- |
| npm ci | PASS, lockfile unchanged |
| npm run check | PASS, 58 tests; all original 48 retained |
| npx tsc --noEmit | PASS at implementation checkpoints |
| npm run build | PASS, Vite/React architecture retained |
| npm run test:perf | PASS, 89,567 initial JS gzip bytes against unchanged 184,320-byte budget |
| npm run test:browser via qa-local | PASS, 37 route/matrix cases; zero axe findings, document overflow or console errors |
| control-plane-check | PASS, 25 groups including all eight routes at eight widths, source states, pairing recovery, grant denial, immutable review and source generation |
| reconstruction-check | PASS, 12 groups: new IA, eight instruments, comparison inspection, nested-modal focus, Access views, settings anchors, large type and mobile signal/navigation controls |
| review-confirmation-check | PASS, five simulated reviewed dispatches preserve required confirmation; typed ban guard retained |
| visual-proofs | PASS, 32 captures: all eight routes × 1440/390 × actual dark/light themes, zero axe findings/overflow/errors |
| npm audit --omit=dev --audit-level=high | PASS, zero production dependency vulnerabilities |
| git diff --check | PASS |
| Protected modules compared to main | No adapter/store/lib/security/package/config diff |
| Production fixture exclusion | Synthetic fixture names absent from production JS; DEV import gate unchanged |

Browser: headless Firefox 157, localhost only. Test harnesses block nonlocal requests and disable external skins. Fixtures cannot dispatch operations. Browser/server are launched together because execution namespaces isolate independent localhost sessions. There is no lint script; TypeScript checks are included in check/build.

The added render regression proves that a passive Fleet trace cannot use the selected server’s history. Generation-aware summaries now match their plotted source view. Action review restores keyboard focus without weakening execution guards.

## Measured performance

Display-path benchmark: 8,192 raw observations → 474 display points while preserving a sharp excursion, null gap and original samples. Legacy median 1.571 ms; cached reduction 0.075 ms; cold reduction including a copied array 0.456 ms. Path text falls from 194,828 to 11,316 characters. This measures pure view processing, not the complete UI.

| Same-container browser replay | Main baseline | Focused instrument | Eight-track comparison |
| --- | ---: | ---: | ---: |
| Visible SVG plots | 3 | 1 | 8 |
| Retained observations | 8,192 | 8,192 | 8,192 |
| DOM nodes | 485 | 546 | 915 |
| SVG path characters | 595,270 | 14,038 | 89,888 |
| Median frame interval | 17.10 ms | 17.06 ms | 17.08 ms |
| p95 frame interval | 33.26 ms | 17.30 ms | 49.44 ms |
| Frames above 50 ms | 6 | 7 | 8 |
| 24-event replay duration | 3.98 s | 4.09 s | 8.20 s |
| Console rows rendered, 2,500 retained | 35 | 26 | 26 |

Focused view has a better p95 in this run. Eight-track comparison costs more CPU/replay time and has a worse p95 than baseline. This is an explicit tradeoff, not a universal frame-rate improvement or hardware certification. Raw retention/transport/cadence are unchanged. The 24-event synthetic run is not a live sustained throughput claim.

Initial JS is 21.6% smaller than main (114,221 → 89,567 gzip bytes). The compiled stylesheet is larger: Vite’s reported gzip is approximately 19.41 → 22.89 kB. Lazy route loading and the original initial-JS budget remain intact.

## Not executed / pending

Real Paper/Host/relay/VPS round trips, production origin allowlisting, installed-version verification, real destructive/lifecycle/backup operations, Chromium, Safari, physical mobile devices, screen readers, 200% browser zoom and an actual 24-hour browser/heap soak are pending. A virtual 30-minute reducer soak is included in the passing contract tests. No production promotion, service restart, JAR replacement, credential change or backend migration occurred.

Use NEW_DASHBOARD_ROLLOUT for the separate safe live-acceptance and rollback procedure. NO SERVER-SIDE CHANGE IS PROPOSED: the measured bottleneck is in display processing, and backend runtime load was not profiled.

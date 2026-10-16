# Baseline execution

Base `cea185cca07d9892967215baed097bedbe0e77ca`; Node 24.19.0.

| Check | Actual result |
| --- | --- |
| npm ci | Passed, 43 packages installed from existing lockfile |
| npm run check | 58 passed, zero failed |
| npm run build | Passed |
| npm run test:perf | 89,567 initial JavaScript gzip bytes; 184,320-byte budget |
| Playwright Firefox provisioning | Passed |
| node scripts/qa-local.mjs | 37 route/matrix cases passed, zero axe findings/overflow/console errors |
| visual-proofs.mjs via qa-local | 32 dark/light desktop/mobile captures; zero axe findings/overflow |
| telemetry-profile.mjs | Captured for the same path-generation workload |

Raw logs, baseline PNGs, size JSON and projection timings are in the review evidence archive. Baseline screenshots use development fixtures and are not evidence of a connected Minecraft server.

# Baseline checks

2026-10-15, Dashboard `1b9463e18b0e7dac6c5209760d5510732d6d62b0`.

- npm ci: PASS.
- npm run check: PASS, 48 tests, 0 failures (3.67 seconds).
- npm run build: PASS. Existing Motion module directive warnings are nonfatal.
- npm run test:perf: PASS, initial route JS 114,221 gzip bytes; budget 184,320.
- Browser provisioning: Chromium absent; Firefox 157 provisioned via Playwright fallback CDN. First standalone browser attempt could not reach a server in a separate execution namespace. Rerun starts Vite and Firefox together. That rerun passed 37 route/matrix cases, with zero axe violations, no document overflow and no console errors. Full evidence is recorded with final verification.

Baseline screenshot, browser JSON, build and check logs are retained under artifacts/baseline (not production code).

## Reconstruction of the rejected presentation

New branch `design/operations-workspace-20261015` starts at `4295d16e6ecac0be27b0142e20b1b69c78862c66`. Before presentation replacement, `main` was rechecked at `1b9463e18b0e7dac6c5209760d5510732d6d62b0`, Core at `209f8b41d4fe6360a8dcf2f9cdabe7b7df6cc128`, both unchanged. The existing 57 tests, build, 89,698-byte initial gzip check and 37-case browser suite passed. Original baseline source remains a detached sibling worktree. No main history was reset or rewritten. The final reconstruction extends the suite to 58 tests.

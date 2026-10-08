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

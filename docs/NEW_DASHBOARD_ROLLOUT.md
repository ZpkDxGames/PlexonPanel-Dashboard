# Preview, live acceptance and rollback

The owner authorized frontend production promotion and GitHub release publication on 2026-10-15. See [release notes](releases/dashboard-operations-desk-2026.10.15.md). Backend services/configuration, credentials, JARs and relay allowlists remain outside this frontend deployment authorization.

## Local review

Node 24.x:

```sh
npm ci
npm run check
npm run build
npm run test:perf
npx playwright install firefox
node scripts/qa-local.mjs
node scripts/qa-local.mjs scripts/control-plane-check.mjs
node scripts/qa-local.mjs scripts/review-confirmation-check.mjs
node scripts/qa-local.mjs scripts/reconstruction-check.mjs
node scripts/qa-local.mjs scripts/visual-proofs.mjs
node --import tsx scripts/telemetry-profile.mjs
MOZ_DISABLE_CONTENT_SANDBOX=1 node scripts/browser-profile.mjs
```

The last comparison requires a sibling `baseline` checkout at the baseline SHA with the same node_modules. Browser scripts allow localhost only and disable skins. Fixtures are synthetic, development-only and excluded from production bundles. `npm run test:browser` is still supported with an already running server; qa-local starts both in one network namespace.

## Nonproduction deployment

1. Review the exact branch diff and test evidence. Build with the existing Vite/Node 24 settings and existing public relay origin. Use a preview environment or separate project; do not point production aliases at it.
2. Preserve the current CSP and exact relay HTTPS/WSS origins. Do not widen connect-src. No hosting configuration change is required by this branch.
3. A new preview origin is not automatically authorized by the relay. Adding it to an allowlist is a separate operator-approved live configuration action. Do not infer a broken frontend from a denied preview origin.
4. Use an explicitly approved disposable server and least-privilege browser pairing for acceptance. Do not copy a production token into a URL, test fixture, log or new origin.

## Pending live acceptance script

Record Dashboard/relay/Paper/Host versions and hashes before running any live procedure.

1. Pair a disposable monitoring device with a fresh server-issued code. Reload and verify the same credential survives only in browser IndexedDB.
2. Inspect Paper captures/receipt clocks and Host captures separately. Compare TPS/MSPT, JVM heap, systemd cgroup CPU denominator/memory and NODE values with authoritative local monitoring. Check missing fields and clock skew.
3. Pair a second server; switch with a review open. The review must disappear and no operation dispatch. For two verified instances on one node, check that the node is counted once.
4. On the disposable environment only, independently interrupt Paper and Host. Confirm the other authority continues and the unavailable source is marked correctly. Reconnect and verify source generations and gaps.
5. With explicit disposable-server control authorization, dispatch an allowed low-risk command, inspect the requesting-device agent result and audit. Withhold results/disconnect in a controlled test and verify unknown-outcome behavior without retries.
6. For a read-only device, verify every mutation remains blocked. Revoke that device locally; verify recovery and absence of privileged data.
7. Only with separate backup/lifecycle authorization and a verified recovery copy, exercise Host preflight/countdown/job reconstruction and BUSY exclusion. Do not use production worlds for an unapproved destructive test. Verify off-site SHA/provider state independently; transfer 100% is not job completion.

No live action, backend deployment or service interruption was performed during implementation.

## Promotion and rollback

Production cutover requires explicit approval after the above gates. Retain the previous frontend deployment/alias and its pairing until acceptance ends. Prefer the existing production origin to retain the existing browser credential store; a new origin needs separate pairing and allowlisting.

To roll back after an approved cutover, restore the previous immutable frontend deployment/alias. The branch does not migrate persisted preferences, credentials or server data. If a temporary preview device/origin was approved, revoke/remove those deliberately afterward. Do not stop Paper/Host, replace rollback JARs, delete caches/identities or change Protocol 3 to roll back this frontend.

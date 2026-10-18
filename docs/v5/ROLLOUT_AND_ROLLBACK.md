> Historical evidence for the prior release. The owner rejected that visual design; see VISUAL_REBUILD_DIRECTIVE.md and VISUAL_REBUILD_VERIFICATION.md for the current sidebar rebuild.

# Rollout and rollback

This package is a locally verified source candidate. It has not been pushed, merged, deployed or installed on a VPS. The owner authorized main-branch merge and production deployment on 2026-10-17. Main Git deployment is now enabled; work/v5-full-release and the release staging branch remain disabled. An explicit .next output overrides any retained Vite/dist project setting. The Next configuration migrates the installed public VITE_PLEXON_RELAY_URL when NEXT_PUBLIC_PLEXON_RELAY_URL is absent. No secret environment keys are exposed.

## Authorized installation checklist for the later rollout

1. Record exact source commits and JAR checksums from SOURCE_IDENTITY.json and SHA256SUMS.txt. Retain installed artifacts, private configuration, service units, access/device stores, maintenance journals and off-site backups. Do not print or export credentials.
2. Run native Java25 test/JNI verification on both Linux x64 and ARM64 CI. The Host JAR bundles only SQLite JNI for glibc/musl x64/ARM64; the native-access flag is in the fleet service example. Use the installed non-root Host identity and its private writable temporary directory. Keep serverRoot read-only and fixed-unit Polkit confinement.
3. Review relay routing for additive events.session.list, chat.history, maintenance.configure and session.epoch_reset. The dashboard uses existing maintenance.settings.update for settings changes and scope-checked server.status includeSession/includeChat as read compatibility fallbacks. Certify the actual deployed relay, its scope intersection and signed agent sessions. The relay source is absent from the archives.
4. Deploy the matched Paper26.2/Java25 plugin and Host during an approved maintenance window. Wait for all active destructive maintenance to finish before replacing either binary. Observe host-local SQLite/JSON permissions, same-invocation Host restart retention, a Minecraft restart reset and a shutdown-then-start reset. Confirm old invocation rows are rejected.
5. Set NEXT_PUBLIC_PLEXON_RELAY_URL to the exact existing HTTPS relay origin at both build and runtime. Build with Node24. Next dynamic rendering generates a fresh nonce CSP and no-store HTML. Certify the authorized Vercel origin in relay/Caddy; preserve paired origins and credentials. Changes to relay origin require deliberate re-pairing.
6. Exercise read-only history, severity/search/pagination, scope reduction and chat/presence hydration. Review source epochs and stopped-resource behavior. Inspect browser IndexedDB: only credentials/directory/relay metadata, no console/chat/player history. Only eight UI preferences belong in localStorage.
7. Keep periodic backups disabled initially (the supplied example defaults to disabled). Complete a separately authorized manual backup with RCON countdown/save-flush, fixed-systemd inactive/PID-zero stop proof, local verification, real Google Drive SHA-256 verification/promotion and restart. Certify upload failure/retry, local retention and provider isolation. Enable a periodic schedule only through its reviewed settings action after these checks.

The preserved stable-release gate file refers to historical coordination evidence and is not certification of this implementation. New matched source/CI/runtime receipts must replace those references before a production release. No successful local mock can certify Google Drive contents or off-VPS recoverability.

## Rollback

Disable periodic schedules through a reviewed settings update and wait until no destructive Host job is active. Retain journals, verified local archives, provider state and the SQL/JSON directory; do not clear a recovery-required record or roll a Host backward mid-operation.

Restore the previously retained matched binaries/configuration and authorized frontend artifact as a coordinated operation. Preserve device identity, private keys, signed associations and stored pairings. A frontend rollback to the original version-1 IndexedDB opener would fail after this version-2 migration. Use rollback/browser-store.ts from this package as the v2-compatible storage layer in any older UI build, or retain this source's equivalent migration. It intentionally keeps credentials/labels/selection/relay metadata and purges operational records. Never delete the database merely to make an old UI load.

The SQL schema is additive and scoped to the current Minecraft invocation. An older Host will not provide the new session queries/events; present unavailable evidence rather than reconstructing prior-boot output from browser storage. Rollback requires a newly verified build on the same authorized origin and an operational check against the exact installed agent versions. No rollback was executed in this workspace.

# PlexonPanel Dashboard — Backups & Maintenance

This release aligns the Backups workspace with the Host-authoritative manual full-backup architecture while keeping protocol generation 3.

## Highlights

- Retired the Paper-coordinated live-snapshot workflow from the active dashboard.
- Removed recurring full-backup scheduling and next-full-backup presentation; only restart scheduling remains automatic.
- Kept **Create full restore point** as the explicit user-triggered backup action.
- Added truthful manual-only status, Host-owned countdown visibility, local/remote verification phases, degraded off-site state, and retry-upload presentation.
- Kept provider status and **Test Google Drive** without exposing Host credentials, config contents, raw rclone output, or arbitrary remote command arguments to the browser.
- Kept typed server-name restore confirmation and the 64 MiB browser archive download ceiling.
- Removed the unused legacy backup view that still exposed live snapshots.
- Updated tests and operator documentation so the retired schedule/live-snapshot architecture cannot silently return through stale UI assumptions.

## Matched Host behavior

The Dashboard does not create archives or control systemd directly. The Linux PlexonPanel Host Companion owns:

- the mandatory 30m / 15m / 1m / 30s / 15s / 5s full-backup warning sequence;
- Host-local final `save-all flush` verification;
- systemd stop/start and stop proof;
- cold full-server archive creation;
- local ZIP/SHA-256 verification before off-site promotion;
- Google Drive/rclone staging, verification, canonical promotion, bounded retry and degraded recovery;
- retrying an existing verified local backup without stopping Minecraft again;
- restore journals and emergency pre-restore backups.

Paper is not in the manual full-backup critical path and does not advertise backup coordination authority.

## Scheduling migration

Full backups are manual-only. Legacy `backups.intervalMinutes`, Paper `backups.*`, and `fullRestorePoint.schedule` settings are non-authoritative migration residue. The dashboard no longer offers a full-backup schedule editor or a next-backup timestamp.

Restart scheduling remains independent and may stay enabled.

## Validation

Canonical Dashboard CI must pass lint, TypeScript validation, relay build/tests, application tests, relay smoke validation, and the production Next.js build before merge. The matched PlexonPanel backend must independently pass its Java 25 x64 and ARM64 test/check/package matrix.

Live PlexonCraft certification remains a separate production gate for the final merged release candidate.

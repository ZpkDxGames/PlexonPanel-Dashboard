# Backups & Maintenance — Step 8

The PlexonPanel Dashboard is an authenticated control and presentation surface. It does not execute backups, own countdown timers, hold Google Drive credentials, perform archive work, decide restart/recovery behavior, or become backup-state authority.

The always-on Linux PlexonPanel Host Companion is authoritative for the manual full-backup workflow: preflight, durable job state, warning countdown, player notices through the Host-local Minecraft command channel/RCON, final `save-all flush`, systemd stop/start, cold archive creation, local verification, rclone/Google Drive upload and verification, retry/recovery state, console history and audit.

The Paper plugin is informative for this workspace but is not required for the backup critical path.

## Final operator contract

Automatic backups are retired. Full backup creation is manually initiated through **Fully Backup Now** and executed by the always-on Host Companion.

The successful operator flow is:

1. open **Backups & Maintenance**;
2. wait for authoritative Host preflight to report ready;
3. press **Fully Backup Now**;
4. review the destructive-maintenance confirmation and current preflight summary;
5. confirm the operation;
6. Host persists the job and begins the mandatory 30-minute warning period;
7. Host sends warnings at 30m / 15m / 1m / 30s / 15s / 5s;
8. Host requires an affirmative `save-all flush` result;
9. Host stops `plexoncraft.service` and independently proves shutdown;
10. Host creates and locally verifies the cold full-server restore point;
11. Host uploads through configured Google Drive/rclone staging/promotion and verifies the remote copy;
12. Host automatically starts Minecraft and verifies readiness;
13. the job becomes `COMPLETED`.

Closing, refreshing, or reconnecting the browser does not cancel the operation. The Dashboard reconnects to the current durable Host job through `maintenance.status`.

## Host preflight

**Fully Backup Now** is blocked unless authoritative Host/device state is safe. The Dashboard does not recreate the backup policy as an independent authority.

The control surface requires or displays, as applicable:

- connected/authenticated Host Companion;
- device grant for `maintenance.run` through the concrete `maintenance.full-backup.create` capability;
- no active destructive operation;
- no recovery-required job/restore state;
- known systemd/Minecraft service state;
- Host command channel/RCON configured and Minecraft readiness healthy when the server is online;
- writable local backup storage and sufficient free space;
- safe source-tree scan with symlink/traversal protections;
- configured and reachable rclone/Google Drive provider.

Secrets remain Host-local and are never displayed.

## Confirmation

The **Fully Backup Now** confirmation explicitly states that the Host will:

- begin a 30-minute warning period and notify players;
- require a successful final save;
- stop Minecraft;
- create and verify a cold full-server archive;
- upload and verify the Google Drive copy;
- automatically restart Minecraft and verify readiness;
- restore Minecraft availability even when an otherwise valid local backup finishes with a bounded off-site failure.

The browser sends `maintenance.full-backup.create` with no countdown bypass parameter.

## Durable job and timeline

The Dashboard reconstructs current state from the Host job rather than treating React/browser state as authoritative. Durable phases are presented with operator-friendly labels:

- `QUEUED` — Queued;
- `PREFLIGHT` — Preflight;
- `COUNTDOWN` — 30-minute warning period;
- `FINAL_SAVE` — Saving server;
- `STOPPING_SERVER` — Stopping Minecraft;
- `WAITING_FOR_STOP` — Confirming shutdown;
- `ARCHIVING` — Creating backup;
- `VERIFYING_LOCAL` — Verifying local backup;
- `UPLOADING_REMOTE` — Uploading to Google Drive when reported by the Host progress stream;
- `VERIFYING_REMOTE` — Verifying Google Drive backup;
- `STARTING_SERVER` — Starting Minecraft;
- `VERIFYING_STARTUP` — Checking readiness;
- `COMPLETED` — Complete.

The workspace shows durable job ID, phase timestamp, Host countdown fields when available, local/remote verification flags, safe error fields, and only job-matched live archive/upload byte progress. It does not invent an ETA.

## Failure states

### Failed before shutdown

Examples include failed provider/storage preflight, unavailable RCON, or failed final save. Minecraft remains online when the destructive boundary was never crossed. The Host records the safe failure reason and the Dashboard blocks/retries according to Host state.

### Recovery required

If failure occurs after Minecraft may have been stopped, or Host state is otherwise ambiguous, the job becomes recovery-required. The Dashboard presents a prominent warning and blocks another destructive backup until Host recovery is completed.

### Degraded / Retry Upload

If a local backup is valid but Google Drive upload/verification exhausts bounded retry policy, the local restore point is preserved, the previous known-good remote copy remains protected, Minecraft is restored online, and the job can become degraded/retryable.

**Retry Upload** reuses the verified local archive and does not stop Minecraft again.

## Restore points

Only supported Host-backed controls are exposed:

- **Verify**;
- **Retry Upload**;
- **Restore**;
- **Delete**;
- **Test Google Drive**.

Restore remains a separate destructive workflow with its own Host confirmation-token/server-name protections. It is not merged into **Fully Backup Now**.

## Scheduling and legacy compatibility

There is no automatic full-backup schedule. The Dashboard does not expose live-snapshot creation, live-snapshot intervals, next scheduled backup, or backup schedule editing.

Automatic restart-only scheduling remains a separate maintenance feature and cannot trigger a backup.

Legacy full-backup schedule and `restartAfter` fields may remain serialized for rolling-upgrade compatibility. Dashboard writes force the legacy backup schedule disabled and `restartAfter: true`. Host migration also normalizes legacy `restartAfter: false`; service recovery after a manual full backup is mandatory.

Legacy `backup.create` scope compatibility may remain only where required by migration, including the existing retry-upload grant mapping. It is not exposed as an active live-backup action.

## Provider security

Google Drive/rclone credentials never enter browser state. Configure rclone on the Linux host under the `plexonpanel-host` account and keep its config protected. The remote destination is Host configuration, not a browser-controlled command argument.

Provider replacement uses Host-owned staging/promotion and verification. A new remote object must not destroy the previous known-good copy before verification succeeds.

## Production certification

Repository tests and CI are necessary but are not real VPS certification. Final production evidence must separately record the exact backend/dashboard SHAs, artifact checksums, deployed Host/Paper hashes, systemd/RCON/rclone state, real **Fully Backup Now** result, browser reconnect behavior, and degraded/retry result.

Never mark an unexecuted production gate as passed.

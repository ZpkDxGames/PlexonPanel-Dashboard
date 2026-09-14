# Backups & Maintenance

The PlexonPanel Dashboard is the authenticated control surface for maintenance; it is not the backup executor. The Linux Host Companion owns backup orchestration, Minecraft maintenance warnings, final save flushing, systemd lifecycle, cold ZIP creation, local verification, Google Drive/rclone transfer, retry/recovery state, and restart verification. Paper is not part of the full-backup critical path.

## Backup model

PlexonPanel now exposes one backup model: a **manual cold full restore point**.

A full restore point archives the configured Minecraft server root only after the Host has completed the maintenance countdown, issued the Host-local final `save-all flush`, stopped the configured systemd unit, and proved the service is stopped. The Host writes the archive outside the Minecraft server root, stages and atomically promotes it, verifies the local ZIP/hash before any off-site promotion, then applies the configured Google Drive/rclone policy.

The previous Paper-coordinated live snapshot path is retired. There is no dashboard action, interval scheduler, or calendar schedule for creating backups automatically.

## Backups workspace

The **Backups** section exposes the Host-backed **Backups & Maintenance** workspace when the paired device and Host capabilities allow it. It shows:

- current maintenance phase and backup progress;
- the independent next restart occurrence;
- explicit **Manual only** full-backup mode;
- local/off-site provider state;
- verified full-restore-point inventory;
- SHA-256/verification state where available;
- recovery-required state;
- Host-offline state;
- Host-owned restart and full-backup policy settings.

The workspace does not invent a next backup timestamp because recurring full backups do not exist.

## Scheduling

Only restart scheduling remains automatic. Restart schedules support daily, weekly, and selected-weekday modes with an IANA timezone such as `America/Sao_Paulo`.

Full backups are manual-only. Legacy values such as `backups.intervalMinutes` or `fullRestorePoint.schedule` are migration residue and are not authoritative. The dashboard neither edits nor presents a recurring full-backup schedule.

## Manual full-backup flow

1. An authorized user explicitly starts **Create full restore point**.
2. The Host performs local/provider preflight before the countdown.
3. If Minecraft is running, the Host executes the fixed 30m / 15m / 1m / 30s / 15s / 5s warning sequence through its Host-local command channel.
4. Immediately before shutdown, the Host requires a successful `save-all flush` response.
5. The Host stops the configured systemd service and proves the process is no longer running.
6. The Host creates the cold archive and locally verifies its ZIP structure, expected entry count, size bounds, and SHA-256.
7. When Google Drive is configured, the Host uploads through staging, verifies the remote object, then promotes the canonical restore point without destroying the previous known-good copy first.
8. On terminal off-site failure, the verified local backup remains available, the job becomes degraded/retryable, and Minecraft is recovered according to the Host safety policy instead of being stranded offline indefinitely.
9. **Retry upload** reuses the existing verified local archive while Minecraft remains online; it does not stop the server or recreate the backup.

Paper may be disabled or disconnected while the Host performs these phases.

## Manual actions

Depending on granted scopes and Host capabilities, the workspace can expose:

- **Restart server**;
- **Create full restore point**;
- **Verify**;
- **Retry upload**;
- **Restore**;
- **Delete**;
- **Test Google Drive**.

There is no **Create live snapshot** action.

Destructive actions pass through the Dashboard confirmation layer, relay authorization, and Host capability/device checks. Full restore remains Owner-enforced by the Host and requires the server-name confirmation-token flow.

## Google Drive / rclone

Google credentials never enter browser state. Configure rclone on the Linux host under the `plexonpanel-host` account and keep the rclone config readable only by the Host service account.

The remote destination is Host-local configuration. Browser requests cannot supply an rclone executable, config path, destination, or arbitrary flags.

The Host uploads a replacement to a unique staging object, verifies the staged object, preserves the previous canonical object during promotion, and promotes only after verification succeeds. A failed cloud transfer does not invalidate the completed local restore point. Use **Retry upload** to send that existing local archive again without recreating it.

**Test Google Drive** performs a bounded Host-side provider check. The browser sees sanitized health/status fields, not rclone stdout/stderr, OAuth material, or arbitrary remote command arguments.

## Restore

A full restore uses the Host's destructive-operation lock and confirmation flow. The normal sequence is:

1. select a verified full restore point;
2. prepare the restore and receive the short-lived confirmation token;
3. type the configured server name;
4. stop PlexonCraft if it is running;
5. verify the selected archive;
6. create an emergency pre-restore cold backup;
7. create the restore journal;
8. extract into staging with traversal/ZIP-slip/duplicate/size protections;
9. replace targets;
10. remove the rollback journal after successful replacement;
11. optionally start the service and require Host-local Minecraft readiness.

If verified metadata refers to an off-site restore point whose local ZIP is no longer present, the Host can download the canonical remote archive to Host staging and verify it before using the same restore pipeline.

## Browser download policy

Browser archive downloads remain capped at 64 MiB. Large restore points stay on the Host and/or configured off-site provider; retrieve those through Host/provider operations rather than making the browser hold multi-gigabyte ZIPs.

## Failure and recovery states

The workspace surfaces Host-reported errors and recovery-required state. During a Google Drive outage the expected behavior is local backup preservation, previous remote restore-point preservation, bounded retry/timeout handling, server recovery according to policy, and later retryable upload.

If a destructive restore journal remains after a crash, do not bypass it in the browser. Keep Minecraft stopped and follow the Host Companion recovery procedure before attempting another destructive operation.

## Permissions

The Dashboard exposes actions only when both the immutable device grant and current Host capability allow them. Backup, maintenance, provider, and systemd lifecycle authority are Host-owned. Paper does not advertise or execute full-backup coordination. High-risk actions require the shared confirmation flow; restore remains Host Owner-only even if a custom role is accidentally granted the underlying backup restore scope.

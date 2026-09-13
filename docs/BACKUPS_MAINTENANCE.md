# Backups & Maintenance

The PlexonPanel Dashboard is the authenticated control surface for maintenance; it is not the backup executor. The Paper agent coordinates player-facing warnings and final save flushing, while the Linux Host Companion remains the sole authority for systemd, cold ZIP creation, local backup storage, SHA-256 verification, restore execution, and rclone/Google Drive access.

## Backup classes

**Live Snapshot** keeps Paper online. The existing Paper/Host save-lease path coordinates world saving before the Host reads the configured live-backup include set. This path keeps the established live-snapshot exclusions and is not a substitute for a cold database-consistent restore point.

**Full Restore Point** is a cold full-server ZIP. PlexonCraft is stopped before mutable worlds and plugin database state are archived. The Host creates the archive outside the Minecraft server root, writes to staging first, promotes only a completed archive, records SHA-256 metadata, and can upload the verified result through its host-local rclone configuration.

## Backups workspace

The **Backups** section exposes the Host-backed **Backups & Maintenance** workspace when the paired device and Host capabilities allow it. It shows:

- current maintenance phase and backup progress;
- next restart and next full restore-point occurrence;
- local/off-site provider state;
- loaded live-snapshot and full-restore-point inventory;
- SHA-256/verification state where available;
- recovery-required state;
- host-offline state;
- schedule settings owned by the Host.

No backup schedule is stored in browser-local preferences. Saving maintenance settings writes the validated Host-owned maintenance configuration through the control plane.

## Scheduling

Schedules support daily, weekly, and selected-weekday modes with an IANA timezone such as `America/Sao_Paulo`. The Host recomputes calendar occurrences and persists execution claims, so a Host restart around the scheduled minute does not intentionally execute the same occurrence twice.

Migrated installations do not automatically enable destructive schedules. Enable restart and full restore-point schedules explicitly after checking the intended timezone, weekday, and local time.

For PlexonCraft, the recommended operating pattern is a daily low-traffic restart and a weekly Sunday restore point. If both resolve to the same scheduled occurrence, the Host collapses them into one cold maintenance operation rather than stopping and starting the server twice.

## Manual actions

Depending on granted scopes and Host capabilities, the workspace can expose:

- **Restart now**;
- **Create live snapshot**;
- **Create full restore point**;
- **Verify**;
- **Retry upload**;
- **Restore**;
- **Delete**;
- **Test Google Drive**.

Destructive actions pass through the Dashboard confirmation layer, relay authorization, and the Host capability/device checks. Full restore is additionally Owner-enforced by the Host and requires the server-name confirmation token flow.

## Google Drive / rclone

Google credentials never enter browser state. Configure rclone on the Linux host under the `plexonpanel-host` account and point the Host Companion at the protected rclone config. A typical target is:

```text
gdrive:PlexonCraft
```

with a single-current canonical pair such as:

```text
gdrive:PlexonCraft/PlexonCraft-Latest.zip
gdrive:PlexonCraft/PlexonCraft-Latest.json
```

The Host uploads a replacement to staging, verifies the staged object, preserves the previous canonical object during promotion, and promotes only after verification succeeds. A failed cloud transfer does not invalidate the completed local restore point. Use **Retry upload** to send that existing local archive again without recreating it.

**Test Google Drive** performs a bounded Host-side provider check. The browser sees health/status information, not rclone credentials or arbitrary remote command arguments.

## Restore

A full restore uses the Host's destructive-operation lock and confirmation flow. The normal sequence is:

1. select a full restore point;
2. prepare the restore and receive the short-lived confirmation token;
3. type the configured server name;
4. stop PlexonCraft if it is running;
5. verify the selected archive;
6. create an emergency pre-restore cold backup;
7. create the restore journal;
8. extract into staging with traversal/ZIP-slip/duplicate/size protections;
9. replace targets;
10. remove the rollback journal after successful replacement;
11. optionally start the service and require a fresh authenticated Paper reconnect.

If verified metadata refers to an off-site restore point whose local ZIP is no longer present, the Host can download the canonical remote archive to Host staging and verify it before using the same restore pipeline.

## Browser download policy

Browser archive downloads remain capped at 64 MiB. Large restore points stay on the Host and/or the configured off-site provider; retrieve those through host/provider operations rather than making the browser hold multi-gigabyte ZIPs.

## Failure and recovery states

The workspace surfaces Host-reported errors and recovery-required state. During a Google Drive outage the expected behavior is local backup preservation, prior remote restore-point preservation, server recovery/restart according to policy, and a later retryable upload.

If a destructive restore journal remains after a crash, do not bypass it in the browser. Keep Paper stopped and follow the Host Companion recovery procedure documented in the PlexonPanel repository before attempting another destructive operation.

## Permissions

The Dashboard only exposes actions for which both the device grant and the current agent capability agree. Host-only maintenance/provider scopes are not Paper capabilities. High-risk actions require the shared confirmation flow; restore remains Host Owner-only even if a custom role is accidentally granted the underlying backup restore scope.

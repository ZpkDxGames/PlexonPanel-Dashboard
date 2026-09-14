# Backups & Maintenance

The PlexonPanel Dashboard is an authenticated control and presentation surface. It does not execute backups, own countdown timers, hold Google Drive credentials, or decide recovery behavior.

The Linux PlexonPanel Host Companion is authoritative for the manual full-backup workflow: maintenance countdown state, player warnings through the Host-local Minecraft command channel, final `save-all flush`, systemd stop/start, cold archive creation, local verification, rclone/Google Drive upload and verification, retry/recovery state, durable job state, and audit.

The Paper plugin is not required to remain online for a manual full backup to complete.

## Step 5 architecture

PlexonPanel no longer presents live snapshots or automatic backup scheduling as supported product behavior.

The supported backup product is a manually requested **Full Restore Point**. It is a cold full-server ZIP created only after the Host proves that the configured Minecraft service/process is stopped. Persistent worlds, plugin state and server configuration are archived according to the Host's inclusion/exclusion policy, verified locally, and then uploaded/verified off-site when Google Drive is configured.

Legacy `backup.create` scope compatibility may remain in the protocol during migration, including as the grant used by `backup.full.retry-upload`, but the Dashboard does not expose `backup.create` as an operator action and does not present a live-snapshot button.

## Backups workspace

The **Backups** section exposes the Host-backed **Backups & Maintenance** workspace when the paired device and Host capabilities allow it. It shows:

- Host connection and backup readiness;
- local backup storage readiness;
- provider readiness and the last successful remote verification;
- current durable maintenance/backup phase;
- full restore-point inventory;
- local/off-site and verification state;
- retryable upload state;
- recovery-required state;
- restart-only schedule status;
- the explicit manual full-backup action.

The browser never owns the maintenance deadline. Refreshing, closing, or reconnecting the Dashboard does not cancel a Host job.

## Manual full-backup flow

The normal successful flow is:

1. operator explicitly requests a full restore point;
2. Host creates/persists the manual job;
3. Host runs the mandatory warning countdown;
4. Host sends maintenance warnings through its local Minecraft command channel;
5. Host executes and validates the final `save-all flush`;
6. Host gracefully stops the configured systemd unit;
7. Host proves the service/process is stopped;
8. Host creates the cold full-server archive;
9. Host verifies the local archive and metadata;
10. Host uploads to the configured Google Drive/rclone destination;
11. Host verifies the remote object;
12. Host starts Minecraft and verifies readiness;
13. Host records the completed result.

The Dashboard sends `maintenance.full-backup.create` without a browser-owned countdown-skip hint. Countdown enforcement is a Host safety invariant.

## Automatic backups retired

There is no recurring backup schedule in the Step 5 product.

The Dashboard therefore does not expose:

- live-snapshot intervals;
- a "next full restore point" calendar occurrence;
- automatic full-backup schedule editing;
- an automatic live-snapshot action.

Legacy full-backup schedule fields may still exist in the migration wire shape. When the Dashboard writes maintenance settings, it forces that legacy full-backup schedule disabled. The Host is the final authority and also rejects/ignores retired automatic backup behavior according to its migration policy.

Automatic **restart-only** scheduling remains a separate maintenance feature. A restart schedule cannot trigger a backup.

## Manual actions

Depending on granted scopes and Host capabilities, the workspace can expose:

- **Restart server**;
- **Create full restore point**;
- **Run backup diagnostics**;
- **Verify**;
- **Retry upload**;
- **Restore**;
- **Delete**;
- **Test Google Drive**.

Destructive actions pass through Dashboard confirmation, relay authorization, and Host capability/device checks. Full restore remains Host Owner-enforced and uses the server-name confirmation-token flow.

## Durable phases

The Dashboard presents Host-owned durable phases rather than Paper coordination phases. The maintenance state can include:

- `QUEUED`;
- `PREFLIGHT`;
- `COUNTDOWN`;
- `FINAL_SAVE`;
- `STOPPING_SERVER`;
- `WAITING_FOR_STOP`;
- `ARCHIVING`;
- `VERIFYING_LOCAL`;
- `UPLOADING_REMOTE`;
- `VERIFYING_REMOTE`;
- `STARTING_SERVER`;
- `VERIFYING_STARTUP`;
- `COMPLETED`.

Terminal degraded/failed results are surfaced through Host job/error state rather than invented client state.

## Google Drive / rclone

Google credentials never enter browser state. Configure rclone on the Linux host under the `plexonpanel-host` account and point the Host Companion at the protected Host-local rclone config.

The remote path is Host configuration, not a per-request browser argument. The Host uploads replacements through its staged/promotion policy, verifies the remote object, and does not destroy the previous known-good canonical object before the replacement is verified.

A failed cloud transfer does not invalidate the completed verified local restore point. The availability failure policy may restart Minecraft with a degraded off-site result and expose **Retry upload** for the existing local archive.

**Test Google Drive** performs a bounded Host-side provider check. The browser sees safe readiness/status information, never rclone credentials or arbitrary command arguments.

## Restore

A full restore uses the Host destructive-operation lock and confirmation flow. The Host verifies the selected restore point, creates an emergency pre-restore backup, uses staging/rollback protections, and optionally starts the service after replacement.

If a destructive recovery marker remains after a crash, do not bypass it in the browser. Follow the Host Companion recovery procedure before attempting another destructive operation.

## Permissions and compatibility

The Dashboard only exposes actions for which both the device grant and current agent capability agree. Host-only backup, maintenance and provider behavior is not delegated to Paper.

Retired protocol fields/scopes may temporarily remain where needed for rolling-upgrade compatibility, but they must not reactivate Paper backup coordination, live snapshots, or recurring backups. New operator behavior is manual-full-only and Host-authoritative.

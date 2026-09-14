# PlexonPanel Dashboard — Step 8 Backups & Maintenance

This release finalizes the production manual full-backup control surface for the matched PlexonPanel Host control plane while retaining signed Protocol 3 compatibility.

## Final operator experience

The Backups workspace now has one primary backup action: **Fully Backup Now**.

Automatic backups are retired. Full backup creation is manually initiated through **Fully Backup Now** and executed by the always-on Host Companion. Live-snapshot creation and automatic full-backup scheduling are not exposed as supported product behavior.

The Dashboard:

- automatically requests authoritative Host preflight state;
- blocks **Fully Backup Now** when the Host/device/service/RCON/storage/recovery state is not safe;
- requires an explicit destructive-maintenance confirmation;
- explains the mandatory 30-minute warning period, final `save-all flush`, cold shutdown, local verification, Google Drive/rclone upload/verification and automatic restart;
- reconstructs the current durable Host job after refresh/reconnect;
- displays Host-owned countdown fields rather than creating a browser-authoritative timer;
- matches live archive/upload progress to the current durable job ID before displaying it;
- shows local and remote verification state, safe error data, degraded state and recovery-required state;
- exposes **Retry Upload** for a verified local backup without another Minecraft shutdown;
- keeps restore as a separate destructive workflow;
- keeps restart-only scheduling as an independent maintenance feature.

Paper connection is informative only. The Paper plugin is not a prerequisite for the full-backup critical path.

## Supported restore-point actions

Depending on the current device grant and Host capabilities, the workspace exposes:

- **Verify**;
- **Retry Upload**;
- **Restore**;
- **Delete**;
- **Test Google Drive**.

Google Drive/rclone credentials and configuration contents remain Host-local and are never exposed to browser state.

## Matched Host behavior

The matched Host release owns:

- durable maintenance job state;
- warning countdown and Host-local RCON/player notices;
- affirmative final save requirement;
- systemd stop proof independent of Paper websocket state;
- cold `.partial` archive staging and local verification;
- SHA-256/metadata persistence;
- Google Drive/rclone staging, promotion and final verification;
- degraded/retry policy that preserves the local backup and previous known-good remote copy;
- mandatory Minecraft service recovery whenever the manual backup workflow stopped the service;
- Host-owned authorization mirror and journald console history inherited from Steps 6–7.

Legacy `restartAfter` may remain serialized for rolling-upgrade compatibility, but it is presented as **Required** and cannot disable automatic recovery after a manual full backup.

## Validation

Canonical Dashboard CI runs scope-contract validation, lint, TypeScript validation, relay build/tests, application tests, relay smoke checks, standalone relay packaging and a production Next.js build.

Repository CI is not production certification. Real VPS/systemd/RCON/rclone, browser reconnect and degraded-provider fault-injection gates must be recorded separately and must not be marked passed unless they were actually executed.

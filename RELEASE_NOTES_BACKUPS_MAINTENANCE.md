# PlexonPanel Dashboard — Backups & Maintenance

This release completes the Step 5 Dashboard and relay migration to Host-owned, manual-only full backups while keeping protocol generation 3.

## Highlights

- The active **Backups & Maintenance** workspace exposes manual **Create full restore point**, verify, retry upload, restore, delete, provider diagnostics, and independent restart controls.
- Live-snapshot creation and inventory presentation are retired.
- Automatic full-backup scheduling is retired. The Dashboard forces the legacy full-restore-point schedule disabled when maintenance settings are written.
- Restart-only scheduling remains independently configurable and cannot trigger a backup.
- `maintenance.full-backup.create` is sent without a browser-owned `skipCountdown` bypass. The Host owns the fixed warning countdown and final save safety gate.
- Backup readiness no longer depends on Paper connectivity. Paper is not responsible for warning delivery, final save, systemd lifecycle, archive creation, provider upload, or backup recovery.
- The operation timeline follows durable Host phases such as `PREFLIGHT`, `COUNTDOWN`, `FINAL_SAVE`, `STOPPING_SERVER`, `ARCHIVING`, `VERIFYING_LOCAL`, `VERIFYING_REMOTE`, and startup verification.
- Google Drive/rclone status remains visible without exposing Host credentials, configuration contents, or arbitrary provider command arguments.
- Full restore remains Owner-enforced and keeps the typed server-name confirmation-token flow.
- Responsive Backups-specific layout remains available without global interface scaling.

## Relay authority cleanup

The Worker and standalone relay no longer transport Paper backup/maintenance coordination between Host and Paper. Retired `backup.coordination`, `backup.coordination.result`, `maintenance.coordination`, and `maintenance.coordination.result` agent envelopes fail closed and are never forwarded.

Host backup, maintenance, provider, and server-lifecycle actions continue to route to the authenticated Host Companion. Paper remains authoritative only for Paper-owned game/runtime actions and access-authority refresh behavior.

## Matched Host behavior

The matched PlexonPanel Host release owns manual full-backup execution end to end: durable job state, provider preflight, Host-local Minecraft warning/flush commands, systemd stop proof, cold archive creation, local ZIP/SHA-256 verification, Google Drive/rclone promotion, degraded off-site handling, retry upload, restore journals, emergency pre-restore backups, restart recovery, and Host-local readiness verification.

A manual full backup can continue while the Paper plugin is disabled or disconnected. The historical `backup.create` protocol scope may remain for rolling-upgrade compatibility, but it is not presented as a live-snapshot operator action.

## Validation

Canonical Dashboard CI runs scope checks, lint, TypeScript validation, relay preparation/build/tests, application tests, and a production Next.js build. Production release certification still requires the matched Host runtime acceptance sequence: real player warnings, final save, verified stop/start, local archive/hash, Google Drive upload, Paper-disabled backup, Drive failure to `DEGRADED`, duplicate-run rejection, and provider-auth failure before countdown.

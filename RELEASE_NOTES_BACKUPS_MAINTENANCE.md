# PlexonPanel Dashboard — Backups & Maintenance

This release completes the production Backups workspace for the matched PlexonPanel maintenance control plane while keeping protocol generation 3.

## Highlights

- Replaced the presentation-only Backups scaffold with the real **Backups & Maintenance** workspace.
- Added persisted restart and full restore-point schedule editing backed by the Host Companion.
- Added next-run visibility, current maintenance phase, backup progress, backup inventory, verification state, local/off-site copy state, provider health, and recovery-required presentation.
- Added manual **Restart now**, **Create live snapshot**, **Create full restore point**, **Verify**, **Retry upload**, **Restore**, **Delete**, and **Test Google Drive** controls with capability gating.
- Added Google Drive/rclone status without exposing Host credentials, config contents, or arbitrary remote command arguments to the browser.
- Added typed server-name restore confirmation and retained the existing 64 MiB browser archive download ceiling.
- Added responsive Backups-specific layout for desktop and narrow workspaces without global interface scaling.
- Added synchronized browser/relay maintenance and provider scopes and high-risk confirmation coverage for derived destructive actions.

## Matched Host/Paper behavior

The Dashboard does not create archives or control systemd directly. The matched PlexonPanel Paper/Host release owns maintenance execution: Paper coordinates countdown/save flushing; Host owns calendar scheduling, cold full restore points, SHA-256 verification, local retention, rclone staging/promotion, retry upload, restore journals, emergency pre-restore backups, systemd lifecycle, and authenticated Paper reconnect checks.

Full restore remains Owner-enforced by the Host. Migrated installations keep destructive schedules disabled until explicitly configured.

## Validation

Canonical Dashboard CI runs lint, TypeScript validation, relay build/tests, application tests, relay smoke validation, and a production Next.js build. Production deployment must use the final merged `main` candidate and must not expose rclone/OAuth secrets.

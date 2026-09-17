# PlexonPanel Dashboard 3.5.0 — backup countdowns and restart controls

Dashboard 3.5.0 is the matched control-plane release for PlexonPanel 3.5.0. It keeps signed Protocol 3, `/v1`, existing server/device identities, immutable grants, and the Paper/Host authority split.

## Backup control room

- **Fully Backup Now** now offers validated 30-, 15-, 10-, and 5-minute initial player-countdown presets.
- Confirmation sends the selected `countdownSeconds` to the Host and does not depend on a browser-owned timer.
- The active-job timeline reconstructs the Host-persisted initial countdown, deadline, remaining time, phases, local verification, remote verification, and safe failure state after a refresh or reconnect.
- The primary surface explains the actual sequence: player notice, `save-all flush`, proven systemd stop, cold local archive verification, Google Drive promotion/verification, and automatic Minecraft recovery.
- Google Drive connectivity-test time and successful remote-backup verification time remain visibly distinct.
- Recovery acknowledgement now reads command-channel configuration from independent Host maintenance status, so a provider/storage/source preflight failure cannot falsely label RCON unconfigured or deadlock the recovery control.

## Automatic restart settings

- Restart warnings use the same 30/15/10/5-minute preset model.
- Daily, one-day weekly, and multiple selected-weekday schedules are supported by the editor.
- Shutdown and startup readiness timeouts are independently visible and bounded.
- Full backups remain manual-only. Automatic restart scheduling never creates a backup.

## Stable authority boundary

The stable Host runs with the live Minecraft server tree read-only. Direct server-tree restore is therefore not advertised in the active Dashboard. Verified backup history retains verify, retry-upload, delete, retention, and diagnostic controls. Compatibility scope metadata remains fail-closed for rolling upgrades, but it does not make a retired Host mutation available.

Browser actions now use the intersection of the immutable signed device grant decoded by the relay session endpoint and the live relay device record. They do not trust the editable metadata stored beside the browser token. If an older Owner credential predates `maintenance.run`, the Backups and Access pages report that re-pairing is required instead of advertising a control the relay will reject. Re-pairing issues the current Owner scope set; no existing signed grant is silently expanded.

The browser accepts the established Protocol 3 session response during a rolling Dashboard/relay deployment, where `deviceId` may be absent, while continuing to take role, scopes and expiry only from the relay-verified signed session. A response-contract mismatch is treated as an upstream deployment fault and no longer deletes a freshly issued credential or asks the operator to repeat pairing indefinitely.

The active action channel is now bound to the exact signed grant and WebSocket that produced the accepted `dashboard.ready` state. Stale connection callbacks cannot replace or clear a newer socket, and controls remain unavailable until the relay device record exactly matches the signed device ID, role, and scopes.

## Confirmation and relay reliability

Feature-specific destructive confirmations now satisfy the shared high-risk confirmation contract without prompting twice. Worker and standalone relay adapters also tolerate an authenticated empty Host console replay and the bounded console-source ordering race without tearing down the Host session.

## Validation state

Repository lint, TypeScript, Worker/standalone relay tests, browser/state/UI tests, and the production Next.js build are required before merge. Those checks are source evidence only. Production relay deployment and real Host/systemd/RCON/rclone backup acceptance remain separate gates and must not be inferred from CI.

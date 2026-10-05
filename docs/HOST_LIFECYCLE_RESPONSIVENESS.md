# Lifecycle results during long Host operations

The selected server's lifecycle controls retain an inline, accessible failure message after an action is rejected, even when the global notice is dismissed. `BUSY` for start/stop/restart explicitly means the request was rejected and will not run later; the operator should review Backups and refresh the actual service state. Other busy operations keep their existing guidance. The pending indicator says "Waiting for Host result" because routing/confirmation does not prove backend execution has begun.

On lifecycle failure, a fresh Host status request reconciles the displayed systemd state. Cancelled confirmations do not produce an error or dispatch another request. There is no automatic replay and no use of Paper connectivity to fabricate lifecycle state.

The companion Core change enables independent bounded lifecycle and status/audit workers only on Host. A stop conflicting with an active backup/upload returns promptly rather than sitting behind that upload. The existing operation locks, authentication, paired roles, scopes, capabilities, confirmation, audit and WSS contract remain authoritative. The Dashboard fix alone cannot remove queue blocking in an older Host JAR.

Automated acceptance includes a mounted Dashboard over the signed loopback relay: a confirmed busy stop is dispatched once for the selected server, remains visible inline after dismissing the notice, releases its controls, preserves online service state, and is not automatically replayed. Existing successful start/stop/restart, connection isolation and signed session tests remain required. This is DOM/transport integration with simulated agents, not live VPS/browser certification.

Deploy through the existing coordinated source acceptance and activation receipt process after both source PRs and their exact-main CI are accepted. Preserve the standalone VPS relay and current server states. Replacing a Host JAR requires a warned Host-only stop/start after active backup work finishes; Minecraft does not need to restart for this Host dispatch change. Installing a previously rejected Minecraft plugin is a separate planned Minecraft restart.

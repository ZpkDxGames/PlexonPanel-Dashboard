# Host console history authority

PlexonPanel treats the always-on Linux Host Companion as the sole authoritative server-console source.

## Authority split

- Host owns live server console capture from the configured Minecraft systemd unit.
- Host owns recent replay, retained-history queries, journald invocation boundaries, source health, and journal cursor continuity.
- Paper no longer acts as a fallback console-history source when Host is offline or unhealthy.
- Paper continues to own `console.execute`; command execution remains on the Bukkit/Paper path and retains its local command allowlist/capability rules.

A dashboard `ready` message therefore reports `consoleAuthority: "HOST"` even when `consoleSourceState` is `HOST_OFFLINE`, `STARTING`, `RECOVERING`, `JOURNAL_PERMISSION_DENIED`, or another degraded Host state. Source availability is not the same thing as source ownership.

## Historical queries

The dashboard routes retained-history reads explicitly to the Host agent:

- `console.history` -> `console.view.full`
- `console.history.errors` -> `console.view.errors`

The dashboard requests at most 100 lines at a time and uses the oldest currently known `capturedAt` timestamp as `before` when loading the preceding page. Severity filtering may be sent only as the bounded typed `levels` filter supported by Host. Error-only devices use the error history action and cannot broaden that action by requesting INFO lines.

History results are merged with live Host console lines using journal cursor/session sequence identities where available, so loading older pages does not create a second authority or duplicate obvious replay entries.

## Retention semantics

History is bounded by the VPS's `systemd-journald` retention. The dashboard must state this directly; it must not describe history as unlimited or imply that PlexonPanel keeps a separate durable copy of all console output.

If Paper is stopped while Host remains online, retained history can still be queried. If Host is offline, the dashboard keeps any already-rendered browser-local lines visible but labels the source unavailable and does not claim continuity from Paper data.

## Relay behavior

Both Cloudflare Worker and standalone relay adapters:

- accept Host `console.source` and `console.lines` only from the authenticated pinned Host identity;
- keep existing per-device console scope filtering;
- expose `consoleAuthority: "HOST"` unconditionally as the architecture owner;
- expose Host health separately through `consoleSourceState`;
- never instruct Paper to start/stop console capture;
- continue rejecting attempts to route `console.execute` through Host.

## Runtime certification

Repository CI can verify types, scope parity, relay behavior and dashboard contracts. Final runtime certification still requires a real Host/Paper installation to prove:

1. stop Paper while leaving Host online and browse retained journald history;
2. start Paper and observe new Host console output continue in the same UI;
3. restart Host and verify cursor/recent replay does not flood duplicates;
4. verify the Host service identity cannot query unrelated system units through PlexonPanel;
5. confirm the UI accurately reflects the VPS's actual journald retention window.

# Host console history authority

PlexonPanel treats the Linux Host Companion as the preferred live source and sole retained-history authority.

## Authority split

- Host owns preferred live server console capture from the configured Minecraft systemd unit.
- Host owns recent replay, retained-history queries, journald invocation boundaries, source health, and journal cursor continuity.
- Paper can publish only bounded, redacted, live-only fallback lines when Host is offline or unhealthy and local Paper policy enables fallback. It never answers retained-history queries.
- Paper continues to own `console.execute`; command execution remains on the Bukkit/Paper path and retains its local command allowlist/capability rules.

A dashboard `ready` message reports `consoleAuthority: "HOST"`, `"PAPER_FALLBACK"`, or `"UNAVAILABLE"`. `consoleSourceState` reports the Host state or `PAPER_FALLBACK_ACTIVE`, so source transitions are visible rather than inferred from stale lines.

## Historical queries

The dashboard routes retained-history reads explicitly to the Host agent:

- `console.history` -> `console.view.full`
- `console.history.errors` -> `console.view.errors`

The dashboard requests at most 100 lines at a time and uses the oldest currently known `capturedAt` timestamp as `before` when loading the preceding page. Severity filtering may be sent only as the bounded typed `levels` filter supported by Host. Error-only devices use the error history action and cannot broaden that action by requesting INFO lines.

History results are merged with live Host console lines using journal cursor/session sequence identities where available, so loading older pages does not create a second authority or duplicate obvious replay entries.

## Retention semantics

History is bounded by the VPS's `systemd-journald` retention. The dashboard must state this directly; it must not describe history as unlimited or imply that PlexonPanel keeps a separate durable copy of all console output.

If Paper is stopped while Host remains online, retained history can still be queried. If Host is offline, the dashboard keeps any already-rendered lines visible and may receive new Paper fallback lines, but it does not claim those lines are retained journal history.

## Relay behavior

Both Cloudflare Worker and standalone relay adapters:

- accept Host `console.source` and `console.lines` only from the authenticated pinned Host identity;
- keep existing per-device console scope filtering;
- prefer healthy Host authority, otherwise expose `PAPER_FALLBACK` only when the authenticated Paper capability permits it, and otherwise expose `UNAVAILABLE`;
- expose Host health separately through `consoleSourceState`;
- send signed `console.authority` transitions to suppress or resume Paper fallback output;
- continue rejecting attempts to route `console.execute` through Host.

## Runtime certification

Repository CI can verify types, scope parity, relay behavior and dashboard contracts. Final runtime certification still requires a real Host/Paper installation to prove:

1. stop Paper while leaving Host online and browse retained journald history;
2. start Paper and observe new Host console output continue in the same UI;
3. restart Host and verify cursor/recent replay does not flood duplicates;
4. stop/degrade Host and verify bounded Paper fallback starts without replaying Host-owned lines;
5. restore Host and verify Paper output is suppressed without duplicates;
6. verify the Host service identity cannot query unrelated system units through PlexonPanel;
7. confirm the UI accurately reflects the VPS's actual journald retention window.

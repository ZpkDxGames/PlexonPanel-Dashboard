# Dashboard telemetry timing and ordering

The connection warning previously compared arriving telemetry against browser time stored by a
five-second component timer. A healthy sample captured on a VPS about two seconds ahead of the
browser could exceed the five-second future-clock limit relative to that old timer value. The
warning then disappeared at the next timer tick. Hidden tabs could stretch the same discrepancy.
This is a reproduced Dashboard defect; it does not prove the cause of every production outage.

Connection pills, the selected-server warning, stream freshness, and fleet cards now share one
one-second browser clock. It pauses periodic updates while hidden and updates immediately when
visible again. Its time is never earlier than the latest accepted packet's browser receipt time.
Receipt time advances the comparison clock; it does not make an old sample fresh. Capture time
still controls freshness, including the existing 30-second stale threshold and five-second
future-clock tolerance.

A newly authenticated Paper session waits up to 30 seconds for its first Minecraft sample.
Repeated ready messages do not restart that deadline. An agent reconnect or instance switch
clears prior-session samples; stored history cannot establish live freshness.

Within an agent session, older captures cannot replace newer Minecraft, Paper-system, Host-system,
or systemd service samples. Invalid captures cannot erase an existing valid sample. Equal capture
timestamps can still update an existing chart point. Telemetry stays bound to its selected server,
agent role, and authenticated session. Host traffic cannot hide a missing Minecraft sample.

The Core defaults remain unchanged: Paper server snapshots every 40 ticks, Host system telemetry
every 250 milliseconds, and service snapshots every five seconds. No packet-rate increase,
authentication, permission, pairing, relay, or WSS change is needed for this Dashboard fix.

## Validation and deployment

The mounted React regression freezes the clock timer while delivering fresh packets with a
2.274-second source offset. It checks stable online status, a single shared timer, foreground
recovery, a real telemetry outage, independent Host freshness, and timer cleanup. Model tests
cover first-session waiting, its nonrenewable deadline, cached-session clearing, ordering, role,
session, and instance boundaries. The existing signed two-server socket flow remains required.

Run `npm run check` and `npm run build`. After source review and merge, use the existing coordinated
Dashboard activation process against the exact merged source and successful main CI. This source
PR does not authorize a receipt update or production deployment. Deployment is Dashboard-only;
it requires no Minecraft/Host restart or replacement and preserves the VPS standalone relay.

Production verification remains separate: watch the selected server and fleet selector, switch
between paired servers, background/foreground the tab, and confirm that fresh samples remain
stable while real disconnects or sample loss remain visible. Schedule any intentional Minecraft
stop independently; this UI fix requires no shutdown.

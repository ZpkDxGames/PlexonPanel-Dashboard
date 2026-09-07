# Dashboard 3.0.1 Operations Addendum

This addendum covers operational behavior introduced or clarified by Dashboard 3.0.1. Existing protocol-3 security, pairing, relay, Paper policy and Host policy procedures remain authoritative.

## Source cadence versus browser display cadence

Paper and Host telemetry families do not share one source interval. In the 3.0.1 full-control deployment, Paper health and Host machine telemetry may arrive at approximately 250 ms, Paper JVM/process data is typically slower, and Host systemd status is intentionally slower still.

The Settings → Browser data behavior → Display update rate control is presentation-only. It never edits agent config or relay policy.

- Realtime: paint every accepted presentation sample.
- Fast: at most every 250 ms.
- Balanced: at most every 500 ms.
- Relaxed: at most every 1 second.
- Low activity: at most every 2 seconds.

If an operator selects a slower display cadence, the browser still validates and reconciles authoritative source messages immediately. Connection, lifecycle, presence, console/chat operation batches and action feedback are not intentionally delayed behind the telemetry paint cadence.

## Interpreting CPU and memory

**Host CPU / Machine CPU** is Linux machine-wide utilization. It can include Paper, remote-development tooling, the Host companion and unrelated system processes.

**Paper process CPU** is the Paper server process metric and must be interpreted separately.

**Host memory used** is machine memory usage from the Host authority. **JVM heap used** is Paper JVM heap usage. The dashboard does not substitute these metrics when one authority is disconnected.

## Partial connectivity

Paper and Host can remain useful independently.

When Paper is connected and Host is disconnected, continue to use Paper telemetry, players, console/chat and Paper-owned plugin data. Host machine telemetry and lifecycle controls are unavailable.

When Host is connected and Paper is disconnected, Host machine telemetry and systemd lifecycle state remain useful. Do not interpret missing Paper telemetry as a Host failure.

Relay/browser connectivity is a third state and is displayed independently.

## Lifecycle operations

Systemd status, Start, Stop and Restart are Host-owned. The Server page no longer falls back to Paper for `server.status`, and Paper connectivity is not used to fabricate an active service state.

For high-risk Stop/Restart operations, confirmation remains required. Treat the action result and subsequent Host/Paper state as separate signals: an accepted action request is not a replacement for authoritative lifecycle telemetry.

Host service status normally updates more slowly than Host CPU/memory. Do not diagnose service state as stale merely because it does not publish every 250 ms.

## Player roster and history

Paper presence deltas are immediate and then reconciled by bounded authoritative roster snapshots. A newly joined player can appear before the next full snapshot; a later snapshot may correct the browser if required.

Current-player UI can show Paper-supplied session and status details. Location/address data is conditional on local policy and grant. When it is not supplied, the dashboard omits the field rather than inferring it.

Player history remains Paper-owned, scope-gated and avatar-free. Existing grants are immutable; newly introduced scopes may require an explicitly approved re-pair.

## Remote player heads

The default provider is:

```text
https://mc-heads.net/avatar/{uuid}/{size}
```

Deployment behavior:

- env unset or blank → built-in provider;
- valid custom `NEXT_PUBLIC_PLEXON_PLAYER_HEAD_URL_TEMPLATE` → custom provider;
- exact `disabled` → no remote heads;
- invalid nonblank template → fail closed.

Remote heads are cosmetic. Failure does not affect player roster availability. Browser requests expose the viewer's network address and requested online-player UUID to the selected third-party provider; historical/offline rows intentionally avoid these requests.

## Performance troubleshooting

If Performance feels too busy on a low-power client, first choose Balanced, Relaxed or Low activity. This reduces React/chart presentation frequency without asking Paper/Host to collect less data.

If a 30-minute chart contains many high-frequency source samples, statistics/export use the bounded raw history while SVG paths use a separate extrema-preserving render reduction. Do not interpret the number of rendered SVG vertices as the number of source samples retained for statistics.

If source metadata is missing because an older agent is connected, the dashboard may show the source owner without a numeric source interval. Do not assume 250 ms unless the source actually advertises or the deployment is otherwise known to provide it.

## Release validation

Before production promotion, use `docs/VALIDATION_3.0.1.md`. CI and relay smoke are necessary but do not replace real Paper/Host cadence, avatar, partial-connectivity, responsive/zoom and browser-CPU checks.

# PlexonPanel Dashboard 3.4.1 — Paper/Host Control Room

PlexonPanel Dashboard is a responsive Next.js/Vercel control room for signed Protocol 3 PlexonPanel Paper and Host agents. Dashboard 3.4.1 preserves existing identity, pairing, immutable device grants, local Paper/Host policy authority, confirmation rules, and `/v1` transport while using the Host Companion as the durable authority for Linux console history, lifecycle, maintenance and manual full backups.

## Control Room 3.4.1

Active pages include Overview, Performance, Players, Console, Chat, Plugins, Server, Backups, Audit, Access, and Settings. Files remain a dormant backend-compatible surface rather than a first-class page.

Paper and Host remain independent authority domains. Paper owns Paper/JVM/player/plugin state, chat, pairing/device synchronization, and remote console command execution. Host owns Linux machine telemetry, systemd lifecycle, Host files/manual backups/maintenance, the durable authorization mirror, and the authoritative read-only server console stream/history through its locally configured journald source.

Host CPU is always machine-wide Host CPU. Paper process CPU remains a separate JVM/process metric. The UI does not substitute one for the other.

## Host-authoritative console

PlexonPanel publishes the real configured Minecraft systemd-unit journald stream from the Host Companion.

- The Host Companion is the sole authority for live console capture, replay, invocation boundaries, and retained history.
- Host source health is reported separately; an offline or degraded Host does not transfer console authority to Paper.
- Paper no longer tails `latest.log` as a fallback console producer.
- `console.execute` remains Paper-only in both Worker and standalone relay runtimes.
- Host output and retained history can remain available while Paper is offline; command entry remains unavailable until Paper reconnects.
- Existing device scopes continue to control full/error-only console visibility.
- Historical pages are bounded to 100 lines and are limited by the VPS's actual `systemd-journald` retention.

The browser keeps a bounded 2,500-line live/history presentation buffer and a smaller bounded safe cache. Journal/session identifiers provide strong duplicate suppression when available. Invocation changes are rendered as startup/session separators. Loading older history explicitly queries the Host and does not create a second console authority.

Pause, copy, export, search, filtering and clear remain local browser operations. Clearing the view does not delete journald or Minecraft logs, and pausing does not stop relay delivery.

See [Host console history authority](docs/CONSOLE_HISTORY_AUTHORITY.md) for retention, security, and runtime-certification semantics.

## Worker and standalone relay

The canonical repository contains both relay runtimes.

- Cloudflare Worker remains supported through `relay/wrangler.jsonc`.
- Standalone Node relay includes loopback-first configuration, bounded coordination persistence, service/env examples, packaging and smoke validation.
- The accepted pre-3.4 Worker and standalone relay cores are kept as explicit core source units; authority adapters add Host console and maintenance handling without rewriting unrelated pairing/access behavior.
- Both runtimes enforce the same scopes, Host source validation, ready-state authority metadata, replay/signature protections, Host-only console viewing/history, and Paper-only command routing.

See [standalone relay migration](docs/STANDALONE_RELAY_MIGRATION.md) and [3.4.0 console release notes](RELEASE_NOTES_3.4.0.md).

## Fast telemetry and display update rate

Authoritative accepted state and displayed React state remain separate. The browser-local Display update rate controls presentation cadence only:

- Realtime — `0 ms`
- Fast — `250 ms`
- Balanced — `500 ms` and the default
- Relaxed — `1000 ms`
- Low activity — `2000 ms`

Connection/ready state, player presence deltas, console/chat batches, service state, backup progress and action results remain operational state and bypass presentation throttling where required.

## Performance workspace

Performance charts use trusted source `capturedAt` timestamps when supplied and retain bounded browser-local history. Exact duplicate timestamps replace existing samples rather than growing history.

Primary charts remain TPS, MSPT, Host CPU, Paper process CPU, Host memory used, and JVM heap used. Missing data stays unavailable rather than being synthesized. SVG rendering is separately thinned with an extrema-preserving bounded representation so high-frequency telemetry does not create unbounded DOM/path work.

## Players

Current-player data remains Paper-owned. Location/address are shown only when authorized and actually supplied. Join/quit deltas reconcile against later authoritative roster snapshots, and player history requires both immutable `players.history.view` scope and current Paper capability.

Player actions remain the intersection of exact device scope, Paper connection, Paper capability, local policy, action requirements, confirmation requirements, and Owner-only rules where applicable. Disabled browser controls are convenience only; Paper remains the security authority.

## Backups and lifecycle

The Server workspace is Host-authoritative for systemd status and lifecycle actions. Paper connectivity is reported separately and never fabricates an active service state.

Backups & Maintenance is a Host-authoritative **manual full-backup** control surface. Automatic backups and live-snapshot creation are retired product behavior. The primary action is **Fully Backup Now**.

The Dashboard automatically presents Host preflight and blocks the action when the authoritative Host/device/service/RCON/storage/recovery state is not safe. Explicit confirmation explains the mandatory 30-minute warning period, affirmative `save-all flush`, systemd stop proof, cold archive/local verification, Google Drive/rclone staging and verification, and automatic Minecraft restart.

The backup job is durable on the Host. Closing, refreshing or reconnecting the browser does not cancel it; the Backups workspace reconstructs the current operation through Host status and displays Host-owned countdown fields. Live archive/upload progress is accepted only when its job ID matches the current durable job.

If a verified local restore point survives a bounded Google Drive failure, Minecraft availability is restored and the operation can become degraded/retryable. **Retry Upload** reuses the local archive without another Minecraft shutdown. Restore remains a separate destructive workflow.

Restart-only scheduling remains supported independently. It cannot schedule or implicitly create a full backup.

Google Drive/rclone credentials remain Host-local and are never exposed to the browser.

See [Backups & Maintenance documentation](docs/BACKUPS_MAINTENANCE.md) and [Step 8 backup release notes](RELEASE_NOTES_BACKUPS_MAINTENANCE.md).

## Access, audit and storage

Effective permission is always the intersection of immutable device scope, connected agent kind, agent-advertised capability, local policy, action-specific rules, and confirmation requirements. The browser never invents capabilities to make a control available.

The relay stores only bounded coordination state required by the architecture. Player inventories, presence bodies, telemetry, file contents, console/chat contents and action results are not introduced as durable relay application data.

Audit and diagnostics must not expose access tokens, pairing codes, private keys, provider credentials, or unredacted sensitive command/log content.

## Development and validation

Use Node 24 and the committed dependency lock:

```sh
npm ci
npm run check
npm run relay:smoke
npm run relay:standalone:smoke
npm run relay:standalone:package
npm run build
```

`npm run check` runs ESLint, application and relay TypeScript checks, Worker/standalone relay tests, browser/state/UI tests, and the production-oriented test build. Smoke checks exercise local relay behavior; they are not substitutes for live Paper/Host acceptance.

Configure the public relay origin in `.env.local`:

```dotenv
NEXT_PUBLIC_PLEXON_RELAY_URL=https://YOUR-RELAY.workers.dev
# Optional. Leave unset for built-in MCHeads; set to disabled to forbid remote heads.
NEXT_PUBLIC_PLEXON_PLAYER_HEAD_URL_TEMPLATE=
```

Never place access tokens, relay signing keys, Paper/Host private keys, pairing secrets, server credentials, or reusable provider secrets in `NEXT_PUBLIC_*` variables.

## Compatibility and deployment

Dashboard 3.4.1 remains on signed Protocol 3 and `/v1`. Existing credentials do not gain scopes automatically, and the release does not require a Protocol 4 migration, identity reset, or automatic re-pair.

A passing repository CI run and Vercel preview are required source/presentation evidence but are not live PlexonCraft certification. Runtime acceptance still includes real Host journald readability, Paper-stopped history browsing, startup/shutdown capture, Host restart/cursor recovery, systemd/RCON/rclone readiness, a real **Fully Backup Now** operation, browser reconnect during that operation, and controlled degraded/retry behavior. A gate that was not actually executed must not be reported as passed.

Read [3.4.0 console release notes](RELEASE_NOTES_3.4.0.md), [Step 8 backup release notes](RELEASE_NOTES_BACKUPS_MAINTENANCE.md), [protocol](docs/PROTOCOL.md), [architecture](docs/ARCHITECTURE.md), [operations](docs/OPERATIONS.md), [security](docs/SECURITY.md), [deployment](docs/VERCEL_DEPLOYMENT.md), and [validation](docs/VALIDATION.md).

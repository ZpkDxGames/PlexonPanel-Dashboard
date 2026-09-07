# PlexonPanel Dashboard 3.0.1 — Paper/Host Control Room

PlexonPanel Dashboard is a responsive Next.js/Vercel control room for signed protocol-3 PlexonPanel Paper and Host agents. Dashboard 3.0.1 is an integration and UX-correctness release: it keeps the existing wire protocol, relay authentication, immutable device grants, local Paper/Host policy authority, device identity pins, and confirmation model while making the browser accurately present the faster 3.0.1 agent data.

## Control Room 3.0.1

- Active pages remain Overview, Performance, Players, Console, Chat, Plugins, Server, Audit, Access, and Settings.
- Files and Backups are intentionally not first-class dashboard pages in 3.0.1. Their backend compatibility remains available for future or operation-specific use.
- Paper and Host are independent authority domains. Paper owns Paper/JVM/player/console/plugin state; Host owns Linux machine telemetry and systemd lifecycle state.
- Host CPU is always machine-wide Host CPU. Paper process CPU is always the Paper process metric. The UI does not substitute one for the other.
- Responsive composition uses Grid/Flexbox, intrinsic sizing, container queries, dynamic viewport units, safe-area insets, and local semantic overflow. The dashboard does not globally scale a desktop UI to fit smaller windows.
- Dialogs and confirmation surfaces use viewport-centered top-layer geometry and remain independent of sidebar width and document scroll.

## Fast telemetry and Display update rate

PlexonPanel 3.0.1 agents can publish different data families at different source cadences. A typical full-control deployment provides Paper health and Host machine telemetry at approximately 250 ms, Paper JVM/process data around 1 second, and Host service status at a slower bounded cadence.

Dashboard keeps two conceptual layers:

1. **Authoritative live state** receives and validates every accepted message immediately.
2. **Displayed state** is committed to React at the browser-selected Display update rate.

The browser-local **Display update rate** options are:

- Realtime — commit each accepted presentation update (`0 ms`)
- Fast — no faster than `250 ms`
- Balanced — no faster than `500 ms` and the default
- Relaxed — no faster than `1000 ms`
- Low activity — no faster than `2000 ms`

The setting changes presentation only. It does not mutate Paper configuration, Host configuration, relay state, or server policy, and different paired browsers may use different rates simultaneously.

Operational state that must remain immediate bypasses this presentation throttle, including connection/ready state, player presence deltas, console/chat stream batches, lifecycle/service state, backup progress when surfaced, and action results. Changing the display rate takes effect without reconnecting the WebSocket.

## Performance workspace

Performance charts use trusted source `capturedAt` timestamps when supplied and retain bounded browser-local high-frequency history. Exact duplicate source timestamps replace the existing sample rather than growing history.

Primary charts are:

- TPS — Paper
- MSPT — Paper
- Host CPU — Linux machine-wide Host telemetry
- Paper process CPU — Paper JVM/process telemetry
- Host memory used — Host
- JVM heap used — Paper

Each chart shows current, minimum, average, maximum and P95 values when available, plus source ownership, detected source interval when explicitly advertised, browser display cadence, sample age, and live/paused/disconnected state.

Raw history is used for statistics and export. SVG rendering is separately thinned with an extrema-preserving bounded representation so a 250 ms source cadence does not create unbounded path/DOM work. Missing samples remain gaps; the UI does not interpolate fake telemetry.

## Minecraft player heads

Current online players use a built-in public HTTPS provider by default:

```text
https://mc-heads.net/avatar/{uuid}/{size}
```

A deployment may override it with:

```dotenv
NEXT_PUBLIC_PLEXON_PLAYER_HEAD_URL_TEMPLATE=https://approved-avatar.example/avatar/{uuid}/{size}
```

Set the value exactly to `disabled` to disable remote heads deployment-wide. Blank/unset uses the built-in provider.

Templates are validated fail-closed. Production requires HTTPS, exactly one `{uuid}`, at most one optional `{size}`, no credentials, no fragments, no unknown placeholders, and one exact provider origin for CSP. Player-head requests use `referrerPolicy="no-referrer"`, lazy loading, async decoding, normal browser caching, and never proxy or persist avatar images through the relay.

The roster always renders a deterministic local fallback immediately. Provider failure, invalid UUID, timeout/error, disabled deployment state, or CSP rejection never blocks or shifts the player row. Remote heads are used for current-player UI only; historical/offline history stays avatar-free.

## Players

The online roster can present the 3.0.1 Paper fields when supplied, including name/display name, UUID according to browser preference, world, game mode, ping, health/max health, food, experience level, operator state, whitelist state, online duration, session ID/start, first seen, and last login.

Location and address are shown only when the agent actually supplies them under locally authorized policy. The dashboard omits those details rather than fabricating `unknown` values.

Join/quit presence deltas bypass the telemetry presentation throttle and reconcile against later authoritative roster snapshots. The Live row highlight preference applies only to recently changed current-player rows rather than every online player.

History appears only when both the immutable device grant and current Paper capability contain `players.history.view`. Existing credentials never acquire newly introduced scopes automatically; where re-pairing is needed, the UI says so. Historical player drawers remain read-only and do not fetch remote avatars.

Player actions remain the intersection of exact device scope, Paper connection, Paper-advertised capability, local policy, action requirements, and Owner-only rules where applicable. Disabled controls are convenience only; Paper remains the security authority.

## Overview and lifecycle

Overview independently reports browser/relay connection, Paper connection, Host connection, TPS/MSPT, Paper process CPU/JVM heap, Host CPU/memory when Host is connected, player count, and telemetry freshness. A Host disconnect does not erase valid Paper state, and a Paper disconnect does not make an authenticated Host appear offline.

The Server page is strictly Host-authoritative for systemd status and lifecycle actions. Start, stop, restart and status are unavailable when Host is absent even if Paper is connected. Paper connectivity is shown separately and is never used to fabricate an `active` service state.

Stop/restart remain confirmation-gated. Service/lifecycle messages bypass display throttling, and a returned button/request acknowledgement is not treated as synthetic telemetry.

## Console, Chat, Plugins, Access and Audit

Console and Chat remain operational streams rather than chart telemetry. Their authorized batches and action feedback remain near-live even when the browser display rate is Relaxed or Low activity.

Plugin inventory remains Paper-owned. Reload controls must satisfy the device scope, Paper capability, and a verified local reload mapping; the dashboard does not implement generic Bukkit/Paper `/reload` behavior merely because console execution exists.

Access keeps immutable device grants visible through grouped capability states. Audit remains a compact scan-first operational timeline and must not expose tokens, pairing codes, private keys or unredacted sensitive command data.

## Settings

Settings is a browser presentation control center. Browser-local groups include:

- Appearance: theme, accent, contrast, density, text scale, motion, live pulse and page transitions
- Charts: window, style, grid and layout
- Players: skin heads, head size, UUID display, mobile roster layout and live row highlight
- Browser data behavior: Display update rate

Player-head provider status is shown as built-in, custom deployment provider, disabled by deployment, or invalid configuration without exposing unnecessary provider URL detail.

## Authority and storage

The effective action permission is always the intersection of the immutable device grant/scopes, connected agent kind, agent-advertised capability, local Paper/Host policy, action-specific rules, and confirmation requirements. The browser never invents capabilities to make a control appear available.

The relay verifies protocol-3 identity and routing and stores only coordination data required by the existing architecture. Player inventories, presence bodies, history results, telemetry, file bodies, console/chat bodies and action results are not introduced as relay-persisted Dashboard 3.0.1 data.

Browser preferences cannot grant a scope, change local policy, alter authoritative source cadence, or weaken agent-side authorization.

## Development and validation

Use Node 24 and the committed dependency lock:

```sh
npm ci
npm run check
npm run relay:smoke
npm run build
```

`npm run check` runs ESLint, application and relay TypeScript checks, relay tests, browser/state/UI tests, and the production-oriented test build. `relay:smoke` exercises the relay with temporary local workerd state; it is not a substitute for live Paper/Host acceptance.

Configure the public relay origin in `.env.local`:

```dotenv
NEXT_PUBLIC_PLEXON_RELAY_URL=https://YOUR-RELAY.workers.dev
# Optional. Leave unset for built-in MCHeads; set to disabled to forbid remote heads.
NEXT_PUBLIC_PLEXON_PLAYER_HEAD_URL_TEMPLATE=
```

Never place access tokens, relay signing keys, Paper/Host private keys, pairing secrets, server credentials, or reusable provider secrets in `NEXT_PUBLIC_*` variables.

## Compatibility and deployment

Dashboard 3.0.1 remains on signed wire protocol 3 and `/v1`. Older 3.0 agents may omit the new telemetry metadata, emit slower samples, lack player-history/session fields, or provide no fast Host cadence; parsing remains optional and fails safely rather than crashing the dashboard.

A passing CI build is necessary but not sufficient for production deployment. Live PlexonCraft acceptance still includes Realtime/250/500/1000/2000 ms cadence checks, lifecycle immediacy, real-player head/fallback checks, partial Paper/Host failure states, browser CPU observation, viewport checks at the documented desktop/tablet/mobile sizes, and browser zoom at 80/100/125/150%.

Read [3.0.1 release notes](RELEASE_NOTES_3.0.1.md), [protocol](docs/PROTOCOL.md), [architecture](docs/ARCHITECTURE.md), [operations](docs/OPERATIONS.md), [security](docs/SECURITY.md), [deployment](docs/VERCEL_DEPLOYMENT.md), and [validation](docs/VALIDATION.md).

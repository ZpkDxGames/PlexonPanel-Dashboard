# PlexonPanel Dashboard 2.3.0

PlexonPanel Dashboard is a responsive Next.js/Vercel control room for signed protocol-3 PlexonPanel Paper and Host agents. Dashboard 2.3.0 is a dashboard-first visual-experience release for the existing PlexonPanel 3.0.0 agent bundle: it adds browser-local appearance preferences, richer native SVG telemetry, responsive player presentation, and optional Minecraft skin heads without changing protocol 3, `/v1`, agent identities, grants, or relay storage.

## Visual experience in 2.3

- System, Dark, and Light themes with curated Cyan, Violet, Emerald, and Amber accents.
- System/Standard/High contrast, Compact/Comfortable/Spacious density, and 100%/112.5%/125% text scales.
- One strict versioned browser-local preference record for presentation. Existing density and performance-window choices migrate without touching credentials or server workspaces.
- Full, Reduced, and Off motion profiles. OS/browser reduced-motion remains a safety floor.
- Responsive player cards on mobile, a desktop table, configurable UUID display, optional live-row emphasis, and a 64px identity head in the current-player drawer.
- Native SVG performance charts retain raw samples, visible gaps, exact min/max/average/p95 summaries, keyboard inspection, threshold/reference cues, line/area presentation, 1/5/15/30-minute windows, Pause/Resume presentation, and raw CSV/JSON export.
- Overview sparklines surface TPS/MSPT health, CPU, memory/heap, and online-player count without replacing the full Performance workspace.

## Optional Minecraft player heads

Remote player heads are **disabled by default** unless deployment provides one public, non-secret URL template:

```dotenv
NEXT_PUBLIC_PLEXON_PLAYER_HEAD_URL_TEMPLATE=https://approved-avatar.example/avatar/{uuid}?size={size}&overlay=1
```

The template is strictly validated. Production requires HTTPS and exactly one `{uuid}` placeholder; `{size}` is optional and requested sizes are allowlisted. Credentials, user-info, fragments, arbitrary schemes, wildcard CSP image origins, and custom browser-entered avatar URLs are rejected.

When enabled, the dashboard reserves the final image dimensions, renders a deterministic local fallback immediately, lazy-loads/async-decodes the remote image, uses `referrerPolicy="no-referrer"`, and fails back quietly for the current page session. The roster never waits for an image. Player-history rows intentionally do **not** request remote heads.

A third-party avatar provider can observe the viewer's network address and requested player UUIDs. Heads are cosmetic and can be disabled in Appearance & behavior. No avatar image, player-history result, or new telemetry database is stored in the relay.

## Player presence and history

The Online roster applies immediate Paper `players.presence` deltas, de-duplicates event/session identity, and reconciles only after a complete multipart `inventory.players` snapshot. Socket or authenticated Paper-session changes clear stale online state; cached browser data never presents players as authoritatively online.

History appears only when both the immutable device grant and current Paper capability contain `players.history.view`. Queries are strict, newest-first, cursor-paginated, bounded, served by Paper's local journal, kept in current memory, and excluded from persistent browser cache. Existing credentials never gain a new scope automatically and Owner cannot bypass disabled local Paper policy.

## Authority and storage

The relay verifies current scope/capability, validates routed data, keeps action results private to the requesting device, and stores identity/access/pairing coordination only. Player inventories, presence bodies, detailed history, telemetry, file bodies, console/chat bodies, and action results are not added to Durable Object storage by Dashboard 2.3.0.

Browser credentials remain bound to audience, protocol, server/device IDs, immutable role/scopes, generation, and expiry. Relay and executing agent independently authorize actions. Appearance settings cannot grant a scope, enable a local capability, change Paper retention, or alter authoritative telemetry cadence.

## Development

Use Node 24 and the committed lockfile:

```sh
npm ci
npm run check
npm run relay:smoke
npm run build
```

`npm run check` runs ESLint, application and relay TypeScript, relay tests, client/state/UI tests, and production-build checks used by the project. `relay:smoke` uses temporary workerd storage and ephemeral keys; it is not a production deployment or live Paper acceptance gate.

Configure the public relay origin in `.env.local`:

```dotenv
NEXT_PUBLIC_PLEXON_RELAY_URL=https://YOUR-RELAY.workers.dev
NEXT_PUBLIC_PLEXON_PLAYER_HEAD_URL_TEMPLATE=
```

Leave the head template blank to make no avatar-provider requests. Never place access tokens, relay signing keys, Paper/Host private keys, pairing secrets, server credentials, or reusable provider secrets in `NEXT_PUBLIC_*`.

## Compatibility and deployment

Dashboard 2.3.0 remains compatible with PlexonPanel agent bundle 3.0.0 on wire protocol 3 and `/v1`. Preserve the existing relay signing identity, Durable Object namespace, agent identity pins, device grants, and production CSP policy. A configured avatar origin changes the dashboard `img-src`, so changing the template requires a dashboard rebuild and normal deployment review.

This repository does not treat a passing CI build as authorization to deploy. Production, accessibility, browser, viewport, failure-state, and disposable-live-server gates are documented separately.

Read [2.3.0 release notes](RELEASE_NOTES_2.3.0.md), [protocol](docs/PROTOCOL.md), [architecture](docs/ARCHITECTURE.md), [operations](docs/OPERATIONS.md), [security](docs/SECURITY.md), [deployment](docs/VERCEL_DEPLOYMENT.md), and [validation](docs/VALIDATION.md).

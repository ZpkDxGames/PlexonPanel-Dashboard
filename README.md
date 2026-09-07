# PlexonPanel Dashboard 3.0.0 — Control Room

PlexonPanel Dashboard is a responsive Next.js/Vercel control room for signed protocol-3 PlexonPanel Paper and Host agents. Dashboard 3.0.0 is a presentation-architecture and interaction-quality release: it keeps the existing protocol, relay routing, immutable device grants, local capability authority, and signed Paper/Host identity model while rebuilding the active dashboard around true adaptive composition.

## Control Room 3.0

- A consolidated dark operations-console visual language with Plexon cyan as the default accent, restrained depth, semantic status surfaces, and coherent motion tokens.
- Responsive composition uses Grid/Flexbox, intrinsic sizing, container queries, dynamic viewport units, safe-area insets, and local semantic overflow. Dashboard 3.0 does **not** globally scale a desktop UI to fit smaller windows.
- The active page set is Overview, Performance, Players, Console, Chat, Plugins, Server, Audit, Access, and Settings.
- **Files and Backups are intentionally not exposed as dashboard pages in 3.0.** Their protocol scopes and backend compatibility remain dormant for future restoration and appear only under Access → Advanced / Future capabilities.
- Confirmation and command overlays use viewport-fixed top-layer geometry so sidebar width, document scroll, and content transforms cannot determine their center.
- Spacing contracts, `min-width: 0`, deliberate line-height, safe wrapping, and responsive toolbar rules prevent text/container collisions and page-wide accidental overflow.

## Operational overview

Overview opens with a compact server-status strip for overall state, Paper, Host, Minecraft version, uptime, players, and latest data time. Primary operational signals are separate TPS, MSPT, CPU, memory/heap, and player cards with browser-local raw-history sparklines, trend text, and meaningful warning thresholds.

Health warnings stay compact instead of turning healthy state into a large decorative panel. Recent player-presence activity and world activity remain secondary to the primary operational signals.

## Performance, Players, and Console

- Native SVG performance charts retain raw samples, visible gaps, exact min/max/average/p95 summaries, keyboard inspection, threshold/reference cues, line/area presentation, 1/5/15/30-minute windows, Pause/Resume presentation, and raw CSV/JSON export.
- Narrow chart containers no longer depend on a 560px scrolling canvas; chart width, stat layout, labels, padding, and grid composition adapt to the actual workspace width.
- Players retains the established 2.3 table/card/head architecture while improving spacing, sticky table headers, mobile metadata hierarchy, and safe full-width mobile drawers.
- Console 3.0 maximizes vertical working space, keeps severity/search/display controls compact, and automatically stops following the tail when the operator scrolls upward. New incoming lines are counted behind a “new lines / return to live tail” affordance rather than dragging the operator back down.

## Audit, Access, and Settings

Audit is a scan-first operational timeline. Search and source remain immediately available; actor/action/outcome/time filters move behind a compact disclosure. Each event exposes time, actor/device, action, target, and outcome first, while raw metadata and JSON are expandable.

Access begins with the current device, role, server, connection and expiry, then groups capabilities into Monitoring, Players, Console & Chat, Plugins, Server, Security / Access, and Advanced / Future. The exact Paper Policy / Host Policy / This Device matrix remains available under **Advanced capability details**. Existing immutable grants are never silently expanded; where local capabilities exist outside the current grant, the UI gives re-pair guidance.

Settings is organized into Appearance, Layout, Motion, Performance charts, Players, Browser data behavior, and Diagnostics rather than a dense matrix.

## Display update rate

Dashboard 3.0 adds a browser-local **Display update rate** setting:

- Realtime — immediate / next-frame presentation (`0 ms`)
- Fast — at most every `250 ms`
- Balanced — at most every `500 ms` and the default
- Relaxed — at most every `1000 ms`
- Low activity — at most every `2000 ms`

This setting changes how frequently already-received state is committed to the visible React interface. It does **not** slow the WebSocket or make Paper/Host produce telemetry more frequently. Authorized messages are still received and reconciled in order. Critical connection, authorization, lifecycle, confirmation, action-result, credential, and pairing state bypasses the presentation throttle.

The implementation uses one shared display scheduler for the dashboard, keeps only the latest safe render snapshot for replaceable state, preserves ordered console/chat streams inside authoritative state, and cleans up timers on unmount or cadence changes.

## Optional Minecraft player heads

Remote player heads are disabled by default unless deployment provides one public, non-secret URL template:

```dotenv
NEXT_PUBLIC_PLEXON_PLAYER_HEAD_URL_TEMPLATE=https://approved-avatar.example/avatar/{uuid}?size={size}&overlay=1
```

The template is strictly validated. Production requires HTTPS and exactly one `{uuid}` placeholder; `{size}` is optional and requested sizes are allowlisted. Credentials, user-info, fragments, arbitrary schemes, wildcard CSP image origins, and custom browser-entered avatar URLs are rejected.

When enabled, the dashboard reserves final image dimensions, renders a deterministic local fallback immediately, lazy-loads/async-decodes the remote image, uses `referrerPolicy="no-referrer"`, and fails back quietly for the current page session. The roster never waits for an image. Player-history rows intentionally do not request remote heads.

A third-party avatar provider can observe the viewer's network address and requested player UUIDs. Heads are cosmetic and can be disabled in Settings. No avatar image, player-history result, or new telemetry database is stored in the relay.

## Player presence and history

The Online roster applies immediate Paper `players.presence` deltas, de-duplicates event/session identity, and reconciles only after a complete multipart `inventory.players` snapshot. Socket or authenticated Paper-session changes clear stale online state; cached browser data never presents players as authoritatively online.

History appears only when both the immutable device grant and current Paper capability contain `players.history.view`. Queries are strict, newest-first, cursor-paginated, bounded, served by Paper's local journal, kept in current memory, and excluded from persistent browser cache. Existing credentials never gain a new scope automatically and Owner cannot bypass disabled local Paper policy.

## Authority and storage

The relay verifies current scope/capability, validates routed data, keeps action results private to the requesting device, and stores identity/access/pairing coordination only. Player inventories, presence bodies, detailed history, telemetry, file bodies, console/chat bodies, and action results are not added to Durable Object storage by Dashboard 3.0.0.

Browser credentials remain bound to audience, protocol, server/device IDs, immutable role/scopes, generation, and expiry. Relay and executing agent independently authorize actions. UI preferences cannot grant a scope, enable a local capability, change Paper retention, or alter authoritative telemetry cadence.

## Development

Use Node 24 and the committed lockfile:

```sh
npm ci
npm run check
npm run relay:smoke
npm run build
```

`npm run check` runs ESLint, application and relay TypeScript, relay tests, client/state/UI tests, and project tests. `relay:smoke` uses temporary workerd storage and ephemeral keys; it is not production deployment approval or a live Paper acceptance gate.

Configure the public relay origin in `.env.local`:

```dotenv
NEXT_PUBLIC_PLEXON_RELAY_URL=https://YOUR-RELAY.workers.dev
NEXT_PUBLIC_PLEXON_PLAYER_HEAD_URL_TEMPLATE=
```

Leave the head template blank to make no avatar-provider requests. Never place access tokens, relay signing keys, Paper/Host private keys, pairing secrets, server credentials, or reusable provider secrets in `NEXT_PUBLIC_*`.

## Compatibility and deployment

Dashboard 3.0.0 remains on signed wire protocol 3 and `/v1`; it preserves the existing relay signing identity, Durable Object namespace, agent identity pins, device grants, local Paper/Host policy authority, and production CSP model. The UI release does not authorize production deployment by itself.

A passing CI build is necessary but not sufficient for production release. Browser, accessibility, viewport, zoom, failure-state, and disposable-live-server gates remain separate acceptance requirements.

Read [3.0.0 release notes](RELEASE_NOTES_3.0.0.md), [3.0 viewport validation matrix](docs/VALIDATION_3.0.0.md), [protocol](docs/PROTOCOL.md), [architecture](docs/ARCHITECTURE.md), [operations](docs/OPERATIONS.md), [security](docs/SECURITY.md), [deployment](docs/VERCEL_DEPLOYMENT.md), and [validation](docs/VALIDATION.md).

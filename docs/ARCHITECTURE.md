# Architecture

Vercel serves Next.js. Browsers connect directly to the origin-allowlisted relay with v3 bearer credentials in WebSocket subprotocols. Paper and optional host open independent signed outbound WSS sessions; neither exposes an inbound listener.

PairingDirectory stores peppered expiring lookups and rate coordination. Each ServerRoom stores public identity pins, current grants/generation/revision and pairing coordination. Telemetry, player inventories, presence bodies, history results, file bodies, commands and action responses are never persisted there. Bounded attachments retain session/sequence and private pending-response routing across hibernation.

Paper persists local grants before approving a browser. Credentials bind server/device IDs, immutable scope/role, audience, protocol, generation and expiry. Relay and executing agent independently intersect the current grant with local capabilities. Recipient event filters separately gate sensitive player fields, historical player metadata and console levels. Host cannot impersonate Paper player events or issue grants.

## Browser state and presentation

Browser state is partitioned by server UUID. `control-state` stages a complete current-player snapshot, buffers bounded presence deltas, de-duplicates IDs, and replaces/replays in capture order. A WebSocket or Paper authenticated-session boundary clears the online roster. IndexedDB holds per-server credentials and a sanitized one-hour telemetry cache; online players, detailed presence history, player address/location, file bodies and action results are excluded. `data-source` tracks bounded requests from queue admission to final results; disconnect never replays actions.

Dashboard 2.3.0 adds a separate global presentation layer. `lib/ui-preferences.ts` owns a small versioned allowlisted schema, migration from legacy density/performance-window keys, strict parsing and presentation-only serialization. `components/ui-preferences-provider.tsx` resolves system media queries and applies validated `data-*` attributes to the document root. A small pre-hydration initializer applies the same allowlists before interactive paint to avoid theme/motion flicker. Presentation data is not combined with credential or sanitized telemetry records.

Theme, accent, contrast, density, text scale, graph presentation, timestamp display and motion are expressed through semantic CSS variables and root attributes. These settings never cross protocol 3 and never alter authoritative samples or authorization.

## Player-head flow

`lib/avatar-provider.ts` validates an optional public deployment URL template and derives its single exact image origin for CSP. It canonicalizes UUIDs and allowlists sizes before constructing a URL. A blank or invalid template yields `null`, so no provider request is made.

`components/player-head.tsx` renders a deterministic local fallback immediately and may lazy-load a current-player head directly from the approved provider with `no-referrer`. URL memoization and per-page failure state are bounded to the maximum current roster. Browser HTTP caching remains authoritative; avatar bytes are not copied into application storage or relayed through Cloudflare. Historical presence views intentionally do not use `PlayerHead`.

## Telemetry rendering

Authoritative telemetry remains the bounded raw sample stream already received by the browser. `lib/chart-geometry.ts` contains pure gap segmentation, statistics, window selection, domains, nearest-sample selection and SVG path helpers. The Overview and Performance workspaces render native SVG; line/area/grid/layout/motion choices affect presentation only. Missing samples break paths, zero remains valid, and exports contain raw values rather than interpolated rendering points.

The dashboard owns pairing, selection, backoff, confirmations and navigation guards. View components receive capability-aware helpers. Files use stale hashes, draft retention, unsaved warnings, bounded ordered downloads and SHA-256. The browser cannot change local policy, unit names, executables, roots or backup remotes.

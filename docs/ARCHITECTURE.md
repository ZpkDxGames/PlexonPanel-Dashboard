# Architecture

Vercel serves Next.js. Browsers connect directly to the origin-allowlisted relay with v3 bearer credentials in WebSocket subprotocols. Paper and optional host open independent signed outbound WSS sessions; neither exposes an inbound listener.

PairingDirectory stores peppered expiring lookups and rate coordination. Each ServerRoom stores public identity pins, current grants/generation/revision and pairing coordination. Telemetry, player inventories, presence bodies, history results, file bodies, commands and action responses are never persisted there. Bounded attachments retain session/sequence and private pending-response routing across hibernation.

Paper persists local grants before approving a browser. Credentials bind server/device IDs, immutable scope/role, audience, protocol, generation and expiry. Relay and executing agent independently intersect the current grant with local capabilities. Recipient event filters separately gate sensitive player fields, historical player metadata and console levels. Host cannot impersonate Paper player events or issue grants.

Browser state is partitioned by server UUID. `control-state` stages a complete current-player snapshot, buffers bounded presence deltas, de-duplicates IDs, and replaces/replays in capture order. A WebSocket or Paper authenticated-session boundary clears the online roster. IndexedDB holds per-server credentials and a sanitized one-hour cache; online players, detailed presence history, player address/location, file bodies and action results are excluded. `data-source` tracks bounded requests from queue admission to final results; disconnect never replays actions.

The dashboard owns pairing, selection, backoff, confirmations and navigation guards. View components receive capability-aware helpers. Files use stale hashes, draft retention, unsaved warnings, bounded ordered downloads and SHA-256. The browser cannot change local policy, unit names, executables, roots or backup remotes.

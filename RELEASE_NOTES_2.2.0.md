# PlexonPanel Dashboard 2.2.0

Dashboard 2.2.0 is the protocol-3 UI/relay companion for PlexonPanel agent bundle 3.0.0. It focuses on truthful, low-latency player presence without turning Cloudflare or the browser into an authoritative history database.

## Highlights

- Immediate Paper-owned join/leave deltas with bounded de-duplication and signed-session isolation.
- Atomic roster replacement only after a complete multipart player snapshot, with newer deltas replayed after capture.
- Real, coalesced and per-device-rate-limited roster Refresh.
- Integrated Online and authorized History tabs, strict filters, stable cursor pagination, bounded-result messaging, local timestamps with UTC source tooltips, and responsive tables/drawers.
- Honest reconnect, Paper-offline, initial-loading, missing-scope, local-policy-disabled, older-agent, empty, and error states.
- Detailed history stays transient in browser memory and never enters the sanitized IndexedDB cache.
- Relay allowlist/validation for `players.presence`, `players.history.list`, and `players.snapshot.request`; Host emission is denied and unauthorized historical fields are removed.

## Compatibility

Wire protocol remains 3 and routes remain `/v1`. Dashboard 2.2 accepts older protocol-3 Paper agents; the Online experience continues and History is clearly unavailable. A 3.0 Paper agent can work with older protocol-3 dashboard/relay versions for pre-existing features, though those versions do not expose the additive history flow.

Existing device grants remain immutable and are not silently expanded. Persistent history is disabled on Paper by default. The Host companion has no role in player presence.

## Release status

Automated checks are required but do not constitute live acceptance. Keep deployment/release coordinated and blocked until the real Paper, failure/reconnect, permissions/privacy, mixed-version, responsive-browser, and representative-load evidence in [validation](docs/VALIDATION.md) is complete.

# Dashboard security

A browser credential is bound to protocol/audience/server/device/role/scopes/generation/expiry. Relay and executing agent independently verify the current local grant and local capabilities. Origin allowlisting, Ed25519 agent sessions, bounded requests and per-device response routing are mandatory. No client field or presentation setting can elevate its grant. Existing grants never acquire `players.history.view` during upgrade, and Owner cannot bypass disabled Paper history.

`players.presence` is Paper-only, strictly validated, and filtered under `players.view`; history-only fields additionally require `players.history.view`. History/snapshot actions reject unknown fields, bad timestamps/status, oversized pages and wrong agent kind. History action results remain private to the requesting device. Durable Object storage excludes telemetry, player inventories, presence bodies and history results.

## Dashboard 2.3 presentation security

Dashboard 2.3.0 keeps appearance and behavior settings in a single strictly parsed, versioned browser-local schema. Allowlisted enum/boolean/number values become root `data-*` attributes; unknown stored properties are discarded. Presentation storage contains no credential, role/grant, server UUID, player name/UUID, history query, console/chat body, file body, address, coordinate, or action data. Reset appearance is separate from Forget this device/server and cannot revoke or mutate a grant.

The optional public player-head template is deployment configuration, not a user preference. Production accepts only a valid HTTPS template with exactly one `{uuid}` placeholder and at most one `{size}` placeholder. Credentials/user-info, fragments, control characters, protocol-relative URLs, unknown placeholders, `data:`, `blob:`, `javascript:`, and production HTTP are rejected. UUIDs are canonicalized to lowercase hexadecimal and requested sizes are allowlisted.

A valid head template contributes only its exact origin to CSP `img-src`; Dashboard 2.3.0 does not add a wildcard domain or broad `https:` image source. A malformed/blank template produces the local fallback and no provider request. Remote images use `referrerPolicy="no-referrer"`, native lazy loading and browser HTTP caching only. No image bytes are copied into IndexedDB, Cache Storage, Durable Objects, or localStorage, and no avatar fetch is routed through the PlexonPanel relay.

A third-party avatar provider can observe the viewer's network address and requested **current-player** UUIDs. Player-history rows deliberately do not request remote heads, preventing a bounded history query from becoming an external browsing pattern. Avatar URLs must never include access tokens, server/device IDs, session IDs, worlds, coordinates, addresses, history fields, or reusable secrets.

Production CSP excludes development eval support; received names/text are escaped. The online roster and queried history clear at session/forget boundaries and are excluded from persistent telemetry cache. Never put credentials in URLs, `NEXT_PUBLIC_*` variables, logs, CSS or diagnostics. Use a trusted private browser profile, revoke lost devices locally, and review [operations](OPERATIONS.md) for cache/privacy limits.

Report vulnerabilities privately; do not include actual credentials, private player records, raw production logs, or provider secrets. Passing CI or synthetic browser checks does not constitute production acceptance; see [validation](VALIDATION.md).

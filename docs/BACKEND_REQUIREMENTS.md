# Backend integration requirements

The following features are not represented as working. They remain disabled or absent until negotiated protocol capabilities exist.

## First-class permissions

- Actions: `permissions.user.get`, `permissions.groups.list`, `permissions.nodes.list`, `permissions.mutation.preview`, `permissions.mutation.apply`.
- Scopes: `permissions.view`, `permissions.edit`; owner policy remains server-side.
- Request identity: `serverId`, bound Paper generation, player UUID; mutation contains typed operation (`node.set`, `node.unset`, `group.add`, `group.remove`), optional context and validated ISO-8601 expiry.
- Responses: current effective nodes with provenance, cursor, bounded limit ≤100; preview returns canonical before/after diff and digest; apply requires that digest and returns audit ID plus authoritative post-state.
- Redaction/audit: no addresses; every preview/apply denial and result is audited with actor device, target UUID, code and agent generation.
- Errors: `SCOPE_DENIED`, `UNSUPPORTED`, `PLAYER_NOT_FOUND`, `POLICY_DENIED`, `STALE_PREVIEW`, `INVALID_NODE`, `INVALID_CONTEXT`, `AGENT_CHANGED`, `OUTCOME_UNKNOWN`.
- Acceptance: cross-server/stale previews cannot apply; duplicate request IDs are idempotent; expired temporary nodes disappear from authoritative reads; denied commands are never retried through another path.

## Tick distribution

- Event/action: bounded histogram or raw-tick window with explicit capture start/end, bucket boundaries, count, missing interval count and Paper generation.
- Scope: `telemetry.view`.
- Retention: at least 35 minutes or cursor-paged windows ≤5 minutes.
- Acceptance: p95/p99 computed only inside the declared window; gaps remain gaps; reconnect generations never merge.

## Optional skin proxy

- Route: `GET /api/skin/:uuid`, UUID-v4/online UUID format validation, provider allowlist only.
- No credentials or cookies forwarded. Response types limited to PNG/WebP, decoded size and response bytes bounded, one retry, short timeout, rate limit and edge cache.
- Acceptance: malformed IDs return 400, non-image/oversize responses fail closed, provider failure returns deterministic local fallback, logs contain no viewer IP beyond platform defaults.

## Future analytics

Thread profiling, retention/DAU, economy, anti-cheat and AI features each require a versioned data contract, source/capture timestamps, retention, redaction, pagination, scopes, audit rules and fixture/acceptance tests before UI work begins.

# Compatibility and protected boundaries — Reference Control Room

Baseline: `cea185cca07d9892967215baed097bedbe0e77ca`.

No changes to `src/adapter/**`, `src/lib/**`, `src/hooks.ts`, `src/entry-state.ts`, `src/features/capabilities.ts`, `src/features/ActionReview.tsx`, source-epoch/history helpers, package/lockfile versions, `.env.example` or `vercel.json`. Protocol manifests, relay configuration, CSP, grants, WebSocket ownership, raw retention and action confirmation policy are unchanged.

## One protected-area exception: preference startup

`src/store/preferences.ts` initializes the existing `oneOf` function before calling the first persisted read. Previously `read()` called `parsePreferences()` while the `const oneOf` was in its temporal dead zone; its catch returned defaults on every fresh module load. That discarded saved light/large/motion/privacy choices until a subsequent update. The fix only reorders initialization and adds a regression using a fresh module. No keys, schema, defaults, validation, migration or credential storage change.

Backup timeline positions are no longer colored as individually completed stages solely from their order. Only the actual current Host phase is highlighted; earlier stages can be skipped and no per-stage completion record is invented.

## Additive read-only player history

The new profile calls existing `players.history.list` through `session.query`, requiring the current Paper capability and `players.history.view`. It passes exact UUID as `query`, limit 25 and opaque cursor ≤512 characters. Pages replace rather than accumulate. The projection rejects other UUIDs and unknown event states; no private address/location, lifetime playtime or inferred session count is displayed. Request tickets and component cleanup discard late responses. Existing immutable target/session checks remain in the adapter.

| Peer/evidence | Behavior |
| --- | --- |
| Legacy Protocol 3 without fleet/cadence metadata | Existing independent source views; no invented node association/cadence |
| Matching BOUND node identity and NODE telemetry | Existing verified-node deduplication |
| Paper absent | Paper current data unavailable, Host-authorized evidence remains independent |
| Host absent | Host node/service/backup controls remain unavailable; Paper authority is independent |
| CPU service sample >100% | Rendered as percent of one core; no decorative 100% cap |
| Missing/stale capacity | No capacity bar or fabricated percentage |
| Unknown backup preflight | Creation stays disabled |
| Read-only/revoked/changed grant | Existing intersections/guards; sensitive profile/console/inventory views remain scoped |
| Missing/disabled player history | Honest restricted/empty/disabled view; no invented lifetime evidence |

NO SERVER-SIDE CHANGE NEEDED. No backend source/runtime, service, JAR, credentials, allowlist or server state was changed. Installed production versions and real paired operations remain pending live acceptance.

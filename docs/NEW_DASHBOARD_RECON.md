# Verified source baseline

Dashboard main `1b9463e18b0e7dac6c5209760d5510732d6d62b0`; Core main `209f8b41d4fe6360a8dcf2f9cdabe7b7df6cc128`. Both were checked through GitHub and local clones on 2026-10-15. Clean worktree; no nested AGENTS.md. Attached AGENTS and full PlexonPanel skill govern this task. Dedicated branch: `design/new-control-plane-20261015`.

React 19.3, Vite 8.3, TypeScript 7, Node 24. Hash routes and lazy chunks are retained. Credentials are IndexedDB only. One writable selected session; passive fleet connections remain capped at 16. All queries and reviewed mutations pass through session prepare/execute. No new sockets or transport store.

Read: all eight routes, shell/pairing/review, selectors/preferences, adapter session/data-source/control-state/grants/scopes/history/fleet/freshness, tests and hosting policy. Cross-checked Core protocol/fleet/telemetry/Host/backups/access/instance authorization/lifecycle/release-gate docs and Paper actions plus source telemetry emitters.

Findings to correct in presentation: shared TPS/ms axis; missing source projection at chart call sites; stale current KPIs; absent cgroup graphs despite existing samples; console commands targeted at journal authority rather than Paper; message/gamemode actions lack editable parameters; asynchronous query state needs identity-bound clearing; Access revoke should use Paper's negotiated authority, independent of Host audit reads.

Core 5.0 source is prepared, runtime/migration/backups/rollback remain uncertified. Current installed versions cannot be established from this session. No VPS credentials or live server pairing are used. Additive cadence/fleet fields must be detected. No server-side change is justified by evidence.

## Operations Desk follow-up

The Signal Atlas presentation did not meet the owner’s requirement for a different product. Its rail, KPI ledger and repeated card compositions are replaced on `design/operations-workspace-20261015`; only verified integration and nonvisual safeguards are retained. Reconfirmed main/Core HEADs and baseline are recorded in BASELINE_CHECKS. DESIGN and FEATURE_PARITY_MATRIX describe the final route architecture.

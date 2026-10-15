# Compatibility and protected boundaries

Wire Protocol 3, action contract hash, /v1 endpoints, WebSocket subprotocol auth, immutable grant reconciliation and IndexedDB credential persistence remain unchanged. No new runtime dependency, endpoint, socket, browser credential location or build variable.

`src/adapter/**`, `src/store/**`, `src/hooks.ts`, `src/entry-state.ts`, `src/features/capabilities.ts`, `src/lib/**`, `package.json`, `package-lock.json`, `.env.example`, `vercel.json` and all original tests are unchanged. Verify with:

```sh
git diff 1b9463e18b0e7dac6c5209760d5510732d6d62b0 -- src/adapter src/store src/hooks.ts src/entry-state.ts src/features/capabilities.ts src/lib package.json package-lock.json .env.example vercel.json
```

The reviewed action UI was replaced without changing prepare/valid/execute behavior or typed-confirmation requirements. Presentation now disables an invalid target and displays the actual result payload as inert text. App remounts route-local state when server/revision/Paper/Host sessions change; old query results cannot populate a different server's workspace. Read requests use the same scope/capability checks, and no mutation is automatically retried.

| Peer evidence | Behavior |
| --- | --- |
| Legacy Protocol 3 without cadence/fleet metadata | Existing pairing/control/telemetry work; cadence says not reported; no node aggregation |
| Current source with sourceIntervalMillis | Positive, bounded integer displayed in provenance; freshness thresholds unchanged |
| Host cgroup fields absent/unavailable | Empty service charts; no substitution from Host JVM or Paper CPU |
| Schema 5 BOUND node with matching signed NODE identity | Fresh node totals deduplicated by UUID |
| Mismatched or unknown node identity | Server stays independent; node not counted |
| Paper unavailable, Host connected | Paper current readings unavailable; retained history attributed; eligible Host operations use original guards |
| Host unavailable, Paper connected | Paper monitoring/commands continue; Host service and backup authority unavailable |
| Denied/revoked/changed grants | Data defense in roster/chat/plugins; session authority remains fail closed; stale reviews disabled/discarded |

Latest Core source is `209f8b41d4fe6360a8dcf2f9cdabe7b7df6cc128`. Its release gate says 5.0 runtime, migration, backup and rollback certification remain pending. Actual installed VPS versions were not inspected. These are compatibility conclusions from source and tests, not a production-runtime certification.

**NO SERVER-SIDE CHANGE NEEDED:** path generation was the measurable presentation bottleneck. Display-only extrema reduction and memoized source projections address it without source cadence, signing, transport, retention or service changes. No VPS process, JAR, relay, configuration, secret or server state was modified.

Presentation source epochs are tracked independently for Paper and Host. A source session or advertised online boundary invalidates that source's plot view by sample object identity, without rewriting capture clocks or pruning raw history. This prevents a short reconnect from joining two authority generations even when less than ten seconds elapsed. The first browser view of an already-established session retains its available history. The guard is unit-tested, including legacy peers with no explicit session token.

Confirmed presentation-level compatibility fix: the old review dialog passed the `confirmed` flag only for its typed-confirmation subset. Core `ControlEngine` requires it for all canonical HIGH_RISK actions, and Paper requires it in ALLOWLIST_WITH_CONFIRMATION console mode (including plugin reload commands). The rebuilt review now supplies that existing field only after explicit dispatch for canonical high-risk actions and those two command actions. The original typed subject set remains unchanged; no adapter, scope, backend check or query path is weakened. New policy tests and a five-operation browser argument-spy regression cover this behavior.

## Operations Desk additions

The adapter/store/lib invariants above are unchanged. A plot context now explicitly owns its raw history: a passive Fleet row cannot borrow the selected server’s source projection. A render-level regression uses different source histories to prove this boundary. Focused Performance summaries and Overview observations consume generation-eligible histories, matching their charts. The action-review change in this reconstruction restores focus to the invoking control after cancellation/result dismissal; prepare/valid/execute, confirmation policy, typed subject set and outcome semantics remain unchanged.

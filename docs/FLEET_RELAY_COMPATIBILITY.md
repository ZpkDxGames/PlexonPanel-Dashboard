# Fleet relay compatibility and persistence

All transport remains signed Protocol 3. Relay routing, grants, replay windows, source selection
and rate limits retain their serverId binding. Fleet metadata is accepted only after hello
signature verification and room binding, and is rechecked before challenge promotion.

| Agents | Behavior |
| --- | --- |
| Legacy Protocol 3 agents without fleet metadata (including deployed 3.5/4.0) | Existing server-isolated operation, fleetState LEGACY |
| One agent with validated fleet v1 metadata | Existing server routes, fleetState INCOMPLETE; no certified node totals |
| Paper and Host with the same serverId/nodeId/instanceKey | fleetState BOUND; independent online status still determines availability |
| 5.0.0 without the exact fleet contract | Rejected before challenge |
| Unknown 5.x or later major version | Rejected |
| Changed node/instance association or downgrade of a stored fleet identity | Rejected; explicit offline migration/rekey required |

Server names are mutable display labels. Paper and Host public keys retain existing local
pinning. Node telemetry must match the agent's validated node association; 5.0.0 telemetry
requires an explicit nodeId. A live duplicate fleet agent is rejected rather than displacing
an authenticated session. Reconnect succeeds once the former transport closes/expires; a lost
transport can therefore cause a brief reconnect delay. Offline copied-path detection in the
agents complements this relay check.

Standalone SQLite schema 1 keeps the existing room keys and adds bounded optional fleet fields
inside room JSON. No destructive database migration is needed. Old rooms remain readable; new
fleet state is rejected if substituted across rooms or mismatched between Paper/Host. Worker
Durable Object names/storage keys remain unchanged. Preserve complete databases and Worker
rollback/deployment associations before production replacement. Existing 3.5 state is not
upgraded on the VPS by these repository changes.

Automated tests execute signed Worker-room handshakes, mismatched node/unit rejection,
contract/version denial, duplicate sessions, rename/reconnect, telemetry substitution and
standalone persistence across three server IDs on shared/separate nodes. Production two-server
runtime, cross-server denial and rollback remain certification gates.

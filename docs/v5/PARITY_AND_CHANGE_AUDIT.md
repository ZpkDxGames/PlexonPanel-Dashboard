# v5 parity and protected-change audit

The supplied owner directive governs this implementation. Legacy restrictions on Next.js, Tailwind, browser log caches and periodic backups are superseded. The deployment, identity, source-truth and reviewed-mutation safeguards remain.

The attached Dashboard archive is fc4b864f2b5723b0d618557ee54e6c52d4342b83 (upstream tree 287de2b517555d891e82a37b9b1f45ffab970ff2), later than the planning reference 4357a66bc674fddce7432cbc27a4fead00ac8234. The backend archive is 209f8b41d4fe6360a8dcf2f9cdabe7b7df6cc128 (tree 4754ccb1a80c69eacde903a1883b40454cab7c32). Fresh remote main reads matched the supplied archive identities during this work. Archive snapshots have local Git histories; they do not contain upstream ancestry. Package SOURCE_IDENTITY.json records exact local baseline and candidate commits and trees.

## Adapter extraction

The reusable layer remains at its original framework-independent paths. Adapter baseline SHA-256 values are in adapter-baseline-sha256.json. Transport pairing, subprotocol/preflight, grant intersection, exact-target preparation, action-result correlation, authority and review policy are retained. No replacement authentication service or Vercel operational proxy was introduced.

| Protected area | Reason for change | Verification |
| --- | --- | --- |
| adapter/browser-store, control-state | Upgrade IndexedDB to v2, delete old operational records, persist only directory/credential metadata; scope/epoch invalidation | v1 migration, no operational persistence, boot reset, grant-reduction contracts; browser reload flow |
| adapter/session, history, epochs | Hydrate Host epoch SQL/JSON/chat, preserve independent clocks, prevent stale identity/generation reuse | source-clock/epoch, pairing/reconnect, query/review contracts; actual SQLite browser flow |
| adapter/relay-config | Public Next.js origin at build/runtime, migrate legacy origin metadata to IndexedDB | origin isolation, unsafe URL rejection, relay-bound credential tests |
| adapter/maintenance, scopes | Add backup schedule/retention typing, additive Host query mappings and confirmed alias | malformed cadence fail-closed, confirmation/contract tests; reviewed synthetic settings action |
| store/preferences | Stable SSR defaults and explicit browser hydration of all eight original keys | preference startup/migration and mobile large-text checks |
| presentation/telemetry, canvas-data | Separate source vectors, percentiles, chunks/entities and bounded raw/gap evidence | source clock, gap/extrema, unavailable-value and 8192-point workload checks |
| deployment/configuration | Next framework, per-request nonce CSP, dynamic no-store HTML, verify-only CI | CSP origin/eval checks, production build and intercepted production browser run |

## Operational parity

Every view retains scope and agent-capability gating. On narrow screens, the route band becomes an eight-link drawer; tables scroll within their surfaces and virtual lists remain bounded. Denied, missing, stopped, offline, stale and skew evidence have distinct presentation.

| View | Implemented sources and interactions | Local evidence |
| --- | --- | --- |
| Fleet | Bounded passive feeds, verified-node deduplication, per-instance service/boot evidence and exact selection | fleet/node contracts; four browser combinations |
| Overview | 7:5 TPS/MSPT percentile + JVM memory / SQLite terminal split, presence pills, four KPI cards, reviewed lifecycle controls, worlds/chunks/entities/tiles and roster | browser matrix, height/reflow guard, stopped/offline/denied/stale/skew/partial checks |
| Performance | Eight default tracks (TPS, MSPT, JVM heap, service memory, service CPU, node CPU, chunks, entities), optional Paper CPU, three memory scopes, shared zoom/crosshair, GC/presence/available Host-operation markers, 50-observation raw tables | independent-clock/gap contracts; production benchmark; four browser combinations |
| Players | Virtual searchable roster, immutable exact-UUID inspector and existing moderation/gameplay/command builders; current-boot Host SQL/JSON timeline | player target/history contracts; actual SQLite presence flow; four browser combinations |
| Console & Chat | Measured virtual rows, server/client severity/search and older cursors, epoch badge, pause/follow/wrap, safe formatted text, reviewed Paper commands; chat/MiniMessage scope and plugin inventory/reload | safe-format contracts, epoch/grant reduction tests, real SQL history/reload/storage flow; four browser combinations |
| Backups | Durable job/recovery banner, preflight, manual 30/15/10/5/zero-safe countdown, cadence/timezone/empty-skip/local retention editor, exact archive verify/delete/retry actions | Host workflow/retention/recovery contracts, schedule parser tests, mobile exact-target focus review; four browser combinations |
| Access & Audit | Grant versus Paper/Host capability matrix, current-device revocation protection, dual-source virtual audit | capability/review contracts; four browser combinations |
| Settings | Eight preferences, relay/OTP recovery and redacted diagnostic export | preference/origin/diagnostic contracts; large-text interaction check; four browser combinations |

Browser matrices use prominently labeled development fixtures with all nonlocal traffic blocked. The real-SQL browser flow uses actual Java HostSessionStore and JDBC through a synthetic loopback relay. Neither test is a deployed-relay or live Minecraft certification. Plugin and maintenance markers require corresponding authorized events; absent events are not synthesized.

Publication reconciliation: the local archive baseline index excluded three historical docs/next-gen/evidence/logs/publication-*.log files because the original ignore rule matched *.log. Their source bytes match the upstream blobs exactly and are now explicitly tracked and preserved. All remaining Dashboard baseline blob hashes and modes match the actual upstream tree. The earlier 6c40aeda2bec18d42e4638161ad83df1f42facd8 value identifies that local index snapshot, not the upstream commit tree.

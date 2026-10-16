# Source-driven parity — Reference Control Room

Baseline `cea185cca07d9892967215baed097bedbe0e77ca`. All eight existing hash route identifiers and lazy imports remain compatible.

| Existing behavior | New location | Evidence |
| --- | --- | --- |
| Initialized credential gate and minimum splash | Compact branded startup → dedicated pairing panel | Entry contracts; first-visit/rejected-claim browser flow; production artifact test |
| Name, masked code and conditional HTTPS relay | Pairing panel; Connections → Pair another server | Original PairingForm/session/IndexedDB flow retained |
| Route navigation, search and server selection | Grouped sidebar; native mobile drawer; Ctrl/Cmd+K palette | Eight route IDs; drawer focus/Escape; palette navigation |
| Selected room plus passive feeds ≤16 | Fleet server cards and server switcher | Existing fleet/session tests; passive history isolation regression |
| Node identity and deduplicated totals | Fleet → verified node module | Existing matching BOUND/NODE/freshness rules untouched |
| TPS, mean MSPT, online count and observed peak | Overview KPI strip; tick/usage modules | Real Paper fields; same source-epoch summaries |
| Paper process CPU and heap | Overview resource disclosure; Performance selectors | Independent Paper JVM provenance |
| Service CPU/memory and node CPU/memory | Overview resources; all eight Performance selectors | Cgroup vs node units, >100% one-core scale, fresh known capacity bars |
| Source clocks, skew, cadence and session generations | Header source badges, chart source details | Original freshness/projection/epoch tests retained |
| Worlds, entities, loaded chunks and density | Overview → Loaded worlds | Only positive known chunk denominator |
| Retained window, sample count and tick budget | Usage range selector; Performance 1/5/15/30m; tick health | Original capture/gap/extrema/sample-table logic |
| GC pause movement/counter reset | Performance → Garbage collection | Existing tested gcMovement helper |
| Pointer, arrows, pin, touch and synchronized inspection | Instrument panels; focused/compare modes | Control-plane and touch tests; chart geometry tests |
| Series toggles and original-sample table | Chart legend/View data/Source details | Actual latest 50 observations; no smoothing or fabricated percentiles |
| Roster search/world filter/sort | Players roster; responsive rows | Existing search + new profile/focus checks |
| Player UUID copy/session/world/ping | Full Players profile header and fact cells | UUID selection remains independent from roster filters |
| Message and gamemode parameters | Profile → Interact | Reviewed UUID-bound Paper parameters |
| Kick/ban/whitelist/heal/feed/kill/OP/de-OP | Profile → Moderate | Existing guarded actions; added existing whitelist-remove action; typed high-risk checks retained |
| Command template and LuckPerms builder | Profile → Commands | Protected validators; server allowed-command policy unchanged |
| Player history contract (previously deferred UI) | Profile → Session history | Additive read-only exact-UUID query; opaque cursor; request cancellation; bounded projection tests |
| Console level/source/search filters | Console workspace toolbar | Viewing scopes remain separate from Paper command authority |
| Pause, wrap, follow-tail, clear display, export | Console terminal toolbar/status | Existing 2,500 raw-line bound and bounded render path |
| Console preview | New Overview read-only window | At most eight authorized formatted lines; no dispatch |
| Reviewed Paper commands | Console composer | Exact Paper target; agent result vs queued/unknown retained |
| Chat transcript, preview, MiniMessage | Console → Live chat | Safe text formatting; scope + capability gate |
| Plugin inventory/reload | Console → Plugin inventory | Existing real inventory; added local search; reviewed reload |
| Backup five-boolean readiness, countdown presets/create | Backups readiness/create panels | Fail-closed source evidence; same 30/15/10/5-minute choices |
| List/status/verify/delete | Backups archive inventory | Same Host queries and review guards; presence is not verification |
| Durable phases, progress and upload retry | Backups Host workflow module | Same job-matched progress, unknown states and retry review |
| Device list/current-device protection/revoke | Access → Paired devices | Current device disabled; exact Paper revocation target |
| Audit source/filter and scope | Access → Operation trail | Actual audit.list/self response fields; Host/Paper selection |
| Immutable effective scopes | Access → Your authority | Original signed/reported grant intersection |
| Theme/system/density/text/motion/accent/fill/timezone | Settings → Appearance | Existing schema; explicit startup regression fixes persisted-read initialization |
| Relay save/reconnect/add-server pair | Settings → Connections | Trusted session API; pending/dirty/success/error feedback |
| Skin provider/privacy | Settings → Privacy & skins | Original provider choices and direct-request disclosure |
| Build identity/redacted diagnostics | Settings → Diagnostics | Original build.json/diagnostics redaction; no secret fields added |
| Reviewed target invalidation, confirmations and result | Shared review dialog | Original prepare/valid/execute behavior unchanged; 5-operation confirmation test |

Unsupported reference features remain absent: item inventory/Ender Chest, admin notes, gamerules, MOTD/icon uploads, files/config writes, datapacks, scheduled backups, shortcut restore/download UI, integration management, billing and invitations. Lifetime playtime/session totals are not inferred from the bounded history browser.

Architecture-only browser assertions were updated deliberately: horizontal navigation → sidebar/console composition; dialog-based player inspector → full profile/back navigation; Settings anchors → focused section links. UUID binding, nested review focus, source isolation, eight routes, responsive states, capability denial and immutable grant assertions remain covered.

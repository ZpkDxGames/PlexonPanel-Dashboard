# Source-driven feature parity

Baseline: `1b9463e18b0e7dac6c5209760d5510732d6d62b0`. New branch: `design/new-control-plane-20261015`.

| Baseline behavior | New location / integration | Verification |
| --- | --- | --- |
| 2.8s splash and initialized credential gate | New voxel brand splash and dedicated pairing composition; entry-state unchanged | Entry tests; browser first-visit check |
| Device name/code/conditional relay field, inline failures | PairingForm retained with new pairing gate; same claim and IndexedDB storage | Pairing and relay session tests; rejected-claim browser test |
| Hash route deep links and lazy workspaces | Labelled compact/expanded rail, mobile native dialog, searchable route/server palette | Original 8 identifiers; browser navigation matrix |
| Selected room, independent passive fleet, max 16 | Fleet server board, explicit selected/read-only labels | Existing fleet/session isolation tests |
| Node provenance, shared node totals | Fleet node register requires matching UUID, BOUND identity, NODE scope and usable Host reading | New deduplication, mismatch and expiry tests |
| Tick rate, mean duration, player count, JVM heap/process CPU | Overview metric ledger and independent tick tracks | Same fields; chart/source tests |
| Host machine CPU/memory trends | Performance node instruments; Overview source health | Host attribution retained; independent capture projection |
| Minecraft service CPU/memory | New Performance cgroup instruments; Overview current service CPU | Exact scope/source/units; no one-core 100% clamp |
| World entities, chunks and density | Overview proportional entity bars with actual counts/density | Positive-known denominator required |
| Threshold crossings, retained window, GC movement | Performance observations, 1/5/15/30m, GC card | Source-clock windowing, counter-reset and geometry tests |
| Chart crosshair, legends and data table | Synchronized pointer/arrow inspection, pin, touch, visible previous/next controls, latest 50 original samples | Browser interaction and pure chart tests |
| Search/world-filter roster, UUID copy | Players searchable/sortable roster and sticky profile | Browser search; scopes hide unauthorized fixture data |
| Message/kick/ban/whitelist/gamemode/heal/feed/kill/op/deop | Player profile reviewed actions | Message/gameMode now collect required parameters; typed high-risk confirmation retained |
| Typed player template and LuckPerms node command | Player command builders | Protected validators unchanged; server policy still authoritative |
| Console live stream/severity/search/pause/wrap/export/clear | New terminal workstation; adds source filter, true following tail and source-specific guidance | Bounded virtual rows; read-only display controls never dispatch |
| Console command dispatch | Reviewed composer explicitly targets PAPER | Corrects prior coupling to HOST journal authority; browser review verifies agent |
| Chat send/MiniMessage/preview | Live chat workspace; grant + capability required for MiniMessage | Safe text formatter unchanged; reviewed send |
| Plugin inventory/reload | Inventory tiles and reviewed reload | plugins.view guard; reload reason gate |
| Backup preflight/countdown presets/create | Backup readiness and creation panel | Same five fail-closed booleans; fresh successful evidence required |
| Durable job phases/progress/retry | Host operation journal, verification states and matched job progress | No fabricated progress; status reads refresh active jobs; no mutation retries |
| Backup list/verify/delete | Archive register, available/absent/unknown copy labels | Presence is not labelled verification; verify/delete remain reviewed |
| Device list/current-device safeguard/revoke | Access device register and effective grant | PAPER revocation capability; current device disabled |
| Audit filter | Explicit Host/Paper source register, audit.list or audit.self per grant | Actual actorLabel/actionType/outcome plus legacy aliases |
| Theme/density/text/motion/accent/fill/time zone | Settings Appearance | Existing preference schema untouched |
| Relay save/reconnect/add pair | Settings Connections | Same trusted session API |
| Skin provider/privacy | Settings Privacy & skins | Same options and disclosure; QA disables external requests |
| Build identity/redacted diagnostics | Settings Diagnostics | Existing diagnostic redaction unchanged |
| Action target/generation validation, review, result and unknown outcome | Restyled ActionReview, exact response evidence and invalid-target disabled state | Existing session/contract tests; browser context-change check |

Previously deferred backend features remain deferred: presence-history browser, remote restore/download UI, file management, permission trees, tick percentiles/distributions. They were not working UI features at the baseline. No new artificial analytics or unsupported controls were added.

Reviewed dispatch now also corrects an existing missing-confirmation defect: lifecycle, backup creation and device revocation carry the existing Protocol 3 `confirmed` flag after review; confirmation-mode Paper commands/reload do likewise. Typed ban/kill/op/deop/delete safeguards remain intact.

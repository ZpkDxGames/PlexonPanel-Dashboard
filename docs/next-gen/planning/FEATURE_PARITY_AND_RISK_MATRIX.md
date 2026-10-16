# Feature parity and risk matrix

Version 1.0 · frontend `4357a66bc674fddce7432cbc27a4fead00ac8234` · backend `209f8b41d4fe6360a8dcf2f9cdabe7b7df6cc128`.

## How to use

This is the feature-by-feature source map and implementation acceptance register. Source anchors are indexed in `SOURCE_AUDIT.md`; symbols below are more stable than moving line numbers. **Current** means present in source, not certified against a live VPS. R01–R08 refer to the design spec; S01–S14 are its state codes. Every row must become PASS with a code/test/evidence reference or a documented blocker in the implementation PR. Rows marked Deferred are not parity obligations to implement.

Risk: C = critical authority/data integrity; H = high operational/privacy/performance; M = normal interaction/visual regression; L = local presentation. Read-scope checks describe existing UI and source ownership; server/relay enforcement remains authoritative. All mutations additionally require `session.reason`, valid signed/capability intersection, current target, review and agent authorization. The capability helper alone does not grant authority.

## A. Shell, onboarding and identity

| ID | Current feature / entry / source | Producer / authorization | Strata change | States and concrete verification | Risk |
| --- | --- | --- | --- | --- | --- |
| A01 | Eight lazy routes, `router.ts`, `App.tsx` | Local navigation; no mutation | Horizontal desktop route band; labeled narrow drawer | All hashes including unknown fallback; lazy chunk boundaries; Back/forward | M |
| A02 | 2800ms splash + initialized storage, `entry-state.ts`, App | Local startup | Static original block mark | Storage pending, no credentials, stored credentials; entry-state tests | H |
| A03 | Name + masked code, `PairingForm.tsx` | `session.pair`; one-use claim and signed session; IndexedDB | Focused pairing form/explanation | Name 80/code 128/whitespace, missing origin, rejected claim, accepted→connecting; pairing/relay-session tests | C |
| A04 | Conditional HTTPS origin and recoverable config | relay-config + browser-store | Inline origin error and explicit recovery | Invalid/credential-bearing/cross-relay origin rejected; no token sent to mismatch | C |
| A05 | Stored origin-bound pairing, browser-store | IndexedDB protected credential | Preserve exactly | Reload/reconnect, blocked localStorage, expiry/revocation; never clear database for UI migration | C |
| A06 | Server switcher/command palette, Shell | `session.select`; one actionable selected session | Header target selector and nav-only palette | Old target visible on failure; correct revision invalidation; no cross-server data | C |
| A07 | Mobile nav, Ctrl/Cmd+K, skip link, theme toggle | Local | New shell geometry | Focus trap/return/Escape, keyboard route navigation, all labels present at 320 | M |
| A08 | Paper/Host freshness and relay connection | `sourceEvidence`, independent source receipts | Four-source disclosure + separate relay state | Stale/skew/offline/unknown never coalesced into “offline server” | H |
| A09 | Development fixture banner/production exclusion | `import.meta.env.DEV`, production-check | Keep conspicuous label in all proofs | Fixture URL in production cannot authorize or bypass pairing; no fixture data in dist | C |

## B. Fleet and Overview

| ID | Current feature / source | Producer / scope or gate | Strata treatment | Verification | Risk |
| --- | --- | --- | --- | --- | --- |
| F01 | Paired directory/search/selection, Fleet | Credentials + session fleet observations | R01 instance ledger | 0/1/16 sessions, local no-match, long names, selection failure | H |
| F02 | Passive feeds, fleet-feed/fleet-contract | Per-server signed sessions, total ceiling 16 | Explicit read-only passive records | Other-room frames ignored; selected history never used by passive sparkline; fleet tests | C |
| F03 | Node register, `verifiedNodes` | Fresh Host + matching BOUND/node metadata + NODE scope | Deduplicated infrastructure register | Two instances/one node counted once; legacy/unbound/stale omitted from totals | C |
| F04 | Paper TPS/players + histories | Authorized Paper observations | Values with independent source state | Missing vs0, offline Paper, stale retained values; no aggregate CPU arithmetic | H |
| F05 | Pair another server | Local `Settings?section=connection` | Heading action | Existing deep link reaches actual PairingForm | M |
| O01 | Identity/version/service state | ready metadata + fresh Host service | Compact entity row + details | Unknown versions/state labeled; server name never service selector | H |
| O02 | TPS / averageTickMillis / onlinePlayers/maxPlayers | Paper; overview/telemetry/players evidence as delivered | Divided reading strip | No invented percentile; zero players retained; source state beside values | H |
| O03 | Observed TPS low/mean, player peak, >50ms count | Current eligible retained history | Explicit retained-session/window labels | Source epoch reconnect, no daily/lifetime claim; summary tests | H |
| O04 | Heap/node memory capacity meters | Paper system/Host system | Layered resource register | Usable source + known positive denominator; stale/overcapacity numerical evidence not clipped | H |
| O05 | Service CPU, process CPU, node CPU | Host cgroup / Paper JVM / Host node | Distinct scope rows | Cgroup 150% valid; no Host JVM as Minecraft process; unknown accounting | C |
| O06 | Usage selector/ranges | Existing TPS/serviceCpu/heap;1/5/15/30m | Instrument in first viewport | Exact samples/gaps; range changes not retention/cadence | M |
| O07 | Read-only console preview/pause/open | Host preferred or Paper fallback; console.view.full/errors | First-row terminal, latest 8 | Denied hides output; pause freezes view only; no commands in preview | H |
| O08 | Active-player preview | Paper, players.view | Compact identity list | Denied/empty/offline; click retains existing Players navigation | H |
| O09 | Worlds/chunks/entities/density | Paper world snapshot, max 64 | World ledger with generic terrain glyphs | Density only positive known chunk count; no inferred biome/map | M |
| O10 | Quick tools / tick-health coverage | Local navigation + true mean tick history | Compact links and lower tick section | All routes reachable;50ms reference, no inferred health diagnosis | M |
| O11 | Start/restart/stop | Host exact configured service; see mutation table | Reviewed lifecycle group | Fresh service evidence for start/stop; agent offline and grant loss; prepared target invalidates | C |

## C. Performance

| ID | Metric or behavior | Actual producer / field contract | Change | Acceptance / existing test owner | Risk |
| --- | --- | --- | --- | --- | --- |
| P01 | TPS | Paper health, `tps[0]` projected as tps | Focus instrument | 20 reference, outlier not clipped; presentation-telemetry/chart-geometry | H |
| P02 | Mean MSPT | Paper `averageTickMillis` | Mean tick instrument with 50ms reference | No p95/p99 generated from mean; null/gap/extrema tests | C |
| P03 | Service CPU | Host service resources.cpuPercent; PERCENT_OF_ONE_CORE | Dynamic axis and denominator |150% kept; counter/PID/unavailable remains unknown | C |
| P04 | Paper process CPU | Paper system.processCpuPercent | Separate source instrument | Never relabel Host process; independent capture/epoch | C |
| P05 | Node CPU | Host system.hostCpuPercent | Node instrument | Fresh authenticated node provenance | H |
| P06 | JVM heap | Paper system.jvmHeapUsedBytes | Binary units | Not RSS/cgroup memory; original sample table | H |
| P07 | Service memory | Host service.resources.memoryBytes | Independent cgroup track | Not summed with heap/node; unknown accounting | H |
| P08 | Node memory | Host system.physicalMemoryUsedBytes | Separate node track | Binary units; no fake capacity | H |
| P09 | Focus + optional eight-track compare | Existing Performance route | Catalog + fixed inspection shelf | All 8 available, separate units/axes, focus default; browser-profile | H |
| P10 | Time windows |1/5/15/30m within raw 35m/8192 | Preserve controls | Window by actual source capture, no simulated 24h history | C |
| P11 | Crosshair/pin/keyboard/touch/legend | TimeSeries and actual samples | Stable shelf, accessible pin controls | Timestamp stable under ingest/resize; null gap not bridged; compare exact source time | H |
| P12 | Original sample table | Latest 50 actual observations, not all retained points | Labeled internal scroll | All finite values/Unknown correspond to actual source; table bound preserved | H |
| P13 | Reduction / epochs / coverage | displaySegments, historyFor, SourceEpochs | Preserve raw semantics; reduce rerenders only | Extrema/endpoints/null/time gaps, per-source reset, passive isolation | C |
| P14 | GC pause movement | Cumulative Paper GC time over observed window | Lower register | Reset/insufficient samples→Unknown; no percentile/collection-duration invention | H |

## D. Players

| ID | Existing capability / entry | Authority | Change | Acceptance | Risk |
| --- | --- | --- | --- | --- | --- |
| U01 | Roster/name-or-UUID search/world/sort | Paper; players.view; max 512 | R04 ledger | Name/ping/duration sorts preserve unknown ordering;0 online vs no matches vs denied | H |
| U02 | In-page selected UUID profile | Local selection from current roster | Identity strip/tools/history | No new route requirement; Back filter/scroll/focus; vanish never retargets | C |
| U03 | Head/copy UUID/world/ping/onlineDurationMillis | Actual permitted player metadata | Fixed 32/80px heads, full UUID | Disabled/failing provider local fallback, provider change, clipboard denied | H |
| U04 | Private message/game mode | Paper mutation | Interact form | Exact UUID/message/gameMode in review; scope/confirmation mapping below | C |
| U05 | Whitelist/heal/feed/kick/ban/kill/op/deop | Paper mutation | Supportive vs sensitive action grouping | Every button retained and gated; optional kick/ban reason preserved | C |
| U06 | Command template | `playerCommand`, console.execute | Exact command preview | Reject controls/unknown placeholders; no shell passthrough | C |
| U07 | LuckPerms node set/unset | `permissionCommand`, console.execute | Commands subpanel with policy note | Exact builder output; no inferred permissions tree/plugin availability | C |
| U08 | Exact-UUID history query | Paper players.history.list / players.history.view | Event ledger, latest/older | limit 25, opaque cursor, page replacement; query bound to exact UUID | C |
| U09 | History unknown/disabled/bounded | Existing playerHistoryPage parser | Explicit states | No lifetime totals; unknown endings stay null; late A response cannot affect B | C |

## E. Console, chat and plugins

| ID | Current behavior | Authority / scope | Strata treatment | Acceptance | Risk |
| --- | --- | --- | --- | --- | --- |
| C01 | Live/retained console | Host journal preferred; Paper new-line fallback; console.view.full/errors | R05 workbench | Show actual authority and fallback limit; Paper offline does not erase Host journal | C |
| C02 | Text/level/source filter | Local authorized retained lines | Compact filters | Errors-only cannot recover INFO; case-insensitive search; no-match not denial | C |
| C03 | Pause/tail/wrap | Local display state | Explicit inspecting/paused/live labels and Return to live | Ingestion continues; wrap≤400 rendered; no-wrap viewport+overscan | H |
| C04 | Clear/undo/export | Browser-only view/Blob export | Secondary utilities | Clear does not delete Host logs; exported only filtered authorized lines; URL revoked | H |
| C05 | Clock/source/level/formatter | Capture or explicitly labeled receipt fallback | Stable columns and safe text | browser/UTC; ANSI/section/MiniMessage parser remains bounded and inert | C |
| C06 | Reviewed command composer | Paper console.execute.allowed + command policy | Composer in terminal work surface | command≤512 normalized one line; explicit review; no Host execution | C |
| C07 | Chat stream | Paper chat.view; reducer max 200 | Stream/composer split | Denied reveals no messages; missing name/UUID stays fallback; no unbounded list | H |
| C08 | Global chat send | Paper chat.send | Review send + safe preview | message≤512; no direct dispatch | C |
| C09 | Optional MiniMessage | chat.send.minimessage signed scope AND Paper capability | Explicit toggle/disabled reason | false when absent, safe preview, no HTML injection | C |
| C10 | Plugin inventory/name/version/status/search | Paper plugins.view | Third Console tab ledger | Enabled/disabled/unknown distinct; no-match vs unavailable; long names | H |
| C11 | Plugin reload | Paper plugins.reload / configured allowlisted command | Exact-row Review reload | No generic reload; exact plugin string and session target retained | C |

## F. Backups and recovery

| ID | Current capability / source | Authority / scope | Strata change | Verification | Risk |
| --- | --- | --- | --- | --- | --- |
| B01 | Preflight read | HOST backup.preflight / backup.view | Independent safe evidence sheet | Unknown/expired/rejected fails closed; source/provider/capacity not conflated | C |
| B02 | Manual create/countdown | HOST maintenance.full-backup.create / maintenance.run | Separate deliberate create surface |1800/900/600/300 seconds only; review shows stop/restart impact | C |
| B03 | Durable job/status | HOST maintenance.status / maintenance.view | First content and actual receipt age | Poll 3s active/live/visible; closing browser does not cancel job | C |
| B04 | Same-job progress | Host progress + durable operation | Progress, bytes/rate/provider label | Exact jobId match; indeterminate omitted aria-valuenow;100%≠verified | C |
| B05 | Workflow phases | Host durable phase; exact ordered list in Backups |5 grouped stages with expandable exact labels | Prior position not green completed; no fake countdown authority | C |
| B06 | Local/remote verification flags | Host operation boolean flags | Separate proof tiles | Unknown vs false vs true; result scope/job visible | C |
| B07 | Archive inventory | HOST backup.full.list / backup.view | Responsive archive records | Filename/ID/time/bytes/local/offsite; available not verified; true empty vs failed | H |
| B08 | Verify archive | HOST backup.full.verify / backup.view | Review action and scoped result | Exact backupId; verification result not general provider certification | C |
| B09 | Delete archive | HOST backup.full.delete / backup.delete | Sensitive reviewed action | Typed backupId, confirmed flag, exact target; no delete-on-row-click | C |
| B10 | Retry upload | HOST backup.full.retry-upload / backup.create | Degraded-state reviewed action | Only retryable true + grant/capability + backupId; no new shutdown or automatic retries | C |
| B11 | Recovery-required / failed job | Host durable state/error/restartRecoveryRequired if returned | Recovery reason before create/inventory | No clearing journals, restore button, browser restart orchestration or invented success | C |
| B12 | Action acceptance vs completion | Host create returns SUCCESS with jobId, state QUEUED | “Host accepted job”; link/read status | Transport queued, accepted job and completed job are three distinct proofs | C |

## G. Access and settings

| ID | Existing feature | Producer / authorization | Change | Acceptance | Risk |
| --- | --- | --- | --- | --- | --- |
| X01 | Audit source + full/self selection | HOST/PAPER audit.list / audit.view; otherwise audit.self / audit.view.self | R07 source-labeled ledger | limit 50, filter, correct actor/target/outcome; no global audit claim | C |
| X02 | Devices list/fallback | devices.list / devices.view; Paper when permitted, otherwise Host | Device register and mirror label | Source failure distinct from empty; source/ticket isolation | H |
| X03 | Current-device protection/revoke | devices.revoke / devices.revoke, PAPER | Exact target reviewed revoke | Current browser disabled; role not bypass; late/unknown result inspection | C |
| X04 | Effective grant/scopes | reconcileDeviceGrant intersection | Read-only searchable authority ledger | Missing signed/report mismatch→no authority; cap absent not available; no edits | C |
| S01 | Appearance section deep link | Local | R08 grouped form/specimen | Existing section keys and invalid-section fallback | M |
| S02 | theme dark/light/system, default dark | Browser preference | Both themes + OS listener | Reload and OS change; contrast on each surface | M |
| S03 | density compact/comfortable/spacious | Browser preference; comfortable | Geometry only | Touch≥44 regardless density; no content removal | M |
| S04 | textSize small/standard/large | Browser preference; standard | Rem scale, terminal geometry | Large text/zoom no clipping; fresh reload | H |
| S05 | accent teal/blue/violet | Browser preference; teal | Signal/selected-state color | Stored enums intact; semantic color unaffected | M |
| S06 | motion full/reduced/off | Browser preference; full; legacy reduceMotion | Short task transitions | OS reduce overrides full; off instant; no value animation | M |
| S07 | chartFill boolean true | Browser preference | Area visibility only | Disabled fill leaves stroke/gaps/legend unchanged | M |
| S08 | timezone browser/UTC | Browser preference; browser | Consistent timestamps | Chart/console/history/audit/backup time labels; raw ISO unchanged | H |
| S09 | skinProvider proxy/crafatar/mc-heads/minotar/disabled | Browser preference; crafatar | Disclosure + fixed fallback | Only selected provider; disabled zero requests; proxy missing→fallback | H |
| S10 | Connections save/reconnect | session.setRelayOrigin / reconnect | Explicit separate controls | Saved≠reachable; invalid/mismatch no token; retained credentials unchanged | C |
| S11 | Pair another server | PairingForm | Connection section second form | Same safe claim/storage contract as A03 | C |
| S12 | Diagnostics copy/build | Redacted diagnostics + build.json | Exact identity ledger | Missing build/clipboard failure; no private values; fetch no-store | C |
| S13 | Persistence initialization and failure | `preferences.ts` oneOf initialized before read | Preserve; honest applied feedback | preferences-startup test; malformed/legacy/blocked storage | H |

## H. Exact active mutation/read mappings

This table is sourced from `src/adapter/scopes.ts`, route prepare/query calls and backend handlers. Capability checks use canonical scopes. Parameters shown exclude transport metadata and `confirmed`, which remain managed by the existing pipeline. Read queries still use the protected action channel.

| Operation | Agent | Canonical scope | Current parameters | Review policy / acceptance |
| --- | --- | --- | --- | --- |
| server.start | HOST | server.start | `{}` | Review; start requires current inactive/failed service evidence |
| server.stop | HOST | server.stop | `{}` | Review + confirmed; current active evidence |
| server.restart | HOST | server.restart | `{}` | Review + confirmed; do not invent a new frontend freshness exemption or requirement |
| player.message | PAPER | player.message | playerId, message | Review; exact UUID |
| player.gamemode | PAPER | player.gamemode | playerId, gameMode | Review; SURVIVAL/CREATIVE/ADVENTURE/SPECTATOR |
| player.whitelist.add | PAPER | player.whitelist | playerId | Review |
| player.whitelist.remove | PAPER | player.whitelist | playerId | Review |
| player.heal | PAPER | player.heal | playerId | Review |
| player.feed | PAPER | player.feed | playerId | Review |
| player.kick | PAPER | player.kick | playerId, optional reason | Review |
| player.ban | PAPER | player.ban | playerId, optional reason | Typed subject + confirmed |
| player.kill | PAPER | player.kill | playerId | Typed subject + confirmed |
| player.op | PAPER | player.op | playerId | Owner plus scope/capability; typed subject + confirmed |
| player.deop | PAPER | player.op | playerId | Owner plus scope/capability; typed subject + confirmed |
| console.execute | PAPER | console.execute.allowed | command | Review + confirmed; allow/deny policy still applies |
| chat.global.send | PAPER | chat.send | message, miniMessage | Review; formatting additionally requires chat.send.minimessage |
| plugin.command.reload | PAPER | plugins.reload | plugin | Review + confirmed; exact configured plugin command |
| players.history.list | PAPER | players.history.view | query exact UUID, limit 25, optional cursor | Read-only; no action dialog |
| backup.preflight | HOST | backup.view | `{}` | Read-only, unknown fails closed |
| maintenance.status | HOST | maintenance.view | `{}` | Read-only durable currentOperation |
| backup.full.list | HOST | backup.view | `{}` | Read-only archive inventory |
| maintenance.full-backup.create | HOST | maintenance.run | countdownSeconds | Review + confirmed; SUCCESS can return queued job |
| backup.full.verify | HOST | backup.view | backupId | Reviewed operation even though same view scope |
| backup.full.delete | HOST | backup.delete | backupId | Typed backupId + confirmed |
| backup.full.retry-upload | HOST | backup.create | backupId | Review; no second cold backup implied |
| audit.list | selected HOST/PAPER | audit.view | limit 50 | Read-only |
| audit.self | selected HOST/PAPER | audit.view.self | limit 50 | Read-only restricted audit |
| devices.list | PAPER or HOST mirror | devices.view | `{}` | Read-only |
| devices.revoke | PAPER | devices.revoke | deviceId | Review + confirmed; current browser protected |

Prepared targets capture exact server/session/agent and cloned parameters. Existing typed confirmation text for player operations is the prepared subject name, while payload identity is UUID; display both. Do not silently change the required typed phrase or add a new typed policy without documenting it. Read actions, navigation, origin changes and preference updates must not automatically acquire mutation confirmation flags.

## I. Deferred / unsupported product surface

| Proposal or historical mention | Current truth | Required decision |
| --- | --- | --- |
| Browser file manager, upload/edit/config editor | Some scope metadata/helpers exist; no active route in this dashboard; Host writes retired | Deferred; not a parity feature; separate product/security design |
| Remote restore/download workflow UI | Backend has historical handlers/metadata; stable remote restore forced off; current frontend no general restore/download manager | No active controls. Separate authorized recovery/transfer contract |
| Scheduled full backups | Backend manual-only policy | Prohibited, not a future styling task |
| Restart scheduling/display update-rate setting | Historical backend/docs mention them; absent from current Settings/Backups UI | Do not resurrect as parity; separate owner-scoped feature |
| Player inventory, ender chest, notes, lifetime playtime, inferred percentile ping/ticks | Not provided by current frontend read contract | Deferred; needs data/privacy/retention design |
| Player unban/teleport, location/address panes | Scopes/backend support may exist; no active current route controls in audited UI | Not part of visual parity; no silent capability expansion |
| Editable roles/scopes or owner override | Grants immutable; source enforcement intersection | Prohibited UI fiction; re-pairing is separate deliberate operation |
| Skin proxy implementation / 3D avatar | Proxy preference exists but deployment is separate; only head display implemented | Keep preference/fallback; no new proxy deployment or WebGL |
| Plugin upload/install/generic reload | Current UI only inventory and configured reload | Deferred; no file manager/command bypass |
| Fleet-wide lifecycle / synthesized shared-node load | Only selected instance actionable; verified dedup rules | Prohibited cross-target controls; no sum of cgroup as machine CPU |
| Retained per-stage backup completion timestamps / automatic troubleshooting | Current job has phase and some proof flags, not complete historical execution graph | Do not mark every preceding stage completed; new history requires backend proposal |
| Production telemetry/SLA or 24h retention claim | Planning has local fixtures and source evidence | Live acceptance needs separate authorization/evidence |

## J. Highest-risk implementation decisions

1. **Data truth:** chart/time/summary changes could blend sources; retain projection/epoch contracts and exact-sample tests.
2. **Backup semantics:** visual stepper and action success could overstate completion; use actual flags/job state and independent source timestamps.
3. **Authority:** new availability explanations must not become a permissive authorization layer; dispatch still goes through session gate/review.
4. **Responsive console:** measured row/viewport geometry must follow text-size and wrap mode; bound DOM/retention under load.
5. **CSS migration:** remove old selector ownership gradually; final dark/light/large-text proof required, not just compilation.
6. **Asset/privacy:** original graphics must not increase provider requests, identify fictional skins or ship huge visual libraries.
7. **Source drift:** implementation base may differ from planning; audit before edits and again before PR readiness.

No row in this matrix grants permission for live operational testing or production changes.

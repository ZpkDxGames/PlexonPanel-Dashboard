# PlexonPanel 6.0 design plan — Deepslate

2026-10-08 UTC. M1 design only, on `release/6.0.0`. Source baseline `86b6a0cefb2c5e420c9c862a7897705e1ea59146`. [UI_6_DECISIONS.md](UI_6_DECISIONS.md) overrides the original brief; [UI_6_BASELINE.md](UI_6_BASELINE.md) and its control/data/state inventories are the parity contract. No production UI, hooks, CSS, fonts, dependencies, tests or version numbers have been changed. M2 requires maintainer approval.

## Design intent and principles

Deepslate is an instrument room: cool mineral surfaces, useful density and a clearly readable pulse of captured tick health. The identity comes from the Tick Pulse, numeric hierarchy and separate source authorities. No game textures, pixel fonts, cubes, logos, gradients or ambient effects. Light Quartz and dark Deepslate receive independent contrast-tested palettes.

1. Put current tick health and its age ahead of decoration. Source, capture and receipt are always recoverable; unavailable has a name, not a fabricated zero.
2. Give each workspace one main task: read console, inspect players, understand a durable backup, review file changes. Global authority lives once in the header; workspace copy explains only consequences relevant to that task.
3. Keep six Overview instruments, but let TPS/MSPT dominate; keep nine Performance charts, with Host CPU, Paper process CPU and service CPU explicitly distinct.
4. Navigation never executes. State-changing operations retain existing action-specific gates and bound confirmations; Configuration's approved extra save confirmation uses that same path. Signed results determine success; uncertain completion is never retried automatically.
5. Prefer source-aware rows and disclosures to piles of cards. Compact desktop density must never shrink phone touch targets. Phone typography grows while metadata moves below its subject.
6. Keep one transport, reducer, FleetFeed and preferences owner. A new signature graphic is a reader of existing observations, not a sampler or another telemetry store.
7. Use progressive disclosure without deleting controls: the M0 audit maps every old control to its destination and test. Settings, drawers and menus expose the existing scopes, not permission inferred from a role name.

## Tokens and measured color pairs

Proposed namespace `--ui-*`; files in `docs/ui6-design/` are documentation experiments, not production styles. Components eventually consume tokens only. Layer order: reset, tokens, base, primitives, workspaces, utilities. Quiet borders distinguish tone; essential control boundaries have their own stronger token.

| Semantic color token | Light Quartz | Dark Deepslate | Purpose |
|---|---|---|---|
| canvas |#F3F5F4 |#1A2025 | Application canvas |
| surface |#FFFFFF |#222A31 | Content plane |
| raised |#FFFFFF |#2B353D | Menus/dialogs |
| sunken |#E8ECEA |#161B1F | Logs, inputs, table wells |
| border-quiet |#D3DAD7 |#36424B | Decorative separation only |
| boundary |#637883 |#8196A5 | Essential input/control/focus boundary |
| text |#1B2227 |#E6ECEF | Main text |
| text-muted |#4A5963 |#B 7C3CB | Secondary text, units, axes, disabled explanation |
| status-ok |#186E4A |#77DCAC | Healthy/verified, icon + explicit word |
| status-warn |#765608 |#F1CE75 | Degraded/delayed/retryable, triangle + word |
| status-critical |#AD302C |#FFA6A0 | Failed/unsafe, square or failure icon + word |
| status-info |#245C9F |#99C5F5 | Pending/info, distinct arrowless activity icon + word |
| status-unknown |#53616B |#B 7C3CB | Unknown/not supplied, open outline + word |
| on-accent |#FFFFFF |#161B1F | Filled button text/icon |

| Stored accent | Existing visible label retained | Light interaction color | Dark interaction color |
|---|---|---|---|
| monochrome | Monochrome |#1B2227 |#E6ECEF |
| cyan | Plexon cyan |#146A85 |#89D9EE |
| violet | Violet |#654092 |#C5B4F1 |
| emerald | Emerald |#186E4A |#77DCAC |
| amber | Amber |#765608 |#F1CE75 |

The accent marks focus/selection/action, with text, shape and position distinguishing interaction from status even when the saved accent is emerald or amber. Status tokens never change with preference. Keep all five stored enum values, the v1 key and existing labels; **no new public accent names in this release**. For a missing preference key only, the proposed first-launch defaults are system theme and the existing cyan accent. Any existing saved key uses legacy defaults for malformed/missing fields and preserves all valid saved values; it must not silently opt that browser into the new OS default. Material names describe the design palette internally. Extra Lapis/Copper candidates in the experiment JSON are tested prospective colors, not new selectable capabilities or required shipped tokens.

Executed contrast calculation:134 required opaque foreground/background pairs passed; minimum normal text/status/accent text5.1362:1, minimum essential boundary 3.8763:1. The 8 quiet-border pairs fail essential-boundary thresholds by design and are restricted to decorative separators. [CSV](ui6-design/contrast-results.csv), [exact JSON](ui6-design/contrast-results.json), [palette inputs](ui6-design/tokens.json). Relative sRGB luminance uses unrounded ratios for threshold decisions. Every text/status/interactive foreground was measured against canvas/surface/raised/sunken in both themes, plus every on-accent fill pair. These are palette computations, **not a rendered-product WCAG certificate**.

No alpha text/status fills or unchecked color-mix tint is specified. Selected rows use an accent boundary/icon and opaque surface; focus is a 2 px boundary at 2 px offset with an inner canvas keyline. High contrast replaces quiet boundaries with essential boundary and removes area fill; forced colors uses Canvas/CanvasText/Highlight with borders and status words/patterns. Disabled text remains readable rather than made translucent. Hover uses a measured opaque surface change; no lift or glow. M2 must measure any new composite color before admitting it.

## Typeface decision and executed experiments

**Choose Noto Sans for UI and Commit Mono for console output, UUIDs, hostnames, paths and commands.** No general metadata/labels use mono; chart numbers remain UI sans with tabular figures. Exactly two designed families. Self-host through installed `next/font` guidance; no runtime font CDN and no runtime package dependency. Font files and OFL licenses are experiment evidence only until M2 vendors the chosen assets.

Three UI candidates were actually rendered: Hanken Grotesk, Schibsted Grotesk and Noto Sans. Public Sans and Source Sans 3 received binary coverage screening and were rejected before the rendered shortlist. Two mono candidates, JetBrains Mono and Commit Mono, were rendered. All packages pinned by recorded file SHA256 and version 5.3.0 in [font-results.json](ui6-design/font-results.json). The package is a distribution wrapper; it does not imply an upstream font version 5.3.0.

| Candidate | Actual tests / measured result | Assessment and choice |
|---|---|---|
| Hanken Grotesk | Rendered 12/13 px×400/500/600, tabular widths pass; Portuguese corpus complete; Extended-A 127/128 and B 32/208 | Compact, strong labels; missing long-s plus broader B glyphs forces fallback. Rejected for strict extended coverage, despite appealing personality. |
| Schibsted Grotesk | Same 6 rendered cases, tabular pass; Portuguese complete; A 127/128, B 22/208 | Wider numerals/clear weight distinction; takes more room in narrow rows; coverage fallback. Rejected. |
| Noto Sans | Same 6 cases, tabular pass; exact chosen Latin+Latin-ext wght files A 128/128 and B 208/208, no fallback in specimen; variable weight 100–900 | Clear Portuguese accents and counters at 12/13 px, less distinctive shape but best truthfully verified coverage. Selected; instrument layout/Pulse supplies identity. |
| Public Sans | Binary screening only, Portuguese complete; A 124/128, B 44/208 | Not rendered after coverage rejection; never claim a visual comparison was executed. |
| Source Sans 3 | Binary screening only; A 128/128, B 100/208 | Rejected for incomplete B before rendered shortlist. |
| JetBrains Mono | Rendered 12/13 px×400/500/600, monospaced digits pass; clear 0/O and 1/l/I; some extended specimen fallback | Legible, but slightly heavier coding-tool character and incomplete A. Runner-up. |
| Commit Mono | Same 6 cases; monospaced digits pass; Portuguese and all 128 A glyphs present; B 12/208 | Clear diagnostic glyph shapes and quiet punctuation. Selected for code/identifiers; use Noto Sans as same-system fallback for unsupported extended glyphs. Never claim mono covers all B. |

The experiment loaded local WOFF2 in actual headless Chromium 153. Thirty candidate/size/weight rows passed font-load and digit-width tests, with zero page errors. Chrome rendered-font inspection verified custom faces; Hanken/Schibsted/JetBrains/Commit fallback in the deliberately broad specimen was recorded, not hidden. Noto rendered the whole specimen from its custom face. All digits had equal measured advance within 0.02 px in each row; at 13 px / 400 Noto digits 7 px, Commit 8 px. Binary FontTools cmap/GSUB/fvar inspection complements DOM measurement. Portuguese corpus: `ã ç é ô Ã Ç É Ô á à â ä í ó ú ü ñ õ ê è`, plus broader extended letters. Images: [light specimen](ui6-design/font-comparison-light.png), [dark specimen](ui6-design/font-comparison-dark.png). Visual judgement is mine, not a user readability study.

Chosen Noto Latin WOFF2 is 35,820 bytes, extended 167,960 (combined 203,780). Commit 400 is 48,128 bytes; 500/600 about 48 KiB each. Prefer one normal mono weight 400 for production, using UI sans 500/600 for controls; avoid loading unused mono weights. Variable Noto provides 400/500/600 in one face per subset. Latin-extended inclusion is non-negotiable; preload/subset behavior must be verified against installed Next font API and cold-cache traces. Its comparatively large payload is a real M2 performance risk. Use swap/fallback metrics and reserved layout to reduce CLS; do not declare the LCP budget met from this experiment.

Type scale: base 14 px, ratio 1.125 (minor second), all tokens in rem relative to a 16 px root: small 0.77778 rem (12.444 px), body 0.875 rem, mobile body 0.984375 rem (15.75 px), subhead 1.107422 rem, heading 1.24585 rem, large 1.40158 rem, display 1.773946 rem (28.383 px). The 12/13 px experiment brackets the smallest UI label. Line-height 1.5 body,1.25 headings,1.65 console. Prose max 75 ch. Use 400 body,500 control labels,600 headings/numbers. Number containers have stable grid width with right alignment and tabular-nums; units occupy separate muted slots. Exceptional large actual values remain recoverable, never silently truncated to fit. Root text-scale100/112.5/125% scales all rem-based typography without globally scaling the interface.

## Space, shape, elevation and motion

| Token family | Proposed values | Application |
|---|---|---|
| space 1–8 |4/8/12/16/20/24/32/40 px as rem | Explicit tokens, not arbitrary padding per view |
| radius |3/6/10/16 px as rem | Inline status; controls; structural panels; floating dialogs/sheets |
| density compact/comfortable/spacious | desktop row 32/40/48 px; panel padding 12/16/20 px; content gap 12/16/20 px | Only density tokens change. Mobile interactive row/button min 44 px regardless compact setting. |
| focus |2 px essential boundary,2 px offset, inner canvas keyline | Visible in both themes; no glow |
| elevation | none for content; one 0 8 px 24 px shadow on floating layer | Tone+border do most separation; no stacked card shadows |
| feedback / floating transition |120/180 ms ease-out; max 240 ms | Opacity/transform only, response to action/state |
| row insertion |180 ms static highlight or one short fade | Actual new supplied event only; no flashing at idle |
| numeric update | Immediate | No count-up/tween; existing presentation cadence retained |

No workspace enter animation by default. Existing pageTransitions preference may enable a≤180 ms supported View Transition with immediate fallback; no global slide-up. `livePulse=false` disables sample-motion treatment while retaining the static informative strip; saved preference is not reinterpreted as a hidden health capability. OS reduced motion is a floor even with full selected; reduced uses instantaneous geometry and short opacity only; off is fully static. No idle “heartbeat”, hover lift, animated background or stale pulse. Operational connection/presence/backup/action events bypass presentation throttle exactly as today; no new timer per tile or chart.

Icons: existing inline SVG basis refined into one 16/20 px stroke set (1.75 px stroke, currentColor). Decorative icons aria-hidden; icon-only controls have explicit accessible names. No emoji, icon font, external asset or generic empty-state illustration. Status uses a different shape/word in addition to color.

## Shell and responsive structure

Desktop ≥ 1024: 224 px labelled rail (72 px optional collapsed state) + one main content scroll. Header holds selected server, separate Relay/Paper/Host authority, console-source disclosure, compact Pulse and navigation palette. Monitor: Overview/Performance; Operate: Players/Console/Chat/Plugins/Server/Backups; Manage: Configuration/Access/Audit/Settings. Fleet is global. Group names use sentence case. Match known workspace preference when switching; invalidate old action target and dirty-leave first.

Tablet 768–1023 uses the same focus-trapped navigation drawer as mobile, with wider main content; no partially visible icon rail. Below 768: 44 px menu/server/search controls, compact authority text, single-column content. No bottom navigation. Containers, rather than viewport alone, choose chart/table/panel columns. Supported layout stops 360/480/768/1024/1440/1920+; M0 captured 390/768/1280/1920, so 360/1024/1440 tests are still future gates. Wide content max 1600 px excluding rail; use useful paired reading areas instead of centering tiny cards in 1920 px emptiness.

Connection disclosure shows only actual signed agents/console authority and known receipt/capture ages. No invented per-agent last-seen timestamp. “Paper is offline. Console reading remains available from Host; commands are unavailable” only when the actual Host source/capabilities permit it. Unknown policy says “Not reported separately by the agent”; a signed refusal may identify the actual blocked layer. No client privilege shortcuts.

PaletteCtrl/⌘K navigates to workspace/server and an already loaded player drawer. “Recent operation” entries open the target workspace/context using session-only observed action metadata; they never rerun. Palette restart destination is Server, with its existing bound lifecycle confirmation. The existing Backups maintenance restart remains separately scoped maintenance.restart with its bound confirmation; do not delete that audited capability. Navigation shortcuts are discoverable in a?dialog and suppressed in input/textarea/contenteditable/IME; no hotkey executes operations. Dirty-leave and target invalidation apply to every navigation surface.

## Tick Pulse contract

This is the signature instrument, not a decorative animation. Large strip at top of Overview; compact header and Fleet instances read the **same current observed window**. Default1/5/15/30 follows existing chartWindowMinutes; a local window change affects that workspace’s report/pulse consistently, not a second preference store. Header compact version shares the selected observed window and states it explicitly; Fleet uses that preference and its existing per-instance history.

| Aspect | Exact proposed behavior |
|---|---|
| Data | Existing ControlState.history and metric-reports source semantics. Include only actual valid `sources.paperHealth` capture timestamps with TPS/MSPT from that same health capture. Legacy records without trusted Paper-health capture provenance remain available through existing report adapter but are omitted from Pulse with a clear provenance note. No polling, transport, second store or synthetic heartbeat. |
| Dedupe/order | Key by server and Paper-health capture millis; exact duplicate replaces. Sort real captures, apply existing window/cap bounds. Duplicate Host/JVM receipt cannot append Paper slots. On switch use the new instance’s observed data only. |
| Horizontal scale | Actual capture time in `[now-window, now]`; right edge labels Now. One graphical mark per real capture; slot spacing reflects time, not a uniform synthetic sampling cadence. Before observation started and after last capture are honestly empty. No presumed missing sample values. |
| Gap | Use existing gap criterion (≥1s or3×source interval as adapter defines). Draw a hatched **time region**, not fabricated sample columns; expose exact no-capture interval and observed coverage. Ordinary elapsed whitespace is distinct from a confirmed large gap. Never connect/smooth/interpolate. |
| TPS state | Documented presentation defaults in proposed single lib/tick-thresholds.ts:≥19 healthy;15≤TPS<19 degraded;<15 critical. Unknown TPS uses open/patterned mark+word. These are design defaults, not a server guarantee or new policy. No change to sampled values. |
| MSPT height | Linear0–100 ms viewport, explicit50 ms budget line halfway. Height uses actual MSPT. Above100 ms clip with an overflow marker and exact tooltip/table value. Actual0 draws a baseline stroke at 0, not a minimum-height fake value. Missing MSPT uses patterned height-unknown treatment, not0. TPS and MSPT judgments remain independent. |
| Freshness | Existing shared telemetry clock/freshness states; capture age, receipt age and display cadence separate. Delayed/stale/future/missing/disconnected gain text/pattern; don't dim text below contrast minima. Future invalid capture excluded from live marks and shown as clock-warning state. Cached history remains labelled observed/last-known. |
| Motion | Only an actually new healthy/fresh capture can receive≤120 ms insertion feedback when allowed. No ticking “now” animation at idle; clock recalculates elapsed position/age without smoothing. Stale/offline/reduced/off has no insertion slide. Frozen Performance inspection keeps captured display snapshot labelled Paused while receipt continues. |
| Tooltip | Timestamp in chosen locale/timezone, absolute+relative capture age, TPS, MSPT, Paper health source, available source cadence; receipt only when actual per-sample receipt exists. Do not label sample.at as receipt when it is capture-derived. |
| Keyboard | One roving focus target; Left/Right moves through real capture points, Home/End limits; focus visible. Pointer hit-testing selects nearest actual capture, tooltip contains exact timestamp. Touch opens the same anchored readout, tap away closes. Escape restores target. Do not create8192 tab stops or pretend each subpixel mark is a 44 px button. |
| Table | Inspect samples opens the real window’s capture rows, bounded 100/page and previous/next, all retained observations reachable, no remote history. Timestamp/TPS/MSPT/source/capture-age and unknown values match graphical marks. Text summary gives last capture, sample count, coverage and state; SR live region announces state change, not each tick. |
| Rendering | Native SVG grouped status paths (one bar subpath per capture), clip+pattern defs; no metric thinning in Pulse because “one mark per capture” is the signature rule. Max8192 retained observations existing cap, usually≤900 health samples in30min at 2s; actual advertised cadence may be faster. Keep existing geometry thinning for full charts, never claim thinned marks are Pulse samples. |
| Dense/mobile | Time scale can produce subpixel bars. Inspect via nearest capture and table; a labelled local zoom/scroll lens of already observed data may show≥2 px marks without aggregating or inventing values. Do not manufacture one-per-column summaries. Avoid forced entire-page horizontal scroll; lens is an intentional named well. |
| Fleet/header | Compact same-domain paths with sample-count/age text and Inspect destination. No unrelated miniature animation, no per-card timer, no resampling shared-node or process CPU into health. |

M4 acceptance must cover19/15/50 ms boundaries, real zero, null TPS/MSPT independently, duplicate/out-of-order/future timestamps, no health samples, exact-source joining, high source cadence, visible gaps, legacy provenance, frozen/offline data, head/table parity, keyboard/mobile hit testing, disabled motion and bounded draw work. These tests are planned, not executed in M1.

## Charts and reports

Keep all nine charts: TPS, MSPT, Host CPU, Paper process CPU, Host memory used, JVM heap used, online players, service CPU and service RAM. Group tick pair, Host/Paper resources, then players/service resources. Service CPU says “% of one core” and can exceed100; Host/Paper CPU each “% of machine capacity”. Units/metadata always use data inventory. GC stays in actual CSV/JSON export even without a tenth chart.

Keep geometry gap-aware extrema thinning, source-specific dedupe, timestamps, sample p95 and observed coverage. Add shared inspection **time**, not a shared made-up value: each chart resolves its own nearest real source capture and shows its own timestamp/age. Different cadence or missing captures never become coincident synchronized samples. Threshold lines TPS19/15 and MSPT50 ms are labelled defaults; use shapes/patterns and direct names, no color-only legends. Chart style/grid/layout/timezone preferences survive. Area option uses measured/essential stroke; fill is decorative and can be removed in high contrast. Offscreen rendering work paused, observers disconnected; reducer collection continues. Native renderers only, no chart library.

## Mobile and desktop wireframes for every workspace

[Interactive wireframe index](ui6-design/wireframes.html) contains30 rendered sketches (desktop+mobile for all 15 pages). Per-page SVG links below remain viewable without the index. These **rendered vector wireframes replace ASCII boxes** so long control/authority labels remain legible; they are layout documentation, not a built product or simulated server data. Labels refer to supplied fields; there are no invented metric values. Region boxes in low-fidelity sketches do not prescribe one shared final radius/card style; the role-based token specification controls final shapes.

| Workspace / sketch | Desktop layout concept | Mobile layout concept / preserved intent |
|---|---|---|
| [Fleet](ui6-design/fleet-wireframes.svg) | Global task header; supplied instance rows/cards with name, separate agents, tick health/mini Pulse, players and service resources; shared node table once | Stacked instance instruments; one 44 px Open target; shared infrastructure disclosure; Pair available. No fan-out operations. |
| [Overview](ui6-design/overview-wireframes.svg) | Pulse first; dominant linked TPS/MSPT instruments, online players as separate destination; heap/service CPU/RAM compact lower row; recent events/worlds paired; existing TPS/MSPT charts/table remain in Tick history disclosure | Pulse→TPS/MSPT pair→players→runtime row→activity/worlds→source/tick history. Six real tiles retained at unequal emphasis, no delta chips. |
| [Performance](ui6-design/performance-wireframes.svg) | Single report toolbar and observed coverage; paired source-labelled charts in deliberate groups, all 9; table/exports below | Chart layout preference retained (adaptive single by default); window/pause/export compact; all 9 in source order; bounded table. Do not drop charts to shorten screen. |
| [Players](ui6-design/players-wireframes.svg) | Local roster query plus scoped refresh; table row opens side drawer; recent supplied join/leave and scoped journal modal | Compact rows or saved table preference; tap target opens sheet; Details/Actions/Moderation; all 13 action gates and Owner restrictions; supplied-authorized location/address only. |
| [Console](ui6-design/console-wireframes.svg) | Log well dominates; one local toolbar/filter disclosure; aligned timestamps/invocation separators; scoped older Host history; sticky Paper-only composer | Header consequence+search, local controls disclosure, substantial read well, sticky IME/safe-area composer. Pause/clear says local, no delivery pause/server deletion. |
| [Chat](ui6-design/chat-wireframes.svg) | Plain readable stream and concise composer; local read controls; optional sender heads and exact time on focus | No bubble-card grid; text-first rows; scope-gated MiniMessage/send; bounded 200 live/100 cached; cache clear destination Settings. |
| [Plugins](ui6-design/plugins-wireframes.svg) | Inventory table and metadata drawer; pushed snapshot provenance | Compact name/version/state rows; detail sheet contains supplied authors/deps/website; configured reload only with existing gate/confirmation. Refresh semantics remain truthful. |
| [Server](ui6-design/server-wireframes.svg) | Host service state/unit/PID decisive; Paper connection separate; gated operation strip; actual pending-request steps and persistent signed result; runtime disclosure | Full44 px lifecycle targets; unknown disables; bound stop/restart effect; Start retains current classification; no invented historical service timeline. |
| [Backups](ui6-design/backups-wireframes.svg) | Readiness beside initiation; actual durable phase operation spanning width with **one** counter/progress region; retained backup rows; scheduler/retention separate disclosures | Readiness reasons stay visible; pick countdown then bound Confirm Fully Backup Now; one progress region; provider test/verified timestamps distinct; Retry Upload and safe diagnostic accessible; settings do not compete with active job. |
| [Configuration](ui6-design/configuration-wireframes.svg) | Pinned server/agent/root/path and dirty state;30/70 file browser/editor split; actual diff review; existing bound save path; scoped operations menu | Browser→selected editor flow with dirty Back/leave guard; review sheet and bound save; read-only Host truth;24 KiB text edits, create/upload/rename/delete and SHA-verified download/cancel preserved. |
| [Audit](ui6-design/audit-wireframes.svg) | Timestamped actual result rows with actor/action/target/result, expanded safe detail, accessible table; query filters separate from loaded-page search | Source+search then filters disclosure; actual bounded 50 rows; previous/next and safe copy; full-vs-self authorization retained. |
| [Access](ui6-design/access-wireframes.svg) | Readable device metadata; known effective-permission intersection; immutable-grant explanation; device list/search/role/refresh/details/revoke | Stack key/value pairs (fix390 px wrapping); no self revoke; forget local vs revoke explicit; active Files/Backups copy; newly introduced scopes require re-pair. |
| [Settings](ui6-design/settings-wireframes.svg) | Appearance+small live preview; Charts/Players; Data & privacy; Connection/About | Considered fieldsets/disclosures, every 19 stored fields retained; Clear local chat cache100, separate visual reset, legacy cleanup entry, real metadata and relay hostname only. |
| [Pairing](ui6-design/pairing-wireframes.svg) | Operational form first, short local-approval trust explanation beside it | Name/code/approval task before marketing copy; existing signed Protocol 3 and session validation; busy/error/expired/unpaired/saved-server paths. Never record entered code. |
| [Legacy archive](ui6-design/legacy-archive-wireframes.svg) | Small unverified old-data cleanup page reached from Settings; actual local filters/rows/clear | No empty headline-stat grid; retained bounded local archive only, native confirmation; no new capture or merge with Paper journal; keep until retirement proved. |

## Action, state and privacy system

Every control in [UI_6_CONTROL_AUDIT.md](UI_6_CONTROL_AUDIT.md) must receive an implementation owner/proof before its old owner is removed. Local UI operations remain local. Query controls use existing query owner, operational buttons use existing can/run action alias and bound target; no new transports or hand-written capability shortcuts. The generic action progression has a confirmation step when existing action requirements or approved file-save review demand it; it does not add pointless modal confirmation to every chat message. Section 8.2 universal wording is interpreted with the existing §3 action-specific requirement, retaining current HIGH_RISK classification and the approved file-save addition.

Bound confirmation shows server, immutable action and target parameters (player name+short UUID, exact file path/original hash, service unit when actually supplied). Rechecking can/session after review is mandatory. If supplied target metadata is missing, say not supplied rather than fill an assumed unit. Pending disables dispatch and keeps effect/context visible; signed success or failure persists inline, toast adds attention, Audit link only if authorized and an actual recorded/queryable item exists. Busy/refused/uncertain error remains discoverable and never auto-retries. No typed confirmation added unless already required.

Backup details: exact 15 phases QUEUED→PREFLIGHT→COUNTDOWN→FINAL_SAVE→STOPPING_SERVER→WAITING_FOR_STOP→ARCHIVING→HASHING→VERIFYING_LOCAL→UPLOADING_REMOTE→VERIFYING_REMOTE→CLEANING_LOCAL→STARTING_SERVER→VERIFYING_STARTUP→COMPLETED; DEGRADED/FAILED/RECOVERY_REQUIRED separate outcomes. Current phase, supplied durable timestamps and verification flags distinguish pending/observed/completed; do **not** assume every earlier phase was successful because an enum is later. The ordered phase guide is workflow definition, not proof all phases occurred. Counters/rate appear only from current matching live payload; when absent say “not supplied”. Countdown clock uses only supplied remaining/deadline, not an inferred job start. A reload reconstructs Host status and cannot cancel job. No compression/upload twin bars, automatic backups, snapshot creation, restore, credential controls or Host-tree writes. Restart scheduler independent; canonical remote ZIP semantics preserved. Fully Backup Now and Retry Upload names stay exact.

All workspaces receive an error boundary with recover action and8 designed states, using [baseline matrix](UI_6_STATE_MATRIX.md). Loading has truthful shaped skeletons (no invented rows/numbers), empty distinguishes no source data vs no matches vs scoped unreadable; stale/disconnected retain labelled last-known data; partial panels show their independent authority; forbidden explains known scope and re-pair requirement; busy holds target; error keeps safe code/stage/requestID if supplied. States are parameterized by known fields, not a fabricated backend-status enum. A local browser-only Settings control is not labelled forbidden merely because Host is offline.

The disabled explainer orders known blockers: invalid/expired grant or contract, incompatible target, disconnected authority, missing canonical scope, absent advertised capability, Owner-only rule, known state/preflight/busy requirement, confirmation pending. Agent policy unknown remains unknown; an actual refusal can name its reason. Access visually presents known intersection; no separately measured local-policy checkmark is invented.

Session-only activity tray, bounded 50 metadata items: observed connection changes, this tab's action/result metadata and supplied backup-phase transitions. It belongs beside existing shell operation state, not a persisted second telemetry/audit store. No command parameters/content, console text, chat or player history in tray. Navigating to a target is permitted; replaying action is not. Hidden audit record IDs/timestamps are not synthesized.

Chat cache remains existing safeCache max 100; Settings “Clear local chat cache” clears the selected server’s stored chat slice through the existing browser-store owner. The persistence path must prevent pre-clear observations from being immediately re-cached on the next telemetry update, while new real chat may populate the bounded cache. Preserve the current local reading view unless the control explicitly explains otherwise; a local clear watermark belongs to this existing cache owner, never a second store. Explain the selected-server scope and that new messages can repopulate the cache. Do not clear credentials, audit, console, telemetry or server chat as a side effect. Visual reset is independent. Heads remain optional/disable-able, provider disabled yields zero requests, fallback remains until actual canonical Core field lands. No analytics, service worker caching, third-party fonts or unredacted content in DOM/export/diagnostics; logs/chat rendered as text, safe external links noopener+noreferrer.

Virtualize bounded console/chat only with platform primitives when buffer length warrants it, preserving text selection, search/filter/export over authorized full bounded data, copy actions, focus/scroll anchors and screen-reader reading. Never virtualize by deleting source history. Keep a nonvirtualized bounded accessible read/table mode if selection/assistive behavior cannot be proved. No new runtime library planned. Virtualization performance/selection semantics remain an M5 risk.

## Anti-template self-review against §6.2

Written review pass1 found several generic answers; pass2 changes below are already incorporated in layout/spec. This is plan self-review, **not screenshot certification of unbuilt6.0 UI**.

| Workspace | Generic temptation | Revision recorded / accessory removed |
|---|---|---|
| Fleet | Identical server cards and four headline KPIs | Per-instance source instrument; shared node once; removed duplicate connection sentences/count-stat strip. Instance identity can be consistent without equal metric cards. |
| Overview | Six equal rounded metric cards with deltas | Pulse first, dominant TPS/MSPT pair; player destination then compact runtime strip; removed invented delta/trend chips and expanded duplicate charts from initial viewport (charts remain disclosure). |
| Performance | All9 charts same-sized cards and giant summary numbers | Three task/source groups, shared inspection time and real coverage; removed duplicate workspace intro/source paragraphs. No chart removed. |
| Players | Profile-card grid with every action exposed | Readable roster row→target-bound drawer; action hierarchy separated from history; removed per-row stand-alone Manage strip on phone. |
| Console | Dashboard cards surrounding a little terminal | Large log-reading plane and single compact toolbar; local filters disclosed; removed repeated retained-history paragraph and redundant global Refresh action from primary view. |
| Chat | Colored bubbles/cards plus animated sender avatars | Plain text-first stream, quiet identity/time, scoped composer; removed message card chrome and ornamental heads from compulsory path. |
| Plugins | Colored plugin tiles with install/update actions | Supplied inventory rows and metadata drawer; removed imagined management actions and redundant installed/shown badge pair. |
| Server | Three equal bright lifecycle buttons and decorative uptime timeline | Host state leading, gate/effect-specific operation strip, current pending result only; removed duplicated agent connection card and invented state history. |
| Backups | Two pretty parallel progress bars and completed-phase ticks | One matching durable phase display with supplied counters; workflow guide separate from completion proof; removed destination credential-like panel and repeated safety prose. |
| Configuration | Code editor demo with fake sample config | Actual signed file workflow, pinned authority and actual diff; operations menu secondary; removed explanatory intro panel before editor. |
| Audit | Fancy activity feed of made-up avatars/actions | Actual bounded query result; source/self/full scope visible; removed event icon/color noise and duplicate result badges. |
| Access | Role tier cards with enable-permission toggles | Immutable device/key-value and known intersection, truthful policy unknown; removed “Advanced/Future” and any edit-grant affordance. |
| Settings | Huge tile grid and elaborate “personalize” hero | Plain fieldsets, small actual preference preview, data/privacy distinct; removed repeated browser-local badges and reset-as-primary. |
| Pairing | Marketing hero, numbered decorative journey | Local pairing task first; brief trust instruction; removed slogan and ornamental numbered labels (real procedure text remains accessible). |
| Legacy | Four empty analytics cards | Small old-data cleanup surface with clear unverified provenance; removed total/joins/leaves/unique headline cards, local filters preserved. |

| Rejection rule | Plan self-review result |
|---|---|
| Six identical cards, gradients/delta chips | Rejected; six inputs survive unequal hierarchy. No delta exists to invent. |
| Cream/serif/terracotta; near-black acid-green/red; broadsheet rules | Cool Quartz/Deepslate, sans UI, constant multi-status colors; thicker functional boundaries and tone. No editorial hairline layout. |
| One radius/shadow everywhere |3/6/10/16 by role; no content shadow, one restrained floating shadow. Sketch boxes are schematic regions, not final cards. |
| Gradient/glass/glow | None. Focus uses solid keylines, Now a solid rule; no exceptional decorative use. |
| Tracked capitals/eyebrows, middle-dot metadata, trailing arrows, unearned numbers | Sentence-case nav/headings, labelled source/value groups on separate lines; no repeated category eyebrow or arrow-suffixed action. Actual countdown/phase sequence may enumerate only a real sequence. |
| Heading word accent or meaningless label | No colored heading word, “selected instance” duplicate eyebrow removed; server identity belongs to target header. |
| General monospace labels | UI sans for all labels/numbers; mono for actual code/identifiers only. |
| Universal section entrance/hover lift/count-up/ambient animation | None. Actual action/capture feedback only, instant numeric values, static motion-off. |
| Emoji/stock illustrations/lorem/fake shipped data | Inline SVG; plain real next-step empty copy; doc sketches use field labels, no fake metrics/production values. |

The strongest remaining template risk is letting instrument rows become another six-card grid during implementation. M4 review must compare hierarchy at 390 and 1920 before accepting it. Noto is deliberately quiet; identity must not be rescued with decorative type/texture if Pulse is hard to implement. Each later milestone screenshot critique removes one accessory again, without deleting a control or hiding truth.

## Engineering handoff, risks and milestone boundary

| Owner preserved | Later presentation change / proof |
|---|---|
| data-source, reducer, FleetFeed, browser-store, generated contracts | No parallel owners; M3 signed two-room mounted flow remains anchor |
| dashboard action/selection/confirmation logic | Extract with tests before new shell; target invalidation/grant intersection unchanged; Host-only correction explicitly M3 |
| ui-preferences/provider | Key/enums 19 saved fields survive; absence-only OS theme default, no destructive migration; test malformed and full 5.0 blobs |
| metric-reports, chart-geometry, shared clock/freshness/display cadence | Pulse reader/additive constants, rendering only; all source/unit/window invariants tested M4 |
| files diff/download/dirty guards | M7 existing bound save route only; hash conflict keeps edits; pinned source preserved |
| backup-readiness and signed Host queries | M6 exact phases, job reconstruction and one optional counter payload; no protocol change |
| unused cpu-load and legacy cleanup | Remove unused CPU helper/tests only approved M8; keep archive/skin fallback until retirement evidence exists |

Riskiest choices:

- Pulse exact capture marks at high source cadence/mobile subpixel density. Grouped SVG plus roving/table inspection must remain fast and truthful; reject any “helpful” aggregation that silently breaks one mark per sample.
- Noto's 203,780-byte UI subsets plus mono. Coverage beats a small stylish font, but cold mobile LCP/CLS need measured fallback/preload strategy; no performance pass claimed.
- Disclosure depth for tick charts, console filters and backup scheduling. It removes repetitive chrome but must not bury emergency workflow or existing parity controls; keyboard and 390 px task walkthrough are necessary.
- Shell extraction and new file confirmation. Visual simplicity cannot alter immutable target/authorization or conflict preservation; existing mounted regression is the gate, not static source grep.
- Virtualized log/chat selection and scroll anchoring; test realistic long lines, filters, pause, copy/export and IME while telemetry arrives.

Conflicts resolved by decisions: missing Host state fallback; six tiles/nine charts; two hypothetical backup streams; palette restart; new accent enums/default overwrite; no-chat-persistence wording; active Files/Backups copy; dead CPU cleanup; file confirmation path. Additional code/brief limits: no retained service-state history array, no independently exposed local-policy/agent-last-seen fact, pushed Plugins/Performance refresh is not a query, no per-sample receipt timestamp in observed Sample. Omit invented surfaces, label unknown, retain actual local pending operations. No backend modification is required or requested.

This plan and its font/contrast/wireframe experiments are M1 deliverables. Production design, actual accessibility cleanup, preference migration tests, Pulse, error boundaries, virtualization, performance budget, Vercel preview and live acceptance are **not executed**. M1 ends with npm run check and its documentation commit. Do not start M2 until maintainer approves this direction.

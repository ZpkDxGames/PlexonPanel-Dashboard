# PlexonPanel 6.0.0 revamp audit

## Visual contract
The supplied prototype uses translucent light cards on an indigo, sky and violet canvas, a deep navy sidebar, 24px card corners, layered shadows and generous padding. Its five KPI cards pair colored icon chips and sans-serif tabular numbers with contextual pills and miniature charts or segmented gauges. The hero combines an adaptive teal area chart, threshold, floating tooltip and segmented controls, while the console stays navy in both themes with badges, plugin tags, semantic tints and compact rows.

Reference inspection: all nine PNGs viewed; complete supplied SKILL.md read; prototype opened and captured in Chromium (including its complete style block). The ZIP contains reference/ only; the separately attached identical skill is copied to docs/revamp/SKILL.md. Base: main at 0ccb709. Branch: revamp/6.0.0. No AGENTS.md is present.

## Stack and boundaries

React 19.3, TypeScript 7, Vite 8.3, npm lockfile, Node 24; lazy hash routes; project-owned SVG charts/icons, Motion 14.1; static Vercel SPA with CSP. Preserve the adapter, protocol-3 contracts, IndexedDB credential identity, signed grants, selected-room generation, passive fleet isolation and server authority. No backend or framework migration. English remains the UI language.

Existing documentation describes files as intentionally omitted by an earlier request. This task explicitly requests Files, so expose only the already declared files contracts, gated by scopes and capabilities. No new backend endpoint is assumed. Worlds reuse existing telemetry; Schedules use declared maintenance settings; Logs reuse retained console history and supported file listing. Unsupported world editing, plugin toggles, network/per-core telemetry and arbitrary cron execution receive clear unavailable states.

## Feature parity checklist

| Existing feature / controls | 6.0 destination |
| --- | --- |
| First-run splash, relay origin recovery, one-time pairing, browser device name | Pairing entry + Settings (unchanged authentication) |
| Fleet rows, selected server, passive rooms, open room | Fleet + persistent top-bar selector |
| TPS, MSPT, process CPU, heap, chunks, source freshness | Overview KPIs + Performance + Worlds |
| Tick/CPU/memory graphs, crosshair, series toggles, sample tables | Shared adaptive chart abstraction |
| World table, density | Overview + Worlds + Performance |
| Start/restart/stop, signed action review | Overview server header |
| Console search, level filter, pause, wrap, export, clear/undo | Console premium toolbar; no controls removed on mobile |
| Console execute through HOST/PAPER authority | Console prompt + existing reviewed dispatch |
| ANSI, legacy and MiniMessage safe display | Shared FormattedText renderer |
| Global chat, MiniMessage compose, preview/send | Console Chat tab |
| Plugin inventory and reviewed reload | Plugins route + Console Plugins tab |
| Player search/UUID/world filter, roster selection, skin preference | Players + Overview widget |
| Message/kick/ban/whitelist/gamemode/heal/feed/kill/op/deop | Player detail + consequence dialog |
| Typed player command and LuckPerms permission builders | Player detail; preserve validation |
| Backup preflight, phase, list/create, warning duration, verify/delete/retry | Backups; preserve strict readiness gate |
| Devices list/revoke, signed scopes, audit filter/refresh | Access & audit |
| Relay save/reconnect, pair another, theme/density/motion/timezone/skins | Settings |
| Build identity and redacted diagnostics | Settings / About |

## Data sources

| Feature | Endpoint/channel and shape | Authentication / refresh |
| --- | --- | --- |
| Pairing | POST /v1/pairings/claim {code,name} → credential | One-time code; user initiated |
| Session | GET /v1/dashboard/session → signed device + WSS URL | Bearer stored credential; connection/reconnect |
| Live feed | WSS /v1/dashboard, protocol 3 ready/telemetry/inventory/console/chat/action messages | Signed per-room authorization; push; heartbeat 15s |
| Metrics | server {tps[],averageTickMillis,onlinePlayers,maxPlayers}; system {processCpuPercent,jvmHeap*Bytes,gcPauseTotalMillis}; hostSystem; service | Independent capture and receipt clocks; shared 1s UI timer |
| Charts | normalized Sample[]; maximum 8192 points / 35 minutes | Existing reducer bounded history; push |
| Players/worlds/plugins | normalized inventory JsonMap[] | Scope filtered; roster max 512, worlds max 64 |
| Console | id,capturedAt/receivedAt,level,source,content/rawText | Existing bounded 2500 lines, push; no fabricated production output |
| Chat | playerName/playerUuid,message,capturedAt | chat.view; push |
| Lifecycle/players/chat/plugins | session.prepare → session.execute typed action + parameters | Scope/capability/agent/generation checks; explicit review; no automatic mutation retry |
| Backups | backup.preflight, maintenance.status, backup.full.list | HOST query on connection/generation + explicit refresh |
| Files | files.list/read/write/create/rename/delete/download/upload declared actions | Signed scope/capability; file writes require hash conflict check |
| Schedules | maintenance.settings.get/update + maintenance.restart.now | HOST; read on mount; reviewed configuration mutation |
| Access | devices.list, audit.list {limit:50}, devices.revoke | HOST; mount/generation + explicit refresh |
| Build | GET /build.json → dashboard,commit,builtAt,protocolVersion | Static nonsecret identity; once per Settings mount |

See src/adapter/scopes.ts for complete action aliases. No endpoint, grant or payload shape will be silently changed.

## Concrete UX issues

1. The existing canvas and cards are flat; no prototype depth.
2. Card corners are 11px rather than 24px.
3. KPI values share a joined strip without icon chips, trends or sparklines.
4. Numbers use monospace beyond the terminal.
5. TPS and MSPT are flattened by a shared fixed 0–100 axis.
6. No server header/MOTD/control composition.
7. Repeated provenance/clock warnings compete with health information.
8. Console rows lack semantic grouping and collapsed traces.
9. Console controls disappear at mobile breakpoints.
10. Command palette input does not filter results or support arrow selection.
11. Mobile navigation has no More entry for all routes.
12. Dark is forced by default; system preference is ignored on first load.
13. Player fallback is a letter rather than a pixel head.
14. Idle/offline states leave graphs and supporting panels without purpose.
15. Inventory features are buried in Console tabs; unsupported capabilities lack first-class destinations.

## Risks and decisions

- Preserve CSP, relay origin allowlist, stored pairing and reconnect hotfix. Vercel stays a static Vite build. Theme bootstrap must be an external self-hosted script because script-src disallows inline scripts.
- All production text stays React text/segment nodes; no raw HTML. Demo is development/verification only, clearly labeled and never contacts live services.
- Maintain source-specific staleness; show unavailable values as dashes, real zero as zero. Derived sample statistics are labeled as sample statistics, not per-tick p95.
- Protect stop/restart, console danger, file delete/write, backup restore/delete and OP/ban with existing native modal review; initial focus is Cancel. Agent completion remains authoritative.
- Avoid blur on every scrolling row: only shell/header and selected large card groups blur; opaque fallback retains geometry.
- Keep long logs virtualized with measured/expanded row sizes and a bounded upstream buffer. Preserve view while disconnected.
- New frontend queries must discard results after server/generation changes. Never reuse a file draft or action target across instances.
- Browser QA uses an npm-distributed Chromium binary because the standard Playwright CDN download is unavailable in this environment. It is a local QA dependency only.
- Self-host Plus Jakarta Sans to match the prototype. Add @fontsource-variable/plus-jakarta-sans only; replace Manrope. No additional runtime chart, editor or icon library. Bundle impact measured after build.
- Long-range charts cannot imply 24h/7d retained history: show the available window and explain the 35-minute limit.

## Information architecture

Overview → Console → Players → Performance → Worlds; manage: Files → Backups → Schedules → Plugins → Logs; workspace: Fleet → Access & audit → Settings. Existing Console Chat/Plugins tabs remain. Add hidden #Styleguide for component review. All routes use the same ported tokens, card headers, controls and responsive shell.

## Baseline and verification

Before screenshots: docs/revamp/before, eight existing routes × light/dark × 1440/390. Final matrix: each new page × light/dark × busy/idle/offline × 1440/390, plus 360/768/1280/1920 responsiveness and accessibility checks. Real backend authority is not available to local fixtures; fixture interaction results and production bundle/auth contract verification will be reported separately from live server certification.

## Final implementation decisions

- The theme bootstrap moved from a separate blocking file to one hash-pinned inline script. Vercel CSP allowlists only its exact SHA-256; a unit test and build inspection compare the bytes. This keeps prepaint theme selection and removes an extra blocking request without unrestricted inline script permission.
- The minimum splash is now 250ms (storage initialization still gates entry). Pairing/auth behavior and credential persistence remain unchanged.
- CPU/heap availability and CPU-chart Live state use independent JVM capture/receipt freshness, while TPS uses Paper health. Fresh Paper samples cannot make a stale system capture fresh.
- Source review of Core confirms files parameters, 24 KiB text bounds, server-root path joining and hash conflict checks. Writable file operations may use Paper when Host is read-only and Paper advertises signed authority.
- Screenshots use the original supplied palette. Component text inks were strengthened only where automated AA checks found insufficient contrast; categorical hues were unchanged.

## Owner refinement (2026-10-12 UTC)

The owner requested smoother and denser charts, faster configurable display, independent hover, skin loading, extra Host metrics, fewer pages, more settings/custom controls, corrected icons and the selected server icon. This supersedes the earlier requirement to retain the newly added Files and Plugins pages: both routes/components are removed; Console's original plugin tab and all protocol actions remain. Logs becomes Activity, focused on presence, world-generation warnings/errors and backup incidents.

Chart diagnosis: restarting a full sample-interval wrapper translation plus unquantized axis recomputation caused visual instability. Removed shared hover context and wrapper animation. Each chart now projects metric points on its own source capture timestamps, keeps quantized bounds until Fit scale, and morphs bounded geometry for 220ms. The endpoint uses the same coordinates as its line. A source with no samples says Awaiting sample; one sample says Collecting history. Dense geometry is interpolation of received observations, never additional telemetry. Display buffering is 50/100/250/500/1000ms (default 100ms, previously 500ms); actual capture cadence remains controlled by Paper/Host.

Host schema verified in Core's protocol SystemMetrics and reducer: logical processors, load averages, physical memory/available memory, swap, disk usage/available capacity, periodic server directory size, OS and architecture. The existing systemd cgroup service CPU (% of one core) and memory are charted separately from Host and JVM. Missing fields receive one compact summary. Per-core/network/disk I/O are not invented; a continuously running relay alone cannot supply measurements absent from its Host payload.

Skin default becomes automatic username-based lookup with mc-heads → Minotar → Crafatar fallback. Legacy default Crafatar preferences migrate to Auto; deliberately disabled and other choices remain. Provider fallback is checked with intercepted provider responses, not a live player/skin certification. Bedrock names need a texture source and retain the honest pixel fallback.

The protocol does not supply a server icon field. When advertised/permitted, the UI requests server-icon.png through existing signed files.download/chunk/cancel contracts, verifies transfer identity/size/SHA-256 and PNG decoding, and stores a 64×64 PNG per instance. One attempt per source session is coalesced across logo instances; Settings can retry/load a local copy/reset. Transfers are never silently redirected to a different server.

Custom button/listbox selects replace settings/player/backup OS controls; scrollbars and file-selector button are themed. Indigo/teal/sky/rose interface accents do not recolor categorical metric series. No runtime dependency or backend/config schema was added.

## 6.5.0 refinement audit (2026-10-12 UTC)

The owner supplied a 1577 × 929 Console capture after the 6.0.0 refinement. It shows the route heading occupying the sticky top-bar row, an empty retained console, and the command composer disabled with a device-scope message even though the signed device is labelled Owner. This release treats that exact viewport as a regression target in addition to 360, 390, 768, 1024, 1280, 1440 and 1920 px widths.

### Findings

1. **Owner authority is evaluated in overlapping layers.** `reconcileDeviceGrant`, `effectiveScopes`, `canAction`, `session.reason` and route-level disabled states each interpret the grant. A verified Owner can therefore be shown as denied when the signed and reported arrays are stale or when the active console stream comes from Host even though command execution belongs to Paper. The Core protocol already defines `Owner = Scopes.ALL` for newly paired devices. The Dashboard will use one effective-authority resolver, expose the complete known Owner scope set, and select the capable action target. Agent presence, instance binding, live evidence, high-risk confirmation and explicitly disabled/unsupported server capability remain separate operational gates.
2. **The chart viewport is data-shaped rather than time-shaped.** Its X bounds use the first and last received points, so a new or recovering session continually stretches and reflows the plot. The Y domain only expands until a manual reset. Tooltip positioning is tied to the whole chart block and can crowd controls at narrow widths. The 6.5 chart will use a fixed requested time window, a bounded hysteresis domain, responsive tick density, clipped floating inspection, and stable plot geometry. Received observations remain the only source data.
3. **Responsive shell behavior lacks an explicit content row.** The sticky bar and route content share an implicit block layout, while the full Console computes height from viewport constants. This is fragile at short desktop heights and produced the supplied overlap. The shell will use explicit grid rows and the Console will size against its available content container with bounded minimums.
4. **The style layer contains superseded selectors and malformed duplicated rules.** Removed Files-route selectors remain, and the ported reference sheet contains duplicate opening selectors for `.search` and `.btn:hover`, causing subsequent declarations to be parsed as nested CSS in modern browsers. These are deleted or repaired rather than patched over. Console Plugins selectors remain because that original tab is still active.
5. **Some fixed minima overflow compact viewports.** Fleet rows intentionally force a wide table, full Console imposes a 530 px mobile minimum, graph labels assume five ticks, and several flex headers rely on clipping. The release will preserve horizontal tables only inside labelled scroll regions and make every other component reflow without page-level overflow or clipped controls.

### 6.5.0 boundaries

- No endpoint, token, relay origin, signature, generation binding or server identity rule changes.
- Owner means every scope known by the negotiated Dashboard contract. It does not fabricate an action handler or treat an offline agent as available.
- The Dashboard cannot rewrite an immutable credential already stored by the server. A server-side `SCOPE_DENIED` remains authoritative and is surfaced plainly; no client-side success is inferred.
- Graph interpolation is visual geometry between received observations. It never creates telemetry samples or changes retained history.
- Removed route CSS and duplicate presentation rules are deleted. Historical 6.0.0 evidence stays intact under `docs/revamp`; 6.5.0 evidence receives its own directory.

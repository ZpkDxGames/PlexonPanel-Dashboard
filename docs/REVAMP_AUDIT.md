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

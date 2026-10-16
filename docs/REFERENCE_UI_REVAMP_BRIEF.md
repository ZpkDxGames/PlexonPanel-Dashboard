# PlexonPanel — Complete Reference-Led UI Revamp

**Execution brief for GPT-6.1 Sol, xHigh reasoning**
**Prepared:** 2026-10-15, America/Sao_Paulo
**Frontend:** https://github.com/ZpkDxGames/PlexonPanel-Dashboard
**Backend reference:** https://github.com/ZpkDxGames/PlexonPanel
**Product:** A polished Minecraft server control panel, guided by the four supplied images.

> Rebuild the entire frontend presentation around the reference direction: a dark blue/charcoal application shell, persistent navigation, rounded operational panels, a console-led server overview, rich usage charts, and detailed player screens. The existing dashboard supplies working behavior and integration contracts. Its current visual design is not the starting template.

This is an implementation specification for the next redesign. Preparing this brief does not itself modify the application or authorize a new production deployment.

## 1. What the owner actually wants

The preceding designs did not match the desired product. Do not respond with another font change, palette adjustment, slightly rearranged page, editorial register, or oversized chart surrounded by the same composition.

Build a professional **Minecraft hosting and server-management application**. It should feel closer to the supplied control-panel references than to a generic analytics dashboard, marketing website, or minimalist document.

The visual destination is explicit:

- A persistent desktop sidebar with clear navigation groups and a compact selected-server context.
- A restrained server header with identity, connection state, relevant metadata and reviewed lifecycle controls.
- Rounded blue/charcoal panels with clear surface hierarchy, consistent spacing and comfortable density.
- A practical overview with server information and quick tools on the left; console output and usage visualization on the right.
- Player profiles with a prominent identity header, organized session evidence and separated moderation tools.
- Configuration-like panels with well-aligned fields, switches, sliders and explicit save behavior where real contracts support them.
- Strong blue/cyan accents, readable neutral text, consistent icons and smooth, purposeful interactions.
- Complete desktop and mobile experiences at 100% browser scale, plus an independently designed light theme.

Preserve the useful nonvisual engineering already delivered: trusted sessions, source-aware charts, safe action review, bounded histories, route loading, telemetry reduction and accessibility behavior. Replace the visual architecture surrounding it.

## 2. Reference interpretation — use these as the visual contract

The owner supplied these four images. The filenames identify the attachments; their observations below make the brief usable even when an agent cannot open the files. If available, inspect all four before designing.

| Reference | What it demonstrates | Required translation into PlexonPanel |
| --- | --- | --- |
| `image(20261016-010602).png` | Three-column settings workspace: gamerules and whitelist; view/simulation distance, MOTD and server icon; backups, datapacks and integrations. Dark navy surfaces, rounded panels, cyan icons, aligned controls and compact rows. | Use its panel geometry, field alignment, grouping and practical information density. Rebuild supported Settings and Backups tools with this level of organization. The screenshot does not prove the backend supports its features. |
| `image(20261016-010617).png` | Player detail page: identity/status/UUID, prominent playtime, three summary cells, action row, session-history panel and admin-notes panel. | Build a real player detail experience with this hierarchy, UUID-bound actions and truthful session evidence. Only show playtime/history/notes when their data contracts exist and access permits them. |
| `image(20261016-010639).png` | A framed hosting dashboard: left navigation, quiet Minecraft scene behind the server header, contextual tabs, left information column, large console and a usage chart beneath it. | This is the principal composition reference. The app fills the viewport; the surrounding blue presentation background and rounded screenshot frame are not application UI. |
| `image(20261016-010647).png` | Clearer, wider hosting dashboard: consistent sidebar, server identity, top-right stop control, aligned information/console columns, quick tasks and resource progress rows with an actionable warning. | Use its legible scale, coherent panel boundaries, balanced columns and operational hierarchy. Translate warnings and resource bars only from authoritative data. |

**Reference priority:** images 3 and 4 define the application shell and Overview; image 1 defines forms and operational modules; image 2 defines player detail.

Keep PlexonPanel's own name and identity. Do not ship Shockbyte branding, the sample server names, billing plans, fake notifications, screenshot text, third-party logos or example numbers as real product content. Use an original, locally hosted Minecraft-inspired header treatment; readability must not depend on artwork.

### Mandatory differences from the currently deployed design

| Current Operations Desk presentation | Required replacement |
| --- | --- |
| Horizontal application workspace bar | Persistent grouped desktop sidebar; responsive mobile drawer |
| Forest/paper palette and fern/clay emphasis | Charcoal/navy surfaces with blue primary actions and selective cyan accents |
| Flat registers and broad uninterrupted instrument surfaces | Deliberately grouped panels, clear surface elevation and compact data modules |
| Large editorial headings and document chapters | Operational titles, compact context and task-oriented forms |
| Overview dominated by a landscape tick canvas | Server information + console + resource monitoring composition |
| Player inspection primarily in a side dialog | A substantial player profile view within Players, with a clear return path |
| Settings as a long anchored document | Organized settings navigation and responsive panel groups |

The new design must pass this comparison in actual rendered screenshots. A blue version of the existing DOM fails.

## 3. Verified starting point and required reconnaissance

At preparation, `origin/main` was re-fetched and resolved to:

`cea185cca07d9892967215baed097bedbe0e77ca`

This is the published Operations Desk release, tagged `dashboard-operations-desk-2026.10.15`. Its release and deployment records are useful engineering baselines, not visual targets:

- Release: https://github.com/ZpkDxGames/PlexonPanel-Dashboard/releases/tag/dashboard-operations-desk-2026.10.15
- Production: https://plexon-panel-dashboard.vercel.app
- Frontend reconstruction: PR #88; release packaging: PR #89.
- Inspected toolchain: React 19.3.0, Vite 8.3.4, TypeScript 7.0.2, Node 24.x.
- Current tests: 58 passing in the published release. Preserve all existing contracts.
- Release initial-JS measurement: 89,580 gzip bytes; enforced budget: 184,320 bytes (180 KiB).

Reconfirm HEAD, dirty state, nested instructions, lockfile, deployed build identity and available scripts before implementation. These facts are a dated baseline, not permission to assume future HEAD is identical. This is **Vite/React, not Next.js**.

Read the supplied `AGENTS.md` and `SKILL.md` completely. Also inspect:

1. `package.json`, `README.md`, `vercel.json`, `.env.example`, `src/App.tsx`, `src/main.tsx`, `src/router.ts`, `src/entry-state.ts`.
2. `docs/ARCHITECTURE.md`, `docs/CAPABILITIES.md`, `docs/BACKEND_REQUIREMENTS.md`, `docs/FEATURE_PARITY_MATRIX.md`, `docs/NEW_DASHBOARD_COMPATIBILITY.md`, `docs/NEW_DASHBOARD_VERIFICATION.md`, and deployment/rollback documents.
3. All current routes, pairing/splash/shell components, action-review logic, chart presentation helpers, preferences and regression tests.
4. Adapter/session/grant/fleet/history/freshness/backup contracts before consuming their data or dispatching actions.
5. Current Core `docs/PROTOCOL.md`, `docs/FLEET_PROTOCOL.md`, `docs/FLEET_TELEMETRY.md`, `docs/HOST_AGENT.md`, `docs/BACKUPS.md`, and release gates.

Create a fresh branch such as `design/reference-control-room`. Do not reset `main`, force-push over delivered work or discard unrelated changes.

This brief supersedes earlier **visual** choices that prohibited a sidebar, rounded panels or a navy palette. Existing security, authorization, source-truth and backend safeguards remain authoritative.

## 4. Design system — establish it before route implementation

### 4.1 Color and surface hierarchy

Use the following as initial tokens, then tune them against rendered contrast and the references. Verify contrast; these values are not a certification.

| Role | Dark starting value | Light starting value |
| --- | --- | --- |
| Application canvas | `#101624` | `#F2F5FA` |
| Sidebar | `#151D2E` | `#FFFFFF` |
| Main panel | `#202A3C` | `#FFFFFF` |
| Nested row / raised control | `#2B364B` | `#EAF0F8` |
| Quiet inset / terminal | `#111A2A` | `#F5F8FC` |
| Subtle border | `#39465E` | `#D7E0EC` |
| Primary text | `#F4F7FC` | `#17253A` |
| Secondary text | `#AFBCD0` | `#4E6079` |
| Primary action / selected navigation | `#3485FF` | `#1764D8` |
| Cyan instrument / secondary accent | `#12C8E7` | `#007A94` |

Use separate semantic success, warning, danger, unknown and offline tokens. Danger belongs to destructive actions and real failures; cyan is not a universal status color. A warning needs a label/icon as well as color. Select contrasting text colors for each filled button rather than assuming white works on every accent.

Panels should be perceptibly distinct from the canvas through controlled tonal separation and a quiet 1px border. Use small, restrained shadows only where hierarchy benefits. Avoid pervasive glow, glass blur, animated gradients and overly saturated panel backgrounds.

### 4.2 Typography, geometry and rhythm

- Retain the installed, self-hosted Manrope and JetBrains Mono unless there is a demonstrated reason to change. Typography alone is not the redesign.
- Body text: 14–15px at default scale; form labels and table values generally 14px; supporting metadata 12–13px; terminal text at least 13px. Do not shrink whole pages to fit.
- Main operational title: approximately 26–30px desktop, 23–26px mobile. Panel titles: 15–17px, semibold. Avoid giant editorial headlines in connected workspaces.
- Use tabular numerals for metrics, durations and changing values. Use monospace for console, IDs and copied addresses, not every label.
- Base spacing: 4/8/12/16/20/24/32px. Desktop page padding 24–32px; mobile 16px. Panel padding 20–24px desktop, 16px mobile.
- Panel radius 16–20px, nested rows 10–12px, buttons/inputs 8–10px. Keep geometry consistent; reserve pills for statuses and compact tags.
- Standard control height 40–44px; primary mobile and touch controls at least approximately 44px. Hover, focus, pressed, disabled, pending and error states are required.
- Icons: one coherent family, about 20px for navigation/actions and 16px for dense metadata, consistent stroke weight. No emoji as interface chrome.
- Rows, labels, switches and trailing actions share alignment tracks. Avoid arbitrary absolute positioning and tiny action buttons.

### 4.3 Density and motion

Comfortable is the default; compact changes real row/panel spacing. Preserve existing appearance, text-size, motion, accent, timezone, graph-fill and privacy preferences, including migration behavior. The reference blue/cyan direction is the default; user accent changes must remain readable.

Use approximately 120–180ms feedback transitions and 180–240ms drawer/dialog transitions. Small opacity/position transitions are sufficient. Honor both OS reduced motion and the user's reduced/off preference. Never animate telemetry values toward invented intermediate readings or pulse every panel indefinitely.

## 5. Application shell and responsive navigation

### Desktop

- Sidebar width approximately 232–248px, with PlexonPanel branding, a searchable server switcher, clear section labels and a stable bottom Settings/connection area.
- Suggested grouping: **Workspace** — Fleet, Access & audit; **Selected server** — Overview, Performance, Players, Console & chat, Backups; **Application** — Settings.
- Retain all eight existing route identifiers and hash deep links. A navigation redesign must not silently change routing or drop bookmarked workspaces.
- Show selected-server identity once prominently. Compact Paper/Host connection labels distinguish authority without a row of redundant banners.
- Use local tabs only for true subviews, such as Console / Chat / Plugins or Devices / Audit / Grant. Do not duplicate every primary sidebar destination in another full navigation row.
- Header lifecycle controls use actual availability and reviewed actions. Prefer one clear primary eligible action and a restrained overflow for alternatives. A status lamp is never a Start/Stop toggle.
- Keep the connected application visually full-size and useful. Do not render a miniature dashboard in a giant blue marketing frame.

### Responsive behavior

| Width | Required behavior |
| --- | --- |
| 1920 / 1440 | Full sidebar and balanced columns; use space for readable console and charts, not a stretched empty gutter. Main content may cap around 1680px. |
| 1280 / 1024 | Narrower rail or explicit compact navigation; preserve labels through accessible disclosure. Simplify panel columns before shrinking type. |
| 820 / 768 | Drawer navigation; compact server header; two columns only where each retains useful width. |
| 390 / 360 | One-column layout; menu/server switcher stays reachable; lifecycle controls wrap predictably; large charts and forms fill available width. |

On mobile, prioritize current server/context, important status, safe actions and key monitoring. Keep the same source and action information available; use disclosure rather than deletion. Trap and restore drawer/dialog focus. Provide a skip link and visible keyboard focus.

## 6. Rebuild every workspace

### 6.1 Overview — the defining reference composition

At desktop, use a 12-column grid, roughly 4 columns for server information and 8 for console/usage, with a consistent 20–24px gap. At narrower desktop widths, tune the ratio rather than forcing a cramped left column.

**Header:** selected server name, real Minecraft/Paper version when reported, current player count with truthful capacity availability, connection/source state and eligible reviewed lifecycle controls. A quiet, original Minecraft-inspired scene may sit behind this header with sufficient contrast. Keep it compact enough to retain operational content above the fold.

**Left column:**

1. Server identity panel: known name/UUID, status and verified metadata. Show an address/copy control only when a real configured or reported address is available; do not infer a Minecraft endpoint from the relay URL.
2. Runtime/instance panel: Paper and Host presence, service/unit identity where available, and genuine version/runtime evidence.
3. Quick actions: a small set of useful existing operations with labels, permission reasons and confirmations. Do not add decorative locked icons or unsupported tasks to mimic the screenshot.
4. Active-player preview: real player heads/fallbacks, names and count, with a route to the full roster. Zero and unavailable are different states.

**Right column:**

1. Console preview, approximately 280–340px tall: real source, visible timestamps/severity, latest bounded output, pause/follow state and “Open console.” Show an error count only with an explicit observed window and scope; it is not a global incident count.
2. Usage panel: a readable chart with a local metric selector, current value, units, time range, source caption and tooltip. A summary/detail switch may expose supported resource rows and the detailed plot, following the references.
3. Compact tick-health context where useful: TPS and mean MSPT retain their own scales. Do not hide core Minecraft health behind generic CPU/RAM charts.

At 1440×900 and 100% scale, server identity, primary eligible control, meaningful console output and the beginning of usage monitoring must be visible without scrolling through a marketing header. Mobile may reorder panels deliberately; do not depend on CSS order that breaks keyboard reading order.

### 6.2 Performance

Build a dedicated instrumentation workspace within the new panel system. Preserve all eight current signals: TPS, mean MSPT, Minecraft service CPU, Paper process CPU, node CPU, JVM heap, Minecraft service memory and node memory.

Use compact metric selectors and substantial plots, with a focused view and optional synchronized comparison. Same-unit series may share a plot only when source distinctions stay clear; unrelated units require separate aligned plots. Retain source details, actual sample tables, keyboard/touch inspection, series visibility and range controls. Do not default to eight expensive active plots when fewer answer the immediate question.

### 6.3 Fleet

Create a polished server directory using compact cards or rows with consistent identity, Paper/Host state, current trustworthy readings, a small source-bound sparkline and “Open server.” Include search and clear empty/offline/denied states. A passive server must never borrow the selected server's telemetry.

Provide a separate verified-node view where identity permits aggregation. Deduplicate shared node totals only with the existing matching authoritative identity rules. Do not advertise plan/storage allocations or infrastructure inventory the system has not reported.

### 6.4 Players and player profile

The roster needs search, world filter, useful sort, real count, UUID identity and responsive rows. Selecting a player opens a substantial profile composition inside Players, with a clear Back to players path. Preserve existing deep-link behavior; any new selected-player URL state must be additive and contain no secrets.

Follow reference 2: identity/head/status/UUID in the profile header; current session and available history summaries below; normal interactions separated from moderation; history/details in coherent panels.

Preserve message, kick, ban, whitelist, gamemode, heal, feed, kill, OP/de-OP, typed command template and LuckPerms builder tools currently exposed. Keep exact UUID/server/session binding, typed confirmations and returned results.

`players.history.list` already exists as a gated Protocol-3 query. A read-only history browser may be added using that exact contract after verifying capabilities, grant and source fields. Use opaque cursor pagination, newest-first entries, loading/empty/disabled states and stale-response cancellation. Never invent first/last seen, session counts, IP addresses or lifetime playtime. A bounded retained history is not a complete lifetime record. See §8 for unsupported reference features.

### 6.5 Console, chat and plugins

Make this a first-class terminal workspace with Console / Chat / Plugins subviews. Console supports source/severity/search filters, pause, wrap, follow-tail, clear display, export and reviewed command entry. Preserve the 2,500-line retention bound and virtualization. Wrapping must remain bounded and usable.

Distinguish Host journal read authority from Paper command execution authority. A command composer cannot become enabled merely because Host logs are visible. Show agent result versus queued versus unknown outcome correctly.

Chat retains its transcript, safe preview and scope-gated MiniMessage option. Plugins retain real inventory, search where useful, accurate missing-data states and reviewed reload. Do not insert a fake “Installed” integration status based on a screenshot or filename alone.

### 6.6 Backups

Use the reference's archive rows and action alignment, with a more complete operational model: readiness summary, archive inventory, actual durable job timeline, source evidence and meaningful empty/restricted states.

Preserve existing preflight, countdown presets, create, list, status, verify, retry-upload and delete. Unknown evidence must disable creation. Distinguish archive presence, verified integrity, upload progress and completed jobs. Progress percentages require real backend progress; do not animate speculative completion.

Download, restore and new scheduling UI are separate capability work, not automatic consequences of copying a reference. Preserve their underlying contracts without exposing an unfinished or unsafe workflow. A new download/restore flow requires a separately verified transfer/hash/prepare/review path and its own acceptance tests.

### 6.7 Access and audit

Use clear Devices / Audit / Effective grant views with organized panels, readable rows and filters. Preserve immutable grant semantics, actual actor/action/outcome evidence, source selection and scope filtering. Explain restricted access in normal product language. Current-device revocation protections remain intact; authority changes require the established revoke/re-pair flow.

Do not invent editable permission trees, invitation links, role administration or notification counts from the hosting reference.

### 6.8 Settings

Replace the long editorial document with settings navigation and responsive panel groups inspired by reference 1. Required groups: Appearance, Connection, Privacy & skins, Diagnostics.

Keep all working preferences and their actual persistence: theme/system, density, text size, motion, accent, chart fill and timezone. Connection retains relay configuration validation, reconnect and add-server pairing. Diagnostics retain exact build identity and existing secret redaction.

Use consistent label/help/control alignment. Explicit saves need dirty/saving/success/error states; immediately persisted preferences need clear feedback. Do not make switches visually imply immediate server mutations that actually require review. Do not add gamerules, MOTD, file editors or upload buttons merely to fill a column.

### 6.9 Splash, pairing and recovery

Rebuild them to match the new blue/charcoal panel language. A compact branded loading treatment, bounded pairing form and concise Paper/Host/browser explanation are sufficient. Avoid the current oversized editorial welcome treatment.

Preserve the existing minimum splash, initialized credential check, masked pairing code, device name, conditional relay field, real claim result and IndexedDB credentials. Invalid or missing credentials must not reveal a fake operational shell. Cover unavailable relay, invalid code, pairing, connecting, reconnecting, incompatible and revoked states. Never place credentials in localStorage, URLs, fixtures, logs or screenshots.

## 7. Telemetry craftsmanship and truth

Charts should resemble the references in polish while exceeding them in correctness. Use restrained fills, crisp axes, readable legends, a precise crosshair, unit-aware tooltips and a stable current-reading area. Avoid ornamental curve smoothing that invents extrema or conceals spikes.

| Signal | Authority and display rule |
| --- | --- |
| TPS / mean MSPT | Paper. Keep TPS and milliseconds separate. The 50ms reference relates to a 20 TPS tick budget. No fabricated p95/p99 from averages. |
| Paper process CPU / JVM heap | Paper process. Preserve the observed CPU denominator; heap is not total process or host memory. |
| Minecraft service CPU / memory | Host, exact Minecraft systemd/cgroup scope. One-core CPU can exceed 100%; never clamp to a decorative 100% bar. |
| Node CPU / memory | Host node totals. Deduplicate only through verified shared-node identity. |
| Storage / capacity bars | Only show with an actual, correctly scoped, fresh numerator and positive known denominator. Do not derive storage from a backup ZIP size or hosting-plan guess. |

Additional requirements:

- Preserve original capture timestamps and independent receipt clocks, clock-skew handling and existing live/delayed/stale policy. Do not reset clocks to make an old source look fresh.
- Preserve gaps and source/session generations; no line or fill bridging missing samples or reconnect boundaries. Missing is not zero.
- Use binary memory units (MiB/GiB) consistently and make CPU scope/denominator available in labels/tooltips.
- Time windows only describe actually retained observations. Do not add 24-hour/7-day buttons to a short in-memory series without real backing history.
- Retain the existing extrema/gap-aware display reduction and original-sample access unless a measured, equally truthful improvement replaces it.
- Pointer, keyboard and touch must expose exact available samples. Desktop comparison plots may synchronize by timestamp; absent source samples must remain absent.
- The graph table fallback must remain useful to assistive technology. Do not announce every incoming sample through an aggressive live region.
- Feature-detect optional metadata and capabilities. Backend source HEAD is not proof that a feature is installed on the VPS.

## 8. Reference features are not evidence of backend support

Classify these before implementation. A generated action name, new UI switch or console command guess is not an integration.

| Reference feature | Observed state in this codebase | Requirement |
| --- | --- | --- |
| Lifecycle, console/chat, players, plugin inventory, guarded actions | Existing frontend and trusted session paths | Fully retain and redesign. |
| Whitelist add/remove for a specific player | Existing typed actions | Retain. Do not fabricate a complete whitelist listing or global enable switch. |
| Player session history and optional first/last-seen fields | Existing gated query/optional source fields; history browser was deferred | May implement read-only UI using the actual contract and current grant/capability. Clearly disclose bounded/disabled history. |
| Lifetime playtime or lifetime session count | Not established by current UI or a bounded history page | Show only if an explicit authoritative field defines the value; otherwise omit or label the narrower observed window. |
| Player inventory / Ender Chest | No established item-viewing UI contract | Separate backend proposal. `inventory.players` means a roster snapshot, not Minecraft item slots. |
| Admin notes | No established durable notes contract | Separate proposal with server storage, scopes and audit semantics. Do not pretend local browser notes are shared server records. |
| Gamerule switches, view/simulation distance, MOTD, server icon upload | No established dedicated settings workflow in the inspected UI | Separate capability design. Do not repurpose arbitrary console execution or file writes to manufacture reference parity. |
| Datapack upload, generic Files/Config tabs | Not part of current delivered UI; file configuration is intentionally omitted in existing capability documentation | Keep out of the shipped navigation for this UI revamp unless the owner separately expands scope. |
| Spark profiling / Discord integration management | No established management contract | Do not add operational controls or infer installation. Record as future work. |
| Scheduled backups, new download/restore UI | Some underlying maintenance/transfer/backup contracts exist, but the reference's complete workflow is not established | Do not ship a fake schedule selector or shortcut restore. Treat a real extension as separately tested scope. |
| Hosting plans, billing, databases, ports, support, invite flows | Not established by PlexonPanel's current product contracts | Do not copy these navigation items as placeholders. |

Keep unsupported features in the engineering backlog. Do not litter the finished product with disabled placeholders for every feature in the images. Existing negotiated capabilities that are unavailable should retain their honest availability explanation.

## 9. Protected engineering boundaries

Rebuild presentation components, route JSX, shell/navigation, CSS and isolated view-model helpers. Keep tested data/session logic rather than rewriting it to fit the design.

Protected by default:

- `src/adapter/**`, all protocol/action manifests, signing and WebSocket behavior.
- `src/store/**`, `src/hooks.ts`, `src/entry-state.ts`, capability and grant interpretation.
- `src/lib/playerCommands.ts`, `src/lib/textFormat/**` and other security/validation utilities.
- `vercel.json`, runtime CSP/security headers, `.env.example`, relay origin and allowlist behavior.
- Existing tests, lockfile and dependency versions unless a justified, separately documented change is essential.
- Action-review **behavior** in `src/features/ActionReview.tsx`; its visual shell may be redesigned.

Preserve Protocol 3, `/v1`, IndexedDB credentials, immutable per-device grants, selected-server/session/revision binding, max-16 passive feeds and independent Host/Paper authority. Existing retention bounds remain: 8,192 telemetry observations / approximately 35 minutes, 2,500 console lines, roster 512 and worlds 64, subject to verified HEAD.

Mutations continue through existing `session.reason`, `session.prepare` and `session.execute` paths. Preserve high-risk confirmation, typed subject checks, stale-target invalidation, authoritative results, unknown outcome handling and no automatic mutation retry. Queue acknowledgement is not completion. A navigation change, hover or chart gesture must never dispatch a command.

No direct RCON, new privileged proxy, browser-to-game backdoor, transport shortcut, secret migration or authentication bypass. Render server-supplied text safely; never inject backend strings as HTML.

**This is a frontend rebuild.** Do not stop/restart VPS, Paper, Host or relay services, replace JARs, change credentials/allowlists, migrate server data or deploy backend changes. Source optimizations need measured evidence and a separate proposal. Existing production authorization applied to the prior completed release; seek explicit authorization for a new production cutover after presenting this redesign's concrete, tested candidate.

## 10. Execution sequence and review gates

### Phase A — Reconnaissance and baseline

Read instructions and current source, capture existing desktop/mobile screens, enumerate every working feature/action, verify HEAD and run baseline checks. Create a parity map and record backend/source boundaries. Do not start by patching the old stylesheet.

### Phase B — Reference-accurate design proof

Build a real coded shell and Overview proof at 1440×900 and 390×844. Include sidebar, server header, information/console columns, usage visualization and key states. Also prove player profile and one settings panel group. Create a light-theme counterpart.

This gate validates the specified reference direction, not an invitation to explore unrelated visual styles. Independently choose spacing, tokens and component details within that direction. Inspect actual renders before scaling to all routes. If the result still resembles Operations Desk, reject it and rebuild the composition.

Use labelled development fixtures only. A proof cannot become the production data source. Reuse no screenshot's fake values or server names as real content.

### Phase C — Shared system and complete integration

Build a small new component system: application shell, server header, panel, stat cell, resource row, tabs, field row, switch, slider where supported, status badge, player identity, archive row, chart frame, terminal, empty/loading/restricted states and reviewed dialog.

Replace old presentation intentionally. Do not accumulate a third competing stylesheet through endless overrides. Audit unused styles/components before removing them; retain behavior helpers and regression coverage.

Complete Fleet → Overview → Performance → Players/profile → Console/chat/plugins → Backups → Access/audit → Settings → pairing/recovery. Preserve route behavior and the full parity map. Check TypeScript and build at meaningful checkpoints.

### Phase D — Visual, functional and performance refinement

Test keyboard, touch, theme, text size, motion, denied scopes, empty/partial/stale/skew/offline states, reconnect and server switching. Review every workspace at desktop and mobile, not only the hero screen. Measure full UI performance with the same replay inputs and environment as baseline.

Optimize only measured display bottlenecks. Preserve lazy route loading and bounded rendering. Do not lower budgets, remove assertions, hide source errors or weaken confirmation to make a polished demo pass.

### Phase E — Reviewable delivery

Deliver a complete branch/PR, reproducible source archive where requested, a nonproduction preview if available, screenshots, parity record, actual test logs, performance comparison, compatibility report and deployment/rollback instructions. No new production promotion is implied by this brief.

Do not stop at research, design concepts, a single Overview route, a standalone mockup or a list of recommendations when instructed to execute this specification.

## 11. Acceptance and verification

Use the repository's actual commands. At the inspected baseline:

```sh
npm ci
npm run check
npm run build
npm run test:perf
npm audit --omit=dev --audit-level=high
git diff --check
```

For browser verification, provision the available browser and launch the app in the same reachable environment. The current local harness can start and verify it together:

```sh
npx playwright install firefox
node scripts/qa-local.mjs
node scripts/qa-local.mjs scripts/control-plane-check.mjs
node scripts/qa-local.mjs scripts/reconstruction-check.mjs
node scripts/qa-local.mjs scripts/review-confirmation-check.mjs
node scripts/qa-local.mjs scripts/visual-proofs.mjs
node --import tsx scripts/telemetry-profile.mjs
```

Reinspect these scripts. Update assertions that intentionally depend on replaced visual navigation or layout, and document each change. Preserve behavioral, authorization, provenance, focus and source-isolation coverage. Do not merely delete old selector assertions until the suite goes green. `npm run test:browser` remains valid with a separately running reachable server. There is no existing lint script; do not invent a passing lint result.

### Required proof

| Area | Acceptance evidence |
| --- | --- |
| Visual direction | Side-by-side reference/current/new captures show the specified shell, panel hierarchy and console-led Overview, with no cosmetic-reskin fallback. |
| Coverage | All eight workspaces, player detail, Console/Chat/Plugins, pairing and recovery receive the new system. |
| Responsive | 1920, 1440, 1280, 1024, 820/768, 390 and 360px. No viewport overflow, tiny text, clipped menus or inaccessible controls. |
| Themes and preferences | Actual dark/light/system behavior; compact/comfortable; enlarged text; reduced/off motion. No reset of stored preferences. |
| Charts | Units, source/capture/receipt clocks, gaps, source generations, >100% one-core CPU, partial data, keyboard/touch/table fallback. |
| Safety | Read-only scopes, revoked grants, stale review invalidation on server switch, fail-closed backup readiness and unknown mutation outcome. |
| Player/history | UUID-bound actions, address/location/history privacy, opaque cursor handling if added, no invented lifetime statistics. |
| Performance | Baseline/final initial JS and CSS; comparable frame/replay timings, DOM/path counts, long console behavior and bounded-memory evidence. Keep the 180 KiB initial-JS budget. |
| Accessibility | Axe plus manual focus/order/contrast/keyboard checks. Test 200% zoom and screen-reader flows where available; record unavailable environments honestly. |
| Production artifact | Fixture module/data excluded; unauthenticated visit shows protected pairing, not the operational shell; build identity and original security headers preserved. |
| Runtime limits | Real paired Paper/Host round trips and 24-hour soak reported separately from fixture or short replay evidence. |

Capture at least every workspace in both themes at 1440 and 390px, plus pairing and player profile. Annotate fixture versus real data. Inspect the images and refine collisions, alignment, contrast and density before calling the result finished. A screenshot count or passing axe run alone is not design acceptance.

Any meaningful performance regression must be investigated and disclosed. Do not claim universal 60fps from a short synthetic run. Earlier eight-track comparison was measurably more expensive than the focused view; retain that distinction in comparisons.

## 12. Deliverables and final completion checklist

Provide concise, useful records rather than lengthy planning instead of code:

1. Working React/TypeScript frontend on a fresh review branch, with all workspaces integrated.
2. Updated design notes explaining how the supplied references map to the implemented shell, Overview, player profile and settings modules.
3. Source-driven feature-parity table: existing behavior, new location, verification, explicitly deferred extensions.
4. Desktop/mobile dark/light visual proofs and a comparison sheet, with development fixtures labelled.
5. Exact tests executed, failures resolved, environments not tested and real operational acceptance still pending.
6. Before/after size and rendering measurements, identical benchmark conditions and stated limitations.
7. Protected-boundary diff report and backend compatibility statement; separate any justified nonvisual change.
8. Reproducible preview/build instructions and a source archive if requested.
9. Safe cutover/rollback procedure that preserves the same frontend origin, IndexedDB pairing, approved relay origin and the previous immutable deployment. Record the actual current deployment at cutover; never assume this brief's baseline is still production.

**Reject the result if:** it is only recolored Operations Desk; leaves the current visual compositions intact; omits workspaces; uses fake production metrics; copies unsupported controls; hides source/permission uncertainty; loses safe confirmations; renders a tiny dashboard at 100% scale; or requires unapproved backend changes.

**Definition of success:** the rendered product clearly belongs to the visual family of the four supplied references, while remaining an original PlexonPanel interface with its existing protocol reliability, permission model and operational safeguards.

## 13. Ready-to-use execution prompt

Copy this prompt when assigning the implementation, and attach this file plus the four reference images and authoritative `AGENTS.md` / `SKILL.md`:

```text
Implement the attached PlexonPanel-Reference-UI-Revamp-Brief.md completely.

Repository: https://github.com/ZpkDxGames/PlexonPanel-Dashboard
Backend reference: https://github.com/ZpkDxGames/PlexonPanel
Intended model: GPT-6.1 Sol, xHigh reasoning.

Read AGENTS.md, SKILL.md, the entire new brief and all four visual references
before editing. Reinspect current main and source. The new brief supersedes
earlier visual choices; all protocol, security and operational safeguards stay.

The target is the supplied blue/charcoal Minecraft hosting-panel direction:
persistent sidebar, server header, rounded operational panels, console-led
overview, rich usage charts, organized settings and substantial player profiles.
Do not deliver another palette/font adjustment or reuse Operations Desk's
horizontal/flat/editorial composition.

Build and visually inspect a real desktop/mobile shell and Overview proof,
then complete every workspace with actual integration. Preserve trusted
Protocol-3 sessions, IndexedDB pairing, grants, Host/Paper authority, reviewed
actions, truthful telemetry and backup safeguards. Reference-only features
must not become fake controls or fabricated data.

Work on a fresh branch. Run baseline and final checks, inspect screenshots,
measure rendering and size, maintain feature parity and deliver a reviewable
PR/preview with source, evidence and rollback instructions. Do not stop after
planning, mockups, one page or a partial implementation. Do not deploy this
new candidate to production or change backend services without explicit
release-specific authorization after the candidate is concrete and reviewable.
```

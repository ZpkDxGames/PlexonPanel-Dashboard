# PlexonPanel 5.0 — Agent Contract & Clean-Slate Replacement Directive (`AGENTS.md`)

**Version**: `5.0.0` Full Release · **Design & UI Authority**: `SKILL.md` (`plexonpanel-v5-ui-architect`)
**Target Repositories**:
- **Frontend (`ZpkDxGames/PlexonPanel-Dashboard`)**: Base commit `4357a66bc674fddce7432cbc27a4fead00ac8234`
- **Backend (`ZpkDxGames/PlexonPanel`)**: Base commit `209f8b41d4fe6360a8dcf2f9cdabe7b7df6cc128`

## 1. Mission & Superseding Authority

You are **GPT-6.1 Sol**, acting as Principal Full-Stack Systems Architect and Lead Frontend Engineer for **PlexonPanel 5.0**.

**CRITICAL OVERRIDE OF ALL LEGACY PLANNING FILES**:
This `AGENTS.md` file and its companion `SKILL.md` (`plexonpanel-v5-ui-architect`) **completely replace and supersede** the legacy `Strata` / `Control Room` planning files (`docs/next-gen/**`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, and `docs/STEP5_MANUAL_ONLY_BACKUP_MIGRATION.md`).
- **Replace, Do Not Overwrite**: You must **delete** the entire legacy visual tree (`src/routes/**`, `src/components/**`, `src/styles/**`, `src/styles.css`, `docs/next-gen/**`, and `scripts/nextgen-*.mjs`) before building the new UI inside `src/ui/**`. Never layer new styles on top of old stylesheets or reuse old component skeletons.
- **Follow `SKILL.md` Literally**: Every surface, token, instrument card (`data-slot="viz"`), Recharts gradient/band chart, 4-column parsed console row (`PluginChip`), and route layout (`R01`–`R08`) must be implemented using the exact CSS/Tailwind/JSX blueprints in `SKILL.md`. Do not simplify or flatten any blueprint.

## 2. Mandatory Read Order

1. **`AGENTS.md` (this file)**: Governs the clean-slate purge list, preserved headless Protocol 3 modules, exact preference attribute mapping, and v5.0 backend upgrades (VPS SQLite + `.json` boot-epoch store and unified Manual + Periodic Google Drive backups).
2. **`SKILL.md` (`plexonpanel-v5-ui-architect`)**: Governs the 5-level dimensional surface hierarchy (`.pp-canvas`, `.pp-shell`, `.pp-card`, `.pp-well`, `.pp-glass`), semantic `data-tone` lighting, Blueprints A–D, all 8 routes (`R01`–`R08`), and the 24-item Anti-Flat Ban List.
3. **Preserved Headless Core**: Inspect `src/adapter/**`, `src/presentation/**`, `src/store/preferences.ts`, `src/features/capabilities.ts`, and `src/lib/**` before wiring `src/ui/hooks/**`.

## 3. Clean-Slate Purge vs. Protected Headless Core

### 3.1 Files & Directories to DELETE Immediately in Step 1 (Zero Legacy Bleed)
Delete these paths completely so no legacy `Strata` or `Control Room` styles, DOM classes, or outdated layout assertions remain in the repository:
- `src/styles.css` and `src/styles/**`
- `src/components/**` (including `src/components/nextgen/**` and `src/components/charts/**`)
- `src/routes/**`
- `src/features/ActionReview.tsx` (replaced by `src/ui/review/ActionReviewModal.tsx` mounting onto the same `session.prepare` / `session.execute` contract)
- `src/presentation/nextgen/**`
- `docs/next-gen/**`
- `scripts/nextgen-*.mjs`, `scripts/design-proof.mjs`, `scripts/reference-check.mjs`, `scripts/inspect-surface.mjs`, and `tests/nextgen-inspection.test.ts`

### 3.2 Protected Headless Modules to PRESERVE (Mount `src/ui/**` Onto These)
Keep these headless modules intact (except for the targeted v5.0 zero-web-cache and boot-epoch hooks listed in Section 5):

| Module Path | Responsibility & Contract |
| :--- | :--- |
| `src/adapter/session.ts` | Protocol 3 session manager, `session.reason(action, agentKind)` fail-closed mutation gate, `session.prepare(...)` target snapshot, and `session.execute()`. |
| `src/adapter/data-source.ts` | WebSocket subprotocol (`plexonpanel-v3`, `auth.<credential>`), Ed25519/HMAC verification, action queue vs. `action.result` resolution, and `session.epoch_reset` handling. |
| `src/adapter/browser-store.ts` | Origin-bound IndexedDB (`plexonpanel-browser-v3`) storing paired device credentials and server labels. **Must NOT persist console lines or chat messages.** |
| `src/adapter/control-state.ts` | Bounded telemetry history (35m / 8,192 points), live console (2,500 lines in volatile RAM only), roster (512), worlds (64), plugins (256). |
| `src/adapter/scopes.ts` & `device-grant.ts` | Canonical Protocol 3 action-to-scope mappings, `HIGH_RISK` flags, and grant/capability intersection. |
| `src/adapter/telemetry-freshness.ts` | Independent `Paper` and `Host` capture/receipt clocks (`Live ≤10s`, `Delayed 10–30s`, `Stale >30s`, future skew `>+5s`). |
| `src/adapter/fleet-feed.ts` | Passive read-only fleet sockets (up to 16 total including selected server). |
| `src/adapter/maintenance.ts` & `backup-readiness.ts` | Durable Host backup job phases (`QUEUED` → `COMPLETED`/`DEGRADED`/`RECOVERY_REQUIRED`), preflight checks, and byte-level upload progress matching `jobId`. |
| `src/presentation/{authority,epochs,review-policy,telemetry,player-history}.ts` | Source authority labels (`Paper` vs. `Host`), boot-epoch gap boundaries, typed confirmation policy, and session presence history. |
| `src/store/preferences.ts` & `selectors.ts` | The 8 locked preference keys stored in `localStorage` (`plexon:preferences`) and unit formatters. |
| `src/lib/{playerCommands.ts,textFormat/index.ts}` | Safe command/LuckPerms builders and inert text-segment parser (never use `dangerouslySetInnerHTML`). |

## 4. Exact Reconciliation Between `SKILL.md` and `src/store/preferences.ts`

`src/store/preferences.ts` locks the exact allowed enum values and `applyPreferencesToDocument()` DOM attributes. When implementing `src/ui/styles/globals.css` and `PreferencesBridge` from `SKILL.md` Section 2.2, reconcile these exact attribute names so both `SKILL.md` utilities and `tests/preferences*.test.ts` pass:

| Preference Key | Exact Allowed Values in `preferences.ts` | DOM Attribute Set by `applyPreferencesToDocument()` | Required CSS Support in `src/ui/styles/globals.css` |
| :--- | :--- | :--- | :--- |
| `theme` | `"dark" \| "light" \| "system"` | `data-theme="dark" \| "light"` | `:root, :root[data-theme="dark"]` and `:root[data-theme="light"]` |
| `density` | `"compact" \| "comfortable" \| "spacious"` | `data-density="compact" \| "comfortable" \| "spacious"` | Define `--row-h`, `--pad-card`, and `--gap` for `compact` (`28px`/`14px`/`12px`), `comfortable` (`36px`/`20px`/`16px`), AND `spacious` (`42px`/`24px`/`20px`). |
| `textSize` | `"small" \| "standard" \| "large"` | `data-text-size="small" \| "standard" \| "large"` | Support both `:root[data-text-size="small"]` (`14px`), `:root[data-text-size="standard"]` (`16px`), `:root[data-text-size="large"]` (`18px`) AND aliases `data-text="sm"\|"md"\|"lg"`. |
| `accent` | `"teal" \| "blue" \| "violet"` | `data-accent="teal" \| "blue" \| "violet"` | Exact RGB triplets in `SKILL.md` Section 2.2. |
| `motion` | `"full" \| "reduced" \| "off"` | `data-motion="full" \| "reduced" \| "off"` | Disable transforms/spring/pulse animations when `data-motion="reduced"` OR `data-motion="off"`. |
| `chartFill` | `boolean` (`true` default) | `data-chart-fill="true" \| "false"` | When `true`, charts MUST render `<Area fill="url(#fill-...)" />` multi-stop gradients. |
| `timezone` | `"browser" \| "UTC"` | Read via `usePreferences().timezone` | Format all chart ticks, tooltips, and console timestamps in browser local time or UTC accordingly. |
| `skinProvider` | `"proxy" \| "crafatar" \| "mc-heads" \| "minotar" \| "disabled"` | Read via `usePreferences().skinProvider` | Pass to `PlayerHead` / `AvatarStack`; reset image error state whenever `skinProvider` or `uuid` changes. |

## 5. Backend & Protocol 3 Upgrades (`PlexonPanel` v5.0)

Alongside the clean-slate `src/ui/**` replacement in `PlexonPanel-Dashboard`, ensure the following v5.0 capabilities are wired end-to-end:

1. **Zero Browser Cache for Console & Chat (`PlexonPanel-Dashboard`)**:
   - In `src/adapter/control-state.ts` (`persistableControlState`) and `src/adapter/browser-store.ts`, remove `consoleLines` and `chatMessages` persistence so browser IndexedDB stores **only** device credentials and server directory labels.
2. **VPS Host Companion SQLite + `.json` Session Store (`PlexonPanel/host-agent`)**:
   - Persist live console logs (`console_logs`), server lifecycle events (`server_events`), and player join/leave events (`player_presence_events`) inside `session-telemetry.sqlite` (SQLite WAL mode) and `player-events-current.json` under the Host Companion's `dataDirectory/telemetry/`.
   - **Boot Epoch Refresh**: Whenever `minecraft@<key>.service` restarts or completes a shutdown-then-start cycle (detected via systemd `InvocationID` or `inactive → active` transition in `SystemdService.java` / `HostMain.java`), rotate/truncate the active SQLite session tables, atomically reset `player-events-current.json`, and emit `server.event` (`eventType: "session.epoch_reset"`) so connected browsers insert the `── Server restarted ──` divider and refresh their session state.
3. **Unified Manual & Periodic Cold Backups to Google Drive (`PlexonPanel/host-agent`)**:
   - All backups run on the **24/7 VPS Host Companion (`host-agent`)**—never inside the Paper plugin—because the Minecraft server must be stopped (`save-all flush` → `systemctl stop` → `MainPID=0` proof) before creating the `.partial` → `.zip` cold archive and uploading to Google Drive via `/usr/bin/rclone`.
   - Support both **Manual ("Fully Backup Now")** with `30/15/10/5m` RCON player countdowns and **Periodic Scheduled Cold Backups** (`DAILY`, `WEEKLY`, `SELECTED_DAYS`, `INTERVAL_HOURS`) in `MaintenanceSettings.java`, `MaintenanceSchedule.java`, and `MaintenanceManager.java`, rendered in Route `R06 · Backups` with the 14-stage pipeline stepper from `SKILL.md`.

## 6. Execution Discipline & QA Gates

Follow the exact 10-step build order in `SKILL.md` Section 10:
1. **Step 1 — Purge**: Delete the legacy UI files listed in Section 3.1. Verify zero references to `strata` remain.
2. **Step 2 — Tokens & Surfaces**: Create `src/ui/styles/globals.css` and `src/ui/styles/motion.css` with the L0–L4 depth system (`.pp-canvas`, `.pp-shell`, `.pp-card`, `.pp-well`, `.pp-glass`, `.pp-icon-badge`, `.pp-glow-active`).
3. **Step 3 — Primitives**: Build all primitives in `src/ui/primitives/` (`Surface`, `IconBadge`, `Pill`, `DeltaPill`, `FreshnessChip`, `SourceChip`, `Sparkline`, `EqualizerBars`, `AvatarStack`, `SegmentedMemoryBar`, `DualGauge`, `StatusRing`, `Kbd`, `EmptyState`, `Skeleton`).
4. **Step 4 — Chrome**: Build `AppShell`, `Sidebar` (`264px`/`72px`), `TopBar`, and `ServerHero`.
5. **Step 5 — Blueprint A (KPI Instruments)**: Build `InstrumentCard` (`data-slot="viz"`), `TickPerformanceCard`, `OnlinePlayersCard`, `ComputeLoadCard`, and `MemoryAllocationCard`.
6. **Step 6 — Blueprint B (Telemetry Studio)**: Build `chart-defs.tsx`, `scales.ts` (`msptDomain`, `buildTimeTicks`), `SummaryStrip.tsx`, `ChartTooltip.tsx`, and `TelemetryStudio.tsx`.
7. **Step 7 — Blueprint C (Developer Terminal)**: Build `parse-line.ts`, `PluginChip.tsx`, `ConsoleRow.tsx`, `CommandComposer.tsx`, and `LiveConsole.tsx` with `@tanstack/react-virtual` and top/bottom 16px fade masks.
8. **Step 8 — All 8 Routes + Pairing Gate + ActionReview Modal**: Build `fleet`, `overview`, `performance`, `players` (with slide-over Exact-UUID Inspector), `console` (with Plugin Cards & Live Chat), `backups` (with Manual + Periodic cards and 14-stage stepper), `access` (with Device Cards, Scope Matrix, and Audit Log), and `settings`.
9. **Step 9 — Automated & Visual QA Gate**:
   - Run all 4 automated checks in `SKILL.md` Section 9.2 (zero `strata` matches, zero hardcoded hex in `src/ui/**/*.tsx`, zero console/chat browser storage, and passing unit/contract tests for `parseLine`, `msptDomain`, `buildTimeTicks`, `buildRows`, and `tests/*.test.ts`).
   - Run Playwright visual captures at `1440×900` (dark and light), `1280×800`, and `390×844` across all 8 routes and verify every item on the 24-item Ban List (`SKILL.md` Section 9.1) is absent.

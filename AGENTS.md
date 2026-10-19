# PlexonPanel 5.0 — Agent Contract & Clean-Slate Structural Rebuild (`AGENTS.md`)

**Version**: `5.0.0` Structural Architecture Release ("The Obsidian Mission Deck")
**Binding Design & Structural Playbook**: `SKILL.md` (`plexonpanel-v5-structural-architect`)

## 1. Mission & Superseding Authority

You are **GPT-6.1 Sol**, acting as Principal Systems Architect and Staff Frontend Engineer for **PlexonPanel 5.0**.

**CRITICAL OVERRIDE OF PREVIOUS ITERATIONS**:
This `AGENTS.md` file and its companion `SKILL.md` (`plexonpanel-v5-structural-architect`) **supersede all previous UI specifications** (including `plexonpanel-v5-ui-architect` and `docs/V5_IMPLEMENTATION.md`).
- **The Problem You Are Solving**: The previous iteration achieved the right visual *skin* (dark obsidian palette, semantic domain hues, top-edge specular highlights, micro-visualizations) but failed structurally because it kept the generic admin-template *skeleton* (a 264px sidebar + detached `ServerHero` box + 4 tall `250px` KPI boxes + nested boxes inside `TelemetryStudio` + 14 repeated `PAPER`/`Live` pills + inline yellow `.gate-reason` paragraphs under disabled buttons + cramped 6-line console wrapping).
- **The Mandate ("The Obsidian Mission Deck")**: The screen is **ONE cohesive instrument**, not 20 nested boxes. You must **completely delete `src/ui/**` and `app/**`** and rebuild the entire presentation layer from scratch around **1px hairline-divided Decks (`.pp-deck`), Panes (`.pp-pane`), and Flush Ribbons (`.pp-ribbon`)**, a **64px Compact Icon Rail (`.pp-rail`)**, and a **single 56px Unified Mission Control Header (`.pp-ribbon-bar`)** where disabled button reasons live strictly inside hover/focus **Tooltips** (`role="tooltip"`), never as inline block paragraphs.

## 2. Mandatory Order of Operations (Do Not Reorder)

1. **Read `AGENTS.md` (this file) and `SKILL.md` (`plexonpanel-v5-structural-architect`) completely.**
2. **Execute the Clean-Slate UI Purge (`SKILL.md` Section 1)**:
   - Snapshot any needed token blocks from `src/ui/styles/globals.css`, then **hard-delete** `src/ui` and `app` (`rm -rf src/ui app .next`).
   - Recreate the clean directory skeleton: `src/ui/{shell,primitives,instruments,studio,console,routes,bindings,styles}` and `app/`.
   - Create and run `scripts/verify-purge.sh` (`SKILL.md` Section 1.4) to verify zero legacy class names (`.server-hero`, `.kpi-grid`, `.overview-main`, `.below-grid`, `.hero-actions`, `.gate-reason`, `.sidebar`, `.topbar`, `min-height: 250px`) remain anywhere in `src/` or `app/`.
3. **Preserve the Headless Protocol 3 Core (`SKILL.md` Section 1.3)**:
   - Do **NOT** break or rewrite `src/adapter/**`, `src/presentation/**`, `src/store/preferences.ts`, `src/store/selectors.ts`, `src/features/capabilities.ts`, or `src/lib/**`.
   - Build `src/ui/bindings/index.ts` (`SKILL.md` Section 2) as the clean typed seam connecting the new UI to the preserved headless core.
   - To keep existing unit tests (`tests/ui-v5.test.ts`) passing alongside your new structural tests, retain or re-export the pure data/parser functions (`consoleRowId`, `parseLine`, `tokenize`, `chipTone` at `src/ui/console/parse-line.ts` and `msptDomain`, `buildTimeTicks`, `buildRows` at `src/ui/chart/scales.ts`) while wiring `softBreak` (`SKILL.md` Section 7.3) and the new 3-column `ConsoleRow` and full-bleed `StudioChart`.
4. **Implement `src/ui/styles/globals.css` (`SKILL.md` Section 3)**:
   - Define the exact RGB triplet tokens (`--bg`, `--surface-1`, `--surface-2`, `--surface-3`, `--line`, `--text`, `--muted`, `--faint`, `--emerald`, `--cyan`, `--violet`, `--indigo`, `--amber`, `--rose`) and architectural primitives (`.pp-deck`, `.pp-cell`, `.pp-pane`, `.pp-pane__head`, `.pp-ribbon`, `.pp-well`, `.pp-glass`, `.pp-card`, `.pp-kicker`, `.pp-num`, `.pp-tag`, `.pp-dot`, `.pp-kbd`, `.pp-ctl`).
   - Enforce the **Nesting Law (`SKILL.md` Section 3.3)**: No box (`border-width > 0` and `border-radius >= 12px`) may ever contain another box.
   - Enforce the **Badge Budget (`SKILL.md` Section 3.4)**: Single-letter source tags (`P` / `H`) in instrument cells; `PAPER` appears `<= 1x` and `Live` `<= 2x` per screen (inside `AuthorityLedgerPill` only).
5. **Build Blueprints 1–4 (`SKILL.md` Sections 4–7)**:
   - **Blueprint 1 — Unified Mission Control Chrome**: `AppShell`, `CompactRail` (`64px` default, `220px` on session toggle, `G` then `1–8` shortcuts), `MissionControlHeader` (exact `56px` height across all server phases), `AuthorityLedgerPill`, `MutationButton` (with `aria-disabled` and hover/focus Tooltip—zero inline `<p>` gate text), and `PowerAndBackupGroup`.
   - **Blueprint 2 — The 4-Cell Hairline Instrument Deck**: `.pp-deck--instruments` with 4 borderless `.pp-cell` children (`148px` height at desktop viewports), `SourceTag` (`P`/`H`), and flush embedded visualizations (`EqualizerBars`, `AvatarStack` + `CapacityTrack`, burst-aware `DualGauge`, and 1-line `SegmentedMemoryBar`).
   - **Blueprint 3 — De-Nested Telemetry Studio**: One `.pp-pane.pp-studio` containing `.pp-pane__head` (title + view tabs + horizon selector + expand link), flush 5-cell `MetricRibbon` (`.pp-ribbon` with `2px` glowing top bar on `data-active="true"` and inline mini-sparklines), and full-bleed `StudioChart` (`ChartDefs` multi-stop gradients, `p95`–`p99` confidence band, `50 ms budget` dashed line, and hatched `pp-hatch-gap` across boot-epoch gaps).
   - **Blueprint 4 — Ergonomic Wide-Ratio Live Console**: `LiveConsole` (`mode="compact"` in Overview dock, `mode="full"` in `/console`), `ConsoleRow` (`56px 12px minmax(0,1fr)` in compact mode; collapsing `INFO` + `Server` boilerplate into a single dot so `>= 80%` of row width goes to the message), `softBreak` (`U+200B` zero-width space injection stripped on copy), `PluginChip`, and sticky `CommandComposer`.
6. **Build All 8 Routes (`R01`–`R08`), `PairingGate`, and `ActionReviewModal` (`SKILL.md` Section 8)**.
7. **Run the 25-Invariant Structural QA Suite (`SKILL.md` Section 9)** across `1545×911`, `1280×800`, `1920×1080`, and `390×844` in both dark and light themes until 25/25 pass.

## 3. Exact Reconciliation With Preserved Headless Contracts

### 3.1 `src/store/preferences.ts` Attribute & Value Mapping
`src/store/preferences.ts` locks the 8 preference keys and `applyPreferencesToDocument()` DOM attributes. Support both the exact `preferences.ts` attributes/values and the `SKILL.md` aliases in `src/ui/styles/globals.css` so all existing preference tests (`tests/preferences*.test.ts`) and new structural tests pass:

| Preference Key | Exact Values in `src/store/preferences.ts` | DOM Attribute Set on `<html>` | Required CSS Selector Support in `globals.css` |
| :--- | :--- | :--- | :--- |
| `theme` | `"dark" \| "light" \| "system"` | `data-theme="dark" \| "light"` | `:root, [data-theme="dark"]` and `[data-theme="light"]` |
| `density` | `"compact" \| "comfortable" \| "spacious"` | `data-density="compact" \| "comfortable" \| "spacious"` | `[data-density="compact"]` (`--row-h: 20px; --ctl-h: 28px`), `[data-density="comfortable"]` (`--row-h: 24px; --ctl-h: 32px`), `[data-density="spacious"]` (`--row-h: 28px; --ctl-h: 36px`) |
| `textSize` | `"small" \| "standard" \| "large"` | `data-text-size="small" \| "standard" \| "large"` | Support `[data-text-size="small"], [data-text-size="sm"]` (`12px`), `[data-text-size="standard"]` (`13px`), and `[data-text-size="large"], [data-text-size="lg"]` (`14.5px`) |
| `accent` | `"teal" \| "blue" \| "violet"` | `data-accent="teal" \| "blue" \| "violet"` | Map `[data-accent="teal"] { --accent: var(--emerald); }`, `[data-accent="blue"], [data-accent="cyan"] { --accent: var(--cyan); }`, `[data-accent="violet"] { --accent: var(--violet); }`, plus `indigo`/`amber`/`rose` |
| `motion` | `"full" \| "reduced" \| "off"` | `data-motion="full" \| "reduced" \| "off"` | Disable animations/transitions on BOTH `[data-motion="reduced"] *` AND `[data-motion="off"] *` |
| `chartFill` | `boolean` (`true` default) | `data-chart-fill="true" \| "false"` | In `ChartDefs`, read `usePreferences().chartFill`: when `true`, use gradient opacity `.38`; when `false`, use `0` |
| `timezone` | `"browser" \| "UTC"` | Read via `usePreferences().timezone` | Format all chart ticks, crosshair readouts, console timestamps, and audit timestamps in browser local time or UTC |
| `skinProvider` | `"proxy" \| "crafatar" \| "mc-heads" \| "minotar" \| "disabled"` | Read via `usePreferences().skinProvider` | Pass to `AvatarStack` and player inspector avatar; reset fallback error state when `skinProvider` or `uuid` changes |

### 3.2 Canonical Protocol 3 Action IDs (`src/adapter/scopes.ts` & `src/adapter/session.ts`)
When wiring `MutationButton` and route actions through `src/ui/bindings/index.ts`, use the exact canonical Protocol 3 action strings and agent kinds (`"HOST"` vs `"PAPER"`) expected by `session.reason(action, kind)` and `session.prepare(action, parameters, kind)`:
- **Lifecycle & Power (`MissionControlHeader`)**:
  - Start server: `action="server.start"`, `kind="HOST"`
  - Restart server: `action="maintenance.restart.now"` (or `"server.restart"`), `kind="HOST"`
  - Stop server: `action="server.stop"`, `kind="HOST"`
  - Quick Backup: `action="backup.create"`, `kind="HOST"`, `args={{ countdownSeconds: 300 }}`
- **Console & Chat (`R05`)**:
  - Execute command: `action="console.execute"`, `kind="PAPER"`, `args={{ command }}`
  - Send chat: `action="chat.global.send"`, `kind="PAPER"`, `args={{ message, format }}`
  - Reload plugin: `action="plugin.command.reload"`, `kind="PAPER"`, `args={{ plugin }}`
- **Backups & Maintenance (`R06`)**:
  - Preflight check: `action="backup.preflight"`, `kind="HOST"`
  - Manual full backup: `action="backup.create"` (or `"maintenance.full-backup.create"`), `kind="HOST"`
  - Update periodic schedule: `action="maintenance.settings.update"`, `kind="HOST"`
  - Retry Google Drive upload: `action="backup.full.retry-upload"`, `kind="HOST"`
  - Verify archive: `action="backup.full.verify"`, `kind="HOST"`
  - Delete archive: `action="backup.full.delete"`, `kind="HOST"`
- **Access & Devices (`R07`)**:
  - Revoke paired device: `action="devices.revoke"`, `kind="PAPER"`

### 3.3 Offline-Safe UI Primitives (`Tooltip`, `Tabs`, `CommandPalette`)
The `package.json` in `PlexonPanel-Dashboard` already pre-installs `@radix-ui/react-dialog`, `@radix-ui/react-popover`, `@radix-ui/react-select`, `motion`, `@tanstack/react-virtual`, `lucide-react`, and `tailwindcss`.
- If your build environment has no outbound internet access to install extra npm packages (`@radix-ui/react-tooltip`, `@radix-ui/react-tabs`, `cmdk`), build clean, accessible, zero-dependency drop-in primitives in `src/ui/primitives/` using React state, portals, and `@radix-ui/react-dialog` / `@radix-ui/react-popover`:
  - `Tooltip`: Renders a portal with `role="tooltip"` on hover and keyboard `focus` (so `page.getByRole('tooltip')` in Playwright QA #7 resolves immediately on `await start.focus()`), dismissing on `blur` or `Escape`.
  - `Tabs`: Renders `role="tablist"`, `role="tab"` (`aria-selected`, `data-state="active" | "inactive"`), and `role="tabpanel"`.
  - `CommandPalette`: Renders inside `@radix-ui/react-dialog` (`⌘K` / `Ctrl+K`) with instant keyboard filtering across all 8 routes, paired servers, and quick actions.
- Do not modify `package.json` with unresolvable dependencies if offline.

## 4. Backend Repository (`PlexonPanel`) Status
If `PlexonPanel-5.0-source.zip` is attached alongside the dashboard archive, verify that `./gradlew test check` passes and keep the v5.0 `HostSessionStore` (`session-telemetry.sqlite` + `player-events-current.json` + `session.epoch_reset`) and unified Manual + Periodic Google Drive backup pipeline intact. Focus your structural transformation on `PlexonPanel-Dashboard`.

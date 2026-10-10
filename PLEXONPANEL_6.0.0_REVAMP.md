# PlexonPanel Dashboard 6.0.0 — Complete UI Revamp Specification

**Audience:** an autonomous coding agent with full access to the repository `ZpkDxGames/PlexonPanel-Dashboard`.
**Goal:** rebuild the entire presentation layer of the dashboard from scratch as release **6.0.0**: a new interface that is modern, clean, dynamic and professional, with zero loss of the security, protocol and data-truth guarantees of 5.0.0.
**This document is the brief.** Read all of it before touching code. Where it says MUST / MUST NOT, treat it as a hard gate.

---

## 0. Operating rules for the agent (read first)

1. **Read `AGENTS.md` and `CLAUDE.md` first.** `AGENTS.md` states this is a newer Next.js with breaking changes and tells you to read `node_modules/next/dist/docs/` before writing code. Do that. Do not write Next.js code from memory.
2. **Work on a branch** named `release/6.0.0`. Never push to `main`, never force-push, never deploy to production. A Vercel *preview* is the furthest you go.
3. **Before changing anything**, make sure a rollback anchor exists: confirm a `v5.0.0` tag (or record the exact 5.0.0 commit SHA in `docs/UI_6_ROLLOUT.md`).
4. **Do not invent data, capabilities or backend behavior.** If a design needs a value the existing signed packets do not carry, the design omits that element. Nothing is "mocked to look good" in production code paths.
5. **Honest reporting.** A gate you did not execute is reported as *not executed*, never as passed. Preview/CI success is not live certification (this is already the repository's own rule; keep it).
6. **Keep `npm run check` green at the end of every milestone** (Section 12). Run the relevant subset (`npm run lint`, `npm run typecheck`, `npm test`) after every meaningful change.
7. **Never hand-edit generated contracts.** Use `npm run scopes:generate` and `npm run fleet:generate`; `scopes:check` and `fleet:check` must pass.
8. **Never put secrets in `NEXT_PUBLIC_*`**, logs, fixtures, screenshots, test snapshots or docs.
9. **Stop and report** (do not guess) if: a requirement here conflicts with an invariant in Section 3; a change would require a Core/Host/relay/protocol modification; or an existing test encodes behavior you believe is wrong. Describe the conflict and propose options.
10. **Commit per milestone** with a clear message; keep the history reviewable.

---

## 1. Mission and success definition

PlexonPanel is a **control room for a live Minecraft server**: operators watch health, manage players, read the console, run backups and lifecycle actions, and grant access to other devices. Mistakes are expensive (a bad stop, a wrong player action, a failed backup), and trust in the numbers matters.

6.0.0 succeeds when:

- An operator opening the dashboard understands the server's state in **under three seconds** without reading a label.
- The interface feels **alive** (live data, clear freshness, instant feedback) without ever misrepresenting what is authoritative or fresh.
- Every dangerous action is **unambiguous, bound to its target and explained** when unavailable.
- The result is visibly a *designed product with its own identity*, not a template (see Section 6.2).
- All 5.0.0 functionality and safety semantics survive (Section 3), verified by tests.
- It is fast, accessible (WCAG 2.2 AA) and fully usable from a phone.

---

## 2. Ground truth: what 5.0.0 is

*(Derived from the repository README, `package.json` and the `docs/UI_REVAMP_*` files. Verify everything against the code in Phase 0.)*

| Aspect | 5.0.0 reality |
|---|---|
| Product | Responsive Next.js/Vercel control room for signed **Protocol 3** PlexonPanel **Paper** and **Host** agents, talking through a relay (`/v1`) |
| Stack | Next `16.3.8`, React `19.2.8`, TypeScript `5.9.3`, ESLint 9, Playwright + `@axe-core/playwright`, `wrangler` for the Cloudflare Worker relay; Node `>=22.13.0` (README recommends Node 24). **Runtime dependencies are only next/react/react-dom.** |
| Relay | Two runtimes in-repo: Cloudflare Worker (`relay/wrangler.jsonc`) and a standalone Node relay |
| Navigation | **Fleet** (global paired-instance view) + selected-server workspaces: **Overview, Performance, Players, Console, Chat, Plugins, Server, Backups, Configuration, Audit, Access, Settings** |
| Authority split | **Paper** owns Paper/JVM/player/plugin state, chat, pairing/device sync, remote console command execution, optional live-only console fallback. **Host** owns Linux machine telemetry, systemd lifecycle, Host files/manual backups/maintenance, the durable authorization mirror, retained console history (journald) |
| Existing design system | One minimalist light/dark system, semantic CSS tokens (`--ui-canvas` etc.), grayscale defaults, restrained optional accents, compact/comfortable/spacious density, text size, motion and chart preferences in one strictly parsed v1 store |
| Charts | Native SVG, no chart library. `lib/chart-geometry.ts` does bounded, gap-aware, extrema-preserving thinning; `app/telemetry-chart.tsx` is the sole renderer |
| Reports | Browser-observed 1/5/15/30-minute windows, sample count, observed coverage, sample-based p95, bounded table, safe CSV/JSON export. **No long-horizon history exists** |
| Display cadence | Presentation-only "Display update rate": Realtime 0 ms, Fast 250, **Balanced 500 (default)**, Relaxed 1000, Low activity 2000. Operational state bypasses throttling |
| Console | Host-preferred live + replay, Paper-only command execution, Paper live-only fallback, ready state `HOST` / `PAPER_FALLBACK` / `UNAVAILABLE`, 2,500-line browser buffer, 100-line history pages, invocation separators |
| Backups | Host-authoritative **manual full backup** ("Fully Backup Now"), 30/15/10/5-minute player countdown, durable Host job that survives browser refresh, live compression + rclone upload progress, verify, VPS ZIP cleanup, **Retry Upload**, restart scheduler. Automatic backups and server-tree restore are *retired* |
| Players | Roster, join/quit delta reconciliation, history gated by scope + capability, action gating by intersection of scope/capability/policy/confirmation/Owner-only, player heads via MCHeads (configurable/disable-able) |

Known legacy within 5.0.0 that 6.0.0 should clean up: the read/clear-only **activity-history cleanup route** (retire the UI route only if the migration matrix's retirement conditions allow it; otherwise keep it as a small Settings entry), the optional applied-skin fallback (keep until the Core field lands), the v1 cache reader for old telemetry records (keep as a bounded compatibility adapter).

---

## 3. Invariants — what 6.0.0 MUST NOT break

These are product guarantees, not preferences. Each needs a regression test (existing or new).

**Protocol and transport**
- Signed Protocol 3, relay `/v1`, schema 5, identity keys, pairing flow, immutable device grants. **No protocol, Core, Host, Paper-JAR or relay change is in scope.** 6.0.0 is a frontend release; it must need no VPS restart.
- `lib/data-source.ts`, `lib/fleet-feed.ts`, `lib/control-state.ts` (reducers), browser store, scope contract generation: keep. No parallel transport, no second store, no feature-flagged old renderer.

**Authorization**
- Effective permission is always the intersection of: immutable device scope ∩ connected agent kind ∩ agent-advertised capability ∩ local policy ∩ action-specific rules ∩ confirmation requirement. The browser **never invents** a capability to make a control available. Disabled controls are convenience only; Paper/Host remain the security authority.
- Confirmations stay **bound** to the immutable server/session target and action. A confirmation dialog must show what it is bound to.
- The browser reads the verified token grant from `/v1/dashboard/session` and intersects it with relay-reported scopes. Preserve that.

**Data truth**
- **Host CPU is machine-wide Host CPU; Paper process CPU is a separate JVM/process metric. Never substitute one for the other**, never merge them into one number, never label them ambiguously.
- Missing data stays **unavailable**. No interpolation across gaps, no synthesized values, no "0" standing in for "unknown".
- Capture time and receipt time stay distinct. Charts use trusted `capturedAt` when supplied. Exact duplicate timestamps replace, not append.
- Fleet shows shared-node totals **once**.
- Reports show only browser-observed windows (1/5/15/30 min), sample count, observed coverage and sample-based p95. No invented long-horizon history.
- Paper connectivity is reported separately from Host service state; the UI never fabricates an "active" service state.

**Console**
- Host is the sole authority for replay, invocation boundaries and retained history. Paper fallback is live-only and suppressed while Host is healthy (relay-signed `console.authority` transitions). `console.execute` is Paper-only. Host output stays available with Paper offline while command entry becomes unavailable.
- Pause/copy/export/search/filter/clear are **local browser operations**. Clearing the view deletes nothing on the server; pausing does not stop relay delivery. The UI must say so.
- Bounded buffers (2,500 lines live/history; smaller safe cache). Device scopes still control full vs error-only visibility.

**Backups & lifecycle**
- Manual full backup only; primary action label **Fully Backup Now**; secondary **Retry Upload**. No automatic-backup creation, no live-snapshot creation, no server-tree restore or file-mutation controls (the Host keeps the Minecraft tree read-only).
- Preflight blocks the action when Host/device/service/RCON/storage/recovery state is unsafe. The operator picks a 30/15/10/5-minute countdown *before* confirming. Closing or reloading the browser never cancels the job; the workspace reconstructs the operation from Host status. Live progress is accepted only when its job ID matches the current durable job.
- Provider connectivity-test time and successful remote-verification time stay visibly distinct. Google Drive/rclone credentials never reach the browser.
- The restart scheduler (daily / weekly / multiple weekdays, bounded timeouts, same countdown presets) cannot implicitly create a backup.

**Privacy & security**
- No access tokens, pairing codes, private keys, provider credentials or unredacted sensitive command/log content in the DOM, audit views, diagnostics, exports, logs or test output.
- Player location/address only when authorized **and** actually supplied.
- No analytics/telemetry SDKs. No third-party assets except the optional player-head URL template (default MCHeads; `disabled` must still forbid remote heads).
- No service worker that caches authenticated data. (A plain web app manifest is allowed.)

**Preferences**
- Keep the single strictly parsed preferences store and its storage key. Additive fields are allowed *with a migration test*; existing users' saved density/text/accent/motion/chart/display-rate choices MUST survive the upgrade.

---

## 4. Rewrite boundary

**Rebuild from scratch (the presentation layer):**
- `app/dashboard.css` (replace entirely), all `app/*-view*.tsx` workspaces, `app/telemetry-chart.tsx` rendering layer (keep geometry math), shell/navigation/drawer, all shared UI primitives (`app/control-views.tsx`, `components/select.tsx` + module CSS, `components/player-head.tsx` visuals), modals, empty/error/loading states, the boot and pairing screens, the favicon/app icons/metadata.
- You may rename and reorganize UI files freely (suggested structure in Section 10.2).

**Keep (logic owners — move code only with its tests intact):**
`lib/data-source.ts`, `lib/control-state.ts`, `lib/fleet-feed.ts`, `lib/telemetry-clock.ts`, `lib/telemetry-freshness.ts`, `lib/display-cadence.ts`, `lib/chart-geometry.ts` (extend only additively), `lib/metric-reports.ts`, `lib/ui-preferences.ts` (additive), browser store, scope/fleet contracts, `protocol/`, `relay/`, `scripts/`, `.github/workflows`.

**Extract carefully:** `app/dashboard.tsx` currently mixes the shell with signed-operation, selection and bound-confirmation logic. Extract the logic into well-named hooks/modules with their existing test coverage, then build the new shell around them. Behavior must be provably identical (the existing "signed two-room mounted flow" test is your anchor).

**Delete when replaced** (no parallel renderers, no flags): the old stylesheet, superseded views, dead exports, historical version-prefixed class names.

---

## 5. Phase 0 — Discovery (mandatory, before any design or code)

The author of this brief could read the README, `package.json`, `AGENTS.md` and the `docs/UI_REVAMP_*` architecture/migration documents, but **not** the contents of `app/`, `components/` or `lib/`. You must inventory them yourself.

Produce `docs/UI_6_BASELINE.md` containing:

1. **Route/workspace inventory:** every page/workspace, its file, its props (`ViewProps`), which `lib/*` modules it consumes, which scopes/capabilities gate each control.
2. **Control inventory:** every button, form, dialog and action in the app, with its authorization rule and confirmation behavior. This is your parity checklist for 6.0.0.
3. **Data inventory:** every field the UI reads from reducers (name, unit, source Paper/Host, cadence, nullable?). Note exactly which fields exist for *service CPU/RAM, TPS, MSPT, heap, host memory, player roster, backup phases and counters, console authority state*.
4. **State inventory:** loading, empty, stale, disconnected, degraded, forbidden-by-scope, busy, error: which exist today per workspace and which are missing.
5. **Test inventory:** what `tests/*.test.mjs` and `scripts/verify-ui-browser.mjs` cover; where parity tests must be added.
6. **Screenshots** of every workspace in light/dark at 390, 768, 1280 and 1920 px widths (use a signed local/fixture session; no real credentials), stored under `artifacts/ui6-baseline/` (git-ignored if large).
7. **Pain points** you observe (information density, hierarchy, mobile friction, inconsistent controls, slow areas). These feed the design plan.

Run `npm ci && npm run check` once on the untouched branch and record the result. If it fails before you change anything, say so.

---

## 6. Design direction

### 6.1 Concept

**Subject:** a live Minecraft server's operations console. **Primary job:** tell the operator, fast and truthfully, whether the server is healthy and let them act safely. **Audience:** a small number of technically comfortable operators, often on a phone, sometimes mid-incident.

**Working name for the design language: "Deepslate."** Calm, dense-where-needed, instrument-like. The world it borrows from is the game's *materials* (deepslate, quartz, lapis, emerald, redstone, amethyst, copper, gold) and its *tick*. It borrows **no** pixel fonts, grass textures, cubes, creeper faces or Minecraft logos/assets (trademark/IP risk and kitsch). The reference is *professional observability tooling*, with the game's vocabulary used only in color naming and in one signature element.

**The one signature element (spend boldness here, keep everything else quiet): the Tick Pulse.**
A continuous strip across the top of Overview (and a compact version in the server header) where **each slot is one real captured sample** of server tick health, colored by TPS state, with height encoding MSPT against the 50 ms budget. Gaps render as visibly empty, hatched slots; stale data dims; the right edge is "now". It is the product's heartbeat: you can read "healthy / lagging / dropped out" at a glance, truthfully. Rules:
- Only real samples. No interpolation, no smoothing, no fake animation when data is stale.
- Window follows the existing observed windows (1/5/15/30 min).
- Thresholds live in one documented constant file (proposed defaults: TPS ≥ 19 healthy, 15–19 degraded, < 15 critical; MSPT budget 50 ms). These are *design defaults*, not product claims; document them in the design doc and make them easy to change.
- Hover/focus on a slot reveals timestamp, TPS, MSPT, source and capture age. A table alternative exists (already required for charts).

### 6.2 Anti-template rules (the "no AI slop" standard)

The result must read as a deliberate product, not a generated dashboard. These are **rejection criteria** in design review:

- ❌ Six identical rounded metric cards with a big number, a small grey label, a delta chip and a gradient accent. (This is the default dashboard; do not ship it.) Overview uses *hierarchy*: the Tick Pulse first, then a dense instrument panel where importance drives size, not equal tiles.
- ❌ Cream background + serif display + terracotta accent. ❌ Near-black + single acid-green/vermilion accent. ❌ Broadsheet hairline-rule layouts.
- ❌ One border-radius and one soft grey shadow on everything. Use a radius *scale tied to hierarchy* and separate layers by tone and border, not by stacked drop shadows.
- ❌ Gradient washes, glassmorphism and glow as decoration. (Allowed: none by default. A single functional use, e.g. a focus ring or the Pulse's "now" edge, must be justified in the design doc.)
- ❌ Tracked-out ALL-CAPS eyebrow labels above headings; labels built as "WORD — fragment"; meta strings joined with middle dots; trailing `→` on links/buttons; numbered markers where content isn't a sequence.
- ❌ Accenting a single word in a heading; labels that add nothing above content.
- ❌ Monospace for general small labels. Monospace is for console output, UUIDs, hostnames, file paths, commands, and nothing else.
- ❌ Fade-and-slide-up on every section, hover lift on every card, decorative background animation, count-up number animations (they lag behind truth).
- ❌ Emoji as icons. ❌ Stock-illustration empty states. ❌ Lorem ipsum or fake demo data in shipped UI.

### 6.3 Required design process (two passes)

1. **Plan** in `docs/UI_6_DESIGN.md` *before code*: the token system (color, type, spacing, radius, elevation, motion), a layout concept per workspace with **ASCII wireframes** (mobile + desktop), and a principles list.
2. **Self-review the plan against 6.2.** Work a "what would a generic dashboard do here?" pass for each workspace; if your plan matches the generic answer, revise it and record what you changed and why. Only then build.
3. **Critique with screenshots** at each milestone (Playwright captures) and remove one accessory per screen ("take one thing off before leaving the house").

### 6.4 Color

Light and dark are both first-class; default follows the OS (`prefers-color-scheme`) with an explicit override in Settings. Use CSS `light-dark()`/custom properties; define everything as tokens, never raw hex in components. **These values are starting points: compute WCAG contrast for every text/background and status/background pair and adjust until AA is met (text ≥ 4.5:1, large text and UI boundaries ≥ 3:1).**

```css
/* Dark: Deepslate */
--canvas:        #1A2025;   /* app background */
--surface:       #222A31;   /* panels */
--surface-raised:#2B353D;   /* menus, popovers, dialogs */
--surface-sunken:#161B1F;   /* console, inputs, table wells */
--border:        #36424B;
--text:          #E6ECEF;
--text-muted:    #9FADB7;   /* must pass 4.5:1 on --canvas and --surface */

/* Light: Quartz */
--canvas:        #F3F5F4;
--surface:       #FFFFFF;
--surface-raised:#FFFFFF;
--surface-sunken:#E8ECEA;
--border:        #D3DAD7;
--text:          #1B2227;
--text-muted:    #56646D;

/* Status (each has a dark and light value; never rely on color alone: pair with icon + text) */
--ok:      emerald   /* healthy, connected, verified */
--warn:    gold      /* degraded, stale, retryable */
--crit:    redstone  /* failed, offline, blocked-unsafe */
--info:    lapis     /* neutral informational / in progress */
--unknown: stone gray/* unavailable, no data */
```

**Accent (user-selectable, restrained):** Lapis (default), Emerald, Amethyst, Copper, Gold. The accent marks *interactive and selected* things only (primary action, focus ring, active nav, selected row). It is never used for status; status colors are reserved and constant.

### 6.5 Typography

- Two families at most: one **UI sans** and one **mono** (console/identifiers only), self-hosted through `next/font` (no runtime requests to font CDNs).
- Choose the UI sans deliberately, *not* the framework default (Geist) and not Inter by reflex. Short-list and test 2–3 candidates (e.g. Hanken Grotesk, Schibsted Grotesk, or similar) against these **hard requirements**: tabular figures (`font-variant-numeric: tabular-nums`) so live numbers never jitter; full Latin-extended coverage (the maintainer writes Brazilian Portuguese, so `ã ç é ô` etc. must render correctly); weights ≥ 400/500/600; good rendering at 12–13 px. Record the decision and the comparison in the design doc. Mono candidates: JetBrains Mono, Commit Mono, or similar with clear `0/O` and `1/l/I`.
- Type scale from a single ratio (e.g. 12 / 13 / 14 / 16 / 20 / 28 px, in `rem`). Body 14 px / 1.5 on desktop, 15–16 px on mobile. Line length ≤ 75 characters for prose. All sizes are `rem` so the existing "text size" preference scales everything.
- Numbers are first-class: tabular, right-aligned in tables, units set in the muted color, **no layout shift when values change width** (reserve width or use fixed tabular slots).

### 6.6 Shape, space, elevation

- **Radius scale by role:** 3 px (badges, inline chips), 6 px (buttons, inputs), 10 px (panels), 16 px (dialogs/sheets). Not one value for everything.
- **Spacing:** 4 px base grid; tokens `--space-1…--space-8`; density preference (compact / comfortable / spacious) scales a small set of density tokens (row height, panel padding, gap), not every value.
- **Elevation:** layers are separated by tone (`--surface` → `--surface-raised`) and a 1 px border. A single subtle shadow is allowed only for floating layers (menus, dialogs, the mobile drawer).
- **Targets:** ≥ 44 px touch targets on mobile, ≥ 32 px on desktop compact.

### 6.7 Motion

- Motion answers an action or marks a real state change; it is never ambient.
- Durations 100–180 ms for feedback, ≤ 240 ms for panels/dialogs, `ease-out`; opacity/transform only (no layout-triggering animation).
- Allowed: dialog/popover/drawer enter-exit, row insertion highlight (brief) for new console/chat/player events, status-badge crossfade, Tick Pulse new-sample slide, route/workspace transition via the View Transitions API *where supported* with graceful fallback.
- **Live numbers do not count up or tween.** They update in place (fast crossfade at most) because animation would make them lag behind truth. Honor the Display update rate for presentation cadence; operational state (connection, presence deltas, backup progress, action results) bypasses throttling as today.
- Respect the existing motion preference (full / reduced / off) **and** `prefers-reduced-motion`. With motion off, the UI must be fully functional and still communicate every state change (e.g. via brief static highlight).

### 6.8 Iconography and data-viz language

- One cohesive stroke icon set (inline SVG, drawn or vendored as plain SVG components; no emoji, no icon-font). 16/20 px, `currentColor`, consistent stroke width.
- Charts: keep the native SVG renderer and `chart-geometry`. Restyle: thin, high-contrast lines, a quiet grid, direct labels instead of legends where possible, threshold bands for TPS/MSPT, crosshair + shared tooltip, keyboard-navigable points, **gap hatching** (never a connecting line), pattern/shape differences so series are distinguishable without color. Six primary charts stay: TPS, MSPT, Host CPU, Paper process CPU, Host memory used, JVM heap used. Host CPU and Paper process CPU are always separately labeled.
- Sparklines inline in tables/instrument panel use the same adapter (`lib/metric-reports.ts`) so every surface shows the same field/unit/source/capture semantics.

### 6.9 Voice and copy

- Sentence case, plain verbs, active voice. Name things by what the operator understands, not by how the system is built. One action keeps one name through its whole flow (button → confirmation → toast → audit entry).
- **Keep safety-critical labels exactly:** "Fully Backup Now", "Retry Upload". Do not rename them.
- Errors say what happened and what to do, never apologize, never vague. Empty states point to the next action. Disabled controls always have an explanation (Section 8.3).
- All user-facing strings live in one module (`lib/copy` or similar) to keep wording consistent and make future localization possible. (Shipping a second locale is out of scope; a pt-BR pass is a sensible follow-up, not a 6.0.0 requirement.)

---

## 7. Information architecture and shell

### 7.1 Global structure

```
Desktop (≥ 1024px)
┌────────┬──────────────────────────────────────────────────────────────┐
│ Rail   │ Server header: name · connection authority · Tick Pulse mini │
│        ├──────────────────────────────────────────────────────────────┤
│ Fleet  │ Workspace content (single scroll region)                     │
│ ────── │                                                              │
│ Monitor│                                                              │
│  Overview                                                             │
│  Performance                                                          │
│ Operate│                                                              │
│  Players  Console  Chat  Plugins  Server  Backups                     │
│ Manage │                                                              │
│  Configuration  Access  Audit  Settings                               │
└────────┴──────────────────────────────────────────────────────────────┘

Mobile (< 768px): top bar (menu button, server name, status dot, ⌘K/search) →
single column; navigation in one drawer (inert when closed, focus-trapped when open).
Bottom bar is NOT used (workspace count is too high); drawer + command palette are the navigation.
```

- **Grouping encodes meaning** (Monitor / Operate / Manage). Group titles are quiet sentence-case text, not ALL-CAPS eyebrows.
- **Server switcher** in the header: paired instances with live state dots; switching preserves the workspace when the scope allows it. Selected server/session is an immutable target for bound confirmations.
- **Fleet** is a separate global destination (not a server workspace). Shared-node totals appear once.
- Workspaces load **on demand** (code-split); the shell must paint before any workspace chunk.
- Responsive breakpoints: 360 (min supported), 480, 768, 1024, 1440, 1920+. Layouts use container queries so panels adapt to available width, not just viewport width.

### 7.2 Persistent status surface ("Connection authority")

A compact, always-visible component in the header answering: *Is the relay connected? Is Paper connected? Is Host connected? Who is authoritative for the console right now?* States: relay up/down; Paper `connected / offline`; Host `connected / degraded / offline`; console `HOST / PAPER_FALLBACK / UNAVAILABLE`. Expands to a popover with last-seen times and the plain-language consequence ("Paper is offline: you can read the console, but you can't run commands"). It is the single place operators learn what is currently possible.

### 7.3 Command palette

`Ctrl/⌘ + K` opens a palette: jump to workspace, switch server, jump to player by name, open recent action. It **navigates only**; it never performs dangerous actions directly (those still go through their bound confirmation flows). Keyboard shortcuts for navigation (`g` then letter, documented in a `?` shortcuts dialog) must not trigger inside inputs and must be discoverable.

---

## 8. Cross-cutting UX systems

### 8.1 Freshness and truth indicators

Every live value can answer "where is this from and how old is it?" via a consistent disclosure (source Paper/Host, unit, captured-at vs received-at). Stale values dim and gain a "stale · 12 s" marker driven by `lib/telemetry-freshness.ts`; unavailable values show a distinct "unavailable" glyph + text (never blank, never zero). Disconnected agents turn their dependent panels into a clear degraded state rather than showing last-known values as if current.

### 8.2 Action pattern (all state-changing actions)

`Idle → Confirm (bound to target) → Pending → Result (success / failure with reason) → Audit-visible`.
- No optimistic success. The result comes from the signed response. BUSY/refused results are shown with their reason.
- Confirmation dialogs show the **bound target** (server name, player name + short UUID, service unit, etc.) and the plain-language effect. Destructive confirmations require a deliberate gesture (typed confirmation only where the existing flow already requires it).
- Results surface as a toast *and* remain discoverable in-context (inline status) and in Audit where the existing system records them.

### 8.3 "Why is this disabled?"

One shared explainer used by every gated control. It reports, in plain language, which layer blocks the action: device scope, agent not connected, agent capability missing, local policy, action requirement not met, confirmation pending, or Owner-only. It is built **only from data the browser already has**; if the layer can't be determined, it says so rather than guessing. The Access workspace renders the same intersection model visually (scope ∩ agent ∩ capability ∩ policy ∩ rules).

### 8.4 State completeness

Every workspace and every panel MUST have designed states for: loading (skeleton shaped like the real content, no spinners-on-blank), empty, stale, disconnected, degraded/partial, forbidden-by-scope (explain which scope and that re-pairing is required for newly introduced scopes such as `maintenance.run`), busy, and error. Add per-workspace React error boundaries with a recover action.

### 8.5 Notifications

Toasts for action results; a lightweight in-browser **activity tray** (session-only) listing recent operational events observed in this tab (connection changes, action results, backup phase changes). It is not persisted, not a second audit log, and never stores console/chat/player content.

### 8.6 Preferences

Settings keeps: theme (system/light/dark), accent, density, text size, motion, chart options, Display update rate (5 presets, default Balanced 500 ms). Additions allowed (browser-local, additive, migration-tested): reduce-transparency (n/a if none), console wrap/timestamp toggles, default Performance window, pinned Overview metrics. All preference changes apply live and preview instantly.

---

## 9. Workspace specifications

For each: **purpose → layout → required content → states → parity requirements**. Wireframes in `docs/UI_6_DESIGN.md` must refine these.

### 9.1 Boot and pairing
Replace the current "Opening your browser workspace…" placeholder with a designed boot screen (brand mark, indeterminate progress, no layout jump into the app). Preserve the entire pairing/identity flow exactly; redesign its screens for clarity (what a pairing code is, what role/scopes the device will get, success/failure/expiry states). No secrets rendered or logged.

### 9.2 Fleet
List/grid toggle of paired instances: name, connection authority summary, player count, a mini Tick Pulse, last-seen. Shared-node totals shown once above the list. Row → opens server (Overview). States: none paired (guided empty state), all offline, partial.

### 9.3 Overview
Purpose: the three-second answer.
```
┌────────────────────────────────────────────────────────────────────┐
│ Tick Pulse  ▁▂▂▃▂▂▂▂▅▇▃▂▂▂ ░░░ ▂▂▃▂▂   TPS 19.9   MSPT 31 ms  [15m]│
├───────────────────────────────┬────────────────────────────────────┤
│ Instrument panel (dense)      │ Players now                        │
│  Paper CPU (process) ▂▃▂ 18%  │  12 online · avatars + names       │
│  Host CPU (machine)  ▂▂▃ 41%  │  recent joins/quits                │
│  JVM heap            ▃▃▄ 3.1G │                                    │
│  Host memory         ▃▃▃ 9.4G │ Server & Backup status             │
│  Service CPU/RAM (systemd)    │  systemd state · last backup ·     │
│  …six instance metrics        │  next scheduled restart            │
└───────────────────────────────┴────────────────────────────────────┘
```
- The **six instance metrics** from 5.0.0 are all present, including systemd service CPU/RAM. Presented as an instrument panel with inline sparklines and size by importance, **not six equal cards**.
- Each metric: value, unit, sparkline, freshness, source disclosure.
- Alerts/attention strip appears only when something needs action (degraded Host source, backup degraded/retryable, Paper offline), with a link to the relevant workspace.

### 9.4 Performance
Window selector (1/5/15/30 min), the six primary charts in a responsive grid (container-query driven), shared crosshair across charts, threshold bands, gap hatching. Report panel: sample count, observed coverage, sample-based p95, gaps; bounded data table; **CSV/JSON export with source/unit/timestamp awareness**, nothing private. Small-screen: charts stack, table collapses to a card list.

### 9.5 Players
Roster (search, sort, filters, avatar via safe `player-head`, online duration, location/address only if authorized and supplied). Row → detail drawer (profile, actions, history entry point). Actions menu groups by risk; every disabled action uses the "why disabled" explainer; confirmations bound to player + server. Player history modal (requires `players.history.view` **and** Paper capability) restyled; join/quit delta reconciliation unchanged. Applied/offline skin handling and the custom accessible dropdowns (`components/select`) preserved with improved visuals.

### 9.6 Console
Layout: full-height log pane (`--surface-sunken`, mono) + sticky toolbar + command bar.
- **Virtualized** rendering for the 2,500-line buffer (windowing implemented in-house; no new dependency unless justified under 10.1). Auto-follow with "N new lines — jump to latest" when scrolled up. Pausing is local and labeled so.
- Authority badge `HOST` / `PAPER_FALLBACK` / `UNAVAILABLE` with explanation; invocation changes rendered as startup/session separators; "Load older history" explicitly queries Host (100-line pages) and states journald retention limits.
- Level styling is never color-only (icon/prefix too). Search with match highlighting and next/prev; filter by level; wrap and timestamp toggles; copy and export; clear (tooltip: "Clears this view only. Server logs are not deleted.").
- Command bar: Paper-only. When Paper is offline it is disabled with an explanation; history stays readable. Command history (session-only), no secrets echoed.
- Scope-aware: full vs error-only visibility is clearly indicated.
- Screen readers: the log region is not a live region that announces every line; provide a polite summary announcement for new errors only.

### 9.7 Chat
Message list (virtualized if the buffer warrants), sender heads, timestamps on hover/focus, Paper-owned send (gated), bounded buffer, clear empty/disconnected states. No persistence of chat content.

### 9.8 Plugins
Inventory from Paper state: name, version, enabled state, author if supplied; search/filter; read-only unless existing capabilities say otherwise. Preserve every existing action and gating.

### 9.9 Server
Host-authoritative systemd status and lifecycle (start/stop/restart as they exist today), with Paper connectivity shown *separately*. Lifecycle actions use the action pattern with bound confirmation, BUSY handling and explicit consequences ("Players will be disconnected."). Show service state history observed in this session if available from the reducer.

### 9.10 Backups & Maintenance
Purpose: make a high-stakes, long-running Host job legible and safe.
- **Preflight panel** (always visible, automatic): each check (Host, device, service, RCON, storage, recovery) with pass/fail/unknown and the reason; **Fully Backup Now** is disabled with the explanation when unsafe.
- **Countdown selector** (30/15/10/5 min) is part of the confirmation, chosen before confirming.
- **Active-operation view** (reconstructed from Host status on every load): a phase timeline derived from the *actual* Host job fields (you must map real phase names/states from the protocol/status types in Phase 0; do not invent phases) covering countdown, `save-all flush`, systemd stop proof, cold archive/local verify, Drive/rclone staging and verification, VPS ZIP cleanup, automatic restart. Two **full-width progress bars** (source compression, rclone transfer) with exact byte counters and current rate; job-ID matching enforced.
- Degraded/retryable outcomes: clear banner ("Local backup verified; upload failed. Minecraft is back online."), **Retry Upload** reuses the local archive and says no shutdown will occur.
- Distinct timestamps: "last provider connectivity test" vs "last verified remote backup".
- Backup list with verification, deletion/retention actions as they exist, local recovery runbook link. **No restore or server-tree mutation controls.**
- **Restart scheduler** editor (daily/weekly/multi-weekday, countdown presets, bounded shutdown/startup timeouts) clearly separate from backups, with copy stating it cannot create a backup.
- Google Drive/rclone credentials: never shown.

### 9.11 Configuration
Preserve the permission-gated file workflow exactly. Modernize: file tree + editor pane (split on desktop, stacked on mobile), clear read-only vs writable state, unsaved-changes indicator, **client-side diff of pending changes** (pure UI), save confirmation bound to file + server. Mono only for file content/paths. No new write capabilities.

### 9.12 Access
Devices and roles with a visual **effective-permission intersection** (Section 8.3), immutable grants shown as immutable, revocation with bound confirmation, clear explanation that devices paired before a scope existed must be re-paired. No tokens/keys displayed.

### 9.13 Audit
Filterable timeline (actor, action, target, result, time), redaction preserved, bounded pagination, accessible table alternative. Never shows secrets or unredacted sensitive content.

### 9.14 Settings
Appearance, Display update rate, data & privacy (clear local cache; legacy activity-archive cleanup entry only if still required by the migration retirement conditions), About (dashboard version **6.0.0**, protocol 3, relay hostname only). Live preview of theme/accent/density.

---

## 10. Engineering architecture

### 10.1 Stack and dependencies
- Next `16.3.8` / React `19.2.8` / TypeScript strict. Keep Node `>=22.13.0` engines.
- **Default: add no runtime dependencies** (5.0.0's policy). Use modern platform features: CSS custom properties, `@layer`, container queries, `:has()`, `color-mix()`, `light-dark()`, `@starting-style`, the Popover and `<dialog>` elements, View Transitions API (with fallback).
- If you believe a dependency is justified (e.g. one headless accessibility-primitives library for menus/dialogs/combobox), write a short justification in `docs/UI_6_ARCHITECTURE.md` (what it replaces, size cost, a11y benefit, maintenance risk) and keep it to **one**. No component kit with its own visual language, no chart library, no animation engine, no CSS-in-JS, no state library.
- Tooling devDependencies (Playwright, axe) already exist; extend them.

### 10.2 Suggested structure
```
app/
  layout.tsx, page.tsx, icon/manifest
  shell/            # Shell, Rail, ServerHeader, ConnectionAuthority, CommandPalette, Drawer
  workspaces/       # overview/, performance/, players/, console/, chat/, plugins/,
                    # server/, backups/, configuration/, access/, audit/, settings/, fleet/
  ui/               # primitives: Button, Panel, Badge, Field, Select, Dialog, Popover,
                    # Menu, Tabs, Table, Toast, Skeleton, EmptyState, Disclosure, Icon
  charts/           # TelemetryChart (renderer), TickPulse, Sparkline
  styles/           # tokens.css, reset.css, base.css, utilities.css (all in @layer order)
lib/                # unchanged logic owners (+ copy.ts, availability.ts for "why disabled")
```
Pages receive typed `ViewProps`. Workspaces are `lazy`/dynamic imports. Each workspace owns its CSS Module; shared look comes only from tokens + `ui/` primitives.

### 10.3 CSS architecture
`@layer reset, tokens, base, primitives, workspaces, utilities;` — no `!important`, no selector-specificity wars, no historical version prefixes, no override stylesheet. Tokens are the only source of color/space/radius/type/motion. A lint/test (see 11) greps for raw hex colors and non-token spacing in component CSS.

### 10.4 Performance budgets (measure and report; fail the milestone if badly exceeded)
- Shell paints before workspace code loads; each workspace chunk lazy.
- Targets on a mid-tier mobile profile: LCP < 2.0 s on the shell, CLS < 0.05, INP < 150 ms during live telemetry, no long task > 100 ms during steady-state updates at "Realtime".
- Initial JS (shell) as small as achievable; report the before/after bundle sizes per route in `docs/UI_6_VALIDATION.md`.
- Live updates must not re-render the whole tree: subscribe at the leaf, memoize selectors, keep per-metric components isolated. Console and chat are virtualized. Charts keep bounded, extrema-preserving paths (no unbounded DOM).
- `ResizeObserver`/`IntersectionObserver` must disconnect on unmount. Pause off-screen chart work.

### 10.5 Accessibility (WCAG 2.2 AA)
Zero serious/critical axe violations on every workspace in every theme. Full keyboard operability with visible focus (≥ 3:1 focus ring), logical focus order, focus trap + restore for dialogs/drawer, inert closed content, skip link, landmarks, correct table semantics, accessible names for every icon button, text alternatives (tables) for all charts, `forced-colors` support, 200% zoom and text-size scaling without loss, target-size ≥ 24 px minimum (44 px mobile), no color-only meaning, reduced-motion honored, live regions used sparingly and politely.

### 10.6 Security hygiene
Strict CSP compatible with Vercel and the player-head template; no `dangerouslySetInnerHTML` with remote or console content (console/chat content is always rendered as text); sanitize/escape everything from agents; `rel="noopener noreferrer"` on external links; no tokens in URLs.

---

## 11. Testing and validation

Keep the whole existing suite passing and extend it. Required additions:

1. **Parity tests** for every control in the Phase 0 inventory (visibility rules by scope/capability/connection, confirmation binding, BUSY handling).
2. **Invariant tests** for Section 3: Host-vs-Paper CPU never merged; unavailable never rendered as 0; gaps never interpolated; shared-node totals once; console authority transitions; local-only console operations don't hit the network; backup job-ID matching and reconstruction after reload; "Fully Backup Now" blocked by failed preflight; no restore controls rendered; no secret-like strings in DOM/export fixtures.
3. **Preferences migration test:** a saved 5.0.0 preferences blob loads and behaves identically in 6.0.0.
4. **Playwright browser matrix** via `scripts/verify-ui-browser.mjs` (extend it): 360 / 390 / 768 / 1024 / 1440 / 1920 px × light/dark × motion on/off, each workspace, with axe scans, keyboard-only walkthrough of the primary flows (pair → navigate → run a player action → open console → start a backup preflight), and **screenshot baselines** for key states (healthy, stale, degraded, disconnected, backup in progress, backup degraded, forbidden scope, empty).
5. **Fixtures:** extend the existing signed-session test harness with scenario fixtures (healthy server, lagging server, Host offline/Paper fallback, Paper offline, backup running/degraded, no-scope device). Fixtures contain no real credentials.
6. **Source hygiene checks:** no raw hex in component CSS, no `!important`, no leftover legacy class prefixes, no dead exports, no duplicate renderers.
7. **Performance run:** Lighthouse/Playwright trace on shell + Overview + Console under simulated mid-tier mobile; record results.

Record everything in `docs/UI_6_VALIDATION.md` with an explicit table: gate → command/method → result (**passed / failed / not executed**).

Final command set (must be green):
```
npm ci
npm run check
npm run relay:smoke
npm run relay:standalone:smoke
npm run relay:standalone:package
npm run test:browser
npm run build
```

---

## 12. Milestones and exit criteria

| # | Milestone | Exit criteria |
|---|---|---|
| M0 | Discovery | `docs/UI_6_BASELINE.md` complete; baseline `npm run check` result recorded; baseline screenshots captured |
| M1 | Design plan | `docs/UI_6_DESIGN.md`: tokens, type decision, wireframes (mobile+desktop) for every workspace, Tick Pulse spec, anti-template self-review recorded |
| M2 | Foundation | `styles/` tokens + layers, fonts, theme switching, primitives (`ui/`), Icon set, Storybook-less "kitchen sink" internal page (dev-only, excluded from production build) showing every primitive in every state/theme |
| M3 | Shell | New shell, rail, drawer, server header, Connection authority, command palette, boot screen, logic extracted from `dashboard.tsx` with signed-flow tests green |
| M4 | Monitor | Fleet, Overview (+ Tick Pulse), Performance (+ reports/export); invariant tests for data truth green |
| M5 | Operate A | Players, Console, Chat, Plugins; virtualization; console authority tests green |
| M6 | Operate B | Server, Backups & Maintenance (incl. scheduler); backup invariants and reload-reconstruction tests green |
| M7 | Manage | Configuration, Access, Audit, Settings; preferences migration test green |
| M8 | Hardening | Full a11y pass, performance pass, responsive matrix, visual baselines, legacy deletion, source-hygiene checks |
| M9 | Release prep | Version bump, docs, release notes, rollout/rollback, final validation report |

Do not start a milestone until the previous one's exit criteria hold. At the end of each, commit and append a short entry to `docs/UI_6_PROGRESS.md` (what changed, what is deferred, any risk found).

---

## 13. Documentation and release deliverables

- `package.json` version → `6.0.0`; visible UI version label "Control Room 6.0.0"; README rewritten for 6.0.0 (keep the accurate authority/console/backup/security explanations; update screenshots and the revamp section).
- `RELEASE_NOTES_6.0.0.md`: user-facing summary (new design, Tick Pulse, command palette, "why disabled", improved console/backups/performance), compatibility statement (**still Protocol 3 / `/v1`; no identity reset; no Paper/Host JAR or VPS restart required; devices paired before a scope existed still need re-pairing for that scope**), known limitations, and the explicit gate statement that live PlexonCraft certification is *not* implied by CI or preview.
- `docs/UI_6_DESIGN.md`, `UI_6_ARCHITECTURE.md`, `UI_6_MIGRATION_MATRIX.md` (before → after owner → proof, like the 5.0.0 one), `UI_6_VALIDATION.md`, `UI_6_ROLLOUT.md` (preview → promote steps, rollback to `v5.0.0`).
- Update `CLAUDE.md` with a short "6.0.0 design system rules" section (tokens only, no raw hex, primitives first, anti-template list) so future agents keep the system coherent. Keep the `AGENTS.md` Next.js notice intact.
- Retire or relocate the superseded `docs/UI_REVAMP_*` (5.0) documents into `docs/archive/` with a note, rather than deleting history.

---

## 14. Definition of done

6.0.0 is done when **all** of these are true:

1. Every Section 3 invariant has a passing test, and the parity checklist from Phase 0 is 100% covered.
2. All workspaces are rebuilt on the new design system; no legacy stylesheet, view, class prefix, bridge export or duplicate renderer remains.
3. The final command set (Section 11) passes; every non-executed gate is listed as such.
4. Axe: zero serious/critical across the matrix; keyboard-only completion of primary flows verified.
5. Performance budgets met or the deviation is documented with a reason and a follow-up.
6. A Vercel **preview** is built from the branch and the documented live-acceptance checklist (real Host journald readability, Paper-stopped history browsing, startup/shutdown capture, Host restart/cursor recovery, systemd/RCON/rclone readiness, a real **Fully Backup Now**, browser reconnect during it, controlled degraded/retry) is handed to the maintainer as **to be executed by a human against the real server**. Do not claim these passed.
7. A design reviewer, using only the screenshots, would not mistake the product for a generic admin template (Section 6.2 checklist is signed off in `UI_6_DESIGN.md`).

### Final report format (your last message)

1. What was built (one paragraph) and the branch/commit/preview link.
2. Gate table: command/method → passed / failed / not executed.
3. Deviations from this spec, each with the reason.
4. Anything tempting but deliberately omitted because the data/capability doesn't exist (so the maintainer can decide whether a future Core/Host change is worth it).
5. Open risks and recommended manual acceptance steps.

---

## Appendix A — Tempting-but-forbidden list

- Long-term history, trends beyond the observed browser window, "uptime %" or SLA numbers the system doesn't measure.
- Combining Host CPU and Paper process CPU into a single "CPU" figure.
- Optimistic UI for any signed action; auto-retrying dangerous actions; auto-dismissing failure results.
- Showing last-known values as current when an agent is offline.
- Restore buttons, direct file mutation outside the existing Configuration workflow, scheduled automatic backups.
- Client-side "permission shortcuts" (e.g. enabling a control because the role name sounds right).
- Persisting console/chat/player content beyond the existing bounded caches.
- Third-party fonts/CDNs/analytics/trackers; service-worker caching of authenticated data.
- Demo or placeholder data in production code paths.

## Appendix B — Small details that separate "professional" from "generated"

- Numbers never jitter (tabular figures, reserved width).
- Every list has a considered empty state and a skeleton that matches its final shape.
- Every timestamp can be read as relative ("12 s ago") and absolute on hover/focus, in the user's locale and time zone.
- Truncated text (names, paths) is always recoverable (title/tooltip/copy button).
- Focus never gets lost after an action or dialog close.
- The browser tab title and favicon reflect state (e.g. offline/degraded marker) without being noisy.
- Copy-to-clipboard confirmations are inline, not blocking.
- Dark and light are *designed*, not inverted: re-check status colors, borders and charts in both.
- One idea per screen region; if a panel needs a paragraph of explanation, the design is wrong or the explanation belongs in a disclosure.

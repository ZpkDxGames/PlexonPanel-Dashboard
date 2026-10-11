---
name: minecraft-dashboard-revamp
description: Use when asked to redesign, revamp, or significantly improve the web UI/UX of a dashboard that monitors and manages a Minecraft server (console, players, metrics, files, plugins, backups). Ships with a working visual reference prototype, inspiration images and a scored review loop, so the result matches a professional light-glass design instead of a flat default. Preserves all existing functionality.
---

# Minecraft Server Dashboard — Complete UI/UX Revamp (v2)

> **Audience:** an autonomous coding agent.
> **Goal:** turn a simple, plain Minecraft server dashboard into a professional, modern, animated, content-rich control panel, without breaking anything that already works.
> **Read this entire file before touching code.** Follow the phases in order. Do not skip Phase 0.
> **v2 change:** the visual target is no longer described only in words. A working prototype and reference images ship with this file (Section 0.5). Matching them is mandatory, and a scored review loop (Section 14) decides when you are done.

---

## 0. Mission and success criteria

You are replacing a plain interface with a product-grade control panel for monitoring and managing a Minecraft server. When you finish, a server owner opening the dashboard should:

1. Understand the server's health in under 3 seconds (status, players, TPS, RAM, CPU, uptime).
2. See live, smooth, animated charts, not static numbers.
3. Read the console comfortably: colored, structured, searchable, filterable, with command history and autocomplete.
4. Manage players, plugins/mods, files, backups, and settings from clearly organized pages.
5. Feel that the product was designed by a professional, not generated from a template.

**The revamp is successful only if all of these hold:**

- [ ] Every feature and endpoint that existed before still works (feature parity is mandatory).
- [ ] A consistent design system (tokens + components) drives every screen. No one-off styles.
- [ ] Live data updates animate smoothly. Nothing "jumps".
- [ ] The console is dramatically more readable than before.
- [ ] Layout works at 360px, 768px, 1280px, 1920px and 2560px widths.
- [ ] Light and dark themes both look intentional.
- [ ] Keyboard navigation and screen-reader basics work (WCAG 2.2 AA contrast).
- [ ] `prefers-reduced-motion` is respected.
- [ ] No console errors, no layout shift on load, 60fps interactions on mid-range hardware.
- [ ] The output does not look like generic "AI slop" (see Section 15).
- [ ] **Side by side with `reference/plexonpanel-reference.html`, a reviewer cannot tell the two come from different design systems** (same surfaces, radii, KPI anatomy, chart treatment, console rows, motion). The scored review in Section 14 passes.
- [ ] The dashboard looks good in all three data states: busy, idle (0 players, flat metrics) and offline (Section 3.5).

---

## 0.5 Visual contract (read this before anything else)

### Assets that ship with this file
Copy the whole `reference/` folder into the repo as `docs/reference/` (if it is not already there), then open everything in it.

| File | What it is |
|---|---|
| `reference/plexonpanel-reference.html` | **Working prototype** of the Overview and Console pages (simulated data). Open it in a browser. Try `?theme=dark`, `?idle=1` and `#console`. Its CSS tokens and DOM are the source of truth for the look. |
| `reference/inspiration-1..4-*.png` | The owner's mood references: soft glass cards, indigo accent, navy sidebar, KPI cards with sparklines, floating tooltips. |
| `reference/prototype-*.png` | Screenshots of the prototype (light, dark, idle, console) for quick comparison. |
| `reference/anti-reference-v1-build.png` | **What a first attempt shipped and the owner rejected as "too plain, simple, not professional".** Never produce anything that resembles it. |

First action of the task: open the prototype in a browser and screenshot it, view every image in `reference/`, and write three sentences in `docs/REVAMP_AUDIT.md` describing the look you must match. If you cannot view images, read the prototype's `<style>` block and DOM instead; it is complete.

### What is binding and what you may adapt
| Binding (match closely, do not "simplify") | Adaptable |
|---|---|
| Token values and theme structure (Section 3.2) | Framework, file layout, bundler |
| Card anatomy: 24px radius, glass surface, 1px hairline, layered soft shadow, 22–24px padding, hover lift | Which extra pages exist, as long as they reuse the same components |
| Sidebar (deep navy, sliding active pill), top bar, server header with status pill, MOTD panel and health sentence | Icon set (same 1.75 stroke, 18px) |
| KPI card anatomy: icon chip, label plus one-line sub-label, big number, delta pill row, sparkline or segmented gauge | Chart library, provided the visuals below are matched |
| Hero chart: adaptive axis, gradient area, threshold line, pulsing end dot, continuous slide on each new sample, dark tooltip bubble, segmented controls with sliding thumb | Data keys and endpoints |
| Player rows with pixel heads, ping dot, relative times | Exact copy of microtext, as long as Section 3.6 is followed |
| Console row anatomy: level badge, plugin tag, semantic row tints, collapsed stack traces, filter chips with counts, jump-to-bottom pill, prompt, suggestion list, macro chips | Number of widgets per page, as long as hierarchy and density stay |
| Motion timings and the single orchestrated load sequence | |

If the repo uses a framework, port the prototype component by component and keep the same DOM structure and CSS. Do not redraw it from memory and do not substitute your own style.

### Why the first attempt failed (so you do not repeat it)
1. Flat dark developer-tool look: no depth, no glass, one muted accent. The references are airy and colorful.
2. Small radii (about 8px), 1px boxes and no elevation, so every card looked like a table cell.
3. KPI strip as one joined bar with 10px labels and monospace numbers: no icon chips, deltas or sparklines.
4. Hero chart on a fixed 0 to 100 axis, so real values (TPS 20, MSPT 0.2) sat flat at the bottom of a mostly empty card.
5. Cold, forensic copy ("Observed evidence", "cause unknown", "Data coverage 2934") and a clock-skew warning repeated four times.
6. Monospace for every number and uppercase micro-labels everywhere.
7. Honest but idle data with no design answer to idleness, so the page felt empty.

### Theme decision
**Light glass is the primary design.** The dark theme is a full-fidelity variant built from the same components, selectable by the user, defaulting to the system preference. If the owner says dark must be primary, flip only the default; both themes must stay equally polished.

---

## 1. Non-negotiable rules

1. **Preserve behavior.** Never remove or silently change a feature, endpoint, config key, auth flow, or permission check. If something must change, document it in `CHANGELOG.md`.
2. **Audit before building.** Complete Phase 0 and write `docs/REVAMP_AUDIT.md` before redesigning anything.
3. **Do not invent backend data, and do not let honesty make the UI cold.** Only display data the backend actually provides. Where useful data is missing, add a clearly marked optional adapter or a mock layer (Section 9), never fake numbers in production mode. Real data is still presented in friendly, plain language and in a design that works when the data is flat (Sections 3.5 and 3.6).
4. **Respect the existing stack unless it is clearly the bottleneck.** If the project is plain HTML/CSS/JS, keep it framework-light (vanilla + small, well-chosen libraries). Do not introduce a heavy framework or a build step unless the repo already has one. If you must add dependencies, justify each in the audit file.
5. **Security first.** Everything coming from the server (console lines, player names, MOTD, file names, plugin descriptions) is untrusted: escape it or build DOM with `textContent`. Never use `innerHTML` with raw server data. Never log or render secrets (RCON passwords, tokens, API keys).
6. **Destructive actions need friction.** Stop, restart, kill, delete file, restore backup, ban, op/deop, and `/stop` must use a confirmation dialog that states the consequence. Dangerous confirms should be keyboard-accessible and never default-focused on the destructive button.
7. **No placeholder content.** No "Lorem ipsum", no fake brand names, no stock-looking filler. Use real labels, real units, realistic empty states.
8. **Keep the UI language of the existing project** (e.g. Portuguese or English). Put all user-facing strings in one dictionary file so translation is easy.
9. **Commit in small, reviewable steps** (if using git), one logical change per commit, with clear messages.

---

## 2. Phase 0 — Reconnaissance (mandatory)

Do all of this before designing.

### 2.1 Inventory the project
- Map the file tree. Identify the stack (plain JS? React/Vue/Svelte? bundler? backend language?), package manager, scripts, and deployment target (e.g. Vercel static hosting vs. server).
- List every page/view/section and every interactive control currently in the UI.
- List every API route, WebSocket/SSE channel, and polling loop: method, URL, payload shape, auth, refresh interval.
- Identify how the console works today (transport, line format, command sending).
- Identify the server software (Vanilla / Paper / Spigot / Purpur / Fabric / Forge / Velocity / Bungee) from the repo or configs. This affects log format, available metrics (e.g. MSPT, TPS commands), and plugin vs. mod terminology.
- Identify auth and roles, if any.

### 2.2 Produce `docs/REVAMP_AUDIT.md` containing
1. Feature parity checklist (every current feature → where it will live in the new UI).
2. Data source table: `metric/feature → endpoint/channel → shape → refresh rate`.
3. Gaps: metrics worth showing that the backend does not yet expose (candidate additions, optional).
4. UX problems observed in the current UI (at least 10 concrete ones).
5. Technical risks (CORS, auth, rate limits, large logs, mobile).
6. Chosen dependency list with justification and bundle-size impact.
7. Proposed information architecture (Section 4).

### 2.3 Baseline
Take screenshots of every current screen at desktop and mobile widths and store them in `docs/revamp/before/`. You will produce matching "after" screenshots at the end.

---

## 3. Phase 1 — Visual language and design tokens

### 3.1 Direction (derived from the reference images and realized in the prototype)
The reference set shows a **soft, airy, glass/neumorphic SaaS dashboard** language, and `reference/plexonpanel-reference.html` is its concrete implementation. Adopt its principles, then keep the Minecraft-server identity it already carries so the result is not a clone:

- Large rounded cards (radius 20–28px) floating on a soft gradient canvas.
- Frosted-glass surfaces (translucent white / translucent navy + backdrop blur) with hairline borders.
- A deep navy sidebar with a single highlighted active item.
- Indigo/violet as the primary accent, with teal, green, orange as secondary data colors.
- KPI cards: small colored icon chip, big number, delta pill (+12.5%), mini sparkline.
- Smooth spline line charts with gradient area fill; rounded-corner bar charts; donut charts with legends.
- Floating dark tooltip callouts anchored to chart points.
- Pill tabs, pill buttons, soft toggles, circular icon buttons, avatar stacks.
- Generous whitespace, strong hierarchy, restrained color.

**Minecraft identity layer (use sparingly, tastefully):**
- Pixel-art touches only at accents: a pixel font for the logo wordmark or tiny labels, 8-bit-style status icons, block-style progress segments for RAM/disk, a subtle isometric grass-block motif in the logo or empty states.
- Player avatars use real Minecraft heads (see Section 7.3).
- Status color semantics borrow from the game: emerald = online/healthy, gold = warning, redstone = critical, diamond/aqua = info.
- Do **not** use the Mojang logo, Minecraft trademarked artwork, or copyrighted textures. Original pixel icons only.

### 3.2 Token system (single source of truth: the prototype)

Copy the `:root` and `[data-theme="dark"]` blocks from the `<style>` of `reference/plexonpanel-reference.html` into your `tokens.css` and extend them with the same naming. Do not invent a second set. No raw hex values outside `tokens.css`.

Core values (for orientation; the prototype wins if they differ):

| Role | Light | Dark |
|---|---|---|
| Canvas | layered radial gradient on `#eef0fc` (indigo, sky, violet washes) | layered radial gradient on `#080d26` |
| Card surface | `rgba(255,255,255,.68)` + 18px blur + 1px `rgba(70,82,180,.14)` hairline | `rgba(24,31,78,.58)` + same blur and hairline |
| Text 1 / 2 / 3 | `#0f1535` / `#474f78` / `#656d94` | `#f1f3ff` / `#b9c0ec` / `#8e97c8` |
| Primary | `#4a3fe0` | `#7b78f2` |
| Sidebar | gradient `#121d52` to `#0c1440` | gradient `#0a1033` to `#060a24` |
| Tooltip bubble | `#1d1a6b` on white text | `#e9e8ff` on dark text |
| Terminal | `#0d1237` (stays dark in both themes) | `#070b24` |
| Radius | 10 / 16 / 24 | same |

**Chart and KPI categorical palette (validated with the dataviz validator).** Hues are assigned in this fixed order and keep their meaning (color follows the entity, never the rank):

| Slot | Meaning | Light | Dark |
|---|---|---|---|
| 1 | Primary series, players | `#4a3fe0` | `#7b78f2` |
| 2 | Tick rate | `#0d9488` | `#19a89a` |
| 3 | Memory | `#ea580c` | `#d9632a` |
| 4 | CPU | `#0284c7` | `#2f95d6` |
| 5 | Uptime, extras | `#c026a3` | `#cf46a9` |

**Motion tokens:** `--ease: cubic-bezier(.16, 1, .3, 1)`; durations 120 ms (press), 220 ms (hover, state), 350 to 450 ms (sliding thumbs, dialogs), 600 to 1100 ms (count-up, bars growing), 1400 ms (chart draw-in). The live chart slides linearly over exactly one sample interval so motion is continuous.

Validator result: light passes the lightness band, chroma floor, normal-vision floor and contrast; the adjacent magenta and sky pair sits in the 6 to 8 CVD floor band (a WARN), which is legal only because every series is also identified by a label, icon or legend. Dark passes the same checks with that same WARN. If you add a sixth series, fold it into "Other" or facet; never generate a new hue. Status colors (ok, warn, bad) are reserved and never used as series colors. Re-run the validator after any palette change.

**Rules for tokens**
- Respect `prefers-color-scheme` on first load, store the user's override, and apply `data-theme` **before first paint** (inline script in `<head>`) to prevent a flash.
- Verify text/background contrast ≥ 4.5:1 (body) and ≥ 3:1 (large text, UI icons) in both themes.
- Glass surfaces must have a solid fallback color when `backdrop-filter` is unsupported (`@supports not (backdrop-filter: blur(1px))`).
- Limit blur usage to ~6 simultaneous large glass layers; blur on huge scrolling areas hurts performance.

### 3.3 Typography
- UI font: Inter or Plus Jakarta Sans (self-host or `font-display: swap`; subset if possible).
- Numbers: enable `font-variant-numeric: tabular-nums` on every metric, table cell, and counter so digits do not jitter while updating.
- Scale: 12 / 13 / 14 / 16 / 20 / 24 / 32 / 44px. KPI numbers 28–44px, weight 700. Labels 12–13px, weight 500, uppercase tracking +0.04em only for tiny overlines.
- Pixel font: only for the logo, section "overline" micro-labels, or achievement-style toasts. Never for body text, tables, or console.

### 3.4 Iconography
- One consistent icon family (Lucide, Phosphor, or Tabler), 1.5px stroke, 20px default.
- Custom pixel icons (SVG, `shape-rendering: crispEdges`) only for Minecraft concepts: grass block, pickaxe, creeper face (original drawing), redstone, heart/hunger bars, XP orb.

---

### 3.5 Idle, empty and offline states (design these first-class)

A quiet server is the normal case for a small community server, so the page must look intentional with flat data. The prototype's `?idle=1` mode demonstrates every rule below; open it.

- **Adaptive axes, never hardcoded 0 to 100.** Derive the Y domain from the visible data with padding and a minimum span per metric (TPS at least about 3, MSPT at least 14 ms, CPU at least 20 points), smooth the domain between updates, and keep reference lines in view when they matter (the 18 TPS lag line stays visible so a flat 20.0 reads as "far from trouble").
- **Sparklines** use a minimum span and are vertically centered, so noise at 0.2 to 1.0% CPU does not become a jagged mountain and a constant value is a calm centered line.
- **Health sentence** replaces forensic language: "Healthy. No players online. Everything is idle."
- **Empty states** explain and invite ("No one is online. The server is quiet. New joins appear here as they happen."), with the same card chrome as filled states.
- **Zero values** still animate their count-up and keep tabular figures; bars and gauges render a track so the card is never blank.
- **Offline:** status pill turns red and static, the live indicator hides, the KPI numbers show a dash or zero, the console keeps history visible and disables only the input with an explanation, Start becomes the only enabled control.
- **Review every page in three data states** (busy demo, idle, offline) in both themes before calling it done.

### 3.6 Copy and tone

Words are design. Write for a server owner, not for an auditor.

| Do not write | Write instead |
|---|---|
| "Observed evidence", "What needs attention" in an auditing voice | "Needs attention" with plain items ("Slow ticks: 0 in the last 5 min") |
| "cause unknown", "Samples above 50 ms" | "Slow ticks", with a tooltip that explains it |
| "Data coverage 2934" | "5 min of data" |
| "Clock skew +9 s, received 0 s ago" on every card | One small status chip in the top bar, shown only when the skew matters, with the detail in its tooltip |
| "Protocol 3" in the sidebar | Dashboard version in the footer or About dialog |
| Uppercase tracked micro-labels above every heading | Sentence-case headings and quiet sub-labels |

Typography rule: numbers, headings and labels use the UI sans (Plus Jakarta Sans, falling back to Inter) with `font-variant-numeric: tabular-nums`. Monospace is for the console, addresses, UUIDs and commands only.

---

## 4. Phase 2 — App shell and layout

### 4.1 Information architecture

| Section | Purpose |
|---|---|
| **Overview** | At-a-glance health, live charts, quick actions, activity feed |
| **Console** | Full-screen live console with command input |
| **Players** | Online list, history, whitelist, ops, bans, per-player detail drawer |
| **Performance** | Deep metrics: TPS/MSPT, CPU, RAM/GC, network, disk, per-world stats, timings |
| **Worlds** | Worlds/dimensions, size, loaded chunks, entities, seed, border, gamerules |
| **Plugins / Mods** | Installed list, version, enabled state, update hints, config shortcuts |
| **Files** | File browser with editor (syntax highlight), upload, download, rename, delete |
| **Backups** | List, size, age, create now, restore, schedule, retention |
| **Schedules** | Cron-like tasks (restart, backup, broadcast, commands) |
| **Logs** | Historical log viewer (rotated files), search across files |
| **Settings** | Server properties (typed form), dashboard preferences, theme, notifications, access |

Keep any existing sections that don't fit above (e.g. warps, economy, custom modules) as first-class items. Never drop them. If a section would have no data source, still build it but behind a graceful "not available on this server" empty state.

### 4.2 Shell components
- **Sidebar** (deep navy, 72px collapsed icon rail / 248px expanded): logo, nav items with icon + label + optional badge (e.g. online count, error count), collapse toggle, user/profile block at bottom. Active item uses the primary accent pill like the reference. Tooltip labels in collapsed state.
- **Top bar** (glass, sticky): breadcrumb/page title, global search / **command palette** (`Ctrl/Cmd+K`), server status pill, notification bell with unread dot, theme toggle, profile menu.
- **Server header strip** on Overview: server name, MOTD (rendered with Minecraft color codes), version/software, address with copy button, uptime, and the primary control group (Start / Stop / Restart / Kill) with state-aware enabling.
- **Command palette:** fuzzy search over pages, players, plugins, saved commands. Enter to execute navigation or run a command. Show recent items.
- **Toast system:** stacked bottom-right, auto-dismiss 4–6s, pause on hover, `aria-live="polite"`, variants ok/warn/danger/info, action button (e.g. "Undo").
- **Dialog / drawer / popover / dropdown / tabs / tooltip / toggle / segmented control / skeleton / empty-state / badge / progress / table / pagination** — build or adopt accessible primitives (Radix-style behavior: focus trap, Esc to close, return focus, ARIA roles).

### 4.3 Grid and distribution
- 12-column CSS Grid inside a max-width container (1680px; fluid beyond with sensible side padding). Gap 20–24px.
- Use `grid-template-areas` per breakpoint so reordering is explicit and readable.
- Breakpoints: `≥1536` (wide), `≥1280` (desktop), `≥1024` (laptop), `≥768` (tablet), `<768` (mobile).
- **Overview desktop composition (guideline):**
  ```
  [ Server header strip ........................................ controls ]
  [ KPI: Players ][ KPI: TPS ][ KPI: RAM ][ KPI: CPU ][ KPI: Uptime/Ping  ]
  [ Big chart: Performance (TPS / MSPT / CPU switchable, range tabs) | Players online (area) ]
  [ Mini console preview (last ~12 lines, live) | Online players list w/ heads | Activity feed ]
  [ Memory breakdown donut | Disk / world sizes bars | Backups & next scheduled tasks ]
  ```
- **Tablet:** KPIs 2-3 per row, charts full-width stacked, side widgets move under.
- **Mobile:** single column, KPIs as horizontally scrollable snap row, sidebar becomes bottom tab bar (5 key items + "More" sheet), console becomes full-screen view with sticky input above the keyboard (`env(safe-area-inset-bottom)`).
- Cards must have consistent internal padding (20–24px), a uniform header pattern (title, optional subtitle/range chip, overflow `⋮` menu), and equal visual weight. Avoid giant empty gaps. If a card's content is short, let the grid auto-rows or `align-self: stretch` handle it.
- Avoid dashboard "wall of equal boxes". Create hierarchy: one dominant hero chart, a KPI row, then supporting widgets.

---

## 5. Phase 3 — Charts (dynamic, live, beautiful)

### 5.1 Library choice
Pick **one** charting approach and use it everywhere:
- Preferred for live streaming + small bundle: **uPlot** (very fast) with custom tooltip/gradient plugins, **or** **Chart.js** (v4) with `chartjs-plugin-streaming`-style manual rolling window, **or** **Apache ECharts** (rich, heavier).
- For sparklines and mini bars, write lightweight inline SVG (no library) for sub-1KB per instance.
- Whatever you choose, wrap it in a thin `<Chart>` abstraction so pages never call the library directly.

### 5.2 Required chart catalogue

| Chart | Type | Data | Notes |
|---|---|---|---|
| Performance hero | Smooth line + gradient area | TPS (0–20), MSPT, CPU% | Tab switch between series; threshold lines at TPS 20 (ideal) and 18 (warn), MSPT 50 (limit) |
| Players online | Stepped area | Count over time | Annotate peak and join/leave events as small markers |
| Memory | Stacked area + donut | Used/allocated/max, heap vs off-heap, GC pauses | GC events as vertical ticks |
| CPU per core (optional) | Small multiples or bar | Per-core load | Only if available |
| Network | Dual line | In/out KB/s | Smooth, mirrored axis optional |
| Disk / world sizes | Horizontal rounded bars | MB/GB per world | Sorted desc, with % of total |
| Chunks & entities | Bar / donut | Loaded chunks, entities by type | Top 8 + "other" |
| Player activity heatmap | Heatmap (day × hour) | Join counts | Peak-hours insight |
| Join/leave timeline | Event list + mini chart | Recent events | Feeds Activity widget |
| KPI sparklines | SVG sparkline | Last 60 samples | Colored by metric semantic |

### 5.3 Visual spec
- Lines: 2.25px, spline smoothing (monotone cubic; never overshoot below 0 or above max), round caps/joins.
- Area fill: vertical gradient from `color @ 28%` to `color @ 0%`.
- Bars: 6–8px top radius, subtle inner highlight, hover lift.
- Grid: dashed hairlines at ≤ 8% opacity; axes labels 11–12px in the tertiary text token (`--t3`); no chart borders; max 5 horizontal grid lines.
- **Crosshair + tooltip:** vertical dotted guide, filled point marker with halo, floating dark tooltip (as in the references: dark indigo bubble with date + value). Tooltip must follow pointer smoothly (lerp 80ms), flip near edges, and be keyboard-reachable (arrow keys move the cursor along the series).
- Legend: clickable pills that toggle series with a fade.
- Range selector: `5m · 30m · 1h · 6h · 24h · 7d` segmented control. Changing range cross-fades the chart rather than hard-swapping.
- Threshold coloring: line segment above warn → gold; above critical → redstone red (use segment-colored gradients).
- **Adaptive Y domain** with a minimum span (Section 3.5). Ticks are chosen from "nice" steps inside the domain; reference lines are drawn only when inside it.
- **Live end marker:** a filled dot with a soft pulsing ring on the newest sample, and a short caption above the chart that states the insight in words ("Steady all window, lowest 18.46 at 19:12").
- **Stats row** above the hero chart: now, average, lowest or peak, and a percentile, each a bold number with a quiet caption.

### 5.4 Live data behavior
- Maintain a ring buffer per metric (e.g. 3600 samples). Append new samples; shift old ones. Never re-create the chart on every tick, mutate and redraw.
- Animate new points by interpolating the last segment (≤ 300ms) so the line "flows" instead of snapping.
- Down-sample (LTTB or min/max decimation) when rendering ranges with more points than ~2× pixel width.
- Pause updates when the tab is hidden (`visibilitychange`) and backfill on return.
- Show a subtle "LIVE" indicator (pulsing dot) when the stream is healthy and "Paused / Stale" when not.
- First render: draw-in animation (stroke-dashoffset reveal over about 1.4 s with the area fading in after it), staggered across cards.
- Handle `ResizeObserver` for container resize; debounce to animation frame.
- Provide an accessible text alternative: a visually hidden summary ("TPS averaged 19.8 over the last hour, minimum 17.2 at 14:05") and a "View as table" toggle.

---

## 6. Phase 4 — Motion and animation system

### 6.1 Principles
1. **Purposeful:** motion explains change (appear, move, update, confirm). Never decorative noise.
2. **Fast:** most transitions 120–260ms. Hero/enter animations up to 420–800ms. Nothing blocks interaction.
3. **Consistent:** use only the motion tokens above.
4. **Cheap:** animate `transform` and `opacity` only. Avoid animating `width/height/top/left/box-shadow/filter` on large areas. Use `will-change` sparingly and remove after animation.
5. **Accessible:** under `prefers-reduced-motion: reduce`, replace movement with instant or opacity-only changes, stop looping animations, and disable parallax/auto-scrolling effects.

### 6.2 Required animations

| Element | Behavior |
|---|---|
| Page load | Skeleton shimmer → content fade-up with 40–60ms stagger per card (max ~10 staggered items) |
| Route/page change | View transition: outgoing fades/slides 8px, incoming rises from 8px (use the View Transitions API with a graceful fallback) |
| KPI numbers | Count-up/tween between old and new value (400–600ms, ease-out), tabular figures, no layout shift |
| Delta pills | Brief color flash on change (green up / red down) |
| Status pill | Pulsing ring on "Online"; gentle breathing on "Starting"; static on "Offline" |
| Sidebar | Collapse/expand width tween with label fade; active indicator slides between items (shared element) |
| Cards | Hover: translateY(-2px) + shadow-2 (150ms). Never scale text |
| Buttons | Press: scale(.97). Primary hover: subtle gradient shift. Ripple optional, not required |
| Lists (players, files, logs) | Enter/exit with FLIP-style reordering; new row highlights with a 1.2s fading accent background |
| Toggles / tabs / segmented | Thumb/indicator slides (about 350 ms, `--ease`) |
| Dialogs / drawers | Backdrop fade + panel rise/slide, focus trap, exit animation before unmount |
| Toasts | Slide in + fade, stack reflow animates |
| Charts | Draw-in on mount, series toggle fade, range-change cross-fade, live-flow on append |
| Progress bars | Width tween (via `transform: scaleX`), shimmer while "indeterminate" |
| Server action buttons | Loading spinner morph (button width constant), success check, error shake (≤ 4px, once) |
| Empty states | Subtle floating pixel illustration (looped ≤ 6s, paused under reduced motion) |
| Background | Optional extremely slow gradient drift (60s+) or none. Never distract from data |

### 6.3 Implementation notes
- CSS transitions/animations for simple states; the Web Animations API or a micro-lib (e.g. Motion One, ~3KB) for sequencing. Avoid heavyweight animation libraries for this scope.
- Central `motion.ts/js` exporting `fadeUp`, `stagger`, `countUp`, `flip`, and a `prefersReducedMotion()` helper. All components import from there.

Reference snippet (count-up that never causes layout shift):

```js
export function tweenNumber(el, to, { duration = 500, decimals = 0 } = {}) {
  const from = parseFloat(el.dataset.value ?? '0') || 0;
  el.dataset.value = String(to);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || from === to) {
    el.textContent = to.toFixed(decimals);
    return;
  }
  const start = performance.now();
  const ease = t => 1 - Math.pow(1 - t, 4);            // easeOutQuart
  (function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    el.textContent = (from + (to - from) * ease(t)).toFixed(decimals);
    if (t < 1) requestAnimationFrame(frame);
  })(start);
}
```

```css
.metric { font-variant-numeric: tabular-nums; min-width: 4ch; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
}
```

---

## 7. Phase 5 — Page-by-page specification

### 7.1 Overview
Layout reference: `reference/plexonpanel-reference.html`, Overview page (and `reference/prototype-overview-light.png`). Match its composition: server header, five KPI cards, hero chart beside the online-players card, then activity, memory and world-size cards, then the mini console beside the activity feed and the up-next card.

- **Server header strip:** name, MOTD (color-code rendered), software + version chip, address (copy), uptime ticker, player count `12 / 50`, status pill. Control group: Start, Stop, Restart (primary + dropdown for "Restart in 5 min / schedule"), Kill (danger, confirm). Buttons enable/disable according to state machine: `offline → starting → online → stopping → offline` (plus `crashed`).
- **KPI row (5 cards):** Players online (sparkline), TPS (colored ring gauge 0–20), Memory (used/max + segmented bar), CPU (sparkline), Uptime/Ping (or World size). Each has icon chip, delta vs. previous period, and click-through to Performance.
- **Hero chart:** performance chart with tabs (TPS · MSPT · CPU), range selector, live indicator.
- **Players widget:** heads + names + playtime + ping dot; hover card with quick actions (message, teleport, kick, op). Empty state: "No one's online. The server is peaceful."
- **Mini console:** last 12–15 formatted lines, live, "Open console" button, quick command input.
- **Activity feed:** joins, leaves, deaths, achievements, restarts, backups, warnings, relative timestamps ("2 min ago"), grouped by hour, with type icons.
- **Memory donut + World sizes + Next scheduled tasks + Last backup** cards.
- **Alert banner** (dismissible, top of page) for critical conditions: TPS < 15 for > 30s, RAM > 90%, disk > 90%, server crashed, connection lost.

### 7.2 Console (the most important page, see Section 8 for the full spec)

### 7.3 Players
- Tabs: **Online · All players · Whitelist · Operators · Bans**.
- Table with sticky header, sortable columns, search, filters, bulk select, virtualized if > 200 rows.
- Columns: head + name, UUID (copy, truncated), first seen, last seen, playtime, ping/latency, world, gamemode, status dot.
- Heads: `https://mc-heads.net/avatar/{name-or-uuid}/64` (or Crafatar). Provide a local pixel placeholder (Steve-like original silhouette) as fallback, `loading="lazy"`, `image-rendering: pixelated`, cached; never block rendering on avatar load. Note for offline-mode servers: prefer name-based lookup.
- **Player drawer** (slide-over): large head, name, UUID, location, health/hunger bars (pixel hearts), XP, inventory summary if available, session history chart, notes, quick actions (kick, ban with reason + duration, op/deop, whitelist toggle, message, teleport, gamemode).
- Ban/kick dialogs: reason field with presets, duration picker, preview of the command that will run.

### 7.4 Performance
- Full-width charts: TPS, MSPT (avg/95th/max), CPU, RAM (heap/non-heap), GC pause timeline, network I/O, disk I/O, thread count.
- Table: world → loaded chunks, entities, tile entities, tick time share.
- "Top offenders" panel (entities per chunk, hopper-heavy chunks, plugin tick cost) if data exists (Spark/Timings integration is optional, build an adapter hook only).
- Health score (0–100) with explanation of contributing factors (clearly computed from real metrics, no magic numbers hidden).

### 7.5 Worlds
- Card per world/dimension (Overworld, Nether, End, custom): size on disk, seed (hidden until revealed), spawn, world border (visual radial indicator), time of day (sun/moon animated dial), weather, difficulty, gamerules (toggle grid, searchable), players inside.

### 7.6 Plugins / Mods
- Grid/list toggle. Cards: icon (generated initials if none), name, version, author, status toggle (enable/disable if supported), dependencies, "has config" shortcut that opens Files at the right path. Search, filter by status, sort by name/load order.
- Clear terminology: "Plugins" for Bukkit-family, "Mods" for Fabric/Forge, both when hybrid.

### 7.7 Files
- Breadcrumb navigation, list/grid, file-type icons, size/modified columns, multi-select, drag-and-drop upload with progress, rename inline, delete with confirm, download, create file/folder, zip/unzip if supported.
- Editor: code editor (CodeMirror 6 or Monaco-lite) with syntax highlighting for `.properties .yml .yaml .json .toml .txt .log`, dirty-state indicator, `Ctrl+S` save, diff-on-save preview, unsaved-changes guard, read-only for binary/huge files with explanation.
- Protect critical paths with extra confirmation (e.g. world data, `server.properties`).

### 7.8 Backups
- Timeline/list: name, date, size, type (manual/scheduled), status, duration. Actions: download, restore (strong confirm, warns server will stop), delete, lock/protect.
- "Create backup" with live progress (percentage + current phase + ETA if known).
- Storage usage meter, retention policy editor (keep last N / keep days).

### 7.9 Schedules
- Visual list of tasks: restart, backup, broadcast, run command. Cron expression editor with a human-readable preview ("Every day at 04:00") and the next 5 run times. Enable/disable toggle, last-run result badge. Optional pre-restart warnings (e.g. broadcast at 5m/1m/10s).

### 7.10 Logs
- Browse rotated log files, load into the same console renderer (read-only), full-text search with match counts and highlight, level filters, time-range filter, download.

### 7.11 Settings
- `server.properties` as a **typed form** (toggles for booleans, number steppers with min/max, selects for enums such as difficulty/gamemode, text for MOTD with live Minecraft-color preview), grouped into sections (General, Gameplay, World, Network, Performance, Advanced) with search, "modified" badges, per-field help text, validation, and a "restart required" indicator. Raw-edit tab stays available.
- Dashboard preferences: theme (system/light/dark), density (comfortable/compact), reduced motion override, time format, language, console defaults, notification rules.
- Danger zone section at the bottom, visually separated.

### 7.12 Global requirements for every page
- Page header (title, short description, primary action).
- Loading skeletons that match final layout (no spinners-only).
- Empty, error, offline, and "no permission" states with illustration, explanation, and a next action.
- Contextual help via tooltips; units always shown (`MB`, `ms`, `%`, `ticks`).
- Persist UI state (selected tab, range, filters, sidebar collapsed, console settings) in `localStorage`, wrapped in try/catch.

---

## 8. Console specification (priority feature)

The console must feel like a real, modern terminal inside a premium UI.

### 8.1 Layout
- Full-height card: header (title, connection state, filter chips, search, settings menu), scrollable log viewport, footer with command input.
- Monospace font (`--font-mono`) at 13px / line-height 1.55, comfortable row padding, optional zebra at 3% opacity, hover highlights the row and reveals a copy button.
- Dark terminal surface in **both** themes (light theme uses a deep navy terminal card to keep contrast and the "terminal" feel), with soft inner shadow and rounded corners.

### 8.2 Line parsing (structured, not raw text)
Parse each incoming line into `{ time, thread, level, source, message, raw }` and render columns/segments:

- Timestamp (dim, optional toggle)
- Level badge: `INFO` (aqua/blue), `WARN` (gold), `ERROR`/`FATAL` (redstone), `DEBUG` (muted), `TRACE`
- Thread/source in dim brackets (e.g. `Server thread`), collapsible by setting
- Message with semantic highlighting

Support the common formats:

```js
// Vanilla / modern Paper:  [12:34:56] [Server thread/INFO]: Message
const RE_MODERN = /^\[(\d{2}:\d{2}:\d{2})\]\s\[([^\]\/]+)\/(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\]:\s?(.*)$/;
// Spigot-style / older Paper:  [12:34:56 INFO]: Message
const RE_LEGACY = /^\[(\d{2}:\d{2}:\d{2})\s(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\]:\s?(.*)$/;
// Optional source prefix inside message:  [PluginName] text
const RE_SOURCE = /^\[([^\]]{1,32})\]\s(.*)$/;
```

Fallback: if a line matches neither, render it as a continuation of the previous entry (e.g. stack-trace lines) instead of an orphan.

### 8.3 Semantic highlighting (apply in the message segment)
| Pattern | Treatment |
|---|---|
| `Name joined the game` | Green row accent + join icon + player head chip |
| `Name left the game` / `lost connection` | Muted-orange accent + leave icon |
| `<Player> chat text` | Chat bubble style: player chip, message in white, distinct from system lines |
| `Player issued server command: /cmd` | Command style: violet, monospace emphasized |
| Death messages (`was slain by`, `fell from`, `drowned`, …) | Skull icon, subtle red tint |
| `Done (X.XXXs)! For help, type "help"` | Success banner line + toast "Server started in X.XXs" |
| `Can't keep up!` / `Running Xms behind` | Warning row with TPS-lag hint and link to Performance |
| `Stopping server` / `Saving worlds` | Info row with state change |
| URLs | Clickable (`rel="noopener noreferrer" target="_blank"`) |
| Coordinates `x, y, z` / UUIDs | Copy-on-click chip |
| Plugin source `[PluginName]` | Colored tag, deterministic color from hash of name |
| Numbers with units (`ms`, `MB`, ticks) | Slightly emphasized |

### 8.4 Minecraft formatting codes and ANSI
- Parse `§` and `&` color codes **and** ANSI SGR sequences (`\x1b[...m`) into safe `<span>` elements (never `innerHTML` with raw input; construct nodes or escape first).
- Code map: `0 #000000, 1 #0000AA, 2 #00AA00, 3 #00AAAA, 4 #AA0000, 5 #AA00AA, 6 #FFAA00, 7 #AAAAAA, 8 #555555, 9 #5555FF, a #55FF55, b #55FFFF, c #FF5555, d #FF55FF, e #FFFF55, f #FFFFFF`; styles `l` bold, `o` italic, `n` underline, `m` strikethrough, `k` obfuscated (animate with random glyph swap, disabled under reduced motion), `r` reset.
- On a dark terminal, remap unreadable colors (`0`, `1`, `5`, `8`) to higher-contrast variants of the same hue so nothing disappears. Provide the "Authentic colors" toggle in settings.
- Render MOTD and `/say`/`/tellraw` output through the same renderer.

### 8.5 Stack traces and grouping
- Detect exceptions (`Exception`, `Error`, lines starting with `\tat ` or `Caused by:`) and group them into **one collapsible block**: first line (exception + message) visible with a red accent, the rest collapsed behind "Show N more lines". Provide "Copy stack trace".
- Collapse consecutive identical lines into one row with a `×N` counter badge (toggleable).

### 8.6 Performance of the viewport
- **Virtualize** the list (render only visible rows plus overscan). Keep a bounded buffer (default 5,000 lines in memory; configurable up to 50,000; older lines drop off with a visible "older lines trimmed" marker).
- Batch incoming lines per animation frame (never one DOM update per line). Handle bursts of thousands of lines without freezing.
- Smart auto-scroll: stick to bottom while the user is at the bottom; when the user scrolls up, **stop** following and show a floating "↓ N new lines" button. Resume on click or on reaching the bottom.

### 8.7 Controls
- **Filters:** level chips (multi-select), "Chat only", "Joins/Leaves", "Commands", "Errors only", source/plugin filter, with counts per category.
- **Search:** `Ctrl/Cmd+F` inside the console, incremental, case/regex toggles, match counter, next/prev (`Enter`/`Shift+Enter`), highlight all matches.
- **Toolbar actions:** pause/resume stream, clear view (client-side only; say so in a tooltip), word-wrap toggle, show/hide timestamps and threads, font size (−/+), copy visible, download as `.log`, jump to bottom, fullscreen (`F` or button).
- **Command input:**
  - Prompt-style input with `/` optional prefix; monospace.
  - `↑/↓` history (persisted per server, de-duplicated, capped at 200), `Ctrl+R` reverse history search.
  - **Autocomplete** (`Tab`): commands, online player names, worlds, item/entity IDs where known; dropdown with descriptions. Use a static command catalogue for vanilla commands plus anything the server reports.
  - **Saved commands / macros** drawer (e.g. `/save-all`, `/whitelist reload`, `/weather clear`) with one-click run and custom entries.
  - Visual state while a command is sent (subtle spinner), the sent command appears in the log with a distinct "you" style and its response grouped beneath it when correlatable.
  - Disable input with an explanatory message if the server is offline, but keep history and viewing available.
  - Dangerous commands (`stop`, `op`, `deop`, `ban`, `kill @e`, `fill`, `reload`, `whitelist off`, etc.) trigger a confirmation when typed from the console UI (configurable).
- **Connection banner:** connected / reconnecting (with backoff timer) / disconnected, with a "Reconnect now" button. On reconnect, avoid duplicating lines (dedupe by sequence/timestamp if the backend allows).

### 8.8 Accessibility
- Viewport is `role="log"` with `aria-live="off"` by default (avoid flooding screen readers) and an optional "announce errors" mode; input labelled; all toolbar buttons have accessible names and shortcuts documented in a `?` help popover.

---

## 9. Data layer and real-time architecture

1. **Single `api` module** wraps every network call. Components never call `fetch`/`WebSocket` directly.
2. **Transport strategy:** WebSocket or SSE if the backend supports it; otherwise adaptive polling (e.g. 1s for console, 2–5s for metrics, 30–60s for slow data) with request de-duplication and `AbortController`.
3. **Store:** a tiny observable store (or the framework's native state) holding normalized slices (`server`, `metrics`, `players`, `console`, `files`, …). Selectors drive the UI; derived values (deltas, health score, averages) are computed in one place.
4. **Resilience:** exponential backoff with jitter on reconnect; "stale since HH:MM:SS" badges when data ages; never blank a card because one request failed, keep last good data and mark it stale.
5. **Mock/demo mode:** `?demo=1` (or env flag) swaps the data layer for a realistic simulator (smooth TPS noise with occasional dips, joins/leaves, log bursts, exceptions, backup progress). This lets you and the owner review the full UI without a live server, and is how you capture screenshots. The simulator must be isolated so it is tree-shaken or disabled in production.
6. **Time handling:** store timestamps as UTC epoch ms; format in the user's locale/time zone; relative times update on a shared timer, not per-component intervals.
7. **Optimistic UI** for toggles and quick actions, with rollback and an error toast on failure.
8. **Rate limiting & safety:** debounce user-triggered refreshes; disable action buttons while the request is in flight; guard against double-submits.

---

## 10. Content richness (avoid empty-feeling screens)

A "rich" dashboard shows meaningful information and context, not just more boxes:

- Every number gets context: unit, trend vs. previous period, and a normal/healthy range indicator.
- Every chart gets a one-line insight caption when computable ("Peak 23 players at 21:10", "TPS dipped to 16.4 at 14:02, correlates with a backup").
- Include a **Health summary** (green/gold/red) that translates metrics into plain language and lists the top issue, if any.
- Show **recent events** (joins, deaths, restarts, backups, errors) as a living activity feed.
- Show **next actions** (next backup in 2h 10m, scheduled restart at 04:00).
- Add tasteful **microcopy** with personality that stays professional (e.g. empty player list: "No one's online right now.").
- Provide **keyboard shortcut cheat-sheet** (`?`), **changelog / "What's new"** modal for the new version, and an **About** footer (dashboard version, server software version, last data refresh).
- Tooltips on every icon-only control. Inline help links for jargon (TPS, MSPT, GC, chunks).

---

## 11. Accessibility, responsiveness, performance, browser support

**Accessibility (WCAG 2.2 AA)**
- Semantic landmarks (`header`, `nav`, `main`, `aside`), logical heading order, skip-to-content link.
- Visible focus rings (2px, offset 2px, high-contrast), never `outline: none` without replacement.
- All interactive elements keyboard operable; dialogs trap focus and restore it; menus use roving tabindex/arrow keys.
- Don't convey status by color alone: pair with icon/text.
- Touch targets ≥ 40×40px on mobile. Form fields have labels and error messages tied via `aria-describedby`.

**Responsiveness**
- Mobile-first CSS, container queries for cards that adapt to their own width, `clamp()` for fluid type and spacing. Test 360, 414, 768, 1024, 1280, 1536, 1920, 2560.
- No horizontal page scroll at any width; tables become stacked cards or horizontally scrollable regions with sticky first column on narrow screens.

**Performance budgets**
- LCP < 2.0s on a mid-range laptop over fast 3G-simulated static hosting; CLS < 0.05; INP < 200ms; main JS < 180KB gzipped for the shell (lazy-load Files editor, charts per page, and heavy modules).
- Code-split by route; preload critical fonts; defer non-critical work; avoid layout thrashing; cap simultaneous live charts updating at 60fps by sharing one `requestAnimationFrame` scheduler.
- Images: SVG for icons/illustrations, `loading="lazy"` for avatars.

**Browser support**
- Latest two versions of Chrome, Edge, Firefox, Safari (desktop + iOS/Android). Feature-detect `backdrop-filter`, View Transitions, container queries and provide fallbacks.

---

## 12. Code organization and deliverables

Adapt to the existing structure; if starting fresh in a plain-JS project, prefer something like:

```
/src
  /styles      tokens.css · base.css · components.css · utilities.css · themes.css
  /components  (button, card, kpi, chart, table, dialog, drawer, toast, tabs, toggle, console, player-chip, …)
  /pages       overview · console · players · performance · worlds · plugins · files · backups · schedules · logs · settings
  /lib         api.js · store.js · motion.js · format.js · mc-colors.js · log-parser.js · command-catalog.js · demo-sim.js
  /i18n        strings.<lang>.json
/docs          REVAMP_AUDIT.md · DESIGN_SYSTEM.md · revamp/{before,after}/
CHANGELOG.md
```

**Deliverables**
1. The fully revamped dashboard, running and deployable on the existing hosting setup (check that build/deploy config still works).
2. `docs/REVAMP_AUDIT.md` (Phase 0).
3. `docs/DESIGN_SYSTEM.md`: tokens, typography, component catalogue with usage rules and screenshots.
4. `docs/REVAMP_REVIEW.md` with rubric scores per page and screenshots of the three data states.
5. `CHANGELOG.md` entry for the new major version (summarize changes, breaking changes, new capabilities, known limitations).
6. Before/after screenshots for every page at desktop and mobile in both themes.
7. A short `README` update: how to run, how to use demo mode, how to add a new page/chart.

---

## 13. Execution plan (follow in order)

1. **Phase 0:** audit, baseline screenshots, `REVAMP_AUDIT.md`.
2. **Phase 1:** port `tokens.css`, base styles, themes, fonts and the icon set **from the prototype**. Build a hidden `/styleguide` page that shows every token and component next to the prototype's. Run the review loop on it before building pages.
3. **Phase 2:** app shell (sidebar, top bar, grid, routing, command palette, toasts, dialogs).
4. **Phase 3:** data layer + demo simulator, then charts abstraction and the KPI/hero charts.
5. **Phase 4:** Console (parser, virtualization, controls, autocomplete), as it is the highest-value page.
6. **Phase 5:** remaining pages in this order: Overview → Players → Performance → Files → Backups → Settings → Plugins → Worlds → Schedules → Logs → any project-specific pages.
7. **Phase 6:** motion pass: apply the animation system consistently, tune timings, add reduced-motion paths.
8. **Phase 7:** accessibility pass, responsive pass, performance pass.
9. **Phase 8:** visual review loop (Section 14) and functional QA (Section 14.2), documentation, changelog, final screenshots.

Work incrementally: keep the app runnable after every phase. After each phase, re-check the feature parity checklist.

---

## 14. Visual review loop and scoring (this decides when you are done)

Functional QA is not enough: the first attempt worked and still looked wrong. After finishing each page (and again at the end), run this loop.

1. **Capture.** Screenshot the page in light and dark at 1440x900 and 390x844, in three data states (busy demo, idle, offline). Use a headless browser (Playwright) against the demo mode.
2. **Compare.** Put each screenshot next to the matching prototype screenshot and the inspiration images. Write down at least five concrete differences (for example "card radius is 12px, prototype is 24px", "KPI numbers are monospace", "chart axis is 0 to 100").
3. **Fix** the differences, then capture again. Repeat up to four rounds or until the score below passes.
4. **Score** with the rubric. Each category is 0 to 5 using the anchors; be strict.
5. **Independent review (recommended).** If you can start a sub-agent, give it only the screenshots, the references and the rubric (not your reasoning) and ask it to score and list the five worst problems. Fix those and score again.
6. **Record** scores, screenshots and remaining gaps in `docs/REVAMP_REVIEW.md`. Do not report the task as finished below the threshold; report the gaps instead.

**Pass threshold: total at least 45 of 50, and no category below 4.**

| Category | 5 looks like | 3 looks like | 1 looks like |
|---|---|---|---|
| Surface and depth | Glass cards over a gradient canvas, layered soft shadows, hover lift | Flat cards with a faint shadow | 1px boxes on a flat color |
| Geometry | One radius scale (10/16/24) used consistently, generous padding | Mixed radii, tight padding | Square or 6 to 8px corners everywhere |
| Color | Indigo primary plus the validated categorical hues, semantic status colors, AA contrast | One accent, little hue variety | Monochrome or rainbow |
| Typography | Clear hierarchy, sans numbers with tabular figures, sentence case | Acceptable but uniform | Monospace numbers, uppercase micro-labels, tiny text |
| KPI cards | Icon chip, label and sub-label, big number, delta pill, sparkline or gauge | Number and label only | A joined strip of small text |
| Charts | Adaptive axis, gradient area, threshold, tooltip, live dot, insight caption | Correct but default-looking | Flat line on a fixed axis, no tooltip |
| Density and distribution | Balanced rows, no dead space, clear hero | Some empty areas | Large empty regions or a wall of equal boxes |
| Console | Parsed rows, level badges, plugin tags, tinted semantic rows, collapsed traces, filters with counts | Colored text only | Flat monochrome text dump |
| Motion and life | Count-ups, sliding live chart, sliding tabs, one orchestrated entrance, reduced-motion safe | Hover transitions only | Static |
| Copy and tone | Plain, friendly, specific | Neutral but jargon in places | Forensic or auditing language |

### 14.1 Gotchas found while building the prototype (avoid these bugs)
- A chart SVG sized with `height: 100%` inside a flex or auto-height container creates a resize feedback loop that grows forever. Position the SVG absolutely (`inset: 0`) inside a container whose height comes from layout.
- Pressing Enter in an input that opens a modal dialog also activates the dialog's newly focused button. Call `preventDefault()` on that Enter.
- `element.append(null)` renders the text "null". Filter falsy children.
- For flexible card heights (a console that must fill a grid row without stretching it), give the scroller `flex: 1 1 0; min-height: 0; contain: size`.
- Console rows laid out on a grid: place expanders with `grid-column: -2 / -1` so they always sit in the last column, and keep one column template per mode.
- Make demo data realistic: TPS dips are narrow spikes with fast recovery, not slow ramps. Unrealistic simulations make a good chart look fake in review.

---

### 14.2 Functional QA protocol (do not skip)

1. **Feature parity:** walk the audit checklist; every original feature works against the real backend (or documented mock where no server is available).
2. **Visual QA:** screenshots of every page × {light, dark} × {360, 768, 1280, 1920}. Look for overlaps, clipped text, inconsistent spacing, misaligned cards, orphaned empty space.
3. **State QA:** loading, empty, error, offline, reconnecting, permission-denied, long-text/overflow, huge numbers, 0 players, 500 players, 100k log lines.
4. **Interaction QA:** keyboard-only run through every page; focus order; Esc closes layers; command palette; console shortcuts.
5. **Motion QA:** nothing janky at 60fps (Performance panel), reduced-motion path verified.
6. **Security QA:** inject `<img src=x onerror=alert(1)>` as a player name, MOTD, plugin description, file name, and console line; confirm it renders inert text.
7. **Performance QA:** Lighthouse (Performance, Accessibility, Best Practices ≥ 90), bundle report, long-task check while the console receives 500 lines/second.
8. **Lint/format/test:** run the project's linters and tests; add unit tests for `log-parser`, `mc-colors`, `format`, and cron preview at minimum.

---

## 15. Anti-"AI slop" checklist (final gate)

Reject and redo anything that matches these tells:

- [ ] Generic purple-to-blue gradient hero with no purpose, or the same gradient on every element.
- [ ] Every card identical (same size, same shadow, same icon-in-circle) with no hierarchy.
- [ ] Emoji used as icons.
- [ ] Meaningless decorative blobs/orbs, glow on everything, glassmorphism stacked on glassmorphism.
- [ ] Default system/Inter-only look with no typographic hierarchy or numeric alignment.
- [ ] Fake, round, suspiciously perfect data in production mode.
- [ ] Lorem ipsum, "Acme", "John Doe", placeholder brand marks.
- [ ] Charts that are straight default-library output (default colors, default tooltips, no thresholds).
- [ ] Animations that loop forever for no reason or delay interaction.
- [ ] Console that is still one flat white-on-black text dump.
- [ ] Flat dark "developer tool" look with square cards (the rejected first attempt).
- [ ] Fixed 0 to 100 chart axes that flatten real data.
- [ ] Monospace numbers and uppercase tracked micro-labels as the default text style.
- [ ] Forensic or auditing copy instead of plain language.
- [ ] Desktop-only layout that collapses badly on mobile.
- [ ] Text contrast that looks "soft" but fails AA.
- [ ] Inconsistent corner radii, paddings, or icon stroke widths.

Quality bar: a viewer should be able to say what this product is, who it is for, and how its parts relate, from the layout alone, and it should feel specific to **Minecraft server administration**, not to a generic SaaS analytics template.

---

## 16. Final report format (what you tell the owner when done)

Return a concise summary with:
1. What was delivered (pages, key features).
2. Feature parity result (any intentional differences).
3. Dependencies added and why.
4. How to run, build, deploy, and use demo mode.
5. Known limitations and recommended next steps (e.g. optional backend endpoints that would unlock more metrics).
6. Links/paths to the audit, design-system doc, changelog, and before/after screenshots.

Do not claim anything is finished unless it was actually run and verified.

---
name: plexonpanel-v5-ui-architect
description: Master frontend design and engineering playbook for the clean-slate replacement of the PlexonPanel 5.0 dashboard (Minecraft Paper 26.x + Linux VPS Host Companion control plane). Use for ANY work that creates or changes a visual component, layout, chart, stylesheet, route or theme in PlexonPanel-Dashboard. Mandates a multi-layer dimensional dark-mode design system, instrument-grade KPI cards with embedded visualizations, a gradient/band telemetry chart studio, a tokenized developer terminal, and a strict anti-flat QA gate.
---

# PlexonPanel 5.0 — UI Architect Skill

> **Read this whole file before writing a single component.** Every section is binding. Where this file gives a code recipe, use it as the baseline and adapt it; do not "simplify" it. Simplification is exactly how the previous iteration ended up flat, hollow and monochrome.

---

## 0. Mandate

This skill governs the **complete replacement** of every visual component, layout, chart and stylesheet in `PlexonPanel-Dashboard`.

1. **Delete, then rebuild.** Remove the entire legacy UI tree (components, layouts, CSS, the "Strata" styles, old chart wrappers). Nothing visual survives. No file, class name, CSS variable or comment from the old skin may exist after the rebuild.
2. **Mount onto the headless core.** The new UI consumes the existing Protocol 3 adapter and state store unchanged (section 1.2).
3. **Instrument, not decoration.** Every surface on screen must either show data, control something, or frame something that does. A rectangle containing only a number is a defect.
4. **Honest data.** Depth, glow and color are presentation. They never replace truth: freshness bands, source authority, epoch gaps and the fail-closed mutation gate are rendered exactly as the headless modules report them.

### 0.1 What was wrong with the previous iteration (the target of this skill)

| Area | Previous state | Required state |
|---|---|---|
| KPI cards | Big white number, 16px icon, tiny dot, empty rectangle | 36px tinted glow icon badge, tabular metric, trend/percentile pill, **mandatory embedded visualization footer** |
| Surfaces | One flat `#0D1315` fill + uniform 1px border everywhere | 5-level depth system: canvas, shell, card with specular edge and ambient glow, recessed wells, floating glass |
| Chart | One 1px cyan line at the top of an empty box; start-up spike crushes the MSPT scale; duplicate x labels (`10:46 10:46`, `10:48 10:48`); right labels crowd the plot | Multi-stop gradient area fills, p95-p99 band, glow crosshair node, interactive summary strip, glass tooltip, robust y-domain, unique ticks, safe margins |
| Console | Uniform cyan `INFO` text, raw `[voicechat]` brackets, clipped first row, ghost "Review" button | 4-column parsed rows, severity pills, plugin chips, WARN/ERROR row tint, URL highlighting, tactile composer with scope pill and history |

---

## 1. Project contract

### 1.1 Stack

- React 19, Next.js App Router, TypeScript strict.
- Tailwind CSS + shadcn/ui primitives (restyled; never use shadcn defaults unmodified).
- `motion` (`motion/react`) for animation. Recharts for the main telemetry chart; hand-written SVG for sparklines, gauges and micro-visualizations. `@tanstack/react-virtual` for the console and long lists. `lucide-react` icons.
- All color values flow through CSS custom properties defined in section 2. Tailwind classes reference them via `rgb(var(--token) / <alpha>)` arbitrary values, which works in Tailwind v3 and v4. Do not hard-code hex values inside components.

### 1.2 Preserved headless modules (DO NOT BREAK, DO NOT RESTYLE)

| Path | Contract the UI must honor |
|---|---|
| `src/adapter/**` | Ed25519/HMAC Protocol 3 WebSocket client; IndexedDB `plexonpanel-browser-v3` device credentials; `/v1/pairings/claim` with 5-minute OTP; `session.reason` fail-closed mutation gate; mutation flow is always `session.prepare` → `ActionReview` → `session.execute`. |
| `src/presentation/authority.ts` | Every metric carries a source: `Paper` or `Host`. Never merge their clocks. |
| `src/presentation/epochs.ts` | Boot epochs. On server restart, preserve the gap; never interpolate across epochs. |
| `src/presentation/review-policy.ts` | Which actions need review, and what the review shows. |
| `src/presentation/telemetry.ts` | Freshness bands: **Live ≤10 s**, **Delayed 10–30 s**, **Stale >30 s**. |
| `src/presentation/player-history.ts` | Current boot-session join/leave timeline. |
| `src/store/preferences.ts` | The 8 locked keys: `theme`, `density`, `textSize`, `accent`, `motion`, `chartFill`, `timezone`, `skinProvider`. **Read allowed values from this file. Never invent new values or add a ninth key.** |

Rules:
- The UI never calls `fetch`/WebSocket directly for panel data. It reads through hooks that wrap the store/adapter. Create thin hooks in `src/ui/hooks/` (e.g. `useTelemetry()`, `useConsoleStream()`, `usePlayers()`, `useBackups()`); do not modify the modules they wrap.
- Mutations (Start, Restart, Stop, Backup, console command, kick/ban, settings that change the server) **only** open the `ActionReview` modal via `session.prepare`. A button never executes anything directly.
- If `session.reason` says mutations are closed, the control renders **disabled with the reason visible** (tooltip + `aria-describedby`), never hidden.

### 1.3 Backend features available in v5.0 (render them, do not fake them)

- **No browser cache for console/chat.** Logs stream live and cursor-paginate from the Host Companion's `session-telemetry.sqlite`, which resets on every boot epoch. Never persist log lines to localStorage/IndexedDB/React Query persistence.
- **Current-session player timeline** from `player-events-current.json` and the SQLite store.
- **Unified Manual ("Fully Backup Now") and Periodic Scheduled cold backups** to Google Drive via `/usr/bin/rclone` on the VPS Host Companion: 14-stage pipeline, RCON player countdowns, `save-all flush`, systemd stop proof, `.partial` ZIP staging, local and remote SHA-256 verification, live MB/s upload progress, `Retry Upload`.

### 1.4 Target file layout (create exactly this; no legacy folders)

```
src/ui/
  styles/
    globals.css            # tokens + surface utilities (section 2)
    motion.css             # keyframes
  primitives/
    Surface.tsx  IconBadge.tsx  Pill.tsx  DeltaPill.tsx  FreshnessChip.tsx  SourceChip.tsx
    Sparkline.tsx  EqualizerBars.tsx  AvatarStack.tsx  SegmentedMemoryBar.tsx  DualGauge.tsx
    StatusRing.tsx  Kbd.tsx  EmptyState.tsx  Skeleton.tsx
  instruments/
    InstrumentCard.tsx
    TickPerformanceCard.tsx  OnlinePlayersCard.tsx  ComputeLoadCard.tsx  MemoryAllocationCard.tsx
  chart/
    TelemetryStudio.tsx  SummaryStrip.tsx  ChartTooltip.tsx  chart-defs.tsx  scales.ts
  console/
    parse-line.ts  ConsoleRow.tsx  LiveConsole.tsx  CommandComposer.tsx  PluginChip.tsx
  chrome/
    AppShell.tsx  Sidebar.tsx  TopBar.tsx  ServerHero.tsx
  review/
    ActionReviewModal.tsx
  pairing/
    PairingGate.tsx
  routes/
    fleet/ overview/ performance/ players/ console/ backups/ access/ settings/
```

---

## 2. Dimensional surface and lighting system

### 2.1 Five-level depth hierarchy

| Level | Name | Used for | Recipe class |
|---|---|---|---|
| **L0** | Deep Obsidian Canvas | page background | `.pp-canvas` |
| **L1** | Elevated Bento Shell | sidebar, top bar, section containers | `.pp-shell` |
| **L2** | Interactive Card | KPI cards, route cards, device cards. Top specular edge + ambient radial glow | `.pp-card` |
| **L3** | Recessed Inset Well | chart plot area, terminal, inputs, code blocks, pipeline tracks | `.pp-well` |
| **L4** | Floating Glass | popovers, tooltips, modals, slide-over drawers, command palette | `.pp-glass` |

Rule: **a card never sits directly on another card of the same level.** Inside an L2 card, data areas are L3 wells. Adjacent L2 cards must differ by tone (`data-tone`), not by arbitrary color.

### 2.2 Design tokens — `globals.css`

All colors are stored as **space-separated RGB triplets** so they can take alpha: `rgb(var(--accent) / 0.12)`.

```css
@layer base {
  :root,
  :root[data-theme="dark"] {
    color-scheme: dark;

    /* L0-L4 surfaces */
    --canvas: 5 8 10;          /* #05080A deep obsidian */
    --shell: 9 14 17;          /* #090E11 */
    --card: 13 20 24;          /* #0D1418 */
    --card-hi: 18 27 32;       /* hover / raised */
    --well: 3 5 7;             /* #030507 recessed */
    --glass: 15 23 28;         /* used at 0.72 alpha */

    /* text */
    --text: 236 243 245;
    --text-2: 157 173 180;
    --text-3: 104 120 128;

    /* lines & lights */
    --line: 255 255 255;            /* use with alpha: 0.06 / 0.10 / 0.16 */
    --specular: 255 255 255;        /* top-edge highlight, 0.08-0.12 */
    --shadow: 0 0 0;
    --grid-dot: 255 255 255;        /* micro-grid alpha 0.045 */

    /* semantic domain hues (data meaning; never change with accent) */
    --hue-emerald: 52 211 153;   /* TPS, health, online, success */
    --hue-cyan: 34 211 238;      /* MSPT, JVM, network */
    --hue-violet: 167 139 250;   /* memory, p95 */
    --hue-indigo: 129 140 248;   /* compute, actions, backups */
    --hue-amber: 251 191 36;     /* warnings, countdowns, p99, delayed */
    --hue-rose: 251 113 133;     /* errors, destructive stop, stale */
    --hue-sky: 56 189 248;       /* TPS line, links, neutral info */
    --hue-slate: 148 163 184;    /* neutral/disabled data */

    /* accent (user selectable) default = teal */
    --accent: 45 212 191;
    --accent-2: 20 184 166;
  }

  :root[data-theme="light"] {
    color-scheme: light;
    --canvas: 238 243 245;
    --shell: 248 250 251;
    --card: 255 255 255;
    --card-hi: 250 252 253;
    --well: 232 238 241;
    --glass: 255 255 255;

    --text: 11 19 23;
    --text-2: 62 78 86;
    --text-3: 112 128 136;

    --line: 15 32 40;               /* alpha 0.07 / 0.12 / 0.20 */
    --specular: 255 255 255;
    --shadow: 15 32 40;
    --grid-dot: 15 32 40;

    --hue-emerald: 5 150 105;
    --hue-cyan: 8 145 178;
    --hue-violet: 124 58 237;
    --hue-indigo: 79 70 229;
    --hue-amber: 217 119 6;
    --hue-rose: 225 29 72;
    --hue-sky: 2 132 199;
    --hue-slate: 100 116 139;
  }

  /* accents: teal | blue | violet (read exact allowed values from preferences.ts) */
  :root[data-accent="teal"]   { --accent: 45 212 191;  --accent-2: 20 184 166; }
  :root[data-accent="blue"]   { --accent: 96 165 250;  --accent-2: 59 130 246; }
  :root[data-accent="violet"] { --accent: 167 139 250; --accent-2: 139 92 246; }
  :root[data-theme="light"][data-accent="teal"]   { --accent: 13 148 136; --accent-2: 15 118 110; }
  :root[data-theme="light"][data-accent="blue"]   { --accent: 37 99 235;  --accent-2: 29 78 216; }
  :root[data-theme="light"][data-accent="violet"] { --accent: 109 40 217; --accent-2: 91 33 182; }

  /* tone: the per-card semantic color. Set data-tone on any surface. */
  [data-tone="emerald"] { --tone: var(--hue-emerald); }
  [data-tone="cyan"]    { --tone: var(--hue-cyan); }
  [data-tone="violet"]  { --tone: var(--hue-violet); }
  [data-tone="indigo"]  { --tone: var(--hue-indigo); }
  [data-tone="amber"]   { --tone: var(--hue-amber); }
  [data-tone="rose"]    { --tone: var(--hue-rose); }
  [data-tone="sky"]     { --tone: var(--hue-sky); }
  [data-tone="accent"]  { --tone: var(--accent); }

  /* density (preferences.density) */
  :root[data-density="comfortable"] { --row-h: 36px; --pad-card: 20px; --gap: 16px; }
  :root[data-density="compact"]     { --row-h: 28px; --pad-card: 14px; --gap: 12px; }

  /* text size (preferences.textSize) scales the whole rem tree */
  :root[data-text="sm"] { font-size: 14px; }
  :root[data-text="md"] { font-size: 16px; }
  :root[data-text="lg"] { font-size: 18px; }

  body {
    background: rgb(var(--canvas));
    color: rgb(var(--text));
    font-family: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
    font-feature-settings: "cv11", "ss01";
    -webkit-font-smoothing: antialiased;
  }
  .num { font-variant-numeric: tabular-nums; font-feature-settings: "tnum", "zero"; }
  .mono { font-family: var(--font-mono), ui-monospace, "JetBrains Mono", monospace; }
}
```

The `data-*` attributes are set on `<html>` by a single `PreferencesBridge` effect that subscribes to `store/preferences.ts`. `theme: system` resolves via `matchMedia`. Set them in a blocking inline script in `<head>` too, to avoid a flash of wrong theme.

### 2.3 Surface utilities — `globals.css`

```css
@layer components {
  /* L0 — canvas with ambient mesh lighting and micro-grid */
  .pp-canvas {
    position: relative;
    background:
      radial-gradient(1100px 520px at 8% -8%, rgb(var(--accent) / 0.10), transparent 62%),
      radial-gradient(900px 480px at 100% 0%, rgb(var(--hue-violet) / 0.06), transparent 58%),
      radial-gradient(800px 600px at 50% 120%, rgb(var(--hue-indigo) / 0.05), transparent 60%),
      rgb(var(--canvas));
  }
  .pp-canvas::before {            /* micro dot grid, fades toward the bottom */
    content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background-image: radial-gradient(rgb(var(--grid-dot) / 0.05) 1px, transparent 1.2px);
    background-size: 22px 22px;
    -webkit-mask-image: linear-gradient(180deg, #000 0%, transparent 70%);
            mask-image: linear-gradient(180deg, #000 0%, transparent 70%);
  }

  /* L1 — elevated bento shell */
  .pp-shell {
    background:
      linear-gradient(180deg, rgb(var(--specular) / 0.025), transparent 120px),
      rgb(var(--shell));
    border: 1px solid rgb(var(--line) / 0.07);
    box-shadow:
      inset 0 1px 0 0 rgb(var(--specular) / 0.06),
      0 24px 48px -32px rgb(var(--shadow) / 0.7);
  }

  /* L2 — interactive card: specular top edge + ambient tone glow + gradient hairline */
  .pp-card {
    --tone: var(--accent);
    position: relative;
    isolation: isolate;
    border-radius: 14px;
    padding: var(--pad-card);
    background:
      radial-gradient(260px 140px at 100% 0%, rgb(var(--tone) / 0.13), transparent 70%),
      linear-gradient(180deg, rgb(var(--specular) / 0.04), transparent 46%),
      rgb(var(--card));
    border: 1px solid rgb(var(--line) / 0.08);
    box-shadow:
      inset 0 1px 0 0 rgb(var(--specular) / 0.10),      /* top specular edge */
      inset 0 -1px 0 0 rgb(var(--shadow) / 0.35),
      0 1px 2px rgb(var(--shadow) / 0.5),
      0 14px 32px -18px rgb(var(--shadow) / 0.75);
    transition: border-color .2s, box-shadow .2s, transform .2s;
  }
  .pp-card::before {               /* 1px gradient border overlay (tone fades out downward) */
    content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px; pointer-events: none;
    background: linear-gradient(160deg, rgb(var(--tone) / 0.45), rgb(var(--line) / 0.04) 38%, transparent 70%);
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor; mask-composite: exclude;
    opacity: .55; transition: opacity .2s;
  }
  .pp-card:hover { border-color: rgb(var(--tone) / 0.28); transform: translateY(-1px); }
  .pp-card:hover::before { opacity: 1; }
  [data-motion="reduced"] .pp-card:hover { transform: none; }

  /* L3 — recessed well (charts, terminal, inputs) */
  .pp-well {
    background:
      linear-gradient(180deg, rgb(var(--shadow) / 0.25), transparent 60px),
      rgb(var(--well));
    border-radius: 10px;
    box-shadow:
      inset 0 1px 3px rgb(var(--shadow) / 0.65),
      inset 0 0 0 1px rgb(var(--line) / 0.05),
      0 1px 0 0 rgb(var(--specular) / 0.04);      /* lip of light under the well */
  }

  /* L4 — floating glass */
  .pp-glass {
    background: rgb(var(--glass) / 0.72);
    -webkit-backdrop-filter: blur(18px) saturate(1.4);
            backdrop-filter: blur(18px) saturate(1.4);
    border: 1px solid rgb(var(--line) / 0.12);
    border-radius: 12px;
    box-shadow:
      inset 0 1px 0 0 rgb(var(--specular) / 0.12),
      0 20px 50px -12px rgb(var(--shadow) / 0.8),
      0 0 0 1px rgb(var(--shadow) / 0.4);
  }

  /* icon backplate: tinted container with dual-tone border and radial glow */
  .pp-icon-badge {
    --tone: var(--accent);
    position: relative; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px;
    color: rgb(var(--tone));
    background:
      radial-gradient(circle at 50% 0%, rgb(var(--tone) / 0.30), rgb(var(--tone) / 0.06) 70%),
      rgb(var(--tone) / 0.06);
    border: 1px solid rgb(var(--tone) / 0.30);
    box-shadow:
      inset 0 1px 0 rgb(var(--specular) / 0.18),
      0 0 18px -2px rgb(var(--tone) / 0.45);
  }

  /* active-state ambient glow backplate (nav items, selected metric cards) */
  .pp-glow-active {
    background:
      linear-gradient(90deg, rgb(var(--accent) / 0.16), rgb(var(--accent) / 0.03) 70%, transparent),
      rgb(var(--card));
    box-shadow:
      inset 0 1px 0 rgb(var(--specular) / 0.08),
      inset 2px 0 0 rgb(var(--accent)),
      0 0 24px -8px rgb(var(--accent) / 0.45);
  }

  .pp-hairline { height: 1px; background: linear-gradient(90deg, transparent, rgb(var(--line) / 0.14), transparent); }
}
```

### 2.4 Tailwind composition cheat-sheet

| Need | Classes |
|---|---|
| Page root | `pp-canvas min-h-dvh text-[rgb(var(--text))]` |
| Content grid | `relative z-10 grid gap-[var(--gap)]` |
| Card | `pp-card` + `data-tone="emerald"` |
| Well | `pp-well p-3` |
| Secondary text | `text-[rgb(var(--text-2))]` ; tertiary `text-[rgb(var(--text-3))]` |
| Tone text | `text-[rgb(var(--tone))]` |
| Tone chip bg | `bg-[rgb(var(--tone)/0.12)] border border-[rgb(var(--tone)/0.28)] text-[rgb(var(--tone))]` |
| Specular one-off | `shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]` |
| Section label | `text-[10.5px] font-medium uppercase tracking-[0.14em] text-[rgb(var(--text-3))]` |

### 2.5 Tone assignment (fixed; semantic, not decorative)

| Domain | Tone |
|---|---|
| TPS, health, Online, success, "Live" | `emerald` |
| MSPT mean, JVM, network, console INFO | `cyan` |
| Memory, p95 | `violet` |
| Compute/CPU, backups, actions, review | `indigo` |
| Warnings, countdowns, p99, "Delayed", Restart | `amber` |
| Errors, Stop, destructive, "Stale", failed backup | `rose` |
| TPS line on chart, links | `sky` |
| Brand chrome, nav active, focus rings, primary buttons | `accent` |

### 2.6 Typography

- Sans: Geist or Inter (variable). Mono: Geist Mono or JetBrains Mono. Load with `next/font`.
- Hero title 28/32 semibold, tracking `-0.02em`. Card title 13/16 medium. KPI value **34/36 semibold `num`** with unit at 13 medium `text-3` baseline-aligned. Micro-label 10.5 uppercase tracking `0.14em`. Console 12.5/20 mono.
- All numbers that change use `.num`. Use `font-feature-settings: "zero"` in mono so `0` and `O` are distinct.

### 2.7 Motion

- Keyframes in `motion.css`: `pp-pulse-ring` (scale 1→2.2, opacity .5→0, 2.4 s), `pp-sheen` (a 1.2 s highlight sweep on first paint of a card), `pp-fade-up` (8 px, 240 ms).
- Number changes animate with `motion` `useSpring` (stiffness 180, damping 26) and render with `.num`. Skip when `data-motion="reduced"` or `prefers-reduced-motion`.
- Never animate layout properties of virtualized lists. Never loop an animation that is not conveying live state.

---

## 3. Primitive library

### 3.1 `Surface`, `IconBadge`, `Pill`

```tsx
// primitives/Pill.tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/ui/cn";

const pill = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] text-[11px] font-medium leading-none num " +
  "bg-[rgb(var(--tone)/0.12)] border-[rgb(var(--tone)/0.28)] text-[rgb(var(--tone))] " +
  "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]",
  { variants: { size: { sm: "text-[10px] px-1.5 py-[2px]", md: "" } }, defaultVariants: { size: "md" } }
);

export function Pill({ tone = "accent", dot, className, children, size }:
  { tone?: Tone; dot?: boolean; className?: string; children: React.ReactNode } & VariantProps<typeof pill>) {
  return (
    <span data-tone={tone} className={cn(pill({ size }), className)}>
      {dot && <i className="size-1.5 rounded-full bg-[rgb(var(--tone))] shadow-[0_0_8px_rgb(var(--tone))]" />}
      {children}
    </span>
  );
}
```

### 3.2 `DeltaPill` (trend/percentile badges)

```tsx
export function DeltaPill({ value, unit = "", goodWhen = "down", tone }: {
  value: number; unit?: string; goodWhen?: "up" | "down"; tone?: Tone;
}) {
  const up = value > 0;
  const good = value === 0 ? true : (up ? goodWhen === "up" : goodWhen === "down");
  const t: Tone = tone ?? (value === 0 ? "slate" as Tone : good ? "emerald" : "amber");
  const Icon = value === 0 ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <Pill tone={t} size="sm"><Icon className="size-3" />{Math.abs(value).toFixed(1)}{unit}</Pill>
  );
}
```

### 3.3 `FreshnessChip` and `SourceChip` (bridge to `presentation/telemetry.ts` and `authority.ts`)

```tsx
const FRESH = {
  live:    { tone: "emerald", label: "Live",    pulse: true  },
  delayed: { tone: "amber",   label: "Delayed", pulse: false },
  stale:   { tone: "rose",    label: "Stale",   pulse: false },
} as const;

export function FreshnessChip({ band, ageMs }: { band: keyof typeof FRESH; ageMs?: number }) {
  const f = FRESH[band];
  return (
    <Pill tone={f.tone as Tone} size="sm">
      <span className="relative grid size-1.5 place-items-center">
        {f.pulse && <i className="absolute inset-0 rounded-full bg-[rgb(var(--tone))] animate-[pp-pulse-ring_2.4s_ease-out_infinite]" />}
        <i className="size-1.5 rounded-full bg-[rgb(var(--tone))]" />
      </span>
      {f.label}{ageMs != null && band !== "live" ? ` · ${Math.round(ageMs / 1000)}s` : ""}
    </Pill>
  );
}

export function SourceChip({ source }: { source: "Paper" | "Host" }) {
  return (
    <span className="rounded-md border border-[rgb(var(--line)/0.1)] bg-[rgb(var(--line)/0.04)] px-1.5 py-[2px] text-[10px] font-medium uppercase tracking-wider text-[rgb(var(--text-3))]">
      {source}
    </span>
  );
}
```

Every metric surface shows a `SourceChip`. A stale value is **dimmed to 60 % opacity, never hidden**, and the card's glow is replaced by `data-tone="rose"` hairline.

### 3.4 Micro-visualization primitives

```tsx
// primitives/Sparkline.tsx — smooth gradient area sparkline with glowing last point
import { useId } from "react";

export function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], cx = (x0 + x1) / 2;
    d += ` C${cx.toFixed(2)},${y0.toFixed(2)} ${cx.toFixed(2)},${y1.toFixed(2)} ${x1.toFixed(2)},${y1.toFixed(2)}`;
  }
  return d; // horizontal-tangent beziers never overshoot the data
}

export function Sparkline({ values, min, max, height = 36, filled = true, target }: {
  values: (number | null)[]; min?: number; max?: number; height?: number; filled?: boolean; target?: number;
}) {
  const id = useId().replace(/:/g, "");
  const W = 160, H = height, padY = 4;
  const nums = values.filter((v): v is number => v != null);
  if (nums.length < 2) return <div className="h-9 rounded-md border border-dashed border-[rgb(var(--line)/0.1)]" aria-label="Collecting samples" />;
  const lo = min ?? Math.min(...nums), hi = max ?? Math.max(...nums), span = Math.max(hi - lo, 1e-6);
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => H - padY - ((v - lo) / span) * (H - padY * 2);
  // split on nulls so epoch gaps are never bridged
  const segs: [number, number][][] = []; let cur: [number, number][] = [];
  values.forEach((v, i) => { if (v == null) { if (cur.length) segs.push(cur), cur = []; } else cur.push([x(i), y(v)]); });
  if (cur.length) segs.push(cur);
  const last = segs.at(-1)!.at(-1)!;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-9 w-full overflow-visible" role="img" aria-label="Recent trend">
      <defs>
        <linearGradient id={`sf-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgb(var(--tone))" stopOpacity=".45" />
          <stop offset=".6" stopColor="rgb(var(--tone))" stopOpacity=".12" />
          <stop offset="1" stopColor="rgb(var(--tone))" stopOpacity="0" />
        </linearGradient>
        <filter id={`sg-${id}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" /></filter>
      </defs>
      {target != null && <line x1="0" x2={W} y1={y(target)} y2={y(target)} stroke="rgb(var(--line) / .22)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
      {segs.map((s, k) => (
        <g key={k}>
          {filled && s.length > 1 && <path d={`${smoothPath(s)} L${s.at(-1)![0]},${H} L${s[0][0]},${H} Z`} fill={`url(#sf-${id})`} />}
          <path d={smoothPath(s)} fill="none" stroke="rgb(var(--tone))" strokeWidth="1.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </g>
      ))}
      <circle cx={last[0]} cy={last[1]} r="3.5" fill="rgb(var(--tone))" filter={`url(#sg-${id})`} />
      <circle cx={last[0]} cy={last[1]} r="2" fill="rgb(var(--tone))" stroke="rgb(var(--card))" strokeWidth="1" />
    </svg>
  );
}
```

```tsx
// primitives/EqualizerBars.tsx — 30-bar MSPT tick-distribution equalizer
export function EqualizerBars({ samples, ceil = 60, bars = 30 }: { samples: (number | null)[]; ceil?: number; bars?: number }) {
  const slice = samples.slice(-bars);
  const padded = [...Array(Math.max(0, bars - slice.length)).fill(null), ...slice];
  return (
    <div className="flex h-9 items-end gap-[2px]" role="img" aria-label="Recent MSPT per sample">
      {padded.map((v, i) => {
        const h = v == null ? 8 : Math.max(10, Math.min(100, (v / ceil) * 100));
        const tone = v == null ? "slate" : v <= 40 ? "emerald" : v <= 50 ? "amber" : "rose";
        return (
          <i key={i} data-tone={tone}
             style={{ height: `${h}%`, opacity: v == null ? 0.25 : 0.55 + (i / bars) * 0.45 }}
             className="flex-1 rounded-[2px] bg-gradient-to-t from-[rgb(var(--tone)/0.35)] to-[rgb(var(--tone))] shadow-[0_0_6px_-1px_rgb(var(--tone)/0.5)]" />
        );
      })}
    </div>
  );
}
```

```tsx
// primitives/AvatarStack.tsx — overlapping player heads. URL comes from preferences.skinProvider; never hard-code a provider.
export function AvatarStack({ players, max = 6, size = 26 }: { players: { uuid: string; name: string }[]; max?: number; size?: number }) {
  const provider = usePreference("skinProvider");
  const shown = players.slice(0, max), extra = players.length - shown.length;
  return (
    <div className="flex items-center" aria-label={`${players.length} players online`}>
      {shown.map((p, i) => (
        <div key={p.uuid} title={p.name} style={{ width: size, height: size, marginLeft: i ? -8 : 0, zIndex: shown.length - i }}
             className="relative overflow-hidden rounded-md border-2 border-[rgb(var(--card))] bg-[rgb(var(--well))] shadow-[0_2px_6px_rgba(0,0,0,.5)]">
          <PlayerHead provider={provider} uuid={p.uuid} name={p.name} size={size * 2} /> {/* <img> with onError -> initial-letter tile; image-rendering: pixelated */}
        </div>
      ))}
      {extra > 0 && <span className="num ml-1.5 rounded-md border border-[rgb(var(--line)/.1)] bg-[rgb(var(--line)/.05)] px-1.5 py-[3px] text-[10.5px] text-[rgb(var(--text-2))]">+{extra}</span>}
      {players.length === 0 && <span className="text-[11px] text-[rgb(var(--text-3))]">Nobody online</span>}
    </div>
  );
}
```

```tsx
// primitives/SegmentedMemoryBar.tsx
// Layers are NOT additive: used ⊂ committed, cgroup may exceed committed (metaspace, direct buffers).
// Draw the largest layer first so smaller layers sit on top.
type Layer = { key: string; label: string; bytes: number; tone: Tone; opacity: number };

export function SegmentedMemoryBar({ used, committed, cgroup, max }: { used: number; committed: number; cgroup: number | null; max: number }) {
  const layers: Layer[] = [
    ...(cgroup != null ? [{ key: "cg", label: "Systemd cgroup", bytes: cgroup, tone: "indigo" as Tone, opacity: 0.35 }] : []),
    { key: "com", label: "Heap committed", bytes: committed, tone: "violet", opacity: 0.45 },
    { key: "use", label: "Heap used", bytes: used, tone: "violet", opacity: 1 },
  ].sort((a, b) => b.bytes - a.bytes);
  const pct = (b: number) => `${Math.min(100, (b / max) * 100)}%`;
  return (
    <div>
      <div className="pp-well relative h-2.5 overflow-hidden rounded-full">
        {layers.map((l) => (
          <i key={l.key} data-tone={l.tone} style={{ width: pct(l.bytes), opacity: l.opacity }}
             className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[rgb(var(--tone)/0.7)] to-[rgb(var(--tone))] transition-[width] duration-500" />
        ))}
        <span className="absolute inset-y-0 right-0 w-px bg-[rgb(var(--line)/.3)]" />
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-[rgb(var(--text-3))]">
        {[...layers].sort((a, b) => a.bytes - b.bytes).map((l) => (
          <li key={l.key} data-tone={l.tone} className="flex items-center gap-1.5">
            <i className="size-1.5 rounded-full bg-[rgb(var(--tone))]" style={{ opacity: l.opacity }} />{l.label} <b className="num font-medium text-[rgb(var(--text-2))]">{fmtGiB(l.bytes)}</b>
          </li>
        ))}
        <li className="flex items-center gap-1.5"><i className="size-1.5 rounded-full border border-[rgb(var(--line)/.4)]" />Max <b className="num font-medium text-[rgb(var(--text-2))]">{fmtGiB(max)}</b></li>
      </ul>
    </div>
  );
}
```

```tsx
// primitives/DualGauge.tsx — Service cgroup CPU (supports >100 % multi-core burst) vs VPS node CPU
export function DualGauge({ service, node }: { service: number; node: number | null }) {
  // service is "% of one core" and may exceed 100. Scale the track to whole cores.
  const cores = Math.max(1, Math.ceil(service / 100));
  const full = cores * 100;
  const base = Math.min(service, 100), burst = Math.max(0, service - 100);
  return (
    <div className="space-y-2">
      <GaugeRow label="Service" value={`${service.toFixed(1)}%`} tone="indigo">
        <i className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[rgb(var(--tone)/.6)] to-[rgb(var(--tone))]" style={{ width: `${(base / full) * 100}%` }} />
        {burst > 0 && <i className="absolute inset-y-0 rounded-full bg-[repeating-linear-gradient(135deg,rgb(var(--hue-amber)),rgb(var(--hue-amber))_3px,rgb(var(--hue-amber)/.45)_3px,rgb(var(--hue-amber)/.45)_6px)]"
                         style={{ left: `${(100 / full) * 100}%`, width: `${(burst / full) * 100}%` }} />}
        {cores > 1 && Array.from({ length: cores - 1 }, (_, k) => <b key={k} className="absolute inset-y-[-2px] w-px bg-[rgb(var(--line)/.4)]" style={{ left: `${((k + 1) / cores) * 100}%` }} />)}
      </GaugeRow>
      <GaugeRow label="Node" value={node == null ? "—" : `${node.toFixed(1)}%`} tone="cyan">
        {node != null && <i className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[rgb(var(--tone)/.55)] to-[rgb(var(--tone))]" style={{ width: `${Math.min(100, node)}%` }} />}
      </GaugeRow>
    </div>
  );
}
function GaugeRow({ label, value, tone, children }: { label: string; value: string; tone: Tone; children: React.ReactNode }) {
  return (
    <div data-tone={tone} className="grid grid-cols-[48px_1fr_44px] items-center gap-2 text-[10.5px]">
      <span className="text-[rgb(var(--text-3))]">{label}</span>
      <div className="pp-well relative h-2 rounded-full">{children}</div>
      <span className="num text-right font-medium text-[rgb(var(--text-2))]">{value}</span>
    </div>
  );
}
```

```tsx
// primitives/StatusRing.tsx — animated pulsing ring (Online / Starting / Stopped)
export function StatusRing({ state }: { state: "online" | "starting" | "stopping" | "stopped" | "unknown" }) {
  const tone = { online: "emerald", starting: "amber", stopping: "amber", stopped: "slate", unknown: "slate" }[state] as Tone;
  const pulsing = state === "online" || state === "starting";
  return (
    <span data-tone={tone} className="relative inline-grid size-2.5 place-items-center">
      {pulsing && <i className="absolute inset-0 rounded-full border border-[rgb(var(--tone))] animate-[pp-pulse-ring_2.4s_ease-out_infinite]" />}
      <i className="size-2 rounded-full bg-[rgb(var(--tone))] shadow-[0_0_10px_rgb(var(--tone))]" />
    </span>
  );
}
```

---

## 4. Blueprint A — Bento KPI Instrument Card

**Law: no KPI card is ever just a number in an empty box.** Every card has, top to bottom: header row (label + glowing icon badge), metric row (value + unit + pill), **embedded visualization footer**, and a meta row (source chip + context). A card whose footer visualization is missing fails QA.

### 4.1 Shell

```tsx
// instruments/InstrumentCard.tsx
export function InstrumentCard({ tone, icon: Icon, label, value, unit, pill, viz, meta, source, band = "live", loading }: {
  tone: Tone; icon: LucideIcon; label: string; value: React.ReactNode; unit?: string; pill?: React.ReactNode;
  viz: React.ReactNode; meta?: React.ReactNode; source: "Paper" | "Host"; band?: "live" | "delayed" | "stale"; loading?: boolean;
}) {
  return (
    <section data-tone={band === "stale" ? "rose" : tone} aria-label={label}
             className="pp-card group flex min-h-[176px] flex-col gap-3 data-[stale=true]:opacity-70" data-stale={band === "stale"}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-medium text-[rgb(var(--text-2))]">{label}</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            {loading ? <Skeleton className="h-9 w-24" /> :
              <span className="num text-[34px] font-semibold leading-9 tracking-tight text-[rgb(var(--text))]">{value}</span>}
            {unit && <span className="text-[13px] font-medium text-[rgb(var(--text-3))]">{unit}</span>}
            {pill && <span className="ml-1 self-center">{pill}</span>}
          </div>
        </div>
        <div className="pp-icon-badge shrink-0" data-tone={tone}><Icon className="size-[18px]" strokeWidth={1.75} /></div>
      </header>

      {/* mandatory embedded visualization footer, always an L3 well or a bare viz on a hairline */}
      <div data-slot="viz" className="mt-auto">{viz}</div>

      <footer className="flex items-center justify-between gap-2 border-t border-[rgb(var(--line)/0.06)] pt-2 text-[10.5px] text-[rgb(var(--text-3))]">
        <span className="truncate">{meta}</span>
        <span className="flex shrink-0 items-center gap-1.5"><SourceChip source={source} /><FreshnessChip band={band} /></span>
      </footer>
    </section>
  );
}
```

`data-slot="viz"` is queried by the QA gate (section 9). Never remove it.

### 4.2 Card 1 — Tick Performance (`emerald`)

```tsx
export function TickPerformanceCard() {
  const t = useTelemetry();                  // thin hook over presentation/telemetry.ts
  const tps = t.tps.latest;                  // number | null
  const tone: Tone = tps == null ? "slate" : tps >= 19.5 ? "emerald" : tps >= 17 ? "amber" : "rose";
  return (
    <InstrumentCard tone={tone} icon={Activity} label="Tick Performance" source="Paper" band={t.tps.band}
      value={tps == null ? "—" : tps.toFixed(2)} unit="TPS"
      pill={t.msptP95.latest != null && <Pill tone="violet" size="sm">p95 {t.msptP95.latest.toFixed(1)} ms</Pill>}
      viz={
        <div className="space-y-2">
          <EqualizerBars samples={t.mspt.recent} ceil={60} />
          {/* TPS target bar: 20.0 TPS is the ceiling */}
          <div className="flex items-center gap-2 text-[10.5px] text-[rgb(var(--text-3))]">
            <div className="pp-well relative h-1.5 flex-1 rounded-full">
              <i className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[rgb(var(--tone)/.6)] to-[rgb(var(--tone))]" style={{ width: `${Math.min(100, ((tps ?? 0) / 20) * 100)}%` }} />
            </div>
            <span className="num">target 20.0</span>
          </div>
        </div>
      }
      meta={`${fmt1(t.mspt.mean)} ms mean · 50 ms budget`} />
  );
}
```

### 4.3 Card 2 — Online Players (`emerald` → `sky` when full)

```tsx
export function OnlinePlayersCard() {
  const p = usePlayers();                    // current Paper roster + boot-session peak
  const pct = p.capacity ? (p.online.length / p.capacity) * 100 : 0;
  return (
    <InstrumentCard tone={pct >= 90 ? "amber" : "emerald"} icon={Users} label="Online Players" source="Paper" band={p.band}
      value={p.online.length} unit={p.capacity ? `/ ${p.capacity}` : "players"}
      pill={<Pill tone="sky" size="sm"><TrendingUp className="size-3" />peak {p.sessionPeak}</Pill>}
      viz={
        <div className="space-y-2.5">
          <AvatarStack players={p.online} />
          <div className="pp-well relative h-1.5 rounded-full">
            <i className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[rgb(var(--tone)/.55)] to-[rgb(var(--tone))] transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      }
      meta="Live Paper roster · this boot session" />
  );
}
```

### 4.4 Card 3 — Compute Load (`indigo`)

```tsx
export function ComputeLoadCard() {
  const c = useCompute();                    // service: % of one core (may be >100). node: % of VPS or null
  return (
    <InstrumentCard tone={c.service > 100 ? "amber" : "indigo"} icon={Cpu} label="Compute Load" source="Host" band={c.band}
      value={c.service.toFixed(1)} unit="%"
      pill={c.service > 100 ? <Pill tone="amber" size="sm">burst · {(c.service / 100).toFixed(1)} cores</Pill> : <Pill tone="indigo" size="sm">of 1 core</Pill>}
      viz={<DualGauge service={c.service} node={c.node} />}
      meta="Minecraft service cgroup vs VPS node" />
  );
}
```

### 4.5 Card 4 — Memory Allocation (`violet`)

```tsx
export function MemoryAllocationCard() {
  const m = useMemoryTiers();                // bytes: heapUsed, heapCommitted, cgroup|null, heapMax
  const usedPct = (m.heapUsed / m.heapMax) * 100;
  return (
    <InstrumentCard tone={usedPct > 90 ? "rose" : usedPct > 75 ? "amber" : "violet"} icon={MemoryStick} label="Memory Allocation" source="Paper" band={m.band}
      value={(m.heapUsed / 2 ** 30).toFixed(1)} unit="GiB"
      pill={<Pill tone="violet" size="sm">{usedPct.toFixed(0)}% heap</Pill>}
      viz={<SegmentedMemoryBar used={m.heapUsed} committed={m.heapCommitted} cgroup={m.cgroup} max={m.heapMax} />}
      meta="JVM heap · cgroup from Host" />
  );
}
```

Grid: `grid grid-cols-1 gap-[var(--gap)] sm:grid-cols-2 xl:grid-cols-4`. The four cards share equal height via `min-h-[176px]`; footers align because `viz` uses `mt-auto`.

---

## 5. Blueprint B — Telemetry Studio chart

### 5.1 Card composition (top to bottom)

1. **Header**: title "Server performance", range select (`5m / 15m / 1h / 6h / session`), expand button, `FreshnessChip` + `SourceChip` for Paper and Host separately.
2. **Segmented metric tabs**: `Tick & MSPT | Memory Tiers | CPU & Chunks` (pill-style segmented control, active segment uses `.pp-glow-active`).
3. **Interactive Summary Strip** (replaces text legends, section 5.3).
4. **Plot well** (`.pp-well`, min-height 320 px, `aspect-[16/6]` on desktop) containing the Recharts chart.
5. **Footer**: `Independent source clocks · gaps preserved` plus epoch markers legend. Footer text is 10.5 px `text-3`; it never overlaps the axis.

### 5.2 SVG defs — `chart/chart-defs.tsx`

```tsx
export function ChartDefs() {
  const grad = (id: string, hue: string, top = 0.42, mid = 0.14) => (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stopColor={`rgb(var(--hue-${hue}))`} stopOpacity={top} />
      <stop offset="55%"  stopColor={`rgb(var(--hue-${hue}))`} stopOpacity={mid} />
      <stop offset="100%" stopColor={`rgb(var(--hue-${hue}))`} stopOpacity={0} />
    </linearGradient>
  );
  return (
    <defs>
      {grad("fill-emerald", "emerald")}
      {grad("fill-cyan", "cyan")}
      {grad("fill-violet", "violet", 0.34, 0.10)}
      {grad("fill-amber", "amber", 0.34, 0.10)}
      {grad("fill-sky", "sky", 0.30, 0.08)}

      {/* p95-p99 confidence band: soft horizontal vertical-fade */}
      <linearGradient id="band-p9x" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="rgb(var(--hue-violet))" stopOpacity=".28" />
        <stop offset="100%" stopColor="rgb(var(--hue-amber))" stopOpacity=".10" />
      </linearGradient>

      {/* line glow */}
      <filter id="line-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2.4" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>

      {/* hatched pattern for epoch gaps (server restarted: no data, not zero) */}
      <pattern id="epoch-gap" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="8" height="8" fill="rgb(var(--hue-slate) / .05)" />
        <line x1="0" y1="0" x2="0" y2="8" stroke="rgb(var(--hue-slate) / .22)" strokeWidth="2" />
      </pattern>
    </defs>
  );
}
```

`chartFill` preference: `true` → render `<Area fill="url(#fill-…)">`; `false` → render `<Line>` only. **When `chartFill` is on, an un-filled wireframe line is a bug.** When off, lines still get `filter="url(#line-glow)"` on the active series only.

### 5.3 Interactive Summary Strip — `chart/SummaryStrip.tsx`

Each metric is a **clickable toggle card** (not a legend). Top indicator bar glows when the series is visible.

```tsx
type Metric = { key: string; label: string; value: string; unit: string; tone: Tone; spark: (number | null)[]; source: "Paper" | "Host" };

export function SummaryStrip({ metrics, active, onToggle }: { metrics: Metric[]; active: Set<string>; onToggle: (k: string) => void }) {
  return (
    <div role="group" aria-label="Chart series" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {metrics.map((m) => {
        const on = active.has(m.key);
        return (
          <button key={m.key} type="button" aria-pressed={on} onClick={() => onToggle(m.key)} data-tone={m.tone}
            className={cn(
              "group relative overflow-hidden rounded-xl border px-3 pb-2 pt-3 text-left transition",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--accent))]",
              on ? "border-[rgb(var(--tone)/.32)] bg-[linear-gradient(180deg,rgb(var(--tone)/.10),rgb(var(--tone)/.02))] shadow-[inset_0_1px_0_0_rgba(255,255,255,.08)]"
                 : "border-[rgb(var(--line)/.07)] bg-[rgb(var(--line)/.02)] opacity-60 hover:opacity-100")}>
            {/* glowing top indicator bar */}
            <i className={cn("absolute inset-x-3 top-0 h-[2px] rounded-b-full bg-[rgb(var(--tone))] transition",
                             on ? "opacity-100 shadow-[0_0_12px_2px_rgb(var(--tone)/.6)]" : "opacity-25")} />
            <div className="flex items-center justify-between text-[10.5px] font-medium uppercase tracking-[0.12em] text-[rgb(var(--text-3))]">
              {m.label}<SourceChip source={m.source} />
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="num text-[20px] font-semibold leading-6 text-[rgb(var(--text))]">{m.value}</span>
              <span className="text-[11px] text-[rgb(var(--text-3))]">{m.unit}</span>
            </div>
            <div className="mt-1 h-5 opacity-90"><Sparkline values={m.spark} height={20} filled={false} /></div>
          </button>
        );
      })}
    </div>
  );
}
```

Strip content per tab:

| Tab | Cards |
|---|---|
| Tick & MSPT | `TPS` (sky), `Mean MSPT` (cyan), `p95 MSPT` (violet), `p99 MSPT` (amber), `GC Pauses` (rose) |
| Memory Tiers | `Heap used` (violet), `Heap committed` (violet), `Cgroup` (indigo), `Max` (slate), `GC Pauses` (rose) |
| CPU & Chunks | `Service CPU` (indigo), `Node CPU` (cyan), `Loaded chunks` (emerald), `Entities` (amber), `Tick wait` (slate) |

At least one series must always remain active (disable toggling off the last one).

### 5.4 Scales and axes — `chart/scales.ts` (this fixes the crushed-line defect)

The start-up spike (e.g. 128 ms right after boot) must **never** dictate the whole MSPT scale.

```ts
export function msptDomain(values: number[]): [number, number] {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return [0, 60];
  const p99 = v[Math.min(v.length - 1, Math.floor(v.length * 0.99))];
  const ceil = Math.min(250, Math.max(60, niceCeil(p99 * 1.25)));   // always shows the 50 ms threshold with headroom
  return [0, ceil];
}
export const niceCeil = (n: number) => { const p = 10 ** Math.floor(Math.log10(n)); return Math.ceil(n / p) * p; };

/** Samples above the domain are clamped to the ceiling and flagged for a "↑ clipped 128 ms" marker. */
export const clamp = (v: number | null, max: number) => (v == null ? null : Math.min(v, max));

/** Unique, evenly spaced time ticks. Guarantees no two ticks format to the same label. */
export function buildTimeTicks(t0: number, t1: number, fmt: (t: number, withSeconds: boolean) => string, target = 7) {
  const span = t1 - t0, steps = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600].map((s) => s * 1000);
  const step = steps.find((s) => span / s <= target) ?? steps.at(-1)!;
  const ticks: number[] = []; for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) ticks.push(t);
  const secs = step < 60_000;
  const labels = ticks.map((t) => fmt(t, secs));
  if (new Set(labels).size !== labels.length) return buildTimeTicks(t0, t1, fmt, target - 1); // dedupe by widening
  return { ticks, withSeconds: secs };
}
```

Axis rules:
- X axis: `type="number" scale="time" domain={[t0, t1]} ticks={ticks}`; labels use the `timezone` preference.
- Left Y (TPS): `domain={[0, 20]}`, ticks `[0, 5, 10, 15, 20]`, width 40.
- Right Y (MSPT): `orientation="right"`, `domain={msptDomain(...)}`, width 52, `tickFormatter={(v) => `${v}`}` and the **unit goes in a separate label above the axis**, not inside every tick (this stops `128 ms` / `105 ms` from colliding).
- **Margins**: `margin={{ top: 14, right: 8, bottom: 4, left: 0 }}`. Axis `width` props reserve gutters; labels are `text-[10.5px] mono fill-[rgb(var(--text-3))]`, `tickLine={false}` `axisLine={false}`.
- Grid: horizontal lines only, `stroke="rgb(var(--line) / 0.06)"`, `strokeDasharray="2 6"`.
- The `50 ms threshold` label is rendered **inside the plot, top-left of the line** (`ReferenceLine label={{ position: "insideTopLeft" }}`), never against the right axis.

### 5.5 Chart assembly — `chart/TelemetryStudio.tsx` (Tick & MSPT tab)

```tsx
<ResponsiveContainer width="100%" height="100%">
  <ComposedChart data={rows} margin={{ top: 14, right: 8, bottom: 4, left: 0 }}>
    <ChartDefs />
    <CartesianGrid vertical={false} stroke="rgb(var(--line) / .06)" strokeDasharray="2 6" />
    <XAxis dataKey="t" type="number" scale="time" domain={[t0, t1]} ticks={ticks} tickFormatter={(t) => fmtTime(t, withSeconds)}
           tickLine={false} axisLine={false} tick={{ fontSize: 10.5, fill: "rgb(var(--text-3))" }} />
    <YAxis yAxisId="tps" width={40} domain={[0, 20]} ticks={[0, 5, 10, 15, 20]} tickLine={false} axisLine={false}
           tick={{ fontSize: 10.5, fill: "rgb(var(--text-3))" }} />
    <YAxis yAxisId="ms" orientation="right" width={52} domain={msDomain} tickLine={false} axisLine={false}
           tick={{ fontSize: 10.5, fill: "rgb(var(--text-3))" }} />

    {/* epoch gaps: hatched, labelled, never interpolated */}
    {epochs.gaps.map((g) => (
      <ReferenceArea key={g.id} yAxisId="tps" x1={g.from} x2={g.to} fill="url(#epoch-gap)" ifOverflow="visible"
        label={{ value: `Restarted ${fmtTime(g.to)}`, position: "insideTop", fontSize: 10, fill: "rgb(var(--text-3))" }} />
    ))}

    {/* 50 ms budget */}
    <ReferenceLine yAxisId="ms" y={50} stroke="rgb(var(--hue-amber) / .55)" strokeDasharray="4 4"
      label={{ value: "50 ms budget", position: "insideTopLeft", fontSize: 10, fill: "rgb(var(--hue-amber))" }} />

    {/* p95–p99 band (range area: dataKey returns [lo, hi]) */}
    {active.has("p99") && <Area yAxisId="ms" dataKey="band" stroke="none" fill="url(#band-p9x)" connectNulls={false} isAnimationActive={false} />}

    {/* filled series: emerald/cyan/violet/amber/sky; fall back to Line when chartFill is false */}
    {active.has("mspt") && (chartFill
      ? <Area yAxisId="ms" dataKey="mspt" type="monotone" stroke="rgb(var(--hue-cyan))" strokeWidth={1.8} fill="url(#fill-cyan)" connectNulls={false} dot={false}
              activeDot={<GlowNode tone="cyan" />} />
      : <Line yAxisId="ms" dataKey="mspt" type="monotone" stroke="rgb(var(--hue-cyan))" strokeWidth={1.8} dot={false} connectNulls={false} />)}
    {active.has("p95") && <Line yAxisId="ms" dataKey="p95" type="monotone" stroke="rgb(var(--hue-violet))" strokeWidth={1.4} dot={false} connectNulls={false} />}
    {active.has("p99") && <Line yAxisId="ms" dataKey="p99" type="monotone" stroke="rgb(var(--hue-amber))" strokeWidth={1.4} strokeDasharray="5 3" dot={false} connectNulls={false} />}
    {active.has("tps") && (chartFill
      ? <Area yAxisId="tps" dataKey="tps" type="monotone" stroke="rgb(var(--hue-sky))" strokeWidth={2} fill="url(#fill-sky)" filter="url(#line-glow)" connectNulls={false} dot={false} activeDot={<GlowNode tone="sky" />} />
      : <Line yAxisId="tps" dataKey="tps" type="monotone" stroke="rgb(var(--hue-sky))" strokeWidth={2} filter="url(#line-glow)" dot={false} connectNulls={false} />)}
    {active.has("gc") && <Scatter yAxisId="ms" dataKey="gc" fill="rgb(var(--hue-rose))" shape="diamond" />}

    <Tooltip cursor={{ stroke: "rgb(var(--accent) / .55)", strokeWidth: 1, strokeDasharray: "3 3" }} content={<ChartTooltip />} wrapperStyle={{ outline: "none", zIndex: 40 }} />
  </ComposedChart>
</ResponsiveContainer>
```

Data shaping rules (in a pure `buildRows()` function, unit-tested):
- Paper and Host series have **independent timestamps**; join by nearest-bucket only for the tooltip, never to synthesize values. Host-sourced series (cgroup CPU/memory) keep their own samples.
- On an epoch boundary insert a `{ t, tps: null, mspt: null, … }` row so `connectNulls={false}` breaks the line.
- `band = [p95, p99]` only when both are finite, else `null`.
- Clamp MSPT to the domain ceiling with `clamp()`; carry `mspt_raw` so the tooltip shows the true 128 ms.

`GlowNode`: two concentric circles (r=9 at `tone/.18` with blur, r=4.5 solid with a 1.5 px `--card` stroke).

### 5.6 Glass tooltip — `chart/ChartTooltip.tsx`

```tsx
export function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as Row;
  return (
    <div className="pp-glass min-w-[200px] p-3 text-[12px]">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="num mono font-medium text-[rgb(var(--text))]">{fmtTime(label as number, true)}</span>
        <FreshnessChip band={row.band} />
      </div>
      <ul className="space-y-1.5">
        {payload.filter((p) => p.value != null && p.dataKey !== "band").map((p) => (
          <li key={String(p.dataKey)} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2 text-[rgb(var(--text-2))]">
              <i className="size-2 rounded-full" style={{ background: p.color, boxShadow: `0 0 8px ${p.color}` }} />{LABELS[String(p.dataKey)]}
            </span>
            <span className="num font-medium text-[rgb(var(--text))]">{fmtMetric(String(p.dataKey), row)}</span>
          </li>
        ))}
      </ul>
      <div className="pp-hairline my-2" />
      <div className="flex items-center justify-between text-[10.5px] text-[rgb(var(--text-3))]">
        <span>Boot epoch {row.epochLabel}</span><SourceChip source={row.source} />
      </div>
    </div>
  );
}
```

The tooltip shows true (unclamped) values and is positioned by Recharts but constrained: `allowEscapeViewBox={{ x: false, y: true }}` so it never clips under the right axis.

---

## 6. Blueprint C — Tactile Developer Terminal

### 6.1 Line parser — `console/parse-line.ts`

The Host Companion returns cursor-paginated rows. Parse defensively: the parser must never throw and must always return a renderable row.

```ts
export type Level = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
export interface ParsedLine {
  id: string;                  // cursor id from the Host, never an array index
  time: string | null;         // "HH:MM:SS" (rendered in the timezone preference)
  level: Level | null;         // null => continuation row (stack trace, wrapped output)
  thread: string | null;       // e.g. "Server thread", "Async Chat Thread - #3"
  tag: string | null;          // plugin / subsystem chip, e.g. "voicechat", "MiniMOTD", "Paper"
  body: Token[];               // text | url
  kind: "line" | "continuation" | "chat" | "command" | "system";
}
export type Token = { t: "text" | "url"; v: string };

const LINE = /^\[?(\d{2}:\d{2}:\d{2})(?:\s+|\]\s*)(?:\[?([A-Za-z ]+?)\/)?(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\]?:?\s*(.*)$/;
const TAG  = /^\[([^\]\s][^\]]{0,31})\]\s*/;
const URL_RE = /(https?:\/\/[^\s<>"')]+)/g;

export function tokenize(s: string): Token[] {
  const out: Token[] = []; let last = 0;
  for (const m of s.matchAll(URL_RE)) {
    if (m.index! > last) out.push({ t: "text", v: s.slice(last, m.index) });
    out.push({ t: "url", v: m[0].replace(/[.,;:]+$/, "") }); last = m.index! + m[0].length;
  }
  if (last < s.length) out.push({ t: "text", v: s.slice(last) });
  return out;
}

export function parseLine(id: string, raw: string): ParsedLine {
  const m = LINE.exec(raw);
  if (!m) return { id, time: null, level: null, thread: null, tag: null, body: tokenize(raw), kind: "continuation" };
  const [, time, thread, level, rest] = m;
  const tm = TAG.exec(rest);
  return { id, time, level: level as Level, thread: thread?.trim() ?? null, tag: tm?.[1] ?? null,
           body: tokenize(tm ? rest.slice(tm[0].length) : rest), kind: "line" };
}
```

Plugin chip color is a **stable hash into a non-semantic palette** (never rose/amber, which mean severity):

```ts
const CHIP_HUES = ["cyan", "violet", "indigo", "sky", "emerald"] as const;
export const chipTone = (tag: string) => CHIP_HUES[[...tag].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % CHIP_HUES.length];
```

### 6.2 Row anatomy — 4 visual columns

`[Monospace Timestamp] [Severity Pill] [Plugin/Thread Chip] [Message Body]`

```tsx
// console/ConsoleRow.tsx
const LEVEL_UI: Record<Level, { tone: Tone; row: string }> = {
  TRACE: { tone: "slate",   row: "" },
  DEBUG: { tone: "slate",   row: "" },
  INFO:  { tone: "cyan",    row: "" },
  WARN:  { tone: "amber",   row: "bg-amber-500/[0.04] border-l-2 border-amber-500/60" },
  ERROR: { tone: "rose",    row: "bg-rose-500/[0.06] border-l-2 border-rose-500/80" },
  FATAL: { tone: "rose",    row: "bg-rose-500/[0.10] border-l-2 border-rose-500" },
};

export const ConsoleRow = memo(function ConsoleRow({ line, prev, tz }: { line: ParsedLine; prev?: ParsedLine; tz: string }) {
  if (line.kind === "continuation") {
    return (
      <div className="grid grid-cols-[64px_1fr] pl-3 pr-2 text-[12.5px] leading-5 mono text-[rgb(var(--text-3))]">
        <i className="ml-[26px] w-px self-stretch bg-[rgb(var(--line)/.12)]" /> {/* gutter rail connects to parent row */}
        <span className="whitespace-pre-wrap break-words pl-3">{renderBody(line.body)}</span>
      </div>
    );
  }
  const ui = LEVEL_UI[line.level!];
  const sameSecond = prev?.time === line.time;        // never repeat an identical timestamp on consecutive rows
  return (
    <div data-level={line.level} className={cn("grid grid-cols-[64px_46px_auto_1fr] items-start gap-x-2.5 border-l-2 border-transparent px-3 py-[3px] text-[12.5px] leading-5 mono hover:bg-[rgb(var(--line)/.03)]", ui.row)}>
      <time title={line.time ?? undefined} className={cn("num pt-px text-[11.5px]", sameSecond ? "text-[rgb(var(--text-3)/.35)]" : "text-[rgb(var(--text-3))]")}>
        {sameSecond ? "·" : fmtClock(line.time, tz)}
      </time>
      <span data-tone={ui.tone}
        className="mt-[2px] inline-flex h-[17px] items-center justify-center rounded-[5px] border border-[rgb(var(--tone)/.28)] bg-[rgb(var(--tone)/.12)] text-[9.5px] font-semibold tracking-wider text-[rgb(var(--tone))]">
        {line.level === "WARN" ? "WARN" : line.level}
      </span>
      <span className="flex items-center gap-1">
        {line.tag && <PluginChip tag={line.tag} />}
        {!line.tag && line.thread && <span className="rounded-[5px] bg-[rgb(var(--line)/.05)] px-1.5 text-[10.5px] text-[rgb(var(--text-3))]">{shortThread(line.thread)}</span>}
      </span>
      <span className={cn("min-w-0 whitespace-pre-wrap break-words", line.level === "ERROR" || line.level === "FATAL" ? "text-rose-200" : line.level === "WARN" ? "text-amber-100" : "text-[rgb(var(--text))]/90")}>
        {renderBody(line.body)}
      </span>
    </div>
  );
});

const renderBody = (tokens: Token[]) => tokens.map((tk, i) => tk.t === "url"
  ? <a key={i} href={tk.v} target="_blank" rel="noreferrer noopener" className="text-[rgb(var(--hue-sky))] underline decoration-[rgb(var(--hue-sky)/.35)] underline-offset-2 hover:decoration-[rgb(var(--hue-sky))]">{tk.v}</a>
  : <span key={i}>{tk.v}</span>);
```

`PluginChip`:

```tsx
export const PluginChip = ({ tag }: { tag: string }) => (
  <span data-tone={chipTone(tag)}
    className="inline-flex h-[17px] items-center rounded-[5px] border border-[rgb(var(--tone)/.26)] bg-[rgb(var(--tone)/.10)] px-1.5 text-[10.5px] font-medium text-[rgb(var(--tone))]">
    {tag}
  </span>
);
```

The brackets are **removed** from the message and the plugin appears only as a chip. Raw `[MiniMOTD]` text in a message body is a QA failure.

### 6.3 Terminal frame

- Container: L2 card containing an L3 well. Header: terminal icon badge, title "Live console", `Streaming` pill (emerald, pulsing), expand button, **level filter chips** (`All · Info · Warn · Error`, each with a live count) and a search field.
- Body: `@tanstack/react-virtual` with `estimateSize: () => 22`, `measureElement` for wrapped lines, `overscan: 12`. **Top and bottom 16 px fade mask** (`mask-image: linear-gradient(#0000, #000 16px, #000 calc(100% - 16px), #0000)`) so no row is ever hard-clipped mid-text (the old UI clipped its first row).
- Stick-to-bottom: auto-follow when within 48 px of the bottom. When the user scrolls up, show a floating glass pill `↓ 12 new lines · Jump to live`.
- Footer strip (inside card, above composer): left `● Following live` / `⏸ Paused`, right `Host history · 245 lines` and cursor-loading shimmer when paginating upward.
- Empty state: centered `Terminal` icon, "Waiting for the first log line of this boot", with epoch id.
- On boot-epoch change: insert a full-width divider row `── Server restarted · 10:41 ──` (amber hairline), then clear.

### 6.4 Command composer — `console/CommandComposer.tsx`

```tsx
export function CommandComposer({ gate, onReview }: { gate: MutationGate; onReview: (cmd: string) => void }) {
  const [value, setValue] = useState(""); const { history, push, up, down } = useCommandHistory(); // in-memory only; NO persistence
  const disabled = !value.trim() || !gate.open;
  const submit = () => { if (!disabled) { push(value); onReview(value.trim()); } };
  return (
    <div className="border-t border-[rgb(var(--line)/.07)] p-3">
      <div className="pp-well flex items-center gap-2 px-2.5 py-2 focus-within:shadow-[inset_0_1px_3px_rgba(0,0,0,.65),0_0_0_1px_rgb(var(--accent)/.5),0_0_24px_-6px_rgb(var(--accent)/.5)]">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[rgb(var(--hue-indigo)/.3)] bg-[rgb(var(--hue-indigo)/.12)] px-2 py-1 text-[10.5px] font-medium text-[rgb(var(--hue-indigo))]">
          <ShieldCheck className="size-3" />RCON · Paper
        </span>
        <ChevronRight className="size-4 shrink-0 text-[rgb(var(--accent))]" />
        <input value={value} onChange={(e) => setValue(e.target.value)} spellCheck={false} autoComplete="off" aria-label="Server command"
          placeholder={gate.open ? "Type a server command…" : gate.reason}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") { e.preventDefault(); setValue(up(value)); }
            else if (e.key === "ArrowDown") { e.preventDefault(); setValue(down()); }
            else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); }
          }}
          className="mono min-w-0 flex-1 bg-transparent text-[13px] text-[rgb(var(--text))] outline-none placeholder:text-[rgb(var(--text-3))]" />
        <button type="button" disabled={disabled} onClick={submit}
          className="group relative inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[rgb(var(--canvas))]
                     bg-[linear-gradient(180deg,rgb(var(--accent)),rgb(var(--accent-2)))] shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_6px_18px_-6px_rgb(var(--accent)/.7)]
                     transition hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:bg-[rgb(var(--line)/.06)] disabled:text-[rgb(var(--text-3))] disabled:shadow-none">
          Review command <Kbd>⌘↵</Kbd>
        </button>
      </div>
      {!gate.open && <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[rgb(var(--hue-amber))]"><Lock className="size-3" />{gate.reason}</p>}
    </div>
  );
}
```

Rules: command history is **in memory only** (zero-cache rule). Pressing the button never sends; it opens `ActionReview`. The disabled state is visibly different from the enabled state and always explains why.

---

## 7. Blueprint D — Server Hero Control Bar and Sidebar Chrome

### 7.1 Server hero — `chrome/ServerHero.tsx`

```tsx
export function ServerHero({ s, gate }: { s: ServerView; gate: MutationGate }) {
  return (
    <section data-tone="emerald" className="pp-card flex flex-wrap items-center justify-between gap-4 !p-4 sm:!p-5">
      {/* subtle hero mesh */}
      <i aria-hidden className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-[radial-gradient(600px_160px_at_0%_0%,rgb(var(--accent)/.14),transparent_70%)]" />
      <div className="flex min-w-0 items-center gap-4">
        <div className="pp-icon-badge !size-14 !rounded-2xl" data-tone="accent"><Box className="size-7" strokeWidth={1.5} /></div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="truncate text-[28px] font-semibold leading-8 tracking-[-0.02em]">{s.name}</h1>
            <Pill tone={s.stateTone} dot><StatusRing state={s.state} />{s.stateLabel}</Pill>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-[rgb(var(--text-2))]">
            <Pill tone="sky" size="sm"><Layers className="size-3" />Paper {s.paperVersion}</Pill>
            <Pill tone="slate" size="sm"><Clock className="size-3" />Up <b className="num">{s.uptime}</b> · epoch {s.epochShort}</Pill>
            <FreshnessChip band={s.band} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <HeroButton tone="emerald" icon={Play}      label="Start"        disabled={!gate.open || s.state !== "stopped"} hint="Start requires a confirmed stopped service." />
        <HeroButton tone="amber"   icon={RotateCw}  label="Restart"      disabled={!gate.open || s.state !== "online"} />
        <HeroButton tone="rose"    icon={Square}    label="Stop"         disabled={!gate.open || s.state !== "online"} />
        <HeroButton tone="indigo"  icon={ArchiveRestore} label="Quick Backup" disabled={!gate.open} variant="solid" />
      </div>
    </section>
  );
}

function HeroButton({ tone, icon: Icon, label, disabled, hint, variant = "soft" }: HeroButtonProps) {
  return (
    <button type="button" disabled={disabled} title={hint} data-tone={tone}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-[13px] font-medium transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tone))] active:translate-y-px",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,.08)]",
        variant === "soft"
          ? "border-[rgb(var(--tone)/.30)] bg-[rgb(var(--tone)/.08)] text-[rgb(var(--tone))] hover:bg-[rgb(var(--tone)/.16)] hover:shadow-[0_0_24px_-6px_rgb(var(--tone)/.6)]"
          : "border-transparent bg-[linear-gradient(180deg,rgb(var(--tone)),rgb(var(--tone)/.75))] text-[rgb(var(--canvas))] shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_8px_20px_-8px_rgb(var(--tone)/.8)] hover:brightness-110",
        "disabled:cursor-not-allowed disabled:border-[rgb(var(--line)/.07)] disabled:bg-[rgb(var(--line)/.03)] disabled:text-[rgb(var(--text-3))] disabled:shadow-none disabled:hover:shadow-none")}>
      <Icon className="size-4" strokeWidth={2} />{label}
    </button>
  );
}
```

Each button opens `ActionReview` (never acts directly). The hint text is always visible below the bar on the right at 11 px when the reason for a disabled state exists (not only on hover).

### 7.2 Sidebar — `chrome/Sidebar.tsx`

- Width `264px` expanded / `72px` collapsed (persist via the existing preference mechanism only if a key exists; otherwise keep it in component state; **do not add a ninth preference key**). Animate width with `motion` `layout`; collapsed state shows icon-only with a glass tooltip on hover.
- L1 shell, `border-r`, with its own subtle top-left accent glow `radial-gradient(240px 160px at 0 0, rgb(var(--accent)/.12), transparent)`.
- **Brand block**: 36 px accent icon badge + `plexonpanel` wordmark + `5.0` mini badge (`mono`, `pp-well`).
- **Server switcher**: L3 well button with icon badge, name, "Server workspace", chevron-up-down; opens an L4 popover.
- **Nav groups** with 10.5 px uppercase labels: `Monitoring` (Fleet, Overview, Performance), `Management` (Players, Console & chat, Backups), `System` (Access & audit, Settings).
- **Active item** uses `.pp-glow-active` + 2 px left accent bar + accent icon with `drop-shadow(0 0 6px rgb(var(--accent)/.6))` + a trailing glow dot. Inactive items: `text-2`, icon `text-3`, hover `bg-[rgb(var(--line)/.05)]` and icon brightens.
- Item badges: Players shows online count (emerald pill), Console shows WARN/ERROR count since boot (amber/rose pill), Backups shows a pulsing indigo dot while a backup is running.
- **Relay card** (bottom, L3 well): 3 signal bars (animated by latency band), `Relay connected`, `Signed Protocol 3 connection`, `Owner access` chip. When disconnected it turns rose with a `Reconnect` button.
- Footer: collapse toggle + `PlexonPanel · Minecraft operations`.
- `<nav aria-label="Primary">`, items are `<a>` with `aria-current="page"`.

### 7.3 Top bar

Breadcrumb (`Workspace › Overview`), a global source status popover (`All sources live` with per-source `Paper` / `Host` freshness rows and last-sample age), search/command palette trigger with `⌘K` kbd, theme toggle. Height 56 px, L1 with bottom hairline; sticky with `backdrop-blur`.

---

## 8. Route-by-route composition guide

Global layout: `AppShell` = Sidebar + (TopBar over scrollable `main`). `main` content max width 1600 px, padding `var(--gap)*1.5`. Every route has **loading skeletons that mimic the final layout (shimmer wells, not spinners)**, an **empty state**, a **stale state** (60 % dim + rose hairline + banner) and an **error state** with Retry.

### R01 · Fleet
- **Layout**: top fleet summary strip (4 mini stat chips: servers online / total players / hosts connected / backups healthy); below, responsive grid `grid-cols-[repeat(auto-fill,minmax(340px,1fr))]` of **server cards**.
- **Focal point**: each server card = hero mini (status ring, name, Paper version) + 3 mini-sparklines (TPS, players, memory) + footer with last backup status chip. Card tone follows health.
- **States**: single-server fleet still shows the grid with a dashed "Add server" ghost card; offline server card is desaturated with `Last seen`.

### R02 · Overview
- **Layout**: ServerHero → 4 KPI cards (Blueprint A) → `grid xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]`: left Telemetry Studio (Blueprint B), right Live console (Blueprint C). Below: `grid lg:grid-cols-2`: **World activity** (loaded chunks and entities, each with sparkline + per-world segmented bar for overworld/nether/end using emerald/rose/violet) and **Active players** (roster table, top 6 rows with head, name, ping chip, session time, `View all →`).
- **Focal point**: the chart studio; the console is secondary but equal height (`h-[560px]`).
- **Interactions**: clicking a KPI card navigates to Performance with that series preselected; clicking a roster row opens the Player Inspector drawer.

### R03 · Performance
- **Layout**: full-width Telemetry Studio at `h-[480px]` with all three tabs and a 5-card summary strip, then a `grid xl:grid-cols-3` of detail cards: **MSPT distribution histogram** (bars colored by threshold), **GC pause timeline** (rose diamond markers on a mini timeline well), **Memory tiers stacked area** (violet/indigo layers), **CPU service vs node dual-line**, **Chunk/entity trend**, **Epoch history** (list of boot epochs with uptime bars; selecting one pins the chart to that epoch).
- **Focal point**: the chart. Range select and a "Pin to epoch" control sit in the card header.
- **Rule**: p95/p99 band, 50 ms budget and epoch gaps are always available here.

### R04 · Players
- **Layout**: left roster (searchable, sortable table in a well; columns: head+name, UUID short, ping chip, session time, world, state) + right column with **Session timeline** (join/leave events from `player-history.ts` rendered as a vertical rail with green join / slate leave nodes and relative times) and **Boot-session stats** (peak, unique joins, mean session length).
- **Exact-UUID Inspector slide-over**: L4 glass drawer from the right (`w-[440px]`, `motion` slide, focus-trapped, `Esc` closes). Contents: large head render, name, **full UUID in a mono well with copy button**, first/last seen this session, current world + coordinates (if reported), ping sparkline, join/leave history for this UUID, and action buttons (Kick, Op, Ban, Message) that all route through `ActionReview`. Name changes are keyed by UUID, never by name.
- **States**: empty roster shows an illustrated empty state with the server address copy chip.

### R05 · Console & Chat
- **Layout**: `grid xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]`. Left: full-height Live Console (Blueprint C, `h-[calc(100dvh-200px)]`) with tabs `Console | Chat`. Right column: **Plugin Cards** and **Live Chat**.
- **Plugin Cards**: one card per plugin tag seen this boot (chip color = `chipTone`), showing counts of INFO/WARN/ERROR as three micro-pills and a mini bar; clicking a card filters the console to that tag. Plugins with WARN/ERROR rise to the top.
- **Live Chat**: chat bubbles in a well. Incoming = left, head avatar + name + time + bubble (`bg-[rgb(var(--line)/.05)]`, rounded-2xl, top-left square). System/join/leave events = centered muted chips. Sending chat/commands uses the composer with scope pill `Chat · Paper` and goes through `ActionReview` if policy requires it.
- **Zero cache**: both streams are live and cursor-paginated; reloading the page re-hydrates from the Host. No persistence in the browser.

### R06 · Backups
- **Layout**: top row = **two side-by-side schedule cards**: **Manual — Fully Backup Now** (indigo; large primary button, estimated duration, last manual result, countdown option for player warning) and **Periodic Scheduled** (amber/indigo; cadence, next run countdown, last result, enable toggle, retention). Both target "Google Drive via rclone" with a destination chip and remote path in a mono well.
- **14-stage Pipeline Stepper** (full width, L2 card): horizontal on desktop (wrap to two rows of seven at `<1280px`), vertical on mobile. Each stage = node (24 px circle) + label + sub-status. Node states: `pending` (slate outline), `running` (accent with pulse ring and animated progress arc), `done` (emerald check, filled connector), `failed` (rose x, connector dashed), `skipped` (slate dash). **Stage ids and order come from the Host Companion's stage enum; the labels below are display defaults only. If the backend differs, the backend wins.**
  1 Preflight · 2 Acquire lock · 3 Announce to players (RCON) · 4 Countdown · 5 `save-all flush` · 6 Stop service · 7 Systemd stop proof · 8 Build manifest · 9 ZIP to `.partial` · 10 Finalize ZIP · 11 Local SHA-256 · 12 Upload to Google Drive · 13 Remote SHA-256 verify · 14 Restart and release lock.
- **Stage details**: stage 3-4 render the live RCON countdown in amber (big `num` seconds ring); stage 12 renders a **live upload card**: gradient progress bar, `MB/s` readout with sparkline, transferred / total, ETA; stage 11/13 render both hashes in mono wells with a match/mismatch badge.
- **Failure UX**: failed upload shows rose banner with the Host's reason and a **`Retry Upload`** button (reviewed via `ActionReview`). Never offer retry for stages that are unsafe to repeat; follow Host-reported `retryable`.
- **History**: table of past runs (type chip Manual/Periodic, size, duration, local hash short, remote verified badge, status).

### R07 · Access & Audit
- **Layout**: `grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]`. Left: **Device cards** (this device highlighted with accent glow; icon, label, key fingerprint short in mono, paired date, last seen, scope chips, `Revoke` in rose via `ActionReview`) and a **Pair new device** card with the 5-minute OTP countdown ring. Right: **Visual scope matrix** (rows = capabilities: view telemetry, view console, send commands, power actions, backups, manage access; columns = roles/devices; cells are 20 px tone dots: emerald granted, slate none, amber requires review) and the **Audit log** (timeline list: actor chip, action, target, result badge, timestamp, `Paper`/`Host`/`Panel` source, expandable JSON in a mono well).
- **Interactions**: filter audit by device, result, action type. Audit rows with failures get the same row tint rules as the console.

### R08 · Settings
- **Layout**: left in-page nav (Appearance, Display, Time, Skins, Server, About) + right stacked setting cards.
- **Appearance card**: theme (system/dark/light) as three **live-preview tiles** (mini rendered mock of the UI in that theme), accent (teal/blue/violet) as three glowing swatches, density as two schematic row previews, text size as a slider with sample text, motion (full/reduced), **chartFill** as a toggle with a small before/after preview chart. Timezone as a searchable select with a live "now" clock. Skin provider as a segmented control with head previews.
- Only the 8 locked keys appear. Changes apply instantly via the store; no "Save" button.

### Pairing Gate
Full-screen L0 with centered L4 glass card (`max-w-[460px]`): brand, 5-minute countdown ring, **6-cell OTP input** (L3 wells, auto-advance, paste support), `Claim` primary gradient button, device-credentials status steps (`Generate keypair → Claim pairing → Open relay`) with animated check states, and fail-closed error banner in rose with the exact adapter error. Ambient mesh is stronger here (accent glow 0.18).

### ActionReview Modal
L4 glass dialog (`max-w-[560px]`, focus-trapped, `Esc` cancels). Header: indigo icon badge + action title + a risk pill (info/caution/destructive from `review-policy.ts`). Body: **what will happen** (bulleted effects), **target** (server/UUID/command in a mono well), **blast radius** (players affected, restart implied?), for backups the stage list preview and RCON countdown length. Footer: `Cancel` (ghost) and the confirm button colored by risk (`indigo`/`amber`/`rose`), labeled with the verb (e.g. `Stop server`), disabled until `session.prepare` resolves; shows a spinner state during `session.execute` and a success/failure result panel afterwards. Destructive actions require typing the server name.

---

## 9. "Flat and Monochrome" anti-pattern ban list and visual QA gate

### 9.1 Ban list (any hit = reject and fix before reporting done)

1. A card, panel or well whose only content is text or a number with **no embedded visualization, footer, or structured child**.
2. Any KPI card without `data-slot="viz"`.
3. Two adjacent surfaces sharing the same fill and border with no level, tone, or specular difference.
4. Any surface with a plain `border border-white/10` and flat fill as its only treatment (use the L-level recipes).
5. Icons smaller than 16 px without a tinted badge, or a naked 16 px icon in a card header.
6. Hard-coded hex/rgb colors inside components. Use tokens.
7. A single hue for all data. Every series and domain uses its assigned tone (section 2.5).
8. Raw `[PluginName]` bracket text in console messages; uniform single-color log text; a console without severity pills.
9. Console rows hard-clipped at the top or bottom of the viewport (missing fade mask).
10. Repeating an identical timestamp on consecutive console rows, or **duplicate x-axis tick labels** on any chart.
11. A 1 px un-filled "wireframe" chart when `chartFill` is enabled; any chart missing gradient fills when fill is on.
12. A y-domain dictated by a single start-up spike (must use `msptDomain`).
13. Chart right-axis unit text inside every tick (`128 ms`) or any label colliding with the plot or the footer.
14. Lines interpolated across a boot-epoch gap, or Paper and Host clocks merged.
15. Legends rendered as plain text where a clickable Summary Strip is required.
16. Disabled controls with no visible reason; mutation buttons that act without `ActionReview`; hiding controls instead of disabling.
17. A stale/delayed value shown with live styling.
18. Persisting console/chat/command history to localStorage, sessionStorage, IndexedDB or any cache.
19. Any file, import, class name, CSS variable or comment containing `strata` (case-insensitive) or references to the old skin.
20. A ninth preference key, or inventing values not present in `store/preferences.ts`.
21. Text under 11 px (except the 10-10.5 px uppercase micro-labels), or contrast below WCAG AA for body text in either theme.
22. Spinners as the primary loading state for layout-bearing regions (use shimmer skeleton wells).
23. Animation that ignores `data-motion="reduced"` / `prefers-reduced-motion`.
24. Emoji as UI icons.

### 9.2 Automated gate (run before declaring completion)

```bash
# 1. No legacy skin
! grep -RIil "strata" src/ app/ public/ 2>/dev/null
# 2. No hard-coded colors in components (tokens only; globals.css and chart-defs may define)
! grep -RInE "#[0-9a-fA-F]{3,8}\b" src/ui --include=*.tsx | grep -v "globals.css"
# 3. No browser persistence of console/chat
! grep -RInE "(localStorage|sessionStorage|indexedDB).*(console|chat|command)" src/ui
# 4. Typecheck, lint, unit tests for parseLine / msptDomain / buildTimeTicks / buildRows
pnpm typecheck && pnpm lint && pnpm test
```

Required unit tests: `parseLine` (INFO with plugin tag, WARN, ERROR with stack-trace continuation, no-tag thread line, URL trailing punctuation, garbage input never throws); `msptDomain` (a 128 ms single spike does not exceed the domain; always includes 50 ms); `buildTimeTicks` (no duplicate labels for ranges of 5 m, 15 m, 1 h, 6 h); `buildRows` (null inserted on epoch boundary; Host and Paper series not merged).

### 9.3 Playwright visual gate

Capture at **1440×900 (dark and light)**, **1280×800**, **390×844 (mobile, sidebar collapsed to drawer)**, for each of R01-R08, the Pairing Gate and the ActionReview modal. Assertions:

- `document.querySelectorAll('[data-slot="viz"]').length >= 4` on Overview, and each `.pp-card` inside the KPI row contains one.
- Chart: at least one `<linearGradient>` fill is applied to a visible path when `chartFill` is true; the x-axis tick label texts are unique.
- Console: every `[data-level]` row has a severity pill; no row's text content matches `/\[(voicechat|MiniMOTD)\]/` in the message column.
- No horizontal page overflow at 390 px; no element overlaps the chart footer.
- `axe-core`: zero serious/critical violations in both themes.
- Visual regression baseline stored per theme.

### 9.4 Manual squint test

Blur the screenshot (squint). You must still see: a lit top edge on cards, at least 3 distinct surface depths, colored (not grey) data, a clear focal point per route. If the squinted image looks like one dark rectangle with white numbers, the design failed.

---

## 10. Build order and definition of done

1. **Purge**: delete the old UI tree and CSS; confirm the app still compiles against stubs; confirm `src/adapter`, `src/presentation`, `src/store` are untouched (`git diff --stat` shows no changes there).
2. **Tokens and surfaces**: `globals.css`, `motion.css`, `PreferencesBridge`, theme boot script. Render a `/dev/surfaces` page showing L0-L4 in dark and light and all three accents.
3. **Primitives** (section 3) with a `/dev/primitives` gallery.
4. **Chrome**: AppShell, Sidebar, TopBar, ServerHero.
5. **Blueprint A**: four KPI cards wired to hooks.
6. **Blueprint B**: Telemetry Studio with scales, defs, strip, tooltip, epoch gaps.
7. **Blueprint C**: parser, rows, virtualized console, composer, ActionReview wiring.
8. **Routes** R01 → R08, Pairing Gate.
9. **QA gate** (section 9). Fix until clean.

**Definition of done**: every item in the ban list is verifiably absent; all four screenshot defects in section 0.1 are visibly resolved side by side with the old screenshot; all three accents and both themes pass the Playwright gate; preserved headless modules are byte-identical to before; the report back lists any place where the backend's real data shape forced a deviation from this file (e.g. different backup stage ids) and what was done.

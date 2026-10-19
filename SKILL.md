---
name: plexonpanel-v5-structural-architect
description: Clean-slate structural rebuild of the PlexonPanel 5.0 frontend (Minecraft Paper 26.x + Linux VPS Host Companion control plane). Use for ANY task that creates, deletes or restructures src/ui/**, app/**, layout CSS, routes R01-R08, the app chrome, the instrument deck, telemetry studio, console, or any layout primitive. Mandates the "Obsidian Mission Deck" architecture - 64px icon rail, one unified Mission Control ribbon, hairline-divided decks/panes/ribbons, zero card-soup, zero badge spam, zero inline gate paragraphs - mounted on the preserved headless Protocol 3 core.
---

# PlexonPanel 5.0 - Structural Architect: "The Obsidian Mission Deck"

You are the Staff Frontend Engineer executing a **greenfield visual-layer rebuild**. The previous iteration had a correct *skin* (obsidian palette, semantic hues, specular edges, micro-visualizations) and a failed *skeleton* (box-in-a-box card soup, badge spam, exposed gate paragraphs, 250px dead-space KPI cards, 6-line console towers, generic sidebar + 4 boxes + 2 boxes wireframe). This skill keeps the skin DNA and replaces the skeleton entirely.

**Design thesis:** the screen is ONE instrument, not 20 boxes. Space is divided by **1px hairlines**, not by nested rounded borders. Rounded borders exist at exactly one level (the Deck / Pane). Everything inside a Deck or Pane is flush, hairline-separated, and borderless.

Stack: React 19, Next.js App Router, Tailwind CSS, Radix UI, Motion, `@tanstack/react-virtual`, `lucide-react`, `cmdk`, hand-built SVG telemetry (no chart library required).

---

## 0. Order of operations (do not reorder)

1. **Snapshot** legacy tokens (Section 1.1).
2. **Purge** (Section 1.2) and run `scripts/verify-purge.sh` until it exits 0.
3. Create the **bindings layer** (Section 2) - the only place UI touches headless modules.
4. Write `globals.css` tokens + primitives (Section 3).
5. Build Blueprint 1 (chrome) -> 2 (deck) -> 3 (studio) -> 4 (console).
6. Build routes R01-R08, PairingGate, ActionReviewModal (Section 8).
7. Run the QA checklist in Playwright (Section 9). Do not package until 25/25 pass.

---

## 1. Clean-slate purge mandate

### 1.1 Snapshot (before deleting anything)

```bash
mkdir -p .purge
cp src/ui/styles/globals.css .purge/globals.legacy.css
# Extract ONLY: the Tailwind import/directive header, and every :root / [data-theme] / [data-accent]
# / [data-density] / [data-text-size] / [data-motion] token block. Nothing else survives.
```

Keep the project's existing Tailwind header exactly (`@import "tailwindcss";` for v4 OR `@tailwind base; @tailwind components; @tailwind utilities;` for v3). If the legacy token blocks cannot be recovered, use the baseline in Section 3.

### 1.2 Delete (hard delete, no "legacy" folder, no commented-out code)

```bash
git rm -rf src/ui
git rm -rf app
rm -rf .next
mkdir -p src/ui/{shell,primitives,instruments,studio,console,routes,bindings,styles} app
```

Deleted for good: every component, hook, route view and style under `src/ui/**` and `app/**`, including these legacy class names - they must not exist anywhere after the rebuild:

`.server-hero .kpi-grid .overview-main .below-grid .hero-actions .gate-reason .sidebar .topbar .pp-card--kpi .kpi-grid .pp-card { min-height: 250px }`

Next.js App Router needs `app/layout.tsx` and route files, so they are **recreated** (Section 8), never restored.

### 1.3 Preserved headless surface (read-only - never edit, never re-implement)

| Path | Contract the UI must honor |
|---|---|
| `src/adapter/**` | Ed25519/HMAC Protocol 3 WebSocket client; IndexedDB `plexonpanel-browser-v3` device credentials; `/v1/pairings/claim` OTP handshake; `session.reason(action, kind)` fail-closed mutation gate; `session.prepare` -> `ActionReview` -> `session.execute`. **Zero browser storage for console/chat.** |
| `src/presentation/{authority,epochs,review-policy,telemetry,player-history}.ts` | Independent Paper vs Host freshness clocks; boot-epoch gap preservation on restart; review policy; telemetry shaping; player join/leave history. |
| `src/store/preferences.ts`, `src/store/selectors.ts` | Exactly 8 locked keys: `theme, density, textSize, accent, motion, chartFill, timezone, skinProvider`. **Do not add a 9th key** (e.g. rail-open state is plain `useState`, session-only). |
| `src/lib/playerCommands.ts`, `src/lib/textFormat/index.ts` | Player command builders; Minecraft text/color-code formatting. |

### 1.4 `scripts/verify-purge.sh`

```bash
#!/usr/bin/env bash
set -e
BAN='gate-reason|kpi-grid|server-hero|overview-main|below-grid|hero-actions|min-height: ?250px|\.sidebar\b|\.topbar\b'
if grep -RInE "$BAN" src app --include='*.{ts,tsx,css}' 2>/dev/null; then echo "FAIL: legacy structure found"; exit 1; fi
# the headless core must not import from the UI tree
if grep -RInE "from ['\"](@/ui|\.\./ui|\.\./\.\./ui)" src/adapter src/presentation src/store src/lib; then echo "FAIL: core imports UI"; exit 1; fi
# no browser storage for console/chat
if grep -RInE "(localStorage|sessionStorage|indexedDB)" src/ui/console src/ui/routes/console* src/ui/routes/chat* 2>/dev/null; then echo "FAIL: storage in console/chat"; exit 1; fi
echo "purge OK"
```

---

## 2. Bindings layer (the only seam to the headless core)

Because export names in the preserved modules are authoritative, **first `grep` the real exports**, then create thin typed wrappers in `src/ui/bindings/`. UI components import ONLY from `@/ui/bindings`. Never re-derive freshness, epochs or gates in a component.

```ts
// src/ui/bindings/index.ts  (adapt names to the real exports; shapes below are the UI contract)
export type Freshness = 'live' | 'stale' | 'offline' | 'gap';           // from presentation/authority.ts
export type Source = 'paper' | 'host';
export interface Ledger { paper: { state: Freshness; ageMs: number }; host: { state: Freshness; ageMs: number } }

export function useLedger(): Ledger;                                     // authority.ts
export function useActiveServer(): { id: string; name: string; version: string;
  phase: 'online' | 'offline' | 'starting' | 'stopping' | 'unknown';
  uptimeMs: number | null; epochId: string | null };                     // selectors.ts + epochs.ts
export function useServers(): Array<{ id: string; name: string; phase: string }>;
export function usePrefs(): Prefs & { set<K extends keyof Prefs>(k: K, v: Prefs[K]): void }; // preferences.ts, 8 keys
export function useTelemetry(window: '1m' | '5m' | '15m' | '35m'): TelemetryView; // telemetry.ts (segments split by epoch gaps)
export function useRoster(): RosterView;                                 // player-history.ts
export function useConsoleStream(): ConsoleStreamView;                   // adapter, memory only
export function useMutation(action: string, kind: string): {
  reason: string | null;            // session.reason(action, kind): null = allowed, string = exact gate reason
  begin(args?: unknown): Promise<void>; // session.prepare -> opens ActionReviewModal
};
```

Rule: **a gate reason is data, not layout.** It is only ever rendered inside a Tooltip/`aria-description`, never as a block element.

---

## 3. Tokens and architectural primitives (`src/ui/styles/globals.css`)

### 3.1 Preserved surface and lighting tokens

Keep the legacy token blocks verbatim. Baseline reference (use only if recovery fails). All colors are **space-separated RGB triplets** so `rgb(var(--x) / .08)` works.

```css
:root, [data-theme="dark"] {
  --bg:        7 10 14;      /* obsidian floor */
  --surface-1: 13 18 24;     /* deck/pane cell */
  --surface-2: 18 25 33;     /* raised control */
  --surface-3: 9 13 18;      /* recessed well */
  --line:      190 205 230;  /* hairline source (use at .06-.14) */
  --text:      232 238 246;
  --muted:     133 148 168;
  --faint:     84 98 118;

  --emerald: 52 211 153;  --cyan: 34 211 238;  --violet: 167 139 250;
  --indigo: 129 140 248;  --amber: 251 191 36; --rose: 251 113 133;

  --accent: var(--emerald);                 /* overridden by [data-accent] */
  --rail-w: 64px;
  --hdr-h: 56px;
  --cell-h: 148px;
  --ctl-h: 32px;
  --row-h: 24px;                            /* density-controlled */
  --fs-base: 13px;                          /* textSize-controlled */
  --r-box: 14px;                            /* the ONE box radius */
  --r-ctl: 8px;                             /* controls/tags, always < 12px */
  --dur: .18s;
}
[data-theme="light"] {
  --bg: 244 246 249; --surface-1: 255 255 255; --surface-2: 247 249 252; --surface-3: 238 242 247;
  --line: 20 32 54; --text: 15 23 36; --muted: 88 100 118; --faint: 140 150 165;
}
[data-accent="cyan"]   { --accent: var(--cyan); }
[data-accent="violet"] { --accent: var(--violet); }
[data-accent="indigo"] { --accent: var(--indigo); }
[data-accent="amber"]  { --accent: var(--amber); }
[data-accent="rose"]   { --accent: var(--rose); }
[data-density="compact"]     { --row-h: 20px; --ctl-h: 28px; }
[data-density="comfortable"] { --row-h: 28px; --ctl-h: 36px; }
[data-text-size="sm"] { --fs-base: 12px; } [data-text-size="lg"] { --fs-base: 14.5px; }
[data-motion="reduced"] * { animation-duration: .001ms !important; transition-duration: .001ms !important; }
```

Apply `data-theme/accent/density/text-size/motion` on `<html>` from `usePrefs()` in `app/layout.tsx` (also set via an inline pre-hydration script reading the preference store's existing persistence, so there is no theme flash).

Semantic hue map (fixed): **Tick = emerald, Players = cyan, Compute = indigo, Memory = violet, Warning = amber, Error/Destructive = rose.** Domain tone is applied through `data-tone="emerald|cyan|..."` -> `--tone`.

### 3.2 Architectural layout primitives

```css
@layer components {
  /* ---------- tone plumbing ---------- */
  [data-tone="emerald"] { --tone: var(--emerald); } [data-tone="cyan"]   { --tone: var(--cyan); }
  [data-tone="indigo"]  { --tone: var(--indigo); }  [data-tone="violet"] { --tone: var(--violet); }
  [data-tone="amber"]   { --tone: var(--amber); }   [data-tone="rose"]   { --tone: var(--rose); }

  /* ---------- .pp-deck: ONE bordered shell; children are hairline-divided cells ---------- */
  .pp-deck {
    display: grid; gap: 1px;                              /* the gap IS the hairline */
    background: rgb(var(--line) / .10);
    border: 1px solid rgb(var(--line) / .10);
    border-radius: var(--r-box); overflow: hidden;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / .05), 0 28px 56px -36px rgb(0 0 0 / .85);
  }
  .pp-deck > .pp-cell {                                    /* cells: NO border, NO radius, NO shadow */
    position: relative; background: rgb(var(--surface-1)); min-width: 0;
    background-image:
      radial-gradient(120% 90% at 0% 0%, rgb(var(--tone, var(--accent)) / .11), transparent 62%),
      linear-gradient(180deg, rgb(255 255 255 / .035), transparent 38%);
  }
  .pp-deck > .pp-cell::before {                            /* top-edge specular highlight */
    content: ""; position: absolute; inset: 0 0 auto 0; height: 1px;
    background: linear-gradient(90deg, transparent, rgb(var(--tone, var(--accent)) / .55), transparent);
    opacity: .7; pointer-events: none;
  }

  /* ---------- .pp-pane: ONE bordered shell; internals are head / ribbon / body separated by hairlines ---------- */
  .pp-pane {
    display: flex; flex-direction: column; min-width: 0; min-height: 0;
    background: rgb(var(--surface-1));
    background-image: linear-gradient(180deg, rgb(255 255 255 / .03), transparent 30%);
    border: 1px solid rgb(var(--line) / .10); border-radius: var(--r-box); overflow: hidden;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / .05), 0 28px 56px -36px rgb(0 0 0 / .85);
  }
  .pp-pane__head {
    display: flex; align-items: center; gap: 12px; height: 44px; padding: 0 14px; flex: none;
    border-bottom: 1px solid rgb(var(--line) / .08);
  }
  .pp-pane__title { font-size: 13px; font-weight: 600; letter-spacing: -.005em; }
  .pp-pane__body { flex: 1; min-height: 0; }
  .pp-pane__foot { border-top: 1px solid rgb(var(--line) / .08); padding: 8px 14px; flex: none; }

  /* ---------- .pp-ribbon: flush metric strip, border-shared cells ---------- */
  .pp-ribbon {
    display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr);
    border-block: 1px solid rgb(var(--line) / .08); flex: none;
  }
  .pp-ribbon > * { position: relative; padding: 10px 14px 9px; min-width: 0; }
  .pp-ribbon > * + * { border-left: 1px solid rgb(var(--line) / .08); }
  .pp-ribbon > [data-active="true"]::before {              /* 2px glowing top indicator */
    content: ""; position: absolute; inset: -1px 0 auto 0; height: 2px; background: rgb(var(--tone));
    box-shadow: 0 0 12px 1px rgb(var(--tone) / .65);
  }

  /* ---------- .pp-well: recessed, borderless canvas ---------- */
  .pp-well {
    background: linear-gradient(180deg, rgb(var(--surface-3)), rgb(var(--surface-3) / .55));
    box-shadow: inset 0 1px 0 rgb(0 0 0 / .35);
    border-radius: 0;                                      /* full-bleed inside a pane */
  }

  /* ---------- .pp-glass: floating overlays ONLY (palette, tooltip, modal, pairing gate) ---------- */
  .pp-glass {
    background: rgb(var(--surface-2) / .82); backdrop-filter: blur(18px) saturate(1.4);
    border: 1px solid rgb(var(--line) / .14); border-radius: 16px;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / .07), 0 24px 64px -16px rgb(0 0 0 / .75);
  }

  /* ---------- .pp-card: STANDALONE LEAF ONLY (a fleet blade, a single stat on a sparse route) ---------- */
  .pp-card { background: rgb(var(--surface-1)); border: 1px solid rgb(var(--line) / .10); border-radius: var(--r-box);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / .05); }

  /* ---------- micro atoms (all radius < 12px, so they never count as "boxes") ---------- */
  .pp-kicker { font-size: 10px; font-weight: 600; letter-spacing: .09em; text-transform: uppercase; color: rgb(var(--muted)); }
  .pp-num    { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; letter-spacing: -.02em; }
  .pp-tag    { display: inline-flex; align-items: center; gap: 4px; height: 18px; padding: 0 6px; border-radius: 6px;
    font-size: 10.5px; font-weight: 600; color: rgb(var(--tone, var(--muted))); background: rgb(var(--tone, var(--muted)) / .12); }
  .pp-dot    { width: 6px; height: 6px; border-radius: 99px; background: rgb(var(--tone, var(--muted))); flex: none; }
  .pp-kbd    { font: 600 10px/1 ui-monospace, monospace; padding: 3px 5px; border-radius: 5px;
    background: rgb(var(--line) / .10); color: rgb(var(--muted)); }
  .pp-ctl    { height: var(--ctl-h); padding: 0 10px; border-radius: var(--r-ctl); font-size: 12.5px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 6px; background: rgb(var(--surface-2));
    border: 1px solid rgb(var(--line) / .12); color: rgb(var(--text)); transition: background var(--dur), border-color var(--dur); }
  .pp-ctl:hover { background: rgb(var(--line) / .08); }
  .pp-ctl:focus-visible { outline: 2px solid rgb(var(--accent) / .7); outline-offset: 1px; }
  .pp-ctl[aria-disabled="true"] { opacity: .45; cursor: not-allowed; }
}
```

### 3.3 Nesting law (enforced by QA #1)

A "**box**" is any element with `border-width > 0` AND `border-radius >= 12px`. **No box may contain another box.** Legal composition:

```
Deck  -> Cell -> (atoms, SVG)                      // cells borderless
Pane  -> Head | Ribbon | Body(Well/Table/List)     // all borderless, hairline-separated
Page  -> Deck | Pane | Card(leaf)                  // siblings only
Overlay (.pp-glass) may float above anything; it is not "inside" the page tree.
```

Banned: `.pp-card` inside `.pp-card`/`.pp-pane`/`.pp-deck`; any per-route `min-height` hack on a cell; any `rounded-xl|2xl|3xl` + `border` inside a Pane or Deck; text badges stating the source (`PAPER`, `HOST`) or `Live` inside a cell (see Section 3.4).

### 3.4 Badge budget (enforced by QA #2-#4)

- **Source** is a single-letter dot tag `P`/`H` at the cell's top-right (`<SourceTag source="paper" />`, 9px) - never the words PAPER/HOST in a cell.
- **Freshness** is shown ONCE per screen, in the header ledger pill. A cell shows freshness only when *abnormal*: the tag turns amber, the value dims to 55%, and a `stale 12s` micro-label replaces the delta pill. Healthy = silent.
- The literal string `PAPER` may appear at most 1x per screen and `Live` at most 2x (ledger pill only).

---

## 4. Blueprint 1 - Unified Mission Control Chrome

Silhouette (viewport 1545x911 -> main canvas is **1481px**, +200px vs the old 264px sidebar):

```
┌──┬────────────────────────────────────────────────────────────────────────────────────────────────┐
│▣ │ ◉ TonimSMP ▾ │ ◌ online  Paper 26.3 · Up 12h 58m · epoch 9a4f6484    ● Paper Live · ● Host Live │ ⌘K │ ▶ ⟳ ■ │ ⛁ Quick Backup │  56px
│▦ ├────────────────────────────────────────────────────────────────────────────────────────────────┤
│▤ │                                                                                                │
│▥ │                                   page canvas  (24px gutters)                                  │
│… │                                                                                                │
│⇤ │                                                                                                │
└──┴────────────────────────────────────────────────────────────────────────────────────────────────┘
 64px rail (220px only on toggle; session-only useState)
```

### 4.1 CSS

```css
@layer components {
  .pp-shell { display: grid; grid-template-columns: var(--rail-w) minmax(0, 1fr); height: 100dvh;
    background: rgb(var(--bg)); color: rgb(var(--text)); font-size: var(--fs-base);
    transition: grid-template-columns var(--dur) ease; }
  .pp-shell[data-rail="open"] { --rail-w: 220px; }
  .pp-shell__main { display: grid; grid-template-rows: var(--hdr-h) minmax(0, 1fr); min-width: 0; min-height: 0; }
  .pp-canvas { overflow: auto; padding: 20px 24px 32px; scrollbar-gutter: stable; }
  .pp-canvas[data-bleed="true"] { padding: 0; overflow: hidden; }       /* R05 console IDE */

  .pp-rail { display: flex; flex-direction: column; align-items: stretch; gap: 4px; padding: 10px 10px;
    border-right: 1px solid rgb(var(--line) / .08); background: rgb(var(--surface-1) / .6); min-height: 0; }
  .pp-rail__item { position: relative; display: flex; align-items: center; gap: 12px; height: 40px; padding: 0 11px;
    border-radius: 10px; color: rgb(var(--muted)); overflow: hidden; white-space: nowrap; }
  .pp-rail__item:hover { color: rgb(var(--text)); background: rgb(var(--line) / .07); }
  .pp-rail__item[aria-current="page"] { color: rgb(var(--accent)); background: rgb(var(--accent) / .10); }
  .pp-rail__item[aria-current="page"]::before { content: ""; position: absolute; left: -10px; top: 9px; bottom: 9px; width: 3px;
    border-radius: 0 3px 3px 0; background: rgb(var(--accent)); box-shadow: 0 0 14px rgb(var(--accent) / .8); }
  .pp-rail__label { opacity: 0; transition: opacity var(--dur); }
  .pp-shell[data-rail="open"] .pp-rail__label { opacity: 1; }
  .pp-rail__pip { position: absolute; top: 8px; left: 28px; width: 7px; height: 7px; border-radius: 9px;
    background: rgb(var(--tone, var(--amber))); box-shadow: 0 0 0 2px rgb(var(--surface-1)); }

  .pp-ribbon-bar { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto auto; align-items: center; gap: 0;
    height: var(--hdr-h); padding: 0 14px 0 8px; border-bottom: 1px solid rgb(var(--line) / .08);
    background: linear-gradient(180deg, rgb(255 255 255 / .035), transparent), rgb(var(--surface-1) / .72);
    backdrop-filter: blur(12px); }
  .pp-ribbon-bar > * + * { margin-left: 12px; }
  .pp-ribbon-bar__sep { width: 1px; height: 24px; background: rgb(var(--line) / .10); }

  .pp-ring { position: relative; width: 14px; height: 14px; border-radius: 99px; background: rgb(var(--tone)); flex: none; }
  .pp-ring::after { content: ""; position: absolute; inset: -4px; border-radius: 99px; border: 1.5px solid rgb(var(--tone) / .55);
    animation: pp-ring 2.4s ease-out infinite; }
  .pp-ring[data-phase="offline"]::after, .pp-ring[data-phase="unknown"]::after { animation: none; opacity: .25; }
  @keyframes pp-ring { 0% { transform: scale(.7); opacity: .9 } 100% { transform: scale(1.5); opacity: 0 } }

  .pp-power { display: inline-flex; border-radius: var(--r-ctl); overflow: hidden; border: 1px solid rgb(var(--line) / .14); height: var(--ctl-h); }
  .pp-power > button { display: inline-flex; align-items: center; gap: 6px; padding: 0 11px; font-size: 12.5px; font-weight: 600;
    background: rgb(var(--surface-2)); color: rgb(var(--text)); }
  .pp-power > button + button { border-left: 1px solid rgb(var(--line) / .14); }
  .pp-power > button[data-fg="true"] { background: rgb(var(--tone) / .14); color: rgb(var(--tone)); }
  .pp-power > button[aria-disabled="true"] { opacity: .4; padding: 0 9px; cursor: not-allowed; }  /* collapsed to icon-only */
  .pp-power > button[aria-disabled="true"] span { display: none; }

  @media (max-width: 1100px) { .pp-ribbon-bar__meta { display: none; } .pp-ledger__text { display: none; } }
  @media (max-width: 760px)  { /* rail becomes a 56px bottom tab bar */
    .pp-shell { grid-template-columns: 1fr; grid-template-rows: minmax(0, 1fr) 56px; }
    .pp-rail { order: 2; flex-direction: row; border-right: 0; border-top: 1px solid rgb(var(--line) / .08); justify-content: space-around; }
    .pp-rail__label, .pp-rail__toggle { display: none; } .pp-canvas { padding: 12px; } }
}
```

### 4.2 Routes registry and keyboard model (`src/ui/shell/routes.ts`, `useGoShortcuts.ts`)

```ts
import { Network, Activity, Gauge, Users, TerminalSquare, ArchiveRestore, ShieldCheck, Settings } from 'lucide-react';
export const ROUTES = [
  { key: 1, id: 'fleet',       href: '/fleet',       label: 'Fleet',          icon: Network },
  { key: 2, id: 'overview',    href: '/overview',    label: 'Overview',       icon: Activity },
  { key: 3, id: 'performance', href: '/performance', label: 'Performance',    icon: Gauge },
  { key: 4, id: 'players',     href: '/players',     label: 'Players',        icon: Users },
  { key: 5, id: 'console',     href: '/console',     label: 'Console & chat', icon: TerminalSquare },
  { key: 6, id: 'backups',     href: '/backups',     label: 'Backups',        icon: ArchiveRestore },
  { key: 7, id: 'access',      href: '/access',      label: 'Access & audit', icon: ShieldCheck },
  { key: 8, id: 'settings',    href: '/settings',    label: 'Settings',       icon: Settings },
] as const;
```

```ts
// useGoShortcuts.ts - "G" then 1-8 within 900ms; ignored while typing in inputs/contenteditable/xterm-like composers
export function useGoShortcuts() {
  const router = useRouter();
  useEffect(() => {
    let armed = 0;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input,textarea,select,[contenteditable="true"]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === 'g') { armed = Date.now(); return; }
      if (armed && Date.now() - armed < 900) {
        const r = ROUTES.find(r => String(r.key) === e.key);
        if (r) { e.preventDefault(); router.push(r.href); }
        armed = 0;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);
}
```

### 4.3 `AppShell` and `CompactRail`

```tsx
// src/ui/shell/AppShell.tsx
'use client';
export function AppShell({ children }: { children: React.ReactNode }) {
  const [railOpen, setRailOpen] = useState(false);                // session-only; NOT a preference key
  useGoShortcuts();
  return (
    <Tooltip.Provider delayDuration={120} skipDelayDuration={300}>
      <div className="pp-shell" data-rail={railOpen ? 'open' : 'compact'}>
        <CompactRail open={railOpen} onToggle={() => setRailOpen(o => !o)} />
        <div className="pp-shell__main">
          <MissionControlHeader />
          <PageCanvas>{children}</PageCanvas>
        </div>
      </div>
      <ActionReviewHost />   {/* single modal host for every session.prepare result */}
      <CommandPalette />     {/* cmdk, .pp-glass */}
    </Tooltip.Provider>
  );
}
```

```tsx
// src/ui/shell/CompactRail.tsx
export function CompactRail({ open, onToggle }: { open: boolean; onToggle(): void }) {
  const pathname = usePathname();
  const badges = useRailBadges();   // { players?: number, console?: { warn: number; error: number } } -> shown as a 7px pip when compact
  return (
    <nav className="pp-rail" aria-label="Primary">
      <Link href="/overview" className="pp-rail__item" aria-label="PlexonPanel home" data-tone="emerald">
        <BrandMark className="size-[18px] shrink-0" /><span className="pp-rail__label font-semibold tracking-tight">plexonpanel</span>
      </Link>
      <div className="my-2 h-px bg-[rgb(var(--line)/0.08)]" />
      {ROUTES.map(r => {
        const active = pathname.startsWith(r.href);
        const pip = r.id === 'console' ? (badges.console?.error ? 'rose' : badges.console?.warn ? 'amber' : null) : null;
        return (
          <Tooltip.Root key={r.id}>
            <Tooltip.Trigger asChild>
              <Link href={r.href} className="pp-rail__item" aria-current={active ? 'page' : undefined}>
                <r.icon className="size-[18px] shrink-0" strokeWidth={1.75} />
                <span className="pp-rail__label text-[13px] font-medium">{r.label}</span>
                {pip && <i className="pp-rail__pip" data-tone={pip} />}
              </Link>
            </Tooltip.Trigger>
            {!open && (
              <Tooltip.Portal>
                <Tooltip.Content side="right" sideOffset={10} className="pp-glass flex items-center gap-2 px-2.5 py-1.5 text-[12px]">
                  {r.label}<kbd className="pp-kbd">G</kbd><kbd className="pp-kbd">{r.key}</kbd>
                </Tooltip.Content>
              </Tooltip.Portal>
            )}
          </Tooltip.Root>
        );
      })}
      <div className="mt-auto" />
      <button className="pp-rail__item pp-rail__toggle" onClick={onToggle} aria-expanded={open} aria-label="Toggle navigation width">
        <PanelLeft className="size-[18px] shrink-0" /><span className="pp-rail__label text-[12px]">Collapse</span>
      </button>
    </nav>
  );
}
```

Relay/session identity ("Relay connected - Signed Protocol 3 connection - Owner access") moves OUT of the nav into the **ledger pill tooltip** (Section 4.5). The rail carries no prose.

### 4.4 `MissionControlHeader` - one bar, five zones

```tsx
// src/ui/shell/MissionControlHeader.tsx
'use client';
export function MissionControlHeader() {
  const s = useActiveServer();
  const tone = s.phase === 'online' ? 'emerald' : s.phase === 'offline' ? 'rose'
             : s.phase === 'unknown' ? 'amber' : 'cyan';
  return (
    <header className="pp-ribbon-bar" role="banner">
      <ServerSwitcher />                                             {/* zone 1: Radix DropdownMenu, name + chevron, 32px */}
      <div className="pp-ribbon-bar__meta flex min-w-0 items-center gap-3" data-tone={tone}>   {/* zone 2 */}
        <span className="pp-ring" data-phase={s.phase} aria-hidden />
        <span className="text-[12.5px] font-semibold capitalize" style={{ color: 'rgb(var(--tone))' }}>{s.phase}</span>
        <span className="pp-ribbon-bar__sep" />
        <span className="truncate text-[12px] text-[rgb(var(--muted))] pp-num">
          Paper {s.version}{s.uptimeMs != null && <> · Up <Uptime ms={s.uptimeMs} /></>}{s.epochId && <> · epoch <code className="font-mono">{s.epochId.slice(0, 8)}</code></>}
        </span>
      </div>
      <AuthorityLedgerPill />                                        {/* zone 3: ONE pill */}
      <button className="pp-ctl" onClick={openPalette} aria-label="Open command palette">
        <Search className="size-3.5" /><span className="hidden xl:inline text-[rgb(var(--muted))]">Jump to…</span><kbd className="pp-kbd">⌘K</kbd>
      </button>                                                       {/* zone 4 */}
      <PowerAndBackupGroup phase={s.phase} />                         {/* zone 5 */}
    </header>
  );
}
```

### 4.5 `AuthorityLedgerPill` (replaces "All sources live", per-card PAPER/HOST/Live badges, and the sidebar relay box)

```tsx
export function AuthorityLedgerPill() {
  const { paper, host } = useLedger();
  const worst = [paper.state, host.state].includes('offline') ? 'rose'
              : [paper.state, host.state].some(x => x !== 'live') ? 'amber' : 'emerald';
  const conn = useConnectionInfo();   // { relay: 'connected'|..., protocol: 3, role: 'owner' } from adapter selectors
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button className="pp-ctl gap-2.5 px-2.5" data-tone={worst} aria-label={`Paper ${paper.state}, Host ${host.state}`}>
          <Seg label="Paper" s={paper.state} /><span className="h-3.5 w-px bg-[rgb(var(--line)/0.14)]" /><Seg label="Host" s={host.state} />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="bottom" align="end" sideOffset={8} className="pp-glass w-[280px] p-3 text-[12px]">
          <LedgerRow src="Paper" {...paper} /><LedgerRow src="Host Companion" {...host} />
          <div className="my-2 h-px bg-[rgb(var(--line)/0.1)]" />
          <div className="text-[rgb(var(--muted))]">Relay {conn.relay} · Signed Protocol {conn.protocol} · {conn.role} access</div>
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
const Seg = ({ label, s }: { label: string; s: Freshness }) => (
  <span className="inline-flex items-center gap-1.5" data-tone={s === 'live' ? 'emerald' : s === 'offline' ? 'rose' : 'amber'}>
    <i className="pp-dot" /><span className="pp-ledger__text text-[12px]">{label} <b className="font-semibold capitalize">{s}</b></span>
  </span>
);
```

The only place the words "Paper … Live … Host … Live" appear on any screen.

### 4.6 `MutationButton` - tooltip-gated, zero inline gate text

```tsx
// src/ui/primitives/MutationButton.tsx
type Props = { action: string; kind: string; icon: LucideIcon; label: string; tone?: Tone;
  foreground?: boolean; className?: string; args?: unknown };

export const MutationButton = forwardRef<HTMLButtonElement, Props>(function MutationButton(
  { action, kind, icon: Icon, label, tone, foreground, className, args }, ref) {
  const m = useMutation(action, kind);               // m.reason === null -> allowed
  const gated = m.reason !== null;
  const btn = (
    <button ref={ref} type="button" data-tone={tone} data-fg={foreground || undefined}
      aria-disabled={gated || undefined}                           // NOT `disabled`: stays focusable so the tooltip is keyboard reachable
      aria-description={gated ? m.reason! : undefined}
      onClick={() => { if (!gated) void m.begin(args); }}          // fail-closed: gated click is a hard no-op
      className={className}>
      <Icon className="size-3.5" strokeWidth={2} /><span>{label}</span>
    </button>
  );
  if (!gated) return btn;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{btn}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="bottom" sideOffset={8} className="pp-glass flex max-w-[260px] items-start gap-2 px-3 py-2 text-[12px] leading-snug">
          <Info className="mt-px size-3.5 shrink-0 text-[rgb(var(--amber))]" /><span>{m.reason}</span>
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
});
```

Never a `<p>`, never a sibling node, never `title=` only. The reason is read from `session.reason()` verbatim - do not paraphrase or cache it.

### 4.7 `PowerAndBackupGroup` - foregrounds the valid state action

```tsx
export function PowerAndBackupGroup({ phase }: { phase: Phase }) {
  const online = phase === 'online', offline = phase === 'offline';
  return (
    <div className="flex items-center gap-3">
      <div className="pp-power" role="group" aria-label="Server power">
        <MutationButton action="server.start"   kind="lifecycle" icon={Play}      label="Start"   tone="emerald" foreground={offline} />
        <MutationButton action="server.restart" kind="lifecycle" icon={RotateCw}  label="Restart" tone="amber"   foreground={online} />
        <MutationButton action="server.stop"    kind="lifecycle" icon={Square}     label="Stop"    tone="rose"    foreground={online} />
      </div>
      <MutationButton action="backup.quick" kind="backup" icon={ArchiveRestore} label="Quick Backup" tone="indigo"
        className="pp-ctl !border-[rgb(var(--indigo)/0.5)] !bg-[linear-gradient(180deg,rgb(var(--indigo)/0.9),rgb(var(--indigo)/0.65))] !text-white shadow-[0_6px_20px_-6px_rgb(var(--indigo)/0.8)]" />
    </div>
  );
}
```

Behavior matrix: online -> Restart/Stop foreground, Start collapses to a dimmed icon-only segment (tooltip carries "Start requires a confirmed stopped service."); offline -> Start foreground, Restart/Stop collapse; starting/stopping/unknown -> all three dimmed with their own gate reasons. **Header height is invariant at 56px in every state.** Action ids above are placeholders - use the real ids exported by the adapter.

---

## 5. Blueprint 2 - The 4-Cell Hairline Instrument Deck

One `.pp-deck`, four `.pp-cell`s, **148px tall**, 1px dividers produced by the deck `gap`. No cell borders, no radius, no repeated footers, no `min-height` overrides. Dead vertical space is impossible because the viz row is pinned to the cell bottom and the metric row is fixed-height.

```
┌───────────────────────┬───────────────────────┬───────────────────────┬───────────────────────┐
│ TICK PERFORMANCE   P• │ ONLINE PLAYERS     P• │ COMPUTE LOAD       H• │ MEMORY ALLOCATION  P• │
│ 20.00 TPS  [p95 11.1] │ 1 /10     [↗ peak 1]  │ 24.4 %    [of 1 core] │ 1.1 GiB    [28% heap] │
│                       │                       │                       │                       │
│ ▮▮▮▮▮▮▮▮▮▮▮▮▮ ·20.0   │ (☺)(+)  ▬▬▬▬▬▬▬▬▬▬▬▬▬  │ svc  ▬▬▬▬▬▬▬▬▬▬ 24.4% │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬  │
│ 9.9 ms mean · 50 budget│ capacity 1/10         │ node ▬▬▬▬▬▬▬▬▬▬  7.9% │ ● used ● commit ● cg  │
└───────────────────────┴───────────────────────┴───────────────────────┴───────────────────────┘
```

### 5.1 CSS

```css
@layer components {
  .pp-deck--instruments { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  @media (max-width: 1180px) { .pp-deck--instruments { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 560px)  { .pp-deck--instruments { grid-template-columns: minmax(0, 1fr); } }

  .pp-inst { display: grid; grid-template-rows: 16px 40px minmax(0, 1fr); row-gap: 6px;
    height: var(--cell-h); padding: 14px 16px 0; }                        /* rows: label / metric / viz-flush-bottom */
  .pp-inst__top   { display: flex; align-items: center; justify-content: space-between; }
  .pp-inst__metric { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
  .pp-inst__value { font-size: 28px; line-height: 1; font-weight: 600; }
  .pp-inst__unit  { font-size: 12px; color: rgb(var(--muted)); font-weight: 500; }
  .pp-inst__delta { margin-left: auto; align-self: center; }
  .pp-inst__viz   { align-self: end; margin: 0 -16px; padding: 0 16px 12px; min-height: 0; }  /* flush to cell edges */
  .pp-inst[data-stale="true"] .pp-inst__value { opacity: .55; }
  .pp-src { font: 600 9px/1 ui-monospace, monospace; letter-spacing: .06em; color: rgb(var(--faint)); display: inline-flex; gap: 4px; align-items: center; }
  .pp-src[data-stale="true"] { color: rgb(var(--amber)); }
}
```

### 5.2 Shared atoms

```tsx
// src/ui/instruments/atoms.tsx
export const SourceTag = ({ source, stale, ageS }: { source: Source; stale?: boolean; ageS?: number }) => (
  <span className="pp-src" data-stale={stale || undefined} data-tone={stale ? 'amber' : undefined}
        aria-label={`${source} source${stale ? `, stale ${ageS}s` : ''}`}>
    {stale ? <>stale {ageS}s</> : null}<i className="pp-dot" style={{ background: stale ? 'rgb(var(--amber))' : 'rgb(var(--faint))' }} />{source === 'paper' ? 'P' : 'H'}
  </span>
);

export function Instrument({ label, tone, source, value, unit, delta, children }: InstrumentProps) {
  const f = useLedger()[source];
  const stale = f.state !== 'live';
  return (
    <div className="pp-cell pp-inst" data-tone={tone} data-stale={stale || undefined}>
      <div className="pp-inst__top"><span className="pp-kicker">{label}</span><SourceTag source={source} stale={stale} ageS={Math.round(f.ageMs / 1000)} /></div>
      <div className="pp-inst__metric">
        <span className="pp-inst__value pp-num">{value}</span><span className="pp-inst__unit">{unit}</span>
        {!stale && delta && <span className="pp-tag pp-inst__delta">{delta}</span>}
      </div>
      <div className="pp-inst__viz">{children}</div>
    </div>
  );
}
```

### 5.3 `InstrumentDeck`

```tsx
export function InstrumentDeck() {
  const t = useTelemetry('1m'); const r = useRoster();
  return (
    <section className="pp-deck pp-deck--instruments" aria-label="Instruments">
      <Instrument label="Tick performance" tone="emerald" source="paper" value={fmt(t.tps.now, 2)} unit="TPS" delta={`p95 ${fmt(t.mspt.p95, 1)} ms`}>
        <EqualizerBars samples={t.tickSamples} target={20} />
        <div className="mt-1.5 flex justify-between text-[11px] text-[rgb(var(--muted))] pp-num"><span>{fmt(t.mspt.mean, 1)} ms mean</span><span>50 ms budget</span></div>
      </Instrument>
      <Instrument label="Online players" tone="cyan" source="paper" value={r.online} unit={`/ ${r.capacity}`} delta={`peak ${r.peak}`}>
        <AvatarStack players={r.players} max={6} /><CapacityTrack value={r.online} max={r.capacity} />
      </Instrument>
      <Instrument label="Compute load" tone="indigo" source="host" value={fmt(t.cpu.service, 1)} unit="%" delta={t.cpu.cores > 1 ? `of ${t.cpu.cores} cores` : 'of 1 core'}>
        <DualGauge rows={[{ label: 'svc', value: t.cpu.service, cores: t.cpu.cores }, { label: 'node', value: t.cpu.node, cores: t.cpu.cores }]} />
      </Instrument>
      <Instrument label="Memory allocation" tone="violet" source="paper" value={fmt(t.mem.heapUsedGiB, 1)} unit="GiB" delta={`${t.mem.heapPct}% heap`}>
        <SegmentedMemoryBar tiers={t.mem.tiers} max={t.mem.maxBytes} />
      </Instrument>
    </section>
  );
}
```

### 5.4 Embedded visualizations (all SVG/CSS, 44px max height, flush)

**EqualizerBars** - last 30 tick-window samples; bar height = TPS/20; bars under 20 TPS shift emerald -> amber (<19) -> rose (<15); dashed `20.0` reference line at the top with a 9px right-aligned label.

```tsx
export function EqualizerBars({ samples, target }: { samples: number[]; target: number }) {
  const n = 30, data = samples.slice(-n), W = 100, H = 28, gap = 1.4, bw = (W - gap * (n - 1)) / n;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-7 w-full" role="img" aria-label={`TPS history, target ${target}`}>
      <line x1="0" x2={W} y1="1" y2="1" stroke="rgb(var(--emerald)/.45)" strokeWidth=".5" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      {data.map((v, i) => {
        const h = Math.max(2, (Math.min(v, target) / target) * (H - 2)); const c = v >= 19 ? 'emerald' : v >= 15 ? 'amber' : 'rose';
        return <rect key={i} x={(n - data.length + i) * (bw + gap)} y={H - h} width={bw} height={h} rx=".8" fill={`rgb(var(--${c}) / ${.35 + .65 * (i / n)})`} />;
      })}
    </svg>
  );
}
```

**AvatarStack** - up to 6 overlapping 20px avatars (`-8px` margin, 2px `surface-1` ring) via `skinProvider` preference (fall back to initials on error), `+N` overflow chip, then **CapacityTrack**: 4px track, cyan fill `online/capacity`, tick for peak. **Zero players** renders a muted "No one online" micro-line in the same 44px slot (no layout jump).

**DualGauge** - two 4px rows `svc` / `node`; value 0-100% fills the base track (`indigo` / `cyan`); **burst support**: when `value > 100` (multi-core), the base track is full and a second overlay segment of width `(value-100)/(100*(cores-1))` renders in amber from the left with a `×N` micro-label. Row layout `grid-template-columns: 28px minmax(0,1fr) 44px` (label / track / `24.4%` tabular right-aligned).

**SegmentedMemoryBar** - one 6px rounded track, three **nested-by-extent** segments over one scale (`max`): `heap used` (violet 100%), `heap committed` (violet 45%), `cgroup` (indigo 50%); an `|` max marker; compact inline legend in a single 11px line: `● 1.1 used  ● 1.7 commit  ● 2.8 cg · max 4.0 GiB` (3 dots, no rows, no list). Total viz height 28px.

---

## 6. Blueprint 3 - De-Nested Telemetry Studio

One `.pp-pane`. Inside: head -> ribbon -> chart well. **No nested bordered rounded elements.**

```
┌ Telemetry Studio   [Tick & MSPT | Memory Tiers | CPU & Chunks]                  [1m 5m 15m 35m] [⤢] ┐ 44px
├──────────────────┬──────────────────┬──────────────────┬──────────────────┬──────────────────┤
▔▔▔▔▔▔▔▔ (2px glow on active series)
│ TPS              │ MEAN MSPT        │ P95 MSPT         │ P99 MSPT         │ GC PAUSES        │ ribbon: 64px
│ 20.0        ▁▁▂▁ │ 10.0 ms    ▂▃▂▃  │ 11.3 ms    ▂▅▃▆  │ —  ms            │ 0.0 ms  Δ  ▏▏▏▏  │
├──────────────────┴──────────────────┴──────────────────┴──────────────────┴──────────────────┤
│  TPS 20 ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  MSPT ms 60 │
│  ░░░ gradient area ░░░  ▒▒ p95–p99 band ▒▒   ╱╱╱ epoch gap ╱╱╱   - - - 50 ms budget - - -      │ full-bleed
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 6.1 CSS

```css
@layer components {
  .pp-studio { min-height: 430px; }
  .pp-studio .pp-pane__head { gap: 16px; }
  .pp-tabs { display: inline-flex; gap: 2px; padding: 2px; border-radius: 9px; background: rgb(var(--surface-3)); }
  .pp-tabs [role="tab"] { height: 26px; padding: 0 10px; border-radius: 7px; font-size: 12px; font-weight: 500; color: rgb(var(--muted)); }
  .pp-tabs [role="tab"][data-state="active"] { background: rgb(var(--surface-2)); color: rgb(var(--text)); box-shadow: inset 0 1px 0 rgb(255 255 255 / .08); }
  .pp-seg { display: inline-flex; border-radius: 8px; overflow: hidden; border: 1px solid rgb(var(--line) / .12); }
  .pp-seg button { height: 26px; padding: 0 9px; font: 600 11.5px/1 ui-monospace, monospace; color: rgb(var(--muted)); }
  .pp-seg button + button { border-left: 1px solid rgb(var(--line) / .12); }
  .pp-seg button[aria-pressed="true"] { background: rgb(var(--accent) / .14); color: rgb(var(--accent)); }

  .pp-metric { display: grid; grid-template-columns: minmax(0, 1fr) 56px; grid-template-rows: 14px 30px; column-gap: 8px; height: 64px; cursor: pointer; }
  .pp-metric:hover { background: rgb(var(--line) / .035); }
  .pp-metric__label { grid-column: 1 / -1; }
  .pp-metric__value { font-size: 22px; font-weight: 600; align-self: end; line-height: 1; }
  .pp-metric__unit  { font-size: 11px; color: rgb(var(--muted)); margin-left: 3px; font-weight: 500; }
  .pp-metric svg    { align-self: end; justify-self: end; width: 56px; height: 22px; }

  .pp-chart { position: relative; flex: 1; min-height: 300px; }
  .pp-chart svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
}
```

### 6.2 `TelemetryStudio`

```tsx
// src/ui/studio/TelemetryStudio.tsx
'use client';
const HORIZONS = ['1m', '5m', '15m', '35m'] as const;
const VIEWS = [{ id: 'tick', label: 'Tick & MSPT' }, { id: 'memory', label: 'Memory Tiers' }, { id: 'cpu', label: 'CPU & Chunks' }] as const;

export function TelemetryStudio({ expandHref = '/performance' }: { expandHref?: string }) {
  const [view, setView] = useState<'tick' | 'memory' | 'cpu'>('tick');
  const [win, setWin] = useState<typeof HORIZONS[number]>('15m');
  const [active, setActive] = useState<string>('tps');                   // metric ribbon doubles as series selector
  const t = useTelemetry(win);
  return (
    <section className="pp-pane pp-studio" aria-label="Telemetry studio">
      <header className="pp-pane__head">
        <h2 className="pp-pane__title">Telemetry Studio</h2>
        <Tabs.Root value={view} onValueChange={v => setView(v as typeof view)}>
          <Tabs.List className="pp-tabs" aria-label="Studio view">{VIEWS.map(v => <Tabs.Trigger key={v.id} value={v.id}>{v.label}</Tabs.Trigger>)}</Tabs.List>
        </Tabs.Root>
        <div className="ml-auto flex items-center gap-2">
          <div className="pp-seg" role="group" aria-label="Time horizon">
            {HORIZONS.map(h => <button key={h} aria-pressed={h === win} onClick={() => setWin(h)}>{h}</button>)}
          </div>
          <Link href={expandHref} className="pp-ctl !px-2" aria-label="Open Performance analyzer"><Maximize2 className="size-3.5" /></Link>
        </div>
      </header>
      <MetricRibbon t={t} active={active} onSelect={setActive} />
      <div className="pp-chart pp-well"><ChartDefs /><StudioChart view={view} t={t} active={active} win={win} /></div>
    </section>
  );
}
```

### 6.3 `MetricRibbon` (replaces 5 nested cards; zero `[PAPER]` badges)

```tsx
const METRICS = [
  { id: 'tps',   label: 'TPS',        tone: 'emerald', unit: '',   get: (t: TelemetryView) => t.tps },
  { id: 'mean',  label: 'Mean MSPT',  tone: 'cyan',    unit: 'ms', get: (t: TelemetryView) => t.mspt.meanSeries },
  { id: 'p95',   label: 'p95 MSPT',   tone: 'violet',  unit: 'ms', get: (t: TelemetryView) => t.mspt.p95Series },
  { id: 'p99',   label: 'p99 MSPT',   tone: 'amber',   unit: 'ms', get: (t: TelemetryView) => t.mspt.p99Series },
  { id: 'gc',    label: 'GC pauses',  tone: 'rose',    unit: 'ms', get: (t: TelemetryView) => t.gc },
] as const;

export function MetricRibbon({ t, active, onSelect }: { t: TelemetryView; active: string; onSelect(id: string): void }) {
  return (
    <div className="pp-ribbon" role="tablist" aria-label="Series">
      {METRICS.map(m => {
        const s = m.get(t); const isActive = active === m.id;
        return (
          <button key={m.id} role="tab" aria-selected={isActive} data-active={isActive} data-tone={m.tone} onClick={() => onSelect(m.id)}
                  className="pp-metric text-left">
            <span className="pp-kicker pp-metric__label">{m.label}</span>
            <span className="pp-metric__value pp-num">{s.now == null ? '—' : fmt(s.now, 1)}<span className="pp-metric__unit">{m.unit}</span></span>
            {m.id === 'gc' ? <GcTicks series={s.series} /> : <Sparkline series={s.series} tone={m.tone} dim={!isActive} />}
          </button>
        );
      })}
    </div>
  );
}
```

`—` for unavailable p99 (no sample window): the cell renders no sparkline (not an empty dashed box). `Sparkline` is a 56x22 SVG polyline with gradient fill; **`GcTicks`** is vertical rose ticks.

### 6.4 `ChartDefs` - gradients, band, hatch (rendered once, referenced by id)

```tsx
export function ChartDefs() {
  const fill = usePrefs().chartFill;   // use the real union from preferences.ts, e.g. 'gradient' | 'flat' | 'none'
  const a = fill === 'none' ? 0 : fill === 'flat' ? .16 : .38;
  const stops = (c: string) => (<><stop offset="0%" stopColor={`rgb(var(--${c}))`} stopOpacity={a} /><stop offset="55%" stopColor={`rgb(var(--${c}))`} stopOpacity={a * .35} /><stop offset="100%" stopColor={`rgb(var(--${c}))`} stopOpacity="0" /></>);
  return (
    <svg width="0" height="0" aria-hidden style={{ position: 'absolute' }}>
      <defs>
        {(['emerald', 'cyan', 'violet', 'amber', 'rose', 'indigo'] as const).map(c =>
          <linearGradient key={c} id={`pp-grad-${c}`} x1="0" y1="0" x2="0" y2="1">{stops(c)}</linearGradient>)}
        <linearGradient id="pp-band-p95p99" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgb(var(--violet))" stopOpacity=".28" /><stop offset="1" stopColor="rgb(var(--violet))" stopOpacity=".08" /></linearGradient>
        <pattern id="pp-hatch-gap" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="7" height="7" fill="rgb(var(--rose)/.04)" /><line x1="0" y1="0" x2="0" y2="7" stroke="rgb(var(--rose)/.35)" strokeWidth="1.2" />
        </pattern>
        <filter id="pp-glow" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
    </svg>
  );
}
```

### 6.5 `StudioChart` - full-bleed canvas contract

Implementation rules (write a ~150-line component; no chart lib needed):

- `ResizeObserver` on `.pp-chart` -> `{w,h}`; margins `{l:44, r:44, t:16, b:22}`; x = time (`now-win` .. `now`), left y = TPS (domain 15-20, ticks 15/20), right y = MSPT ms (domain 0-60, ticks 0/15/30/45/60). Axis labels 10px `--faint`; gridlines 1px `rgb(var(--line)/.06)`; **no outer border and no radius on the canvas**.
- **Data arrives pre-split into segments by boot epoch** (`t.segments: Array<{ epochId; points }>`). Draw each segment as its own path - **never connect across an epoch gap**. Between segments draw `<rect fill="url(#pp-hatch-gap)">` spanning the gap plus a 1px rose dashed boundary and a 10px label `restart · epoch 9a4f6484`.
- Layers (z-order): gridlines -> gap hatch -> **p95-p99 band** (`path` between the p95 and p99 series, `url(#pp-band-p95p99)`) -> area fills (`url(#pp-grad-<tone>)`) -> lines (1.75px, `filter="url(#pp-glow)"` for the active series only; inactive series at 40% opacity) -> **50 ms budget line** (right-axis y(50), dashed, amber `.7`, label `50 ms budget` left-aligned above the line) -> crosshair + tooltip.
- Line smoothing: monotone-X cubic only (no overshoot); when `motion==='reduced'` skip draw-in animation, otherwise animate `stroke-dashoffset` once on mount (600ms).
- Crosshair: pointermove snaps to nearest sample, renders a 1px vertical hairline and a `.pp-glass` readout (`HH:mm:ss` in the **timezone preference**) with all five metric values. Tooltip clamps inside the canvas.
- Empty/stale: if Paper is not `live`, overlay a centered 12px muted label `Paper telemetry stale — showing last known window` at the top-left of the canvas and desaturate lines to 55% (no banner box).
- Accessibility: `role="img"` + `aria-label` summarizing current/min/max; a visually-hidden `<table>` of the latest 20 samples.
- Views: `memory` -> stacked-by-extent tiers (heap used / committed / cgroup, with max line); `cpu` -> service vs node CPU on left axis + loaded chunks/entities on right axis. Same layers, same ribbon (swap `METRICS` per view via a `METRICS_BY_VIEW` map; the ribbon is always 5 cells).

---

## 7. Blueprint 4 - Ergonomic Wide-Ratio Live Console

Root cause of the 6-line towers: (1) the console lived in a ~380px column; (2) every row spent ~150px on `INFO` + `Server` + a bare timestamp column; (3) the formatter allowed no break opportunities inside `[/168.194.144.215:33319]` or `([minecraft:overworld]454.33…, 73.0, 1168.18…)` so the browser broke mid-token by character. Fix all three.

### 7.1 Row anatomy and grid definitions

```
Compact (Overview dock, pane ≈ 880–940px wide at 1545 viewport):
  columns: 56px   12px   minmax(0,1fr)
          [time] [sev•] [ <PluginChip/>? message… ]
  01:56:31  ●   NEGUINCOMCEROL[/168.194.144.215:33319] logged in with entity id 186275 at
                ([minecraft:overworld]454.3393893031386, 73.0, 1168.182264153791)         ← 2 lines max

Full (/console, ≥1280px wide):
  columns: 68px   44px      auto-chip    minmax(0,1fr)  → expressed as 3 tracks (chip is inline inside track 3)
          [time] [sev tag] [ chip + message… ]
```

```css
@layer components {
  .pp-console { container-type: inline-size; font: 12px/1.45 ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace; letter-spacing: -.012em; }
  .pp-crow { display: grid; align-items: start; column-gap: 8px; padding: 1px 14px; min-height: 20px; }
  .pp-console[data-mode="compact"] .pp-crow { grid-template-columns: 56px 12px minmax(0, 1fr); }
  .pp-console[data-mode="full"]    .pp-crow { grid-template-columns: 68px 44px minmax(0, 1fr); }
  .pp-crow:hover { background: rgb(var(--line) / .045); }
  .pp-crow__t   { color: rgb(var(--faint)); font-variant-numeric: tabular-nums; padding-top: 1px; user-select: none; }
  .pp-crow__sev { display: flex; justify-content: center; padding-top: 7px; }              /* compact: 6px dot only */
  .pp-console[data-mode="full"] .pp-crow__sev { justify-content: flex-start; padding-top: 1px; }
  .pp-crow__msg { min-width: 0; overflow-wrap: anywhere; word-break: normal; text-wrap: pretty; white-space: pre-wrap; hyphens: manual; }
  .pp-crow[data-sev="warn"]  .pp-crow__msg { color: rgb(var(--amber)); }
  .pp-crow[data-sev="error"] .pp-crow__msg { color: rgb(var(--rose)); }
  .pp-crow[data-sev="error"] { background: rgb(var(--rose) / .06); box-shadow: inset 2px 0 0 rgb(var(--rose)); }
  .pp-crow[data-sev="warn"]  { box-shadow: inset 2px 0 0 rgb(var(--amber) / .7); }
  .pp-chip { display: inline-flex; vertical-align: baseline; height: 16px; padding: 0 5px; margin-right: 6px; border-radius: 5px;
    font: 600 10px/16px ui-monospace, monospace; background: rgb(var(--tone) / .13); color: rgb(var(--tone)); max-width: 120px; overflow: hidden; text-overflow: ellipsis; }
  @container (max-width: 520px) { .pp-console[data-mode="compact"] .pp-crow { grid-template-columns: 12px minmax(0, 1fr); } .pp-console .pp-crow__t { display: none; } }
}
```

### 7.2 Collapse rules (the "boilerplate token")

| Source/severity | Compact render | Full render |
|---|---|---|
| `INFO` + source `Server` (the default) | dot only (`--faint`), **no chip, no "INFO", no "Server"** | dot + `INFO` in 10px faint (no chip) |
| `INFO` + plugin source (EssentialsX, LuckPerms…) | dot + `PluginChip` | tag + `PluginChip` |
| `WARN` | amber dot + amber row accent | amber `WARN` tag |
| `ERROR` | rose dot + rose row wash | rose `ERROR` tag |
| Stack-trace continuation lines | no time/sev, indented 12px, `--muted` | same |

Colors for plugin chips: stable hash of the plugin name -> one of `cyan|violet|indigo|emerald` (never amber/rose - reserved for severity).

### 7.3 Soft-break formatter (`src/ui/console/softBreak.ts`)

Run **after** `src/lib/textFormat` produces its tokens: walk text nodes only and inject `<wbr/>` so wrapping occurs at semantic boundaries instead of mid-token.

```ts
const BREAK_AFTER = /([\/,:\]\)\[=&?_-])(?=[^\s])/g;           // after / , : ] ) [ = & ? _ -
const BREAK_DIGITS = /(\d{6})(?=\d)/g;                          // long float tails: break every 6 digits
export const softBreak = (s: string) =>
  s.replace(BREAK_AFTER, '$1\u200B').replace(BREAK_DIGITS, '$1\u200B');   // U+200B ZWSP: no markup, copy-safe via onCopy strip
```

Strip U+200B in the row's `onCopy` handler so copied logs stay exact. Do not alter stored message content.

### 7.4 `LiveConsole`, `ConsoleRow`, `PluginChip`

```tsx
// src/ui/console/LiveConsole.tsx   (used compact in Overview, full in /console)
export function LiveConsole({ mode, filters }: { mode: 'compact' | 'full'; filters: ConsoleFilters }) {
  const { lines, loadEarlier, hasEarlier, streaming } = useConsoleStream();     // memory only - NO browser storage
  const rows = useMemo(() => applyFilters(lines, filters), [lines, filters]);
  const parentRef = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({ count: rows.length, getScrollElement: () => parentRef.current, estimateSize: () => 20, overscan: 24, measureElement: el => el.getBoundingClientRect().height });
  const stick = useStickToBottom(parentRef, rows.length);                        // pauses when user scrolls up; "Jump to latest" chip appears
  return (
    <div className="pp-console flex min-h-0 flex-1 flex-col" data-mode={mode}>
      {hasEarlier && <button className="pp-ctl m-2 self-start text-[12px]" onClick={loadEarlier}>Load earlier from this boot</button>}
      <div ref={parentRef} className="pp-well min-h-0 flex-1 overflow-auto py-1.5" role="log" aria-live={stick.pinned ? 'polite' : 'off'}>
        <div style={{ height: v.getTotalSize(), position: 'relative' }}>
          {v.getVirtualItems().map(vi => (
            <div key={rows[vi.index].id} data-index={vi.index} ref={v.measureElement} style={{ position: 'absolute', inset: '0 0 auto 0', transform: `translateY(${vi.start}px)` }}>
              <ConsoleRow line={rows[vi.index]} mode={mode} />
            </div>))}
        </div>
      </div>
      {!stick.pinned && <button className="pp-glass absolute bottom-14 right-4 px-3 py-1.5 text-[12px]" onClick={stick.jump}>Jump to latest ↓</button>}
    </div>
  );
}

export const ConsoleRow = memo(function ConsoleRow({ line, mode }: { line: ConsoleLine; mode: 'compact' | 'full' }) {
  const boilerplate = line.sev === 'info' && line.source === 'Server';
  return (
    <div className="pp-crow" data-sev={line.sev} onCopy={stripZwsp}>
      <time className="pp-crow__t" dateTime={line.iso}>{fmtTime(line.ts, usePrefs().timezone)}</time>
      <span className="pp-crow__sev">
        {mode === 'full' && line.sev !== 'info' ? <span className="pp-tag" data-tone={SEV_TONE[line.sev]}>{line.sev.toUpperCase()}</span>
         : mode === 'full' ? <span className="text-[10px] text-[rgb(var(--faint))]">INFO</span>
         : <i className="pp-dot" data-tone={line.sev === 'info' ? undefined : SEV_TONE[line.sev]} style={line.sev === 'info' ? { background: 'rgb(var(--faint))' } : undefined} />}
      </span>
      <span className="pp-crow__msg">
        {!boilerplate && <PluginChip name={line.source} />}
        {renderMc(softBreak, line.text)}   {/* src/lib/textFormat tokens -> spans, with softBreak applied to text nodes */}
      </span>
    </div>
  );
});

export const PluginChip = ({ name }: { name: string }) => <span className="pp-chip" data-tone={hashTone(name)} title={name}>{name}</span>;
```

### 7.5 `CommandComposer` (sticky bottom, Warp-style)

```tsx
export function CommandComposer() {
  const m = useMutation('console.command', 'command');          // real action id from adapter
  const [text, setText] = useState(''); const hist = useRef<string[]>([]); const idx = useRef(-1);   // history in MEMORY only
  const gated = m.reason !== null;
  return (
    <form className="sticky bottom-0 flex items-center gap-2 border-t border-[rgb(var(--line)/0.10)] bg-[rgb(var(--surface-1)/0.9)] px-3 py-2 backdrop-blur"
          onSubmit={e => { e.preventDefault(); if (gated || !text.trim()) return; hist.current.unshift(text); idx.current = -1; void m.begin({ command: text }); setText(''); }}>
      <span className="font-mono text-[12px] text-[rgb(var(--accent))]">›</span>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <input value={text} onChange={e => setText(e.target.value)} aria-disabled={gated || undefined} readOnly={gated}
            placeholder={gated ? 'Console commands unavailable' : 'Run a console command…  (↑ history · ⏎ review & send)'}
            onKeyDown={e => { if (e.key === 'ArrowUp') { idx.current = Math.min(idx.current + 1, hist.current.length - 1); setText(hist.current[idx.current] ?? ''); e.preventDefault(); } }}
            className="h-8 min-w-0 flex-1 bg-transparent font-mono text-[12.5px] outline-none placeholder:text-[rgb(var(--faint))]" />
        </Tooltip.Trigger>
        {gated && <Tooltip.Portal><Tooltip.Content className="pp-glass px-3 py-2 text-[12px]" side="top">{m.reason}</Tooltip.Content></Tooltip.Portal>}
      </Tooltip.Root>
      <button className="pp-ctl" aria-disabled={gated || !text.trim() || undefined}><CornerDownLeft className="size-3.5" />Send</button>
    </form>
  );
}
```

Every command still goes `session.prepare -> ActionReview -> session.execute` (review policy decides if a confirm step is shown). The Overview dock embeds the console **without** the composer (a "Open console ↗" link in the pane head instead).

---

## 8. Route-by-route structural wireframes and grid specs

### 8.0 App Router skeleton (recreated from scratch)

```
app/
  layout.tsx              // <html data-theme data-accent data-density data-text-size data-motion>, fonts, <Providers/>
  page.tsx                // redirect('/overview')
  (gate)/pair/page.tsx    // PairingGate (no AppShell)
  (workspace)/layout.tsx  // <AuthBoundary><AppShell>{children}</AppShell></AuthBoundary>  -> unpaired => /pair
  (workspace)/{fleet,overview,performance,players,console,backups,access,settings}/page.tsx
```

`AuthBoundary` reads credential presence from `src/adapter` (IndexedDB `plexonpanel-browser-v3`); it never reads or writes storage itself. Every `page.tsx` is a thin client component rendering `src/ui/routes/<Route>.tsx`. Set `document.title = "<Route> · <Server> · PlexonPanel"`.

Page canvas helpers (shared): `.pp-page { display: grid; gap: 16px; align-content: start; }` - gap between sibling Decks/Panes is 16px, always.

### R01 · Fleet - node ledger strip + instance blades

```
┌ DECK (hardware ledger, one cell per VPS node) ──────────────────────────────────────────────┐
│ node-sp-01  Host 1.4.2 ● │ CPU ▬▬▬▬ 31% │ MEM ▬▬▬▬ 5.2/8 GiB │ DISK ▬▬ 44% │ 3 instances  │   ← 1 cell/node, 72px
├─────────────────────────────────────────────────────────────────────────────────────────────┤
 blades (grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px)
 ┌ .pp-card ────────────────┐ ┌ .pp-card ────────────────┐
 │ ◉ TonimSMP   online      │ │ ◉ Creative    offline    │   blade = ONE .pp-card, internals hairline-divided
 │ Paper 26.3 · 1/10 · 20.0 │ │ Paper 26.2 · —           │   (head / 3-stat row / 24px sparkline), no inner boxes
 │ ▁▂▂▃▂▂▁▂▃  (TPS)         │ │                          │
 └──────────────────────────┘ └──────────────────────────┘
```

- Ledger deck: `.pp-deck` with `grid-template-columns: repeat(auto-fit, minmax(360px, 1fr))`; each node is a `.pp-cell` (height 72px): left identity, then 3 inline `MiniBar`s (label / 4px track / value). Groups instances **by node** via the selectors; host-down nodes show their cell in `amber` tone with the blades beneath dimmed.
- Blade click -> set active server, navigate `/overview`. Blades never contain `.pp-card`/`.pp-pane`.

### R02 · Overview - Mission deck

```
 MissionControlHeader (global, 56px)
 ┌ DECK · InstrumentDeck · 4 cells · 148px ─────────────────────────────────────────────────┐
 └───────────────────────────────────────────────────────────────────────────────────────────┘
 ┌ PANE · Telemetry Studio · min-height 430px (full width) ─────────────────────────────────┐
 └───────────────────────────────────────────────────────────────────────────────────────────┘
 ┌ PANE · Console dock (62%) ───────────────────────────┐ ┌ PANE · Roster + Worlds (38%) ──┐
 │ [Console | Player events]   filters   ⤢ Open console │ │ Active roster · 1 / 10         │
 │ 01:56:31 ● NEGUINCOMCEROL[/168.194.144.215:33319]…   │ ├────────────────────────────────┤  ← hairline split,
 │ 01:56:31 ● lost connection: Disconnected             │ │ Worlds                         │    not 2 nested boxes
 └──────────────────────────────────────────────────────┘ └────────────────────────────────┘
```

```css
.pp-overview { display: grid; gap: 16px; grid-template-rows: auto auto minmax(380px, 1fr); }
.pp-dock     { display: grid; gap: 16px; grid-template-columns: minmax(0, 1.62fr) minmax(300px, 1fr); min-height: 380px; }
@media (max-width: 1100px) { .pp-dock { grid-template-columns: minmax(0, 1fr); } }
```

- At 1545px viewport: canvas 1481 - 48 gutters = 1433; dock console pane ≈ 874px -> message track ≈ 780px ≈ 108 mono chars -> the 112-char join/coordinates line wraps to **2 lines max**.
- Dock left pane head: Radix Tabs `Console | Player events` + severity segmented filter `All · Info · Warn · Error` (counts as plain numbers, no colored count pills) + filter input (32px) + `Open console ↗`. **Player event stream** = join/leave/death/advancement rows using the same `.pp-crow` grid (compact), source chip omitted.
- Right pane: head `Active roster` + `1 / 10`; body = 36px rows (avatar 20px, name, ping dot, session time); `border-top` hairline then `Worlds` section = 32px rows (name, environment tone dot, loaded chunks, entities, players). One `.pp-pane`, two sections.
- Overview shows **no page title bar** - the header and instrument deck are the page identity.

### R03 · Performance - synchronized multi-track analyzer

```
 ┌ PANE ─────────────────────────────────────────────────────────────────────────────────────┐
 │ Analyzer   [1m 5m 15m 35m 2h]   [Pause ⏸]  [Raw samples ⤓]                              │ head
 ├ ribbon (flush, 5–6 metrics, selectable, values at crosshair when hovering) ──────────────┤
 │ track 1  Tick & MSPT       (140px)  area+band+budget line                                │
 │ ─────────────────────────────────────────────────────────────────────────────────────────│ hairline
 │ track 2  GC pauses          (72px)  rose ticks                                           │
 │ track 3  Memory tiers      (120px)  stacked-by-extent                                    │
 │ track 4  CPU service/node  (110px)  burst-aware                                          │
 │ track 5  Chunks / entities (110px)                                                       │
 │ shared x-axis (timezone pref) ───────────────────────────────────────────────────────────│
 └───────────────────────────────────────────────────────────────────────────────────────────┘
        raw sample drawer: Radix Dialog as right drawer (480px) with virtualized table
```

- All tracks share ONE x-scale and ONE crosshair via a `CrosshairContext`; hovering any track draws the vertical hairline across all and fills the ribbon with the sampled values. Tracks are separated by hairlines inside one pane (no per-track boxes). Epoch gaps hatched across **all** tracks at the same x-range.
- Raw sample drawer: columns `time · epoch · TPS · mean · p95 · p99 · GC · heap used · cpu`; sticky head; CSV export builds client-side from memory.

### R04 · Players - master-detail workbench

```css
.pp-players { display: grid; grid-template-columns: minmax(340px, 440px) minmax(0, 1fr); gap: 16px; height: calc(100dvh - var(--hdr-h) - 52px); }
@media (max-width: 1280px) { .pp-players { grid-template-columns: minmax(0, 1fr); } /* inspector becomes a Radix Dialog slide-over (right, 520px) */ }
```

```
 ┌ PANE · Roster ───────────────────────┐ ┌ PANE · Inspector ─────────────────────────────────────────────┐
 │ [🔍 Search name / UUID]   [Online|All] │ │ (☺) NEGUINCOMCEROL            ● online · session 00:14:03      │
 ├ live roster (virtualized, 44px rows) ─┤ │ UUID  8f3c…-…-…  [copy]  [exact, monospace, selectable]         │
 │ (☺) NEGUINCOMCEROL     ● 38ms    14m │ ├ tabs: Overview | Sessions | Actions ─────────────────────────────┤
 ├ boot-session timeline ────────────────┤ │ Overview: position, world, gamemode, ping sparkline            │
 │ ── epoch 9a4f6484 (this boot) ──────  │ │ Sessions: joins/leaves from player-history.ts (gap-aware)       │
 │ 01:56:31 ▶ NEGUINCOMCEROL joined      │ │ Actions: kick / message / etc via playerCommands.ts →          │
 │ ── epoch 77c0be12 (previous boot) ─── │ │          MutationButton (gated tooltips) → ActionReview        │
 └───────────────────────────────────────┘ └────────────────────────────────────────────────────────────────┘
```

- Left pane: head (search + segmented filter), roster list (`flex:1`), then hairline, then the join/leave timeline with **epoch separators** (`── epoch <8hex> ──` row, 24px, centered, muted) so restarts never visually merge sessions.
- Inspector shows the **exact full UUID** (never truncated; `user-select: all`), skin via `skinProvider`, and all actions through `src/lib/playerCommands.ts`. Empty state (no selection): centered 13px muted line "Select a player", no illustration box.

### R05 · Console & Chat - full-viewport docked terminal IDE

`PageCanvas data-bleed="true"` (zero padding, no page scroll). One pane that is the whole viewport:

```css
.pp-ide { display: grid; grid-template-rows: 36px 44px minmax(0, 1fr) auto; height: 100%; border: 0; border-radius: 0; box-shadow: none; }
```

```
 ┌ row 1 (36px)  boot-epoch status bar ──────────────────────────────────────────────────────────┐
 │ epoch 9a4f6484 · booted 13:12 · 184 lines · ● streaming      [Console | Chat | Plugins]        │
 ├ row 2 (44px)  filter ribbon ───────────────────────────────────────────────────────────────────┤
 │ [All 184 · Info 174 · Warn 10 · Error 0]  [🔍 filter…  regex ⌥R]  [Plugin ▾]  [Wrap ⌥Z] [⤓]  │
 ├ row 3 (1fr)   virtualized stream, 1 line per entry, mode="full" grid (68px 44px 1fr) ─────────┤
 ├ row 4 (auto)  CommandComposer (sticky) ────────────────────────────────────────────────────────┤
```

- **Console** sub-pane = `LiveConsole mode="full"`. **Chat** sub-pane = same grid with `[time][·][ <player> message ]` rows (player name colored from the Minecraft formatter), composer sends chat via its own gated action. **Plugins** sub-pane = inventory table (name, version, enabled dot, authors) in the `.pp-well` with a sticky head; no cards.
- Chat and console are **memory-only**: reload clears them; the `Load earlier from this boot` button re-requests via the adapter (still memory-only). No `localStorage`, `sessionStorage`, or IndexedDB writes in this subtree (verify-purge enforces it).
- Shortcuts: `/` focus filter, `⌘/Ctrl+L` clear view (view only), `End` jump to latest.

### R06 · Backups - pipeline rail + schedule deck + restore ledger

```
 ┌ PANE · Pipeline ──────────────────────────────────────────────────────────────────────────┐
 │ ①──②──③──④──⑤──⑥──⑦──⑧──⑨──⑩──⑪──⑫──⑬──⑭   (14 stages; names from the adapter's stage enum)   │
 │ ●━━━●━━━●━━━◉ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄    "Stage 4 / 14 · Archiving world" · elapsed 00:41           │
 └───────────────────────────────────────────────────────────────────────────────────────────┘
 ┌ DECK (2 cells, 1px divider) ──────────────────────────────────────────────────────────────┐
 │ Manual                                   │ Periodic · Google Drive                         │
 │ [Quick Backup]  scope · retention note   │ every 6h · next 18:00 · retention 14 · [Edit]    │
 └──────────────────────────────────────────┴─────────────────────────────────────────────────┘
 ┌ PANE · Restore points (ledger table) ─────────────────────────────────────────────────────┐
 │ Created · Kind (manual/periodic) · Size · Destination · ✔ Verified · Restore ▸             │
 └───────────────────────────────────────────────────────────────────────────────────────────┘
```

- Rail: `display: grid; grid-template-columns: repeat(14, minmax(0, 1fr))`; done = accent filled node + solid connector, current = pulsing ring (`pp-ring`), pending = hairline dot + dashed connector. Under 900px: show only current ±1 with `…` and the "Stage n / 14" text. Stage labels live in tooltips (`aria-label`), the active label in the caption line.
- Schedule deck: `grid-template-columns: repeat(2, minmax(0,1fr))` -> `1fr` under 900px. Editing uses the standard `ActionReviewModal`. Restore is a destructive `MutationButton` (rose) and **always** shows the full review (review-policy override).
- Ledger: row 40px, `✔ verified` as emerald check icon + `aria-label` (no badge pill); unverified = muted dash.

### R07 · Access & Audit - 3-pane security workbench

```css
.pp-access { display: grid; grid-template-columns: minmax(280px, 340px) minmax(0, 1fr) minmax(340px, 440px); gap: 16px; height: calc(100dvh - var(--hdr-h) - 52px); }
@media (max-width: 1360px) { .pp-access { grid-template-columns: minmax(280px, 340px) minmax(0, 1fr); } .pp-access > :last-child { grid-column: 1 / -1; height: 420px; } }
@media (max-width: 860px)  { .pp-access { grid-template-columns: minmax(0, 1fr); height: auto; } }
```

- **Paired devices (blades pane):** each device is a 64px hairline-separated row (not a card): icon, label, last seen, fingerprint (`ed25519:ab12…`), `current` micro-tag on this browser, `Revoke` (gated, rose).
- **Scope authority matrix (center):** rows = scopes/actions, columns = roles/devices; cell = 28px toggle glyph; hover shows the gate/authority tooltip; editing batches into one `session.prepare` and one `ActionReview`. Sticky first column + sticky head inside a `.pp-well`.
- **Audit ledger (right):** dual-source - segmented `All · Panel · Host`; each entry shows time (timezone pref), actor, action, result, and a single-letter source tag (`P`/`H`, never full words) and a chain-verified check; virtualized, 36px rows; filter input in head.

### R08 · Settings - preference studio (exactly the 8 locked keys)

```css
.pp-settings { display: grid; grid-template-columns: minmax(0, 560px) minmax(0, 1fr); gap: 16px; align-items: start; }
.pp-settings__preview { position: sticky; top: 0; }
@media (max-width: 1100px) { .pp-settings { grid-template-columns: minmax(0, 1fr); } .pp-settings__preview { position: static; order: -1; } }
```

- Left `.pp-pane`: sections separated by hairlines (`Appearance: theme, accent, density, textSize` · `Motion & charts: motion, chartFill` · `Time & identity: timezone, skinProvider`). Each row: label + helper line (left), control (right, 32px): `theme` segmented (System/Dark/Light), `accent` 6 swatches (24px, ring on selected), `density` segmented, `textSize` segmented, `motion` segmented, `chartFill` segmented with 24px glyph previews, `timezone` combobox (cmdk, searchable IANA list, "Browser (America/Sao_Paulo)" first), `skinProvider` select (+ live avatar sample).
- Right sticky `.pp-pane` **live preview**: renders a miniature real `InstrumentDeck` (static sample data) + a 160px `StudioChart` fed by a fixed sample series, + 3 console rows, all using the *actual* components so changes show instantly. Preview content never touches real telemetry.
- Writes go through `usePrefs().set()` only; no "Save" button (instant apply, `aria-live` "Saved" micro-toast).

### 8.9 PairingGate (outside the shell)

Full-screen `bg-[rgb(var(--bg))]` + radial accent glow. Centered `.pp-glass` panel `w-[440px]`, three hairline-separated sections: (1) brand + "Pair this browser" kicker, (2) **6-cell OTP input** (6 independent 48x56px inputs, paste-fills all, auto-advance, `inputmode="numeric"`, `autocomplete="one-time-code"`), (3) status line + `Claim device` button. Flow: submit -> adapter `/v1/pairings/claim` -> Ed25519 keypair generated + stored by the adapter in IndexedDB `plexonpanel-browser-v3` -> redirect `/overview`. States: idle / claiming (spinner inside button, inputs readOnly) / error (inline 12px rose line **inside the section, single line**, cells shake once unless `motion=reduced`) / expired code (offer "Request new code" text link). No marketing copy, no extra cards.

### 8.10 ActionReviewModal (single global host)

Radix `Dialog` + `.pp-glass`, `w-[min(560px,92vw)]`. Structure (hairline-separated, zero nested boxes):

```
 ┌ head: icon · "Review: Restart server"  · risk tone dot (from review-policy)                   ┐
 ├ summary: plain-language effect (1–2 lines)                                                       │
 ├ details: definition-list rows (Target · Scope · Affected players · Reversible?)                  │
 ├ warnings (only if present): amber list rows with ⚠ glyphs, no yellow boxes                        │
 ├ foot: [Cancel]                                                    [Confirm & execute (tone)]     ┘
```

- Opened only by `useMutation().begin()` after `session.prepare` resolves with an `ActionReview`; `Confirm` calls `session.execute` with the **review token** from prepare; if the review expires or authority freshness degrades mid-review (`useLedger()` leaves `live`), disable Confirm via `aria-disabled` and show the reason in a Tooltip (fail-closed).
- Destructive tone = rose confirm button; focus starts on **Cancel** for destructive actions, on Confirm otherwise. `Esc` cancels. Execution progress: confirm button shows spinner; result appears as a one-line toast (`aria-live`), never a modal-in-modal.

---

## 9. The "Anti-Card-Soup and Structural Harmony" QA checklist (25 invariants)

Run every check at viewports **1545x911**, **1280x800**, **1920x1080** and (for #22) **390x844**, in dark and light theme, with a seeded telemetry fixture that includes: one online server, one epoch gap, a 112-char join log line, a stale Host clock scenario, and a gated-Start scenario. **All 25 must pass before packaging.** Failing any = fix, re-run, never waive.

| # | Invariant | Pass condition |
|---|---|---|
| 1 | No nested boxes | `noNestedBoxes()` (below) returns `[]` on every route |
| 2 | Source-badge budget | text `PAPER` appears <= 1x, `HOST` <= 1x per screen; zero `PAPER`/`HOST` inside `.pp-cell`, `.pp-ribbon`, `.pp-inst` |
| 3 | Live budget | text `Live` <= 2 matches per screen (ledger pill only); no `• Live` anywhere else |
| 4 | Healthy = silent | with all clocks live, no `stale` text and no amber source tags in the Instrument Deck |
| 5 | Zero inline gate paragraphs | no element matching `.gate-reason` or any `<p>` adjacent to a `[aria-disabled]` lifecycle button; gate reason only inside a Tooltip |
| 6 | Header invariance | `header[role=banner]` height == 56px in online/offline/starting/stopping/unknown states and with Start gated |
| 7 | Gate tooltip works | focus (Tab) on dimmed Start shows its exact `session.reason()` text; click does not call `session.prepare` |
| 8 | Valid action foregrounded | online -> Restart+Stop `data-fg=true`, Start collapsed icon-only; offline -> Start `data-fg=true` |
| 9 | Compact rail | `.pp-rail` width == 64px by default; 220px only after toggle; `G`,`2` navigates to /overview; tooltip shows `G 2` |
| 10 | Width recovered | at 1545 viewport, main canvas content width >= 1425px (old layout: ~1250) |
| 11 | Instrument deck geometry | exactly 4 `.pp-cell` in `.pp-deck--instruments`, each `getBoundingClientRect().height == 148` at >=1180px; no cell has a border or radius |
| 12 | Hairline dividers | deck cell gap computes to 1px; deck `background` hairline alpha between .08 and .12; no per-cell `border-width > 0` |
| 13 | Instrument anatomy | each cell has label, source dot, one 28px value, unit, and a viz whose bottom is within 12px of the cell bottom (no dead zone > 24px between metric row and viz) |
| 14 | Studio de-nesting | `.pp-studio` contains exactly 1 bordered-radius element (itself); the 5 `.pp-metric` have `border-width: 0` except ribbon dividers (left 1px) |
| 15 | Ribbon + indicator | exactly 5 metric cells; exactly 1 has `data-active=true` with a `::before` 2px indicator; `—` p99 renders no empty dashed box |
| 16 | Chart canvas integrity | chart SVG fills `.pp-chart` (diff <= 1px); contains `linearGradient`, p95-p99 band path, 50 ms budget line, and hatched gap `rect` where the fixture has an epoch gap; **no path crosses the gap x-range** |
| 17 | Console wrap | at 1545px Overview, the fixture 112-char coords line occupies **<= 2 lines** (`rowHeight <= 2*line-height+4`); at 1920px **<= 2**; at `/console` 1545px **1 line** for the fixture's <= 130-char lines |
| 18 | Boilerplate collapsed | no row in compact mode renders text `INFO` or `Server` for `info`+`Server` lines; plugin lines show a `.pp-chip` |
| 19 | Message width share | in compact mode, the message track is >= 80% of the row width (`msg.width / row.width >= .80`) |
| 20 | Console IDE | `/console` has no page scroll (`document.scrollingElement.scrollHeight <= innerHeight`), composer is sticky at the bottom, stream is virtualized (DOM rows < 120 with 5,000 fixture lines) |
| 21 | No storage in console/chat | after exercising console + chat, `localStorage`/`sessionStorage` contain no console/chat keys and no IndexedDB writes to console/chat stores; `verify-purge.sh` passes |
| 22 | Responsive integrity | at 390px: rail becomes a 56px bottom bar, no horizontal page scroll (`scrollWidth <= clientWidth`), deck is 1 column, header meta hidden |
| 23 | Route silhouettes | R01-R08 each match their grid spec: R02 has Deck -> Pane -> dock(2 panes); R04 columns `~340-440 / 1fr`; R05 `.pp-ide` 4 rows; R06 rail has 14 nodes; R07 3 panes at >=1360px; R08 2 columns with sticky preview |
| 24 | Core preserved | `git diff --stat` shows **no changes** under `src/adapter`, `src/presentation`, `src/store`, `src/lib`; preferences store still has exactly 8 keys; pairing, prepare/review/execute flows pass their existing tests |
| 25 | Accessibility and motion | axe: 0 serious/critical on all routes; all interactive elements keyboard reachable with visible focus ring; `data-motion=reduced` -> no running animations (`document.getAnimations().length === 0`); AA contrast >= 4.5:1 for text in both themes |

### 9.1 Playwright helpers (copy into `tests/structure/helpers.ts`)

```ts
import type { Page } from '@playwright/test';

/** #1 - returns descriptors of boxes nested in boxes. A "box" = border>0 && radius>=12px. Controls/tags are <12px so they never count. */
export async function noNestedBoxes(page: Page) {
  return page.evaluate(() => {
    const isBox = (el: Element) => {
      const cs = getComputedStyle(el);
      const bw = ['Top', 'Right', 'Bottom', 'Left'].some(s => parseFloat((cs as any)[`border${s}Width`]) > 0);
      const r = Math.max(...['TopLeft', 'TopRight', 'BottomLeft', 'BottomRight'].map(c => parseFloat((cs as any)[`border${c}Radius`]) || 0));
      return bw && r >= 12 && cs.display !== 'none';
    };
    const bad: string[] = [];
    document.querySelectorAll('body *:not([role="dialog"] *):not([data-radix-popper-content-wrapper] *)').forEach(el => {
      if (!isBox(el)) return;
      let p = el.parentElement;
      while (p) { if (isBox(p)) { bad.push(`${(el as HTMLElement).className} ⊂ ${(p as HTMLElement).className}`); break; } p = p.parentElement; }
    });
    return bad;
  });
}

export async function textCount(page: Page, re: RegExp) {
  return page.evaluate(src => {
    const rx = new RegExp(src.source, src.flags.includes('g') ? src.flags : src.flags + 'g');
    return (document.body.innerText.match(rx) || []).length;
  }, { source: re.source, flags: re.flags });
}

export const heights = (page: Page, sel: string) =>
  page.$$eval(sel, els => els.map(e => Math.round(e.getBoundingClientRect().height)));

/** #17 - number of rendered lines for a console row containing `needle`. */
export async function consoleLines(page: Page, needle: string) {
  return page.evaluate(n => {
    const row = [...document.querySelectorAll('.pp-crow__msg')].find(e => e.textContent?.includes(n)) as HTMLElement | undefined;
    if (!row) return -1;
    const lh = parseFloat(getComputedStyle(row).lineHeight);
    return Math.round(row.getBoundingClientRect().height / lh);
  }, needle);
}
```

### 9.2 Example specs

```ts
test('R02 anti-card-soup', async ({ page }) => {
  await page.setViewportSize({ width: 1545, height: 911 });
  await page.goto('/overview');
  expect(await noNestedBoxes(page)).toEqual([]);                                                // #1
  expect(await textCount(page, /\bPAPER\b/)).toBeLessThanOrEqual(1);                            // #2
  expect(await textCount(page, /\bLive\b/)).toBeLessThanOrEqual(2);                             // #3
  expect(await heights(page, '.pp-deck--instruments > .pp-cell')).toEqual([148, 148, 148, 148]); // #11
  expect(await page.locator('.gate-reason').count()).toBe(0);                                   // #5
  expect((await page.locator('header[role=banner]').boundingBox())!.height).toBe(56);           // #6
  expect(await consoleLines(page, 'logged in with entity id')).toBeLessThanOrEqual(2);          // #17
});

test('gated Start is a tooltip, never a paragraph', async ({ page }) => {                        // #5 #7
  await page.goto('/overview');                                                                   // fixture: server online
  const start = page.getByRole('button', { name: 'Start' });
  await expect(start).toHaveAttribute('aria-disabled', 'true');
  await start.focus();
  await expect(page.getByRole('tooltip')).toContainText('Start requires a confirmed stopped service.');
  expect(await page.locator('header[role=banner]').evaluate(h => h.getBoundingClientRect().height)).toBe(56);
});
```

---

## 10. Definition of done

1. `scripts/verify-purge.sh` exits 0 and `git diff` shows zero changes in the preserved core.
2. All 25 invariants pass at all required viewports and both themes.
3. Screenshots of R01-R08 (1545x911, dark) attached to the PR, side-by-side with the legacy screenshot, demonstrating: one header, one deck, one studio, wide console, zero inline gate text.
4. No `TODO`, no commented-out legacy code, no unused primitives (`.pp-card` count in the codebase <= number of Fleet blades + documented leaf cases).


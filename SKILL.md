---
name: plexonpanel-v5-telemetry-and-events-architect
description: Use for ANY change to PlexonPanel 5.0 telemetry charts (Telemetry Studio on /overview, the /performance route) or the Player events dock. Mandates one-series-per-stage charts, a selected-signal ribbon that swaps the chart, a 2-tier bento workbench with a single shared crosshair readout bar, and a unified per-boot player event stream (presence deltas + roster + console parsing) that is never wiped by roster snapshots.
---

# PlexonPanel 5.0 · Telemetry & Events Architect

Target agent: **GPT-6.1 Sol**. Repo: `PlexonPanel-Dashboard` (React + TypeScript + Vite, hand-written CSS, no chart library).
Everything below is a blueprint to copy, adapt to local naming, and wire. Where the repo already has a file with the same responsibility, edit it instead of creating a duplicate, and delete what this skill bans.

---

## 0. Agent protocol (do this first)

1. `grep -rn "pp-chart-readout\|pp-ribbon\|TelemetryStudio\|presenceDeltas\|players.history.view\|inventory.players\|console.history" src/` and list every hit. Those are the files you will touch or delete.
2. Do not add a charting dependency. All charts are SVG written by hand (blueprints below).
3. Work in this order: **§3 data contracts → §4 Studio → §5 Workbench → §6 player events → §7 QA gate**. Run the QA gate before reporting done.
4. If a name in this skill collides with an existing export, keep the existing public name and re-export.

---

## 1. Diagnosis (why the current screens are wrong)

| # | Symptom in screenshots | Root cause | Fix in this skill |
|---|---|---|---|
| A | Clicking `TPS / MEAN MSPT / P95 / P99 / GC Δ` in Telemetry Studio does not change the chart; 3 stages stay stacked and STAGE 02 overlays mean+p95+p99 | Ribbon cards are decorative; chart stages are hard-coded per tab group, not driven by a `selected` signal; one stage draws several areas | §4: `selected` state drives a single `<Stage>`; `Stage` accepts exactly one `SeriesSpec` |
| B | `/performance` is a cramped 5-row stack; Track 01 overlays 4 areas; Track 03 overlays 3 fills; Track 05 overlays 2 | Every track is a multi-series overlay | §5: primary stage + 2×2 deck, every lane is one series |
| C | X labels repeat 5×; 5 black `.pp-chart-readout` boxes appear on hover and clip across tracks | Each track owns its own axis and tooltip | §5: one clock axis, one readout bar, crosshair is a shared store |
| D | Player events says "Waiting for events from this boot" while `ZpkDxGames` is online | (1) `presenceDeltas` gated on `players.history.view` instead of `players.view`; (2) each `inventory.players` snapshot **replaced** the retained list; (3) nothing parsed join/leave/advancement/death/command from `console.history` + live `s.console` | §6: single per-boot store, three ingest paths, roster snapshots only diff and never clear |

---

## 2. Non-negotiable laws

1. **One series per stage.** `Stage` takes `spec: SeriesSpec` (singular). There is no `series[]` prop. If you need two series, render two stages.
2. **No overlapping area fills.** A stage may contain at most one `path.pp-area`, one `path.pp-line`, or one set of `rect.pp-bar`. Nothing else is filled.
3. **No floating tooltips.** `.pp-chart-readout` is deleted from CSS, TSX and tests. Hover shows (a) a crosshair line + dot inside each stage and (b) one `ReadoutBar` per workbench plus inline per-stage head values.
4. **One clock axis per workbench**, rendered by `<TimeAxis>` under the primary stage. Deck cells show only two relative edge labels (`−60s`, `now`).
5. **Ribbon cards are tabs.** `role="tab"`, `aria-selected`, arrow-key navigation, and the selected signal swaps the chart.
6. **Shared scales where comparison matters.** Memory lanes share one Y domain; all stages share one X domain (`domainT`) and identical plot padding (`PLOT`).
7. **Roster snapshots never delete events.** Only a new `bootId` starts a new bucket.
8. **Permissions:** `players.view` shows live player events; `players.history.view` gates only the "Load earlier" older-history fetch.

---

## 3. Shared contracts: `telemetry/series.ts`

```ts
// src/telemetry/series.ts
export interface Sample {
  t: number;            // epoch ms (UTC)
  tps: number;
  mean: number;         // mean MSPT, ms
  p95: number;          // ms
  p99: number;          // ms
  gc: number;           // GC pause delta over the sample interval, ms
  heapUsed: number;     // GiB
  committed: number;    // GiB
  cgroup: number;       // GiB
  svcCpu: number;       // %
  nodeCpu: number;      // %
  chunks: number;
  entities: number;
}

export type SeriesKey =
  | 'tps' | 'mean' | 'p95' | 'p99' | 'gc'
  | 'heapUsed' | 'committed' | 'cgroup'
  | 'svcCpu' | 'nodeCpu' | 'chunks' | 'entities';

export interface SeriesSpec {
  key: SeriesKey;
  label: string;
  unit: string;
  kind: 'area' | 'bars';
  color: string;                         // CSS color; must match --pp-c-* tokens
  peak: 'max' | 'min';                   // which extreme survives decimation
  accessor: (s: Sample) => number;
  domain: (all: Sample[]) => [number, number];
  fmt: (v: number) => string;
  budget?: { value: number; label: string };
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

const maxOf = (ss: Sample[], f: (s: Sample) => number) => ss.reduce((m, s) => Math.max(m, f(s)), 0);
const minOf = (ss: Sample[], f: (s: Sample) => number) => ss.reduce((m, s) => Math.min(m, f(s)), Infinity);
const one = (v: number) => v.toFixed(1);

const msDomain = (f: (s: Sample) => number) => (ss: Sample[]): [number, number] =>
  [0, Math.max(16, niceCeil(maxOf(ss, f) * 1.15))];

// Memory lanes share ONE domain so heights are comparable without overlapping.
const memDomain = (ss: Sample[]): [number, number] => {
  const hi = maxOf(ss, s => Math.max(s.heapUsed, s.committed, s.cgroup));
  return [0, Math.max(1, niceCeil(hi * 1.1))];
};

export const SERIES: Record<SeriesKey, SeriesSpec> = {
  tps: {
    key: 'tps', label: 'TPS', unit: 'TPS', kind: 'area', color: 'var(--pp-c-tps)', peak: 'min',
    accessor: s => s.tps,
    domain: ss => [Math.min(15, Math.floor(minOf(ss, s => s.tps))), 20],
    fmt: one,
  },
  mean: {
    key: 'mean', label: 'Mean MSPT', unit: 'ms', kind: 'area', color: 'var(--pp-c-mean)', peak: 'max',
    accessor: s => s.mean, domain: msDomain(s => s.mean), fmt: one,
    budget: { value: 50, label: '50 ms budget' },
  },
  p95: {
    key: 'p95', label: 'p95 MSPT', unit: 'ms', kind: 'area', color: 'var(--pp-c-p95)', peak: 'max',
    accessor: s => s.p95, domain: msDomain(s => s.p95), fmt: one,
    budget: { value: 50, label: '50 ms budget' },
  },
  p99: {
    key: 'p99', label: 'p99 MSPT', unit: 'ms', kind: 'area', color: 'var(--pp-c-p99)', peak: 'max',
    accessor: s => s.p99, domain: msDomain(s => s.p99), fmt: one,
    budget: { value: 50, label: '50 ms budget' },
  },
  gc: {
    key: 'gc', label: 'GC pauses Δ', unit: 'ms', kind: 'bars', color: 'var(--pp-c-gc)', peak: 'max',
    accessor: s => s.gc, domain: ss => [0, Math.max(4, niceCeil(maxOf(ss, s => s.gc) * 1.15))], fmt: one,
  },
  heapUsed:  { key: 'heapUsed',  label: 'Heap used',   unit: 'GiB', kind: 'area', color: 'var(--pp-c-heap)',   peak: 'max', accessor: s => s.heapUsed,  domain: memDomain, fmt: one },
  committed: { key: 'committed', label: 'Committed',   unit: 'GiB', kind: 'area', color: 'var(--pp-c-commit)', peak: 'max', accessor: s => s.committed, domain: memDomain, fmt: one },
  cgroup:    { key: 'cgroup',    label: 'Cgroup',      unit: 'GiB', kind: 'area', color: 'var(--pp-c-cgroup)', peak: 'max', accessor: s => s.cgroup,    domain: memDomain, fmt: one },
  svcCpu:    { key: 'svcCpu',    label: 'Service CPU', unit: '%',   kind: 'area', color: 'var(--pp-c-svc)',    peak: 'max', accessor: s => s.svcCpu,    domain: () => [0, 100], fmt: one },
  nodeCpu:   { key: 'nodeCpu',   label: 'Node CPU',    unit: '%',   kind: 'area', color: 'var(--pp-c-node)',   peak: 'max', accessor: s => s.nodeCpu,   domain: () => [0, 100], fmt: one },
  chunks:    { key: 'chunks',    label: 'Loaded chunks', unit: '',  kind: 'area', color: 'var(--pp-c-chunks)',   peak: 'max', accessor: s => s.chunks,   domain: ss => [0, niceCeil(maxOf(ss, s => s.chunks) * 1.1)],   fmt: v => String(Math.round(v)) },
  entities:  { key: 'entities',  label: 'Entities',    unit: '',    kind: 'area', color: 'var(--pp-c-entities)', peak: 'max', accessor: s => s.entities, domain: ss => [0, niceCeil(maxOf(ss, s => s.entities) * 1.1)], fmt: v => String(Math.round(v)) },
};

export interface Group { id: 'tick' | 'memory' | 'cpu'; label: string; series: SeriesKey[] }
export const GROUPS: Group[] = [
  { id: 'tick',   label: 'Tick & MSPT',   series: ['tps', 'mean', 'p95', 'p99', 'gc'] },
  { id: 'memory', label: 'Memory tiers',  series: ['heapUsed', 'committed', 'cgroup'] },
  { id: 'cpu',    label: 'CPU & chunks',  series: ['svcCpu', 'nodeCpu', 'chunks', 'entities'] },
];

/** Keep first/last; inside each bucket keep the extreme so spikes and dips survive. */
export function decimate<T>(xs: T[], max: number, val: (t: T) => number, peak: 'max' | 'min'): T[] {
  if (xs.length <= max || max < 3) return xs;
  const out: T[] = [];
  const size = xs.length / max;
  for (let i = 0; i < max; i++) {
    const a = Math.floor(i * size);
    const b = Math.min(xs.length, Math.floor((i + 1) * size));
    let best = xs[a];
    for (let j = a + 1; j < b; j++) {
      if (peak === 'max' ? val(xs[j]) > val(best) : val(xs[j]) < val(best)) best = xs[j];
    }
    out.push(best);
  }
  out[0] = xs[0];
  out[out.length - 1] = xs[xs.length - 1];
  return out;
}

export function sampleAt(ss: Sample[], t: number): Sample | undefined {
  if (!ss.length) return undefined;
  let lo = 0, hi = ss.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ss[mid].t < t) lo = mid + 1; else hi = mid;
  }
  const a = ss[lo], b = ss[lo - 1];
  return b && Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a;
}

export function timeDomain(ss: Sample[], rangeMs?: number): [number, number] {
  if (!ss.length) { const n = Date.now(); return [n - 60_000, n]; }
  const last = ss[ss.length - 1].t;
  return [rangeMs ? last - rangeMs : ss[0].t, last];
}
```

### 3.1 Shared crosshair store: `telemetry/crosshair.ts`

One time value for the whole page. Every stage, the readout bar and the ribbon read it.

```ts
// src/telemetry/crosshair.ts
import { useSyncExternalStore } from 'react';

type Listener = () => void;
let current: number | null = null;
let pending: number | null | undefined;
let raf = 0;
const listeners = new Set<Listener>();

export const crosshair = {
  get: () => current,
  subscribe(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; },
  /** rAF-coalesced so 12 stages repaint at most once per frame */
  set(v: number | null) {
    pending = v;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (pending !== undefined && pending !== current) {
        current = pending;
        listeners.forEach(l => l());
      }
      pending = undefined;
    });
  },
};

export const useCrosshair = () => useSyncExternalStore(crosshair.subscribe, crosshair.get, crosshair.get);
```

### 3.2 Small hooks: `telemetry/hooks.ts`

```ts
// src/telemetry/hooks.ts
import { RefObject, useLayoutEffect, useState } from 'react';

export function useSize<T extends HTMLElement>(ref: RefObject<T>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      const h = Math.round(entry.contentRect.height);
      setSize(p => (p.w === w && p.h === h ? p : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

export function useSessionState<T extends string>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try { return (sessionStorage.getItem(key) as T) || initial; } catch { return initial; }
  });
  return [v, (n: T) => { setV(n); try { sessionStorage.setItem(key, n); } catch { /* private mode */ } }];
}
```

---

## 4. Separated-Selected StudioChart (`/overview` Telemetry Studio)

### 4.1 Behaviour contract

- The group tabs (`Tick & MSPT`, `Memory tiers`, `CPU & chunks`) choose which **ribbon set** is shown.
- The ribbon shows one card per series in the group. **Clicking a card sets `selected`.**
- **Focus view (default):** exactly one `<Stage>` for `selected`, full height (300 px), own Y scale, own gradient, own budget line, its own accent colour. Switching cards remounts the stage (`key={selected}`) with a 140 ms fade.
- **Split view (optional toggle):** one `<Stage>` per series in the group, each with its own scale, stacked, hairline-divided, never overlapping. The selected stage gets an accent left rail. Clicking a stage head also selects it.
- Banned: any stage that draws more than one series; any `STAGE 02` style combined mean/p95/p99 overlay.
- Selected signal and view mode persist in `sessionStorage` (`pp.studio.signal`, `pp.studio.view`).

### 4.2 `Stage.tsx` (the only chart primitive)

```tsx
// src/telemetry/Stage.tsx
import { useId, useMemo, useRef } from 'react';
import { SeriesSpec, Sample, clamp, decimate, sampleAt } from './series';
import { crosshair, useCrosshair } from './crosshair';
import { useSize } from './hooks';

/** Identical on every stage so X positions line up across the whole page. */
export const PLOT = { l: 12, r: 46, t: 18, b: 6 } as const;

export interface StageProps {
  spec: SeriesSpec;                 // exactly one series. Do not widen this to an array.
  samples: Sample[];
  domainT: [number, number];        // shared X domain
  height?: number | 'fill';         // px, or fill parent flex slot
  minHeight?: number;
  kicker?: string;                  // e.g. "SELECTED" or "01"
  selected?: boolean;
  onSelect?: () => void;
  testId?: string;
}

const fmtTick = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

export function Stage({
  spec, samples, domainT, height = 'fill', minHeight = 64, kicker, selected, onSelect, testId,
}: StageProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const { w, h: measured } = useSize(plotRef);
  const uid = useId().replace(/:/g, '');
  const hoverT = useCrosshair();

  const H = height === 'fill' ? Math.max(minHeight, measured) : height;

  const m = useMemo(() => {
    const [d0, d1] = spec.domain(samples);
    const iw = Math.max(1, w - PLOT.l - PLOT.r);
    const ih = Math.max(1, H - PLOT.t - PLOT.b);
    const [t0, t1] = domainT;
    const sx = (t: number) => PLOT.l + ((t - t0) / (t1 - t0 || 1)) * iw;
    const sy = (v: number) => PLOT.t + ih - ((v - d0) / (d1 - d0 || 1)) * ih;
    const base = PLOT.t + ih;
    const pts = decimate(samples, Math.max(3, Math.floor(iw)), spec.accessor, spec.peak);

    let line = '', area = '';
    if (spec.kind === 'area' && pts.length > 1) {
      line = pts
        .map((s, i) => `${i ? 'L' : 'M'}${sx(s.t).toFixed(1)},${sy(clamp(spec.accessor(s), d0, d1)).toFixed(1)}`)
        .join('');
      area = `${line}L${sx(pts[pts.length - 1].t).toFixed(1)},${base}L${sx(pts[0].t).toFixed(1)},${base}Z`;
    }
    const barW = Math.max(1.5, Math.min(4, (iw / Math.max(1, pts.length)) * 0.6));
    const bars = spec.kind === 'bars'
      ? pts.filter(s => spec.accessor(s) > 0).map(s => ({ x: sx(s.t) - barW / 2, y: sy(spec.accessor(s)), w: barW }))
      : [];
    return { d0, d1, iw, ih, sx, sy, base, line, area, bars, ticks: [d0, (d0 + d1) / 2, d1] };
  }, [samples, spec, w, H, domainT]);

  const last = samples[samples.length - 1];
  const hs = hoverT == null ? undefined : sampleAt(samples, hoverT);
  const shown = hs ?? last;
  const budget = spec.budget;
  const budgetInside = !!budget && budget.value >= m.d0 && budget.value <= m.d1;
  const budgetOff = !!budget && !budgetInside;

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = clamp((e.clientX - r.left - PLOT.l) / m.iw, 0, 1);
    const t = domainT[0] + ratio * (domainT[1] - domainT[0]);
    const s = sampleAt(samples, t);
    if (s) crosshair.set(s.t);
  };

  return (
    <section
      className="pp-stage"
      data-series={spec.key}
      data-selected={selected ? 'true' : undefined}
      data-testid={testId ?? `stage-${spec.key}`}
      style={height === 'fill' ? { flex: '1 1 0', minHeight } : undefined}
    >
      <header className="pp-stage__head" onClick={onSelect} role={onSelect ? 'button' : undefined}>
        {kicker && <span className="pp-stage__kicker">{kicker}</span>}
        <span className="pp-stage__label">{spec.label}</span>
        {budgetOff && <span className="pp-stage__chip">▲ {budget!.label} · off scale</span>}
        <span className="pp-stage__value" data-state={hs ? 'scrub' : 'live'}>
          {shown ? spec.fmt(spec.accessor(shown)) : '–'}
          {spec.unit && <small>{spec.unit}</small>}
        </span>
      </header>

      <div
        ref={plotRef}
        className="pp-stage__plot"
        style={height === 'fill' ? undefined : { height }}
        onPointerMove={onMove}
        onPointerLeave={() => crosshair.set(null)}
      >
        {w > 0 && (
          <svg className="pp-stage__svg" width={w} height={H} role="img" aria-label={`${spec.label} over time`}>
            <defs>
              <linearGradient id={`fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={spec.color} stopOpacity="0.46" />
                <stop offset="0.65" stopColor={spec.color} stopOpacity="0.12" />
                <stop offset="1" stopColor={spec.color} stopOpacity="0" />
              </linearGradient>
            </defs>

            {m.ticks.map((v, i) => (
              <g key={i}>
                <line className="pp-grid" x1={PLOT.l} x2={w - PLOT.r} y1={m.sy(v)} y2={m.sy(v)} />
                <text className="pp-ytick" x={w - PLOT.r + 8} y={m.sy(v) + 3.5}>{fmtTick(v)}</text>
              </g>
            ))}

            {budgetInside && (
              <>
                <line className="pp-budget" x1={PLOT.l} x2={w - PLOT.r} y1={m.sy(budget!.value)} y2={m.sy(budget!.value)} />
                <text className="pp-budget-label" x={PLOT.l + 4} y={m.sy(budget!.value) - 4}>{budget!.label}</text>
              </>
            )}

            {spec.kind === 'area' && (
              <>
                <path className="pp-area" d={m.area} fill={`url(#fill-${uid})`} />
                <path className="pp-line" d={m.line} stroke={spec.color} />
              </>
            )}
            {spec.kind === 'bars' &&
              m.bars.map((b, i) => (
                <rect key={i} className="pp-bar" x={b.x} y={b.y} width={b.w} height={Math.max(1, m.base - b.y)} fill={spec.color} />
              ))}

            {hs && (
              <>
                <line className="pp-cross" x1={m.sx(hs.t)} x2={m.sx(hs.t)} y1={PLOT.t} y2={m.base} />
                <circle className="pp-dot" cx={m.sx(hs.t)} cy={m.sy(clamp(spec.accessor(hs), m.d0, m.d1))} r="3.5" stroke={spec.color} />
              </>
            )}
          </svg>
        )}
      </div>
    </section>
  );
}
```

### 4.3 `Ribbon.tsx` (tabs that drive the chart)

```tsx
// src/telemetry/Ribbon.tsx
import { KeyboardEvent, useMemo } from 'react';
import { SERIES, SeriesKey, Sample, sampleAt } from './series';
import { useCrosshair } from './crosshair';

function Spark({ samples, k }: { samples: Sample[]; k: SeriesKey }) {
  const spec = SERIES[k];
  const tail = samples.slice(-60);
  const d = useMemo(() => {
    if (tail.length < 2) return '';
    const vals = tail.map(spec.accessor);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const span = hi - lo || 1;
    return vals.map((v, i) => `${i ? 'L' : 'M'}${(i / (vals.length - 1) * 64).toFixed(1)},${(18 - ((v - lo) / span) * 16 - 1).toFixed(1)}`).join('');
  }, [tail, spec]);
  return (
    <svg className="pp-spark" viewBox="0 0 64 20" width="64" height="20" aria-hidden="true">
      <path d={d} fill="none" stroke={spec.color} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export interface RibbonProps {
  keys: SeriesKey[];
  selected: SeriesKey;
  onSelect: (k: SeriesKey) => void;
  samples: Sample[];
}

export function Ribbon({ keys, selected, onSelect, samples }: RibbonProps) {
  const hoverT = useCrosshair();
  const shown = hoverT == null ? samples[samples.length - 1] : sampleAt(samples, hoverT);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = keys.indexOf(selected);
    if (e.key === 'ArrowRight') { onSelect(keys[(i + 1) % keys.length]); e.preventDefault(); }
    if (e.key === 'ArrowLeft')  { onSelect(keys[(i - 1 + keys.length) % keys.length]); e.preventDefault(); }
  };

  return (
    <div
      className="pp-ribbon" role="tablist" aria-label="Telemetry signal"
      style={{ ['--n' as string]: keys.length }} onKeyDown={onKey}
    >
      {keys.map(k => {
        const spec = SERIES[k];
        const active = k === selected;
        return (
          <button
            key={k} role="tab" type="button" className="pp-ribbon__card"
            data-series={k} data-active={active || undefined} data-testid={`ribbon-${k}`}
            aria-selected={active} tabIndex={active ? 0 : -1} onClick={() => onSelect(k)}
          >
            <span className="pp-ribbon__label">{spec.label.toUpperCase()}</span>
            <span className="pp-ribbon__value">
              {shown ? spec.fmt(spec.accessor(shown)) : '–'}
              {spec.unit && <small>{spec.unit}</small>}
            </span>
            <Spark samples={samples} k={k} />
          </button>
        );
      })}
    </div>
  );
}
```

### 4.4 `TelemetryStudio.tsx`

```tsx
// src/telemetry/TelemetryStudio.tsx
import { useMemo } from 'react';
import { GROUPS, SERIES, Sample, SeriesKey, timeDomain } from './series';
import { Ribbon } from './Ribbon';
import { Stage } from './Stage';
import { TimeAxis } from './TimeAxis';
import { useSessionState } from './hooks';

const RANGES = [['1m', 60_000], ['5m', 300_000], ['15m', 900_000], ['35m', 2_100_000]] as const;

export function TelemetryStudio({ samples, tz }: { samples: Sample[]; tz: string }) {
  const [groupId, setGroupId] = useSessionState<'tick' | 'memory' | 'cpu'>('pp.studio.group', 'tick');
  const [selected, setSelected] = useSessionState<SeriesKey>('pp.studio.signal', 'tps');
  const [view, setView] = useSessionState<'focus' | 'split'>('pp.studio.view', 'focus');
  const [range, setRange] = useSessionState<string>('pp.studio.range', '1m');

  const group = GROUPS.find(g => g.id === groupId) ?? GROUPS[0];
  const sel: SeriesKey = group.series.includes(selected) ? selected : group.series[0];
  const rangeMs = RANGES.find(r => r[0] === range)?.[1] ?? 60_000;

  const windowed = useMemo(() => {
    if (!samples.length) return samples;
    const cut = samples[samples.length - 1].t - rangeMs;
    return samples.filter(s => s.t >= cut);
  }, [samples, rangeMs]);
  const domainT = useMemo(() => timeDomain(windowed, rangeMs), [windowed, rangeMs]);

  return (
    <section className="pp-studio" aria-label="Telemetry Studio">
      <header className="pp-studio__bar">
        <h2>Telemetry Studio</h2>
        <div className="pp-seg" role="tablist" aria-label="Signal group">
          {GROUPS.map(g => (
            <button key={g.id} role="tab" aria-selected={g.id === group.id} data-active={g.id === group.id || undefined}
              onClick={() => { setGroupId(g.id); setSelected(g.series[0]); }}>
              {g.label}
            </button>
          ))}
        </div>
        <div className="pp-studio__spacer" />
        <div className="pp-seg" role="group" aria-label="View">
          <button data-active={view === 'focus' || undefined} onClick={() => setView('focus')}>Focus</button>
          <button data-active={view === 'split' || undefined} onClick={() => setView('split')}>Split</button>
        </div>
        <div className="pp-seg" role="group" aria-label="Range">
          {RANGES.map(([id]) => (
            <button key={id} data-active={id === range || undefined} onClick={() => setRange(id)}>{id}</button>
          ))}
        </div>
      </header>

      <Ribbon keys={group.series} selected={sel} onSelect={setSelected} samples={windowed} />

      {view === 'focus' ? (
        <div className="pp-studio__focus" key={sel} data-series={sel}>
          <Stage spec={SERIES[sel]} samples={windowed} domainT={domainT} height={300} kicker="SELECTED" selected />
        </div>
      ) : (
        <div className="pp-studio__split" key={group.id}>
          {group.series.map((k, i) => (
            <Stage key={k} spec={SERIES[k]} samples={windowed} domainT={domainT} height={110}
              kicker={String(i + 1).padStart(2, '0')} selected={k === sel} onSelect={() => setSelected(k)} />
          ))}
        </div>
      )}

      <TimeAxis domainT={domainT} tz={tz} />
    </section>
  );
}
```

### 4.5 `TimeAxis.tsx` (rendered once per chart area)

```tsx
// src/telemetry/TimeAxis.tsx
import { useMemo, useRef } from 'react';
import { PLOT } from './Stage';
import { useSize } from './hooks';

const STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600].map(s => s * 1000);

export function niceTimeTicks(t0: number, t1: number, target = 6): number[] {
  const span = t1 - t0;
  const step = STEPS.find(s => span / s <= target) ?? STEPS[STEPS.length - 1];
  const out: number[] = [];
  for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) out.push(t);
  return out;
}

export function TimeAxis({ domainT, tz }: { domainT: [number, number]; tz: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { w } = useSize(ref);
  const fmt = useMemo(
    () => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }),
    [tz],
  );
  const iw = Math.max(1, w - PLOT.l - PLOT.r);
  const ticks = useMemo(() => niceTimeTicks(domainT[0], domainT[1]), [domainT]);

  return (
    <div className="pp-axis" ref={ref} aria-hidden="true">
      {ticks.map(t => (
        <span key={t} style={{ left: PLOT.l + ((t - domainT[0]) / (domainT[1] - domainT[0] || 1)) * iw }}>
          {fmt.format(t)}
        </span>
      ))}
    </div>
  );
}
```

### 4.6 CSS: tokens, ribbon, stage, studio (`telemetry.css`)

```css
/* src/telemetry/telemetry.css */
:root {
  --pp-surface-0: #07090c;
  --pp-surface-1: #0b0e12;
  --pp-surface-2: #10141a;
  --pp-surface-3: #161b23;
  --pp-hairline: rgba(255, 255, 255, 0.07);
  --pp-hairline-strong: rgba(255, 255, 255, 0.13);
  --pp-text: #e7ecf3;
  --pp-text-dim: #8b95a5;
  --pp-text-faint: #5b6574;
  --pp-mono: "JetBrains Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;

  --pp-c-tps: #34d399;
  --pp-c-mean: #2dd4bf;
  --pp-c-p95: #a78bfa;
  --pp-c-p99: #fbbf24;
  --pp-c-gc: #fb7185;
  --pp-c-heap: #a78bfa;
  --pp-c-commit: #60a5fa;
  --pp-c-cgroup: #38bdf8;
  --pp-c-svc: #a78bfa;
  --pp-c-node: #22d3ee;
  --pp-c-chunks: #34d399;
  --pp-c-entities: #c4b5fd;
}

/* accent per series: drives ribbon underline, stage rail, readout chip */
[data-series="tps"]       { --pp-accent: var(--pp-c-tps); }
[data-series="mean"]      { --pp-accent: var(--pp-c-mean); }
[data-series="p95"]       { --pp-accent: var(--pp-c-p95); }
[data-series="p99"]       { --pp-accent: var(--pp-c-p99); }
[data-series="gc"]        { --pp-accent: var(--pp-c-gc); }
[data-series="heapUsed"]  { --pp-accent: var(--pp-c-heap); }
[data-series="committed"] { --pp-accent: var(--pp-c-commit); }
[data-series="cgroup"]    { --pp-accent: var(--pp-c-cgroup); }
[data-series="svcCpu"]    { --pp-accent: var(--pp-c-svc); }
[data-series="nodeCpu"]   { --pp-accent: var(--pp-c-node); }
[data-series="chunks"]    { --pp-accent: var(--pp-c-chunks); }
[data-series="entities"]  { --pp-accent: var(--pp-c-entities); }

/* ---------- segmented controls ---------- */
.pp-seg { display: inline-flex; padding: 2px; gap: 2px; border: 1px solid var(--pp-hairline-strong); border-radius: 8px; background: var(--pp-surface-1); }
.pp-seg button { font: 500 12px/1 var(--pp-mono); color: var(--pp-text-dim); padding: 7px 10px; border: 0; border-radius: 6px; background: transparent; cursor: pointer; }
.pp-seg button:hover { color: var(--pp-text); }
.pp-seg button[data-active], .pp-seg button[aria-selected="true"] { color: var(--pp-text); background: var(--pp-surface-3); box-shadow: inset 0 0 0 1px var(--pp-hairline-strong); }

/* ---------- studio shell ---------- */
.pp-studio { border: 1px solid var(--pp-hairline-strong); border-radius: 14px; background: linear-gradient(180deg, var(--pp-surface-2), var(--pp-surface-1)); overflow: hidden; }
.pp-studio__bar { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--pp-hairline); }
.pp-studio__bar h2 { margin: 0 8px 0 0; font: 600 14px/1 system-ui, sans-serif; color: var(--pp-text); }
.pp-studio__spacer { flex: 1; }
.pp-studio__focus { animation: pp-swap 140ms ease-out; }
.pp-studio__split { display: flex; flex-direction: column; }
.pp-studio__split > .pp-stage + .pp-stage { border-top: 1px solid var(--pp-hairline); }
@keyframes pp-swap { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: none; } }

/* ---------- ribbon ---------- */
.pp-ribbon { display: grid; grid-template-columns: repeat(var(--n, 5), minmax(0, 1fr)); border-bottom: 1px solid var(--pp-hairline); background: var(--pp-surface-1); }
.pp-ribbon__card { position: relative; display: grid; grid-template-columns: 1fr auto; grid-template-rows: auto auto; align-items: end; gap: 4px 8px; text-align: left; padding: 12px 14px 10px; border: 0; background: transparent; color: var(--pp-text); cursor: pointer; transition: background 120ms; }
.pp-ribbon__card + .pp-ribbon__card { border-left: 1px solid var(--pp-hairline); }
.pp-ribbon__card:hover { background: rgba(255, 255, 255, 0.025); }
.pp-ribbon__card::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 2px; background: transparent; }
.pp-ribbon__card[data-active] { background: linear-gradient(180deg, color-mix(in srgb, var(--pp-accent) 10%, transparent), transparent 70%); }
.pp-ribbon__card[data-active]::before { background: var(--pp-accent); box-shadow: 0 0 12px var(--pp-accent); }
.pp-ribbon__card:focus-visible { outline: 2px solid var(--pp-accent); outline-offset: -2px; }
.pp-ribbon__label { grid-column: 1 / -1; font: 600 10px/1 var(--pp-mono); letter-spacing: 0.08em; color: var(--pp-text-dim); }
.pp-ribbon__card[data-active] .pp-ribbon__label { color: var(--pp-text); }
.pp-ribbon__value { font: 600 26px/1 system-ui, sans-serif; font-variant-numeric: tabular-nums; }
.pp-ribbon__value small { margin-left: 4px; font: 500 12px var(--pp-mono); color: var(--pp-text-dim); }
.pp-spark { justify-self: end; opacity: 0.85; }

/* ---------- stage (one series) ---------- */
.pp-stage { position: relative; display: flex; flex-direction: column; min-width: 0; background: var(--pp-surface-0); overflow: hidden; }
.pp-stage[data-selected="true"]::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 2px; background: var(--pp-accent); z-index: 1; }
.pp-stage__head { display: flex; align-items: baseline; gap: 10px; padding: 8px 14px 0 14px; font: 600 10px/1 var(--pp-mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--pp-text-dim); }
.pp-stage__head[role="button"] { cursor: pointer; }
.pp-stage__kicker { color: var(--pp-text-faint); }
.pp-stage__label { color: var(--pp-text); }
.pp-stage__chip { margin-left: 4px; padding: 3px 6px; border-radius: 999px; border: 1px solid var(--pp-hairline-strong); color: var(--pp-c-p99); letter-spacing: 0.04em; text-transform: none; }
.pp-stage__value { margin-left: auto; padding-right: 46px; font: 600 13px/1 var(--pp-mono); letter-spacing: 0; color: var(--pp-accent); font-variant-numeric: tabular-nums; }
.pp-stage__value[data-state="scrub"] { color: var(--pp-text); }
.pp-stage__value small { margin-left: 3px; font-size: 10px; color: var(--pp-text-dim); }
.pp-stage__plot { position: relative; flex: 1 1 auto; min-height: 0; touch-action: pan-y; cursor: crosshair; }
.pp-stage__svg { display: block; }

.pp-grid { stroke: var(--pp-hairline); stroke-width: 1; shape-rendering: crispEdges; }
.pp-ytick { font: 500 10px var(--pp-mono); fill: var(--pp-text-faint); }
.pp-budget { stroke: var(--pp-c-p99); stroke-width: 1; stroke-dasharray: 4 4; opacity: 0.7; }
.pp-budget-label { font: 500 10px var(--pp-mono); fill: var(--pp-c-p99); opacity: 0.85; }
.pp-line { fill: none; stroke-width: 1.5; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
.pp-bar { opacity: 0.92; }
.pp-cross { stroke: rgba(255, 255, 255, 0.45); stroke-width: 1; shape-rendering: crispEdges; pointer-events: none; }
.pp-dot { fill: var(--pp-surface-0); stroke-width: 2; pointer-events: none; }

/* ---------- time axis ---------- */
.pp-axis { position: relative; height: 22px; border-top: 1px solid var(--pp-hairline); background: var(--pp-surface-0); }
.pp-axis span { position: absolute; top: 6px; transform: translateX(-50%); font: 500 10px var(--pp-mono); color: var(--pp-text-faint); white-space: nowrap; }

@media (prefers-reduced-motion: reduce) { .pp-studio__focus { animation: none; } }
@media (max-width: 720px) { .pp-ribbon { grid-template-columns: repeat(2, minmax(0, 1fr)); } .pp-ribbon__card:nth-child(odd) { border-left: 0; } }
```

---

## 5. R03 `/performance` · 2-Tier Bento Telemetry Workbench

### 5.1 Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ BAR      Analyzer      [1m 5m 15m 35m]   [Pause]  [Raw samples]          │ 44px
├──────────────────────────────────────────────────────────────────────────┤
│ READOUT  15:16:57 SCRUB │ TPS 20.0 │ MSPT 7.4 · p95 8.9 · p99 10.7 │ …   │ 36px, sticky, ONE
├──────────────────────────────────────────────────────────────────────────┤
│ TIER 1   Ribbon (tick group, 5 tabs)                                     │ 72px
│          Primary Stage: selected signal, full width                      │ 280px
│          TimeAxis (the ONLY clock axis)                                  │ 22px
├─────────────────────────────────┬────────────────────────────────────────┤
│ TIER 2   02 · GC pauses Δ       │ 03 · Memory tiers (3 lanes, 1 scale)   │
│          1 lane                 │ heap / committed / cgroup              │ ~200px
├─────────────────────────────────┼────────────────────────────────────────┤
│          04 · Service & node CPU│ 05 · Chunks & entities                 │ ~200px
│          2 lanes                │ 2 lanes                                │
├─────────────────────────────────┴────────────────────────────────────────┤
│ FOOT     America/Sao_Paulo · 614 retained samples · 2h shows retained…   │
└──────────────────────────────────────────────────────────────────────────┘
```

Hairline dividers come from `gap: 1px` on a hairline-coloured grid background, with no per-cell borders.

### 5.2 `ReadoutBar.tsx` (the single readout)

```tsx
// src/telemetry/ReadoutBar.tsx
import { useMemo } from 'react';
import { SERIES, SeriesKey, Sample, sampleAt } from './series';
import { useCrosshair } from './crosshair';

const SEGMENTS: { label: string; keys: SeriesKey[] }[] = [
  { label: 'Tick',    keys: ['tps', 'mean', 'p95', 'p99'] },
  { label: 'GC',      keys: ['gc'] },
  { label: 'Memory',  keys: ['heapUsed', 'committed', 'cgroup'] },
  { label: 'CPU',     keys: ['svcCpu', 'nodeCpu'] },
  { label: 'World',   keys: ['chunks', 'entities'] },
];

export function ReadoutBar({ samples, tz }: { samples: Sample[]; tz: string }) {
  const hoverT = useCrosshair();
  const s = hoverT == null ? samples[samples.length - 1] : sampleAt(samples, hoverT);
  const clock = useMemo(
    () => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }),
    [tz],
  );
  if (!s) return <div className="pp-readout-bar" data-testid="readout-bar" />;
  const scrub = hoverT != null;

  return (
    <div className="pp-readout-bar" data-state={scrub ? 'scrub' : 'live'} data-testid="readout-bar" role="status" aria-live="off">
      <span className="pp-readout-bar__clock">{clock.format(s.t)}</span>
      <span className="pp-readout-bar__mode">{scrub ? 'SCRUB' : 'LIVE'}</span>
      {SEGMENTS.map(seg => (
        <span className="pp-readout-bar__seg" key={seg.label}>
          <i>{seg.label}</i>
          {seg.keys.map(k => {
            const spec = SERIES[k];
            return (
              <span key={k} data-series={k} className="pp-readout-bar__kv">
                <em>{spec.label.replace(' MSPT', '').replace(' pauses Δ', ' Δ')}</em>
                <b>{spec.fmt(spec.accessor(s))}</b>
                {spec.unit && <small>{spec.unit}</small>}
              </span>
            );
          })}
        </span>
      ))}
    </div>
  );
}
```

### 5.3 `DeckCell.tsx`

```tsx
// src/telemetry/DeckCell.tsx
import { SERIES, Sample, SeriesKey } from './series';
import { Stage } from './Stage';

export function DeckCell({
  index, title, keys, samples, domainT, rangeLabel,
}: {
  index: string; title: string; keys: SeriesKey[];
  samples: Sample[]; domainT: [number, number]; rangeLabel: string;
}) {
  return (
    <article className="pp-deck__cell" data-testid={`deck-${index}`}>
      <header className="pp-deck__head">
        <span>{index}</span>
        <h3>{title}</h3>
      </header>
      <div className="pp-deck__lanes">
        {keys.map(k => (
          // every lane = exactly one series; lanes are divided by hairlines, never layered
          <Stage key={k} spec={SERIES[k]} samples={samples} domainT={domainT} height="fill" minHeight={keys.length > 2 ? 44 : 64} />
        ))}
      </div>
      <footer className="pp-deck__edge" aria-hidden="true">
        <span>−{rangeLabel}</span><span>now</span>
      </footer>
    </article>
  );
}
```

### 5.4 `PerformanceWorkbench.tsx`

```tsx
// src/telemetry/PerformanceWorkbench.tsx
import { useMemo, useState } from 'react';
import { GROUPS, SERIES, Sample, SeriesKey, timeDomain } from './series';
import { Ribbon } from './Ribbon';
import { Stage } from './Stage';
import { TimeAxis } from './TimeAxis';
import { ReadoutBar } from './ReadoutBar';
import { DeckCell } from './DeckCell';
import { useSessionState } from './hooks';

const RANGES = [['1m', 60_000], ['5m', 300_000], ['15m', 900_000], ['35m', 2_100_000], ['2h', 7_200_000]] as const;

export function PerformanceWorkbench({
  samples, tz, paused, onTogglePause, onRawSamples,
}: {
  samples: Sample[]; tz: string; paused: boolean;
  onTogglePause: () => void; onRawSamples: () => void;
}) {
  const [range, setRange] = useSessionState<string>('pp.perf.range', '1m');
  const [selected, setSelected] = useSessionState<SeriesKey>('pp.perf.signal', 'tps');
  const rangeMs = RANGES.find(r => r[0] === range)?.[1] ?? 60_000;

  const windowed = useMemo(() => {
    if (!samples.length) return samples;
    const cut = samples[samples.length - 1].t - rangeMs;
    return samples.filter(s => s.t >= cut);
  }, [samples, rangeMs]);
  const domainT = useMemo(() => timeDomain(windowed, rangeMs), [windowed, rangeMs]);
  const tick = GROUPS[0];

  return (
    <section className="pp-bench" aria-label="Performance workbench">
      <header className="pp-bench__bar">
        <h2>Analyzer</h2>
        <div className="pp-bench__spacer" />
        <div className="pp-seg" role="group" aria-label="Range">
          {RANGES.map(([id]) => (
            <button key={id} data-active={id === range || undefined} onClick={() => setRange(id)}>{id}</button>
          ))}
        </div>
        <button className="pp-btn" onClick={onTogglePause}>{paused ? 'Resume' : 'Pause'}</button>
        <button className="pp-btn" onClick={onRawSamples}>Raw samples</button>
      </header>

      <ReadoutBar samples={windowed} tz={tz} />

      {/* TIER 1: primary selected-signal stage */}
      <div className="pp-bench__primary">
        <Ribbon keys={tick.series} selected={tick.series.includes(selected) ? selected : 'tps'} onSelect={setSelected} samples={windowed} />
        <div key={selected} className="pp-bench__primary-stage">
          <Stage spec={SERIES[tick.series.includes(selected) ? selected : 'tps']} samples={windowed} domainT={domainT} height={280} kicker="01 · SELECTED" selected />
        </div>
        <TimeAxis domainT={domainT} tz={tz} />
      </div>

      {/* TIER 2: 2x2 hairline-divided subsystem deck */}
      <div className="pp-deck">
        <DeckCell index="02" title="GC pauses · interval Δ" keys={['gc']} samples={windowed} domainT={domainT} rangeLabel={range} />
        <DeckCell index="03" title="Memory tiers · GiB" keys={['heapUsed', 'committed', 'cgroup']} samples={windowed} domainT={domainT} rangeLabel={range} />
        <DeckCell index="04" title="Service and node CPU · %" keys={['svcCpu', 'nodeCpu']} samples={windowed} domainT={domainT} rangeLabel={range} />
        <DeckCell index="05" title="Loaded chunks and entities" keys={['chunks', 'entities']} samples={windowed} domainT={domainT} rangeLabel={range} />
      </div>

      <footer className="pp-bench__foot">
        {tz} · {samples.length} retained samples
        {rangeMs > 2_100_000 && ' · 2h requests show only retained history (35m maximum)'}
      </footer>
    </section>
  );
}
```

### 5.5 CSS: bench, readout bar, deck (`workbench.css`)

```css
/* src/telemetry/workbench.css */
.pp-bench { display: flex; flex-direction: column; border: 1px solid var(--pp-hairline-strong); border-radius: 14px; background: var(--pp-surface-1); overflow: clip; }
.pp-bench__bar { display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 14px; border-bottom: 1px solid var(--pp-hairline); }
.pp-bench__bar h2 { margin: 0; font: 600 14px/1 system-ui, sans-serif; color: var(--pp-text); }
.pp-bench__spacer { flex: 1; }
.pp-btn { font: 500 12px/1 system-ui, sans-serif; color: var(--pp-text); padding: 8px 12px; border: 1px solid var(--pp-hairline-strong); border-radius: 8px; background: var(--pp-surface-2); cursor: pointer; }
.pp-btn:hover { background: var(--pp-surface-3); }
.pp-bench__primary { border-bottom: 1px solid var(--pp-hairline); }
.pp-bench__primary-stage { animation: pp-swap 140ms ease-out; }
.pp-bench__foot { padding: 8px 14px; border-top: 1px solid var(--pp-hairline); font: 500 11px var(--pp-mono); color: var(--pp-text-faint); }

/* ---- single shared readout bar ---- */
.pp-readout-bar {
  position: sticky; top: 0; z-index: 5;
  display: flex; align-items: center; gap: 0; height: 36px; padding: 0 14px;
  overflow-x: auto; white-space: nowrap; scrollbar-width: none;
  border-bottom: 1px solid var(--pp-hairline);
  background: color-mix(in srgb, var(--pp-surface-0) 92%, transparent);
  backdrop-filter: blur(8px);
  font: 500 11px var(--pp-mono); color: var(--pp-text-dim);
}
.pp-readout-bar::-webkit-scrollbar { display: none; }
.pp-readout-bar__clock { color: var(--pp-text); font-weight: 600; margin-right: 8px; font-variant-numeric: tabular-nums; }
.pp-readout-bar__mode { padding: 3px 6px; margin-right: 12px; border-radius: 4px; font-size: 9px; letter-spacing: 0.1em; color: var(--pp-c-tps); background: rgba(52, 211, 153, 0.12); }
.pp-readout-bar[data-state="scrub"] .pp-readout-bar__mode { color: var(--pp-c-p99); background: rgba(251, 191, 36, 0.12); }
.pp-readout-bar__seg { display: inline-flex; align-items: baseline; gap: 10px; padding: 0 12px; border-left: 1px solid var(--pp-hairline); }
.pp-readout-bar__seg > i { font-style: normal; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--pp-text-faint); }
.pp-readout-bar__kv em { font-style: normal; margin-right: 4px; color: var(--pp-text-dim); }
.pp-readout-bar__kv b { color: var(--pp-accent); font-variant-numeric: tabular-nums; }
.pp-readout-bar__kv small { margin-left: 2px; font-size: 9px; color: var(--pp-text-faint); }

/* ---- 2x2 hairline deck ---- */
.pp-deck { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: minmax(200px, auto); gap: 1px; background: var(--pp-hairline); }
.pp-deck__cell { display: flex; flex-direction: column; min-width: 0; min-height: 200px; background: var(--pp-surface-0); }
.pp-deck__head { display: flex; align-items: baseline; gap: 8px; padding: 10px 14px 4px; font: 600 10px/1 var(--pp-mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--pp-text-faint); }
.pp-deck__head h3 { margin: 0; font: inherit; color: var(--pp-text-dim); }
.pp-deck__lanes { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }
.pp-deck__lanes > .pp-stage + .pp-stage { border-top: 1px solid var(--pp-hairline); }
.pp-deck__edge { display: flex; justify-content: space-between; padding: 4px 46px 8px 12px; font: 500 10px var(--pp-mono); color: var(--pp-text-faint); }

/* compact stage tuning inside the deck */
.pp-deck .pp-stage__head { padding-top: 6px; }
.pp-deck .pp-stage__value { font-size: 12px; }

@media (max-width: 960px) { .pp-deck { grid-template-columns: minmax(0, 1fr); } }
```

### 5.6 Deletions (must be completed)

- Delete the `.pp-chart-readout` selector, element and any `position:absolute` tooltip code.
- Delete every multi-series track component (the old 5-row Track stack and any `areas=[...]` prop).
- Delete per-track axis rendering. Only `<TimeAxis>` under the primary stage remains.
- Route `/performance` renders `<PerformanceWorkbench>`; `/overview` renders `<TelemetryStudio>`.

---

## 6. Unified Boot Player Event Stream: `player-events.ts`

### 6.1 Rules

1. **One bucket per `bootId`** (the epoch shown in the top bar, e.g. `445990ff`). A new `bootId` creates a new bucket; the last two buckets are retained.
2. Three ingest paths feed the same bucket: **retained presence deltas**, **roster snapshots**, **console lines** (history **and** live).
3. A roster snapshot **only diffs** against the previous roster and appends join/leave events. It **never clears or replaces** events.
4. Players already online when the panel opens get a **synthesized `online` event** at read time from their `sessionStartedAt`, so the dock is never empty while the roster is non-empty.
5. Dedupe is by `(kind, player, time window, detail)` with source priority `console > presence > roster`; detail is merged from the loser.
6. Gate on `players.view` for display. `players.history.view` only gates fetching older history ("Load earlier").
7. Mount the feeder at **app-shell level** so events accumulate even when the user is on another route.
8. Never display IP addresses. The `logged in … /ip:port` console line is parsed for a login time only.

### 6.2 `player-events.ts`

```ts
// src/players/player-events.ts
import { useMemo, useSyncExternalStore } from 'react';

/* ───────────────────────── types ───────────────────────── */
export type PlayerEventKind = 'join' | 'leave' | 'advancement' | 'death' | 'command' | 'online';
export type PlayerEventSource = 'presence' | 'console' | 'roster';

export interface PlayerEvent {
  id: string;
  bootId: string;
  ts: number;                 // epoch ms UTC
  kind: PlayerEventKind;
  player: string;
  detail?: string;
  source: PlayerEventSource;
}

export interface ConsoleLine {
  seq: number;
  ts?: number;                // epoch ms when the host provides it
  clock?: string;             // "HH:MM:SS" in the host/display timezone when ts is missing
  level?: string;
  text: string;
}
export interface RosterPlayer { name: string; uuid?: string; sessionStartedAt?: number; }
export interface PresenceDelta { ts: number; kind: 'join' | 'leave'; player: string; uuid?: string; }
export interface ParseCtx { bootId: string; tz: string; anchor: number; }

/* ───────────────────────── text cleaning & clock ───────────────────────── */
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
const MC_COLOR = /§[0-9a-fk-or]/gi;
export const cleanLine = (s: string) => s.replace(ANSI, '').replace(MC_COLOR, '').trim();

/** "[15:14:15 INFO]: x"  or  "[15:14:15] [Server thread/INFO]: x" */
const PREFIX = /^\[(\d{2}:\d{2}:\d{2})(?: (?:INFO|WARN|ERROR|DEBUG))?\](?: \[[^\]]+\])?:?\s*/;
/** Floodgate/Bedrock names may start with "."; Java names are 3-16 of [A-Za-z0-9_] */
const NAME = '(\\.?[A-Za-z0-9_]{1,16})';

function tzOffsetMs(at: number, tz: string): number {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const g = (t: string) => Number(p.find(x => x.type === t)!.value);
  return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - Math.floor(at / 1000) * 1000;
}

/** Turn "15:18:20" (display tz) into epoch ms near `anchor` (never in the future by >60s). */
export function resolveClock(clock: string, anchor: number, tz: string): number {
  const [h, m, s] = clock.split(':').map(Number);
  const off = tzOffsetMs(anchor, tz);
  const local = new Date(anchor + off);
  let t = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), h, m, s) - off;
  if (t > anchor + 60_000) t -= 86_400_000;
  return t;
}

/* ───────────────────────── console rules ───────────────────────── */
const DEATH = [
  'was (?:slain|shot|killed|blown up|pummeled|pricked|impaled|squashed|fireballed|doomed|burnt|struck|skewered|stung|poked|obliterated|squished|knocked)',
  'drowned', 'died', 'suffocated', 'starved', 'withered away', 'froze to death', 'burned to death', 'blew up',
  'fell (?:from|off|out|while)', 'hit the ground too hard', 'tried to swim in lava', 'went up in flames',
  'walked into (?:fire|a cactus)', 'experienced kinetic energy', 'discovered the floor was lava', 'didn.t want to live',
  'left the confines', 'was (?:killed|pricked) by', 'fell out of the world',
].join('|');

interface Rule { kind: PlayerEventKind; re: RegExp; detail?: (m: RegExpExecArray) => string | undefined }

const RULES: Rule[] = [
  // Companion-plugin tagged lines: "[Advancement] Name: Stone Age", "[Death] Name fell from a high place", "[Command] Name: /gamemode creative"
  { kind: 'advancement', re: new RegExp(`^\\[Advancement\\]\\s+${NAME}\\s*[:\\-–]?\\s*(.*)$`),
    detail: m => m[2].replace(/^has (?:made the advancement|completed the challenge|reached the goal)\s*/i, '').replace(/^\[|\]$/g, '').trim() || undefined },
  { kind: 'death', re: new RegExp(`^\\[Death\\]\\s+${NAME}\\s*[:\\-–]?\\s*(.*)$`), detail: m => m[2].trim() || undefined },
  { kind: 'command', re: new RegExp(`^\\[Command\\]\\s+${NAME}\\s*[:\\-–]?\\s*(.*)$`), detail: m => m[2].trim() || undefined },

  // Vanilla / Paper
  { kind: 'advancement', re: new RegExp(`^${NAME} has (?:made the advancement|completed the challenge|reached the goal) \\[(.+)\\]$`), detail: m => m[2] },
  { kind: 'command', re: new RegExp(`^${NAME} issued server command: (\\/.+)$`), detail: m => m[2] },
  { kind: 'join', re: new RegExp(`^${NAME} joined the game$`) },
  { kind: 'join', re: new RegExp(`^${NAME}\\[\\/[^\\]]+\\] logged in with entity id \\d+ at \\(.*\\)$`) }, // login time only; the IP is dropped
  { kind: 'leave', re: new RegExp(`^${NAME} lost connection: (.+)$`), detail: m => m[2] },
  { kind: 'leave', re: new RegExp(`^${NAME} left the game$`) },
  { kind: 'death', re: new RegExp(`^${NAME} (?:${DEATH})(?:\\s.*)?$`), detail: m => m[0].slice(m[1].length).trim() },
];

export function parseConsoleLine(line: ConsoleLine, ctx: ParseCtx): PlayerEvent | null {
  let text = cleanLine(line.text);
  let clock = line.clock;
  const pm = PREFIX.exec(text);
  if (pm) { clock ??= pm[1]; text = text.slice(pm[0].length); }
  if (!text || text.startsWith('<') || text.startsWith('[Not Secure]')) return null; // chat is never an event

  for (const rule of RULES) {
    const m = rule.re.exec(text);
    if (!m) continue;
    const ts = line.ts ?? (clock ? resolveClock(clock, ctx.anchor, ctx.tz) : ctx.anchor);
    return {
      id: `${ctx.bootId}:c:${line.seq}`,
      bootId: ctx.bootId, ts, kind: rule.kind, player: m[1],
      detail: rule.detail?.(m), source: 'console',
    };
  }
  return null;
}

/* ───────────────────────── store ───────────────────────── */
const WINDOW_MS: Record<PlayerEventKind, number> = {
  join: 15_000, leave: 15_000, online: 15_000, advancement: 2_000, death: 2_000, command: 2_000,
};
const RANK: Record<PlayerEventSource, number> = { console: 3, presence: 2, roster: 1 };
const MAX_EVENTS = 500;
const DETAIL_KINDS = new Set<PlayerEventKind>(['advancement', 'death', 'command']);

interface Bucket {
  bootId: string;
  events: PlayerEvent[];          // newest first
  roster: Map<string, RosterPlayer>;
  rosterSeeded: boolean;
  seenConsoleSeq: Set<number>;
  version: number;
}

const buckets = new Map<string, Bucket>();
const order: string[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

function bucket(bootId: string): Bucket {
  let b = buckets.get(bootId);
  if (!b) {
    b = { bootId, events: [], roster: new Map(), rosterSeeded: false, seenConsoleSeq: new Set(), version: 0 };
    buckets.set(bootId, b);
    order.push(bootId);
    while (order.length > 2) buckets.delete(order.shift()!);
  }
  return b;
}

function insert(b: Bucket, ev: PlayerEvent) {
  const win = WINDOW_MS[ev.kind];
  const dup = b.events.find(e =>
    e.kind === ev.kind &&
    e.player.toLowerCase() === ev.player.toLowerCase() &&
    Math.abs(e.ts - ev.ts) <= win &&
    (!DETAIL_KINDS.has(ev.kind) || (e.detail ?? '') === (ev.detail ?? '')),
  );
  if (dup) {
    if (RANK[ev.source] > RANK[dup.source]) { dup.ts = ev.ts; dup.source = ev.source; dup.id = ev.id; }
    dup.detail ??= ev.detail;           // e.g. keep "Disconnected" from "lost connection"
    return;
  }
  b.events.push(ev);
  b.events.sort((a, c) => c.ts - a.ts);
  if (b.events.length > MAX_EVENTS) b.events.length = MAX_EVENTS;
}

/* ── ingest 1: console history + live stream (idempotent by seq) ── */
export function ingestConsole(bootId: string, lines: ConsoleLine[], ctx: Omit<ParseCtx, 'bootId'>) {
  const b = bucket(bootId);
  let changed = false;
  for (const line of lines) {
    if (b.seenConsoleSeq.has(line.seq)) continue;
    b.seenConsoleSeq.add(line.seq);
    const ev = parseConsoleLine(line, { ...ctx, bootId });
    if (ev) { insert(b, ev); changed = true; }
  }
  if (b.seenConsoleSeq.size > 20_000) b.seenConsoleSeq = new Set([...b.seenConsoleSeq].slice(-10_000));
  if (changed) { b.version++; notify(); }
}

/* ── ingest 2: retained presence deltas from the Host ── */
export function ingestPresence(bootId: string, deltas: PresenceDelta[]) {
  const b = bucket(bootId);
  for (const d of deltas) {
    insert(b, { id: `${bootId}:p:${d.kind}:${d.player}:${d.ts}`, bootId, ts: d.ts, kind: d.kind, player: d.player, source: 'presence' });
  }
  if (deltas.length) { b.version++; notify(); }
}

/* ── ingest 3: roster snapshots. DIFF ONLY. NEVER CLEAR EVENTS. ── */
export function ingestRoster(bootId: string, players: RosterPlayer[], now = Date.now()) {
  const b = bucket(bootId);
  const next = new Map(players.map(p => [p.name.toLowerCase(), p]));
  if (b.rosterSeeded) {
    for (const [key, p] of next) {
      if (!b.roster.has(key)) insert(b, { id: `${bootId}:r:join:${p.name}:${now}`, bootId, ts: p.sessionStartedAt ?? now, kind: 'join', player: p.name, source: 'roster' });
    }
    for (const [key, p] of b.roster) {
      if (!next.has(key)) insert(b, { id: `${bootId}:r:leave:${p.name}:${now}`, bootId, ts: now, kind: 'leave', player: p.name, source: 'roster' });
    }
  }
  b.roster = next;
  b.rosterSeeded = true;
  b.version++;
  notify();
}

/* ── read: events + synthesized "online" rows for players with no known join ── */
export function selectEvents(bootId: string | undefined, now = Date.now()): PlayerEvent[] {
  if (!bootId) return [];
  const b = buckets.get(bootId);
  if (!b) return [];
  const out = [...b.events];
  for (const p of b.roster.values()) {
    const since = p.sessionStartedAt ?? now;
    const hasJoin = b.events.some(e => e.kind === 'join' && e.player.toLowerCase() === p.name.toLowerCase() && e.ts >= since - 15_000);
    if (!hasJoin) out.push({ id: `${bootId}:o:${p.name}`, bootId, ts: since, kind: 'online', player: p.name, detail: 'Online since panel opened', source: 'roster' });
  }
  return out.sort((a, c) => c.ts - a.ts);
}

export function usePlayerEvents(bootId: string | undefined) {
  const version = useSyncExternalStore(
    l => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => (bootId ? buckets.get(bootId)?.version ?? 0 : 0),
    () => 0,
  );
  return useMemo(() => selectEvents(bootId), [bootId, version]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** test helper */
export function __resetPlayerEvents() { buckets.clear(); order.length = 0; }
```

### 6.3 Wiring (app shell, not a route component)

```tsx
// src/players/PlayerEventsFeeder.tsx
import { useEffect } from 'react';
import { ingestConsole, ingestPresence, ingestRoster } from './player-events';

/**
 * Mount ONCE in the authenticated app shell so events keep accumulating across routes.
 * Replace the `host` calls with the repo's actual Host client / store selectors.
 */
export function PlayerEventsFeeder({ bootId, tz, host, can }: {
  bootId?: string; tz: string;
  host: {
    onConsoleHistory(cb: (lines: any[]) => void): () => void;   // Host `console.history`
    onConsoleLive(cb: (line: any) => void): () => void;         // live `s.console`
    onPlayersInventory(cb: (players: any[]) => void): () => void; // `inventory.players`
    onPresenceDeltas(cb: (deltas: any[]) => void): () => void;
  };
  can: (perm: string) => boolean;
}) {
  const allowed = can('players.view');            // <- was players.history.view (the bug)

  useEffect(() => {
    if (!bootId || !allowed) return;
    const ctx = () => ({ tz, anchor: Date.now() });
    const offs = [
      host.onConsoleHistory(lines => ingestConsole(bootId, lines, ctx())),
      host.onConsoleLive(line => ingestConsole(bootId, [line], ctx())),
      host.onPlayersInventory(players => ingestRoster(bootId, players)),   // diff only, never wipes
      host.onPresenceDeltas(deltas => ingestPresence(bootId, deltas)),
    ];
    return () => offs.forEach(off => off());
  }, [bootId, allowed, tz, host]);

  return null;
}

// "Load earlier" is the ONLY thing players.history.view gates:
//   const canLoadEarlier = can('players.history.view');
```

Notes for wiring:
- The console dock already receives history + live lines; **reuse that same subscription** instead of opening a second stream. If a user lacks console permission and the Host does not send console lines, the stream still works from presence deltas and roster. Do not add client-side gating on console-derived events beyond what the Host sends.
- When `bootId` changes (server restart), the old bucket is kept for the previous boot only; the dock shows the current boot.

### 6.4 `PlayerEventsDock.tsx`

```tsx
// src/players/PlayerEventsDock.tsx
import { useMemo, useState } from 'react';
import { PlayerEvent, PlayerEventKind, usePlayerEvents } from './player-events';

const FILTERS: { id: 'all' | PlayerEventKind | 'presence'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'presence', label: 'Joins & leaves' },
  { id: 'advancement', label: 'Advancements' },
  { id: 'death', label: 'Deaths' },
  { id: 'command', label: 'Commands' },
];

const GLYPH: Record<PlayerEventKind, { icon: string; verb: string }> = {
  join: { icon: '→', verb: 'joined' },
  online: { icon: '●', verb: 'is online' },
  leave: { icon: '←', verb: 'left' },
  advancement: { icon: '★', verb: 'earned' },
  death: { icon: '✕', verb: 'died' },
  command: { icon: '/', verb: 'ran' },
};

export function PlayerEventsDock({ bootId, tz, rosterCount }: { bootId?: string; tz: string; rosterCount: number }) {
  const events = usePlayerEvents(bootId);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const clock = useMemo(
    () => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }),
    [tz],
  );

  const shown = events.filter(e =>
    filter === 'all' ? true
    : filter === 'presence' ? e.kind === 'join' || e.kind === 'leave' || e.kind === 'online'
    : e.kind === filter);

  return (
    <div className="pp-pe" data-testid="player-events">
      <div className="pp-pe__filters" role="group" aria-label="Filter player events">
        {FILTERS.map(f => (
          <button key={f.id} data-active={f.id === filter || undefined} onClick={() => setFilter(f.id)}>{f.label}</button>
        ))}
        <span className="pp-pe__count">{events.length} events · boot {bootId?.slice(0, 8)}</span>
      </div>

      {shown.length === 0 ? (
        <p className="pp-pe__empty">
          {rosterCount > 0 ? 'No matching events for this filter yet.' : 'No player activity on this boot yet.'}
        </p>
      ) : (
        <ol className="pp-pe__list">
          {shown.map((e: PlayerEvent) => (
            <li key={e.id} data-kind={e.kind} data-source={e.source}>
              <time dateTime={new Date(e.ts).toISOString()}>{clock.format(e.ts)}</time>
              <span className="pp-pe__icon" aria-hidden="true">{GLYPH[e.kind].icon}</span>
              <span className="pp-pe__text">
                <b>{e.player}</b> {GLYPH[e.kind].verb}
                {e.detail && <code>{e.detail}</code>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
```

```css
/* src/players/player-events.css */
.pp-pe { display: flex; flex-direction: column; min-height: 0; height: 100%; }
.pp-pe__filters { display: flex; align-items: center; gap: 4px; padding: 8px 12px; border-bottom: 1px solid var(--pp-hairline); }
.pp-pe__filters button { font: 500 11px/1 var(--pp-mono); padding: 6px 8px; border: 0; border-radius: 6px; color: var(--pp-text-dim); background: transparent; cursor: pointer; }
.pp-pe__filters button[data-active] { color: var(--pp-text); background: var(--pp-surface-3); }
.pp-pe__count { margin-left: auto; font: 500 10px var(--pp-mono); color: var(--pp-text-faint); }
.pp-pe__empty { margin: 0; padding: 20px 14px; font: 500 12px var(--pp-mono); color: var(--pp-text-faint); }
.pp-pe__list { list-style: none; margin: 0; padding: 0; overflow-y: auto; }
.pp-pe__list li { display: grid; grid-template-columns: 64px 18px 1fr; gap: 8px; align-items: baseline; padding: 7px 14px; border-bottom: 1px solid var(--pp-hairline); content-visibility: auto; contain-intrinsic-size: 0 32px; }
.pp-pe__list time { font: 500 11px var(--pp-mono); color: var(--pp-text-faint); font-variant-numeric: tabular-nums; }
.pp-pe__icon { text-align: center; font: 600 12px var(--pp-mono); color: var(--pp-text-dim); }
.pp-pe__text { font: 400 13px/1.35 system-ui, sans-serif; color: var(--pp-text-dim); }
.pp-pe__text b { color: var(--pp-text); font-weight: 600; }
.pp-pe__text code { margin-left: 8px; padding: 2px 6px; border-radius: 4px; font: 500 11px var(--pp-mono); color: var(--pp-text); background: var(--pp-surface-3); }
.pp-pe__list li[data-kind="join"] .pp-pe__icon, .pp-pe__list li[data-kind="online"] .pp-pe__icon { color: var(--pp-c-tps); }
.pp-pe__list li[data-kind="leave"] .pp-pe__icon { color: var(--pp-text-faint); }
.pp-pe__list li[data-kind="advancement"] .pp-pe__icon { color: var(--pp-c-p99); }
.pp-pe__list li[data-kind="death"] .pp-pe__icon { color: var(--pp-c-gc); }
.pp-pe__list li[data-kind="command"] .pp-pe__icon { color: var(--pp-c-commit); }
```

### 6.5 Unit tests (`player-events.test.ts`, vitest)

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetPlayerEvents, ingestConsole, ingestPresence, ingestRoster, parseConsoleLine, selectEvents,
} from './player-events';

const tz = 'America/Sao_Paulo';
const anchor = Date.UTC(2026, 9, 19, 18, 30, 0); // 15:30:00 in Sao Paulo
const ctx = { bootId: 'b1', tz, anchor };
const L = (seq: number, text: string) => ({ seq, text });

beforeEach(() => __resetPlayerEvents());

describe('parseConsoleLine', () => {
  it('parses join/leave/login/lost connection', () => {
    expect(parseConsoleLine(L(1, '[15:14:20 INFO]: ZpkDxGames joined the game'), ctx)).toMatchObject({ kind: 'join', player: 'ZpkDxGames' });
    expect(parseConsoleLine(L(2, '[15:14:20 INFO]: ZpkDxGames[/10.0.0.5:5555] logged in with entity id 12 at (1.0, 64.0, 2.0)'), ctx)).toMatchObject({ kind: 'join' });
    expect(parseConsoleLine(L(3, '[15:20:00 INFO]: ZpkDxGames lost connection: Disconnected'), ctx)).toMatchObject({ kind: 'leave', detail: 'Disconnected' });
    expect(parseConsoleLine(L(4, '[15:20:00 INFO]: ZpkDxGames left the game'), ctx)).toMatchObject({ kind: 'leave' });
  });
  it('never exposes the ip address', () => {
    const ev = parseConsoleLine(L(2, '[15:14:20 INFO]: A[/10.0.0.5:5555] logged in with entity id 12 at (1.0, 64.0, 2.0)'), ctx)!;
    expect(JSON.stringify(ev)).not.toContain('10.0.0.5');
  });
  it('parses advancements, deaths and commands (vanilla and tagged)', () => {
    expect(parseConsoleLine(L(5, '[15:21:00 INFO]: Steve has made the advancement [Stone Age]'), ctx)).toMatchObject({ kind: 'advancement', detail: 'Stone Age' });
    expect(parseConsoleLine(L(6, '[Advancement] Steve: Diamonds!'), ctx)).toMatchObject({ kind: 'advancement', detail: 'Diamonds!' });
    expect(parseConsoleLine(L(7, '[15:22:00 INFO]: Steve fell from a high place'), ctx)).toMatchObject({ kind: 'death' });
    expect(parseConsoleLine(L(8, '[Death] Steve was slain by Zombie'), ctx)).toMatchObject({ kind: 'death', detail: 'was slain by Zombie' });
    expect(parseConsoleLine(L(9, '[15:23:00 INFO]: Steve issued server command: /gamemode creative'), ctx)).toMatchObject({ kind: 'command', detail: '/gamemode creative' });
    expect(parseConsoleLine(L(10, '[Command] Steve: /tp 0 64 0'), ctx)).toMatchObject({ kind: 'command', detail: '/tp 0 64 0' });
  });
  it('ignores chat and noise', () => {
    expect(parseConsoleLine(L(11, '[15:24:00 INFO]: <Steve> I died lol'), ctx)).toBeNull();
    expect(parseConsoleLine(L(12, '[15:24:00 INFO]: [Not Secure] <Steve> joined the game'), ctx)).toBeNull();
    expect(parseConsoleLine(L(13, '[15:24:00 WARN]: Advanced terminal features are not available'), ctx)).toBeNull();
  });
  it('resolves the HH:MM:SS clock in the display timezone', () => {
    const ev = parseConsoleLine(L(14, '[15:14:20 INFO]: A joined the game'), ctx)!;
    expect(new Date(ev.ts).toISOString()).toBe('2026-10-19T18:14:20.000Z');
  });
});

describe('store', () => {
  it('dedupes login + join + presence delta into one event', () => {
    ingestConsole('b1', [L(1, '[15:14:20 INFO]: A[/1.1.1.1:1] logged in with entity id 1 at (0, 0, 0)'), L(2, '[15:14:20 INFO]: A joined the game')], { tz, anchor });
    ingestPresence('b1', [{ ts: Date.UTC(2026, 9, 19, 18, 14, 24), kind: 'join', player: 'A' }]);
    expect(selectEvents('b1').filter(e => e.kind === 'join')).toHaveLength(1);
  });
  it('merges the lost-connection reason into the leave event', () => {
    ingestConsole('b1', [L(1, '[15:20:00 INFO]: A lost connection: Timed out'), L(2, '[15:20:00 INFO]: A left the game')], { tz, anchor });
    const leaves = selectEvents('b1').filter(e => e.kind === 'leave');
    expect(leaves).toHaveLength(1);
    expect(leaves[0].detail).toBe('Timed out');
  });
  it('roster snapshots never wipe retained events (regression for "Waiting for events")', () => {
    ingestPresence('b1', [{ ts: anchor - 60_000, kind: 'join', player: 'ZpkDxGames' }]);
    ingestRoster('b1', [{ name: 'ZpkDxGames', sessionStartedAt: anchor - 60_000 }], anchor);
    ingestRoster('b1', [{ name: 'ZpkDxGames', sessionStartedAt: anchor - 60_000 }], anchor + 5_000);
    ingestRoster('b1', [{ name: 'ZpkDxGames', sessionStartedAt: anchor - 60_000 }], anchor + 10_000);
    expect(selectEvents('b1').length).toBeGreaterThan(0);
  });
  it('synthesizes an "online" row for a player already on the roster', () => {
    ingestRoster('b1', [{ name: 'ZpkDxGames', sessionStartedAt: anchor - 180_000 }], anchor);
    const evs = selectEvents('b1');
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ kind: 'online', player: 'ZpkDxGames' });
  });
  it('console ingest is idempotent by seq', () => {
    const lines = [L(1, '[15:14:20 INFO]: A joined the game')];
    ingestConsole('b1', lines, { tz, anchor });
    ingestConsole('b1', lines, { tz, anchor });
    expect(selectEvents('b1')).toHaveLength(1);
  });
  it('a new boot starts a fresh bucket', () => {
    ingestPresence('b1', [{ ts: anchor, kind: 'join', player: 'A' }]);
    expect(selectEvents('b2')).toHaveLength(0);
  });
});
```

---

## 7. QA gate (must pass before "done")

### 7.1 Playwright (`e2e/telemetry.spec.ts`)

```ts
import { expect, test } from '@playwright/test';

const SIGNALS = ['tps', 'mean', 'p95', 'p99', 'gc'] as const;

test('Studio: clicking a ribbon card isolates that signal', async ({ page }) => {
  await page.goto('/overview');
  await page.getByRole('button', { name: 'Focus' }).click();
  for (const key of SIGNALS) {
    await page.getByTestId(`ribbon-${key}`).click();
    await expect(page.getByTestId(`ribbon-${key}`)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.pp-studio .pp-stage')).toHaveCount(1);
    await expect(page.locator('.pp-studio .pp-stage')).toHaveAttribute('data-series', key);
    expect(await page.locator('.pp-studio .pp-stage path.pp-area').count()).toBeLessThanOrEqual(1);
  }
});

test('Studio: split view is one series per stage, no overlap', async ({ page }) => {
  await page.goto('/overview');
  await page.getByRole('button', { name: 'Split' }).click();
  await expect(page.locator('.pp-studio .pp-stage')).toHaveCount(5);
  const perStage = await page.$$eval('.pp-studio .pp-stage', els =>
    els.map(e => e.querySelectorAll('path.pp-area').length + (e.querySelector('rect.pp-bar') ? 1 : 0)));
  expect(perStage.every(n => n <= 1)).toBe(true);
});

test('Workbench: single readout, single axis, shared crosshair', async ({ page }) => {
  await page.goto('/performance');
  await expect(page.locator('.pp-chart-readout')).toHaveCount(0);
  await expect(page.getByTestId('readout-bar')).toHaveCount(1);
  await expect(page.locator('.pp-axis')).toHaveCount(1);
  await expect(page.locator('.pp-deck .pp-deck__cell')).toHaveCount(4);
  await expect(page.locator('.pp-bench .pp-stage')).toHaveCount(9); // 1 primary + 1 + 3 + 2 + 2

  const plot = page.locator('.pp-bench__primary .pp-stage__plot');
  const box = (await plot.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await expect(page.getByTestId('readout-bar')).toHaveAttribute('data-state', 'scrub');

  // every stage shows a crosshair; no floating black boxes anywhere
  await expect(page.locator('.pp-bench .pp-cross')).toHaveCount(9);
  const overlaps = await page.$$eval('.pp-bench .pp-stage', els =>
    els.filter(e => e.querySelectorAll('path.pp-area').length > 1).length);
  expect(overlaps).toBe(0);
});

test('Player events: shows the online roster player, never "Waiting"', async ({ page }) => {
  await page.goto('/overview');
  await page.getByRole('tab', { name: 'Player events' }).click();
  await expect(page.getByTestId('player-events')).not.toContainText('Waiting for events');
  await expect(page.getByTestId('player-events').locator('li').first()).toBeVisible();
});
```

### 7.2 Visual checklist (screenshot at 1555×916 and 1280×800)

- Studio: clicking each of the 5 ribbon cards visibly replaces the chart. Y-axis, colour and budget line change per signal. No `STAGE 0x` labels.
- `/performance`: primary stage on top, 2×2 deck beneath, hairline dividers only (no card shadows inside the deck), exactly one row of clock labels.
- Hover: a vertical line appears in all 9 stages at the same X, and the readout bar updates. No black floating boxes. Nothing clips across borders.
- MSPT budget (50 ms) is **off-scale** at normal load, so the chip `▲ 50 ms budget · off scale` appears instead of a squashed line.
- Memory lanes: 3 lanes on one shared scale; heights are comparable; no fill overlaps another fill.
- Player events with `ZpkDxGames` online shows at least an `● ZpkDxGames is online` row, plus real join/command/advancement/death rows as they stream in.

### 7.3 Definition of done

1. `tsc --noEmit`, `eslint`, `vitest run`, `playwright test e2e/telemetry.spec.ts` all green.
2. `grep -rn "pp-chart-readout" src/` returns nothing.
3. `grep -rn "players.history.view" src/` appears only on the "Load earlier" path.
4. No file in `src/telemetry` has a `series: SeriesSpec[]` prop on a stage.
5. PR description lists deleted components and the before/after screenshots.

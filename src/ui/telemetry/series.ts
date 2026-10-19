import type { TelemetryView } from "../bindings";
import { buildRows } from "../chart/scales";
export type SeriesKey =
  | "tps"
  | "mean"
  | "p95"
  | "p99"
  | "gc"
  | "heapUsed"
  | "committed"
  | "cgroup"
  | "svcCpu"
  | "nodeCpu"
  | "chunks"
  | "entities";
export type Sample = { t: number; epoch: string } & Partial<
  Record<SeriesKey, number | null>
>;
export interface SeriesSpec {
  key: SeriesKey;
  label: string;
  unit: string;
  kind: "area" | "bars";
  color: string;
  peak: "min" | "max";
  accessor: (s: Sample) => number | null;
  domain: (all: Sample[]) => [number, number];
  fmt: (v: number | null | undefined) => string;
  budget?: { value: number; label: string };
}
export type GroupId = "tick" | "memory" | "cpu";
export const GROUPS: { id: GroupId; label: string; series: SeriesKey[] }[] = [
  {
    id: "tick",
    label: "Tick & MSPT",
    series: ["tps", "mean", "p95", "p99", "gc"],
  },
  {
    id: "memory",
    label: "Memory tiers",
    series: ["heapUsed", "committed", "cgroup"],
  },
  {
    id: "cpu",
    label: "CPU & chunks",
    series: ["svcCpu", "nodeCpu", "chunks", "entities"],
  },
];
export const clamp = (v: number, a: number, b: number) =>
  Math.min(b, Math.max(a, v));
export function niceCeil(v: number) {
  if (!Number.isFinite(v) || v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v)),
    n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const values = (ss: Sample[], key: SeriesKey) =>
  ss.flatMap((s) => (finite(s[key]) ? [s[key] as number] : []));
const max = (ss: Sample[], keys: SeriesKey[]) =>
  Math.max(0, ...keys.flatMap((k) => values(ss, k)));
export const memDomain = (ss: Sample[]): [number, number] => [
  0,
  Math.max(1, niceCeil(max(ss, ["heapUsed", "committed", "cgroup"]) * 1.1)),
];
const format = (v: number | null | undefined) =>
  finite(v)
    ? v.toLocaleString("en-US", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    : "—";
const make = (
  key: SeriesKey,
  label: string,
  unit: string,
  color: string,
  domain: SeriesSpec["domain"],
  kind: SeriesSpec["kind"] = "area",
  peak: SeriesSpec["peak"] = "max",
): SeriesSpec => ({
  key,
  label,
  unit,
  color: `rgb(var(--${color}))`,
  domain,
  kind,
  peak,
  accessor: (s) => (finite(s[key]) ? (s[key] as number) : null),
  fmt:
    unit === ""
      ? (v) => (finite(v) ? Math.round(v).toLocaleString("en-US") : "—")
      : format,
});
const ms =
  (key: SeriesKey) =>
  (ss: Sample[]): [number, number] => [
    0,
    Math.max(16, niceCeil(max(ss, [key]) * 1.15)),
  ];
export const SERIES: Record<SeriesKey, SeriesSpec> = {
  tps: make(
    "tps",
    "TPS",
    "TPS",
    "emerald",
    (ss) => [Math.min(15, Math.floor(Math.min(20, ...values(ss, "tps")))), 20],
    "area",
    "min",
  ),
  mean: {
    ...make("mean", "Mean MSPT", "ms", "cyan", ms("mean")),
    budget: { value: 50, label: "50 ms budget" },
  },
  p95: {
    ...make("p95", "p95 MSPT", "ms", "violet", ms("p95")),
    budget: { value: 50, label: "50 ms budget" },
  },
  p99: {
    ...make("p99", "p99 MSPT", "ms", "amber", ms("p99")),
    budget: { value: 50, label: "50 ms budget" },
  },
  gc: make(
    "gc",
    "GC pauses Δ",
    "ms",
    "rose",
    (ss) => [0, Math.max(4, niceCeil(max(ss, ["gc"]) * 1.15))],
    "bars",
  ),
  heapUsed: make("heapUsed", "Heap used", "GiB", "violet", memDomain),
  committed: make("committed", "Committed", "GiB", "cyan", memDomain),
  cgroup: make("cgroup", "Cgroup", "GiB", "indigo", memDomain),
  svcCpu: make("svcCpu", "Service CPU", "%", "indigo", (ss) => [
    0,
    Math.max(100, niceCeil(max(ss, ["svcCpu"]) * 1.1)),
  ]),
  nodeCpu: make("nodeCpu", "Node CPU", "%", "cyan", () => [0, 100]),
  chunks: make("chunks", "Loaded chunks", "", "emerald", (ss) => [
    0,
    niceCeil(max(ss, ["chunks"]) * 1.1),
  ]),
  entities: make("entities", "Entities", "", "violet", (ss) => [
    0,
    niceCeil(max(ss, ["entities"]) * 1.1),
  ]),
};
export function seriesKey(key: string): SeriesKey {
  const aliases: Record<string, SeriesKey> = {
    mspt: "mean",
    heap: "heapUsed",
    cpu: "svcCpu",
    node: "nodeCpu",
    max: "committed",
    peak: "svcCpu",
  };
  return Object.hasOwn(SERIES, key)
    ? (key as SeriesKey)
    : Object.hasOwn(aliases, key)
      ? aliases[key]
      : "tps";
}
export function decimate<T>(
  xs: T[],
  limit: number,
  value: (s: T) => number,
  peak: "min" | "max",
): T[] {
  if (xs.length <= limit || limit < 3) return xs;
  const out = [xs[0]],
    count = limit - 2,
    size = (xs.length - 2) / count;
  for (let i = 0; i < count; i++) {
    const a = 1 + Math.floor(i * size),
      b = Math.min(xs.length - 1, 1 + Math.floor((i + 1) * size));
    let best = xs[a];
    for (let j = a + 1; j < b; j++)
      if (
        peak === "max" ? value(xs[j]) > value(best) : value(xs[j]) < value(best)
      )
        best = xs[j];
    out.push(best);
  }
  out.push(xs.at(-1)!);
  return out;
}
/** Missing values and source epochs remain explicit; independent source clocks are never interpolated. */
export function shapeTelemetry(
  data: Pick<TelemetryView, "paper" | "system" | "host" | "service">,
): Sample[] {
  const out: Sample[] = [];
  for (const [source, input, mapping] of [
    [
      "paper",
      data.paper,
      {
        tps: "tps",
        mean: "mspt",
        p95: "p95",
        p99: "p99",
        chunks: "chunks",
        entities: "entities",
      },
    ],
    [
      "system",
      data.system,
      { heapUsed: "heap", committed: "committed", gc: "gc" },
    ],
    ["host", data.host, { nodeCpu: "node" }],
    ["service", data.service, { svcCpu: "cpu", cgroup: "cgroup" }],
  ] as const) {
    const rows = buildRows(input, Infinity)[source];
    const gcDeltas = new Map<number, number | null>();
    if (source === "system") {
      let previous: (typeof input)[number] | undefined;
      for (const raw of [...input].sort((a, b) => a.at - b.at)) {
        gcDeltas.set(
          raw.at,
          previous &&
            raw.epoch === previous.epoch &&
            raw.at - previous.at <= 10000 &&
            finite(raw.gc) &&
            finite(previous.gc) &&
            raw.gc >= previous.gc
            ? raw.gc - previous.gc
            : null,
        );
        previous = raw;
      }
    }
    rows.forEach((row) => {
      const sample: Sample = { t: row.t, epoch: row.epoch };
      for (const [key, raw] of Object.entries(mapping)) {
        let v = row[raw];
        if (key === "gc") v = gcDeltas.get(row.t) ?? null;
        sample[key as SeriesKey] = finite(v) ? v : null;
      }
      out.push(sample);
    });
  }
  return out.sort((a, b) => a.t - b.t);
}
export function segments(ss: Sample[], key: SeriesKey): Sample[][] {
  const out: Sample[][] = [];
  let current: Sample[] = [];
  for (const s of ss) {
    if (!(key in s)) continue;
    const prev = current.at(-1);
    if (
      !finite(s[key]) ||
      (prev && (prev.epoch !== s.epoch || s.t - prev.t > 10000))
    ) {
      if (current.length) out.push(current);
      current = [];
    }
    if (finite(s[key])) current.push(s);
  }
  if (current.length) out.push(current);
  return out;
}
export function gapsFor(ss: Sample[], key: SeriesKey) {
  const gaps: { from: number; to: number }[] = [];
  let last: Sample | undefined,
    missing = false;
  for (const row of ss) {
    if (!(key in row)) continue;
    if (!finite(row[key])) {
      missing = true;
      continue;
    }
    if (last && (missing || row.epoch !== last.epoch || row.t - last.t > 10000))
      gaps.push({ from: last.t, to: row.t });
    last = row;
    missing = false;
  }
  return gaps;
}
export function sampleAt(
  ss: Sample[],
  t: number,
  key?: SeriesKey,
): Sample | undefined {
  if (!ss.length || !Number.isFinite(t)) return;
  let lo = 0,
    hi = ss.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ss[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  if (!key) {
    const a = ss[Math.min(lo, ss.length - 1)],
      b = ss[lo - 1];
    return b && Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a;
  }
  // Locate the neighbouring readings on this source clock without allocating
  // or scanning the complete history on every pointer frame.
  let left = lo - 1,
    right = lo;
  while (left >= 0 && !(key in ss[left])) left--;
  while (right < ss.length && !(key in ss[right])) right++;
  const a = ss[right],
    b = ss[left];
  if (a?.t === t) return finite(a[key]) ? a : undefined;
  if (
    !a ||
    !b ||
    !finite(a[key]) ||
    !finite(b[key]) ||
    a.epoch !== b.epoch ||
    a.t - b.t > 10000
  )
    return;
  return t - b.t < a.t - t ? b : a;
}
export function timeDomain(
  ss: Sample[],
  rangeMs = 60000,
  now = ss.at(-1)?.t ?? Date.now(),
): [number, number] {
  return [rangeMs ? now - rangeMs : (ss[0]?.t ?? now - 60000), now];
}
export const latest = (ss: Sample[], key: SeriesKey) => {
  for (let i = ss.length - 1; i >= 0; i--) if (key in ss[i]) return ss[i][key];
  return null;
};

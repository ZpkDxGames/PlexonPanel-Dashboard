import type { Sample } from "../../adapter/control-state";
import { historyFor } from "../../presentation/telemetry";
export const niceCeil = (n: number) => {
  if (!Number.isFinite(n) || n <= 0) return 60;
  const p = 10 ** Math.floor(Math.log10(n));
  return Math.ceil(n / p) * p;
};
export function msptDomain(values: number[]): [number, number] {
  const v = values
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => a - b);
  if (v.length < 2) return [0, 60];
  const upper = v[Math.floor((v.length - 1) * 0.99)];
  return [0, Math.min(250, Math.max(60, niceCeil(upper * 1.25)))];
}
export const clamp = (v: number | null, max: number) =>
  v == null ? null : Math.min(v, max);
export function buildTimeTicks(
  t0: number,
  t1: number,
  fmt: (t: number, seconds: boolean) => string,
  target = 7,
) {
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 < t0)
    return { ticks: [], withSeconds: false };
  const span = t1 - t0,
    steps = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200].map(
      (s) => s * 1000,
    ),
    step =
      steps.find((s) => span / s <= Math.max(1, target)) ??
      Math.max(7200000, span / Math.max(1, target)),
    withSeconds = step < 60000,
    ticks: number[] = [],
    labels = new Set<string>();
  for (
    let t = Math.ceil(t0 / step) * step;
    t <= t1 && ticks.length < 50;
    t += step
  ) {
    const label = fmt(t, withSeconds);
    if (!labels.has(label)) {
      labels.add(label);
      ticks.push(t);
    }
  }
  return { ticks, withSeconds };
}
export type Row = {
  t: number;
  source: "Paper" | "Host";
  epoch: string;
  [key: string]: number | string | null | [number, number];
};
const n = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
export function buildRows(history: Sample[], ceiling = 250) {
  const gaps: { id: string; from: number; to: number }[] = [];
  function series(
    source: "paperHealth" | "paperSystem" | "hostSystem" | "service",
  ) {
    let previous: Sample | undefined;
    return historyFor(history, source).flatMap((s, i) => {
      const epoch = s.epoch ?? "current",
        base: Row = {
          t: s.at,
          source: source.startsWith("paper") ? "Paper" : "Host",
          epoch,
        };
      const row: Row = { ...base };
      if (source === "paperHealth") {
        const p95 = n(s.p95),
          p99 = n(s.p99);
        Object.assign(row, {
          tps: n(s.tps),
          mspt: clamp(n(s.mspt), ceiling),
          mspt_raw: n(s.mspt),
          p95: clamp(p95, ceiling),
          p99: clamp(p99, ceiling),
          band:
            p95 != null && p99 != null
              ? [Math.min(p95, ceiling), Math.min(p99, ceiling)]
              : null,
          chunks: n(s.chunks),
          entities: n(s.entities),
        });
      }
      if (source === "paperSystem")
        Object.assign(row, {
          heap: s.heap == null ? null : s.heap / 2 ** 30,
          committed: s.committed == null ? null : s.committed / 2 ** 30,
          max: s.heapMax == null ? null : s.heapMax / 2 ** 30,
          gc:
            previous?.gc != null && s.gc != null && s.gc >= previous.gc
              ? s.gc - previous.gc
              : null,
        });
      if (source === "hostSystem") row.node = n(s.hostCpu);
      if (source === "service")
        Object.assign(row, {
          cpu: n(s.serviceCpu),
          cgroup: s.serviceMemory == null ? null : s.serviceMemory / 2 ** 30,
        });
      const boundary =
        previous && (s.epoch !== previous.epoch || s.at - previous.at > 10000);
      const before = previous;
      previous = s;
      if (!boundary) return [row];
      const from = before!.at,
        to = s.at;
      if (source === "paperHealth")
        gaps.push({ id: `${source}-${i}`, from, to });
      const blank: Row = { ...base, t: Math.min(to - 1, from + 1) };
      for (const key of Object.keys(row))
        if (!["t", "source", "epoch"].includes(key)) blank[key] = null;
      return [blank, row];
    });
  }
  const paper = series("paperHealth"),
    system = series("paperSystem"),
    host = series("hostSystem"),
    service = series("service");
  return {
    paper,
    system,
    host,
    service,
    gaps,
    rows: [...paper, ...system, ...host, ...service].sort((a, b) => a.t - b.t),
  };
}

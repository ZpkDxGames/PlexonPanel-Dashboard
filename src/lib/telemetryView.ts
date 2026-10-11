import type { Sample } from "../adapter/control-state";
export type MetricKey = "tps" | "mspt" | "hostCpu" | "processCpu" | "heap" | "memory" | "players" | "gc" | "serviceCpu" | "serviceMemory";
export type Point = { at: number; value: number | null };
export type TimeWindow = { from: number; to: number };
const sourceFor: Record<MetricKey, keyof NonNullable<Sample["sources"]>> = {
  tps: "paperHealth", mspt: "paperHealth", players: "paperHealth",
  processCpu: "paperSystem", heap: "paperSystem", gc: "paperSystem",
  hostCpu: "hostSystem", memory: "hostSystem", serviceCpu: "service", serviceMemory: "service",
};
/** Held values in a combined row are observations of their own source clock. */
export function metricPoints(samples: Sample[], key: MetricKey, window?: TimeWindow): Point[] {
  const captures = new Map<number, Point>();
  for (const sample of samples) {
    const capture = sample.sources ? sample.sources[sourceFor[key]] : sample.at;
    const valid = typeof capture === "number" && Number.isFinite(capture) && capture >= 0;
    const at = valid ? capture : sample.at;
    if (!Number.isFinite(at) || (window && (at < window.from || at > window.to))) continue;
    const raw = sample[key];
    const value = valid && typeof raw === "number" && Number.isFinite(raw) && raw >= 0 ? raw : null;
    if (valid || !captures.has(at)) captures.set(at, { at, value });
  }
  return [...captures.values()].sort((a, b) => a.at - b.at);
}
export function pointSegments(points: Point[], gapMs = 10_000): Point[][] {
  const segments: Point[][] = []; let current: Point[] = [];
  for (const point of points) {
    if (point.value === null) { if (current.length) segments.push(current); current = []; continue; }
    if (current.length && point.at - current.at(-1)!.at > gapMs) { segments.push(current); current = []; }
    current.push(point);
  }
  if (current.length) segments.push(current);
  return segments;
}
/** Bucket extrema preserve spikes; each disconnected segment stays separate. */
export function plotSegments(points: Point[], budget = 1400): Point[][] {
  const segments = pointSegments(points), total = segments.reduce((n, s) => n + s.length, 0);
  return segments.map((segment) => {
    const limit = Math.max(4, Math.floor(budget * segment.length / Math.max(1, total)));
    if (segment.length <= limit) return segment;
    const buckets = Math.max(1, Math.floor((limit - 2) / 2));
    const selected = new Set<number>([0, segment.length - 1]);
    for (let bucket = 0; bucket < buckets; bucket++) {
      const start = Math.floor(bucket * segment.length / buckets), end = Math.floor((bucket + 1) * segment.length / buckets);
      let min = start, max = start;
      for (let i = start; i < end; i++) {
        if (segment[i].value! < segment[min].value!) min = i;
        if (segment[i].value! > segment[max].value!) max = i;
      }
      selected.add(min); selected.add(max);
    }
    return [...selected].sort((a, b) => a - b).map((i) => segment[i]);
  });
}
export function summarize(points: Point[]) {
  const values = points.filter((p): p is Point & { value: number } => p.value !== null);
  if (!values.length) return null;
  return { count: values.length, min: Math.min(...values.map((p) => p.value)), max: Math.max(...values.map((p) => p.value)), average: values.reduce((n, p) => n + p.value, 0) / values.length, latest: values.at(-1)! };
}
export function observedSpikes(samples: Sample[], window?: TimeWindow) {
  return metricPoints(samples, "mspt", window).filter((p) => p.value !== null && p.value > 50);
}
export function gcPauseRate(samples: Sample[], window?: TimeWindow): number | null {
  let previous: Point | null = null, elapsed = 0, pause = 0;
  for (const point of metricPoints(samples, "gc", window)) {
    if (point.value === null) { previous = null; continue; }
    if (previous && point.at > previous.at && point.at - previous.at <= 10_000 && point.value >= previous.value!) {
      elapsed += point.at - previous.at; pause += point.value - previous.value!;
    }
    previous = point;
  }
  return elapsed > 0 ? pause / (elapsed / 60_000) : null;
}
export function formatMeasure(value: number | null | undefined, unit: string, digits = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  if (unit === "bytes") {
    const units = ["B", "KiB", "MiB", "GiB", "TiB"]; let index = 0, amount = value;
    while (amount >= 1024 && index < units.length - 1) { amount /= 1024; index++; }
    return `${amount.toLocaleString(undefined, { maximumFractionDigits: index ? digits : 0 })} ${units[index]}`;
  }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: digits })}${unit ? ` ${unit}` : ""}`;
}
export function axisMaximum(values: number[], minimum = 1) {
  const max = Math.max(minimum, ...values.filter(Number.isFinite)), order = 10 ** Math.floor(Math.log10(max)), step = order / 2;
  return Math.ceil(max / step) * step;
}

import { number, type Sample } from "./control-state";
import { gapSegments, seriesStats, windowedPoints, type TimedValue } from "./chart-geometry";

export type MetricField = "tps" | "mspt" | "hostCpu" | "processCpu" | "heap" | "memory" | "players" | "gc" | "serviceCpu" | "serviceMemory";
export type MetricSource = "paperHealth" | "paperSystem" | "hostSystem" | "service";
export const METRICS: Record<MetricField, { label: string; unit: string; source: MetricSource; origin: string; intervalMs: number }> = {
  tps: { label: "TPS", unit: "ticks/s", source: "paperHealth", origin: "Paper health", intervalMs: 2000 },
  mspt: { label: "MSPT", unit: "ms", source: "paperHealth", origin: "Paper health", intervalMs: 2000 },
  players: { label: "Players", unit: "players", source: "paperHealth", origin: "Paper health", intervalMs: 2000 },
  processCpu: { label: "Paper process CPU", unit: "% of machine capacity", source: "paperSystem", origin: "Paper JVM", intervalMs: 5000 },
  heap: { label: "JVM heap", unit: "bytes", source: "paperSystem", origin: "Paper JVM", intervalMs: 5000 },
  gc: { label: "GC pauses", unit: "ms since process start", source: "paperSystem", origin: "Paper JVM", intervalMs: 5000 },
  hostCpu: { label: "Shared node CPU", unit: "% of machine capacity", source: "hostSystem", origin: "Host node", intervalMs: 250 },
  memory: { label: "Shared node RAM", unit: "bytes", source: "hostSystem", origin: "Host node", intervalMs: 250 },
  serviceCpu: { label: "Minecraft service CPU", unit: "% of one core", source: "service", origin: "Host · systemd cgroup", intervalMs: 5000 },
  serviceMemory: { label: "Minecraft service RAM", unit: "bytes", source: "service", origin: "Host · systemd cgroup", intervalMs: 5000 },
};

export type MetricPoint = TimedValue & { provenance: "source capture" | "legacy packet timestamp" };

/** A host packet cannot create a new Paper observation. Unknown captures stay unknown. */
export function metricSeries(history: readonly Sample[], field: MetricField, minutes: number, now: number): MetricPoint[] {
  const source = METRICS[field].source;
  const points = new Map<number, MetricPoint>();
  for (const sample of history) {
    // Pre-revamp cache records had packet timestamps only; provenance is unavailable.
    const at = sample.sources ? sample.sources[source] : sample.at;
    if (at === null || at === undefined || !Number.isFinite(at) || at < 0 || at > now + 5000) continue;
    if (sample.sources || points.get(at)?.provenance !== "source capture")
      points.set(at, { at, value: number(sample[field]), provenance: sample.sources ? "source capture" : "legacy packet timestamp" });
  }
  return windowedPoints([...points.values()].sort((a, b) => a.at - b.at), minutes, now);
}

export function metricReport(points: readonly TimedValue[], minutes: number, now: number, intervalMs: number) {
  const stats = seriesStats(points);
  const values = points.flatMap(point => point.value === null ? [] : [point.value]).sort((a, b) => a - b);
  const tolerance = Math.max(1000, intervalMs * 3);
  const span = gapSegments(points, tolerance).reduce((sum, segment) => sum + (segment.at(-1)!.at - segment[0].at), 0);
  return { ...stats, p95: values.length ? values[Math.ceil(values.length * .95) - 1] : null,
    coverage: Math.min(100, Math.max(0, span / (minutes * 60000) * 100)),
    ageMs: points.length ? Math.max(0, now - points.at(-1)!.at) : null,
    startAt: points[0]?.at ?? null, endAt: points.at(-1)?.at ?? null };
}

export function exportMetrics(history: readonly Sample[], serverId: string, minutes: number, now: number, format: "csv" | "json") {
  const fields = Object.keys(METRICS) as MetricField[];
  const observations = fields.flatMap(field => metricSeries(history, field, minutes, now).map(point => ({
    serverId, metric: field, capturedAt: new Date(point.at).toISOString(), value: point.value,
    unit: METRICS[field].unit, source: METRICS[field].origin,
    provenance: point.provenance,
  })));
  if (format === "json") return JSON.stringify({ schemaVersion: 1, serverId, windowMinutes: minutes,
    generatedAt: new Date(now).toISOString(), retention: "browser observed history", observations }, null, 2);
  const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return ["serverId,metric,capturedAt,value,unit,source,provenance", ...observations.map(row =>
    [row.serverId, row.metric, row.capturedAt, row.value, row.unit, row.source, row.provenance].map(quote).join(","))].join("\n");
}

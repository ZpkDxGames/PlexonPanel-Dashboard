import { capturedAtMillis } from "../adapter/telemetry-freshness";
import { number, record, type JsonMap } from "../adapter/control-state";

export type ResourceKey =
  "serviceCpu" | "serviceMemory" | "processCpu" | "heap" | "hostCpu" | "memory";
export type ResourcePoint = {
  source: "paper" | "host" | "service";
  session: string;
  capturedAt: number;
  receivedAt: number;
  sourceIntervalMillis: number | null;
  value: number | null;
  processSession?: string;
};
// Immutable bounded pages: appending copies at most 128 points and 68 page references.
export type ResourceSeries = {
  session: string;
  pages: readonly (readonly ResourcePoint[])[];
};
export type Resources = Partial<Record<ResourceKey, ResourceSeries>>;
const PAGE = 128,
  MAX_PAGES = 68,
  RETENTION = 35 * 60_000;
export function appendResource(
  series: ResourceSeries | undefined,
  point: ResourcePoint,
): ResourceSeries {
  const prior = series?.session === point.session ? series.pages : [];
  const last = prior.at(-1)?.at(-1);
  if (last && point.capturedAt <= last.capturedAt) return series!;
  let pages = prior.slice();
  if (pages.at(-1)?.length === PAGE || !pages.length) pages.push([point]);
  else pages[pages.length - 1] = [...pages.at(-1)!, point];
  while (
    pages.length > MAX_PAGES ||
    (pages.length > 1 &&
      pages[0].at(-1)!.capturedAt < point.capturedAt - RETENTION)
  )
    pages.shift();
  return { session: point.session, pages };
}
export function collectResources(
  current: Resources,
  eventType: unknown,
  kind: string,
  session: string | undefined,
  body: JsonMap,
  receivedAt: number,
): Resources {
  if (!session) return current;
  let source: ResourcePoint["source"],
    data: JsonMap,
    values: Partial<Record<ResourceKey, number | null>>;
  if (eventType === "telemetry.system") {
    data = body;
    source = kind === "HOST" ? "host" : "paper";
    values =
      kind === "HOST"
        ? {
            hostCpu: number(body.hostCpuPercent),
            memory: number(body.physicalMemoryUsedBytes),
          }
        : {
            processCpu: number(body.processCpuPercent),
            heap: number(body.jvmHeapUsedBytes),
          };
  } else if (eventType === "service.status" && kind === "HOST") {
    data = record(body.resources);
    source = "service";
    const valid =
      data.scope === "MINECRAFT_SERVICE" && data.source === "SYSTEMD_CGROUP";
    values = {
      serviceCpu:
        valid &&
        data.cpuAvailable === true &&
        data.cpuUnit === "PERCENT_OF_ONE_CORE"
          ? number(data.cpuPercent)
          : null,
      serviceMemory:
        valid && data.memoryAvailable === true
          ? number(data.memoryBytes)
          : null,
    };
  } else return current;
  const capturedAt = capturedAtMillis(data.capturedAt);
  // Invalid clocks stay unavailable. Receipt time is never a fabricated plot timestamp.
  if (capturedAt === null) return current;
  const result = { ...current };
  for (const [key, value] of Object.entries(values))
    result[key as ResourceKey] = appendResource(current[key as ResourceKey], {
      source,
      session,
      capturedAt,
      receivedAt,
      sourceIntervalMillis: number(
        data.sourceIntervalMillis ?? body.sourceIntervalMillis,
      ),
      processSession:
        source === "service"
          ? String(data.processSession ?? body.pid ?? "unknown")
          : undefined,
      value: value ?? null,
    });
  return result;
}
function lowerBound<T>(
  items: readonly T[],
  at: number,
  time: (item: T) => number,
) {
  let lo = 0,
    hi = items.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (time(items[mid]) < at) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
export function resourceWindow(
  series: ResourceSeries | undefined,
  start: number,
  end: number,
): ResourcePoint[] {
  if (!series) return [];
  const pages = series.pages,
    result: ResourcePoint[] = [];
  const first = lowerBound(pages, start, (p) => p.at(-1)!.capturedAt);
  for (let i = first; i < pages.length && pages[i][0].capturedAt <= end; i++) {
    const page = pages[i];
    const from = lowerBound(page, start, (p) => p.capturedAt),
      to = lowerBound(page, end + 1, (p) => p.capturedAt);
    result.push(...page.slice(from, to));
  }
  return result;
}
/** Reduce within contiguous segments only, retaining each pixel bucket's extrema in time order. */
export function resourceSegments(
  points: readonly ResourcePoint[],
  start: number,
  end: number,
  width: number,
): ResourcePoint[][] {
  const segments: ResourcePoint[][] = [];
  let segment: ResourcePoint[] = [];
  let previous: ResourcePoint | undefined;
  for (const point of points) {
    const cadence = point.sourceIntervalMillis;
    if (
      point.value === null ||
      (previous &&
        (previous.session !== point.session ||
          previous.processSession !== point.processSession ||
          !cadence ||
          point.capturedAt - previous.capturedAt > cadence * 3))
    ) {
      if (segment.length) segments.push(segment);
      segment = [];
    }
    if (point.value !== null) segment.push(point);
    previous = point;
  }
  if (segment.length) segments.push(segment);
  return segments.map((values) => {
    const reduced: ResourcePoint[] = [];
    let bucket: ResourcePoint[] = [];
    let index = -1;
    const flush = () => {
      if (!bucket.length) return;
      const min = bucket.reduce((a, b) => (a.value! < b.value! ? a : b)),
        max = bucket.reduce((a, b) => (a.value! > b.value! ? a : b));
      reduced.push(
        ...[...new Set([bucket[0], min, max, bucket.at(-1)!])].sort(
          (a, b) => a.capturedAt - b.capturedAt,
        ),
      );
      bucket = [];
    };
    for (const point of values) {
      const next = Math.floor(
        ((point.capturedAt - start) / (end - start)) * width,
      );
      if (next !== index) {
        flush();
        index = next;
      }
      bucket.push(point);
    }
    flush();
    return reduced;
  });
}
export type ResourceScale = { max: number; calmSince: number | null };
export function resourceScale(
  previous: ResourceScale,
  required: number,
  now: number,
): ResourceScale {
  const target = 2 ** Math.ceil(Math.log2(Math.max(1, required)));
  if (target > previous.max) return { max: target, calmSince: null };
  if (target > previous.max / 2) return { ...previous, calmSince: null };
  const calmSince = previous.calmSince ?? now;
  return now - calmSince >= 30_000
    ? { max: target, calmSince: null }
    : { ...previous, calmSince };
}

import { TICK_PULSE_GEOMETRY, TICK_THRESHOLDS } from "./tick-thresholds";

// Caller supplies one instance's trusted Paper-health captures from the existing
// bounded history owner. No legacy-provenance adapter, storage, clock or UI here.
export type TickCapture = Readonly<{ capturedAt: number; tps: number | null; mspt: number | null }>;
export type TpsCategory = "healthy" | "degraded" | "critical" | "unknown";
export type TimeRegion = { startAt: number; endAt: number; kind: "gap" | "unknown-time" };
export type PulseBucket = {
  index: number; startAt: number; endAt: number; firstCaptureAt: number; lastCaptureAt: number;
  captureCount: number; worstTpsCategory: TpsCategory; unknownTpsCount: number;
  msptMin: number | null; msptMax: number | null; unknownMsptCount: number;
};
export type TimeColumn = { startAt: number; endAt: number; gapDurationMs: number; unknownDurationMs: number };
export type TickPulseModel = {
  mode: "raw" | "summarized"; windowStartAt: number; windowEndAt: number; plotWidthPx: number;
  minimumCaptureSpacingPx: number | null; summaryBucketCount: number;
  captures: TickCapture[]; buckets: PulseBucket[]; timeRegions: TimeRegion[]; timeColumns: TimeColumn[];
  excluded: { capture: TickCapture; reason: "invalid-time" | "future" | "before-window" }[];
  duplicateCount: number; observedCoverageMs: number;
};
const metric = (value: number | null): number | null => value !== null && Number.isFinite(value) && value >= 0 ? value : null;
export function tpsCategory(value: number | null): TpsCategory {
  const tps = metric(value);
  return tps === null ? "unknown" : tps >= TICK_THRESHOLDS.healthyTps ? "healthy" : tps >= TICK_THRESHOLDS.degradedTps ? "degraded" : "critical";
}
const severity: Record<TpsCategory, number> = { unknown: -1, healthy: 0, degraded: 1, critical: 2 };

/** Half-open time buckets; the final bucket includes the exact window end. */
export function buildTickPulseModel({ captures: input, windowStartAt, windowEndAt, plotWidthPx, gapToleranceMs }: {
  captures: readonly TickCapture[]; windowStartAt: number; windowEndAt: number; plotWidthPx: number; gapToleranceMs: number;
}): TickPulseModel {
  if (!Number.isFinite(windowStartAt) || !Number.isFinite(windowEndAt) || windowStartAt < 0 || windowEndAt <= windowStartAt || !Number.isFinite(plotWidthPx) || plotWidthPx <= 0 || !Number.isFinite(gapToleranceMs) || gapToleranceMs <= 0) throw new RangeError("A finite positive plot/window and the existing adapter's positive gap tolerance are required.");
  const span = windowEndAt - windowStartAt;
  const excluded: TickPulseModel["excluded"] = []; const byTime = new Map<number, TickCapture>(); let duplicateCount = 0;
  for (const capture of input) {
    const at = capture.capturedAt;
    if (!Number.isFinite(at) || at < 0) { excluded.push({ capture, reason: "invalid-time" }); continue; }
    if (at > windowEndAt) { excluded.push({ capture, reason: "future" }); continue; }
    if (at < windowStartAt) { excluded.push({ capture, reason: "before-window" }); continue; }
    if (byTime.has(at)) duplicateCount++;
    byTime.set(at, { capturedAt: at, tps: metric(capture.tps), mspt: metric(capture.mspt) });
  }
  const captures = [...byTime.values()].sort((a, b) => a.capturedAt - b.capturedAt);
  let minimumCaptureSpacingPx: number | null = null;
  const timeRegions: TimeRegion[] = []; let observedCoverageMs = 0;
  if (!captures.length) timeRegions.push({ startAt: windowStartAt, endAt: windowEndAt, kind: "unknown-time" });
  else {
    const first = captures[0].capturedAt; const last = captures.at(-1)!.capturedAt;
    if (first > windowStartAt) timeRegions.push({ startAt: windowStartAt, endAt: first, kind: "unknown-time" });
    for (let i = 1; i < captures.length; i++) {
      const startAt = captures[i - 1].capturedAt; const endAt = captures[i].capturedAt;
      const delta = endAt - startAt; const spacing = delta / span * plotWidthPx;
      minimumCaptureSpacingPx = minimumCaptureSpacingPx === null ? spacing : Math.min(minimumCaptureSpacingPx, spacing);
      // Matches metric-reports/gapSegments: equality is still within tolerance.
      if (delta > gapToleranceMs) timeRegions.push({ startAt, endAt, kind: "gap" });
      else observedCoverageMs += delta;
    }
    if (last < windowEndAt) timeRegions.push({ startAt: last, endAt: windowEndAt, kind: "unknown-time" });
  }
  const mode = minimumCaptureSpacingPx === null || minimumCaptureSpacingPx >= TICK_PULSE_GEOMETRY.minimumRawSpacingPx ? "raw" : "summarized";
  const summaryBucketCount = mode === "summarized" ? Math.max(1, Math.floor(plotWidthPx / TICK_PULSE_GEOMETRY.summaryMarkWidthPx)) : 0;
  const byBucket = new Map<number, PulseBucket>();
  if (mode === "summarized") for (const capture of captures) {
    const index = Math.min(summaryBucketCount - 1, Math.floor((capture.capturedAt - windowStartAt) / span * summaryBucketCount));
    let bucket = byBucket.get(index);
    if (!bucket) {
      bucket = { index, startAt: windowStartAt + index / summaryBucketCount * span, endAt: windowStartAt + (index + 1) / summaryBucketCount * span, firstCaptureAt: capture.capturedAt, lastCaptureAt: capture.capturedAt, captureCount: 0, worstTpsCategory: "unknown", unknownTpsCount: 0, msptMin: null, msptMax: null, unknownMsptCount: 0 };
      byBucket.set(index, bucket);
    }
    bucket.captureCount++; bucket.lastCaptureAt = capture.capturedAt;
    const category = tpsCategory(capture.tps);
    if (category === "unknown") bucket.unknownTpsCount++;
    else if (severity[category] > severity[bucket.worstTpsCategory]) bucket.worstTpsCategory = category;
    if (capture.mspt === null) bucket.unknownMsptCount++;
    else { bucket.msptMin = bucket.msptMin === null ? capture.mspt : Math.min(bucket.msptMin, capture.mspt); bucket.msptMax = bucket.msptMax === null ? capture.mspt : Math.max(bucket.msptMax, capture.mspt); }
  }
  // Raster hatching consumes at most one column per CSS pixel, not one path
  // per gap. Exact timeRegions remain available for truthful readouts/table.
  const timeColumns: TimeColumn[] = []; const columnCount = Math.ceil(plotWidthPx); let regionIndex = 0;
  for (let index = 0; index < columnCount; index++) {
    const startAt = windowStartAt + index / columnCount * span; const endAt = windowStartAt + (index + 1) / columnCount * span;
    const column: TimeColumn = { startAt, endAt, gapDurationMs: 0, unknownDurationMs: 0 };
    while (regionIndex < timeRegions.length && timeRegions[regionIndex].endAt <= startAt) regionIndex++;
    for (let i = regionIndex; i < timeRegions.length && timeRegions[i].startAt < endAt; i++) {
      const region = timeRegions[i]; const overlap = Math.max(0, Math.min(endAt, region.endAt) - Math.max(startAt, region.startAt));
      if (region.kind === "gap") column.gapDurationMs += overlap; else column.unknownDurationMs += overlap;
    }
    timeColumns.push(column);
  }
  return { mode, windowStartAt, windowEndAt, plotWidthPx, minimumCaptureSpacingPx, summaryBucketCount, captures, buckets: [...byBucket.values()], timeRegions, timeColumns, excluded, duplicateCount, observedCoverageMs };
}

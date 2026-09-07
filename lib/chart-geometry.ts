export type TimedValue = { at: number; value: number | null };

export type SeriesStats = {
  current: number | null;
  minimum: number | null;
  maximum: number | null;
  average: number | null;
  p95: number | null;
  count: number;
};

export function percentile(values: readonly number[], percentileValue: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

export function seriesStats(points: readonly TimedValue[]): SeriesStats {
  const values = points
    .map((point) => point.value)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  return {
    current: values.at(-1) ?? null,
    minimum: values.length ? Math.min(...values) : null,
    maximum: values.length ? Math.max(...values) : null,
    average: values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null,
    p95: percentile(values, 95),
    count: values.length,
  };
}

export function windowedPoints<T extends { at: number }>(
  history: readonly T[],
  minutes: 1 | 5 | 15 | 30 | number,
): T[] {
  const end = history.at(-1)?.at;
  if (end === undefined) return [];
  const start = end - minutes * 60_000;
  return history.filter((sample) => sample.at >= start);
}

export function gapSegments(points: readonly TimedValue[]): TimedValue[][] {
  const segments: TimedValue[][] = [];
  let current: TimedValue[] = [];
  for (const point of points) {
    if (point.value === null || !Number.isFinite(point.value)) {
      if (current.length) segments.push(current);
      current = [];
      continue;
    }
    current.push(point);
  }
  if (current.length) segments.push(current);
  return segments;
}

export function nearestValueIndex(
  points: readonly TimedValue[],
  targetAt: number,
): number | null {
  let nearest: number | null = null;
  let distance = Number.POSITIVE_INFINITY;
  points.forEach((point, index) => {
    if (point.value === null || !Number.isFinite(point.value)) return;
    const next = Math.abs(point.at - targetAt);
    if (next < distance) {
      distance = next;
      nearest = index;
    }
  });
  return nearest;
}

export function resolveDomain(
  values: readonly number[],
  options: {
    fixed?: readonly [number, number];
    percentage?: boolean;
    capacity?: number | null;
    reference?: number | null;
  } = {},
): [number, number] {
  if (options.percentage) return [0, 100];
  if (options.fixed) return [options.fixed[0], options.fixed[1]];
  if (
    options.capacity !== null &&
    options.capacity !== undefined &&
    Number.isFinite(options.capacity) &&
    options.capacity > 0
  ) {
    return [0, options.capacity];
  }
  const finite = values.filter(Number.isFinite);
  const rawMin = finite.length ? Math.min(...finite) : 0;
  const rawMax = finite.length ? Math.max(...finite) : 1;
  const spread = Math.max(1, rawMax - rawMin);
  const padding = Math.max(1, spread * 0.12);
  const lower = Math.max(0, rawMin - padding);
  const upper = Math.max(
    rawMax + padding,
    options.reference ?? 0,
    lower + 1,
  );
  return [lower, upper];
}

export function buildSvgPaths(
  segments: readonly TimedValue[][],
  xFor: (at: number) => number,
  yFor: (value: number) => number,
  baselineY: number,
): { line: string; area: string } {
  let line = "";
  let area = "";
  for (const segment of segments) {
    if (!segment.length) continue;
    const first = segment[0];
    const last = segment[segment.length - 1];
    const linePart = segment
      .map((point, index) =>
        `${index === 0 ? "M" : "L"}${xFor(point.at).toFixed(1)},${yFor(point.value as number).toFixed(1)}`,
      )
      .join(" ");
    line += `${linePart} `;
    area += `M${xFor(first.at).toFixed(1)},${baselineY.toFixed(1)} ${linePart.replace(/^M/, "L")} L${xFor(last.at).toFixed(1)},${baselineY.toFixed(1)} Z `;
  }
  return { line: line.trim(), area: area.trim() };
}

export function monotone(pts: [number, number][]): string {
  const n = pts.length;
  if (!n) return "";
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const dx: number[] = [],
    m: number[] = [],
    t: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = Math.max(0.001, pts[i + 1][0] - pts[i][0]);
    m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i];
  }
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++)
    t[i] =
      m[i - 1] * m[i] <= 0
        ? 0
        : (3 * (dx[i - 1] + dx[i])) /
          ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++)
    d += `C${(pts[i][0] + dx[i] / 3).toFixed(2)},${(pts[i][1] + (t[i] * dx[i]) / 3).toFixed(2)} ${(pts[i + 1][0] - dx[i] / 3).toFixed(2)},${(pts[i + 1][1] - (t[i + 1] * dx[i]) / 3).toFixed(2)} ${pts[i + 1][0].toFixed(2)},${pts[i + 1][1].toFixed(2)}`;
  return d;
}
export function domain(
  values: number[],
  minimumSpan: number,
  threshold?: number,
): [number, number] {
  if (!values.length) return [0, minimumSpan];
  let lo = Math.min(...values),
    hi = Math.max(...values);
  if (threshold !== undefined) {
    lo = Math.min(lo, threshold);
    hi = Math.max(hi, threshold);
  }
  const span = Math.max(hi - lo, minimumSpan);
  const middle = (hi + lo) / 2;
  return [Math.max(0, middle - span * 0.55), middle + span * 0.55];
}
export function sampleStats(values: number[]) {
  if (!values.length) return null;
  return {
    current: values.at(-1)!,
    average: values.reduce((a, b) => a + b, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}
export function windowStart<T extends { at: number }>(
  values: T[],
  cutoff: number,
) {
  let lo = 0,
    hi = values.length;
  while (lo < hi) {
    const m = (lo + hi) >>> 1;
    if (values[m].at < cutoff) lo = m + 1;
    else hi = m;
  }
  return lo;
}

/** Quantized bounds expand when needed; quiet noise cannot rescale every packet. */
export function stableDomain(
  values: number[],
  span: number,
  previous?: [number, number],
  settle = false,
): [number, number] {
  const [lo, hi] = domain(values, span);
  const step = span / 3;
  const next: [number, number] = [
    Math.max(0, Math.floor(lo / step) * step),
    Math.ceil(hi / step) * step,
  ];
  if (!previous) return next;
  if (settle) return next;
  return [Math.min(previous[0], next[0]), Math.max(previous[1], next[1])];
}

/** Equal-count interpolation preserves endpoints/extrema for stable SVG topology. */
export function resample(
  points: [number, number][],
  count: number,
): [number, number][] {
  if (points.length < 2) return points;
  const out: [number, number][] = [];
  // Keep original extrema by distributing points by path length, not inventing observations.
  const lengths = [0];
  for (let i = 1; i < points.length; i++)
    lengths.push(
      lengths[i - 1] +
        Math.hypot(
          points[i][0] - points[i - 1][0],
          points[i][1] - points[i - 1][1],
        ),
    );
  let j = 1;
  for (let i = 0; i < count; i++) {
    const at = (lengths.at(-1)! * i) / (count - 1);
    while (j < points.length - 1 && lengths[j] < at) j++;
    const t =
      (at - lengths[j - 1]) / Math.max(0.001, lengths[j] - lengths[j - 1]);
    out.push([
      points[j - 1][0] + (points[j][0] - points[j - 1][0]) * t,
      points[j - 1][1] + (points[j][1] - points[j - 1][1]) * t,
    ]);
  }
  return out;
}


/**
 * Keep the visible x-axis from translating on every raw telemetry packet.
 * Short live windows advance twice per second; longer windows once per second.
 */
export function presentationWindow(
  latestAt: number,
  windowMs: number,
): { start: number; end: number; step: number } {
  const safeWindow = Math.max(30_000, windowMs);
  const step = safeWindow <= 60_000 ? 500 : 1_000;
  const end = Math.ceil(latestAt / step) * step;
  return { start: end - safeWindow, end, step };
}

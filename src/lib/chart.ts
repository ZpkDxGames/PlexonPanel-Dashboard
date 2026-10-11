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

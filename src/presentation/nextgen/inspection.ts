import type { Sample } from "../../adapter/control-state";
/** Actual sorted observations only; ties prefer the earlier capture. */
export function nearestObservation(
  points: readonly Sample[],
  at: number,
): Sample | null {
  if (!points.length) return null;
  let low = 0,
    high = points.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (points[mid].at < at) low = mid + 1;
    else high = mid;
  }
  if (low === 0) return points[0];
  if (low === points.length) return points[low - 1];
  return at - points[low - 1].at <= points[low].at - at
    ? points[low - 1]
    : points[low];
}

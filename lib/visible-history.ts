import type { Sample } from './control-state';

/** Ordered reducer history: locate the displayed packet range before converting values. */
export function visibleHistory(history: readonly Sample[], startAt: number, endAt: number): Sample[] {
  const bound = (at: number, inclusive: boolean) => {
    let low = 0, high = history.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (history[middle].at < at || (inclusive && history[middle].at === at)) low = middle + 1;
      else high = middle;
    }
    return low;
  };
  return history.slice(bound(startAt, false), bound(endAt, true));
}

import type { Sample } from "../adapter/control-state";
import {
  finite,
  historyFor,
  sourceFor,
  type MetricKey,
  type Source,
} from "./telemetry";
export type CanvasSeries = {
  key: MetricKey;
  label: string;
  color: string;
  unit: string;
};
/** Undefined skips another source's clock; null is a real missing observation. */
const vectorCache = new WeakMap<
  Sample[],
  Map<
    string,
    {
      data: Map<MetricKey, (number | null)[]>;
      x: number[];
      events: number[];
      rows: Sample[];
      indexes: (number | null)[];
    }
  >
>();
export function canvasData(
  histories: Partial<Record<Source, Sample[]>>,
  fallback: Sample[],
  series: CanvasSeries[],
  since: number,
  includeGaps = true,
): { data: [number[], ...(number | null | undefined)[][]]; events: number[] } {
  const wanted = [...new Set(series.map((s) => sourceFor[s.key]))];
  if (wanted.length === 1) {
    const source = wanted[0],
      input = histories[source] ?? fallback,
      key = `${source}:${since}:${includeGaps}`;
    let cache = vectorCache.get(input);
    if (!cache) {
      cache = new Map();
      vectorCache.set(input, cache);
    }
    let vectors = cache.get(key);
    if (!vectors) {
      const rows = historyFor(input, source, since),
        x: number[] = [],
        data = new Map<MetricKey, (number | null)[]>(),
        events: number[] = [],
        indexes: (number | null)[] = [];
      let previous: number | undefined,
        cadence = 1000,
        previousGc: number | null = null;
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        if (previous !== undefined) {
          const delta = row.at - previous;
          if (includeGaps && delta > Math.max(5000, cadence * 3)) {
            x.push((previous + row.at) / 2000);
            indexes.push(null);
          } else if (delta > 0) cadence = delta;
        }
        x.push(row.at / 1000);
        indexes.push(index);
        if (source === "paperSystem" && finite(row.gc)) {
          if (previousGc !== null && row.gc > previousGc)
            events.push(row.at / 1000);
          previousGc = row.gc;
        }
        previous = row.at;
      }
      vectors = { x, data, events, rows, indexes };
      cache.set(key, vectors);
    }
    for (const item of series) {
      if (!vectors.data.has(item.key)) {
        const key = item.key;
        vectors.data.set(
          key,
          vectors.indexes.map((index) => {
            const value = index === null ? null : vectors.rows[index][key];
            return finite(value) ? value : null;
          }),
        );
      }
    }
    return {
      data: [vectors.x, ...series.map((s) => vectors!.data.get(s.key)!)],
      events: vectors.events,
    };
  }
  const columns = new Map<number, (number | null | undefined)[]>(),
    events: number[] = [];
  for (const source of new Set(series.map((s) => sourceFor[s.key]))) {
    const indexes = series
        .map((s, i) => (sourceFor[s.key] === source ? i : -1))
        .filter((i) => i >= 0),
      rows = historyFor(histories[source] ?? fallback, source, since);
    let previous: number | undefined,
      previousGc: number | null = null,
      cadence = 1000;
    for (const row of rows) {
      if (previous !== undefined) {
        const delta = row.at - previous;
        if (includeGaps && delta > Math.max(5000, cadence * 3)) {
          const at = (previous + row.at) / 2000,
            value = columns.get(at) ?? Array(series.length).fill(undefined);
          for (const i of indexes) value[i] = null;
          columns.set(at, value);
        } else if (delta > 0) cadence = delta;
      }
      const at = row.at / 1000,
        value = columns.get(at) ?? Array(series.length).fill(undefined);
      for (const i of indexes)
        value[i] = finite(row[series[i].key])
          ? (row[series[i].key] as number)
          : null;
      columns.set(at, value);
      previous = row.at;
      if (source === "paperSystem" && finite(row.gc)) {
        if (previousGc !== null && row.gc > previousGc) events.push(at);
        previousGc = row.gc;
      }
    }
  }
  const sorted = [...columns].sort(([a], [b]) => a - b);
  return {
    data: [
      sorted.map(([at]) => at),
      ...series.map((_, i) => sorted.map(([, values]) => values[i])),
    ],
    events,
  };
}

import type { Sample } from "../adapter/control-state";
import {
  displaySegments,
  finite,
  historyFor,
  sourceFor,
  type MetricKey,
  type Source,
} from "./telemetry";
export type ChartSeries = {
  key: MetricKey;
  label: string;
  color: string;
  unit: string;
  axis?: "left" | "right";
};
export type ChartRow = {
  at: number;
  gap?: boolean;
  [key: string]: number | null | boolean | number[] | undefined;
};
/** Reduces visual paths, retaining extrema and actual gap boundaries. Raw observations are unchanged. */
export function chartRows(
  history: Sample[],
  source: Source,
  keys: MetricKey[],
  since: number,
  budget = 480,
): ChartRow[] {
  if (!keys.length) return [];
  const raw = historyFor(history, source, since),
    selected = new Set<Sample>(),
    gaps: ChartRow[] = [];
  for (const key of keys)
    for (const segment of displaySegments(
      raw,
      key,
      Math.max(60, Math.floor(budget / keys.length)),
    ))
      for (const row of segment) selected.add(row);
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i],
      prev = raw[i - 1],
      next = raw[i + 1];
    if (
      i === 0 ||
      i === raw.length - 1 ||
      keys.some(
        (key) =>
          finite(row[key]) !== finite(prev?.[key]) ||
          finite(row[key]) !== finite(next?.[key]),
      )
    )
      selected.add(row);
    if (prev && row.at - prev.at > 10000)
      gaps.push({
        at: (prev.at + row.at) / 2,
        gap: true,
        ...Object.fromEntries(keys.map((key) => [key, null])),
      });
  }
  return [
    ...[...selected].map((row) => {
      const value: ChartRow = { at: row.at };
      for (const key of keys) value[key] = finite(row[key]) ? row[key]! : null;
      if (keys.includes("msptP95") && keys.includes("msptP99"))
        value.tickBand =
          finite(row.msptP95) &&
          finite(row.msptP99) &&
          row.msptP99 >= row.msptP95
            ? [row.msptP95, row.msptP99]
            : undefined;
      return value;
    }),
    ...gaps,
  ].sort((a, b) => a.at - b.at);
}
export function sourceKeys(series: ChartSeries[], source: Source) {
  return series.filter((s) => sourceFor[s.key] === source).map((s) => s.key);
}

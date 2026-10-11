import type { Sample } from "./control-state";
const cache = new WeakMap<readonly Sample[], Map<string, Sample[]>>();
/** Each series is placed by its own source capture. Host packets never resample Paper. */
export function projectHistory(
  history: readonly Sample[],
  source: "paperHealth" | "paperSystem" | "hostSystem" | "service",
): Sample[] {
  let projections = cache.get(history);
  if (!projections) { projections = new Map(); cache.set(history, projections); }
  const cached = projections.get(source);
  if (cached) return cached;
  const points = new Map<number, Sample>();
  for (const sample of history) {
    const at = sample.sources?.[source];
    if (typeof at === "number" && Number.isFinite(at))
      points.set(at, sample);
  }
  const result = [...points.entries()].map(([at,sample]) => ({...sample,at})).sort((a,b) => a.at-b.at);
  projections.set(source, result);
  return result;
}

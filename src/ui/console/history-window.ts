/** Volatile, bounded history windows. Historical browsing must not be displaced by live traffic. */
export function retainHistoryPage<T>(
  older: T[],
  page: T[],
  limit: number,
): T[] {
  return [...older, ...page].slice(-limit);
}
export function historyWindow<T>(
  older: T[],
  page: T[],
  live: T[],
  historical: boolean,
  limit: number,
  id: (row: T) => string,
  timestamp: (row: T) => number,
): T[] {
  const unique = new Map<string, T>();
  for (const row of [...older, ...page, ...(historical ? [] : live)])
    unique.set(id(row), row);
  const sorted = [...unique.values()].sort(
    (a, b) => timestamp(a) - timestamp(b),
  );
  return historical ? sorted.slice(0, limit) : sorted.slice(-limit);
}

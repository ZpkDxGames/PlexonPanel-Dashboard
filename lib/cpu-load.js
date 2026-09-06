/**
 * Converts the Java MXBean CPU-load contract into a dashboard percentage.
 * Zero is a valid idle sample; only missing, non-finite, or negative samples
 * mean that a given CPU measurement is unavailable.
 *
 * @param {unknown} value
 * @returns {{ available: boolean, percent: number }}
 */
export function normalizeCpuLoad(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return { available: false, percent: 0 };
  }
  return {
    available: true,
    percent: Math.max(0, Math.min(100, Math.round(value * 100))),
  };
}

/**
 * Prefers whole-system CPU usage and falls back transparently to the Paper JVM
 * process when the host platform does not expose a system-wide sample.
 *
 * @param {unknown} systemValue
 * @param {unknown} processValue
 * @returns {{ available: boolean, percent: number, source: "system" | "process" | "unavailable" }}
 */
export function selectCpuLoad(systemValue, processValue) {
  const system = normalizeCpuLoad(systemValue);
  if (system.available) return { ...system, source: "system" };

  const process = normalizeCpuLoad(processValue);
  if (process.available) return { ...process, source: "process" };

  return { available: false, percent: 0, source: "unavailable" };
}

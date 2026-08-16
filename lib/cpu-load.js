/**
 * Converts the Java MXBean CPU-load contract into a dashboard percentage.
 * Zero is a valid idle sample; only missing, non-finite, or negative samples
 * mean that CPU usage is unavailable.
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

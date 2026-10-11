/** Browsers represent timer delays as signed 32-bit integers. */
export const MAX_TIMER_DELAY_MS = 2_147_483_647;

/**
 * Returns the next safe delay for checking an absolute deadline.
 * Long-lived grants must be checked in stages instead of overflowing setTimeout.
 */
export function deadlineDelay(
  deadline: string,
  now = Date.now(),
): number | null {
  const remaining = Date.parse(deadline) - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  return Math.min(MAX_TIMER_DELAY_MS, remaining);
}

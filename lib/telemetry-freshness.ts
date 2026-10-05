export const TELEMETRY_STALE_MS = 30_000;
export function capturedAtMillis(value: unknown): number | null {
  if (typeof value !== "string" || !value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/** Freshness belongs to a captured sample, never to unrelated socket traffic. */
export function telemetryFreshness(capturedAt: unknown, connected: boolean, now: number) {
  if (!connected) return { kind: "disconnected", label: "disconnected" };
  const at = capturedAtMillis(capturedAt);
  if (at === null) return { kind: "waiting", label: "waiting for telemetry" };
  if (at > now + 5_000) return { kind: "stale", label: "clock mismatch" };
  const age = Math.max(0, now - at);
  const seconds = Math.floor(age / 1000);
  if (age > TELEMETRY_STALE_MS) return { kind: "stale", label: `stale · ${seconds}s` };
  if (age > 10_000) return { kind: "delayed", label: `delayed · ${seconds}s` };
  return { kind: "live", label: `live · ${seconds}s` };
}

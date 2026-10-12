export const TELEMETRY_STALE_MS = 30_000;
export function capturedAtMillis(value: unknown): number | null {
  if (typeof value !== "string" || !value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
export type TelemetryKind =
  | "disconnected"
  | "waiting"
  | "live"
  | "delayed"
  | "stale"
  | "skew";
/** Capture and browser receipt are independent clocks; unrelated traffic is never a receipt. */
export function classifyTelemetry({
  capturedAt,
  receivedAt,
  connected,
  now,
  expectedIntervalMs,
}: {
  capturedAt: unknown;
  receivedAt?: number;
  connected: boolean;
  now: number;
  expectedIntervalMs?: number | null;
}): {
  kind: TelemetryKind;
  label: string;
  usable: boolean;
  skewAheadMs: number;
  ageMs: number | null;
} {
  const at = capturedAtMillis(capturedAt);
  const receipt =
    typeof receivedAt === "number" &&
    Number.isFinite(receivedAt) &&
    receivedAt > 0
      ? receivedAt
      : null;
  const clock = Math.max(now, receipt ?? 0),
    skewAheadMs = at === null || receipt === null ? 0 : at - receipt,
    skew = skewAheadMs > 5000;
  const ageMs =
    at === null ? null : Math.max(0, clock - (skew ? receipt! : at));
  if (!connected)
    return {
      kind: "disconnected",
      label: "disconnected",
      usable: false,
      skewAheadMs,
      ageMs,
    };
  if (at === null)
    return {
      kind: "waiting",
      label: "waiting for telemetry",
      usable: false,
      skewAheadMs,
      ageMs,
    };
  if (receipt === null && at > clock + 5000)
    return {
      kind: "stale",
      label: "clock mismatch",
      usable: false,
      skewAheadMs,
      ageMs,
    };
  const expected =
      typeof expectedIntervalMs === "number" &&
      Number.isFinite(expectedIntervalMs) &&
      expectedIntervalMs >= 50
        ? Math.min(30_000, expectedIntervalMs)
        : null,
    delayedAfterMs = expected === null ? 10_000 : Math.max(3_000, expected * 4),
    staleAfterMs = expected === null ? 30_000 : Math.max(10_000, expected * 12),
    aged =
      ageMs! > staleAfterMs
        ? "stale"
        : ageMs! > delayedAfterMs
          ? "delayed"
          : "live",
    seconds = Math.floor(ageMs! / 1000);
  const note = `clock skew +${Math.round(skewAheadMs / 1000)} s · received ${seconds} s ago`;
  return {
    kind: skew && aged === "live" ? "skew" : aged,
    label: skew
      ? aged === "live"
        ? note
        : `${aged} · ${note}`
      : `${aged} · ${seconds}s`,
    usable: aged !== "stale",
    skewAheadMs,
    ageMs,
  };
}
/** Compatibility for historical observations without browser receipt metadata. */
export function telemetryFreshness(
  capturedAt: unknown,
  connected: boolean,
  now: number,
) {
  return classifyTelemetry({ capturedAt, connected, now });
}

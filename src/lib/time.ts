export const DASHBOARD_TIMEZONE = "America/Sao_Paulo" as const;

function instant(value: unknown): number | null {
  const at =
    value instanceof Date
      ? value.getTime()
      : typeof value === "number"
        ? value
        : typeof value === "string"
          ? Date.parse(value)
          : NaN;
  return Number.isFinite(at) ? at : null;
}

export function formatTime(
  value: unknown,
  options: { seconds?: boolean; millis?: boolean } = {},
): string {
  const at = instant(value);
  if (at === null) return "—";
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: DASHBOARD_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    ...(options.seconds || options.millis ? { second: "2-digit" } : {}),
    ...(options.millis ? { fractionalSecondDigits: 3 } : {}),
    hour12: false,
  });
  return formatter.format(at);
}

export function formatDateTime(value: unknown): string {
  const at = instant(value);
  if (at === null) return "Unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: DASHBOARD_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(at);
}

export function formatChartTime(value: number, windowMs: number): string {
  return formatTime(value, { seconds: windowMs <= 60_000 });
}

export function chartWindowLabel(windowMs: number): string {
  if (windowMs < 60_000) return `${Math.round(windowMs / 1000)}s`;
  return `${Math.round(windowMs / 60_000)}min`;
}

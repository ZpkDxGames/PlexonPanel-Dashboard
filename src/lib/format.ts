export function duration(ms: number | null) {
  if (ms === null || !Number.isFinite(ms)) return "—";
  const minutes = Math.floor(ms / 60000),
    hours = Math.floor(minutes / 60),
    days = Math.floor(hours / 24);
  return days
    ? `${days}d ${hours % 24}h ${minutes % 60}m`
    : hours
      ? `${hours}h ${minutes % 60}m`
      : `${minutes}m`;
}
export function relative(at: unknown, now = Date.now()) {
  const value =
    typeof at === "number" ? at : typeof at === "string" ? Date.parse(at) : NaN;
  if (!Number.isFinite(value)) return "Time unavailable";
  const s = Math.max(0, Math.floor((now - value) / 1000));
  return s < 60
    ? "just now"
    : s < 3600
      ? `${Math.floor(s / 60)} min ago`
      : s < 86400
        ? `${Math.floor(s / 3600)}h ago`
        : `${Math.floor(s / 86400)}d ago`;
}

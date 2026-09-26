import type { JsonMap } from "./control-state";

export interface ActivityObservation {
  eventId: string;
  uuid: string;
  name: string;
  state: "JOINED" | "LEFT";
  observedAt: string;
  termination: string;
  sessionDurationMillis: number | null;
  durable: boolean;
}

export interface ActivityFilters {
  query: string;
  status: "ALL" | "ONLINE" | "OFFLINE";
  from: string;
  to: string;
}

export const ACTIVITY_PAGE_SIZE = 50;

function string(value: unknown, limit: number): string {
  return typeof value === "string" && value.length <= limit ? value : "";
}

export function observation(value: unknown, durable: boolean): ActivityObservation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as JsonMap;
  const eventId = string(row.eventId, 160);
  const uuid = string(row.uuid, 64);
  const name = string(row.name, 64);
  const observedAt = string(row.observedAt, 64);
  if (!eventId || !uuid || !name || !observedAt || !Number.isFinite(Date.parse(observedAt)) ||
    (row.state !== "JOINED" && row.state !== "LEFT")) return null;
  return {
    eventId, uuid, name, observedAt, state: row.state,
    termination: string(row.termination, 64),
    sessionDurationMillis: typeof row.sessionDurationMillis === "number" &&
      Number.isFinite(row.sessionDurationMillis) && row.sessionDurationMillis >= 0
      ? row.sessionDurationMillis : null,
    durable,
  };
}

// Date input is local calendar time; Paper receives an ISO instant, never a browser-only date.
export function activityParameters(filters: ActivityFilters, cursor = ""): JsonMap {
  const result: JsonMap = {
    query: filters.query.trim().slice(0, 64),
    status: filters.status,
    limit: ACTIVITY_PAGE_SIZE,
  };
  if (filters.from) result.from = new Date(`${filters.from}T00:00:00`).toISOString();
  if (filters.to) result.to = new Date(`${filters.to}T23:59:59.999`).toISOString();
  if (cursor) result.cursor = cursor;
  return result;
}

export function liveActivity(
  deltas: JsonMap[], filters: ActivityFilters, now = Date.now(),
): ActivityObservation[] {
  const needle = filters.query.trim().toLowerCase();
  const from = filters.from ? Date.parse(`${filters.from}T00:00:00`) : -Infinity;
  const to = filters.to ? Date.parse(`${filters.to}T23:59:59.999`) : Infinity;
  const unique = new Map<string, ActivityObservation>();
  for (const delta of deltas.slice(-512)) {
    const item = observation(delta, false);
    if (!item) continue;
    const at = Date.parse(item.observedAt);
    if (at < now - 10 * 60_000 || at > now + 60_000 || at < from || at > to) continue;
    if (filters.status === "ONLINE" && item.state !== "JOINED" ||
        filters.status === "OFFLINE" && item.state !== "LEFT") continue;
    if (needle && !item.name.toLowerCase().includes(needle) && !item.uuid.toLowerCase().includes(needle)) continue;
    unique.set(item.eventId, item);
  }
  return [...unique.values()].sort(newestFirst).slice(0, 50);
}

function newestFirst(a: ActivityObservation, b: ActivityObservation): number {
  return Date.parse(b.observedAt) - Date.parse(a.observedAt) || b.eventId.localeCompare(a.eventId);
}

export function activityPage(durable: ActivityObservation[], live: ActivityObservation[], firstPage: boolean): ActivityObservation[] {
  if (!firstPage) return durable;
  const byId = new Map<string, ActivityObservation>();
  for (const item of live) byId.set(item.eventId, item);
  for (const item of durable) byId.set(item.eventId, item);
  return [...byId.values()].sort(newestFirst).slice(0, ACTIVITY_PAGE_SIZE + 50);
}

import { record, records, str, type JsonMap } from "../adapter/control-state";

/** Read-only projection; the server's cursor is opaque and never interpreted. */
export function playerHistoryPage(value: unknown, uuid: string) {
  const data = record(value);
  return {
    entries: records(data.entries, 25).filter(
      (entry) =>
        entry.uuid === uuid && ["JOINED", "LEFT"].includes(str(entry.state)),
    ) as JsonMap[],
    enabled:
      typeof data.historyEnabled === "boolean" ? data.historyEnabled : null,
    bounded: data.boundedWindow === true,
    capturedAt: str(data.capturedAt, "Not reported"),
    cursor:
      data.hasMore === true &&
      typeof data.nextCursor === "string" &&
      data.nextCursor.length > 0 &&
      data.nextCursor.length <= 512
        ? data.nextCursor
        : null,
  };
}

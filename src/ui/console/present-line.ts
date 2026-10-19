import { time, type JsonMap, type Preferences } from "../bindings";
import { parseLine, consoleRowId } from "./parse-line";
/** A producer's embedded clock cannot override the selected display timezone. */
export function presentLine(
  raw: JsonMap,
  epoch: string,
  zone: Preferences["timezone"],
) {
  const content = String(raw.content ?? raw.message ?? ""),
    stamp = String(raw.capturedAt ?? raw.timestamp ?? raw.observedAt ?? ""),
    clock = time(stamp, zone),
    prefix = /^\[?\d{2}:\d{2}:\d{2}/.test(content)
      ? ""
      : `[${clock} ${raw.level ?? "INFO"}]: `,
    line = parseLine(consoleRowId(raw, epoch), prefix + content);
  return {
    ...line,
    time: clock === "—" ? line.time : clock,
    iso: Number.isFinite(Date.parse(stamp))
      ? new Date(stamp).toISOString()
      : undefined,
    rawText: prefix + content,
  };
}

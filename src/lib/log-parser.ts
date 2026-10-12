import { str, type JsonMap } from "../adapter/control-state";
import { parseTextFormat, plainText } from "./textFormat";
import { formatTime } from "./time";
export type LogKind =
  | "info"
  | "join"
  | "leave"
  | "chat"
  | "command"
  | "death"
  | "done"
  | "lag"
  | "error";
export type LogEntry = {
  id: string;
  time: string;
  level: string;
  source: string;
  plugin: boolean;
  message: string;
  raw: string;
  kind: LogKind;
  trace: string[];
  count: number;
};
export function classify(message: string, level: string): LogKind {
  if (/joined the game$/.test(message)) return "join";
  if (/left the game|lost connection/.test(message)) return "leave";
  if (/^<[^>]+> /.test(message)) return "chat";
  if (/issued server command:|^>\s*\//.test(message)) return "command";
  if (/was slain by|fell from|drowned|was blown up/.test(message))
    return "death";
  if (/^Done \(/.test(message)) return "done";
  if (/Can't keep up!|Running \d+ms behind/.test(message)) return "lag";
  if (["ERROR", "FATAL"].includes(level)) return "error";
  return "info";
}
export function parseLog(line: JsonMap, index = 0): LogEntry {
  const raw = str(line.content ?? line.rawText, "").slice(0, 20000),
    plain = plainText(parseTextFormat(raw));
  const modern = plain.match(
      /^\[(\d{2}:\d{2}:\d{2})\]\s*\[([^\]\/]+)\/(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\]:\s?(.*)$/,
    ),
    legacy = plain.match(
      /^\[(\d{2}:\d{2}:\d{2})\s+(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\]:\s?(.*)$/,
    );
  let message = raw,
    time = "",
    source = str(line.source, "Server thread"),
    level = str(line.level, "INFO").toUpperCase();
  const captured = formatTime(line.capturedAt ?? line.receivedAt, {
    seconds: true,
  });
  if (modern) {
    time = captured !== "—" ? captured : modern[1];
    source = modern[2];
    level = modern[3];
    message = modern[4];
  } else if (legacy) {
    time = captured !== "—" ? captured : legacy[1];
    level = legacy[2];
    message = legacy[3];
  } else {
    time = captured;
  }
  const prefix = message.match(/^\[([^\]]{1,32})\]\s*(.*)$/);
  if (prefix) {
    source = prefix[1];
    message = prefix[2];
  }
  return {
    id: str(line.id, `${index}`),
    time,
    level,
    source,
    plugin: Boolean(prefix),
    message,
    raw,
    kind: classify(plainText(parseTextFormat(message)), level),
    trace: [],
    count: 1,
  };
}
export function groupLogs(lines: JsonMap[], dedupe = true): LogEntry[] {
  const out: LogEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    const e = parseLog(lines[i], i),
      last = out.at(-1);
    if (
      last &&
      /^(\s+at\s|Caused by:|Suppressed:|\s*\.\.\. \d+ more|[\w.$]+(?:Exception|Error):)/.test(
        e.message,
      )
    ) {
      last.trace.push(e.raw);
      continue;
    }
    if (
      dedupe &&
      last &&
      last.message === e.message &&
      last.level === e.level &&
      last.source === e.source &&
      e.kind !== "chat"
    ) {
      last.count++;
      continue;
    }
    out.push(e);
  }
  return out;
}
export function pluginSlot(source: string) {
  let n = 0;
  for (const c of source) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return (n % 5) + 1;
}

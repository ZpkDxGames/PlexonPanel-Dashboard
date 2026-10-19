import { consoleStrongId, type JsonMap } from "../../adapter/control-state";
import { plainText, parseTextFormat } from "../../lib/textFormat";
export type Level = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
export type Token = { t: "text" | "url"; v: string };
export interface ParsedLine {
  id: string;
  time: string | null;
  level: Level | null;
  thread: string | null;
  tag: string | null;
  body: Token[];
  kind: "line" | "continuation" | "chat" | "command" | "system";
}
export function tokenize(s: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  for (const m of s.matchAll(/https?:\/\/[^\s<>"')]+/g)) {
    if (m.index! > last) out.push({ t: "text", v: s.slice(last, m.index) });
    const v = m[0].replace(/[.,;:!?]+$/, "");
    out.push({ t: "url", v });
    const tail = m[0].slice(v.length);
    if (tail) out.push({ t: "text", v: tail });
    last = m.index! + m[0].length;
  }
  if (last < s.length) out.push({ t: "text", v: s.slice(last) });
  return out;
}
export function parseLine(id: string, input: unknown): ParsedLine {
  let raw = "";
  try {
    raw = String(input ?? "").slice(0, 16384);
    raw = plainText(parseTextFormat(raw.replace(/\u001b\[[0-9;]*m/g, "")));
  } catch {
    raw = "[unreadable line]";
  }
  const line: ParsedLine = {
    id,
    time: null,
    level: null,
    thread: null,
    tag: null,
    body: [],
    kind: "continuation",
  };
  let rest = raw;
  for (let i = 0; i < 3; i++) {
    const m =
      /^\[?(\d{2}:\d{2}:\d{2})(?:\]\s*\[|\s+|\]\s*)(?:(.*?)\/)?(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\]?:?\s*(.*)$/.exec(
        rest,
      );
    if (!m) break;
    line.time = m[1];
    line.thread = m[2]?.trim() ?? null;
    line.level = m[3] as Level;
    line.kind = "line";
    rest = m[4];
  }
  if (!line.level) {
    const m =
      /^\[([^\]]*?)\/(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\]:?\s*(.*)$/.exec(
        rest,
      );
    if (m) {
      line.level = m[2] as Level;
      line.thread = m[1];
      line.kind = "line";
      rest = m[3];
    }
  }
  const tag = /^\[([^\]\s][^\]]{0,31})\]\s*/.exec(rest);
  if (tag && line.level) {
    line.tag = tag[1];
    rest = rest.slice(tag[0].length);
  }
  line.body = tokenize(rest);
  return line;
}
const HUES = ["cyan", "violet", "indigo", "sky", "emerald"] as const;
export const chipTone = (tag: string) =>
  HUES[
    [...tag].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % HUES.length
  ];

export function consoleRowId(line: JsonMap, epoch: string) {
  const strong = consoleStrongId(line);
  if (strong) return strong;
  if (typeof line.id === "string" && line.id) return line.id;
  const raw = String(line.content ?? line.message ?? ""),
    hash = [...raw].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return `legacy:${epoch}:${String(line.capturedAt ?? line.timestamp ?? "unreported")}:${String(line.fingerprint ?? hash)}`;
}

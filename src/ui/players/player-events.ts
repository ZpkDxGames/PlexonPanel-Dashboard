"use client";
import { useMemo, useSyncExternalStore } from "react";

export type PlayerEventKind =
  "join" | "leave" | "advancement" | "death" | "command" | "online";
export type PlayerEventSource = "presence" | "console" | "roster";
export interface PlayerEvent {
  id: string;
  bootId: string;
  ts: number;
  kind: PlayerEventKind;
  player: string;
  detail?: string;
  source: PlayerEventSource;
}
export interface ConsoleLine {
  seq: number | string;
  ts?: number;
  clock?: string;
  level?: string;
  text: string;
}
export interface RosterPlayer {
  name: string;
  uuid?: string;
  sessionStartedAt?: number;
}
export interface PresenceDelta {
  ts: number;
  kind: "join" | "leave";
  player: string;
  uuid?: string;
}
export interface ParseCtx {
  bootId: string;
  tz: string;
  anchor: number;
}
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
export const cleanLine = (s: string) =>
  s
    .slice(0, 16384)
    .replace(ANSI, "")
    .replace(/§[0-9a-fk-or]/gi, "")
    .trim();
// Event detail is deliberately address-free, including commands and disconnect reasons.
export const redactAddresses = (s: string) =>
  s
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, "[address]")
    .replace(
      /\[?(?:[a-f\d]{0,4}:){2,}[a-f\d:.]*(?:%[\w]+)?\]?(?::\d+)?/gi,
      "[address]",
    );
const PREFIX =
  /^\[(\d{2}:\d{2}:\d{2})(?: (?:TRACE|DEBUG|INFO|WARN|ERROR|FATAL))?\](?:\s*\[[^\]]+\])?:?\s*/;
const NAME = "(\\.?[A-Za-z0-9_]{1,16})";
const clocks = new Map<string, Intl.DateTimeFormat>();
function clockParts(at: number, tz: string) {
  let fmt = clocks.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    clocks.set(tz, fmt);
  }
  const parts = fmt.formatToParts(at);
  return (key: string) => Number(parts.find((p) => p.type === key)?.value);
}
/** Resolve a producer wall clock near its receipt, including midnight in the display zone. */
export function resolveClock(
  clock: string,
  anchor: number,
  tz: string,
): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(clock)) return anchor;
  const [h, m, s] = clock.split(":").map(Number),
    p = clockParts(anchor, tz);
  const offset =
    Date.UTC(
      p("year"),
      p("month") - 1,
      p("day"),
      p("hour"),
      p("minute"),
      p("second"),
    ) -
    Math.floor(anchor / 1000) * 1000;
  let wall = Date.UTC(p("year"), p("month") - 1, p("day"), h, m, s);
  if (wall - offset > anchor + 60000) wall -= 86400000;
  // Re-evaluate the offset at the target date for daylight-saving transitions.
  let result = wall - offset;
  const q = clockParts(result, tz);
  result =
    wall -
    (Date.UTC(
      q("year"),
      q("month") - 1,
      q("day"),
      q("hour"),
      q("minute"),
      q("second"),
    ) -
      Math.floor(result / 1000) * 1000);
  return result;
}
const DEATH = [
  "was (?:slain|shot|killed|blown up|pummeled|pricked|impaled|squashed|fireballed|doomed|burnt|struck|skewered|stung|poked|obliterated|squished|knocked)",
  "drowned",
  "died",
  "suffocated",
  "starved",
  "withered away",
  "froze to death",
  "burned to death",
  "blew up",
  "fell (?:from|off|out|while)",
  "hit the ground too hard",
  "tried to swim in lava",
  "went up in flames",
  "walked into (?:fire|a cactus)",
  "experienced kinetic energy",
  "discovered the floor was lava",
  "didn.t want to live",
  "left the confines",
  "was roasted in dragon breath",
].join("|");
interface Rule {
  kind: PlayerEventKind;
  re: RegExp;
  detail?: (m: RegExpExecArray) => string;
}
const RULES: Rule[] = [
  {
    kind: "advancement",
    re: new RegExp(`^\\[Advancement\\]\\s+${NAME}\\s*[:\\-–]?\\s*(.*)$`, "i"),
    detail: (m) =>
      m[2]
        .replace(
          /^has (?:made the advancement|completed the challenge|reached the goal)\s*/i,
          "",
        )
        .replace(/^\[|\]$/g, "")
        .trim(),
  },
  ...(["Death", "Command"] as const).map((tag) => ({
    kind: tag.toLowerCase() as "death" | "command",
    re: new RegExp(`^\\[${tag}\\]\\s+${NAME}\\s*[:\\-–]?\\s*(.*)$`, "i"),
    detail: (m: RegExpExecArray) => m[2].trim(),
  })),
  {
    kind: "advancement",
    re: new RegExp(
      `^${NAME} has (?:made the advancement|completed the challenge|reached the goal) \\[(.+)\\]$`,
    ),
    detail: (m) => m[2],
  },
  {
    kind: "command",
    re: new RegExp(`^${NAME} issued server command: (\\/.+)$`),
    detail: (m) => m[2],
  },
  { kind: "join", re: new RegExp(`^${NAME} joined the game$`) },
  {
    kind: "join",
    re: new RegExp(
      `^${NAME}\\[\\/[^\\]]+\\] logged in with entity id -?\\d+ at \\(.*\\)$`,
    ),
  },
  {
    kind: "leave",
    re: new RegExp(`^${NAME} lost connection: (.+)$`),
    detail: (m) => m[2],
  },
  { kind: "leave", re: new RegExp(`^${NAME} left the game$`) },
  {
    kind: "death",
    re: new RegExp(`^${NAME} (?:${DEATH})(?:\\s.*)?$`),
    detail: (m) => m[0].slice(m[1].length).trim(),
  },
];
/** Opaque sequence IDs never retain a raw console line or an address. */
function opaque(value: string | number) {
  let h = 2166136261;
  for (const c of String(value)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
}
export function parseConsoleLine(
  line: ConsoleLine,
  ctx: ParseCtx,
): PlayerEvent | null {
  let text = cleanLine(line.text),
    clock = line.clock;
  const prefix = PREFIX.exec(text);
  if (prefix) {
    clock ??= prefix[1];
    text = text.slice(prefix[0].length);
  }
  text = text.replace(
    /^\[(?:Server(?: thread\/(?:INFO|WARN|ERROR))?)\]:?\s*/i,
    "",
  );
  if (!text || text.startsWith("<") || text.startsWith("[Not Secure]"))
    return null;
  for (const rule of RULES) {
    const match = rule.re.exec(text);
    if (!match) continue;
    const detail = rule.detail?.(match);
    return {
      id: `${ctx.bootId}:c:${opaque(line.seq)}`,
      bootId: ctx.bootId,
      ts: Number.isFinite(line.ts)
        ? line.ts!
        : clock
          ? resolveClock(clock, ctx.anchor, ctx.tz)
          : ctx.anchor,
      kind: rule.kind,
      player: match[1],
      ...(detail ? { detail: redactAddresses(detail) } : {}),
      source: "console",
    };
  }
  return null;
}
const RANK: Record<PlayerEventSource, number> = {
  console: 3,
  presence: 2,
  roster: 1,
};
const WINDOW: Record<PlayerEventKind, number> = {
  join: 15000,
  leave: 15000,
  online: 15000,
  advancement: 2000,
  death: 2000,
  command: 2000,
};
const DETAIL_KINDS = new Set<PlayerEventKind>([
  "advancement",
  "death",
  "command",
]);
interface ActivePlayer extends RosterPlayer {
  observedSince: number;
}
interface Bucket {
  events: PlayerEvent[];
  roster: Map<string, ActivePlayer>;
  seeded: boolean;
  seen: Set<string | number>;
}
const buckets = new Map<string, Bucket>(),
  listeners = new Set<() => void>();
let version = 0;
const notify = () => {
  version++;
  listeners.forEach((l) => l());
};
function bucket(bootId: string) {
  let b = buckets.get(bootId);
  if (!b) {
    b = { events: [], roster: new Map(), seeded: false, seen: new Set() };
    buckets.set(bootId, b);
    while (buckets.size > 2) buckets.delete(buckets.keys().next().value!);
  }
  return b;
}
function insert(b: Bucket, event: PlayerEvent): boolean {
  if (!Number.isFinite(event.ts) || !event.player) return false;
  const ev = {
    ...event,
    ...(event.detail ? { detail: redactAddresses(event.detail) } : {}),
  };
  const dup = b.events.find(
    (e) =>
      e.kind === ev.kind &&
      e.player.toLowerCase() === ev.player.toLowerCase() &&
      Math.abs(e.ts - ev.ts) <= WINDOW[ev.kind] &&
      (!DETAIL_KINDS.has(ev.kind) || (e.detail ?? "") === (ev.detail ?? "")),
  );
  if (dup) {
    let changed = false;
    if (RANK[ev.source] > RANK[dup.source]) {
      dup.ts = ev.ts;
      dup.source = ev.source;
      changed = true;
    }
    if (!dup.detail && ev.detail) {
      dup.detail = ev.detail;
      changed = true;
    }
    if (changed) b.events.sort((a, c) => c.ts - a.ts);
    return changed;
  }
  b.events.push(ev);
  b.events.sort((a, c) => c.ts - a.ts);
  if (b.events.length > 500) b.events.length = 500;
  return true;
}
export function ingestConsole(
  bootId: string,
  lines: ConsoleLine[],
  ctx: Omit<ParseCtx, "bootId">,
) {
  if (!bootId) return;
  const b = bucket(bootId);
  let changed = false;
  for (const line of lines) {
    if (b.seen.has(line.seq)) continue;
    b.seen.add(line.seq);
    const ev = parseConsoleLine(line, { ...ctx, bootId });
    if (ev) changed = insert(b, ev) || changed;
  }
  if (b.seen.size > 20000) b.seen = new Set([...b.seen].slice(-10000));
  if (changed) notify();
}
export function ingestPresence(bootId: string, deltas: PresenceDelta[]) {
  if (!bootId) return;
  const b = bucket(bootId);
  let changed = false;
  for (const d of deltas)
    changed =
      insert(b, {
        id: `${bootId}:p:${d.kind}:${opaque(d.player)}:${d.ts}`,
        bootId,
        ts: d.ts,
        kind: d.kind,
        player: d.player,
        source: "presence",
      }) || changed;
  if (changed) notify();
}
/** Snapshot updates only append transitions. An unchanged snapshot is a no-op. */
export function ingestRoster(
  bootId: string,
  players: RosterPlayer[],
  now = Date.now(),
) {
  if (!bootId) return;
  const b = bucket(bootId),
    next = new Map<string, ActivePlayer>();
  let changed = !b.seeded;
  for (const p of players.slice(0, 512)) {
    if (!p.name) continue;
    const key = p.name.toLowerCase(),
      old = b.roster.get(key),
      started = Number.isFinite(p.sessionStartedAt)
        ? p.sessionStartedAt
        : undefined;
    const row = {
      ...p,
      sessionStartedAt: started ?? old?.sessionStartedAt,
      observedSince: old?.observedSince ?? now,
    };
    next.set(key, row);
    if (!old || old.sessionStartedAt !== row.sessionStartedAt) changed = true;
    if (b.seeded && !old)
      changed =
        insert(b, {
          id: `${bootId}:r:join:${opaque(p.name)}:${now}`,
          bootId,
          ts: started ?? now,
          kind: "join",
          player: p.name,
          source: "roster",
        }) || changed;
  }
  if (b.seeded)
    for (const [key, p] of b.roster)
      if (!next.has(key)) {
        changed = true;
        changed =
          insert(b, {
            id: `${bootId}:r:leave:${opaque(p.name)}:${now}`,
            bootId,
            ts: now,
            kind: "leave",
            player: p.name,
            source: "roster",
          }) || changed;
      }
  b.roster = next;
  b.seeded = true;
  if (changed) notify();
}
export function selectEvents(bootId: string | undefined): PlayerEvent[] {
  const b = bootId ? buckets.get(bootId) : undefined;
  if (!b) return [];
  const out = [...b.events];
  for (const [key, p] of b.roster) {
    const leave =
      b.events.find((e) => e.kind === "leave" && e.player.toLowerCase() === key)
        ?.ts ?? -Infinity;
    const since = p.sessionStartedAt ?? p.observedSince;
    const joined = b.events.some(
      (e) =>
        e.kind === "join" &&
        e.player.toLowerCase() === key &&
        e.ts >= leave &&
        (p.sessionStartedAt === undefined || e.ts >= since - 15000),
    );
    if (!joined)
      out.push({
        id: `${bootId}:o:${opaque(p.name)}`,
        bootId: bootId!,
        ts: since,
        kind: "online",
        player: p.name,
        detail:
          p.sessionStartedAt === undefined
            ? "Online since panel opened"
            : "Current session",
        source: "roster",
      });
  }
  return out.sort((a, c) => c.ts - a.ts).slice(0, 500);
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getVersion = () => version;
export function usePlayerEvents(bootId: string | undefined) {
  const revision = useSyncExternalStore(subscribe, getVersion, () => 0);
  return useMemo(() => selectEvents(bootId), [bootId, revision]);
}
/** Volatile data is also cleared on authority revocation; no event content is persisted. */
export function __resetPlayerEvents() {
  buckets.clear();
  notify();
}

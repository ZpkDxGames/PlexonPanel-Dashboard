import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  session,
  useControl,
  useQuery,
  records,
  time,
  usePrefs,
  type JsonMap,
} from "../bindings";
import { presentLine } from "./present-line";
import { ConsoleRow } from "./ConsoleRow";
import { consoleRowId, parseLine } from "./parse-line";
import { historyWindow, retainHistoryPage } from "./history-window";
export type ConsoleFilters = {
  level?: string;
  search?: string;
  regex?: boolean;
  plugin?: string;
};
export function LiveConsole({
  mode,
  filters = {},
  channel = "console",
  clearBefore = 0,
  wrap = true,
}: {
  mode: "compact" | "full";
  filters?: ConsoleFilters;
  channel?: "console" | "chat" | "events";
  clearBefore?: number;
  wrap?: boolean;
}) {
  const { state: s } = useControl(),
    prefs = usePrefs(),
    scroll = useRef<HTMLDivElement>(null),
    follow = useRef(true),
    [pinned, setPinned] = useState(true),
    [cursor, setCursor] = useState<string | undefined>(),
    [older, setOlder] = useState<JsonMap[]>([]),
    epoch = String(
      s.service.invocationId ?? s.ready?.server.paperSession ?? "",
    ),
    previous = useRef(epoch),
    historyAction = session.reason("console.history", "HOST")
      ? "console.history.errors"
      : "console.history",
    history = useQuery(
      historyAction,
      "HOST",
      cursor ? { cursor } : {},
      channel === "console",
    ),
    page = records(history.data.lines, 100);
  useEffect(() => {
    if (previous.current !== epoch) {
      setCursor(undefined);
      setOlder([]);
      previous.current = epoch;
    }
  }, [epoch]);
  const rows = useMemo(() => {
    const raw: JsonMap[] =
      channel === "console"
        ? historyWindow(
            older,
            page,
            s.console,
            !!cursor,
            6000,
            (l) => consoleRowId(l, epoch),
            (l) => Date.parse(String(l.capturedAt ?? l.timestamp)) || 0,
          )
        : channel === "chat"
          ? s.chat.map((l) => ({
              ...l,
              content: `<${String(l.playerName ?? "Player")}> ${String(l.message ?? "")}`,
              level: "INFO",
            }))
          : s.presenceDeltas.map((l) => ({
              ...l,
              content: `${String(l.name ?? l.uuid)} ${String(l.state ?? l.eventType ?? "presence changed")}`,
              level: "INFO",
            }));
    let rx: RegExp | null = null;
    try {
      if (filters.regex && filters.search) rx = new RegExp(filters.search, "i");
    } catch {}
    return raw
      .filter(
        (l) =>
          (Date.parse(String(l.capturedAt ?? l.timestamp ?? l.observedAt)) ||
            0) >= clearBefore,
      )
      .map((l) => presentLine(l, epoch, prefs.timezone))
      .filter(
        (l) =>
          (!filters.level ||
            filters.level === "All" ||
            (filters.level === "Error"
              ? ["ERROR", "FATAL"].includes(l.level ?? "")
              : l.level === filters.level.toUpperCase())) &&
          (!filters.plugin || l.tag === filters.plugin) &&
          (!filters.search ||
            (rx
              ? rx.test([l.tag, ...l.body.map((t) => t.v)].join(" "))
              : [l.tag, ...l.body.map((t) => t.v)]
                  .join(" ")
                  .toLowerCase()
                  .includes(filters.search.toLowerCase()))),
      );
  }, [
    s.console,
    s.chat,
    s.presenceDeltas,
    history.data,
    older,
    cursor,
    epoch,
    filters.level,
    filters.search,
    filters.regex,
    filters.plugin,
    prefs.timezone,
    channel,
    clearBefore,
  ]);
  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroll.current,
    estimateSize: () => (mode === "compact" ? 22 : 20),
    overscan: 12,
    getItemKey: (i) => rows[i].id,
    measureElement: (el) => el.getBoundingClientRect().height,
  });
  useEffect(() => {
    if (follow.current && scroll.current)
      scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [rows.length, virtual.getTotalSize()]);
  return (
    <div className="pp-console" data-mode={mode} data-wrap={wrap}>
      {channel === "console" && typeof history.data.nextCursor === "string" && (
        <button
          className="pp-ctl"
          onClick={() => {
            follow.current = false;
            setPinned(false);
            setOlder(retainHistoryPage(older, page, 5000));
            setCursor(String(history.data.nextCursor));
            if (scroll.current) scroll.current.scrollTop = 0;
          }}
        >
          Load earlier from this boot
        </button>
      )}
      <div
        className="pp-console-scroll pp-well"
        ref={scroll}
        tabIndex={0}
        role="log"
        aria-label={
          channel === "chat" ? "Current boot chat" : "Current boot console logs"
        }
        aria-live={pinned ? "polite" : "off"}
        onScroll={() => {
          if (scroll.current) {
            follow.current =
              scroll.current.scrollHeight -
                scroll.current.scrollTop -
                scroll.current.clientHeight <
              48;
            setPinned(follow.current);
          }
        }}
      >
        {rows.length ? (
          <div
            style={{
              height: virtual.getTotalSize(),
              position: "relative",
              minWidth: wrap ? undefined : "max-content",
            }}
          >
            {virtual.getVirtualItems().map((v) => (
              <div
                key={v.key}
                ref={virtual.measureElement}
                data-index={v.index}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${v.start}px)`,
                }}
              >
                <ConsoleRow line={rows[v.index]} mode={mode} />
              </div>
            ))}
          </div>
        ) : (
          <div className="pp-empty">
            {history.error && channel === "console"
              ? "Stream unavailable for this authority."
              : "Waiting for events from this boot"}
          </div>
        )}
      </div>
      {(!pinned || cursor) && (
        <button
          className="pp-ctl pp-jump"
          onClick={() => {
            setCursor(undefined);
            setOlder([]);
            follow.current = true;
            setPinned(true);
            if (scroll.current)
              scroll.current.scrollTop = scroll.current.scrollHeight;
          }}
        >
          Jump to latest ↓
        </button>
      )}
    </div>
  );
}

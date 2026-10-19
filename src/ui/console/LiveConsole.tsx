import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Terminal, Maximize2, ArrowDown } from "lucide-react";
import { useControl, useBand, useQuery, session } from "../hooks/useControl";
import { usePreferences } from "../../store/preferences";
import { records } from "../../adapter/control-state";
import { consoleRowId, parseLine } from "./parse-line";
import { historyWindow, retainHistoryPage } from "./history-window";
import { ConsoleRow } from "./ConsoleRow";
import { CommandComposer } from "./CommandComposer";
import { IconBadge } from "../primitives/IconBadge";
import { Pill } from "../primitives/Pill";
import { EmptyState } from "../primitives/EmptyState";
export function LiveConsole({
  full = false,
  plugin = "",
}: {
  full?: boolean;
  plugin?: string;
}) {
  const { state } = useControl(),
    prefs = usePreferences(),
    band = useBand("service"),
    [level, setLevel] = useState("All"),
    [search, setSearch] = useState(""),
    [expanded, setExpanded] = useState(false),
    [cursor, setCursor] = useState<string | undefined>(),
    [older, setOlder] = useState<ReturnType<typeof records>>([]),
    follow = useRef(true),
    [paused, setPaused] = useState(false),
    scroll = useRef<HTMLDivElement>(null),
    epoch = String(
      state.service.invocationId ??
        state.ready?.server.paperSession ??
        "unreported",
    ),
    previousEpoch = useRef(epoch),
    [restarted, setRestarted] = useState(false);
  const historyAction = session.reason("console.history", "HOST")
      ? "console.history.errors"
      : "console.history",
    history = useQuery(
      historyAction,
      "HOST",
      cursor ? { cursor } : {},
      !!state.serverId,
    ),
    rows = useMemo(() => {
      return historyWindow(
        older,
        records(history.data.lines, 100),
        state.console,
        !!cursor,
        2500,
        (l) => consoleRowId(l, epoch),
        (l) => Date.parse(String(l.capturedAt ?? l.timestamp)) || 0,
      ).map((l) => {
        const raw = String(l.content ?? l.message ?? ""),
          time = new Date(
            String(l.capturedAt ?? l.timestamp),
          ).toLocaleTimeString(
            "en-GB",
            prefs.timezone === "UTC" ? { timeZone: "UTC" } : {},
          ),
          prefix = /^\[?\d{2}:\d{2}:\d{2}/.test(raw)
            ? ""
            : `[${time} ${l.level ?? "INFO"}]: `;
        return parseLine(consoleRowId(l, epoch), prefix + raw);
      });
    }, [older, history.data, state.console, prefs.timezone, epoch, cursor]),
    filtered = rows.filter(
      (l) =>
        (level === "All" ||
          (level === "Error"
            ? ["ERROR", "FATAL"].includes(l.level ?? "")
            : l.level === level.toUpperCase())) &&
        (!plugin || l.tag === plugin) &&
        (!search ||
          [l.tag, ...l.body.map((t) => t.v)]
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase())),
    ),
    virtual = useVirtualizer({
      count: filtered.length,
      getScrollElement: () => scroll.current,
      estimateSize: () => 22,
      overscan: 12,
      getItemKey: (i) => filtered[i].id,
    });
  useEffect(() => {
    if (previousEpoch.current !== epoch) {
      setOlder([]);
      setCursor(undefined);
      setRestarted(true);
      previousEpoch.current = epoch;
    }
  }, [epoch]);
  useEffect(() => {
    if (follow.current && scroll.current)
      scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [filtered.length, virtual.getTotalSize()]);
  return (
    <section
      className={`pp-card live-console ${expanded ? "terminal-expanded" : ""}`}
      data-tone="cyan"
    >
      <header className="card-header">
        <IconBadge icon={Terminal} tone="cyan" />
        <h2>Live console</h2>
        <Pill tone={band === "live" ? "emerald" : "amber"} className="ml-auto">
          {band === "live" ? "Streaming" : band}
        </Pill>
        <button
          className="icon-btn"
          aria-label="Expand terminal"
          onClick={() => setExpanded(!expanded)}
        >
          <Maximize2 size={16} />
        </button>
      </header>
      <div className="console-filters">
        {["All", "Info", "Warn", "Error"].map((v) => (
          <button
            key={v}
            onClick={() => setLevel(v)}
            aria-pressed={level === v}
            className="pill"
            data-tone={v === "Warn" ? "amber" : v === "Error" ? "rose" : "cyan"}
          >
            {v}{" "}
            {v === "All"
              ? rows.length
              : rows.filter((l) =>
                  v === "Error"
                    ? ["ERROR", "FATAL"].includes(l.level ?? "")
                    : l.level === v.toUpperCase(),
                ).length}
          </button>
        ))}
        <input
          aria-label="Filter console logs"
          className="field"
          placeholder="Filter logs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {history.error && (
        <p className="text-xs text-secondary mb-2">History: {history.error}</p>
      )}
      {typeof history.data.nextCursor === "string" && (
        <button
          className="text-xs tone-link mb-2"
          onClick={() => {
            setOlder(
              retainHistoryPage(older, records(history.data.lines, 100), 2500),
            );
            follow.current = false;
            setPaused(true);
            if (scroll.current) scroll.current.scrollTop = 0;
            setCursor(String(history.data.nextCursor));
          }}
        >
          Load earlier from this boot
        </button>
      )}
      {restarted && (
        <div className="console-epoch">
          Server restarted · {epoch.slice(0, 12)}
        </div>
      )}
      <div
        ref={scroll}
        tabIndex={0}
        role="log"
        aria-label="Current boot console logs"
        className="pp-well console-scroll"
        style={{
          height: expanded ? "60vh" : full ? "calc(100dvh - 340px)" : 390,
        }}
        onScroll={() => {
          const el = scroll.current!;
          follow.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 48;
          setPaused(!follow.current);
        }}
      >
        {filtered.length ? (
          <div
            style={{
              height: virtual.getTotalSize(),
              position: "relative",
              width: "100%",
            }}
          >
            {virtual.getVirtualItems().map((item) => (
              <div
                key={item.key}
                data-index={item.index}
                ref={virtual.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${item.start}px)`,
                }}
              >
                <ConsoleRow
                  line={filtered[item.index]}
                  prev={filtered[item.index - 1]}
                />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Waiting for the first log line of this boot"
            detail={`Epoch ${epoch.slice(0, 12)}`}
          />
        )}
      </div>
      {(paused || cursor) && (
        <button
          className="pp-glass jump-live"
          onClick={() => {
            setCursor(undefined);
            setOlder([]);
            follow.current = true;
            setPaused(false);
            if (scroll.current)
              scroll.current.scrollTop = scroll.current.scrollHeight;
          }}
        >
          <ArrowDown size={12} /> Jump to live
        </button>
      )}
      <footer className="chart-footer">
        <span>
          {cursor
            ? "Browsing boot history"
            : paused
              ? "Paused"
              : "Following live"}
        </span>
        <span>Host history · {rows.length} lines</span>
      </footer>
      <CommandComposer />
    </section>
  );
}

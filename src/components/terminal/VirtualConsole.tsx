"use client";
import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { str, type JsonMap } from "../../adapter/control-state";
import { FormattedText } from "../FormattedText";
export function VirtualConsole({
  lines,
  wrap,
  tail,
  utc,
  returnVersion,
  onFollowChange,
}: {
  lines: JsonMap[];
  wrap: boolean;
  tail: boolean;
  utc: boolean;
  returnVersion: number;
  onFollowChange: (v: boolean) => void;
}) {
  const scroll = useRef<HTMLDivElement>(null),
    follow = useRef(true);
  const virtual = useVirtualizer({
    count: lines.length,
    getScrollElement: () => scroll.current,
    estimateSize: () => 28,
    overscan: 8,
    getItemKey: (i) =>
      String(
        lines[i]?.journalCursor ??
          `${lines[i]?.streamSession}:${lines[i]?.sourceSequence}:${lines[i]?.capturedAt}:${i}`,
      ),
  });
  useEffect(() => {
    if (tail && follow.current && lines.length)
      virtual.scrollToIndex(lines.length - 1, { align: "end" });
  }, [lines, tail, virtual]);
  useEffect(() => {
    follow.current = true;
    if (lines.length) virtual.scrollToIndex(lines.length - 1, { align: "end" });
  }, [returnVersion]);
  useEffect(() => {
    virtual.measure();
  }, [wrap, virtual]);
  const clock = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: utc ? "UTC" : undefined,
  });
  return (
    <div
      ref={scroll}
      className={`terminal-scroll virtual-scroll ${wrap ? "wrap" : "nowrap"}`}
      style={{ height: 420 }}
      role="region"
      tabIndex={0}
      aria-label="Live console output"
      onScroll={(e) => {
        const el = e.currentTarget;
        follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 55;
        onFollowChange(follow.current);
      }}
    >
      <div
        style={{
          height: virtual.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {virtual.getVirtualItems().map((item) => {
          const row = lines[item.index],
            at = Date.parse(str(row.capturedAt, ""));
          return (
            <div
              key={item.key}
              ref={virtual.measureElement}
              data-index={item.index}
              className="v5-virtual-line terminal-line"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${item.start}px)`,
                whiteSpace: wrap ? "pre-wrap" : "pre",
                overflow: wrap ? "visible" : "hidden",
              }}
            >
              <time>{Number.isFinite(at) ? clock.format(at) : "—"}</time>
              <span data-level={row.level}>{str(row.level, "INFO")}</span>
              <span className="line-message">
                <FormattedText value={str(row.content ?? row.rawText, "")} />
              </span>
            </div>
          );
        })}
      </div>
      {!lines.length ? (
        <p className="v5-session">No matching Host output received.</p>
      ) : null}
    </div>
  );
}

"use client";
import { useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { str, type JsonMap } from "../../adapter/control-state";
import { FormattedText } from "../FormattedText";
import { consoleMessage } from "../../presentation/console-text";
import { cn } from "../../lib/utils";
export function VirtualConsole({
  lines,
  wrap = true,
  tail = true,
  utc = false,
  returnVersion = 0,
  onFollowChange,
  height = 340,
}: {
  lines: JsonMap[];
  wrap?: boolean;
  tail?: boolean;
  utc?: boolean;
  returnVersion?: number;
  onFollowChange?: (v: boolean) => void;
  height?: number;
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
          lines[i]?.seq ??
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
  useEffect(() => virtual.measure(), [wrap, virtual]);
  const clock = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: utc ? "UTC" : undefined,
      }),
    [utc],
  );
  return (
    <div
      ref={scroll}
      role="region"
      tabIndex={0}
      aria-label="Live console output"
      data-testid="virtual-console"
      className="min-w-0 overflow-auto bg-terminal py-2 font-mono text-[10px] leading-5"
      style={{ height }}
      onScroll={(e) => {
        const el = e.currentTarget;
        follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 55;
        onFollowChange?.(follow.current);
      }}
    >
      <div
        className="relative w-full"
        style={{ height: virtual.getTotalSize() }}
      >
        {virtual.getVirtualItems().map((item) => {
          const row = lines[item.index],
            at = Date.parse(str(row.capturedAt, "")),
            level = str(row.level, "INFO");
          return (
            <div
              key={item.key}
              ref={virtual.measureElement}
              data-index={item.index}
              data-log-row
              className={cn(
                "absolute left-0 top-0 grid w-full grid-cols-[54px_34px_minmax(0,1fr)] gap-2 px-4 py-1 hover:bg-muted/40",
                wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
              )}
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <time className="text-muted-foreground">
                {Number.isFinite(at) ? clock.format(at) : "—"}
              </time>
              <span
                className={
                  level === "ERROR"
                    ? "text-rose-500 dark:text-rose-300"
                    : level === "WARN"
                      ? "text-amber-800 dark:text-amber-300"
                      : "text-sky-700 dark:text-sky-300"
                }
              >
                {level}
              </span>
              <span
                className={cn(
                  "min-w-0 text-foreground/85",
                  !wrap && "overflow-hidden text-ellipsis",
                )}
              >
                <FormattedText
                  value={consoleMessage(
                    str(row.content ?? row.rawText ?? row.message, ""),
                  )}
                />
              </span>
            </div>
          );
        })}
      </div>
      {!lines.length && (
        <div className="flex h-full min-h-40 items-center justify-center px-5 text-center text-muted-foreground">
          No matching Host output received.
        </div>
      )}
    </div>
  );
}

"use client";
import { useRef, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
export function VirtualRows<T>({
  rows,
  getKey,
  render,
  height = 420,
  label = "Records",
}: {
  rows: T[];
  getKey: (row: T) => string;
  render: (row: T) => ReactNode;
  height?: number;
  label?: string;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroll.current,
    estimateSize: () => 68,
    overscan: 6,
    getItemKey: (i) => getKey(rows[i]),
  });
  return (
    <div
      ref={scroll}
      role="region"
      aria-label={label}
      tabIndex={0}
      className="overflow-auto"
      style={{ height }}
    >
      <div
        className="relative w-full"
        style={{ height: virtual.getTotalSize() }}
      >
        {virtual.getVirtualItems().map((item) => (
          <div
            key={item.key}
            ref={virtual.measureElement}
            data-index={item.index}
            className="absolute left-0 top-0 w-full"
            style={{ transform: `translateY(${item.start}px)` }}
          >
            {render(rows[item.index])}
          </div>
        ))}
      </div>
    </div>
  );
}

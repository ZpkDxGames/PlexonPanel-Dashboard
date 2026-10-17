"use client";
import { useRef, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
export function VirtualRows<T>({
  rows,
  render,
  getKey,
  height = 460,
}: {
  rows: T[];
  render: (row: T, index: number) => ReactNode;
  getKey: (row: T, index: number) => string;
  height?: number;
}) {
  const scroll = useRef<HTMLDivElement>(null),
    virtual = useVirtualizer({
      count: rows.length,
      getScrollElement: () => scroll.current,
      estimateSize: () => 76,
      overscan: 5,
      getItemKey: (i) => getKey(rows[i], i),
    });
  return (
    <div ref={scroll} className="virtual-scroll" style={{ maxHeight: height }}>
      <div style={{ height: virtual.getTotalSize(), position: "relative" }}>
        {virtual.getVirtualItems().map((item) => (
          <div
            key={item.key}
            ref={virtual.measureElement}
            data-index={item.index}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              transform: `translateY(${item.start}px)`,
            }}
          >
            {render(rows[item.index], item.index)}
          </div>
        ))}
      </div>
    </div>
  );
}

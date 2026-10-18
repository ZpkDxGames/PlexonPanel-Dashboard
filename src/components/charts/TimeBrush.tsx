"use client";
import { useMemo, useRef, memo } from "react";
import { Area, Brush, ComposedChart, ResponsiveContainer } from "recharts";
import type { ControlState } from "../../adapter/control-state";
import { historyFor } from "../../presentation/telemetry";
import { usePlotHistory } from "../../presentation/PlotHistory";
/** A single unsynchronized navigator owns the shared time domain. Per-source charts retain independent clocks. */
export function TimeBrush({
  state,
  since,
  onRange,
}: {
  state: ControlState;
  since: number;
  onRange: (range: [number, number] | undefined) => void;
}) {
  const epochs = usePlotHistory(state.history);
  const data = useMemo(() => {
    const raw = historyFor(
        epochs?.paperHealth ?? state.history,
        "paperHealth",
        since,
      ),
      step = Math.max(1, Math.ceil(raw.length / 300));
    return raw.filter((_, i) => i % step === 0 || i === raw.length - 1);
  }, [epochs, state.history, since]);
  const bucket = Math.floor((data.at(-1)?.at ?? 0) / 10000),
    frozen = useRef({ bucket, data, since });
  if (
    frozen.current.bucket !== bucket ||
    Math.abs(frozen.current.since - since) > 30000
  )
    frozen.current = { bucket, data, since };
  return <BrushCanvas data={frozen.current.data} onRange={onRange} />;
}
const BrushCanvas = memo(function BrushCanvas({
  data,
  onRange,
}: {
  data: ReturnType<typeof historyFor>;
  onRange: (range: [number, number] | undefined) => void;
}) {
  return (
    <div
      className="px-5 py-3"
      role="group"
      aria-label="Shared telemetry time brush"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground">
          Drag the handles to inspect a time window
        </span>
        <button
          className="text-[10px] text-primary"
          onClick={() => onRange(undefined)}
        >
          Reset zoom
        </button>
      </div>
      <div className="h-14 min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart
            data={data}
            margin={{ top: 0, left: 8, right: 8, bottom: 0 }}
          >
            <Area
              dataKey="tps"
              stroke="var(--primary)"
              fill="var(--primary)"
              fillOpacity={0.04}
              isAnimationActive={false}
              dot={false}
            />
            <Brush
              ariaLabel="Shared time window"
              dataKey="at"
              height={22}
              stroke="var(--muted-foreground)"
              fill="var(--background)"
              travellerWidth={8}
              tickFormatter={(v) => new Date(v).toLocaleTimeString()}
              onChange={({ startIndex, endIndex }) => {
                const first = data[startIndex ?? 0],
                  last =
                    data[
                      Math.min(endIndex ?? data.length - 1, data.length - 1)
                    ];
                if (first && last && first.at < last.at)
                  onRange([first.at, last.at]);
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

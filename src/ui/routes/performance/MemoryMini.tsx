import { useId } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  Area,
} from "recharts";
import { useControl } from "../../hooks/useControl";
import { buildRows } from "../../chart/scales";
export function MemoryMini() {
  const { state } = useControl(),
    data = buildRows(state.history),
    id = useId().replaceAll(":", "");
  return (
    <div className="pp-well h-36 p-2">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart>
          <defs>
            {["violet", "indigo"].map((tone) => (
              <linearGradient
                key={tone}
                id={`mini-${id}-${tone}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0"
                  stopColor={`rgb(var(--hue-${tone}))`}
                  stopOpacity={0.5}
                />
                <stop
                  offset=".6"
                  stopColor={`rgb(var(--hue-${tone}))`}
                  stopOpacity={0.15}
                />
                <stop
                  offset="1"
                  stopColor={`rgb(var(--hue-${tone}))`}
                  stopOpacity={0}
                />
              </linearGradient>
            ))}
          </defs>
          <XAxis
            dataKey="t"
            type="number"
            hide
            domain={["dataMin", "dataMax"]}
          />
          <YAxis hide domain={[0, "auto"]} />
          <Area
            data={data.system}
            dataKey="committed"
            stroke="rgb(var(--hue-violet)/.4)"
            fill={`url(#mini-${id}-violet)`}
            isAnimationActive={false}
            dot={false}
            connectNulls={false}
          />
          <Area
            data={data.service}
            dataKey="cgroup"
            stroke="rgb(var(--hue-indigo))"
            fill={`url(#mini-${id}-indigo)`}
            isAnimationActive={false}
            dot={false}
            connectNulls={false}
          />
          <Area
            data={data.system}
            dataKey="heap"
            stroke="rgb(var(--hue-violet))"
            fill={`url(#mini-${id}-violet)`}
            isAnimationActive={false}
            dot={false}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
export function GcMini() {
  const { state } = useControl(),
    data = buildRows(state.history).system,
    events = data.filter((r) => typeof r.gc === "number" && r.gc > 0),
    start = data[0]?.t ?? 0,
    end = data.at(-1)?.t ?? 1;
  return (
    <div className="pp-well h-28 p-3" data-tone="rose">
      <svg
        viewBox="0 0 300 70"
        className="w-full h-full"
        role="img"
        aria-label="Observed GC counter increases"
      >
        <line x1={4} x2={296} y1={42} y2={42} stroke="rgb(var(--line)/.12)" />
        {events.map((r, i) => (
          <g
            key={i}
            transform={`translate(${4 + ((r.t - start) / Math.max(1, end - start)) * 292},42)`}
          >
            <line
              x1={0}
              x2={0}
              y1={0}
              y2={-Math.min(35, Number(r.gc) * 2)}
              stroke="rgb(var(--hue-rose)/.5)"
            />
            <rect
              x={-3}
              y={-3}
              width={6}
              height={6}
              transform="rotate(45)"
              fill="rgb(var(--hue-rose))"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

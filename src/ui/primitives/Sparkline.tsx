import type { Tone } from "../types";
import { fmtGiB } from "../hooks/useControl";
import { useId } from "react";

export function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i],
      [x1, y1] = pts[i + 1],
      cx = (x0 + x1) / 2;
    d += ` C${cx.toFixed(2)},${y0.toFixed(2)} ${cx.toFixed(2)},${y1.toFixed(2)} ${x1.toFixed(2)},${y1.toFixed(2)}`;
  }
  return d; // horizontal-tangent beziers never overshoot the data
}

export function Sparkline({
  values,
  min,
  max,
  height = 36,
  filled = true,
  target,
}: {
  values: (number | null)[];
  min?: number;
  max?: number;
  height?: number;
  filled?: boolean;
  target?: number;
}) {
  const id = useId().replace(/:/g, "");
  const W = 160,
    H = height,
    padY = 4;
  const nums = values.filter((v): v is number => v != null);
  if (nums.length < 2)
    return (
      <div
        className="h-9 rounded-md border border-dashed border-[rgb(var(--line)/0.1)]"
        aria-label="Collecting samples"
      />
    );
  const lo = min ?? Math.min(...nums),
    hi = max ?? Math.max(...nums),
    span = Math.max(hi - lo, 1e-6);
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => H - padY - ((v - lo) / span) * (H - padY * 2);
  // split on nulls so epoch gaps are never bridged
  const segs: [number, number][][] = [];
  let cur: [number, number][] = [];
  values.forEach((v, i) => {
    if (v == null) {
      if (cur.length) (segs.push(cur), (cur = []));
    } else cur.push([x(i), y(v)]);
  });
  if (cur.length) segs.push(cur);
  const last = segs.at(-1)!.at(-1)!;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-9 w-full overflow-visible"
      role="img"
      aria-label="Recent trend"
    >
      <defs>
        <linearGradient id={`sf-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgb(var(--tone))" stopOpacity=".45" />
          <stop offset=".6" stopColor="rgb(var(--tone))" stopOpacity=".12" />
          <stop offset="1" stopColor="rgb(var(--tone))" stopOpacity="0" />
        </linearGradient>
        <filter id={`sg-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      {target != null && (
        <line
          x1="0"
          x2={W}
          y1={y(target)}
          y2={y(target)}
          stroke="rgb(var(--line) / .22)"
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {segs.map((s, k) => (
        <g key={k}>
          {filled && s.length > 1 && (
            <path
              d={`${smoothPath(s)} L${s.at(-1)![0]},${H} L${s[0][0]},${H} Z`}
              fill={`url(#sf-${id})`}
            />
          )}
          <path
            d={smoothPath(s)}
            fill="none"
            stroke="rgb(var(--tone))"
            strokeWidth="1.6"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
      <circle
        cx={last[0]}
        cy={last[1]}
        r="3.5"
        fill="rgb(var(--tone))"
        filter={`url(#sg-${id})`}
      />
      <circle
        cx={last[0]}
        cy={last[1]}
        r="2"
        fill="rgb(var(--tone))"
        stroke="rgb(var(--card))"
        strokeWidth="1"
      />
    </svg>
  );
}

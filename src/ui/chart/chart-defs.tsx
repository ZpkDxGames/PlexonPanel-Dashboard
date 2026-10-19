import type { Tone } from "../types";
export function ChartDefs() {
  const grad = (id: string, hue: string, top = 0.42, mid = 0.14) => (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop
        offset="0%"
        stopColor={`rgb(var(--hue-${hue}))`}
        stopOpacity={top}
      />
      <stop
        offset="55%"
        stopColor={`rgb(var(--hue-${hue}))`}
        stopOpacity={mid}
      />
      <stop
        offset="100%"
        stopColor={`rgb(var(--hue-${hue}))`}
        stopOpacity={0}
      />
    </linearGradient>
  );
  return (
    <defs>
      {grad("fill-indigo", "indigo")}
      {grad("fill-slate", "slate")}
      {grad("fill-rose", "rose")}
      {grad("fill-emerald", "emerald")}
      {grad("fill-cyan", "cyan")}
      {grad("fill-violet", "violet", 0.34, 0.1)}
      {grad("fill-amber", "amber", 0.34, 0.1)}
      {grad("fill-sky", "sky", 0.3, 0.08)}

      {/* p95-p99 confidence band: soft horizontal vertical-fade */}
      <linearGradient id="band-p9x" x1="0" y1="0" x2="0" y2="1">
        <stop
          offset="0%"
          stopColor="rgb(var(--hue-violet))"
          stopOpacity=".28"
        />
        <stop
          offset="100%"
          stopColor="rgb(var(--hue-amber))"
          stopOpacity=".10"
        />
      </linearGradient>

      {/* line glow */}
      <filter id="line-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2.4" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* hatched pattern for epoch gaps (server restarted: no data, not zero) */}
      <pattern
        id="epoch-gap"
        width="8"
        height="8"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width="8" height="8" fill="rgb(var(--hue-slate) / .05)" />
        <line
          x1="0"
          y1="0"
          x2="0"
          y2="8"
          stroke="rgb(var(--hue-slate) / .22)"
          strokeWidth="2"
        />
      </pattern>
    </defs>
  );
}

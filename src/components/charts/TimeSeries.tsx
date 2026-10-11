import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { Sample } from "../../adapter/control-state";
import { axisMaximum, formatMeasure, metricPoints, plotSegments, summarize, type MetricKey, type Point, type TimeWindow } from "../../lib/telemetryView";
import { usePreferences } from "../../store/preferences";
type Series = { key: MetricKey; label: string; color: string; unit: string; axis?: "left" | "right"; max?: number };
const Crosshair = createContext<{ at: number | null; setAt: (at: number | null) => void }>({ at: null, setAt: () => {} });
export function CrosshairGroup({ children }: { children: ReactNode }) {
  const [at, setAt] = useState<number | null>(null);
  const value = useMemo(() => ({ at, setAt }), [at]);
  return <Crosshair.Provider value={value}>{children}</Crosshair.Provider>;
}
export function TimeSeries({ samples, series, yMin = 0, yMax, threshold, title, source = "Paper", height = 260, window, onZoom }: {
  samples: Sample[]; series: readonly Series[]; yMin?: number; yMax?: number; threshold?: number; title: string; source?: string; height?: number;
  window?: TimeWindow; onZoom?: (window: TimeWindow) => void;
}) {
  const [table, setTable] = useState(false), [hidden, setHidden] = useState<Set<MetricKey>>(new Set()), [width, setWidth] = useState(700), [dragFrom, setDragFrom] = useState<number | null>(null);
  const frame = useRef<HTMLDivElement>(null), id = useId().replaceAll(":", ""), crosshair = useContext(Crosshair), prefs = usePreferences();
  useEffect(() => {
    if (!frame.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(frame.current); return () => observer.disconnect();
  }, []);
  const time = (at: number) => new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, ...(prefs.timezone === "UTC" ? { timeZone: "UTC" } : {}) }).format(at);
  const projected = useMemo(() => series.map((item) => { const points = metricPoints(samples, item.key, window); return { ...item, points, segments: plotSegments(points), summary: summarize(points) }; }), [samples, series, window]);
  const timestamps = useMemo(() => [...new Set(projected.flatMap((item) => item.points.filter((p) => p.value !== null).map((p) => p.at)))].sort((a, b) => a - b), [projected]);
  const first = timestamps[0] ?? 0, last = timestamps.at(-1) ?? first + 1;
  const minAt = window?.from ?? (first === last ? first - 5000 : first), maxAt = window?.to ?? (first === last ? last + 5000 : last);
  const dual = series.some((item) => item.axis === "right"), plotLeft = 62, plotRight = width - (dual ? 64 : 20), plotTop = 30, plotBottom = height - 34;
  const left = projected.filter((item) => item.axis !== "right"), right = projected.filter((item) => item.axis === "right");
  const maximum = (items: typeof projected, fixed?: number) => fixed ?? items.find((item) => item.max !== undefined)?.max ?? axisMaximum(items.flatMap((item) => item.points.filter((p) => p.value !== null).map((p) => p.value!)), threshold === undefined ? 1 : threshold * 2);
  const leftMax = maximum(left, yMax), rightMax = maximum(right);
  const x = (at: number) => plotLeft + (at - minAt) / Math.max(1, maxAt - minAt) * (plotRight - plotLeft);
  const y = (value: number, axis?: string) => plotBottom - (value - yMin) / Math.max(1, (axis === "right" ? rightMax : leftMax) - yMin) * (plotBottom - plotTop);
  const hovered = crosshair.at !== null && crosshair.at >= minAt && crosshair.at <= maxAt ? crosshair.at : null;
  const nearest = (points: Point[], at: number) => {
    let lo = 0, hi = points.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (points[mid].at < at) lo = mid + 1; else hi = mid; }
    const found = [points[lo], points[lo - 1]].filter(Boolean).reduce<Point | null>((best, p) => !best || Math.abs(p.at - at) < Math.abs(best.at - at) ? p : best, null);
    return found && found.value !== null && Math.abs(found.at - at) <= 5000 ? found : null;
  };
  const targetAt = (clientX: number, rect: DOMRect) => minAt + Math.max(0, Math.min(1, ((clientX - rect.left) / rect.width * width - plotLeft) / (plotRight - plotLeft))) * (maxAt - minAt);
  const summary = timestamps.length ? `${title}. ${timestamps.length} capture instants. Independent source clocks. Missing samples and gaps over ten seconds remain empty. Arrow keys inspect; Home and End jump to endpoints.` : `${title}. Waiting for measured samples.`;
  const path = (segment: Point[], axis?: string) => segment.map((p, i) => `${i ? "L" : "M"}${x(p.at).toFixed(2)},${y(p.value!, axis).toFixed(2)}`).join("");
  const tableTimes = timestamps.slice(-50).reverse();
  return <div className="chart-block">
    <div className="chart-legend">{series.map((item) => <button key={item.key} aria-pressed={!hidden.has(item.key)} onClick={() => setHidden((current) => { const next = new Set(current); next.has(item.key) ? next.delete(item.key) : next.add(item.key); return next; })} className={hidden.has(item.key) ? "muted" : ""}><i style={{ background: item.color }}/>{item.label}<small>{item.axis === "right" ? "right axis" : item.unit === "bytes" ? "memory" : item.unit}</small></button>)}<button className="table-toggle" aria-expanded={table} onClick={() => setTable((v) => !v)}>{table ? "Hide samples" : "Sample table"}</button></div>
    <div className="chart-frame" ref={frame}>
      <svg className="time-series" role="img" aria-label={summary} viewBox={`0 0 ${width} ${height}`} style={{ height }} tabIndex={0}
        onPointerMove={(e) => { if (timestamps.length) crosshair.setAt(targetAt(e.clientX, e.currentTarget.getBoundingClientRect())); }} onPointerLeave={() => { if (dragFrom === null) crosshair.setAt(null); }}
        onPointerDown={(e) => { if (onZoom && timestamps.length) { setDragFrom(targetAt(e.clientX, e.currentTarget.getBoundingClientRect())); e.currentTarget.setPointerCapture(e.pointerId); } }}
        onPointerUp={(e) => { if (dragFrom !== null && onZoom) { const at = targetAt(e.clientX, e.currentTarget.getBoundingClientRect()); if (Math.abs(at - dragFrom) >= 5000) onZoom({ from: Math.min(at, dragFrom), to: Math.max(at, dragFrom) }); } setDragFrom(null); }} onPointerCancel={() => setDragFrom(null)} onBlur={() => crosshair.setAt(null)}
        onKeyDown={(e) => { if (!timestamps.length || !["ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(e.key)) return; e.preventDefault(); if (e.key === "Escape") { crosshair.setAt(null); return; } const current = hovered === null ? -1 : timestamps.findIndex((at) => at >= hovered); const next = e.key === "Home" ? 0 : e.key === "End" ? timestamps.length - 1 : e.key === "ArrowLeft" ? Math.max(0, (current < 0 ? timestamps.length : current) - 1) : Math.min(timestamps.length - 1, current + 1); crosshair.setAt(timestamps[next]); }}>
        <defs><clipPath id={`${id}-plot`}><rect x={plotLeft} y={plotTop} width={plotRight - plotLeft} height={plotBottom - plotTop}/></clipPath>{series.map((item) => <linearGradient id={`${id}-${item.key}`} key={item.key} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={item.color} stopOpacity=".18"/><stop offset="1" stopColor={item.color} stopOpacity="0"/></linearGradient>)}</defs>
        <text x={plotLeft} y={15}>{left[0]?.unit === "bytes" ? "Memory" : left[0]?.unit}</text>{dual && <text x={plotRight} y={15} textAnchor="end">{right[0]?.unit}</text>}
        {[0, .25, .5, .75, 1].map((ratio) => { const position = plotTop + (plotBottom - plotTop) * ratio; return <g key={ratio}><line x1={plotLeft} x2={plotRight} y1={position} y2={position} className="gridline"/><text x={plotLeft - 10} y={position + 4} textAnchor="end">{formatMeasure(yMin + (leftMax - yMin) * (1 - ratio), left[0]?.unit === "bytes" ? "bytes" : "", 1)}</text>{dual && <text x={plotRight + 10} y={position + 4}>{formatMeasure(yMin + (rightMax - yMin) * (1 - ratio), "", 1)}</text>}</g>; })}
        <g clipPath={`url(#${id}-plot)`}>
          {threshold !== undefined && <g><line x1={plotLeft} x2={plotRight} y1={y(threshold, dual ? "right" : "left")} y2={y(threshold, dual ? "right" : "left")} className="threshold"/><text x={plotRight - 4} y={y(threshold, dual ? "right" : "left") - 7} textAnchor="end">{threshold} ms tick budget</text></g>}
          {projected.filter((item) => !hidden.has(item.key)).map((item) => <g key={item.key}>{item.segments.map((segment, i) => <g key={i}>{segment.length > 1 ? <><path d={`${path(segment, item.axis)}L${x(segment.at(-1)!.at)},${plotBottom}L${x(segment[0].at)},${plotBottom}Z`} fill={`url(#${id}-${item.key})`}/><path d={path(segment, item.axis)} fill="none" stroke={item.color} className="chart-line"/></> : <circle cx={x(segment[0].at)} cy={y(segment[0].value!, item.axis)} r={3} fill={item.color}/>}</g>)}</g>)}
          {hovered !== null && <><line x1={x(hovered)} x2={x(hovered)} y1={plotTop} y2={plotBottom} className="crosshair"/>{projected.filter((item) => !hidden.has(item.key)).map((item) => { const point = nearest(item.points, hovered); return point ? <circle key={item.key} cx={x(point.at)} cy={y(point.value!, item.axis)} r={4} fill={item.color} stroke="var(--surface)" strokeWidth={2}/> : null; })}</>}
          {dragFrom !== null && hovered !== null && <rect x={Math.min(x(dragFrom), x(hovered))} y={plotTop} width={Math.abs(x(dragFrom) - x(hovered))} height={plotBottom - plotTop} className="chart-selection"/>}
        </g>
        <text x={plotLeft} y={height - 9}>{timestamps.length ? time(minAt) : "No samples yet"}</text><text x={plotRight} y={height - 9} textAnchor="end">{timestamps.length ? time(maxAt) : ""}</text>
      </svg>
      {!timestamps.length && <div className="chart-empty"><strong>Awaiting telemetry</strong><span>Measured samples will appear here.</span></div>}
      {hovered !== null && <div className="chart-tooltip"><strong>{time(hovered)}{prefs.timezone === "UTC" ? " UTC" : ""}</strong>{projected.filter((item) => !hidden.has(item.key)).map((item) => { const point = nearest(item.points, hovered); return <span key={item.key}><i style={{ background: item.color }}/>{item.label}<b>{point ? formatMeasure(point.value, item.unit) : "No nearby sample"}</b>{point && <small>Captured {time(point.at)}</small>}</span>; })}</div>}
    </div>
    <div className="chart-readings">{projected.filter((item) => !hidden.has(item.key)).map((item) => <div key={item.key}><span><i style={{ background: item.color }}/>{item.label}</span><strong>{formatMeasure(item.summary?.latest.value, item.unit)}</strong><small>Min {formatMeasure(item.summary?.min, item.unit)} · Max {formatMeasure(item.summary?.max, item.unit)}</small></div>)}</div>
    {table && <div className="table-region" tabIndex={0} aria-label={`${title} sample table`}><table><thead><tr><th>Captured {prefs.timezone === "UTC" ? "(UTC)" : ""}</th>{series.map((item) => <th key={item.key}>{item.label}</th>)}</tr></thead><tbody>{tableTimes.map((at) => <tr key={at}><td>{time(at)}</td>{projected.map((item) => <td key={item.key}>{formatMeasure(item.points.find((p) => p.at === at)?.value, item.unit)}</td>)}</tr>)}{!tableTimes.length && <tr><td colSpan={series.length + 1}>No observed samples.</td></tr>}</tbody></table><p className="sample-table-note">Latest 50 source capture instants. A dash means this source did not capture a value at that instant.</p></div>}
    <footer className="chart-provenance"><span>{source}</span><span>{projected.map((item) => `${item.label}: ${item.summary?.count ?? 0}`).join(" · ")}</span><span>{timestamps.length ? `${((last - first) / 60_000).toFixed(1)} min observed` : "No observed window"}</span></footer>
  </div>;
}

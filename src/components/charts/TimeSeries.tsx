import { createContext, useContext, useId, useMemo, useState, type ReactNode } from "react";
import type { Sample } from "../../adapter/control-state";

type Key = keyof Pick<Sample, "tps" | "mspt" | "hostCpu" | "processCpu" | "heap" | "memory" | "players" | "gc">;
type Series = { key: Key; label: string; color: string; unit: string };
const Crosshair = createContext<{ at: number | null; setAt: (at: number | null) => void }>({ at: null, setAt: () => {} });

export function CrosshairGroup({ children }: { children: ReactNode }) {
  const [at, setAt] = useState<number | null>(null);
  return <Crosshair.Provider value={{ at, setAt }}>{children}</Crosshair.Provider>;
}

function linePath(samples: Sample[], key: Key, x: (at: number) => number, y: (value: number) => number): string {
  let path = "";
  let drawing = false;
  let previous = 0;
  for (const sample of samples) {
    const value = sample[key];
    const gap = previous && sample.at - previous > 10_000;
    if (typeof value !== "number" || gap) { drawing = false; previous = sample.at; if (typeof value !== "number") continue; }
    path += `${drawing ? "L" : "M"}${x(sample.at).toFixed(2)},${y(value).toFixed(2)}`;
    drawing = true; previous = sample.at;
  }
  return path;
}

export function TimeSeries({ samples, series, yMin = 0, yMax, threshold, title, source = "Paper", height = 260 }: { samples: Sample[]; series: Series[]; yMin?: number; yMax?: number; threshold?: number; title: string; source?: string; height?: number }) {
  const [table, setTable] = useState(false);
  const [hidden, setHidden] = useState<Set<Key>>(new Set());
  const id = useId().replaceAll(":", "");
  const crosshair = useContext(Crosshair);
  const width = 1000, plotTop = 22, plotBottom = height - 34, plotLeft = 52, plotRight = 980;
  const present = samples.filter((sample) => series.some(({ key }) => typeof sample[key] === "number"));
  const minAt = present[0]?.at ?? 0, maxAt = present.at(-1)?.at ?? minAt + 1;
  const observed = present.flatMap((sample) => series.map(({ key }) => sample[key]).filter((value): value is number => typeof value === "number"));
  const maximum = yMax ?? Math.max(threshold ?? 0, ...observed, 1);
  const roundedMax = threshold ? Math.max(100, Math.ceil(maximum / 100) * 100) : Math.ceil(maximum / 10) * 10 || 10;
  const x = (at: number) => plotLeft + ((at - minAt) / Math.max(1, maxAt - minAt)) * (plotRight - plotLeft);
  const y = (value: number) => plotBottom - ((value - yMin) / Math.max(1, roundedMax - yMin)) * (plotBottom - plotTop);
  const nearest = useMemo(() => crosshair.at === null || !present.length ? null : present.reduce((best, sample) => Math.abs(sample.at - crosshair.at!) < Math.abs(best.at - crosshair.at!) ? sample : best), [crosshair.at, present]);
  const move = (clientX: number, rect: DOMRect) => {
    if (!present.length) return;
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const target = minAt + fraction * (maxAt - minAt);
    crosshair.setAt(present.reduce((best, sample) => Math.abs(sample.at - target) < Math.abs(best.at - target) ? sample : best).at);
  };
  const summary = present.length ? `${title}: ${present.length} observed samples from ${new Date(minAt).toLocaleTimeString()} to ${new Date(maxAt).toLocaleTimeString()}. Gaps over ten seconds are not connected.` : `${title}: no samples received.`;
  return <div className="chart-block">
    <div className="chart-legend">{series.map((item) => <button key={item.key} aria-pressed={!hidden.has(item.key)} onClick={() => setHidden((current) => { const next = new Set(current); next.has(item.key) ? next.delete(item.key) : next.add(item.key); return next; })} className={hidden.has(item.key) ? "muted" : ""}><i style={{ background: item.color }} />{item.label}</button>)}<button className="table-toggle" aria-expanded={table} aria-controls={`${id}-table`} onClick={() => setTable((value) => !value)}>{table ? "Hide samples" : "Sample table"}</button></div>
    <svg className="time-series" role="img" aria-label={summary} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" tabIndex={0} onPointerMove={(event) => move(event.clientX, event.currentTarget.getBoundingClientRect())} onPointerLeave={() => crosshair.setAt(null)} onKeyDown={(event) => { if (!present.length || !["ArrowLeft", "ArrowRight"].includes(event.key)) return; event.preventDefault(); const current = Math.max(0, present.findIndex((sample) => sample.at === nearest?.at)); const next = event.key === "ArrowLeft" ? Math.max(0, current - 1) : Math.min(present.length - 1, current + 1); crosshair.setAt(present[next].at); }}>
      <defs>{series.map((item) => <linearGradient id={`${id}-${item.key}`} key={item.key} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={item.color} stopOpacity=".23"/><stop offset="1" stopColor={item.color} stopOpacity="0"/></linearGradient>)}</defs>
      {[0, .25, .5, .75, 1].map((ratio) => { const value = yMin + (roundedMax - yMin) * (1 - ratio); const position = plotTop + (plotBottom - plotTop) * ratio; return <g key={ratio}><line x1={plotLeft} x2={plotRight} y1={position} y2={position} className="gridline"/><text x={plotLeft - 10} y={position + 4} textAnchor="end">{value.toFixed(value < 10 ? 1 : 0)}</text></g>; })}
      {threshold !== undefined && <g><line x1={plotLeft} x2={plotRight} y1={y(threshold)} y2={y(threshold)} className="threshold"/><text x={plotRight - 4} y={y(threshold) - 7} textAnchor="end">{threshold} ms budget</text></g>}
      {series.filter(({ key }) => !hidden.has(key)).map((item) => { const path = linePath(samples, item.key, x, y); const area = path ? `${path}L${x(maxAt)},${plotBottom}L${x(minAt)},${plotBottom}Z` : ""; return <g key={item.key}>{area && <path d={area} fill={`url(#${id}-${item.key})`} className="chart-area"/>}<path d={path} fill="none" stroke={item.color} className="chart-line"/></g>; })}
      <text x={plotLeft} y={height - 8}>{present.length ? new Date(minAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : "Waiting"}</text><text x={plotRight} y={height - 8} textAnchor="end">{present.length ? new Date(maxAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : "for data"}</text>
      {nearest && <g><line x1={x(nearest.at)} x2={x(nearest.at)} y1={plotTop} y2={plotBottom} className="crosshair"/><circle cx={x(nearest.at)} cy={plotTop} r="4" className="crosshair-dot"/></g>}
    </svg>
    {nearest && <div className="chart-tooltip"><strong>{new Date(nearest.at).toLocaleTimeString()}</strong>{series.map((item) => <span key={item.key}><i style={{background:item.color}} />{item.label}<b>{typeof nearest[item.key] === "number" ? `${Number(nearest[item.key]).toFixed(1)} ${item.unit}` : "unknown"}</b></span>)}</div>}
    <p className="sr-only">{summary}</p>
    {table && <div id={`${id}-table`} className="table-region" tabIndex={0} aria-label={`${title} sample table`}><table><thead><tr><th>Captured</th>{series.map((item) => <th key={item.key}>{item.label} ({item.unit})</th>)}</tr></thead><tbody>{present.slice(-50).map((sample) => <tr key={sample.at}><td>{new Date(sample.at).toLocaleTimeString()}</td>{series.map((item) => <td key={item.key}>{typeof sample[item.key] === "number" ? Number(sample[item.key]).toFixed(2) : "Unknown"}</td>)}</tr>)}</tbody></table></div>}
    <footer className="chart-provenance"><span>{source}</span><span>{present.length} samples</span><span>{present.length ? `${Math.round((maxAt - minAt) / 60000)} min observed` : "No observed window"}</span></footer>
  </div>;
}

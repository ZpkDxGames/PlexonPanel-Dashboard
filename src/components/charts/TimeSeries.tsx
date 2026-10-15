import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { Sample } from "../../adapter/control-state";
import { chartMaximum, chartPaths, chartTimeAt, finite, type MetricKey } from "./geometry";

type Series = { key: MetricKey; label: string; color: string; unit: string };
const Crosshair = createContext<{ at: number | null; setAt: (at: number | null) => void }>({ at: null, setAt: () => {} });

export function CrosshairGroup({ children }: { children: ReactNode }) {
  const [at, setAt] = useState<number | null>(null);
  const value = useMemo(() => ({ at, setAt }), [at]);
  return <Crosshair.Provider value={value}>{children}</Crosshair.Provider>;
}

export function TimeSeries({ samples, series, yMin = 0, yMax, threshold, title, source = "Paper", height = 240 }: { samples: Sample[]; series: Series[]; yMin?: number; yMax?: number; threshold?: number; title: string; source?: string; height?: number }) {
  const [table, setTable] = useState(false);
  const [hidden, setHidden] = useState<Set<MetricKey>>(new Set());
  const [width, setWidth] = useState(600);
  const svgRef = useRef<SVGSVGElement>(null);
  const id = useId().replaceAll(":", "");
  const crosshair = useContext(Crosshair);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const plotTop = 22, plotBottom = height - 32, plotLeft = 46, plotRight = width - 12;
  const present = useMemo(() => samples.filter((sample) => series.some(({ key }) => finite(sample[key]))), [samples, series]);
  const minAt = samples[0]?.at ?? 0, maxAt = samples.at(-1)?.at ?? minAt + 1;
  const observed = present.flatMap((sample) => series.map(({ key }) => sample[key]).filter(finite));
  const maximum = chartMaximum(observed, yMax, threshold, yMin);
  const byteAxis = series.every((item) => item.unit === "bytes");
  const divisor = byteAxis ? (maximum >= 2 ** 30 ? 2 ** 30 : maximum >= 2 ** 20 ? 2 ** 20 : maximum >= 1024 ? 1024 : 1) : 1;
  const axisUnit = byteAxis ? (divisor === 2 ** 30 ? "GiB" : divisor === 2 ** 20 ? "MiB" : divisor === 1024 ? "KiB" : "B") : series[0]?.unit ?? "";
  const format = (value: number, digits = 1) => (value / divisor).toLocaleString(undefined, { maximumFractionDigits: digits });
  const x = (at: number) => plotLeft + ((at - minAt) / Math.max(1, maxAt - minAt)) * (plotRight - plotLeft);
  const y = (value: number) => plotBottom - ((value - yMin) / Math.max(1, maximum - yMin)) * (plotBottom - plotTop);
  const nearest = crosshair.at === null || !present.length ? null : present.reduce((best, sample) => Math.abs(sample.at - crosshair.at!) < Math.abs(best.at - crosshair.at!) ? sample : best);
  const visible = series.filter(({ key }) => !hidden.has(key));
  const summary = present.length ? `${title}: ${present.length} observed samples. Values in ${axisUnit}. Missing readings and gaps over ten seconds are not connected. Use left and right arrows to inspect samples.` : `${title}: waiting for samples.`;
  const move = (clientX: number, rect: DOMRect) => {
    if (!present.length) return;
    crosshair.setAt(chartTimeAt(clientX, rect.left, rect.width, width, plotLeft, plotRight, minAt, maxAt));
  };
  return <div className="chart-block">
    <div className="chart-legend">{series.map((item) => <button key={item.key} aria-pressed={!hidden.has(item.key)} aria-label={`Show ${item.label}`} onClick={() => setHidden((current) => { const next = new Set(current); next.has(item.key) ? next.delete(item.key) : next.add(item.key); return next; })} className={hidden.has(item.key) ? "muted" : ""}><i style={{ background: item.color }} />{item.label}<span className="legend-unit">{byteAxis ? axisUnit : item.unit}</span></button>)}<button className="table-toggle" aria-expanded={table} aria-controls={`${id}-table`} onClick={() => setTable((value) => !value)}>{table ? "Hide data" : "View data"}</button></div>
    <div className="chart-plot">
      <svg ref={svgRef} className="time-series" role="img" aria-label={summary} viewBox={`0 0 ${width} ${height}`} style={{ height }} tabIndex={0} onPointerMove={(event) => move(event.clientX, event.currentTarget.getBoundingClientRect())} onPointerLeave={() => crosshair.setAt(null)} onBlur={() => crosshair.setAt(null)} onKeyDown={(event) => { if (event.key === "Escape") crosshair.setAt(null); if (!present.length || !["ArrowLeft", "ArrowRight"].includes(event.key)) return; event.preventDefault(); const current = present.findIndex((sample) => sample.at === nearest?.at); const next = current < 0 ? (event.key === "ArrowLeft" ? present.length - 1 : 0) : event.key === "ArrowLeft" ? Math.max(0, current - 1) : Math.min(present.length - 1, current + 1); crosshair.setAt(present[next].at); }}>
        <defs>{series.map((item) => <linearGradient id={`${id}-${item.key}`} key={item.key} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={item.color} stopOpacity=".16" /><stop offset="1" stopColor={item.color} stopOpacity="0" /></linearGradient>)}</defs>
        {[0, .25, .5, .75, 1].map((ratio) => { const value = yMin + (maximum - yMin) * (1 - ratio); const position = plotTop + (plotBottom - plotTop) * ratio; return <g key={ratio}><line x1={plotLeft} x2={plotRight} y1={position} y2={position} className="gridline" /><text x={plotLeft - 10} y={position + 4} textAnchor="end">{format(value)}</text></g>; })}
        {threshold !== undefined && <g><line x1={plotLeft} x2={plotRight} y1={y(threshold)} y2={y(threshold)} className="threshold" /><text x={plotRight - 4} y={y(threshold) - 7} textAnchor="end">{threshold} {axisUnit} budget</text></g>}
        {visible.map((item) => <g key={item.key}>{chartPaths(samples, item.key, x, y, plotBottom).map((path, index) => <g key={index}><path d={path.area} fill={`url(#${id}-${item.key})`} className="chart-area" /><path d={path.line} fill="none" stroke={item.color} className="chart-line" />{path.point && <circle cx={path.point.x} cy={path.point.y} r="3" fill={item.color} />}</g>)}</g>)}
        <text x={plotLeft} y={height - 6}>{present.length ? new Date(minAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</text><text x={plotRight} y={height - 6} textAnchor="end">{present.length ? new Date(maxAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</text>
        {nearest && <g><line x1={x(nearest.at)} x2={x(nearest.at)} y1={plotTop} y2={plotBottom} className="crosshair" />{visible.map((item) => finite(nearest[item.key]) ? <circle key={item.key} cx={x(nearest.at)} cy={y(nearest[item.key] as number)} r="4" fill={item.color} stroke="var(--surface)" strokeWidth="2" /> : null)}</g>}
      </svg>
      {(!present.length || !visible.length) && <div className="chart-empty"><strong>{!present.length ? "Waiting for telemetry" : "All series hidden"}</strong><span>{!present.length ? "Readings will appear when this source reports data." : "Select a legend above to show readings."}</span></div>}
      {nearest && !!visible.length && <div className="chart-tooltip" role="status"><strong>{new Date(nearest.at).toLocaleTimeString()}</strong>{visible.map((item) => <span key={item.key}><i style={{ background: item.color }} />{item.label}<b>{finite(nearest[item.key]) ? `${format(nearest[item.key] as number, 2)} ${byteAxis ? axisUnit : item.unit}` : "unknown"}</b></span>)}</div>}
    </div>
    <div id={`${id}-table`} hidden={!table}>{table && <div className="table-region" tabIndex={0} role="region" aria-label={`${title} sample table`}><table><caption className="sr-only">Last 50 observed samples</caption><thead><tr><th>Captured</th>{series.map((item) => <th key={item.key}>{item.label} ({byteAxis ? axisUnit : item.unit})</th>)}</tr></thead><tbody>{present.slice(-50).map((sample) => <tr key={sample.at}><td>{new Date(sample.at).toLocaleTimeString()}</td>{series.map((item) => <td key={item.key}>{finite(sample[item.key]) ? format(sample[item.key] as number, 2) : "Unknown"}</td>)}</tr>)}</tbody></table></div>}</div>
    <footer className="chart-provenance"><span>{source}</span><span>{present.length} samples</span><span>{present.length ? `${Math.round((maxAt - minAt) / 60000)} min observed` : "No observed window"}</span></footer>
  </div>;
}

'use client';
import './tick-pulse.css';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { buildTickPulseModel, tpsCategory, type TickCapture, type TpsCategory } from '../../lib/tick-pulse-model';
import { nearestCapture, tickObservations } from '../../lib/tick-pulse-observations';
import { visibleHistory } from '../../lib/visible-history';
import type { Sample } from '../../lib/control-state';
import { classifyTelemetry, capturedAtMillis } from '../../lib/telemetry-freshness';
import { useTelemetryNow } from '../../lib/telemetry-clock';
import { useUiPreferences } from '../../components/ui-preferences-provider';
import { Button, Dialog, EmptyState, Select } from '../ui/primitives';
const stamp = (at: number) => new Date(at).toISOString();
const value = (n: number | null, unit: string) => n === null ? 'Not supplied' : `${n} ${unit}`;
const names: Record<TpsCategory, string> = { healthy: 'Healthy', degraded: 'Degraded', critical: 'Critical', unknown: 'Unknown' };
const shapes: Record<TpsCategory, string> = { healthy: '●', degraded: '▲', critical: '×', unknown: '○' };
function CaptureFacts({ capture, now }: {
    capture: TickCapture;
    now: number;
}) { return <dl className="pulse-facts"><div><dt>Captured</dt><dd><time dateTime={stamp(capture.capturedAt)}>{stamp(capture.capturedAt)}</time></dd></div><div><dt>TPS</dt><dd>{shapes[tpsCategory(capture.tps)]} {names[tpsCategory(capture.tps)]} — {value(capture.tps, 'ticks/s')}</dd></div><div><dt>MSPT</dt><dd>{value(capture.mspt, 'ms')}</dd></div><div><dt>Source</dt><dd>Paper health</dd></div><div><dt>Capture age</dt><dd>{capture.capturedAt > now ? `${((capture.capturedAt - now) / 1000).toFixed(1)} s ahead of this browser` : `${((now - capture.capturedAt) / 1000).toFixed(1)} s`}</dd></div><div><dt>Received per capture</dt><dd>Not supplied</dd></div></dl>; }
/** Same renderer for header and Overview; no transport, persistence or synthetic history. */
export function TickPulse({ history, receivedAt, capturedAt, connected=true, intervalMs = 2000, windowEndAt, compact = false, status = 'live', accessibleLabel }: {
    history: Sample[];
    receivedAt: number;
    capturedAt?:unknown;
    connected?:boolean;
    intervalMs?: number;
    windowEndAt?: number;
    compact?: boolean;
    status?: string;
    accessibleLabel?: string;
}) {
    const { preferences, resolved, updatePreference } = useUiPreferences();
    const minutes = preferences.chartWindowMinutes;
    const span = minutes * 60000;
    const now = useTelemetryNow(receivedAt);
    const id = useId();
    const [initialEnd] = useState(() => Date.now());
    const latestSample=history.at(-1);
    const sourceAt=capturedAt!==undefined?capturedAtMillis(capturedAt):latestSample?.sources?.paperHealth;
    const freshness=classifyTelemetry({capturedAt:typeof sourceAt==='number'?new Date(sourceAt).toISOString():undefined,receivedAt,connected:connected&&!/disconnected/i.test(status),now});
    const freshnessLabel=freshness.label;
    const sourceKey=JSON.stringify([sourceAt,latestSample?.tps,latestSample?.mspt]);
    // The raster window advances with captures, not with the shared one-second age clock.
    const latestKey=sourceKey;
    const [frame, setFrame] = useState({ signature:latestKey, end: Math.max(initialEnd,sourceAt??0) });
    if (frame.signature !== latestKey)
        setFrame({ signature:latestKey, end: Math.max(initialEnd, now,sourceAt??0) });
    const end = Math.max(windowEndAt ?? frame.end,sourceAt??0);
    const normalizationKey=`${sourceKey}:${end}:${minutes}`;
    const snapshot=()=>({key:normalizationKey,captures:tickObservations(visibleHistory(history,Math.max(0,end-span),end))});
    const [normalized,setNormalized]=useState(snapshot);
    const nextNormalized=normalized.key!==normalizationKey?snapshot():normalized;
    if(nextNormalized!==normalized)setNormalized(nextNormalized);
    const captures=nextNormalized.captures;
    const [width, setWidth] = useState(300);
    const [selected, setSelected] = useState<number | null>(null);
    const [lens, setLens] = useState(false);
    const [page, setPage] = useState(0);
    const [hover, setHover] = useState(false);
    const canvas = useRef<HTMLCanvasElement>(null);
    const wrap = useRef<HTMLDivElement>(null);
    const model = useMemo(() => buildTickPulseModel({ captures, windowStartAt: Math.max(0, end - span), windowEndAt: end, plotWidthPx: Math.max(1, width - 2), gapToleranceMs: Math.max(1000, intervalMs * 3) }), [captures, end, width, span, intervalMs]);
    // Inspection follows current retention, even when Host traffic alone prunes it.
    const exact = useMemo(() => (lens||hover?tickObservations(history):captures).filter(c => c.capturedAt <= end), [history,captures,end,lens,hover]);
    const index = selected === null ? exact.length - 1 : nearestCapture(exact, selected);
    const capture = exact[index];
    useEffect(() => { const element = wrap.current; if (!element)
        return; if (typeof ResizeObserver === 'undefined')
        return; const observer = new ResizeObserver(entries => setWidth(Math.max(1, Math.floor(entries[0].contentRect.width)))); observer.observe(element); return () => observer.disconnect(); }, []);
    useEffect(() => {
        const element = canvas.current, ctx = element?.getContext('2d');
        if (!element || !ctx)
            return;
        const start = performance.now();
        const height = compact ? 34 : 124;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        element.width = Math.ceil(width * dpr);
        element.height = height * dpr;
        ctx.scale(dpr, dpr);
        const style = getComputedStyle(element);
        const color = (key: string) => style.getPropertyValue('--ds-' + key).trim();
        ctx.fillStyle = color('sunken');
        ctx.fillRect(0, 0, width, height);
        const bottom = height - 8, top = 8;
        const y = (ms: number) => bottom - Math.min(100, ms) / 100 * (bottom - top);
        // One hatch operation per plot pixel; no path grows with the retained capture count.
        ctx.strokeStyle = color('boundary');
        ctx.lineWidth = 1;
        model.timeColumns.forEach((column, index) => {
            const x = index + 1;
            if (!column.gapDurationMs && !column.unknownDurationMs) return;
            ctx.fillStyle = color('boundary');
            if (index % 8 < 2) ctx.fillRect(x, 0, 1, height);
            if (column.gapDurationMs) for (let y = 0; y < height; y += 8) ctx.fillRect(x, y, 1, 1);
        });
        ctx.strokeStyle = color('muted');
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(0, y(50));
        ctx.lineTo(width, y(50));
        ctx.stroke();
        ctx.setLineDash([]);
        const mark = (x: number, category: TpsCategory, min: number | null, max: number | null, unknown: boolean) => {
            ctx.strokeStyle = color(({ healthy: 'ok', degraded: 'warn', critical: 'critical', unknown: 'unknown' } as const)[category]);
            ctx.fillStyle = ctx.strokeStyle;
            ctx.beginPath();
            if (min !== null && max !== null) {
                ctx.moveTo(x, y(min));
                ctx.lineTo(x, y(max));
                ctx.moveTo(x - 1, y(min));
                ctx.lineTo(x + 1, y(min));
                ctx.moveTo(x - 1, y(max));
                ctx.lineTo(x + 1, y(max));
                ctx.stroke();
            }
            if (unknown || max === null) {
                ctx.strokeRect(x - 1, Math.max(top, height / 2 - 2), 2, 4);
            }
            const sy = top + 2;
            ctx.beginPath();
            if (category === 'healthy') {
                ctx.arc(x, sy, 1.2, 0, Math.PI * 2);
                ctx.fill();
            }
            else if (category === 'degraded') {
                ctx.moveTo(x, sy - 2);
                ctx.lineTo(x - 2, sy + 2);
                ctx.lineTo(x + 2, sy + 2);
                ctx.closePath();
                ctx.stroke();
            }
            else if (category === 'critical') {
                ctx.moveTo(x - 2, sy - 2);
                ctx.lineTo(x + 2, sy + 2);
                ctx.moveTo(x + 2, sy - 2);
                ctx.lineTo(x - 2, sy + 2);
                ctx.stroke();
            }
            else {
                ctx.arc(x, sy, 1.5, 0, Math.PI * 2);
                ctx.stroke();
            }
            if (max !== null && max > 100) {
                ctx.fillRect(x - 1, top + 7, 2, 2);
            }
        };
        if (model.mode === 'raw')
            model.captures.forEach(c => mark(1 + (c.capturedAt - model.windowStartAt) / span * model.plotWidthPx, tpsCategory(c.tps), c.mspt, c.mspt, c.tps === null || c.mspt === null));
        else
            model.buckets.forEach(b => mark(1 + (b.index + .5) / model.summaryBucketCount * model.plotWidthPx, b.worstTpsCategory, b.msptMin, b.msptMax, Boolean(b.unknownTpsCount || b.unknownMsptCount)));
        // Keep diagnostic timing metadata bounded during long-lived sessions.
        if(performance.getEntriesByName('ui6-pulse-raster').length>=200)performance.clearMeasures('ui6-pulse-raster');
        performance.measure('ui6-pulse-raster', { start, end: performance.now(), detail: { width, height, mode: model.mode, captures: model.captures.length, compact } });
    }, [model, width, compact, resolved.theme, resolved.contrast, span]);
    const inspect = (next: number) => { const bounded=Math.max(0,Math.min(exact.length-1,next)); setSelected(exact[bounded]?.capturedAt??null); setPage(Math.floor(bounded/100)); };
    const open = () => { if(capture)setSelected(capture.capturedAt); setPage(Math.floor(Math.max(0, index) / 100)); setLens(true); };
    const range = `${stamp(model.windowStartAt)} to ${stamp(model.windowEndAt)}`;
    return <section className={`tick-pulse${compact ? ' tick-pulse-compact' : ''}`} aria-label={accessibleLabel ?? (compact ? 'Compact Tick Pulse' : 'Tick Pulse')} data-pulse-mode={model.mode} data-pulse-captures={model.captures.length} data-pulse-received-at={receivedAt}>
  <p className={compact&&freshness.skewAheadMs<=5000?"pp-sr-only":"pp-muted pulse-freshness"}>{freshnessLabel}</p>
  <div className="pulse-heading">{compact ? <strong>Pulse</strong> : <h2>Tick Pulse</h2>}<span className="pulse-mode">{model.mode === 'summarized' ? 'Summarized' : 'Raw'} <span><b className="pulse-count">{model.captures.length}</b> captures / {minutes} min</span></span>{!compact && <div className="pulse-actions"><Select label="Pulse window" value={String(minutes)} options={[1, 5, 15, 30].map(n => ({ value: String(n), label: `${n} min` }))} onChange={v => updatePreference('chartWindowMinutes', Number(v) as 1 | 5 | 15 | 30)}/><Button variant="quiet" onClick={open} disabled={!capture}>Inspect captures</Button></div>}</div>
  <div ref={wrap} className="pulse-plot" onPointerLeave={() => setHover(false)}><button type="button" className="pulse-inspect" aria-label={compact ? 'Inspect compact Tick Pulse' : 'Inspect Tick Pulse'} aria-describedby={`${id}-help${!compact && hover && capture ? ` ${id}-capture` : ''}`} disabled={!capture} onClick={open} onFocus={() => setHover(true)} onBlur={() => setHover(false)} onPointerMove={event => { const rect = event.currentTarget.getBoundingClientRect(); inspect(nearestCapture(exact, model.windowStartAt + (event.clientX - rect.left) / rect.width * span)); setHover(true); }} onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        inspect(event.key === 'Home' ? 0 : event.key === 'End' ? exact.length - 1 : index + (event.key === 'ArrowLeft' ? -1 : 1));
        setHover(true);
    } }}><canvas ref={canvas} aria-hidden="true" style={{ height: compact ? 34 : 124 }}/><span className="pp-sr-only">MSPT marks; 50 ms tick budget. {range}. {freshnessLabel}. Missing time is hatched. Enter opens the exact capture lens.</span></button>
   {hover && capture && capture.capturedAt>=model.windowStartAt && <span className="pulse-cursor" aria-hidden="true" style={{left:`${(capture.capturedAt-model.windowStartAt)/span*100}%`}}/>}
   {!compact && hover && capture && <div id={`${id}-capture`} className="pulse-tooltip" role="tooltip"><CaptureFacts capture={capture} now={now}/></div>}
  </div>
  {!compact && <><div className="pulse-scale"><time dateTime={stamp(model.windowStartAt)}>{new Date(model.windowStartAt).toLocaleTimeString()}</time><span>0–100 ms / 50 ms budget</span><time dateTime={stamp(model.windowEndAt)}>{new Date(model.windowEndAt).toLocaleTimeString()}</time></div><p className="pulse-legend">● Healthy ≥19 TPS <span>▲ Degraded ≥15</span> <span>× Critical &lt;15</span> <span>○ Unknown</span> <span>Crosshatch: gap / vertical hatch: unknown time</span></p><p id={`${id}-help`} className="pp-muted pulse-help">{model.mode === 'summarized' ? 'Summarized marks show capture count, worst known TPS category and MSPT min/max. Unknown values stay unknown.' : 'Each mark is one capture; unknown MSPT is outlined. A filled mark at the ceiling means MSPT exceeds 100 ms; inspect its exact value.'} Arrow keys inspect exact captures; Enter opens the lens. Window ends at {new Date(end).toLocaleTimeString()}; {freshnessLabel}. Last browser receipt {receivedAt ? new Date(receivedAt).toLocaleTimeString() : 'not supplied'}.</p>{!capture && <EmptyState title="No trusted tick captures">Waiting for signed Paper health. Empty time is unknown, not zero.</EmptyState>}</>}
  {compact && <span id={`${id}-help`} className="pp-sr-only">{minutes}-minute window {range}. Arrow keys select a capture; Enter opens the exact lens.</span>}
  <Dialog className="pulse-lens" open={lens} onClose={() => setLens(false)} title="Exact tick capture" description="Every retained capture is available. Table and lens use the same source values; no interpolation.">
   {lens && <div role="group" tabIndex={-1} aria-label="Capture inspection" onKeyDown={event => { if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) { event.preventDefault(); inspect(event.key==='Home'?0:event.key==='End'?exact.length-1:index+(event.key==='ArrowLeft'?-1:1)); } }}>
   {capture && <><CaptureFacts capture={capture} now={now}/><div className="pulse-lens-controls"><Button disabled={index <= 0} onClick={() => inspect(index - 1)}>Previous capture</Button><span>{index + 1} / {exact.length}</span><Button disabled={index >= exact.length - 1} onClick={() => inspect(index + 1)}>Next capture</Button></div><div className="pulse-lens-strip" role="group" aria-label="Exact capture lens, equally spaced by capture, not elapsed time">{exact.slice(Math.max(0, index - 5), index + 6).map(c => <button key={c.capturedAt} type="button" aria-pressed={c.capturedAt === capture.capturedAt} onClick={() => inspect(exact.indexOf(c))}>{shapes[tpsCategory(c.tps)]}<span>{value(c.mspt, 'ms')}</span></button>)}</div></>}
   <p>Paper health; timestamps are capture time in UTC. Per-capture receipt is not supplied. Hatched unknown time and true gaps are never filled. Summary span: {range}.</p>
   {model.mode === 'summarized' && capture && (() => { const b = model.buckets.find(b => capture.capturedAt >= b.startAt && (capture.capturedAt < b.endAt || b.index === model.summaryBucketCount - 1)); return b ? <p className="pulse-bucket">Summary bucket {stamp(b.startAt)}–{stamp(b.endAt)}: {b.captureCount} captures; worst known TPS {names[b.worstTpsCategory]}; MSPT {value(b.msptMin, 'ms')} to {value(b.msptMax, 'ms')}; {b.unknownTpsCount} unknown TPS / {b.unknownMsptCount} unknown MSPT.</p> : null; })()}
   <div className="pulse-table"><table><caption>Retained exact captures — page {page + 1} of {Math.max(1, Math.ceil(exact.length / 100))}</caption><thead><tr><th scope="col">Captured UTC</th><th scope="col">TPS</th><th scope="col">MSPT</th><th scope="col">Category</th></tr></thead><tbody>{exact.slice(page * 100, (page + 1) * 100).map(c => <tr key={c.capturedAt}><td><button type="button" aria-current={c.capturedAt===capture?.capturedAt?"true":undefined} onClick={() => inspect(exact.indexOf(c))}>{stamp(c.capturedAt)}</button></td><td>{value(c.tps, 'ticks/s')}</td><td>{value(c.mspt, 'ms')}</td><td>{shapes[tpsCategory(c.tps)]} {names[tpsCategory(c.tps)]}</td></tr>)}</tbody></table></div><div className="pulse-lens-controls"><Button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous page</Button><Button disabled={(page + 1) * 100 >= exact.length} onClick={() => setPage(p => p + 1)}>Next page</Button></div>
   </div>}
  </Dialog>
 </section>;
}

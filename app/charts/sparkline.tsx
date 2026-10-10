'use client';
import './sparkline.css';
import { memo, useMemo, useState } from 'react';
import { visibleHistory } from '../../lib/visible-history';
import type { Sample } from '../../lib/control-state';
import { METRICS, metricSeries, type MetricField } from '../../lib/metric-reports';
import { buildSvgPaths, gapSegments, resolveDomain, thinSegment } from '../../lib/chart-geometry';
export const Sparkline = memo(function Sparkline({ history, field, now, sourceCapturedAt, intervalMs = METRICS[field].intervalMs }: {
    history: Sample[];
    field: MetricField;
    now: number;
    intervalMs?: number;
    sourceCapturedAt?:unknown;
}) {
    const latest=history.at(-1);
    const sourceAt=typeof sourceCapturedAt==='string'?sourceCapturedAt:latest?.sources?latest.sources[METRICS[field].source]:latest?.at;
    const key=JSON.stringify([field,sourceAt,latest?.[field]]);
    const snapshot=()=>({key,end:now,history:visibleHistory(history,now-300000,now+5000)});
    const [frame,setFrame]=useState(snapshot);
    if(frame.key!==key)setFrame(snapshot());
    const plot = useMemo(() => { const points = metricSeries(frame.history, field, 5, frame.end); const values = points.flatMap(p => p.value === null ? [] : [p.value]); const [low, high] = resolveDomain(values, { fixed: field === 'tps' ? [0, 20] : undefined }); return { legacy:points.some(p=>p.provenance==='legacy packet timestamp'), count: values.length, paths: buildSvgPaths(gapSegments(points, Math.max(1000, intervalMs * 3)).map(s => thinSegment(s, 160)), at => (at - (frame.end - 300000)) / 300000 * 200, value => 40 - (value - low) / (high - low) * 34, 40) }; }, [frame, field, intervalMs]);
    return <><svg className="instrument-sparkline" viewBox="0 0 200 44" preserveAspectRatio="none" role="img" aria-label={`${METRICS[field].label}: five-minute browser-observed history ending ${new Date(frame.end).toISOString()}, ${plot.count} ${plot.legacy?'values including unverified legacy packet times':'source values'}; gaps stay empty.`}><path d={plot.paths.line}/></svg>{plot.legacy&&<small className="instrument-history-note">Legacy history: capture times unavailable</small>}</>;
}, (previous,next) => previous.field === next.field && previous.intervalMs === next.intervalMs && previous.sourceCapturedAt === next.sourceCapturedAt && previous.history.at(-1)?.[previous.field] === next.history.at(-1)?.[next.field] && (previous.history.at(-1)?.sources?.[METRICS[previous.field].source] ?? previous.history.at(-1)?.at) === (next.history.at(-1)?.sources?.[METRICS[next.field].source] ?? next.history.at(-1)?.at));

"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { bytes } from "./control-views";
import { Badge, Empty, Panel } from "./ui/workspace";
import { Disclosure } from "./ui/primitives";
import { visibleHistory } from "../lib/visible-history";
import type { Sample } from "../lib/control-state";
import { displayRateLabel } from "../lib/display-cadence";
import { buildSvgPaths, gapSegments, nearestValueIndex, resolveDomain, thinSegment, type TimedValue } from "../lib/chart-geometry";
import { METRICS, metricSeries, metricReport, type MetricField } from "../lib/metric-reports";
import { classifyTelemetry } from "../lib/telemetry-freshness";
import { useTelemetryNow } from "../lib/telemetry-clock";
import { useUiPreferences } from "../components/ui-preferences-provider";
type HistoryField = MetricField;
type ChartSource = "paper-health" | "paper-system" | "host-system" | "host-service";
export type ChartSpec = {
  field: HistoryField;
  label: string;
  shortLabel: string;
  format: (value: number) => string;
  source: ChartSource;
  domain?: [number, number];
  percentage?: boolean;
  reference?: { value: number; label: string };
  series: 1 | 2 | 3 | 4 | 5 | 6;
};

function displayTime(at: number, zone: "local" | "utc") {
  return new Date(at).toLocaleTimeString(undefined, zone === "utc" ? { timeZone: "UTC" } : undefined) + (zone === "utc" ? " UTC" : "");
}
function sampleFreshnessText(at: number, tailAt: number) {
  const age = Math.max(0, tailAt - at);
  if (age < 1_000) return "latest sample";
  if (age < 60_000) return `${Math.floor(age / 1_000)}s before latest`;
  return `${Math.floor(age / 60_000)}m before latest`;
}

function sourceAgeText(age: number | null) {
  if (age === null) return "Sample age unavailable";
  if (age < 1_000) return `Last sample ${(age / 1000).toFixed(1)}s ago`;
  if (age < 60_000) return `Last sample ${(age / 1000).toFixed(age < 10_000 ? 1 : 0)}s ago`;
  return `Last sample ${Math.floor(age / 60_000)}m ago`;
}

function trendText(points: readonly TimedValue[]) {
  const values = points.map((point) => point.value).filter((value): value is number => value !== null);
  if (values.length < 2) return "not enough samples for a trend";
  const first = values[0];
  const last = values[values.length - 1];
  const delta = (last - first) / Math.max(1, Math.abs(first));
  if (Math.abs(delta) < 0.02) return "roughly flat";
  return delta > 0 ? "rising" : "falling";
}

export function TelemetryChart({
  history,
  spec,
  windowMinutes,
  status,
  capacity,
  sourceLabel,
  sourceIntervalMs,
  sourceCapturedAt,
  receivedAt, inspectionAt, onInspect,
}: {
  history: Sample[];
  spec: ChartSpec;
  windowMinutes: number;
  status: "live" | "paused" | "disconnected" | "stale";
  capacity?: number | null;
  sourceLabel: string;
  sourceIntervalMs: number | null;
  sourceCapturedAt: number | null;
  receivedAt?: number;
  inspectionAt?: number|null;
  onInspect?: (at:number|null)=>void;
}) {
  const { preferences } = useUiPreferences();
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [inspectIndex, setInspectIndex] = useState<number | null>(null);
  const [documentVisible, setDocumentVisible] = useState(true);
  const [inViewport, setInViewport] = useState(true);
  const [chartWidth, setChartWidth] = useState(720);
  const ageNow=useTelemetryNow(receivedAt??0);
  const freshness=classifyTelemetry({capturedAt:sourceCapturedAt===null?undefined:new Date(sourceCapturedAt).toISOString(),receivedAt,connected:status!=="disconnected",now:ageNow});
  const skew=freshness.skewAheadMs>5000;
  const now=Math.max(ageNow,sourceCapturedAt??0);
  const series = useMemo(() => metricSeries(visibleHistory(history, now-windowMinutes*60000, now), spec.field, windowMinutes, now), [history, spec.field, windowMinutes, now]);
  const points = series;
  const legacyCount = series.filter(point => point.provenance === "legacy packet timestamp" && point.value !== null).length;
  const values = series.map((point) => point.value).filter((value): value is number => value !== null);
  const stats = metricReport(series, windowMinutes, now, sourceIntervalMs ?? METRICS[spec.field].intervalMs);
  const hasData = stats.count > 0;
  const [lower, upper] = resolveDomain(values, { fixed: spec.domain, percentage: spec.percentage, capacity, reference: spec.reference?.value });
  const end = now;
  const start = end - windowMinutes * 60_000;
  const plotRight = chartWidth - 20;
  const plotWidth = plotRight - 62;
  const xFor = (at: number) => 62 + ((at - start) / Math.max(1, end - start)) * plotWidth;
  const yFor = (value: number) => 178 - ((value - lower) / Math.max(0.001, upper - lower)) * 142;
  const renderSegments = useMemo(
    () => gapSegments(series, Math.max(1000, (sourceIntervalMs ?? METRICS[spec.field].intervalMs) * 3)).map((segment) => thinSegment(segment, 800)),
    [series, sourceIntervalMs, spec.field],
  );
  const paths = buildSvgPaths(renderSegments, xFor, yFor, 178);
  const sharedIndex=inspectionAt==null?null:nearestValueIndex(points,inspectionAt);
  const effectiveIndex=onInspect?sharedIndex:inspectIndex;
  const inspected = effectiveIndex === null ? null : points[effectiveIndex] && (inspectionAt==null || Math.abs(points[effectiveIndex].at-inspectionAt)<=Math.max(1000,(sourceIntervalMs??METRICS[spec.field].intervalMs)*3))?points[effectiveIndex]:null;
  const inspect=(index:number|null)=>{setInspectIndex(index);onInspect?.(index===null?null:points[index]?.at??null);};
  const inspectedValue = inspected ? inspected.value : null;
  const ticks = [upper, lower + (upper - lower) / 2, lower];
  const descriptionId = `chart-description-${spec.field}`;
  const hatchId = `chart-gaps-${spec.field}`;
  const gapRanges:Array<[number,number]>=[];
  let cursor=start;
  for(const [index,segment] of renderSegments.entries()){const first=segment[0].at;if(first>cursor&&(index>0||points[0]?.value===null||first-cursor>Math.max(1000,(sourceIntervalMs??METRICS[spec.field].intervalMs)*3)))gapRanges.push([cursor,first]);cursor=segment.at(-1)!.at;}
  if(points.at(-1)?.value===null||end-cursor>Math.max(1000,(sourceIntervalMs??METRICS[spec.field].intervalMs)*3))gapRanges.push([cursor,end]);
  const liveTailActive = freshness.kind === "live" && documentVisible && inViewport && preferences.livePulse;
  const sourceCadence = sourceIntervalMs === null ? sourceLabel : `${sourceLabel} ~${sourceIntervalMs} ms`;

  useEffect(() => {
    const updateVisibility = () => setDocumentVisible(!document.hidden);
    document.addEventListener("visibilitychange", updateVisibility);
    queueMicrotask(updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const updateWidth = () => setChartWidth(Math.max(300, Math.min(720, element.clientWidth - 20)));
    queueMicrotask(updateWidth);
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateWidth);
    resize?.observe(element);
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => setInViewport(entries[0]?.isIntersecting ?? true), { rootMargin: "120px" });
    observer?.observe(element);
    return () => { resize?.disconnect(); observer?.disconnect(); };
  }, [hasData]);

  const moveInspection = (direction: -1 | 1) => {
    if (!series.length) return;
    let index = effectiveIndex ?? (direction < 0 ? series.length : -1);
    for (let count = 0; count < series.length; count += 1) {
      index += direction;
      if (index < 0 || index >= series.length) break;
      if (series[index].value !== null) {
        inspect(index);
        break;
      }
    }
  };

  const noDataTitle = !points.length
    ? status === "disconnected" ? "No samples while disconnected" : "Waiting for first sample"
    : "Metric unavailable in this telemetry window";

  return (
    <Panel
      title={spec.label}
      className="pp-chart"
      aside={
        <div className="display-chart-state">
          <span className="pp-sr-only" data-active={liveTailActive || undefined}>{freshness.kind}</span>
          <Badge tone={skew||status==="paused"?"amber":freshness.kind==="live"?"green":"quiet"}>{skew?`Clock skew +${Math.round(freshness.skewAheadMs/1000)} s${freshness.kind==="stale"?" / stale":freshness.kind==="delayed"?" / delayed":""}`:status==="paused"?"View paused":freshness.kind==="live"?"Live":freshness.kind==="delayed"?"Delayed":freshness.kind==="waiting"?"Waiting":freshness.kind==="stale"?"Stale":"Disconnected"}</Badge>
        </div>
      }
    >
      <div className="pp-chart-summary">
        <div><span>Last observed</span><strong>{stats.current === null ? "Unavailable" : spec.format(stats.current)}</strong></div>
        <dl>
          <div><dt>Min</dt><dd>{stats.minimum === null ? "—" : spec.format(stats.minimum)}</dd></div>
          <div><dt>Avg</dt><dd>{stats.average === null ? "—" : spec.format(stats.average)}</dd></div>
          <div><dt>Max</dt><dd>{stats.maximum === null ? "—" : spec.format(stats.maximum)}</dd></div>
          <div><dt>Sample p95</dt><dd>{stats.p95 === null ? "—" : spec.format(stats.p95)}</dd></div>
        </dl>
      </div>
      <div className="pp-chart-caption">
        <span>{sourceCadence} / Display {displayRateLabel(preferences.displayUpdateRateMs)}</span>
        <span>{skew?freshness.label:sourceAgeText(freshness.ageMs)}</span>
      </div>
      {stats.count ? (
        <div className="workspace-chart-stage" ref={viewportRef}>
          <p id={descriptionId} className="pp-sr-only">
            {spec.label} over the last {windowMinutes} minutes is {trendText(series)}. Latest value {stats.current === null ? "unavailable" : spec.format(stats.current)}. {stats.count} observed values{legacyCount ? `, including ${legacyCount} legacy packet-time cached observations` : " from independent source captures"}; missing samples are rendered as gaps. Focus the chart and use the left and right arrow keys to inspect samples.
          </p>
          <svg
            ref={svgRef}
            className={`workspace-chart display-series-${spec.series}`}
            viewBox={`0 0 ${chartWidth} 210`}
            role="img"
            tabIndex={0}
            aria-describedby={descriptionId}
            aria-label={`${spec.label}: last observed ${stats.current === null ? "unavailable" : spec.format(stats.current)}, minimum ${stats.minimum === null ? "unavailable" : spec.format(stats.minimum)}, average ${stats.average === null ? "unavailable" : spec.format(stats.average)}, maximum ${stats.maximum === null ? "unavailable" : spec.format(stats.maximum)}`}
            onFocus={() => { if (effectiveIndex === null) moveInspection(-1); }}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                moveInspection(event.key === "ArrowLeft" ? -1 : 1);
              }
              if (event.key === "Escape") inspect(null);
            }}
            onPointerLeave={() => inspect(null)}
            onPointerMove={(event) => {
              if (!series.length) return;
              const rect = svgRef.current?.getBoundingClientRect();
              if (!rect) return;
              const x = ((event.clientX - rect.left) / rect.width) * chartWidth;
              const ratioX = Math.max(0, Math.min(1, (x - 62) / plotWidth));
              const at = start + ratioX * (end - start);
              const index = nearestValueIndex(series, at);
              inspect(index !== null && Math.abs(series[index].at - at) <= Math.max(1000, (sourceIntervalMs ?? METRICS[spec.field].intervalMs) * 3) ? index : null);
            }}
          >
            <defs>
              <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 6L6 0" stroke="var(--ds-muted)" strokeWidth="1" opacity=".35"/></pattern>
            </defs>
            {gapRanges.map(([from,to])=><rect key={from} x={xFor(from)} width={Math.max(0,xFor(to)-xFor(from))} y="36" height="142" fill={`url(#${hatchId})`}/>)}
            {[36, 107, 178].map((y) => <line key={y} x1="62" x2={plotRight} y1={y} y2={y} className="workspace-gridline" />)}
            {ticks.map((tick, index) => (
              <text key={index} x="55" y={[40, 111, 182][index]} textAnchor="end" className="workspace-axis-label">
                {spec.field === "memory" || spec.field === "heap" || spec.field === "serviceMemory" ? bytes(tick) : tick.toFixed(tick >= 100 ? 0 : 1)}
              </text>
            ))}
            {spec.reference && spec.reference.value >= lower && spec.reference.value <= upper && (
              <>
                <rect x="62" width={plotWidth} y={Math.max(30, yFor(spec.reference.value) - 4)} height="8" className="display-reference-band" />
                <line x1="62" x2={plotRight} y1={yFor(spec.reference.value)} y2={yFor(spec.reference.value)} className="workspace-reference-line" />
                <text x={plotRight - 6} y={Math.max(15, yFor(spec.reference.value) - 7)} textAnchor="end" className="workspace-reference-label">{spec.reference.label}</text>
              </>
            )}
            {preferences.chartStyle === "area" && paths.area && <path d={paths.area} fill="var(--ds-accent)" className="display-chart-area" />}
            <path d={paths.line} className="workspace-trend" />
            {inspected && inspectedValue !== null && (
              <>
                <line x1={xFor(inspected.at)} x2={xFor(inspected.at)} y1="26" y2="178" className="workspace-crosshair" />
                <circle cx={xFor(inspected.at)} cy={yFor(inspectedValue)} r="4" className="workspace-sample-dot" />
              </>
            )}
            <text x="62" y="201" className="workspace-axis-label">{displayTime(start, preferences.timeZone)}</text>
            <text x={plotRight} y="201" textAnchor="end" className="workspace-axis-label">{displayTime(end, preferences.timeZone)}</text>
          </svg>
          {inspected && inspectedValue !== null && (
            <div className="workspace-chart-tooltip" title={`UTC: ${new Date(inspected.at).toISOString()}`}>
              <strong>{displayTime(inspected.at, preferences.timeZone)}</strong>
              <span>{spec.shortLabel}</span>
              <b>{spec.format(inspectedValue)}</b>
              <small>{sampleFreshnessText(inspected.at, end)}</small>
              <small>{METRICS[spec.field].origin} / {METRICS[spec.field].unit} / {inspected.provenance}</small>
            </div>
          )}
        </div>
      ) : (
        <Empty title={noDataTitle}>
          {points.length
            ? "This metric is unsupported or absent in the received samples. Other telemetry remains available."
            : status === "disconnected"
              ? "Reconnect the owning agent to resume authoritative telemetry. Existing browser-local samples remain bounded."
              : "Keep this browser open to build bounded browser-local history."}
        </Empty>
      )}
      <div className="pp-chart-caption"><span>Browser-local rolling history / {legacyCount ? "includes legacy packet timestamps" : "source timestamps"}</span><span>{stats.count} observed values / {stats.coverage.toFixed(0)}% observed coverage / {gapRanges.length} gaps</span></div>
      <Disclosure title="Source and timing"><p>{sourceLabel}. Captured at: {sourceCapturedAt===null?'not supplied':new Date(sourceCapturedAt).toISOString()}. Latest source packet received at: {receivedAt?new Date(receivedAt).toISOString():'not supplied'}. Sample times come from the source clock (Paper for Paper metrics). Individual historical received-at timestamps are not retained.</p></Disclosure>
      {legacyCount > 0 && <p className="pp-muted">{legacyCount} cached observations predate source-capture metadata. These use packet times and can repeat a source value; statistics include these observations until they age out of this window.</p>}
    </Panel>
  );
}

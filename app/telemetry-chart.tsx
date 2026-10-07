"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Empty, Panel, bytes } from "./control-views";
import type { Sample } from "../lib/control-state";
import { displayRateLabel } from "../lib/display-cadence";
import { buildSvgPaths, gapSegments, nearestValueIndex, resolveDomain, thinSegment, type TimedValue } from "../lib/chart-geometry";
import { METRICS, metricSeries, metricReport, type MetricField } from "../lib/metric-reports";
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

function sourceAgeText(capturedAt: number | null) {
  if (capturedAt === null) return "Sample age unavailable";
  const age = Math.max(0, Date.now() - capturedAt);
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
}: {
  history: Sample[];
  spec: ChartSpec;
  windowMinutes: number;
  status: "live" | "paused" | "disconnected" | "stale";
  capacity?: number | null;
  sourceLabel: string;
  sourceIntervalMs: number | null;
  sourceCapturedAt: number | null;
}) {
  const { preferences } = useUiPreferences();
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [inspectIndex, setInspectIndex] = useState<number | null>(null);
  const [documentVisible, setDocumentVisible] = useState(true);
  const [inViewport, setInViewport] = useState(true);
  const now = useTelemetryNow(history.at(-1)?.at ?? 0);
  const series = useMemo(() => metricSeries(history, spec.field, windowMinutes, now), [history, spec.field, windowMinutes, now]);
  const points = series;
  const legacyCount = series.filter(point => point.provenance === "legacy packet timestamp" && point.value !== null).length;
  const values = series.map((point) => point.value).filter((value): value is number => value !== null);
  const stats = metricReport(series, windowMinutes, now, sourceIntervalMs ?? METRICS[spec.field].intervalMs);
  const [lower, upper] = resolveDomain(values, { fixed: spec.domain, percentage: spec.percentage, capacity, reference: spec.reference?.value });
  const end = now;
  const start = end - windowMinutes * 60_000;
  const xFor = (at: number) => 62 + ((at - start) / Math.max(1, end - start)) * 638;
  const yFor = (value: number) => 178 - ((value - lower) / Math.max(0.001, upper - lower)) * 142;
  const renderSegments = useMemo(
    () => gapSegments(series, Math.max(1000, (sourceIntervalMs ?? METRICS[spec.field].intervalMs) * 3)).map((segment) => thinSegment(segment, 800)),
    [series, sourceIntervalMs, spec.field],
  );
  const paths = buildSvgPaths(renderSegments, xFor, yFor, 178);
  const inspected = inspectIndex === null ? null : points[inspectIndex] ?? null;
  const inspectedValue = inspected ? inspected.value : null;
  const ticks = [upper, lower + (upper - lower) / 2, lower];
  const descriptionId = `chart-description-${spec.field}`;
  const gradientId = `chart-gradient-${spec.field}`;
  const liveTailActive = status === "live" && documentVisible && inViewport && preferences.livePulse;
  const sourceCadence = sourceIntervalMs === null ? sourceLabel : `${sourceLabel} ~${sourceIntervalMs} ms`;

  useEffect(() => {
    const updateVisibility = () => setDocumentVisible(!document.hidden);
    document.addEventListener("visibilitychange", updateVisibility);
    queueMicrotask(updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    if (!viewportRef.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => setInViewport(entries[0]?.isIntersecting ?? true), { rootMargin: "120px" });
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);

  const moveInspection = (direction: -1 | 1) => {
    if (!series.length) return;
    let index = inspectIndex ?? (direction < 0 ? series.length : -1);
    for (let count = 0; count < series.length; count += 1) {
      index += direction;
      if (index < 0 || index >= series.length) break;
      if (series[index].value !== null) {
        setInspectIndex(index);
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
      className="workspace-chart-card"
      aside={
        <div className="display-chart-state">
          <span className="display-live-tail" data-active={liveTailActive || undefined}><i /> {status === "live" ? "Live tail" : status === "paused" ? "Paused" : status === "stale" ? "Stale" : "Offline"}</span>
          <Badge tone={status === "live" ? "green" : status === "paused" ? "amber" : "quiet"}>{status === "live" ? "Live" : status === "paused" ? "View paused" : status === "stale" ? "Stale" : "Disconnected"}</Badge>
        </div>
      }
    >
      <div className="workspace-chart-summary">
        <div><span>Last observed</span><strong>{stats.current === null ? "Unavailable" : spec.format(stats.current)}</strong></div>
        <dl>
          <div><dt>Min</dt><dd>{stats.minimum === null ? "—" : spec.format(stats.minimum)}</dd></div>
          <div><dt>Avg</dt><dd>{stats.average === null ? "—" : spec.format(stats.average)}</dd></div>
          <div><dt>Max</dt><dd>{stats.maximum === null ? "—" : spec.format(stats.maximum)}</dd></div>
          <div><dt>Sample p95</dt><dd>{stats.p95 === null ? "—" : spec.format(stats.p95)}</dd></div>
        </dl>
      </div>
      <div className="workspace-chart-caption">
        <span>{sourceCadence} · Display {displayRateLabel(preferences.displayUpdateRateMs)}</span>
        <span>{sourceAgeText(sourceCapturedAt)}</span>
      </div>
      {stats.count ? (
        <div className="workspace-chart-stage" ref={viewportRef}>
          <p id={descriptionId} className="sr-only">
            {spec.label} over the last {windowMinutes} minutes is {trendText(series)}. Latest value {stats.current === null ? "unavailable" : spec.format(stats.current)}. {stats.count} observed values{legacyCount ? `, including ${legacyCount} legacy packet-time cached observations` : " from independent source captures"}; missing samples are rendered as gaps. Focus the chart and use the left and right arrow keys to inspect samples.
          </p>
          <svg
            ref={svgRef}
            className={`workspace-chart display-series-${spec.series}`}
            viewBox="0 0 720 210"
            role="img"
            tabIndex={0}
            aria-describedby={descriptionId}
            aria-label={`${spec.label}: current ${stats.current === null ? "unavailable" : spec.format(stats.current)}, minimum ${stats.minimum === null ? "unavailable" : spec.format(stats.minimum)}, average ${stats.average === null ? "unavailable" : spec.format(stats.average)}, maximum ${stats.maximum === null ? "unavailable" : spec.format(stats.maximum)}`}
            onFocus={() => { if (inspectIndex === null) moveInspection(-1); }}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                moveInspection(event.key === "ArrowLeft" ? -1 : 1);
              }
              if (event.key === "Escape") setInspectIndex(null);
            }}
            onPointerLeave={() => setInspectIndex(null)}
            onPointerMove={(event) => {
              if (!series.length) return;
              const rect = svgRef.current?.getBoundingClientRect();
              if (!rect) return;
              const x = ((event.clientX - rect.left) / rect.width) * 720;
              const ratioX = Math.max(0, Math.min(1, (x - 62) / 638));
              const at = start + ratioX * (end - start);
              const index = nearestValueIndex(series, at);
              setInspectIndex(index !== null && Math.abs(series[index].at - at) <= Math.max(1000, (sourceIntervalMs ?? METRICS[spec.field].intervalMs) * 3) ? index : null);
            }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--ui-series)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--ui-series)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[36, 107, 178].map((y) => <line key={y} x1="62" x2="700" y1={y} y2={y} className="workspace-gridline" />)}
            {ticks.map((tick, index) => (
              <text key={index} x="55" y={[40, 111, 182][index]} textAnchor="end" className="workspace-axis-label">
                {spec.field === "memory" || spec.field === "heap" || spec.field === "serviceMemory" ? bytes(tick) : tick.toFixed(tick >= 100 ? 0 : 1)}
              </text>
            ))}
            {spec.reference && spec.reference.value >= lower && spec.reference.value <= upper && (
              <>
                <rect x="62" width="638" y={Math.max(30, yFor(spec.reference.value) - 4)} height="8" className="display-reference-band" />
                <line x1="62" x2="700" y1={yFor(spec.reference.value)} y2={yFor(spec.reference.value)} className="workspace-reference-line" />
                <text x="694" y={Math.max(15, yFor(spec.reference.value) - 7)} textAnchor="end" className="workspace-reference-label">{spec.reference.label}</text>
              </>
            )}
            {preferences.chartStyle === "area" && paths.area && <path d={paths.area} fill={`url(#${gradientId})`} className="display-chart-area" />}
            <path d={paths.line} className="workspace-trend" />
            {inspected && inspectedValue !== null && (
              <>
                <line x1={xFor(inspected.at)} x2={xFor(inspected.at)} y1="26" y2="178" className="workspace-crosshair" />
                <circle cx={xFor(inspected.at)} cy={yFor(inspectedValue)} r="4" className="workspace-sample-dot" />
              </>
            )}
            <text x="62" y="201" className="workspace-axis-label">{displayTime(start, preferences.timeZone)}</text>
            <text x="700" y="201" textAnchor="end" className="workspace-axis-label">{displayTime(end, preferences.timeZone)}</text>
          </svg>
          {inspected && inspectedValue !== null && (
            <div className="workspace-chart-tooltip" title={`UTC: ${new Date(inspected.at).toISOString()}`}>
              <strong>{displayTime(inspected.at, preferences.timeZone)}</strong>
              <span>{spec.shortLabel}</span>
              <b>{spec.format(inspectedValue)}</b>
              <small>{sampleFreshnessText(inspected.at, end)}</small>
              <small>{METRICS[spec.field].origin} · {METRICS[spec.field].unit} · {inspected.provenance}</small>
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
      <div className="workspace-chart-caption"><span>Browser-local rolling history · {legacyCount ? "includes legacy packet timestamps" : "source timestamps"}</span><span>{stats.count} observed values · {stats.coverage.toFixed(0)}% observed time coverage</span></div>
      {legacyCount > 0 && <p className="ui-hint">{legacyCount} cached observations predate source-capture metadata. These use packet times and can repeat a source value; statistics include these observations until they age out of this window.</p>}
    </Panel>
  );
}


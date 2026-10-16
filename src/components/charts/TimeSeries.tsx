import {
  createContext,
  memo,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Sample } from "../../adapter/control-state";
import { chartMaximum, chartTimeAt } from "./geometry";
import {
  displaySegments,
  finite,
  historyFor,
  sourceFor,
  type MetricKey,
} from "../../presentation/telemetry";
import { usePlotHistory } from "../../presentation/PlotHistory";
import { usePreferences } from "../../store/preferences";

import { nearestObservation } from "../../presentation/nextgen/inspection";

type Series = { key: MetricKey; label: string; color: string; unit: string };
export type ChartEvidence = {
  capturedAt: string | null;
  receivedAt: number | null;
  cadence: number | null;
  label: string;
};
const Crosshair = createContext<{
  at: number | null;
  setAt: (at: number | null) => void;
}>({ at: null, setAt: () => {} });
export function CrosshairGroup({ children }: { children: ReactNode }) {
  const [at, setAt] = useState<number | null>(null);
  const value = useMemo(() => ({ at, setAt }), [at]);
  return <Crosshair.Provider value={value}>{children}</Crosshair.Provider>;
}

export const TimeSeries = memo(function TimeSeries({
  samples,
  series,
  yMin = 0,
  yMax,
  threshold,
  title,
  source = "Paper",
  height: preferredHeight = 230,
  mobileHeight,
  evidence,
  windowStart = -Infinity,
}: {
  samples: Sample[];
  series: Series[];
  yMin?: number;
  yMax?: number;
  threshold?: number;
  title: string;
  source?: string;
  height?: number;
  mobileHeight?: number;
  evidence?: ChartEvidence;
  windowStart?: number;
}) {
  const prefs = usePreferences();
  const epochHistories = usePlotHistory(samples);
  const [table, setTable] = useState(false),
    [hidden, setHidden] = useState<Set<MetricKey>>(new Set()),
    [width, setWidth] = useState(600),
    [pinned, setPinned] = useState<number | null>(null),
    [localAt, setLocalAt] = useState<number | null>(null);
  const height =
    width < 420
      ? (mobileHeight ?? Math.min(preferredHeight, 260))
      : preferredHeight;
  const touchClick = useRef(false);
  const pointerFrame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(pointerFrame.current), []);
  const svgRef = useRef<SVGSVGElement>(null),
    id = useId().replaceAll(":", ""),
    crosshair = useContext(Crosshair);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(220, Math.round(entry.contentRect.width))),
    );
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const signature = JSON.stringify(series);
  const wanted = new Set(series.map((item) => sourceFor[item.key]));
  const paperHealth = wanted.has("paperHealth")
    ? (epochHistories?.paperHealth ?? samples)
    : null;
  const paperSystem = wanted.has("paperSystem")
    ? (epochHistories?.paperSystem ?? samples)
    : null;
  const hostSystem = wanted.has("hostSystem")
    ? (epochHistories?.hostSystem ?? samples)
    : null;
  const service = wanted.has("service")
    ? (epochHistories?.service ?? samples)
    : null;
  const projected = useMemo(() => {
    const inputs = { paperHealth, paperSystem, hostSystem, service };
    return series.map((item) => ({
      item,
      points: historyFor(
        inputs[sourceFor[item.key]] ?? [],
        sourceFor[item.key],
        windowStart,
      ),
    }));
  }, [signature, windowStart, paperHealth, paperSystem, hostSystem, service]);
  const all = useMemo(() => {
    if (projected.length === 1)
      return projected[0].points.filter((sample) =>
        finite(sample[projected[0].item.key]),
      );
    const map = new Map<number, Sample>();
    for (const entry of projected)
      for (const sample of entry.points)
        if (finite(sample[entry.item.key])) map.set(sample.at, sample);
    return [...map.values()].sort((a, b) => a.at - b.at);
  }, [projected]);
  const observed = useMemo(
    () =>
      projected.flatMap(({ item, points }) =>
        points.map((sample) => sample[item.key]).filter(finite),
      ),
    [projected],
  );
  const visible = projected.filter(({ item }) => !hidden.has(item.key));
  const minAt = all[0]?.at ?? 0,
    maxAt = all.at(-1)?.at ?? minAt + 1;
  const maximum = chartMaximum(observed, yMax, threshold, yMin),
    byteAxis = series.every((item) => item.unit === "bytes");
  const divisor = byteAxis
    ? maximum >= 2 ** 30
      ? 2 ** 30
      : maximum >= 2 ** 20
        ? 2 ** 20
        : maximum >= 1024
          ? 1024
          : 1
    : 1;
  const unit = byteAxis
    ? divisor === 2 ** 30
      ? "GiB"
      : divisor === 2 ** 20
        ? "MiB"
        : divisor === 1024
          ? "KiB"
          : "B"
    : (series[0]?.unit ?? "");
  const numberFormatters = useMemo(
    () => [
      new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }),
      new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }),
    ],
    [],
  );
  const format = (value: number, digits = 1) =>
    numberFormatters[digits === 2 ? 1 : 0].format(value / divisor);
  const clockFormatters = useMemo(
    () => ({
      short: new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: prefs.timezone === "UTC" ? "UTC" : undefined,
      }),
      precise: new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: prefs.timezone === "UTC" ? "UTC" : undefined,
      }),
    }),
    [prefs.timezone],
  );
  const time = (at: number, seconds = false) =>
    (seconds ? clockFormatters.precise : clockFormatters.short).format(at);
  const top = 30,
    bottom = height - 30,
    left = 42,
    right = width - 8;
  // A lone observation is a point in the center, never a fabricated flat timeline.
  const x = (at: number) =>
    maxAt === minAt
      ? (left + right) / 2
      : left + ((at - minAt) / (maxAt - minAt)) * (right - left);
  const y = (value: number) =>
    bottom - ((value - yMin) / Math.max(1, maximum - yMin)) * (bottom - top);
  const focusAt = pinned ?? crosshair.at ?? localAt;
  const pinExpired =
    pinned !== null && !all.some((sample) => sample.at === pinned);
  const nearest =
    focusAt === null || pinExpired ? null : nearestObservation(all, focusAt);
  const inspect = (at: number | null) => {
    setLocalAt(at);
    crosshair.setAt(at);
  };
  const move = (clientX: number, rect: DOMRect) => {
    if (pinned !== null || !all.length) return;
    const nextAt = chartTimeAt(
      clientX,
      rect.left,
      rect.width,
      width,
      left,
      right,
      minAt,
      maxAt,
    );
    cancelAnimationFrame(pointerFrame.current);
    pointerFrame.current = requestAnimationFrame(() => inspect(nextAt));
  };
  const step = (direction: number) => {
    if (!all.length) return;
    const index = nearest
      ? all.findIndex((sample) => sample.at === nearest.at)
      : -1;
    const next =
      index < 0
        ? direction > 0
          ? 0
          : all.length - 1
        : Math.min(all.length - 1, Math.max(0, index + direction));
    if (pinned !== null) setPinned(all[next].at);
    inspect(all[next].at);
  };
  const traces = useMemo(
    () =>
      visible.map(({ item, points }) => (
        <g key={item.key}>
          {displaySegments(
            points,
            item.key,
            Math.max(100, Math.floor(width * 0.8)),
          ).map((segment, index) => {
            const line = segment
              .map(
                (sample, i) =>
                  `${i ? "L" : "M"}${x(sample.at).toFixed(2)},${y(sample[item.key] as number).toFixed(2)}`,
              )
              .join("");
            return (
              <g key={index}>
                {segment.length > 1 && (
                  <path
                    className="chart-area"
                    d={`${line}L${x(segment.at(-1)!.at)},${bottom}L${x(segment[0].at)},${bottom}Z`}
                    fill={`url(#${id}-${item.key})`}
                  />
                )}
                <path
                  className="chart-line"
                  d={line}
                  stroke={item.color}
                  fill="none"
                />
                {segment.length === 1 && (
                  <circle
                    cx={x(segment[0].at)}
                    cy={y(segment[0][item.key] as number)}
                    r="3"
                    fill={item.color}
                  />
                )}
              </g>
            );
          })}
        </g>
      )),
    [projected, hidden, width, minAt, maxAt, maximum, yMin, height, id],
  );
  const exact = (points: Sample[], key: MetricKey) =>
    nearest
      ? points.find((sample) => sample.at === nearest.at && finite(sample[key]))
      : undefined;
  return (
    <div className="chart-block">
      <div className="chart-legend">
        {series.map((item) => (
          <button
            key={item.key}
            className={hidden.has(item.key) ? "muted" : ""}
            aria-pressed={!hidden.has(item.key)}
            aria-label={`Show ${item.label}`}
            onClick={() =>
              setHidden((current) => {
                const next = new Set(current);
                next.has(item.key) ? next.delete(item.key) : next.add(item.key);
                return next;
              })
            }
          >
            <i style={{ background: item.color }} />
            {item.label}
            <span className="legend-unit">{unit}</span>
          </button>
        ))}
        <button
          className="table-toggle"
          aria-expanded={table}
          aria-controls={`${id}-table`}
          onClick={() => setTable((value) => !value)}
        >
          {table ? "Hide data" : "View data"}
        </button>
      </div>
      <div className="chart-plot">
        <svg
          ref={svgRef}
          className="time-series"
          role="img"
          tabIndex={0}
          aria-label={`${title}. ${all.length} observations, ${unit}. Gaps over ten seconds remain disconnected. Arrow keys inspect, Enter pins, Escape clears.`}
          viewBox={`0 0 ${width} ${height}`}
          style={{ height }}
          onPointerDown={(event) => {
            if (event.pointerType === "touch" && all.length) {
              const rect = event.currentTarget.getBoundingClientRect();
              const at = chartTimeAt(
                event.clientX,
                rect.left,
                rect.width,
                width,
                left,
                right,
                minAt,
                maxAt,
              );
              touchClick.current = true;
              const actual = nearestObservation(all, at)?.at ?? at;
              inspect(actual);
              setPinned(actual);
            }
          }}
          onPointerMove={(event) =>
            move(event.clientX, event.currentTarget.getBoundingClientRect())
          }
          onPointerLeave={() => {
            if (pinned === null) inspect(null);
          }}
          onClick={() => {
            if (touchClick.current) {
              touchClick.current = false;
              return;
            }
            if (nearest) {
              setPinned(pinned === null ? nearest.at : null);
            }
          }}
          onBlur={() => {
            if (pinned === null) inspect(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              step(event.key === "ArrowLeft" ? -1 : 1);
            }
            if (event.key === "Home" || event.key === "End") {
              event.preventDefault();
              const sample = event.key === "Home" ? all[0] : all.at(-1);
              if (sample) {
                inspect(sample.at);
                if (pinned !== null) setPinned(sample.at);
              }
            }
            if (event.key === "Escape") {
              setPinned(null);
              inspect(null);
            }
            if (event.key === "Enter" && nearest) {
              event.preventDefault();
              setPinned(pinned === null ? nearest.at : null);
            }
          }}
        >
          <defs>
            {series.map((item) => (
              <linearGradient
                id={`${id}-${item.key}`}
                key={item.key}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0" stopColor={item.color} stopOpacity=".14" />
                <stop offset="1" stopColor={item.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          <text x={left} y={14}>
            {unit}
          </text>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const value = yMin + (maximum - yMin) * (1 - ratio),
              position = top + (bottom - top) * ratio;
            return (
              <g key={ratio}>
                <line
                  x1={left}
                  x2={right}
                  y1={position}
                  y2={position}
                  className="gridline"
                />
                <text x={left - 8} y={position + 3} textAnchor="end">
                  {format(value)}
                </text>
              </g>
            );
          })}
          {threshold !== undefined && (
            <g>
              <rect
                className="threshold-band"
                x={left}
                y={top}
                width={right - left}
                height={Math.max(0, y(threshold) - top)}
              />
              <line
                x1={left}
                x2={right}
                y1={y(threshold)}
                y2={y(threshold)}
                className="threshold"
              />
              <text x={right - 4} y={y(threshold) - 6} textAnchor="end">
                {threshold} {unit} budget
              </text>
            </g>
          )}
          {traces}
          {all.length > 0 && (
            <>
              <text x={left} y={height - 5}>
                {time(minAt)}
              </text>
              {maxAt !== minAt && (
                <text x={right} y={height - 5} textAnchor="end">
                  {time(maxAt)}
                </text>
              )}
              {width > 450 && maxAt !== minAt && (
                <text x={(left + right) / 2} y={height - 5} textAnchor="middle">
                  {time((maxAt + minAt) / 2)}
                </text>
              )}
            </>
          )}
          {nearest && (
            <g>
              <line
                className="crosshair"
                x1={x(nearest.at)}
                x2={x(nearest.at)}
                y1={top}
                y2={bottom}
              />
              {visible.map(({ item, points }) => {
                const found = exact(points, item.key);
                return found ? (
                  <circle
                    key={item.key}
                    cx={x(found.at)}
                    cy={y(found[item.key] as number)}
                    r="4"
                    fill={item.color}
                    stroke="var(--instrument)"
                    strokeWidth="2"
                  />
                ) : null;
              })}
            </g>
          )}
        </svg>
        {(!all.length || !visible.length) && (
          <div className="chart-empty">
            <strong>
              {!all.length ? "No observed signal" : "All signals hidden"}
            </strong>
            <span>
              {!all.length
                ? "This source has not reported a measurement in this window."
                : "Select a legend to restore a signal."}
            </span>
          </div>
        )}
      </div>
      <div className="inspection-shelf">
        {nearest && visible.length > 0 && (
          <div className="inspection-reading" role="status">
            <strong>
              {time(nearest.at, true)} {pinned !== null ? "· pinned" : ""}
            </strong>
            {visible.map(({ item, points }) => {
              const found = exact(points, item.key);
              return (
                <span key={item.key}>
                  <i style={{ background: item.color }} />
                  {item.label}
                  <b>
                    {found
                      ? `${format(found[item.key] as number, 2)} ${unit}`
                      : "No sample"}
                  </b>
                </span>
              );
            })}
            <small>{source} · source capture time</small>
          </div>
        )}
        {!nearest && (
          <p
            className="inspection-hint"
            role={pinExpired ? "status" : undefined}
          >
            {pinExpired
              ? "Pinned sample is outside this source window. Clear pin to inspect current observations."
              : "Inspect an actual observation with touch, pointer or Previous / Next."}
          </p>
        )}
        {pinExpired && (
          <button
            className="text-link"
            onClick={() => {
              setPinned(null);
              inspect(null);
            }}
          >
            Clear pin
          </button>
        )}
      </div>
      <div id={`${id}-table`} hidden={!table}>
        {table && (
          <div
            className="table-region"
            role="region"
            tabIndex={0}
            aria-label={`${title} sample table`}
          >
            <table>
              <caption>
                Latest 50 actual source observations ·{" "}
                {prefs.timezone === "UTC" ? "UTC" : "browser time"}
              </caption>
              <thead>
                <tr>
                  <th>Captured</th>
                  {series.map((item) => (
                    <th key={item.key}>
                      {item.label} ({unit})
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {all.slice(-50).map((sample) => (
                  <tr key={sample.at}>
                    <td>{time(sample.at, true)}</td>
                    {projected.map(({ item, points }) => {
                      const found = points.find(
                        (point) => point.at === sample.at,
                      );
                      return (
                        <td key={item.key}>
                          {found && finite(found[item.key])
                            ? format(found[item.key] as number, 2)
                            : "Unknown"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <footer className="chart-provenance">
        {" "}
        <div className="sample-tools">
          <button
            aria-label={`Inspect previous ${title} sample`}
            onClick={() => step(-1)}
          >
            ← Previous
          </button>
          <button
            aria-label={`Inspect next ${title} sample`}
            onClick={() => step(1)}
          >
            Next →
          </button>
          {nearest && (
            <button
              onClick={() => setPinned(pinned === null ? nearest.at : null)}
            >
              {pinned === null ? "Pin sample" : "Unpin"}
            </button>
          )}
        </div>
        <span>{source}</span>
        <span>{all.length} observations</span>
        <span>
          {all.length
            ? `${((maxAt - minAt) / 60000).toFixed(1)} min`
            : "No window"}
        </span>
        <details>
          <summary>Source details</summary>
          <p>
            Capture:{" "}
            {evidence?.capturedAt ??
              (all.length ? new Date(maxAt).toISOString() : "Unavailable")}
            <br />
            Browser receipt:{" "}
            {evidence?.receivedAt
              ? new Date(evidence.receivedAt).toISOString()
              : "Unavailable"}
            <br />
            Source cadence:{" "}
            {evidence?.cadence ? `${evidence.cadence} ms` : "Not reported"}
            <br />
            Freshness: {evidence?.label ?? "Retained observations"}
            <br />
            Display reduction preserves extrema and gaps; the table shows
            original samples.
          </p>
        </details>
      </footer>
    </div>
  );
});

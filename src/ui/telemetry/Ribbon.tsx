import { useCrosshair } from "./crosshair";
import {
  SERIES,
  sampleAt,
  latest,
  segments,
  type Sample,
  type SeriesKey,
} from "./series";
export function Ribbon({
  keys,
  selected,
  onSelect,
  samples,
}: {
  keys: SeriesKey[];
  selected: SeriesKey;
  onSelect: (key: SeriesKey) => void;
  samples: Sample[];
}) {
  const hover = useCrosshair();
  return (
    <div
      className="pp-ribbon"
      role="tablist"
      aria-label="Telemetry series"
      style={{ gridTemplateColumns: `repeat(${keys.length},minmax(0,1fr))` }}
    >
      {keys.map((key, i) => {
        const spec = SERIES[key],
          point = hover === null ? undefined : sampleAt(samples, hover, key),
          value =
            hover === null
              ? latest(samples, key)
              : point
                ? spec.accessor(point)
                : null,
          tail = segments(samples, key).at(-1)?.slice(-40) ?? [],
          lo = Math.min(...tail.map((s) => spec.accessor(s)!)),
          hi = Math.max(...tail.map((s) => spec.accessor(s)!));
        return (
          <button
            type="button"
            key={key}
            role="tab"
            className="pp-metric"
            data-series={key}
            data-testid={`ribbon-${key}`}
            data-active={selected === key}
            aria-selected={selected === key}
            tabIndex={selected === key ? 0 : -1}
            onClick={() => onSelect(key)}
            onKeyDown={(e) => {
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                const n =
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? keys.length - 1
                      : (i + (e.key === "ArrowRight" ? 1 : -1) + keys.length) %
                        keys.length;
                onSelect(keys[n]);
                (
                  e.currentTarget.parentElement?.children[n] as HTMLElement
                )?.focus();
              }
            }}
            style={{ "--pp-accent": spec.color } as React.CSSProperties}
          >
            <span className="pp-kicker pp-metric__label">{spec.label}</span>
            <span className="pp-metric__value pp-num">
              {spec.fmt(value)}
              <small className="pp-metric__unit">{spec.unit}</small>
            </span>
            {value !== null && tail.length > 1 && (
              <svg className="pp-spark" viewBox="0 0 56 22" aria-hidden="true">
                {spec.kind === "bars" ? (
                  tail.map(
                    (s, i) =>
                      spec.accessor(s)! > 0 && (
                        <line
                          key={i}
                          x1={(i / Math.max(1, tail.length - 1)) * 56}
                          x2={(i / Math.max(1, tail.length - 1)) * 56}
                          y1="21"
                          y2={
                            20 -
                            ((spec.accessor(s)! - lo) / Math.max(1, hi - lo)) *
                              18
                          }
                          stroke={spec.color}
                        />
                      ),
                  )
                ) : (
                  <polyline
                    points={tail
                      .map(
                        (s, i) =>
                          `${(i / (tail.length - 1)) * 56},${20 - ((spec.accessor(s)! - lo) / Math.max(1, hi - lo)) * 18}`,
                      )
                      .join(" ")}
                    fill="none"
                    stroke={spec.color}
                  />
                )}
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

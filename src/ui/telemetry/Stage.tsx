"use client";
import { useId, useMemo, useRef, type CSSProperties } from "react";
import { usePrefs } from "../bindings";
import { monotone } from "../studio/geometry";
import {
  clamp,
  decimate,
  segments,
  gapsFor,
  sampleAt,
  latest,
  type Sample,
  type SeriesSpec,
} from "./series";
import { crosshair, useCrosshair } from "./crosshair";
import { useSize } from "./hooks";
export const PLOT = { l: 12, r: 46, t: 14, b: 6 } as const;
export interface StageProps {
  spec: SeriesSpec;
  samples: Sample[];
  domainT: [number, number];
  height?: number | "fill";
  minHeight?: number;
  kicker?: string;
  selected?: boolean;
  onSelect?: () => void;
  testId?: string;
  stale?: boolean;
}
export function Stage({
  spec,
  samples,
  domainT,
  height = "fill",
  minHeight = 64,
  kicker,
  selected,
  onSelect,
  testId,
  stale,
}: StageProps) {
  const ref = useRef<HTMLDivElement>(null),
    size = useSize(ref),
    id = useId().replaceAll(":", ""),
    prefs = usePrefs(),
    hover = useCrosshair(),
    H = height === "fill" ? size.h : height,
    w = size.w;
  const model = useMemo(() => {
    const [d0, d1] = spec.domain(samples),
      iw = Math.max(1, w - PLOT.l - PLOT.r),
      ih = Math.max(1, H - PLOT.t - PLOT.b),
      sx = (t: number) =>
        PLOT.l + ((t - domainT[0]) / Math.max(1, domainT[1] - domainT[0])) * iw,
      sy = (v: number) =>
        PLOT.t + ih - ((clamp(v, d0, d1) - d0) / Math.max(0.001, d1 - d0)) * ih,
      base = PLOT.t + ih;
    const groups = segments(samples, spec.key).map((seg) =>
        decimate(
          seg,
          Math.max(3, Math.floor(iw)),
          (s) => spec.accessor(s)!,
          spec.peak,
        ),
      ),
      line = groups
        .map((seg) =>
          monotone(seg.map((s) => ({ x: sx(s.t), y: sy(spec.accessor(s)!) }))),
        )
        .join(" "),
      area = groups
        .map(
          (seg) =>
            `${monotone(seg.map((s) => ({ x: sx(s.t), y: sy(spec.accessor(s)!) })))}L${sx(seg.at(-1)!.t)},${base}L${sx(seg[0].t)},${base}Z`,
        )
        .join(" ");
    return {
      d0,
      d1,
      iw,
      ih,
      sx,
      sy,
      base,
      groups,
      line,
      area,
      gaps: gapsFor(samples, spec.key),
    };
  }, [samples, spec, w, H, domainT]);
  const sample =
      hover === null ? undefined : sampleAt(samples, hover, spec.key),
    value =
      hover === null
        ? latest(samples, spec.key)
        : sample
          ? spec.accessor(sample)
          : null,
    budget = spec.budget,
    inside = budget && budget.value >= model.d0 && budget.value <= model.d1,
    Head = onSelect ? "button" : "div";
  return (
    <section
      className="pp-stage"
      data-series={spec.key}
      data-selected={selected ? "true" : undefined}
      data-testid={testId ?? `stage-${spec.key}`}
      data-stale={stale || undefined}
      style={
        {
          "--pp-accent": spec.color,
          minHeight: height === "fill" ? minHeight : undefined,
        } as CSSProperties
      }
    >
      <Head
        className="pp-stage__head"
        {...(onSelect
          ? {
              type: "button" as const,
              onClick: onSelect,
              "aria-pressed": !!selected,
            }
          : {})}
      >
        {kicker && <span className="pp-stage__kicker">{kicker}</span>}
        <span className="pp-stage__label">{spec.label}</span>
        {budget && !inside && (
          <span className="pp-stage__chip" data-budget="50">
            ▲ {budget.label} · off scale
          </span>
        )}
        <span
          className="pp-stage__value"
          data-state={hover === null ? "live" : "scrub"}
        >
          {spec.fmt(value)}
          <small>{spec.unit}</small>
        </span>
      </Head>
      <div
        ref={ref}
        className="pp-stage__plot"
        style={height === "fill" ? undefined : { height }}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          crosshair.set(
            domainT[0] +
              clamp((e.clientX - rect.left - PLOT.l) / model.iw, 0, 1) *
                (domainT[1] - domainT[0]),
          );
        }}
        onPointerLeave={() => crosshair.set(null)}
      >
        <svg
          className="pp-stage__svg"
          viewBox={`0 0 ${w} ${H}`}
          role="img"
          aria-label={`${spec.label} over time; scale ${spec.fmt(model.d0)} to ${spec.fmt(model.d1)} ${spec.unit}`}
        >
          <defs>
            <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop
                stopColor={spec.color}
                stopOpacity={prefs.chartFill ? 0.38 : 0}
              />
              <stop
                offset=".6"
                stopColor={spec.color}
                stopOpacity={prefs.chartFill ? 0.12 : 0}
              />
              <stop offset="1" stopColor={spec.color} stopOpacity="0" />
            </linearGradient>
            <pattern
              id={`${id}-gap`}
              data-def="pp-hatch-gap"
              width="7"
              height="7"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="7" height="7" fill="rgb(var(--rose)/.04)" />
              <line y2="7" stroke="rgb(var(--rose)/.3)" />
            </pattern>
            <clipPath id={`${id}-clip`}>
              <rect x={PLOT.l} y={PLOT.t} width={model.iw} height={model.ih} />
            </clipPath>
          </defs>
          {[model.d0, (model.d0 + model.d1) / 2, model.d1].map((v) => (
            <g key={v}>
              <line
                className="pp-grid"
                x1={PLOT.l}
                x2={w - PLOT.r}
                y1={model.sy(v)}
                y2={model.sy(v)}
              />
              <text className="pp-ytick" x={w - PLOT.r + 7} y={model.sy(v) + 3}>
                {Number.isInteger(v) ? v : v.toFixed(1)}
              </text>
            </g>
          ))}
          <g clipPath={`url(#${id}-clip)`}>
            {model.gaps.map((g, i) => (
              <rect
                key={i}
                data-gap="true"
                data-from={g.from}
                data-to={g.to}
                x={model.sx(g.from)}
                y={PLOT.t}
                width={Math.max(1, model.sx(g.to) - model.sx(g.from))}
                height={model.ih}
                fill={`url(#${id}-gap)`}
              />
            ))}
            {spec.kind === "area" ? (
              <>
                <path
                  className="pp-area"
                  data-series={spec.key}
                  d={model.area}
                  fill={`url(#${id}-fill)`}
                />
                <path
                  className="pp-line"
                  data-series={spec.key}
                  data-segments={JSON.stringify(
                    model.groups.map((g) => [g[0].t, g.at(-1)!.t]),
                  )}
                  d={model.line}
                  stroke={spec.color}
                />
              </>
            ) : (
              model.groups
                .flat()
                .filter((s) => spec.accessor(s)! > 0)
                .map((s, i) => (
                  <rect
                    key={i}
                    className="pp-bar"
                    x={model.sx(s.t) - 1.5}
                    y={model.sy(spec.accessor(s)!)}
                    width="3"
                    height={Math.max(
                      1,
                      model.base - model.sy(spec.accessor(s)!),
                    )}
                    fill={spec.color}
                  />
                ))
            )}
            {inside && (
              <g data-budget="50">
                <line
                  className="pp-budget"
                  x1={PLOT.l}
                  x2={w - PLOT.r}
                  y1={model.sy(budget.value)}
                  y2={model.sy(budget.value)}
                />
                <text
                  className="pp-budget-label"
                  x={PLOT.l + 4}
                  y={Math.max(PLOT.t + 10, model.sy(budget.value) - 4)}
                >
                  {budget.label}
                </text>
              </g>
            )}
            {hover !== null && (
              <>
                <line
                  className="pp-cross"
                  x1={model.sx(hover)}
                  x2={model.sx(hover)}
                  y1={PLOT.t}
                  y2={model.base}
                />
                {value != null && (
                  <circle
                    className="pp-cross-dot"
                    cx={model.sx(hover)}
                    cy={model.sy(value)}
                    r="3"
                    stroke={spec.color}
                  />
                )}
              </>
            )}
          </g>
        </svg>
        {!model.groups.length && (
          <span className="pp-stage__empty">No samples in this window</span>
        )}
      </div>
    </section>
  );
}

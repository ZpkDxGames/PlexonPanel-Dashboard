import type { Sample } from "../../adapter/control-state";

export type MetricKey = keyof Pick<Sample, "tps" | "mspt" | "hostCpu" | "processCpu" | "heap" | "memory" | "players" | "gc">;
export const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** Close every area independently so neither lines nor fills bridge missing telemetry. */
export function chartPaths(samples: Sample[], key: MetricKey, x: (at: number) => number, y: (value: number) => number, baseline: number) {
  const segments: { x: number; y: number }[][] = [];
  let segment: { x: number; y: number }[] = [];
  let previous: number | null = null;
  for (const sample of samples) {
    const value = sample[key];
    if (!finite(value) || (previous !== null && sample.at - previous > 10_000)) {
      if (segment.length) segments.push(segment);
      segment = [];
    }
    if (finite(value)) segment.push({ x: x(sample.at), y: y(value) });
    previous = sample.at;
  }
  if (segment.length) segments.push(segment);
  return segments.map((points) => {
    const line = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join("");
    return { line, area: `${line}L${points.at(-1)!.x.toFixed(2)},${baseline}L${points[0].x.toFixed(2)},${baseline}Z`, point: points.length === 1 ? points[0] : null };
  });
}

export function chartMaximum(observed: number[], requested?: number, threshold?: number, minimum = 0) {
  const maximum = observed.reduce((max, value) => finite(value) ? Math.max(max, value) : max, Math.max(requested ?? 0, threshold ?? 0, minimum + 1));
  if (requested !== undefined && maximum <= requested) return requested;
  const power = 10 ** Math.floor(Math.log10(maximum));
  const step = power / 2;
  return Math.ceil(maximum / step) * step;
}

export function chartTimeAt(clientX: number, rectLeft: number, rectWidth: number, width: number, plotLeft: number, plotRight: number, minAt: number, maxAt: number) {
  const svgX = (clientX - rectLeft) / Math.max(rectWidth, 1) * width;
  const fraction = Math.max(0, Math.min(1, (svgX - plotLeft) / (plotRight - plotLeft)));
  return minAt + fraction * (maxAt - minAt);
}

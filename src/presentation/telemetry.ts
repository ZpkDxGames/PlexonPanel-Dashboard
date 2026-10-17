import {
  number,
  record,
  type ControlState,
  type Sample,
} from "../adapter/control-state";
import { projectHistory } from "../adapter/history";
import { classifyTelemetry } from "../adapter/telemetry-freshness";
import { validFleetUuid } from "../adapter/fleet-contract";

export type MetricKey =
  | "chunks"
  | "entities"
  | "tps"
  | "msptP95"
  | "msptP99"
  | "heapCommitted"
  | "heapMax"
  | "serviceMemoryMax"
  | "mspt"
  | "hostCpu"
  | "processCpu"
  | "heap"
  | "memory"
  | "players"
  | "gc"
  | "serviceCpu"
  | "serviceMemory";
export type Source = "paperHealth" | "paperSystem" | "hostSystem" | "service";
export const sourceFor: Record<MetricKey, Source> = {
  chunks: "paperHealth",
  entities: "paperHealth",
  tps: "paperHealth",
  mspt: "paperHealth",
  msptP95: "paperHealth",
  msptP99: "paperHealth",
  heapCommitted: "paperSystem",
  heapMax: "paperSystem",
  serviceMemoryMax: "service",
  players: "paperHealth",
  processCpu: "paperSystem",
  heap: "paperSystem",
  gc: "paperSystem",
  hostCpu: "hostSystem",
  memory: "hostSystem",
  serviceCpu: "service",
  serviceMemory: "service",
};
export const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Never place a Paper measurement on a Host packet's capture clock. */
export function historyFor(
  history: Sample[],
  source: Source,
  since = -Infinity,
): Sample[] {
  const projected = history.some((sample) => sample.sources !== undefined)
    ? projectHistory(history, source)
    : history;
  return since === -Infinity
    ? projected
    : projected.filter((sample) => sample.at >= since);
}
export function cadence(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= 3_600_000
    ? value
    : null;
}
export function sourceEvidence(
  state: ControlState,
  source: Source,
  now: number,
) {
  const paper = source.startsWith("paper");
  const payload =
    source === "paperHealth"
      ? state.server
      : source === "paperSystem"
        ? state.system
        : source === "hostSystem"
          ? state.hostSystem
          : record(state.service.resources);
  const receipt = state.receipts?.[source];
  return {
    ...classifyTelemetry({
      capturedAt: payload.capturedAt,
      receivedAt: receipt,
      connected:
        !!state.ready?.agents[paper ? "paper" : "host"] &&
        (source !== "service" || state.service.state === "active"),
      now,
    }),
    capturedAt:
      typeof payload.capturedAt === "string" ? payload.capturedAt : null,
    receivedAt: receipt ?? null,
    cadence: cadence(
      payload.sourceIntervalMillis ??
        (source === "service" ? state.service.sourceIntervalMillis : null),
    ),
  };
}

const cache = new WeakMap<Sample[], Map<string, Sample[][]>>();
/** Display only: preserve gap boundaries, endpoints and local extrema. Raw history is untouched. */
export function displaySegments(
  samples: Sample[],
  key: MetricKey,
  budget = 480,
): Sample[][] {
  const cacheKey = `${key}:${budget}`;
  let entries = cache.get(samples);
  if (!entries) {
    entries = new Map();
    cache.set(samples, entries);
  }
  const cached = entries.get(cacheKey);
  if (cached) return cached;
  const segments: Sample[][] = [];
  let segment: Sample[] = [];
  let previous: number | null = null;
  for (const sample of samples) {
    if (
      !finite(sample[key]) ||
      (previous !== null &&
        (sample.at - previous > 10_000 || sample.at < previous))
    ) {
      if (segment.length) segments.push(segment);
      segment = [];
    }
    if (finite(sample[key])) segment.push(sample);
    previous = sample.at;
  }
  if (segment.length) segments.push(segment);
  const total = segments.reduce((sum, points) => sum + points.length, 0);
  const result = segments.map((points) => {
    const target = Math.max(
      4,
      Math.floor((budget * points.length) / Math.max(1, total)),
    );
    if (points.length <= target) return points;
    const bucketSize = Math.ceil(
      (points.length - 2) / Math.max(1, Math.floor((target - 2) / 2)),
    );
    const selected = [points[0]];
    for (let index = 1; index < points.length - 1; index += bucketSize) {
      const end = Math.min(points.length - 1, index + bucketSize);
      let low = index,
        high = index;
      for (let cursor = index + 1; cursor < end; cursor++) {
        if (points[cursor][key]! < points[low][key]!) low = cursor;
        if (points[cursor][key]! > points[high][key]!) high = cursor;
      }
      selected.push(points[Math.min(low, high)]);
      if (low !== high) selected.push(points[Math.max(low, high)]);
    }
    selected.push(points.at(-1)!);
    return selected;
  });
  entries.set(cacheKey, result);
  return result;
}
export function observedSummary(samples: Sample[], key: MetricKey) {
  let min = Infinity,
    max = -Infinity,
    count = 0,
    sum = 0;
  for (const sample of samples)
    if (finite(sample[key])) {
      min = Math.min(min, sample[key]);
      max = Math.max(max, sample[key]);
      sum += sample[key];
      count++;
    }
  return {
    count,
    min: count ? min : null,
    max: count ? max : null,
    mean: count ? sum / count : null,
  };
}
export function gcMovement(samples: Sample[]): number | null {
  const values = samples.filter((sample) => finite(sample.gc));
  if (
    values.length < 2 ||
    values.some(
      (sample, index) => index > 0 && sample.gc! < values[index - 1].gc!,
    )
  )
    return null;
  const elapsed = values.at(-1)!.at - values[0].at;
  return elapsed > 0
    ? (values.at(-1)!.gc! - values[0].gc!) / (elapsed / 60_000)
    : null;
}
export function verifiedNodes(
  rows: { state: ControlState; phase: string }[],
  now: number,
) {
  const nodes = new Map<string, ControlState>();
  for (const row of rows) {
    const { state } = row;
    const id = state.ready?.server.nodeId;
    if (
      row.phase !== "live" ||
      !validFleetUuid(id) ||
      state.ready?.server.fleetState !== "BOUND" ||
      state.hostSystem.nodeId !== id ||
      state.hostSystem.metricScope !== "NODE" ||
      !sourceEvidence(state, "hostSystem", now).usable
    )
      continue;
    const prior = nodes.get(id);
    if (
      !prior ||
      String(state.hostSystem.capturedAt) > String(prior.hostSystem.capturedAt)
    )
      nodes.set(id, state);
  }
  return [...nodes.entries()].map(([nodeId, state]) => ({
    nodeId,
    state,
    cpu: number(state.hostSystem.hostCpuPercent),
    memory: number(state.hostSystem.physicalMemoryUsedBytes),
  }));
}

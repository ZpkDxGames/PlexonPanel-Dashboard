import {
  currentBedrockCapture,
  type BedrockRoom,
} from "../../adapter/bedrock-room";

/** Additive Bedrock presentation helpers. Never interpret Docker evidence as Paper/JVM evidence. */
export type InstanceEdition = "JAVA_PAPER" | "BEDROCK" | "UNKNOWN";

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Explicit edition is authoritative only after the upstream signed/authorized
 * room has validated it. Unmarked legacy peers remain Java when a real Paper
 * plugin version was advertised. We never infer Bedrock from a server name.
 */
export function instanceEdition(server: unknown): InstanceEdition {
  const fields = object(server);
  if (fields.edition === "BEDROCK") return "BEDROCK";
  if (fields.edition === "JAVA_PAPER" || fields.edition === "PAPER")
    return "JAVA_PAPER";
  if (fields.edition !== undefined && fields.edition !== null) return "UNKNOWN";
  return typeof fields.pluginVersion === "string" &&
    fields.pluginVersion.trim().length > 0
    ? "JAVA_PAPER"
    : "UNKNOWN";
}

export interface BedrockContainerMetrics {
  cpuPercent: number | null;
  memoryBytes: number | null;
}

/** Treat absent and stale container telemetry as unknown, never as zero. */
export function bedrockContainerMetrics(
  service: unknown,
  nowMillis: number,
  maxAgeMillis = 30_000,
): BedrockContainerMetrics {
  const empty = { cpuPercent: null, memoryBytes: null };
  const fields = object(service);
  const timestamp = fields.containerStatsCapturedAt;
  const capturedAt =
    typeof timestamp === "string"
      ? Date.parse(timestamp)
      : typeof timestamp === "number"
        ? timestamp
        : NaN;
  if (
    fields.source !== "DOCKER_ENGINE" ||
    !currentBedrockCapture(capturedAt, nowMillis, maxAgeMillis)
  ) {
    return empty;
  }
  const cpu = fields.containerCpuPercent;
  const memory = fields.containerMemoryBytes;
  return {
    cpuPercent:
      fields.cpuUnit === "PERCENT_OF_ONE_CORE" &&
      typeof cpu === "number" &&
      Number.isFinite(cpu) &&
      cpu >= 0 &&
      cpu <= 6400
        ? cpu
        : null,
    memoryBytes:
      typeof memory === "number" && Number.isSafeInteger(memory) && memory >= 0
        ? memory
        : null,
  };
}

export function bedrockContainerView(
  room: BedrockRoom | undefined,
  connected: boolean,
  now: number,
) {
  const status =
    connected &&
    room?.status &&
    currentBedrockCapture(room.status.capturedAt, now)
      ? room.status
      : undefined;
  const metrics = bedrockContainerMetrics(status, now);
  return {
    state: status?.containerState ?? null,
    ageMs: status ? Math.max(0, now - status.capturedAt) : null,
    ...metrics,
    memoryLimitBytes:
      status?.containerStatsCapturedAt != null &&
      currentBedrockCapture(status.containerStatsCapturedAt, now)
        ? status.containerMemoryLimitBytes
        : null,
    uptimeMs:
      status?.containerUptimeSeconds != null
        ? status.containerUptimeSeconds * 1_000
        : null,
    version: status?.version ?? null,
    gameplayReady: status?.gameplayReady ?? null,
  };
}

export function bedrockLogsView(
  room: BedrockRoom | undefined,
  connected: boolean,
  now: number,
) {
  return connected &&
    room?.logs &&
    currentBedrockCapture(room.logs.capturedAt, now)
    ? room.logs
    : null;
}

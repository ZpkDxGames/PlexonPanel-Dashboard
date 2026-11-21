/** Additive Bedrock presentation helpers. Never interpret Docker evidence as Paper/JVM evidence. */
export type InstanceEdition = "JAVA_PAPER" | "BEDROCK" | "UNKNOWN";

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
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
  if (fields.edition === "JAVA_PAPER" || fields.edition === "PAPER") return "JAVA_PAPER";
  if (fields.edition !== undefined && fields.edition !== null) return "UNKNOWN";
  return typeof fields.pluginVersion === "string" && fields.pluginVersion.trim().length > 0
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
  const capturedAt = typeof timestamp === "string"
    ? Date.parse(timestamp)
    : typeof timestamp === "number" ? timestamp : NaN;
  if (!Number.isFinite(nowMillis) || !Number.isFinite(capturedAt) ||
      !Number.isFinite(maxAgeMillis) || maxAgeMillis <= 0 ||
      capturedAt > nowMillis + 5_000 || nowMillis - capturedAt > maxAgeMillis) {
    return empty;
  }
  const cpu = fields.containerCpuPercent;
  const memory = fields.containerMemoryBytes;
  return {
    cpuPercent: typeof cpu === "number" && Number.isFinite(cpu) && cpu >= 0 && cpu <= 6400
      ? cpu : null,
    memoryBytes: typeof memory === "number" && Number.isSafeInteger(memory) && memory >= 0
      ? memory : null,
  };
}

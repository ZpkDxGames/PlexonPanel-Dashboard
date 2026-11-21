import { createHash } from "node:crypto";
import { object } from "./bedrock-config.js";

const CLOCK_SKEW_MS = 5_000;
const SAMPLE_AGE_MS = 30_000;
const LOG_WINDOW_MS = 10 * 60_000;
const STATES = new Set(["running", "exited", "restarting", "unknown", "created", "paused", "removing", "dead", "absent"]);
const POLICY = new Set(["no", "always", "on-failure", "unless-stopped"]);
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;
const TERMINAL_CONTROL = /[\u0000-\u0008\u000a-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;

export function bedrockEvent(type: string, body: Record<string, unknown>, now: number): Record<string, unknown> {
  const capture = timestamp(body.capturedAt);
  if (capture < now - SAMPLE_AGE_MS || capture > now + CLOCK_SKEW_MS || body.source !== "DOCKER_ENGINE")
    throw new Error("Invalid Bedrock sample source or freshness");
  const identity = {
    bedrockContract: body.bedrockContract, edition: body.edition, runtime: body.runtime,
    nodeId: body.nodeId, instanceKey: body.instanceKey, capturedAt: body.capturedAt, source: body.source,
  };
  if (type === "bedrock.status") return { ...identity, ...status(body, capture) };
  if (type === "bedrock.logs") return { ...identity, ...logs(body, capture) };
  throw new Error("Bedrock message type is not admitted");
}

function status(body: Record<string, unknown>, capture: number): Record<string, unknown> {
  const state = body.containerState;
  if (typeof state !== "string" || !STATES.has(state) || body.cpuUnit !== "PERCENT_OF_ONE_CORE")
    throw new Error("Invalid Bedrock container state or units");
  const startedAt = optionalInstant(body.containerStartedAt, capture);
  const statsAt = optionalInstant(body.containerStatsCapturedAt, capture);
  const restartPolicy = body.containerRestartPolicy;
  if (restartPolicy != null && (typeof restartPolicy !== "string" || !POLICY.has(restartPolicy)))
    throw new Error("Invalid Bedrock restart policy");
  const cpu = optionalNumber(body.containerCpuPercent, 100_000, false);
  const memory = optionalNumber(body.containerMemoryBytes, Number.MAX_SAFE_INTEGER);
  const limit = optionalNumber(body.containerMemoryLimitBytes, Number.MAX_SAFE_INTEGER);
  if ((cpu != null || memory != null || limit != null) && (!statsAt || timestamp(statsAt) < capture - SAMPLE_AGE_MS || state !== "running"))
    throw new Error("Invalid Bedrock resource sample");
  const uptime = optionalNumber(body.containerUptimeSeconds, Number.MAX_SAFE_INTEGER);
  if (uptime != null && (!startedAt || state !== "running")) throw new Error("Invalid Bedrock uptime");
  const version = optionalText(body.version, /^1(?:\.\d{1,3}){2,3}$/);
  const versionCapturedAt = optionalInstant(body.versionCapturedAt, capture);
  if (version && (state !== "running" || !startedAt || !versionCapturedAt || timestamp(versionCapturedAt) < timestamp(startedAt)))
    throw new Error("Invalid Bedrock version evidence");
  return {
    containerState: state,
    containerHealth: optionalText(body.containerHealth, /^(starting|healthy|unhealthy)$/),
    containerRestartPolicy: restartPolicy ?? null,
    containerImage: optionalText(body.containerImage, /^[A-Za-z0-9_.:/@-]{1,256}$/),
    containerCreatedAt: optionalInstant(body.containerCreatedAt, capture),
    containerStartedAt: startedAt,
    containerUptimeSeconds: uptime,
    containerCpuPercent: cpu,
    containerMemoryBytes: memory,
    containerMemoryLimitBytes: limit,
    containerStatsCapturedAt: statsAt,
    cpuUnit: body.cpuUnit,
    oomKilled: optionalBoolean(body.oomKilled),
    restartCount: optionalNumber(body.restartCount, Number.MAX_SAFE_INTEGER),
    version,
    versionCapturedAt,
    gameplayReady: null,
    playersOnline: null,
  };
}

function logs(body: Record<string, unknown>, capture: number): Record<string, unknown> {
  if (typeof body.available !== "boolean" || body.recentWindow !== true ||
      !Array.isArray(body.lines) || body.lines.length > 40 || (!body.available && body.lines.length))
    throw new Error("Invalid bounded Bedrock log snapshot");
  const duplicates = new Map<string, number>();
  return { available: body.available, recentWindow: true, lines: body.lines.map((line: unknown) => {
    if (!object(line) || (line.stream !== "stdout" && line.stream !== "stderr" && line.stream !== "combined") ||
        typeof line.content !== "string" || Buffer.byteLength(line.content, "utf8") > 2048 ||
        TERMINAL_CONTROL.test(line.content) || typeof line.truncated !== "boolean")
      throw new Error("Invalid Bedrock console line");
    const time = timestamp(line.capturedAt);
    if (time > capture + CLOCK_SKEW_MS || time < capture - LOG_WINDOW_MS - SAMPLE_AGE_MS)
      throw new Error("Bedrock log line outside its recent window");
    const id = createHash("sha256").update(JSON.stringify([line.capturedAt, line.stream, line.content])).digest("hex");
    const occurrence = duplicates.get(id) ?? 0;
    duplicates.set(id, occurrence + 1);
    return { id: `${id}-${occurrence}`, timestamp: line.capturedAt, content: line.content, stream: line.stream, truncated: line.truncated };
  }) };
}

function timestamp(value: unknown): number {
  const parsed = typeof value === "string" && INSTANT.test(value) ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(parsed)) throw new Error("Invalid Bedrock sample timestamp");
  return parsed;
}

function optionalInstant(value: unknown, capture: number): string | null {
  if (value == null) return null;
  if (timestamp(value) > capture + CLOCK_SKEW_MS) throw new Error("Bedrock timestamp is in the future");
  return value as string;
}

function optionalNumber(value: unknown, max: number, integer = true): number | null {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isSafeInteger(value)))
    throw new Error("Invalid Bedrock numeric field");
  return value;
}

function optionalText(value: unknown, pattern: RegExp): string | null {
  if (value == null) return null;
  if (typeof value !== "string" || !pattern.test(value)) throw new Error("Invalid Bedrock text field");
  return value;
}

function optionalBoolean(value: unknown): boolean | null {
  if (value == null) return null;
  if (typeof value !== "boolean") throw new Error("Invalid Bedrock boolean field");
  return value;
}

import type { JsonMap, Ready } from "./control-state";
import { FLEET_CONTRACT_ID, validFleetUuid } from "./fleet-contract";
import { ACTION_CONTRACT_ID, validScopes } from "./scopes";

const BEDROCK_CONTRACT = "bedrock-host-v1";
const STALE_MS = 30_000;
const FUTURE_SKEW_MS = 5_000;
const CONTAINER_STATES = new Set([
  "absent",
  "created",
  "running",
  "paused",
  "restarting",
  "removing",
  "exited",
  "dead",
  "unknown",
]);
const MAX_LOG_LINES = 80;

export interface BedrockIdentity {
  serverId: string;
  nodeId: string;
  instanceKey: "tonimbedrock";
}

export interface BedrockStatus {
  capturedAt: number;
  source: "DOCKER_ENGINE";
  containerState: string;
  containerStartedAt: number | null;
  containerUptimeSeconds: number | null;
  containerCpuPercent: number | null;
  containerMemoryBytes: number | null;
  containerMemoryLimitBytes: number | null;
  containerStatsCapturedAt: number | null;
  cpuUnit: "PERCENT_OF_ONE_CORE" | null;
  version: string | null;
  gameplayReady: boolean | null;
}

export interface BedrockLogs {
  capturedAt: number;
  available: boolean;
  lines: { id: string; timestamp: string; content: string }[];
}

export interface BedrockRoom {
  identity: BedrockIdentity;
  status?: BedrockStatus;
  logs?: BedrockLogs;
}

function object(value: unknown): JsonMap {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonMap)
    : {};
}

function timestamp(value: unknown): number | null {
  if (
    typeof value !== "string" ||
    value.length > 40 ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value)
  )
    return null;
  const time = Date.parse(value);
  return Number.isFinite(time) && time > 0 ? time : null;
}

function quantity(
  value: unknown,
  max = Number.MAX_SAFE_INTEGER,
): number | null {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= max
    ? value
    : null;
}

function whole(value: unknown, max = Number.MAX_SAFE_INTEGER): number | null {
  return Number.isSafeInteger(value) ? quantity(value, max) : null;
}

function sameIdentity(
  first: BedrockIdentity,
  second: BedrockIdentity,
): boolean {
  return (
    first.serverId === second.serverId &&
    first.nodeId === second.nodeId &&
    first.instanceKey === second.instanceKey
  );
}

/** Undefined is a legacy room; null is an invalid Bedrock declaration. */
export function bedrockReadyIdentity(
  message: JsonMap,
): BedrockIdentity | null | undefined {
  const server = object(message.server);
  if (
    server.edition !== "BEDROCK" &&
    server.runtime !== "DOCKER" &&
    server.roomMode !== "HOST_ONLY"
  )
    return undefined;
  const agents = object(message.agents);
  if (
    message.protocolVersion !== 3 ||
    message.actionContract !== ACTION_CONTRACT_ID ||
    server.edition !== "BEDROCK" ||
    server.runtime !== "DOCKER" ||
    server.roomMode !== "HOST_ONLY" ||
    server.fleetContract !== FLEET_CONTRACT_ID ||
    server.bedrockContract !== BEDROCK_CONTRACT ||
    message.version !== BEDROCK_CONTRACT ||
    !validFleetUuid(message.serverId) ||
    server.serverId !== message.serverId ||
    !validFleetUuid(server.nodeId) ||
    server.instanceKey !== "tonimbedrock" ||
    !validScopes(object(message.device).scopes) ||
    typeof server.serverName !== "string" ||
    !server.serverName.trim() ||
    server.serverName.length > 64 ||
    /[\u0000-\u001f\u007f-\u009f]/.test(server.serverName) ||
    agents.paper !== false ||
    agents.hostInstalled !== true ||
    typeof agents.host !== "boolean" ||
    server.paperSession != null ||
    (agents.host &&
      (typeof server.hostSession !== "string" ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(server.hostSession)))
  )
    return null;
  return {
    serverId: message.serverId,
    nodeId: server.nodeId,
    instanceKey: server.instanceKey,
  };
}

export function acceptsBedrockReady(
  room: BedrockRoom | undefined,
  message: JsonMap,
): boolean {
  const identity = bedrockReadyIdentity(message);
  return room
    ? identity != null && sameIdentity(room.identity, identity)
    : identity !== null;
}

export function hasBedrockRead(
  ready: Ready | null,
  scope: "server.status" | "console.view.full",
): boolean {
  return Boolean(
    ready?.agents.host &&
    ready.device.scopes.includes(scope) &&
    ready.server.hostCapabilities?.[scope] === true,
  );
}

export function retainBedrockRead(
  room: BedrockRoom,
  previousReady: Ready | null,
  ready: Ready,
): BedrockRoom {
  const sameSession =
    ready.agents.host &&
    previousReady?.agents.host &&
    ready.server.hostSession === previousReady.server.hostSession;
  return {
    identity: room.identity,
    status:
      sameSession && hasBedrockRead(ready, "server.status")
        ? room.status
        : undefined,
    logs:
      sameSession && hasBedrockRead(ready, "console.view.full")
        ? room.logs
        : undefined,
  };
}

export function currentBedrockCapture(
  capturedAt: number,
  now: number,
  maxAge = STALE_MS,
): boolean {
  return (
    Number.isFinite(now) &&
    Number.isFinite(capturedAt) &&
    Number.isFinite(maxAge) &&
    maxAge > 0 &&
    capturedAt <= now + FUTURE_SKEW_MS &&
    now - capturedAt <= maxAge
  );
}

export function applyBedrockEvent(
  room: BedrockRoom,
  ready: Ready | null,
  message: JsonMap,
  now: number,
): BedrockRoom {
  if (
    !ready?.agents.host ||
    message.agentKind !== "HOST" ||
    message.agentSession !== ready.server.hostSession ||
    message.serverId !== room.identity.serverId
  )
    return room;

  const body = object(message.body);
  if (
    body.bedrockContract !== BEDROCK_CONTRACT ||
    body.edition !== "BEDROCK" ||
    body.runtime !== "DOCKER" ||
    body.source !== "DOCKER_ENGINE" ||
    body.nodeId !== room.identity.nodeId ||
    body.instanceKey !== room.identity.instanceKey
  )
    return room;

  const capturedAt = timestamp(body.capturedAt);
  if (capturedAt === null || !currentBedrockCapture(capturedAt, now))
    return room;
  if (
    message.eventType === "bedrock.status" &&
    hasBedrockRead(ready, "server.status")
  ) {
    if (
      (room.status && capturedAt <= room.status.capturedAt) ||
      typeof body.containerState !== "string" ||
      !CONTAINER_STATES.has(body.containerState)
    )
      return room;
    const startedAt = timestamp(body.containerStartedAt);
    const statsCapturedAt = timestamp(body.containerStatsCapturedAt);
    const versionCapturedAt = timestamp(body.versionCapturedAt);
    const running = body.containerState === "running";
    const statsCurrent =
      running &&
      statsCapturedAt !== null &&
      statsCapturedAt <= capturedAt + FUTURE_SKEW_MS &&
      (startedAt === null || statsCapturedAt >= startedAt);
    const validStart =
      startedAt !== null && startedAt <= capturedAt + FUTURE_SKEW_MS;
    const memoryLimit = whole(body.containerMemoryLimitBytes);
    const memory = whole(body.containerMemoryBytes);
    return {
      ...room,
      status: {
        capturedAt,
        source: body.source,
        containerState: body.containerState,
        containerStartedAt: validStart ? startedAt : null,
        containerUptimeSeconds:
          running && validStart
            ? whole(
                body.containerUptimeSeconds,
                Math.floor((capturedAt - startedAt + FUTURE_SKEW_MS) / 1_000),
              )
            : null,
        cpuUnit: body.cpuUnit === "PERCENT_OF_ONE_CORE" ? body.cpuUnit : null,
        containerCpuPercent:
          statsCurrent && body.cpuUnit === "PERCENT_OF_ONE_CORE"
            ? quantity(body.containerCpuPercent, 6400)
            : null,
        containerMemoryBytes:
          statsCurrent &&
          (memoryLimit === null || memory === null || memory <= memoryLimit)
            ? memory
            : null,
        containerMemoryLimitBytes: statsCurrent ? memoryLimit : null,
        containerStatsCapturedAt: statsCurrent ? statsCapturedAt : null,
        version:
          running &&
          validStart &&
          versionCapturedAt !== null &&
          versionCapturedAt >= startedAt &&
          versionCapturedAt <= capturedAt + FUTURE_SKEW_MS &&
          typeof body.version === "string" &&
          /^1(?:\.\d{1,3}){2,3}$/.test(body.version)
            ? body.version
            : null,
        gameplayReady:
          running && typeof body.gameplayReady === "boolean"
            ? body.gameplayReady
            : null,
      },
    };
  }
  if (
    message.eventType === "bedrock.logs" &&
    hasBedrockRead(ready, "console.view.full")
  ) {
    if (
      (room.logs && capturedAt <= room.logs.capturedAt) ||
      typeof body.available !== "boolean" ||
      body.recentWindow !== true ||
      !Array.isArray(body.lines) ||
      body.lines.length > MAX_LOG_LINES
    )
      return room;
    const ids = new Set<string>();
    const lines = [];
    for (const data of body.available ? body.lines : []) {
      const line = object(data);
      const time = timestamp(line.timestamp);
      if (
        typeof line.id !== "string" ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(line.id) ||
        ids.has(line.id) ||
        time === null ||
        time > capturedAt + FUTURE_SKEW_MS ||
        typeof line.timestamp !== "string" ||
        typeof line.content !== "string" ||
        line.content.length > 4096 ||
        /[\u0000-\u0008\u000a-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(
          line.content,
        )
      )
        continue;
      ids.add(line.id);
      lines.push({
        id: line.id,
        timestamp: line.timestamp,
        content: line.content,
      });
    }
    return { ...room, logs: { capturedAt, available: body.available, lines } };
  }
  return room;
}

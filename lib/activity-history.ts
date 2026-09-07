export type PresenceHistoryState = "JOINED" | "LEFT";

export interface PresenceHistoryEvent {
  eventId: string;
  uuid: string;
  name: string;
  state: PresenceHistoryState;
  observedAt: string;
  recordedAt: number;
}

const STORAGE_PREFIX = "plexonpanel.activity-history.v1:";
const MAX_EVENTS = 5000;
const MAX_SESSION_TRACKING = 32;
const CHANGE_EVENT = "plexonpanel:activity-history-changed";
const paperSessions = new Map<string, string>();

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function key(serverId: string): string {
  return `${STORAGE_PREFIX}${serverId}`;
}

function boundedString(value: unknown, maximum: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= maximum
    ? value
    : null;
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function rememberPaperSession(serverId: string, session: string | null): void {
  if (!session) {
    paperSessions.delete(serverId);
    return;
  }
  if (!paperSessions.has(serverId) && paperSessions.size >= MAX_SESSION_TRACKING) {
    const oldest = paperSessions.keys().next().value as string | undefined;
    if (oldest) paperSessions.delete(oldest);
  }
  paperSessions.set(serverId, session);
}

function normalizeEvent(value: unknown): PresenceHistoryEvent | null {
  const source = object(value);
  if (!source) return null;
  const eventId = boundedString(source.eventId, 160);
  const uuid = boundedString(source.uuid, 64);
  const name = boundedString(source.name, 64);
  const observedAt = boundedString(source.observedAt, 64);
  const state = source.state;
  const recordedAt =
    typeof source.recordedAt === "number" && Number.isFinite(source.recordedAt)
      ? source.recordedAt
      : observedAt
        ? Date.parse(observedAt)
        : NaN;

  if (
    !eventId ||
    !uuid ||
    !name ||
    !observedAt ||
    (state !== "JOINED" && state !== "LEFT") ||
    !Number.isFinite(Date.parse(observedAt)) ||
    !Number.isFinite(recordedAt)
  )
    return null;

  return { eventId, uuid, name, state, observedAt, recordedAt };
}

function read(serverId: string): PresenceHistoryEvent[] {
  const local = storage();
  if (!local || !serverId) return [];
  try {
    const parsed = JSON.parse(local.getItem(key(serverId)) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeEvent)
      .filter((event): event is PresenceHistoryEvent => event !== null)
      .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
      .slice(-MAX_EVENTS);
  } catch {
    return [];
  }
}

function announce(serverId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CHANGE_EVENT, {
      detail: { serverId },
    }),
  );
}

function write(serverId: string, events: PresenceHistoryEvent[]): void {
  const local = storage();
  if (!local || !serverId) return;
  let retained = events.slice(-MAX_EVENTS);
  while (retained.length) {
    try {
      local.setItem(key(serverId), JSON.stringify(retained));
      announce(serverId);
      return;
    } catch {
      if (retained.length <= 250) return;
      retained = retained.slice(Math.ceil(retained.length * 0.25));
    }
  }
}

export function loadActivityHistory(serverId: string): PresenceHistoryEvent[] {
  return read(serverId);
}

export function clearActivityHistory(serverId: string): void {
  const local = storage();
  if (!local || !serverId) return;
  try {
    local.removeItem(key(serverId));
    announce(serverId);
  } catch {
    // Browser storage is best-effort and must never affect live dashboard operation.
  }
}

export function listActivityHistoryServers(): string[] {
  const local = storage();
  if (!local) return [];
  const result: string[] = [];
  try {
    for (let index = 0; index < local.length; index += 1) {
      const candidate = local.key(index);
      if (candidate?.startsWith(STORAGE_PREFIX)) {
        const serverId = candidate.slice(STORAGE_PREFIX.length);
        if (serverId) result.push(serverId);
      }
    }
  } catch {
    return [];
  }
  return result.sort();
}

export function capturePresenceHistoryMessage(
  message: Record<string, unknown>,
): void {
  const serverId = boundedString(message.serverId, 128);
  if (!serverId) return;

  if (message.type === "dashboard.ready") {
    if (message.protocolVersion !== 3) return;
    const server = object(message.server);
    rememberPaperSession(
      serverId,
      server ? boundedString(server.paperSession, 160) : null,
    );
    return;
  }

  if (
    message.type !== "server.event" ||
    message.eventType !== "players.presence" ||
    message.agentKind === "HOST"
  )
    return;

  const expectedPaperSession = paperSessions.get(serverId);
  if (
    expectedPaperSession &&
    boundedString(message.agentSession, 160) !== expectedPaperSession
  )
    return;

  const body = object(message.body);
  if (!body) return;

  const event = normalizeEvent({
    eventId: body.eventId,
    uuid: body.uuid,
    name: body.name,
    state: body.state,
    observedAt: body.observedAt,
    recordedAt: Date.now(),
  });
  if (!event) return;

  const current = read(serverId);
  if (current.some((item) => item.eventId === event.eventId)) return;
  write(serverId, [...current, event]);
}

export function subscribeActivityHistory(
  serverId: string,
  listener: () => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<{ serverId?: string }>).detail;
    if (detail?.serverId === serverId) listener();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === key(serverId)) listener();
  };
  window.addEventListener(CHANGE_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

export const ACTIVITY_HISTORY_MAX_EVENTS = MAX_EVENTS;

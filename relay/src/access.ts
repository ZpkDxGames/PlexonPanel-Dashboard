import type { DashboardAccess } from "./security.js";
import { validScopes } from "./scopes.js";
import type { StoredDevice, StoredRoom } from "./standalone/persistence.js";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validDevice(value: unknown): value is StoredDevice {
  if (!isRecord(value)) return false;
  return (
    typeof value.deviceId === "string" &&
    UUID.test(value.deviceId) &&
    typeof value.name === "string" &&
    value.name.length <= 64 &&
    typeof value.role === "string" &&
    /^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(value.role) &&
    validScopes(value.scopes) &&
    Number.isSafeInteger(value.issuedAt) &&
    Number.isSafeInteger(value.expiresAt) &&
    Number(value.expiresAt) > Number(value.issuedAt) &&
    Number(value.expiresAt) - Number(value.issuedAt) <= 2592000
  );
}
export function currentAccess(
  m: Pick<StoredRoom, "generation" | "devices">,
  access: DashboardAccess | undefined,
): boolean {
  if (
    !access ||
    !validScopes(access.scopes) ||
    access.protocolVersion !== 3 ||
    access.generation !== m.generation ||
    access.expiresAt * 1000 <= Date.now()
  )
    return false;
  return m.devices.some(
    (d) =>
      d.deviceId === access.deviceId &&
      d.role === access.role &&
      d.expiresAt === access.expiresAt &&
      d.issuedAt === access.issuedAt &&
      [...d.scopes].sort().join() === [...access.scopes].sort().join(),
  );
}
export function filterEvent(
  type: string,
  body: Record<string, unknown>,
  scopes: string[],
  caps: Record<string, boolean>,
): Record<string, unknown> | null {
  const has = (scope: string) => scopes.includes(scope) && caps[scope] === true;
  if (type.startsWith("telemetry.")) return has("telemetry.view") ? body : null;
  if (type === "service.status") return has("server.status") ? body : null;
  if (type === "backup.progress") return has("backup.view") ? body : null;
  if (type === "inventory.plugins") return has("plugins.view") ? body : null;
  if (type === "chat.message") return has("chat.view") ? body : null;
  if (type === "console.lines") {
    if (!has("console.view.full") && !has("console.view.errors")) return null;
    const lines = Array.isArray(body.lines)
      ? body.lines
          .slice(0, 100)
          .filter(
            (line) =>
              isRecord(line) &&
              (has("console.view.full") ||
                line.level === "WARN" ||
                line.level === "ERROR" ||
                line.level === "SEVERE"),
          )
      : [];
    return { ...body, lines };
  }
  if (type === "inventory.players") {
    if (!has("players.view")) return null;
    const players = Array.isArray(body.players)
      ? body.players
          .slice(0, 512)
          .filter(isRecord)
          .map((p) => {
            const copy = { ...p };
            if (!has("players.address")) delete copy.address;
            if (!has("players.location")) delete copy.position;
            if (!has("players.history.view")) {
              delete copy.firstSeenAt;
              delete copy.lastLoginAt;
            }
            return copy;
          })
      : [];
    return { ...body, players };
  }
  if (type === "players.presence") {
    if (!has("players.view")) return null;
    const copy = { ...body };
    if (!has("players.history.view")) {
      delete copy.sessionStartedAt;
      delete copy.sessionEndedAt;
      delete copy.sessionDurationMillis;
      delete copy.termination;
      delete copy.persistenceState;
    }
    return copy;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

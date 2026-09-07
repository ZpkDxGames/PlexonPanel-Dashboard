import type { JsonMap } from "./control-state";

const IMMEDIATE_EVENT_TYPES = new Set([
  "service.status",
  "backup.progress",
  "players.presence",
  "console.lines",
  "chat.message",
  "action.result",
]);

/**
 * Browser display throttling applies only to presentation-heavy state.
 * Operational streams, presence, lifecycle, and action state must remain immediate.
 */
export function isImmediateControlMessage(message: JsonMap): boolean {
  if (message.type === "dashboard.ready") return true;
  return (
    message.type === "server.event" &&
    typeof message.eventType === "string" &&
    IMMEDIATE_EVENT_TYPES.has(message.eventType)
  );
}

export function displayRateLabel(milliseconds: number): string {
  if (milliseconds === 0) return "Realtime";
  if (milliseconds < 1000) return `${milliseconds} ms`;
  const seconds = milliseconds / 1000;
  return `${Number.isInteger(seconds) ? seconds.toFixed(0) : seconds} s`;
}

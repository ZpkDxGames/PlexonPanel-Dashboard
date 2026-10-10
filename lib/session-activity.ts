import { ACTION_SCOPES } from "./scopes";

export const SESSION_ACTIVITY_LIMIT = 50;
export type SessionActivityInput =
  | { kind: "connection"; serverId: string; relay: "connecting" | "live" | "reconnecting"; paper: boolean | null; host: boolean | null }
  | { kind: "action"; serverId: string; action: string; authority: "PAPER" | "HOST"; status: string; code?: string }
  | { kind: "backup-phase"; serverId: string; jobId: string; phase: string };
export type SessionActivity = SessionActivityInput & { sequence: number; observedAt: number };
const phases = new Set(["QUEUED", "PREFLIGHT", "COUNTDOWN", "FINAL_SAVE", "STOPPING_SERVER", "WAITING_FOR_STOP", "ARCHIVING", "HASHING", "VERIFYING_LOCAL", "UPLOADING_REMOTE", "VERIFYING_REMOTE", "CLEANING_LOCAL", "STARTING_SERVER", "VERIFYING_STARTUP", "COMPLETED", "DEGRADED", "FAILED", "RECOVERY_REQUIRED"]);
const codes = new Set(["OK", "BUSY", "SCOPE_DENIED", "CAPABILITY_DISABLED", "STALE_FILE", "RCLONE_UNAVAILABLE", "RCLONE_TEST_FAILED", "BACKUP_SOURCE_UNREADABLE", "SERVER_MUST_BE_STOPPED"]);
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/** Copy an explicit metadata allowlist; never retain parameters, messages or content. */
export function appendSessionActivity(entries: readonly SessionActivity[], input: SessionActivityInput, observedAt: number): SessionActivity[] {
  if (!uuid.test(input.serverId) || !Number.isFinite(observedAt)) return [...entries];
  let safe: SessionActivityInput;
  if (input.kind === "action") {
    if (!Object.hasOwn(ACTION_SCOPES, input.action)) return [...entries];
    safe = { kind: input.kind, serverId: input.serverId, action: input.action, authority: input.authority, status: ["SUCCESS", "FAILED", "DENIED", "CONFLICT"].includes(input.status) ? input.status : "UNKNOWN", ...(input.code && codes.has(input.code) ? { code: input.code } : {}) };
  } else if (input.kind === "backup-phase") {
    if (!uuid.test(input.jobId) || !phases.has(input.phase)) return [...entries];
    safe = { kind: input.kind, serverId: input.serverId, jobId: input.jobId, phase: input.phase };
  } else {
    if (!["connecting", "live", "reconnecting"].includes(input.relay) || ![null, true, false].includes(input.paper) || ![null, true, false].includes(input.host)) return [...entries];
    safe = { kind: input.kind, serverId: input.serverId, relay: input.relay, paper: input.paper, host: input.host };
  }
  const last = entries.at(-1);
  // Do not repeat an unchanged source snapshot. Local sequence is not an audit ID.
  if (input.kind !== "action" && last && JSON.stringify(Object.fromEntries(Object.entries(last).filter(([key]) => !["sequence", "observedAt"].includes(key)))) === JSON.stringify(safe)) return [...entries];
  return [...entries, { ...safe, sequence: (last?.sequence ?? 0) + 1, observedAt }].slice(-SESSION_ACTIVITY_LIMIT);
}

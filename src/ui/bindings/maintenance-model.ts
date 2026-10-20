export type CountdownKind = "BACKUP" | "RESTART" | "STOP";
export interface MaintenanceView {
  recoveryRequired: boolean;
  countdownState: "IDLE" | "ACTIVE";
  countdownKind: CountdownKind | null;
  remainingAtSnapshot: number | null;
  snapshotAt: number;
  jobBusy: boolean;
}
export function normalizeMaintenance(raw: unknown, nowPerf = performance.now(), nowWall = Date.now()): MaintenanceView {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const job = r.currentOperation && typeof r.currentOperation === "object" ? r.currentOperation as Record<string, unknown> : {};
  const active = r.countdownState === "ACTIVE";
  let remaining = typeof r.countdownRemainingSeconds === "number" && Number.isFinite(r.countdownRemainingSeconds)
    ? Math.max(0, Math.floor(r.countdownRemainingSeconds)) : null;
  const deadline = r.countdownEndsAt ?? r.countdownDeadline;
  if (remaining === null && active && typeof deadline === "string") {
    const ms = Date.parse(deadline) - nowWall;
    remaining = Number.isFinite(ms) ? Math.max(0, Math.round(ms / 1000)) : null;
  }
  const kind = r.countdownKind === "BACKUP" || r.countdownKind === "RESTART" || r.countdownKind === "STOP"
    ? r.countdownKind : job.kind === "FULL_RESTORE_POINT" ? "BACKUP" : job.kind === "RESTART" ? "RESTART" : null;
  const phase = String(job.phase ?? "IDLE");
  return {
    recoveryRequired: r.recoveryRequired === true || r.jobRecoveryRequired === true || r.restoreRecoveryRequired === true || phase === "RECOVERY_REQUIRED",
    countdownState: active ? "ACTIVE" : "IDLE", countdownKind: active ? kind : null,
    remainingAtSnapshot: active ? remaining : null, snapshotAt: nowPerf,
    jobBusy: active || !["", "IDLE", "FAILED", "COMPLETED", "DONE", "DEGRADED", "RECOVERY_REQUIRED"].includes(phase),
  };
}
export const remainingCountdown = (snap: MaintenanceView, nowPerf: number): number | null =>
  snap.countdownState === "ACTIVE" && snap.remainingAtSnapshot !== null
    ? Math.max(0, snap.remainingAtSnapshot - Math.max(0, Math.floor((nowPerf - snap.snapshotAt) / 1000))) : null;
export const formatMmSs = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

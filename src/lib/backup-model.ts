import { number, record, str, type JsonMap } from "../adapter/control-state";

export type BackupHealth =
  | "offline"
  | "checking"
  | "ready"
  | "running"
  | "verifying"
  | "degraded"
  | "failed"
  | "recovery"
  | "blocked";

export type BackupTimelineStep = {
  key: string;
  label: string;
  detail: string;
  minProgress: number;
  phases: readonly string[];
};

export const BACKUP_TIMELINE: readonly BackupTimelineStep[] = [
  {
    key: "preflight",
    label: "Preflight",
    detail: "Validate sources, storage, provider and command channel.",
    minProgress: 5,
    phases: ["QUEUED", "PREFLIGHT"],
  },
  {
    key: "countdown",
    label: "Countdown",
    detail: "Warn players using the Host-owned durable countdown.",
    minProgress: 10,
    phases: ["COUNTDOWN"],
  },
  {
    key: "save",
    label: "Final save",
    detail: "Require a successful save-all flush before shutdown.",
    minProgress: 25,
    phases: ["FINAL_SAVE"],
  },
  {
    key: "stop",
    label: "Stop server",
    detail: "Stop the exact systemd unit and prove it is inactive.",
    minProgress: 35,
    phases: ["STOPPING_SERVER", "WAITING_FOR_STOP"],
  },
  {
    key: "local",
    label: "Local archive",
    detail: "Create the cold ZIP, hash it and verify local integrity.",
    minProgress: 50,
    phases: ["ARCHIVING", "HASHING", "VERIFYING_LOCAL"],
  },
  {
    key: "offsite",
    label: "Offsite verify",
    detail: "Upload, verify promotion and release the temporary local ZIP.",
    minProgress: 75,
    phases: ["UPLOADING_REMOTE", "VERIFYING_REMOTE", "CLEANING_LOCAL"],
  },
  {
    key: "restart",
    label: "Restart",
    detail: "Restore Minecraft availability and verify readiness.",
    minProgress: 85,
    phases: ["STARTING_SERVER", "VERIFYING_STARTUP"],
  },
  {
    key: "complete",
    label: "Complete",
    detail: "Persist the final verified backup outcome.",
    minProgress: 100,
    phases: ["COMPLETED", "DEGRADED", "FAILED", "RECOVERY_REQUIRED"],
  },
] as const;

const TERMINAL = new Set([
  "COMPLETED",
  "DEGRADED",
  "FAILED",
  "RECOVERY_REQUIRED",
]);

export function isTerminalBackupPhase(phase: string) {
  return TERMINAL.has(phase);
}

function progressBelongsToOperation(
  operation: JsonMap,
  progress: JsonMap | null | undefined,
) {
  const operationJob = str(operation.jobId, "");
  const operationBackup = str(operation.backupId, "");
  const progressJob = str(progress?.jobId, "");
  const progressBackup = str(progress?.backupId, "");
  if (operationJob && progressJob === operationJob) {
    const phaseAt = Date.parse(
      str(operation.phaseTimestamp ?? operation.updatedAt, ""),
    );
    const progressAt = Date.parse(str(progress?.capturedAt, ""));
    return !(
      Number.isFinite(phaseAt) &&
      Number.isFinite(progressAt) &&
      progressAt < phaseAt
    );
  }

  // Retry Upload has its own transport jobId but intentionally reuses the original backupId.
  // Accept it only after a degraded terminal job; unrelated stale progress must never override it.
  if (
    str(operation.phase) === "DEGRADED" &&
    operationBackup &&
    progressBackup === operationBackup &&
    progressJob &&
    progressJob !== operationJob
  ) {
    const completed = Date.parse(str(operation.completedAt));
    const captured = Date.parse(str(progress?.capturedAt));
    return (
      !Number.isFinite(completed) ||
      (Number.isFinite(captured) && captured >= completed)
    );
  }

  return false;
}

export function effectiveBackupPhase(
  operation: JsonMap,
  progress: JsonMap | null | undefined,
): string {
  const durable = str(operation.phase, "IDLE");
  const progressPhase = str(progress?.phase, "");
  if (isTerminalBackupPhase(durable)) return durable;

  if (progressPhase && progressBelongsToOperation(operation, progress))
    return progressPhase;

  return durable;
}

export function effectiveBackupProgress(
  operation: JsonMap,
  progress: JsonMap | null | undefined,
): number {
  if (isTerminalBackupPhase(str(operation.phase, "")))
    return number(operation.progressPercent) ?? 0;
  const live = number(progress?.progress);
  if (live !== null && progressBelongsToOperation(operation, progress))
    return Math.max(0, Math.min(100, live * 100));
  return Math.max(0, Math.min(100, number(operation.progressPercent) ?? 0));
}

export function backupRecoveryRequired(
  preflight: JsonMap,
  maintenance: JsonMap,
  operation: JsonMap,
): boolean {
  return (
    preflight.recoveryRequired === true ||
    maintenance.jobRecoveryRequired === true ||
    maintenance.restoreRecoveryRequired === true ||
    operation.restartRecoveryRequired === true ||
    str(operation.phase) === "RECOVERY_REQUIRED"
  );
}

export function backupReady(
  preflight: JsonMap,
  maintenance: JsonMap,
  operation: JsonMap,
): boolean {
  return (
    preflight.hostAuthenticated === true &&
    preflight.operationBusy === false &&
    !backupRecoveryRequired(preflight, maintenance, operation) &&
    preflight.backupRootWritable === true &&
    preflight.commandChannelConfigured === true &&
    preflight.hostConfigRestartRequired !== true
  );
}

export function retryUploadAvailable(operation: JsonMap): boolean {
  return (
    str(operation.phase) === "DEGRADED" &&
    operation.localBackupVerified === true &&
    operation.remoteBackupVerified !== true &&
    Boolean(str(operation.backupId, ""))
  );
}

export function backupHealth({
  hostLive,
  ready,
  recovery,
  operation,
}: {
  hostLive: boolean;
  ready: boolean;
  recovery: boolean;
  operation: JsonMap;
}): BackupHealth {
  if (!hostLive) return "offline";
  if (recovery) return "recovery";
  const phase = str(operation.phase, "IDLE");
  if (phase === "DEGRADED") return "degraded";
  if (phase === "FAILED") return "failed";
  if (
    phase !== "IDLE" &&
    phase !== "COMPLETED" &&
    !isTerminalBackupPhase(phase)
  )
    return "running";
  return ready ? "ready" : "blocked";
}

export function stepState(
  step: BackupTimelineStep,
  phase: string,
  progressPercent: number,
  operation: JsonMap,
): "pending" | "active" | "done" | "warning" | "error" {
  const terminal = str(operation.phase);
  const stepIndex = BACKUP_TIMELINE.findIndex(
    (candidate) => candidate.key === step.key,
  );
  const activeIndex = BACKUP_TIMELINE.findIndex((candidate) =>
    candidate.phases.includes(phase),
  );

  if (terminal === "COMPLETED") return "done";

  if (terminal === "DEGRADED") {
    if (step.key === "offsite" || step.key === "complete") return "warning";
    if (step.key === "restart")
      return operation.restartRecoveryRequired ? "error" : "done";
    return stepIndex < 5 ? "done" : "pending";
  }

  if (terminal === "FAILED" || terminal === "RECOVERY_REQUIRED") {
    const inferred = BACKUP_TIMELINE.findLastIndex(
      (candidate) => progressPercent >= candidate.minProgress,
    );
    if (stepIndex < inferred) return "done";
    if (stepIndex === inferred)
      return terminal === "RECOVERY_REQUIRED" ? "warning" : "error";
    return "pending";
  }

  if (activeIndex >= 0) {
    if (stepIndex < activeIndex) return "done";
    if (stepIndex === activeIndex) return "active";
    return "pending";
  }

  if (progressPercent >= step.minProgress) return "done";
  return "pending";
}

export function healthCopy(health: BackupHealth) {
  switch (health) {
    case "offline":
      return {
        title: "Host unavailable",
        description: "Reconnect the Host agent before managing restore points.",
      };
    case "checking":
      return {
        title: "Checking backup authority",
        description:
          "Waiting for the Host preflight, maintenance journal and restore-point inventory.",
      };
    case "verifying":
      return {
        title: "Verifying backup",
        description: "Waiting for the Host verification result.",
      };
    case "running":
      return {
        title: "Backup in progress",
        description:
          "The Host owns this job. Closing the browser will not cancel it.",
      };
    case "degraded":
      return {
        title: "Verified locally · offsite needs attention",
        description:
          "The local restore point is usable. Retry the offsite copy without another shutdown.",
      };
    case "failed":
      return {
        title: "Backup failed",
        description:
          "Minecraft was not reported as a complete backup. Review the failure before retrying.",
      };
    case "recovery":
      return {
        title: "Recovery required",
        description:
          "A durable recovery gate is blocking another destructive maintenance operation.",
      };
    case "blocked":
      return {
        title: "Backup blocked",
        description:
          "One or more Host preflight requirements are not currently satisfied.",
      };
    default:
      return {
        title: "Ready for a restore point",
        description:
          "Host preflight is healthy and no conflicting maintenance operation is active.",
      };
  }
}

export function phaseLabel(phase: string) {
  if (!phase || phase === "IDLE") return "Idle";
  return phase
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function durationLabel(
  startedAt: unknown,
  endedAt: unknown,
  now = Date.now(),
) {
  const start = Date.parse(str(startedAt));
  const end = Date.parse(str(endedAt));
  if (!Number.isFinite(start)) return "—";
  const duration = Math.max(0, (Number.isFinite(end) ? end : now) - start);
  if (duration < 60_000) return `${Math.max(1, Math.round(duration / 1000))}s`;
  const minutes = Math.floor(duration / 60_000);
  const seconds = Math.round((duration % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/** One presentation decision from current Host evidence; inventory never rewrites job outcome. */
export function backupView({
  hostLive,
  preflight,
  maintenance,
  phasePush,
  progress,
  backups,
  preflightFailure = "",
}: {
  hostLive: boolean;
  preflight: JsonMap;
  maintenance: JsonMap;
  phasePush: JsonMap;
  progress: JsonMap | null;
  backups: JsonMap[];
  preflightFailure?: string;
}) {
  const durable = record(maintenance.currentOperation);
  const durableTime = Date.parse(
    str(durable.updatedAt ?? durable.phaseTimestamp, ""),
  );
  const pushTime = Date.parse(str(phasePush.phaseTimestamp ?? phasePush.capturedAt, ""));
  const sameJob =
    Boolean(str(durable.jobId, "")) &&
    str(durable.jobId, "") === str(phasePush.jobId, "");
  const newer =
    Number.isFinite(pushTime) &&
    (!Number.isFinite(durableTime) || pushTime > durableTime);
  const hasPushJob = Boolean(str(phasePush.jobId, ""));
  const operation =
    hasPushJob && newer && (!sameJob || !isTerminalBackupPhase(str(durable.phase, "")))
      ? sameJob ? { ...durable, ...phasePush } : phasePush
      : durable;
  const known = ["hostAuthenticated","operationBusy","recoveryRequired","backupRootWritable","commandChannelConfigured","hostConfigRestartRequired"].every(key=>typeof preflight[key]==="boolean")
    && typeof maintenance.jobRecoveryRequired==="boolean" && typeof maintenance.restoreRecoveryRequired==="boolean";
  const recovery = backupRecoveryRequired(preflight, maintenance, operation);
  const ready = known && backupReady(preflight, maintenance, operation);
  const phase = effectiveBackupPhase(operation, progress);
  const active = phase !== "IDLE" && !isTerminalBackupPhase(phase);
  const health: BackupHealth = !hostLive
    ? "offline"
    : recovery
      ? "recovery"
      : active
        ? phase.startsWith("VERIFYING")
          ? "verifying"
          : "running"
        : ["FAILED", "DEGRADED"].includes(phase)
          ? backupHealth({ hostLive, ready, recovery, operation })
        : preflightFailure
          ? "failed"
        : !known
          ? "checking"
          : backupHealth({ hostLive, ready, recovery, operation });
  const backup = backups.find(
    (b) => str(b.backupId, "") !== "" && b.backupId === operation.backupId,
  );
  const resolvedAfterRetry =
    str(operation.phase, "") === "DEGRADED" && backup?.offsite === true;
  return {
    operation,
    phase,
    health,
    recovery,
    ready: hostLive && ready,
    active,
    progressPercent: effectiveBackupProgress(operation, progress),
    resolvedAfterRetry,
    retryAvailable:
      !resolvedAfterRetry &&
      retryUploadAvailable(operation) &&
      backup?.local === true,
  };
}

"use client";
import { useControl, useQuery, record, records, type JsonMap } from "./index";
import { useMaintenanceCountdown } from "./maintenance";
import { FALLBACK_STAGE_KEYS, FALLBACK_STAGE_LABELS } from "./backups-model";
export { useHostInvoke } from "./host-invoke";
const PHASE_STAGE: Record<string, number> = {
  QUEUED: 1,
  PREFLIGHT: 1,
  PREPARING: 1,
  COUNTDOWN: 4,
  FINAL_SAVE: 5,
  FLUSHING: 5,
  STOPPING: 6,
  STOPPING_SERVER: 6,
  WAITING_FOR_STOP: 7,
  BUILD_MANIFEST: 8,
  ARCHIVING: 9,
  ARCHIVE_PARTIAL: 9,
  FINALIZE_ARCHIVE: 10,
  HASHING: 11,
  VERIFYING_LOCAL: 11,
  VERIFYING: 11,
  UPLOADING: 12,
  UPLOADING_REMOTE: 12,
  REMOTE_VERIFYING: 13,
  VERIFYING_REMOTE: 13,
  STARTING: 14,
  STARTING_SERVER: 14,
  VERIFYING_STARTUP: 14,
  COMPLETED: 15,
  DEGRADED: 13,
};
/** Existing scoped control state and Host queries, projected without editing locked selectors. */
export function useBackupsVm() {
  const { state } = useControl(),
    maintenance = useMaintenanceCountdown(),
    history = useQuery("backup.full.list"),
    settings = record(maintenance.config.data.settings),
    full = record(settings.fullRestorePoint),
    schedule = record(full.schedule),
    operation = {
      ...record(state.maintenancePhase),
      ...record(maintenance.statusData.currentOperation),
      ...record(maintenance.statusData.job),
    },
    phase = String(operation.phase ?? "IDLE"),
    reported = records(
      operation.stages ??
        maintenance.statusData.stages ??
        maintenance.statusData.stageDefinitions,
      64,
    ),
    labels = reported.length
      ? reported.map((s, i) =>
          String(s.label ?? FALLBACK_STAGE_LABELS[i] ?? s.key ?? s.id),
        )
      : FALLBACK_STAGE_LABELS,
    stageKey = String(operation.stage ?? operation.stageId ?? ""),
    keyedIndex =
      (FALLBACK_STAGE_KEYS as readonly string[]).indexOf(stageKey) + 1,
    stageIndex =
      typeof operation.stageIndex === "number"
        ? operation.stageIndex
        : keyedIndex ||
          PHASE_STAGE[String(operation.failedStage ?? phase)] ||
          0,
    preflight = maintenance.preflight,
    jobState =
      preflight?.recoveryRequired || maintenance.recoveryRequired
        ? "RECOVERY_REQUIRED"
        : phase === "FAILED"
          ? "FAILED"
          : ["COMPLETED", "DEGRADED"].includes(phase)
            ? "DONE"
            : maintenance.jobBusy
              ? "ACTIVE"
              : "IDLE",
    points = records(history.data.backups, 200).map((b) => ({
      id: String(b.backupId ?? ""),
      createdAt: String(b.timestamp ?? ""),
      trigger: b.automatic ? "Periodic" : "Manual",
      sizeBytes: Number(b.archiveBytes ?? b.sizeBytes ?? 0),
      sha256:
        typeof b.sha256 === "string" && /^[0-9a-f]{64}$/i.test(b.sha256)
          ? b.sha256
          : null,
      local: b.local === true,
      offsite: b.offsite === true,
      verification: typeof b.verification === "string" ? b.verification : null,
    }));
  return {
    ...maintenance,
    settings,
    full,
    schedule,
    history,
    operation,
    phase,
    jobState,
    stageIndex,
    labels,
    skippedStages: Array.isArray(operation.skippedStages)
      ? operation.skippedStages.filter(
          (n): n is number => typeof n === "number",
        )
      : [],
    jobId: String(operation.jobId ?? ""),
    restorePoints: points,
    hostName: String(
      state.ready?.server.serverName ?? state.serverId ?? "Selected instance",
    ),
    hostOnline: state.service.state === "active",
    progress: record(state.backupProgress) as JsonMap,
  };
}

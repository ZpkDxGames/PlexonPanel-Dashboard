import type { ActionCompletion } from "../bindings";
import type { JsonMap } from "../bindings";
import {
  FALLBACK_STAGE_KEYS,
  FALLBACK_STAGE_LABELS,
} from "../bindings/backups-model";
export const DURABILITY_FIXTURES = [
  "backups-healthy",
  "backups-recovery-required",
  "backups-provider-not-configured",
  "backups-legacy-host",
  "backups-restore-recovery",
  "countdown-backup-active",
  "overview-one-player",
  "performance-live",
];
declare global {
  interface Window {
    __ppHostCalls?: { action: string; params: JsonMap }[];
  }
}
const stages = FALLBACK_STAGE_KEYS.map((key, i) => ({
  index: i + 1,
  key,
  id: key,
  label: FALLBACK_STAGE_LABELS[i],
}));
export function durabilityFixture(
  mode: string,
  fallback: (action: string, args: JsonMap) => Promise<ActionCompletion>,
) {
  let recovery =
      mode === "backups-recovery-required" ||
      mode === "backups-restore-recovery",
    restore = mode === "backups-restore-recovery",
    active = mode === "countdown-backup-active",
    total = 258;
  let saved: JsonMap | undefined;
  const legacy = mode === "backups-legacy-host",
    localOnly = mode === "backups-provider-not-configured";
  if (typeof window !== "undefined") window.__ppHostCalls = [];
  return async (action: string, params: JsonMap): Promise<ActionCompletion> => {
    window.__ppHostCalls?.push({ action, params: structuredClone(params) });
    const original = await fallback(action, params);
    if (!DURABILITY_FIXTURES.includes(mode) && mode !== "structural")
      return original;
    const out = (data: JsonMap): ActionCompletion => ({ ...original, data });
    if (action === "maintenance.settings.update")
      saved = params.settings as JsonMap;
    if (
      action === "maintenance.settings.get" ||
      action === "maintenance.settings.update"
    ) {
      const settings = structuredClone(
        saved ?? (original.data?.settings as JsonMap),
      );
      const full = settings.fullRestorePoint as JsonMap;
      if (!full.schedule)
        full.schedule = {
          enabled: true,
          type: "DAILY",
          weekdays: ["MONDAY"],
          time: "04:07",
          intervalHours: 24,
        };
      if (!saved)
        full.schedule = { ...(full.schedule as JsonMap), time: "04:07" };
      if (!legacy) full.allowLocalFallback = false;
      return out({ settings });
    }
    if (action === "backup.preflight") {
      if (legacy)
        return out({
          ok: true,
          providerStatus: "CONNECTED",
          hostAuthenticated: true,
          operationBusy: false,
          recoveryRequired: false,
        });
      return out({
        ok: !recovery && !localOnly,
        recoveryRequired: recovery,
        jobRecoveryRequired: recovery && !restore,
        restoreRecoveryRequired: restore,
        recoveryJob: recovery
          ? {
              jobId: "6efb490a-65c2-4d17-b0f0-4536d0524d42",
              kind: restore ? "RESTORE" : "FULL_RESTORE_POINT",
              stage: "Stop service",
              stageIndex: 6,
              errorCode: "STOP_TIMEOUT",
              errorMessage: "Service stop proof timed out.",
              updatedAt: "2026-10-19T23:40:00Z",
            }
          : null,
        sourceState: "READY",
        sourceBytes: 2.4 * 2 ** 30,
        entryCount: 18792,
        includes: ["world", "plugins", "config"],
        sourceErrorCode: null,
        storageState: "READY",
        backupRootWritable: true,
        usableBytes: 42 * 2 ** 30,
        requiredBytes: 5.05 * 2 ** 30,
        storageErrorCode: null,
        providerState: localOnly ? "NOT_CONFIGURED" : "CONNECTED",
        provider: "RCLONE",
        remote: "gdrive:PlexonCraft",
        providerErrorCode: localOnly ? "RCLONE_UNAVAILABLE" : null,
        providerMessage: localOnly
          ? "Off-site provider is not configured on this Host."
          : null,
        localBackupReady: !recovery,
        offsiteBackupReady: !recovery && !localOnly,
        operationBusy: active,
      });
    }
    if (action === "maintenance.recovery.resolve") {
      if (restore && params.acknowledgeRestore !== true)
        return {
          ...original,
          status: "FAILED",
          code: "RESTORE_RECOVERY_REQUIRES_REVIEW",
        };
      recovery = false;
      restore = false;
      return out({ resolved: true });
    }
    if (action === "backup.create") {
      active = true;
      total = Number(params.countdownSeconds ?? 300);
      return out({ jobId: "fixture-backup-v60", state: "QUEUED" });
    }
    if (action === "maintenance.status")
      return out({
        countdownState: active ? "ACTIVE" : "IDLE",
        countdownKind: active ? "BACKUP" : null,
        countdownRemainingSeconds: active ? total : 0,
        recoveryRequired: recovery,
        jobRecoveryRequired: recovery && !restore,
        restoreRecoveryRequired: restore,
        stages,
        stageDefinitions: stages,
        nextFullRestorePoint: "2026-10-20T07:07:00Z",
        nextRestart: "2026-10-20T07:00:00Z",
        currentOperation: recovery
          ? {
              jobId: "6efb490a-65c2-4d17-b0f0-4536d0524d42",
              kind: "FULL_RESTORE_POINT",
              phase: "RECOVERY_REQUIRED",
              stageIndex: 6,
              errorCode: "STOP_TIMEOUT",
            }
          : active
            ? {
                jobId: "fixture-backup-v60",
                kind: "FULL_RESTORE_POINT",
                phase: "COUNTDOWN",
                stageIndex: 4,
              }
            : null,
      });
    if (action === "backup.full.list")
      return out({
        backups: [
          {
            backupId: "8667ba71-b85a-4004-af54-457a9734eed7",
            timestamp: "2026-10-19T18:30:00Z",
            automatic: false,
            archiveBytes: 2.4 * 2 ** 30,
            local: true,
            offsite: false,
            verification: "VERIFIED_LOCAL",
            sha256: "a".repeat(64),
          },
          {
            backupId: "19f50206-26de-410c-a1bc-000000000024",
            timestamp: "2026-10-18T18:30:00Z",
            automatic: true,
            archiveBytes: 2.3 * 2 ** 30,
            local: true,
            offsite: true,
            verification: "VERIFIED_REMOTE",
            sha256: "b".repeat(64),
          },
        ],
      });
    return original;
  };
}

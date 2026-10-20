// ─── Host contract (mirrors §1.1 PreflightReport.toMap) ───────────────────
export type Readiness = "READY" | "FAILED";
export type ProviderState = "CONNECTED" | "NOT_CONFIGURED" | "FAILED";
export type DestinationMode = "AUTO" | "DRIVE_AND_LOCAL" | "LOCAL_ONLY";

export interface PreflightView {
  legacyHost: boolean;                 // true when the Host predates v6.0 (no localBackupReady)
  recoveryRequired: boolean;
  jobRecoveryRequired: boolean;
  restoreRecoveryRequired: boolean;
  recoveryJob: null | {
    jobId: string; kind: string; stage: string; stageIndex: number;
    errorCode: string | null; errorMessage: string | null; updatedAt: string | null;
  };
  sourceState: Readiness; sourceBytes: number; entryCount: number; includes: string[]; sourceErrorCode: string | null;
  storageState: Readiness; backupRootWritable: boolean; usableBytes: number; requiredBytes: number; storageErrorCode: string | null;
  providerState: ProviderState; provider: string | null; remote: string | null;
  providerErrorCode: string | null; providerMessage: string | null;
  localBackupReady: boolean; offsiteBackupReady: boolean;
}

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? Math.max(0,v) : 0);
const bool = (v: unknown): boolean => v === true;
const rd = (v: unknown): Readiness => (v === "READY" ? "READY" : "FAILED");
const ps = (v: unknown): ProviderState =>
  v === "CONNECTED" || v === "NOT_CONFIGURED" ? v : "FAILED";

/** Defensive: tolerates old Hosts and partial payloads. Never throws. */
export function normalizePreflight(raw: unknown): PreflightView | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const legacyHost = typeof r.localBackupReady !== "boolean";
  const j = r.recoveryJob && typeof r.recoveryJob === "object" && !Array.isArray(r.recoveryJob) ? r.recoveryJob as Record<string, unknown> : null;
  const recoveryRequired = bool(r.recoveryRequired);
  const sourceState = legacyHost ? "READY" : rd(r.sourceState);
  const storageState = legacyHost ? "READY" : rd(r.storageState);
  const providerState = ps(r.providerState ?? (r.providerStatus === "CONNECTED" ? "CONNECTED" : r.providerStatus === "LOCAL" ? "NOT_CONFIGURED" : "FAILED"));
  const localBackupReady = legacyHost ? false : bool(r.localBackupReady);
  return {
    legacyHost,
    recoveryRequired,
    jobRecoveryRequired: bool(r.jobRecoveryRequired),
    restoreRecoveryRequired: bool(r.restoreRecoveryRequired),
    recoveryJob: j && {
      jobId: String(j.jobId ?? ""), kind: String(j.kind ?? ""), stage: String(j.stage ?? ""),
      stageIndex: num(j.stageIndex), errorCode: str(j.errorCode), errorMessage: str(j.errorMessage),
      updatedAt: str(j.updatedAt),
    },
    sourceState, sourceBytes: num(r.sourceBytes), entryCount: num(r.entryCount),
    includes: Array.isArray(r.includes) ? r.includes.map(String) : [], sourceErrorCode: str(r.sourceErrorCode),
    storageState, backupRootWritable: bool(r.backupRootWritable),
    usableBytes: num(r.usableBytes), requiredBytes: num(r.requiredBytes), storageErrorCode: str(r.storageErrorCode),
    providerState, provider: str(r.provider), remote: str(r.remote),
    providerErrorCode: str(r.providerErrorCode), providerMessage: str(r.providerMessage),
    localBackupReady,
    offsiteBackupReady: legacyHost ? (bool(r.ok) || (providerState === "CONNECTED" && r.hostAuthenticated !== false && !recoveryRequired && r.operationBusy !== true)) : bool(r.offsiteBackupReady),
  };
}

// ─── Create-button gate: strict priority, never masks the real cause ───────
export type Resolution =
  | "RESOLVE_RECOVERY" | "RERUN_PREFLIGHT" | "TEST_PROVIDER" | "SWITCH_TO_LOCAL" | null;

export interface CreateGate {
  blocked: boolean;
  code: string | null;       // the real Host error code
  title: string;             // short, for ribbon cell + tooltip
  resolution: Resolution;
}

export function deriveCreateGate(i: {
  jobBusy: boolean;
  preflight: PreflightView | null;
  mode: DestinationMode;
  allowLocalFallback: boolean;
}): CreateGate {
  const ok: CreateGate = { blocked: false, code: null, title: "", resolution: null };
  if (i.jobBusy) return { blocked: true, code: "JOB_RUNNING", title: "A maintenance job is running.", resolution: null };
  const p = i.preflight;
  if (!p) return { blocked: true, code: "PREFLIGHT_PENDING", title: "Preflight has not completed.", resolution: "RERUN_PREFLIGHT" };
  if (p.recoveryRequired)
    return { blocked: true, code: "RECOVERY_REQUIRED", title: "Recovery gate is active. Clear it before backing up.", resolution: "RESOLVE_RECOVERY" };
  if (p.sourceState !== "READY")
    return { blocked: true, code: p.sourceErrorCode ?? "SOURCE_UNREADABLE", title: "World source cannot be scanned.", resolution: "RERUN_PREFLIGHT" };
  if (p.storageState !== "READY")
    return { blocked: true, code: p.storageErrorCode ?? "STORAGE_UNAVAILABLE", title: "VPS backup storage is not usable.", resolution: "RERUN_PREFLIGHT" };

  const needsRemote =
    p.legacyHost ||                                   // old Host only knows Drive
    i.mode === "DRIVE_AND_LOCAL" ||
    (i.mode === "AUTO" && !i.allowLocalFallback);
  if (needsRemote && p.providerState !== "CONNECTED") {
    return {
      blocked: true,
      code: p.providerErrorCode ?? "RCLONE_UNAVAILABLE",
      title: p.providerMessage ?? "Off-site provider is not connected.",
      resolution: p.legacyHost ? "TEST_PROVIDER" : p.localBackupReady ? "SWITCH_TO_LOCAL" : "TEST_PROVIDER",
    };
  }
  return ok;
}

// ─── Archive classification for the ledger ─────────────────────────────────
export type ArchiveKind = "DRIVE_AND_LOCAL" | "LOCAL_ONLY" | "DRIVE_ONLY" | "UNVERIFIED";
export function classifyArchive(a: { local?: boolean; offsite?: boolean; verification?: string | null }): ArchiveKind {
  const verified = !!a.verification && a.verification.startsWith("VERIFIED");
  if (!verified) return "UNVERIFIED";
  if (a.local && a.offsite) return "DRIVE_AND_LOCAL";
  if (a.local) return "LOCAL_ONLY";
  return a.offsite ? "DRIVE_ONLY" : "UNVERIFIED";
}

// ─── Stage rail ────────────────────────────────────────────────────────────
export type StageState = "done" | "current" | "pending" | "skipped" | "failed";
export interface StageView { index: number; label: string; state: StageState }

/** `labels` comes from the Host (`stages[]`). FALLBACK is used only for an old Host: generate it
 *  from the Java enum in Phase 0 (14 entries; index 6 is "Stop service"); a unit test pins both facts. */
// Derived from host BackupStage (the durable STOPPING_SERVER phase maps to STOP_SERVICE).
export const FALLBACK_STAGE_KEYS = ["PREFLIGHT","ACQUIRE_LOCK","ANNOUNCE","COUNTDOWN","SAVE_ALL_FLUSH","STOP_SERVICE","STOP_PROOF","BUILD_MANIFEST","ARCHIVE_PARTIAL","FINALIZE_ARCHIVE","LOCAL_SHA256","UPLOAD","REMOTE_SHA256","RESTART_RELEASE"] as const;
export const FALLBACK_STAGE_LABELS = ["Preflight","Acquire lock","Announce to players","Countdown","Save-all flush","Stop service","Systemd stop proof","Build manifest","ZIP to .partial","Finalize ZIP","Local SHA-256","Upload to Google Drive","Remote SHA-256 verify","Restart and release lock"];

export function buildStages(i: {
  labels?: string[]; currentIndex: number; skipped?: number[]; failed?: boolean;
}): StageView[] {
  const labels = i.labels?.length ? i.labels : FALLBACK_STAGE_LABELS;
  const skipped = new Set(i.skipped ?? []);
  return labels.map((label, k) => {
    const index = k + 1;
    const state: StageState =
      skipped.has(index) ? "skipped"
      : index < i.currentIndex ? "done"
      : index === i.currentIndex ? (i.failed ? "failed" : "current")
      : "pending";
    return { index, label, state };
  });
}

// ─── Schedule option sets: always include the current value (never silently coerce it) ──
export const timeOptions = (current?: string): string[] => {
  const base = Array.from({ length: 48 }, (_, n) =>
    `${String(Math.floor(n / 2)).padStart(2, "0")}:${n % 2 ? "30" : "00"}`);
  return current && !base.includes(current) ? [...base, current].sort() : base;
};
export const RETENTION_PRESETS = [3, 5, 7, 10, 14, 30] as const;
export const retentionOptions = (current?: number): number[] =>
  current && !(RETENTION_PRESETS as readonly number[]).includes(current)
    ? [...RETENTION_PRESETS, current].sort((a, b) => a - b) : [...RETENTION_PRESETS];
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const COUNTDOWN_OPTIONS = [
  { value: 300, label: "5 minutes" }, { value: 600, label: "10 minutes" },
  { value: 900, label: "15 minutes" }, { value: 1800, label: "30 minutes" },
] as const;


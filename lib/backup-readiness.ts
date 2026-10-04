import type { JsonMap } from "./control-state";

export type BackupReadiness = "Ready" | "Warning" | "Failed" | "Unknown" | "Not configured";
type Preflight = { hasSuccess: boolean; busy: boolean; error: string; data: JsonMap;
  failure: { code: string; stage: string } | null };
/** A failed early gate does not assert the outcome of later checks. Old success is not fresh readiness. */
export function backupCheckState(query: Preflight, check: "storage" | "source"): BackupReadiness {
  if (query.busy) return "Unknown";
  if (query.error) {
    const stage = query.failure?.stage;
    const code = query.failure?.code ?? "";
    const storageFailure = stage === "storage" || stage === "capacity" || /^(BACKUP_STAGING_|BACKUP_STORAGE_|BACKUP_DISK_SPACE_)/.test(code);
    const sourceFailure = stage === "source" || /^(BACKUP_SOURCE_|BACKUP_INCLUDE_|BACKUP_SYMLINK_|BACKUP_ENTRY_|BACKUP_SIZE_)/.test(code);
    return (check === "storage" ? storageFailure : sourceFailure) ? "Failed" : "Unknown";
  }
  if (!query.hasSuccess) return "Unknown";
  if (check === "storage") return query.data.backupRootWritable === true ? "Ready" : "Failed";
  if (Number(query.data.unreadableDurableCount ?? 0) > 0 || (Array.isArray(query.data.symlinkIssues) && query.data.symlinkIssues.length)) return "Failed";
  return Array.isArray(query.data.missingIncludes) && query.data.missingIncludes.length ? "Warning" : "Ready";
}

export type BackupSchedule = {
  enabled: boolean;
  cadence: "DAILY" | "WEEKLY" | "SELECTED_DAYS" | "INTERVAL_HOURS";
  weekdays: string[];
  time: string;
  intervalHours: number;
  countdownMinutes: number;
  skipIfEmptySinceLastBackup: boolean;
  forceAfterHours: number;
};
export const defaultBackupSchedule = (): BackupSchedule => ({
  enabled: false,
  cadence: "DAILY",
  weekdays: [],
  time: "04:00",
  intervalHours: 24,
  countdownMinutes: 15,
  skipIfEmptySinceLastBackup: false,
  forceAfterHours: 168,
});
export type MaintenanceSettings = {
  schemaVersion: number;
  timezone: string;
  schedule?: { backups: BackupSchedule };
  restart: {
    schedule: {
      enabled: boolean;
      type: string;
      weekdays: string[];
      time: string;
    };
    warningSeconds: number[];
    stopTimeoutSeconds: number;
    startupTimeoutSeconds: number;
  };
  fullRestorePoint: {
    localRetentionPolicy?: string;
    retentionMode: string;
    retentionCount: number;
    restartAfter: boolean;
    canonicalFilename: string;
    uploadTimeoutSeconds: number;
    verificationMode: string;
    maximumBytes: number;
    excludes: string[];
  };
};
export function validateMaintenance(value: unknown): string {
  try {
    const s = value as MaintenanceSettings,
      r = s.restart,
      f = s.fullRestorePoint;
    if (s.schemaVersion !== 1 || !r || !f)
      return "Unsupported or incomplete settings schema.";
    new Intl.DateTimeFormat("en", { timeZone: s.timezone }).format();
    if (
      !["DAILY", "WEEKLY", "SELECTED_WEEKDAYS"].includes(r.schedule.type) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.schedule.time)
    )
      return "Choose a valid schedule and local time.";
    if (
      !Array.isArray(r.schedule.weekdays) ||
      r.schedule.weekdays.length > 7 ||
      r.schedule.weekdays.some(
        (day) =>
          ![
            "MONDAY",
            "TUESDAY",
            "WEDNESDAY",
            "THURSDAY",
            "FRIDAY",
            "SATURDAY",
            "SUNDAY",
          ].includes(day),
      ) ||
      (r.schedule.type !== "DAILY" && !r.schedule.weekdays.length)
    )
      return "Select at least one valid weekday.";
    if (
      !Array.isArray(r.warningSeconds) ||
      r.warningSeconds.length > 16 ||
      r.warningSeconds.some(
        (n) => !Number.isInteger(n) || n < 0 || n > 86400,
      ) ||
      [r.stopTimeoutSeconds, r.startupTimeoutSeconds].some(
        (n) => !Number.isInteger(n) || n < 30 || n > 1800,
      )
    )
      return "Restart warning or timeout is outside the service limits.";
    if (
      !["SINGLE_CURRENT", "ROTATING"].includes(f.retentionMode) ||
      !Number.isInteger(f.retentionCount) ||
      f.retentionCount < 1 ||
      f.retentionCount > 52 ||
      !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}\.zip$/.test(f.canonicalFilename) ||
      f.uploadTimeoutSeconds < 60 ||
      f.uploadTimeoutSeconds > 7200 ||
      f.maximumBytes < 1048576 ||
      f.maximumBytes > 2199023255552
    )
      return "Backup retention, filename or limits are invalid.";
    if (
      !Array.isArray(f.excludes) ||
      f.excludes.length > 64 ||
      f.excludes.some(
        (v) =>
          typeof v !== "string" ||
          !v ||
          v.length > 160 ||
          v.startsWith("/") ||
          v.includes("..") ||
          v.includes("\\"),
      )
    )
      return "Backup exclusions contain an invalid relative path.";
    if (
      [
        "logs",
        "crash-reports",
        "cache",
        ".cache",
        "plugins/PlexonPanel/audit",
        "plugins/PlexonPanel/identity",
        "plugins/spark/tmp",
      ].some((v) => !f.excludes.includes(v))
    )
      return "Required backup exclusions are missing.";
    const b = s.schedule?.backups;
    if (b) {
      if (
        typeof b.enabled !== "boolean" ||
        typeof b.skipIfEmptySinceLastBackup !== "boolean" ||
        !["DAILY", "WEEKLY", "SELECTED_DAYS", "INTERVAL_HOURS"].includes(
          b.cadence,
        ) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.time) ||
        !Number.isInteger(b.intervalHours) ||
        b.intervalHours < 1 ||
        b.intervalHours > 168 ||
        ![30, 15, 10, 5].includes(b.countdownMinutes) ||
        !Number.isInteger(b.forceAfterHours) ||
        b.forceAfterHours < 1 ||
        b.forceAfterHours > 8760
      )
        return "Invalid periodic backup settings.";
      if (
        !Array.isArray(b.weekdays) ||
        b.weekdays.length > 7 ||
        new Set(b.weekdays).size !== b.weekdays.length ||
        b.weekdays.some(
          (day) =>
            ![
              "MONDAY",
              "TUESDAY",
              "WEDNESDAY",
              "THURSDAY",
              "FRIDAY",
              "SATURDAY",
              "SUNDAY",
            ].includes(day),
        ) ||
        (b.cadence === "WEEKLY" && b.weekdays.length !== 1) ||
        (b.cadence === "SELECTED_DAYS" && !b.weekdays.length)
      )
        return "Choose valid backup weekdays.";
    }
    if (
      f.localRetentionPolicy &&
      !["REMOTE_ONLY_AFTER_VERIFY", "KEEP_LOCAL_ROTATING"].includes(
        f.localRetentionPolicy,
      )
    )
      return "Invalid local retention policy.";
    return "";
  } catch {
    return "Settings do not match the supported Host schema or timezone.";
  }
}

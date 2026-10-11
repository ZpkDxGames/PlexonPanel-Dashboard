export type MaintenanceSettings = {
  schemaVersion: number; timezone: string;
  restart: { schedule: { enabled: boolean; type: string; weekdays: string[]; time: string }; warningSeconds: number[]; stopTimeoutSeconds: number; startupTimeoutSeconds: number };
  fullRestorePoint: { retentionMode: string; retentionCount: number; restartAfter: boolean; canonicalFilename: string; uploadTimeoutSeconds: number; verificationMode: string; maximumBytes: number; excludes: string[] };
};
export function validateMaintenance(value: unknown): string {
  try {
    const s = value as MaintenanceSettings, r = s.restart, f = s.fullRestorePoint;
    if (s.schemaVersion !== 1 || !r || !f) return 'Unsupported or incomplete settings schema.';
    new Intl.DateTimeFormat('en', { timeZone: s.timezone }).format();
    if (!['DAILY', 'WEEKLY', 'SELECTED_WEEKDAYS'].includes(r.schedule.type) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.schedule.time)) return 'Choose a valid schedule and local time.';
    if (!Array.isArray(r.schedule.weekdays) || r.schedule.weekdays.length > 7 || r.schedule.weekdays.some(day => !['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'].includes(day)) || (r.schedule.type !== 'DAILY' && !r.schedule.weekdays.length)) return 'Select at least one valid weekday.';
    if (!Array.isArray(r.warningSeconds) || r.warningSeconds.length > 16 || r.warningSeconds.some(n => !Number.isInteger(n) || n < 0 || n > 86400) || [r.stopTimeoutSeconds, r.startupTimeoutSeconds].some(n => !Number.isInteger(n) || n < 30 || n > 1800)) return 'Restart warning or timeout is outside the service limits.';
    if (!['SINGLE_CURRENT', 'ROTATING'].includes(f.retentionMode) || !Number.isInteger(f.retentionCount) || f.retentionCount < 1 || f.retentionCount > 52 || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}\.zip$/.test(f.canonicalFilename) || f.uploadTimeoutSeconds < 60 || f.uploadTimeoutSeconds > 7200 || f.maximumBytes < 1048576 || f.maximumBytes > 2199023255552) return 'Backup retention, filename or limits are invalid.';
    if (!Array.isArray(f.excludes) || f.excludes.length > 64 || f.excludes.some(v => typeof v !== 'string' || !v || v.length > 160 || v.startsWith('/') || v.includes('..') || v.includes('\\'))) return 'Backup exclusions contain an invalid relative path.';
    if (['logs','crash-reports','cache','.cache','plugins/PlexonPanel/audit','plugins/PlexonPanel/identity','plugins/spark/tmp'].some(v => !f.excludes.includes(v))) return 'Required backup exclusions are missing.';
    return '';
  } catch { return 'Settings do not match the supported Host schema or timezone.'; }
}

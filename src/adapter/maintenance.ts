export type MaintenanceSettings = {
  schemaVersion: number; timezone: string;
  restart: { schedule: { enabled: boolean; type: string; weekdays: string[]; time: string }; warningSeconds: number[]; stopTimeoutSeconds: number; startupTimeoutSeconds: number };
  fullRestorePoint: { retentionMode: string; retentionCount: number; restartAfter: boolean; canonicalFilename: string; uploadTimeoutSeconds: number; verificationMode: string; maximumBytes: number; excludes: string[]; schedule?: {enabled:boolean;type:string;weekdays:string[];time:string;intervalHours?:number} };
};
export function validateMaintenance(value: unknown): string {
  try {
    const s = value as MaintenanceSettings, r = s.restart, f = s.fullRestorePoint;
    if (![1,2].includes(s.schemaVersion) || !r || !f) return 'Unsupported or incomplete settings schema.';
    new Intl.DateTimeFormat('en', { timeZone: s.timezone }).format();
    if (!['DAILY', 'WEEKLY', 'SELECTED_WEEKDAYS'].includes(r.schedule.type) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.schedule.time)) return 'Choose a valid schedule and local time.';
    if (!Array.isArray(r.schedule.weekdays) || r.schedule.weekdays.length > 7 || r.schedule.weekdays.some(day => !['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'].includes(day)) || (r.schedule.type !== 'DAILY' && !r.schedule.weekdays.length)) return 'Select at least one valid weekday.';
    if (!Array.isArray(r.warningSeconds) || r.warningSeconds.length > 16 || r.warningSeconds.some(n => !Number.isInteger(n) || n < 0 || n > 86400) || [r.stopTimeoutSeconds, r.startupTimeoutSeconds].some(n => !Number.isInteger(n) || n < 30 || n > 1800)) return 'Restart warning or timeout is outside the service limits.';
    if (!['SINGLE_CURRENT', 'ROTATING'].includes(f.retentionMode) || !Number.isInteger(f.retentionCount) || f.retentionCount < 1 || f.retentionCount > 52 || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}\.zip$/.test(f.canonicalFilename) || f.uploadTimeoutSeconds < 60 || f.uploadTimeoutSeconds > 7200 || f.maximumBytes < 1048576 || f.maximumBytes > 2199023255552) return 'Backup retention, filename or limits are invalid.';
    if (!Array.isArray(f.excludes) || f.excludes.length > 64 || f.excludes.some(v => typeof v !== 'string' || !v || v.length > 160 || v.startsWith('/') || v.includes('..') || v.includes('\\'))) return 'Backup exclusions contain an invalid relative path.';
    if (['logs','crash-reports','cache','.cache','plugins/PlexonPanel/audit','plugins/PlexonPanel/identity','plugins/spark/tmp'].some(v => !f.excludes.includes(v))) return 'Required backup exclusions are missing.';
    if(s.schemaVersion===2){const schedule=f.schedule;if(!schedule||typeof schedule.enabled!=="boolean"||!["DAILY","WEEKLY","SELECTED_DAYS","SELECTED_WEEKDAYS","INTERVAL_HOURS"].includes(schedule.type))return "Invalid periodic schedule.";if(schedule.type==="INTERVAL_HOURS"){if(!Number.isInteger(schedule.intervalHours)||schedule.intervalHours!<1||schedule.intervalHours!>168)return "Interval must be 1–168 hours.";}else if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.time))return "Invalid periodic local time.";if(!Array.isArray(schedule.weekdays)||schedule.weekdays.length>7||schedule.weekdays.some(day=>!["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"].includes(day))||(["WEEKLY","SELECTED_DAYS","SELECTED_WEEKDAYS"].includes(schedule.type)&&!schedule.weekdays.length))return "Select valid periodic weekdays.";}
    return '';
  } catch { return 'Settings do not match the supported Host schema or timezone.'; }
}

"use client";
import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { useQuery } from "../features/useQuery";
import { useOperation, ActionButton } from "../features/operations";
import {
  defaultBackupSchedule,
  validateMaintenance,
  type BackupSchedule,
  type MaintenanceSettings,
} from "../adapter/maintenance";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Input, Field, Select } from "./ui/input";
import { Switch } from "./ui/switch";
import { Notice } from "./ui/empty";
const days = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];
export function BackupScheduleCard() {
  const read = useQuery("maintenance.settings.get"),
    op = useOperation(),
    [draft, setDraft] = useState<BackupSchedule>(defaultBackupSchedule()),
    [timezone, setTimezone] = useState("UTC"),
    [policy, setPolicy] = useState("REMOTE_ONLY_AFTER_VERIFY"),
    [retention, setRetention] = useState(1),
    [error, setError] = useState("");
  const settings = read.data.settings as MaintenanceSettings | undefined;
  useEffect(() => {
    if (settings?.schedule?.backups) {
      setDraft(settings.schedule.backups);
      setTimezone(settings.timezone);
      setPolicy(
        settings.fullRestorePoint.localRetentionPolicy ??
          "REMOTE_ONLY_AFTER_VERIFY",
      );
      setRetention(settings.fullRestorePoint.retentionCount);
    }
  }, [settings]);
  const patch = (value: Partial<BackupSchedule>) =>
    setDraft((d) => ({ ...d, ...value }));
  const review = () => {
    if (!settings) return;
    const value: MaintenanceSettings = {
      ...settings,
      timezone,
      schedule: { ...settings.schedule, backups: draft },
      fullRestorePoint: {
        ...settings.fullRestorePoint,
        localRetentionPolicy: policy,
        retentionCount: retention,
      },
    };
    const invalid = validateMaintenance(value);
    setError(invalid);
    if (!invalid)
      op.prepare("maintenance.settings.update", { settings: value });
  };
  return (
    <Card>
      <CardHeader
        title="Periodic schedule"
        description="Host-owned cold backups to Google Drive"
        icon={<CalendarClock size={17} className="text-violet-400" />}
      />
      <CardContent className="space-y-5">
        {settings?.schedule?.backups ? (
          <>
            <label className="flex items-center justify-between gap-3 text-xs font-medium">
              Enable scheduled backups
              <Switch
                aria-label="Enable scheduled backups"
                checked={draft.enabled}
                onCheckedChange={(enabled) => patch({ enabled })}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cadence">
                <Select
                  value={draft.cadence}
                  onChange={(e) =>
                    patch({
                      cadence: e.target.value as BackupSchedule["cadence"],
                      weekdays: e.target.value === "WEEKLY" ? ["MONDAY"] : [],
                    })
                  }
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="SELECTED_DAYS">Selected days</option>
                  <option value="INTERVAL_HOURS">Interval</option>
                </Select>
              </Field>
              <Field
                label={
                  draft.cadence === "INTERVAL_HOURS"
                    ? "Interval hours"
                    : "Local time"
                }
              >
                {draft.cadence === "INTERVAL_HOURS" ? (
                  <Input
                    type="number"
                    min={1}
                    max={168}
                    value={draft.intervalHours}
                    onChange={(e) =>
                      patch({ intervalHours: Number(e.target.value) })
                    }
                  />
                ) : (
                  <Input
                    type="time"
                    value={draft.time}
                    onChange={(e) => patch({ time: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Timezone">
                <Input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                />
              </Field>
              <Field label="Player countdown">
                <Select
                  value={draft.countdownMinutes}
                  onChange={(e) =>
                    patch({ countdownMinutes: Number(e.target.value) })
                  }
                >
                  {[30, 15, 10, 5].map((v) => (
                    <option key={v} value={v}>
                      {v} minutes
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {["WEEKLY", "SELECTED_DAYS"].includes(draft.cadence) && (
              <fieldset>
                <legend className="mb-3 text-xs">Weekdays</legend>
                <div className="flex flex-wrap gap-2">
                  {days.map((day) => (
                    <label
                      key={day}
                      className="flex items-center gap-2 rounded-lg border p-2 text-[10px]"
                    >
                      <input
                        type={draft.cadence === "WEEKLY" ? "radio" : "checkbox"}
                        name="backup-weekdays"
                        checked={draft.weekdays.includes(day)}
                        onChange={(e) =>
                          patch({
                            weekdays:
                              draft.cadence === "WEEKLY"
                                ? [day]
                                : e.target.checked
                                  ? [...draft.weekdays, day]
                                  : draft.weekdays.filter((d) => d !== day),
                          })
                        }
                      />
                      {day.slice(0, 3)}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <label className="flex items-center justify-between gap-3 text-xs">
              Skip if no players joined since last verified backup
              <Switch
                aria-label="Skip idle backups"
                checked={draft.skipIfEmptySinceLastBackup}
                onCheckedChange={(skipIfEmptySinceLastBackup) =>
                  patch({ skipIfEmptySinceLastBackup })
                }
              />
            </label>
            {draft.skipIfEmptySinceLastBackup && (
              <Field label="Force backup after hours">
                <Input
                  type="number"
                  min={1}
                  max={8760}
                  value={draft.forceAfterHours}
                  onChange={(e) =>
                    patch({ forceAfterHours: Number(e.target.value) })
                  }
                />
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Local retention">
                <Select
                  value={policy}
                  onChange={(e) => setPolicy(e.target.value)}
                >
                  <option value="REMOTE_ONLY_AFTER_VERIFY">
                    Remove after Drive verification
                  </option>
                  <option value="KEEP_LOCAL_ROTATING">
                    Keep local rotating copies
                  </option>
                </Select>
              </Field>
              <Field label="Retention count">
                <Input
                  type="number"
                  min={1}
                  max={52}
                  value={retention}
                  onChange={(e) => setRetention(Number(e.target.value))}
                />
              </Field>
            </div>
            <ActionButton action="maintenance.settings.update" onClick={review}>
              Review schedule
            </ActionButton>
          </>
        ) : (
          <Notice>
            {read.error ||
              (read.busy
                ? "Reading Host schedule…"
                : "This Host has not advertised periodic scheduling settings.")}
          </Notice>
        )}
        {error && <Notice danger>{error}</Notice>}
        {op.review}
      </CardContent>
    </Card>
  );
}

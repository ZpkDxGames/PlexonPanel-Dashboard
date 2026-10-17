"use client";
import { useEffect, useState } from "react";
import { session, type Prepared } from "../adapter/session";
import { record } from "../adapter/control-state";
import {
  validateMaintenance,
  type MaintenanceSettings,
  type BackupSchedule,
  defaultBackupSchedule,
} from "../adapter/maintenance";
import { useSession } from "../hooks";
import { Button } from "./ui/button";
import { ActionReview } from "../features/ActionReview";
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
  const snap = useSession(),
    [settings, setSettings] = useState<MaintenanceSettings | null>(null),
    [draft, setDraft] = useState<BackupSchedule>(defaultBackupSchedule()),
    [timezone, setTimezone] = useState("UTC"),
    [retentionCount, setRetentionCount] = useState(1),
    [policy, setPolicy] = useState("REMOTE_ONLY_AFTER_VERIFY"),
    [error, setError] = useState(""),
    [prepared, setPrepared] = useState<Prepared | null>(null);
  useEffect(() => {
    let active = true;
    setSettings(null);
    if (session.reason("maintenance.settings.get", "HOST")) return;
    void session
      .query("maintenance.settings.get", {}, "HOST")
      .then((response) => {
        if (!active) return;
        const value = record(response.data).settings as MaintenanceSettings;
        if (value?.schedule?.backups) {
          setSettings(value);
          setDraft(value.schedule.backups);
          setTimezone(value.timezone);
          setRetentionCount(value.fullRestorePoint.retentionCount);
          setPolicy(
            value.fullRestorePoint.localRetentionPolicy ??
              "REMOTE_ONLY_AFTER_VERIFY",
          );
        } else
          setError(
            "This Host does not advertise periodic schedules. Upgrade the Host before configuring them.",
          );
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [snap.revision, snap.phase]);
  const patch = (value: Partial<BackupSchedule>) =>
    setDraft((old) => ({ ...old, ...value }));
  const review = () => {
    if (!settings) return;
    const next: MaintenanceSettings = {
      ...settings,
      timezone,
      schedule: { ...settings.schedule, backups: draft },
      fullRestorePoint: {
        ...settings.fullRestorePoint,
        localRetentionPolicy: policy,
        retentionCount,
      },
    };
    const invalid = validateMaintenance(next);
    if (invalid) {
      setError(invalid);
      return;
    }
    try {
      setPrepared(
        session.prepare(
          "maintenance.settings.update",
          { settings: next },
          "HOST",
        ),
      );
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Schedule unavailable");
    }
  };
  const reason = session.reason("maintenance.settings.update", "HOST");
  return (
    <section className="v5-schedule" aria-label="Periodic Google Drive backups">
      <span className="eyebrow">HOST COMPANION / GOOGLE DRIVE</span>
      <h2>Periodic cold backups</h2>
      <p>
        Manual and scheduled jobs use the same verified stop, archive, Drive
        promotion and restart workflow.
      </p>
      {settings ? (
        <>
          <label className="field">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => patch({ enabled: e.target.checked })}
              disabled={!!reason}
            />{" "}
            Enable periodic backups
          </label>
          <div className="v5-schedule-grid">
            <label>
              Cadence
              <select
                value={draft.cadence}
                onChange={(e) =>
                  patch({
                    cadence: e.target.value as BackupSchedule["cadence"],
                    weekdays: e.target.value === "WEEKLY" ? [days[0]] : [],
                  })
                }
              >
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="SELECTED_DAYS">Selected weekdays</option>
                <option value="INTERVAL_HOURS">Every N hours</option>
              </select>
            </label>
            <label>
              Local time
              <input
                type="time"
                value={draft.time}
                onChange={(e) => patch({ time: e.target.value })}
              />
            </label>
            <label>
              Timezone
              <input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="America/Sao_Paulo"
              />
            </label>
            <label>
              Interval hours
              <input
                type="number"
                min={1}
                max={168}
                disabled={draft.cadence !== "INTERVAL_HOURS"}
                value={draft.intervalHours}
                onChange={(e) =>
                  patch({ intervalHours: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Player countdown
              <select
                value={draft.countdownMinutes}
                onChange={(e) =>
                  patch({ countdownMinutes: Number(e.target.value) })
                }
              >
                {[30, 15, 10, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} minutes
                  </option>
                ))}
              </select>
            </label>
            <label>
              Local retention
              <select
                value={policy}
                onChange={(e) => setPolicy(e.target.value)}
              >
                <option value="REMOTE_ONLY_AFTER_VERIFY">
                  Remove after verified Drive promotion
                </option>
                <option value="KEEP_LOCAL_ROTATING">
                  Keep rotating local archives
                </option>
              </select>
            </label>
            <label>
              Local archives to keep
              <input
                type="number"
                min={1}
                max={52}
                value={retentionCount}
                disabled={policy !== "KEEP_LOCAL_ROTATING"}
                onChange={(e) => setRetentionCount(Number(e.target.value))}
              />
            </label>
          </div>
          {["WEEKLY", "SELECTED_DAYS"].includes(draft.cadence) ? (
            <fieldset className="v5-weekdays">
              <legend>Weekdays</legend>
              {days.map((day) => (
                <label key={day}>
                  <input
                    type={draft.cadence === "WEEKLY" ? "radio" : "checkbox"}
                    name="backup-weekday"
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
            </fieldset>
          ) : null}
          <label className="field">
            <input
              type="checkbox"
              checked={draft.skipIfEmptySinceLastBackup}
              onChange={(e) =>
                patch({ skipIfEmptySinceLastBackup: e.target.checked })
              }
            />{" "}
            Skip when no players joined since the last verified Drive backup
          </label>
          <label className="field">
            Force backup after hours
            <input
              type="number"
              min={1}
              max={8760}
              value={draft.forceAfterHours}
              onChange={(e) =>
                patch({ forceAfterHours: Number(e.target.value) })
              }
            />
          </label>
          <div className="v5-schedule-actions">
            <Button disabled={!!reason} onClick={review}>
              Review schedule changes
            </Button>
            <span className="subtle">
              {reason || "Takes effect only after your reviewed Host update."}
            </span>
          </div>
        </>
      ) : (
        <p>Awaiting supported Host maintenance settings.</p>
      )}
      {error ? <p role="status">{error}</p> : null}
      <ActionReview prepared={prepared} onClose={() => setPrepared(null)} />
    </section>
  );
}

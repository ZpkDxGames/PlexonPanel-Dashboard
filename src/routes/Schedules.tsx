import { copy } from "../i18n/en";
import { useEffect, useState } from "react";
import { session, type Prepared } from "../adapter/session";
import { record } from "../adapter/control-state";
import { useSession } from "../hooks";
import { Panel, Button, Notice, Status } from "../components/ui";
import { ActionReview } from "../features/ActionReview";
import {
  validateMaintenance,
  type MaintenanceSettings,
} from "../adapter/maintenance";
import { schedulePreview } from "../lib/cron-preview";
import { Icon } from "../components/Icon";
export default function Schedules() {
  const snap = useSession();
  const [settings, setSettings] = useState<MaintenanceSettings | null>(null),
    [error, setError] = useState(""),
    [prepared, setPrepared] = useState<Prepared | null>(null);
  useEffect(() => {
    let active = true;
    setSettings(null);
    void session
      .query("maintenance.settings.get", {}, "HOST")
      .then((r) => {
        if (active) {
          const s = record(r.data).settings;
          const e = validateMaintenance(s);
          if (e) setError(e);
          else setSettings(s as MaintenanceSettings);
        }
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "Maintenance unavailable.");
      });
    return () => {
      active = false;
    };
  }, [snap.state.serverId, snap.revision]);
  const review = () => {
    if (!settings) return;
    const validation = validateMaintenance(settings);
    if (validation) {
      setError(validation);
      return;
    }
    try {
      setPrepared(
        session.prepare("maintenance.settings.update", { settings }, "HOST"),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action unavailable.");
    }
  };
  return (
    <>
      <div className="schedule-hero card">
        <span className="schedule-icon">
          <Icon name="clock" />
        </span>
        <div>
          <h2>{settings ? schedulePreview(settings) : "Server maintenance"}</h2>
          <p className="subtle">
            {copy.scheduled_in_your_server_s_time_zone_34a03}
          </p>
        </div>
        <Status
          tone={settings?.restart.schedule.enabled ? "success" : "neutral"}
        >
          {settings?.restart.schedule.enabled ? "Enabled" : "Off"}
        </Status>
      </div>
      <div className="settings-grid">
        <Panel
          title={copy.automatic_restart_38174}
          eyebrow={copy.give_your_players_time_to_finish_up_a8a11}
        >
          {settings ? (
            <div className="settings-body">
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.restart.schedule.enabled}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      restart: {
                        ...settings.restart,
                        schedule: {
                          ...settings.restart.schedule,
                          enabled: e.target.checked,
                        },
                      },
                    })
                  }
                />
                {copy.enable_scheduled_restart_700ef}
              </label>
              <label className="field">
                {copy.local_time_14ca4}
                <input
                  type="time"
                  value={settings.restart.schedule.time}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      restart: {
                        ...settings.restart,
                        schedule: {
                          ...settings.restart.schedule,
                          time: e.target.value,
                        },
                      },
                    })
                  }
                />
              </label>
              <label className="field">
                {copy.time_zone_eea79}
                <input
                  value={settings.timezone}
                  onChange={(e) =>
                    setSettings({ ...settings, timezone: e.target.value })
                  }
                />
              </label>
              <p className="subtle">
                {copy.player_warnings_7bfa4}
                {settings.restart.warningSeconds.join(", ")}
                {copy._seconds_before_restart_a7e93}
              </p>
              <Button
                variant="primary"
                onClick={review}
                disabled={Boolean(
                  session.reason("maintenance.settings.update", "HOST"),
                )}
              >
                {copy.review_schedule_274d6}
              </Button>
            </div>
          ) : (
            <div className="inline-empty">
              <strong>{copy.maintenance_settings_unavailable_c6861}</strong>
              <span>
                {session.reason("maintenance.settings.get", "HOST") ||
                  "Waiting for the Host response."}
              </span>
            </div>
          )}
        </Panel>
        <Panel
          title={copy.backup_policy_0fcde}
          eyebrow={copy.manual_restore_points_and_retention_442eb}
        >
          {settings ? (
            <div className="settings-body">
              <div className="single-evidence">
                <strong>
                  {copy.keep_539b2}
                  {settings.fullRestorePoint.retentionCount}
                </strong>
                <span>
                  {settings.fullRestorePoint.retentionMode === "SINGLE_CURRENT"
                    ? "Current restore point"
                    : "Rotating restore points"}
                </span>
              </div>
              <p className="subtle">
                {copy.backups_are_manual_on_this_server_crea_84861}
              </p>
              <Button onClick={() => (location.hash = "Backups")}>
                {copy.open_backups_c84d4}
              </Button>
            </div>
          ) : (
            <div className="inline-empty">
              <strong>{copy.no_policy_received_507be}</strong>
              <span>{copy.connect_the_host_to_view_backup_retent_49119}</span>
            </div>
          )}
        </Panel>
      </div>
      <Panel
        title={copy.other_tasks_c7690}
        eyebrow={copy.broadcasts_and_custom_command_schedule_bba4a}
      >
        <div className="coverage">
          <p className="subtle">
            {copy.this_server_supports_scheduled_restart_67d9c}
          </p>
          <Status>{copy.not_available_d1a17}</Status>
        </div>
      </Panel>
      {error && (
        <Notice tone="error" title={copy.schedule_unavailable_502ed}>
          {error}
        </Notice>
      )}
      <ActionReview prepared={prepared} onClose={() => setPrepared(null)} />
    </>
  );
}

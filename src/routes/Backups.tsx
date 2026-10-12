import { Select } from "../components/Select";
import { copy } from "../i18n/en";
import { useEffect, useState } from "react";
import {
  number,
  record,
  records,
  str,
  type JsonMap,
} from "../adapter/control-state";
import { session, type Prepared } from "../adapter/session";
import { formatDateTime } from "../lib/time";
import { ActionReview } from "../features/ActionReview";
import { Button, Notice, Panel, Status } from "../components/ui";
import { useSession } from "../hooks";
function size(value: unknown) {
  const n = number(value);
  return n === null ? "Unknown" : `${(n / 2 ** 30).toFixed(2)} GiB`;
}
export default function Backups() {
  const snap = useSession();
  const [preflight, setPreflight] = useState<JsonMap>({});
  const [operation, setOperation] = useState<JsonMap>({});
  const [backups, setBackups] = useState<JsonMap[]>([]);
  const [error, setError] = useState("");
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [countdown, setCountdown] = useState(300);
  const refresh = async () => {
    setError("");
    try {
      const [p, s, l] = await Promise.all([
        session.query("backup.preflight", {}, "HOST"),
        session.query("maintenance.status", {}, "HOST"),
        session.query("backup.full.list", {}, "HOST"),
      ]);
      setPreflight(record(p.data));
      setOperation(record(record(s.data).currentOperation));
      setBackups(records(record(l.data).backups));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Backup status unavailable.",
      );
    }
  };
  useEffect(() => {
    if (snap.phase === "live") void refresh();
  }, [snap.phase, snap.revision]);
  const prepare = (action: string, parameters: JsonMap) => {
    try {
      setPrepared(session.prepare(action, parameters, "HOST"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action unavailable.");
    }
  };
  const ready =
    preflight.hostAuthenticated === true &&
    preflight.operationBusy === false &&
    preflight.recoveryRequired === false &&
    preflight.backupRootWritable === true &&
    preflight.commandChannelConfigured === true;
  const phase = str(operation.phase, "IDLE");
  return (
    <>
      <div className="backup-hero">
        <div>
          <span className="eyebrow">
            {copy.worlds_and_server_contents_1b591}
          </span>
          <h2>
            {phase === "IDLE"
              ? !snap.state.ready?.agents.host
                ? "Connect your server to manage backups"
                : ready
                  ? "Ready for a restore point"
                  : "Checking backup readiness"
              : phase === "DEGRADED"
                ? "Offsite copy needs attention"
                : phase.replaceAll("_", " ").toLowerCase()}
          </h2>
          <p>{copy.check_both_local_and_offsite_copies_yo_41379}</p>
        </div>
        <div className="backup-create">
          <label className="field">
            {copy.player_warning_306a0}
            <Select
              value={countdown}
              onChange={(e) => setCountdown(Number(e.target.value))}
            >
              {[300, 600, 900, 1800].map((n) => (
                <option value={n} key={n}>
                  {n / 60}
                  {copy._minutes_ae098}
                </option>
              ))}
            </Select>
          </label>
          <Button
            variant="primary"
            disabled={
              !ready ||
              Boolean(session.reason("maintenance.full-backup.create", "HOST"))
            }
            title={
              !ready
                ? "A successful preflight with every required boolean true is required."
                : session.reason("maintenance.full-backup.create", "HOST")
            }
            onClick={() =>
              prepare("maintenance.full-backup.create", {
                countdownSeconds: countdown,
              })
            }
          >
            {copy.review_new_backup_abb68}
          </Button>
        </div>
      </div>
      <div className="operations-grid">
        <Panel
          eyebrow={copy.current_job_ee633}
          title={copy.phase_timeline_b68da}
          action={
            <Status
              tone={
                phase === "DEGRADED"
                  ? "warning"
                  : phase === "IDLE"
                    ? "neutral"
                    : "info"
              }
            >
              {phase === "DEGRADED"
                ? "Needs attention"
                : phase.replaceAll("_", " ").toLowerCase()}
            </Status>
          }
        >
          <p className="table-scroll-hint">
            {copy.swipe_to_see_every_backup_step_3b3ee}
          </p>
          <div
            className="phase-timeline"
            tabIndex={0}
            aria-label={copy.backup_steps_2dd67}
          >
            {[
              "PREFLIGHT",
              "COUNTDOWN",
              "ARCHIVE",
              "LOCAL_VERIFY",
              "UPLOAD",
              "REMOTE_VERIFY",
              "COMPLETE",
            ].map((item) => (
              <div className={item === phase ? "current" : ""} key={item}>
                <i />
                <span>{item.replaceAll("_", " ")}</span>
              </div>
            ))}
          </div>
          {Boolean(operation.message) && (
            <Notice
              tone={operation.retryable ? "warning" : "neutral"}
              title={
                operation.errorCode === "REMOTE_VERIFY_FAILED"
                  ? "Offsite copy needs verification"
                  : str(operation.errorCode, "Backup status")
              }
            >
              {str(operation.message)}
            </Notice>
          )}
        </Panel>
        <Panel
          eyebrow={copy.before_you_begin_b4738}
          title={copy.backup_readiness_702cf}
        >
          <dl className="gate-list">
            <dt>{copy.host_authenticated_1a7b1}</dt>
            <dd>
              {preflight.hostAuthenticated === true ? "Ready" : "Unavailable"}
            </dd>
            <dt>{copy.no_active_operation_e4534}</dt>
            <dd>
              {preflight.operationBusy === false
                ? "Ready"
                : preflight.operationBusy === true
                  ? "Busy"
                  : "Unavailable"}
            </dd>
            <dt>{copy.recovery_clear_3908e}</dt>
            <dd>
              {preflight.recoveryRequired === false
                ? "Ready"
                : preflight.recoveryRequired === true
                  ? "Needs recovery"
                  : "Unavailable"}
            </dd>
            <dt>{copy.backup_root_writable_8a516}</dt>
            <dd>
              {preflight.backupRootWritable === true ? "Ready" : "Unavailable"}
            </dd>
            <dt>{copy.command_channel_036ff}</dt>
            <dd>
              {preflight.commandChannelConfigured === true
                ? "Ready"
                : "Unavailable"}
            </dd>
          </dl>
          <div className="panel-actions">
            <Button onClick={() => void refresh()}>
              {copy.refresh_status_ade15}
            </Button>
            {operation.retryable === true && (
              <Button
                onClick={() =>
                  prepare("backup.full.retry-upload", {
                    backupId: str(operation.backupId),
                  })
                }
              >
                {copy.review_upload_retry_fb0e5}
              </Button>
            )}
          </div>
        </Panel>
      </div>
      <Panel
        eyebrow={copy.retained_archives_63b7e}
        title={copy.backup_inventory_8610b}
        action={
          <span className="subtle">{copy.local_and_offsite_copies_12bdf}</span>
        }
      >
        <p className="table-scroll-hint">
          {copy.swipe_to_see_archive_actions_7a2fb}
        </p>
        <div className="backup-table table-region" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th>{copy.archive_2621c}</th>
                <th>{copy.created_accf4}</th>
                <th>{copy.size_b7152}</th>
                <th>{copy.local_dc99d}</th>
                <th>{copy.offsite_47511}</th>
                <th>{copy.actions_c3cd6}</th>
              </tr>
            </thead>
            <tbody>
              {backups.length ? (
                backups.map((backup) => (
                  <tr key={str(backup.backupId)}>
                    <td>
                      <strong>{str(backup.filename)}</strong>
                      <small>{str(backup.backupId)}</small>
                    </td>
                    <td>{formatDateTime(backup.timestamp)}</td>
                    <td>{size(backup.archiveBytes)}</td>
                    <td>
                      {backup.local === true ? "Verified" : "Unavailable"}
                    </td>
                    <td>
                      {backup.offsite === true ? "Verified" : "Not verified"}
                    </td>
                    <td>
                      <div className="button-row">
                        <Button
                          onClick={() =>
                            prepare("backup.full.verify", {
                              backupId: str(backup.backupId),
                            })
                          }
                        >
                          {copy.verify_dda6a}
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() =>
                            prepare("backup.full.delete", {
                              backupId: str(backup.backupId),
                            })
                          }
                        >
                          {copy.delete_f6fdb}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    {copy.no_backups_yet_create_a_restore_point_ff32d}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      {error && (
        <div className="page-notice">
          <Notice tone="error" title={copy.backup_data_unavailable_1a499}>
            {error}
          </Notice>
        </div>
      )}
      <ActionReview prepared={prepared} onClose={() => setPrepared(null)} />
    </>
  );
}

import { Select } from "../components/Select";
import { useEffect, useMemo, useState } from "react";
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
import { useNow, useSession } from "../hooks";
import {
  BACKUP_TIMELINE,
  backupHealth,
  backupReady,
  backupRecoveryRequired,
  durationLabel,
  effectiveBackupPhase,
  effectiveBackupProgress,
  healthCopy,
  isTerminalBackupPhase,
  phaseLabel,
  retryUploadAvailable,
  stepState,
} from "../lib/backup-model";

function size(value: unknown) {
  const n = number(value);
  return n === null ? "Unknown" : `${(n / 2 ** 30).toFixed(2)} GiB`;
}

function percent(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function speed(value: unknown) {
  const n = number(value);
  if (n === null || n <= 0) return "";
  const units = ["B/s", "KiB/s", "MiB/s", "GiB/s"];
  let amount = n;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index++;
  }
  return `${amount.toFixed(index ? 1 : 0)} ${units[index]}`;
}

type Readiness = {
  label: string;
  state: "ready" | "warning" | "blocked" | "unknown";
  detail: string;
};

function readinessTone(state: Readiness["state"]) {
  return state === "ready"
    ? "success"
    : state === "warning"
      ? "warning"
      : state === "blocked"
        ? "error"
        : "neutral";
}

export default function Backups() {
  const snap = useSession();
  const now = useNow();
  const [preflight, setPreflight] = useState<JsonMap>({});
  const [maintenance, setMaintenance] = useState<JsonMap>({});
  const [backups, setBackups] = useState<JsonMap[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [countdown, setCountdown] = useState(300);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    if (snap.phase !== "live") return;
    setRefreshing(true);
    const [preflightResult, statusResult, listResult] = await Promise.allSettled([
      session.query("backup.preflight", {}, "HOST"),
      session.query("maintenance.status", {}, "HOST"),
      session.query("backup.full.list", {}, "HOST"),
    ]);

    const nextErrors: string[] = [];
    if (preflightResult.status === "fulfilled")
      setPreflight(record(preflightResult.value.data));
    else
      nextErrors.push(
        preflightResult.reason instanceof Error
          ? preflightResult.reason.message
          : "Backup preflight unavailable.",
      );

    if (statusResult.status === "fulfilled")
      setMaintenance(record(statusResult.value.data));
    else
      nextErrors.push(
        statusResult.reason instanceof Error
          ? statusResult.reason.message
          : "Maintenance status unavailable.",
      );

    if (listResult.status === "fulfilled")
      setBackups(records(record(listResult.value.data).backups));
    else
      nextErrors.push(
        listResult.reason instanceof Error
          ? listResult.reason.message
          : "Backup inventory unavailable.",
      );

    setErrors(nextErrors);
    setRefreshing(false);
  };

  useEffect(() => {
    if (snap.phase !== "live") return;
    void refresh();
  }, [snap.phase, snap.revision, snap.state.ready?.server.hostSession]);

  const durableOperation = record(maintenance.currentOperation);
  const phasePush = record(snap.state.maintenancePhase);
  const operation = useMemo(() => {
    if (
      str(phasePush.jobId) &&
      (!str(durableOperation.jobId) ||
        str(phasePush.jobId) === str(durableOperation.jobId))
    )
      return { ...durableOperation, ...phasePush };
    return durableOperation;
  }, [durableOperation, phasePush]);

  const progress = snap.state.backupProgress;
  const operationBackup = backups.find(
    (backup) => str(backup.backupId) === str(operation.backupId),
  );
  const resolvedAfterRetry =
    str(operation.phase) === "DEGRADED" && operationBackup?.offsite === true;
  const effectiveOperation = resolvedAfterRetry
    ? {
        ...operation,
        phase: "COMPLETED",
        result: "SUCCESS",
        errorCode: "",
        errorMessage: "",
        remoteBackupVerified: true,
        progressPercent: 100,
      }
    : operation;
  const displayProgress = resolvedAfterRetry ? null : progress;
  const operationKind = str(effectiveOperation.kind, "");
  const isBackupJob =
    !operationKind || operationKind === "FULL_RESTORE_POINT";
  const phase = isBackupJob
    ? effectiveBackupPhase(effectiveOperation, displayProgress)
    : "IDLE";
  const progressPercent = isBackupJob
    ? effectiveBackupProgress(effectiveOperation, displayProgress)
    : 0;
  const recovery = backupRecoveryRequired(
    preflight,
    maintenance,
    effectiveOperation,
  );
  const ready = backupReady(preflight, maintenance, effectiveOperation);
  const hostLive = Boolean(snap.state.ready?.agents.host);
  const preflightKnown = Object.keys(preflight).length > 0;
  const maintenanceKnown = Object.keys(maintenance).length > 0;
  const healthOperation = isBackupJob
    ? effectiveOperation
    : { ...effectiveOperation, phase: "IDLE" };
  const health =
    hostLive && (!preflightKnown || !maintenanceKnown)
      ? "checking"
      : backupHealth({
          hostLive,
          ready,
          recovery,
          operation: healthOperation,
        });
  const copy = healthCopy(health);
  const operationActive =
    isBackupJob &&
    phase !== "IDLE" &&
    !isTerminalBackupPhase(str(effectiveOperation.phase, phase));

  useEffect(() => {
    if (snap.phase !== "live") return;
    const delay = operationActive || recovery ? 3_500 : 15_000;
    const timer = window.setInterval(() => void refresh(), delay);
    return () => window.clearInterval(timer);
  }, [snap.phase, operationActive, recovery, snap.state.ready?.server.hostSession]);

  const prepare = (action: string, parameters: JsonMap) => {
    setErrors([]);
    try {
      setPrepared(session.prepare(action, parameters, "HOST"));
    } catch (cause) {
      setErrors([
        cause instanceof Error ? cause.message : "Action unavailable.",
      ]);
    }
  };

  const provider = record(maintenance.provider);
  const latestBackup = backups[0];
  const localCount = backups.filter((backup) => backup.local === true).length;
  const offsiteCount = backups.filter((backup) => backup.offsite === true).length;
  const verifiedCount = backups.filter(
    (backup) =>
      str(backup.verification).startsWith("VERIFIED") ||
      str(backup.result).startsWith("SUCCESS"),
  ).length;
  const retryAvailable =
    !resolvedAfterRetry &&
    (retryUploadAvailable(operation) ||
      (operationBackup?.local === true && operationBackup?.offsite !== true));
  const countdownRemaining = number(maintenance.countdownRemainingSeconds);
  const progressSpeed = speed(displayProgress?.bytesPerSecond);
  const liveBytes = number(displayProgress?.bytesUploaded ?? displayProgress?.bytes);
  const liveTotal = number(displayProgress?.totalBytes);

  const readiness: Readiness[] = [
    {
      label: "Host authority",
      state:
        preflight.hostAuthenticated === true
          ? "ready"
          : preflight.hostAuthenticated === false
            ? "blocked"
            : "unknown",
      detail:
        preflight.hostAuthenticated === true
          ? "The Host session is authenticated."
          : "A live authenticated Host session is required.",
    },
    {
      label: "Operation lock",
      state:
        preflight.operationBusy === false
          ? "ready"
          : preflight.operationBusy === true
            ? "blocked"
            : "unknown",
      detail:
        preflight.operationBusy === false
          ? "No conflicting destructive operation is running."
          : preflight.operationBusy === true
            ? "Another Host maintenance operation owns the lock."
            : "Lock state has not been reported.",
    },
    {
      label: "Recovery gate",
      state:
        !preflightKnown || !maintenanceKnown
          ? "unknown"
          : recovery
            ? "blocked"
            : "ready",
      detail: recovery
        ? "A durable recovery condition must be resolved before another backup."
        : "No backup or maintenance recovery gate is active.",
    },
    {
      label: "Backup storage",
      state:
        preflight.backupRootWritable === true
          ? "ready"
          : preflight.backupRootWritable === false
            ? "blocked"
            : "unknown",
      detail:
        preflight.backupRootWritable === true
          ? "Host backup storage is writable."
          : "The configured backup root is not confirmed writable.",
    },
    {
      label: "Command channel",
      state:
        preflight.commandChannelConfigured === true
          ? "ready"
          : preflight.commandChannelConfigured === false
            ? "blocked"
            : "unknown",
      detail:
        preflight.commandChannelConfigured === true
          ? "Host-local RCON can perform warnings, final save and readiness checks."
          : "The fixed Host command channel is not available.",
    },
    {
      label: "Host configuration",
      state:
        preflight.hostConfigRestartRequired === true
          ? "warning"
          : preflight.hostConfigRestartRequired === false
            ? "ready"
            : "unknown",
      detail:
        preflight.hostConfigRestartRequired === true
          ? "Host configuration changed on disk; restart Host before a new backup."
          : "The loaded Host configuration matches the current file.",
    },
  ];

  const healthTone =
    health === "ready"
      ? "success"
      : health === "running"
        ? "info"
        : health === "degraded" || health === "recovery" || health === "blocked"
          ? "warning"
          : health === "failed"
            ? "error"
            : "neutral";

  const recommendedAction =
    health === "recovery"
      ? maintenance.jobRecoveryRequired === true
        ? "Verify Minecraft is running and healthy, then review recovery resolution."
        : "Follow the Host restore-recovery procedure before new destructive work."
      : health === "degraded"
        ? retryAvailable
          ? "Retry the offsite upload using the existing verified local archive."
          : "Inspect the remote verification failure and preserve the verified local copy."
        : health === "failed"
          ? "Refresh preflight and review the failure before creating another restore point."
          : health === "blocked"
            ? "Resolve the blocked readiness checks below."
            : health === "checking"
              ? "Waiting for current Host preflight and maintenance state."
              : health === "running"
              ? `Keep the Host online while ${phaseLabel(phase).toLowerCase()} finishes.`
              : backups.length
                ? "Create a new restore point when you are ready."
                : "Create the first verified restore point for this server.";

  return (
    <>
      <section className="backup-control-hero" data-health={health}>
        <div className="backup-health-copy">
          <div className="backup-health-line">
            <Status tone={healthTone}>{phaseLabel(health)}</Status>
            <span>Host-authoritative manual full backup</span>
          </div>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
          <div className="backup-recommendation">
            <strong>Recommended next action</strong>
            <span>{recommendedAction}</span>
          </div>
        </div>

        <div className="backup-summary-grid" aria-label="Backup summary">
          <div>
            <span>Last restore point</span>
            <strong>
              {latestBackup ? formatDateTime(latestBackup.timestamp) : "None yet"}
            </strong>
          </div>
          <div>
            <span>Verified inventory</span>
            <strong>
              {verifiedCount} / {backups.length || 0}
            </strong>
          </div>
          <div>
            <span>Local copies</span>
            <strong>{localCount}</strong>
          </div>
          <div>
            <span>Offsite copies</span>
            <strong>{offsiteCount}</strong>
          </div>
        </div>

        <div className="backup-create">
          <label className="field">
            Player warning
            <Select
              value={countdown}
              onChange={(e) => setCountdown(Number(e.target.value))}
              disabled={operationActive}
            >
              {[300, 600, 900, 1800].map((n) => (
                <option value={n} key={n}>
                  {n / 60} minutes
                </option>
              ))}
            </Select>
          </label>
          <Button
            variant="primary"
            disabled={
              !ready ||
              operationActive ||
              Boolean(session.reason("maintenance.full-backup.create", "HOST"))
            }
            title={
              !ready
                ? "Host preflight must be healthy and recovery must be clear."
                : session.reason("maintenance.full-backup.create", "HOST")
            }
            onClick={() =>
              prepare("maintenance.full-backup.create", {
                countdownSeconds: countdown,
              })
            }
          >
            Review new backup
          </Button>
          {retryAvailable && (
            <Button
              onClick={() =>
                prepare("backup.full.retry-upload", {
                  backupId: str(operation.backupId),
                })
              }
            >
              Retry offsite upload
            </Button>
          )}
          {maintenance.jobRecoveryRequired === true && (
            <Button
              variant="danger"
              onClick={() => prepare("maintenance.recovery.resolve", {})}
            >
              Review recovery resolution
            </Button>
          )}
        </div>
      </section>

      <div className="backup-operations-grid">
        <Panel
          eyebrow="Current Host job"
          title="Backup timeline"
          className="backup-timeline-panel"
          action={
            <Status tone={healthTone}>
              {phase === "IDLE" ? "No active job" : phaseLabel(phase)}
            </Status>
          }
        >
          {!isBackupJob && operationKind && (
            <Notice tone="warning" title="Another Host maintenance job is active">
              {phaseLabel(operationKind)} is currently in the
              {" "}{phaseLabel(str(effectiveOperation.phase, "QUEUED"))} phase.
              Backup creation remains blocked until that Host-owned job finishes.
            </Notice>
          )}

          <div className="backup-job-meta">
            <div>
              <span>Job</span>
              <strong>{str(operation.jobId, "No active job")}</strong>
            </div>
            <div>
              <span>Elapsed</span>
              <strong>
                {str(operation.startedAt)
                  ? durationLabel(
                      operation.startedAt,
                      operation.completedAt,
                      now,
                    )
                  : "—"}
              </strong>
            </div>
            <div>
              <span>Progress</span>
              <strong>{phase === "IDLE" ? "—" : percent(progressPercent)}</strong>
            </div>
            <div>
              <span>Backup ID</span>
              <strong>{str(operation.backupId, str(progress?.backupId, "—"))}</strong>
            </div>
          </div>

          {phase !== "IDLE" && (
            <div className="backup-progress-track" aria-label="Backup job progress">
              <i style={{ width: `${progressPercent}%` }} />
            </div>
          )}

          <div className="backup-stepper" aria-label="Backup phases">
            {BACKUP_TIMELINE.map((step, index) => {
              const state = stepState(step, phase, progressPercent, operation);
              return (
                <div className="backup-step" data-state={state} key={step.key}>
                  <div className="backup-step-marker">
                    <i>{state === "done" ? "✓" : index + 1}</i>
                    {index < BACKUP_TIMELINE.length - 1 && <span />}
                  </div>
                  <div>
                    <strong>{step.label}</strong>
                    <small>{step.detail}</small>
                  </div>
                </div>
              );
            })}
          </div>

          {(phase !== "IDLE" || operationActive) && (
            <div className="backup-live-detail">
              <div>
                <span>Current phase</span>
                <strong>{phaseLabel(phase)}</strong>
              </div>
              {countdownRemaining !== null && phase === "COUNTDOWN" && (
                <div>
                  <span>Countdown remaining</span>
                  <strong>{Math.ceil(countdownRemaining / 60)} min</strong>
                </div>
              )}
              {liveBytes !== null && liveTotal !== null && liveTotal > 0 && (
                <div>
                  <span>Transferred</span>
                  <strong>
                    {size(liveBytes)} / {size(liveTotal)}
                  </strong>
                </div>
              )}
              {progressSpeed && (
                <div>
                  <span>Transfer rate</span>
                  <strong>{progressSpeed}</strong>
                </div>
              )}
            </div>
          )}

          {resolvedAfterRetry && (
            <Notice tone="success" title="Offsite verification recovered">
              The original backup job completed degraded, but a later Retry Upload
              verified the same restore point offsite. No additional server shutdown
              was required.
            </Notice>
          )}

          {!resolvedAfterRetry &&
            Boolean(operation.errorCode || operation.errorMessage) && (
            <Notice
              tone={
                health === "degraded" || health === "recovery"
                  ? "warning"
                  : "error"
              }
              title={str(operation.errorCode, "Backup status")}
            >
              {str(
                operation.errorMessage,
                "The Host reported a backup condition that requires review.",
              )}
            </Notice>
          )}
        </Panel>

        <Panel
          eyebrow="Before another backup"
          title="Backup readiness"
          action={
            <Button onClick={() => void refresh()} disabled={refreshing}>
              {refreshing ? "Refreshing…" : "Refresh status"}
            </Button>
          }
        >
          <div className="backup-readiness-list">
            {readiness.map((item) => (
              <div className="backup-readiness-row" key={item.label}>
                <i data-state={item.state} />
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </div>
                <Status tone={readinessTone(item.state)}>
                  {item.state === "ready"
                    ? "Ready"
                    : item.state === "warning"
                      ? "Attention"
                      : item.state === "blocked"
                        ? "Blocked"
                        : "Unknown"}
                </Status>
              </div>
            ))}
          </div>

          <div className="backup-provider-card">
            <div>
              <span>Offsite provider</span>
              <strong>{str(provider.provider, "Unknown")}</strong>
            </div>
            <div>
              <span>Provider state</span>
              <strong>{str(provider.status, "Unknown")}</strong>
            </div>
            <div>
              <span>Last verified remote</span>
              <strong>
                {str(provider.lastSuccessfulVerificationAt)
                  ? formatDateTime(provider.lastSuccessfulVerificationAt)
                  : "No verified remote yet"}
              </strong>
            </div>
          </div>
        </Panel>
      </div>

      <Panel
        eyebrow="Retained restore points"
        title="Backup inventory"
        className="backup-inventory-panel"
        action={
          <span className="subtle">
            {backups.length} restore point{backups.length === 1 ? "" : "s"}
          </span>
        }
      >
        <div className="backup-inventory-summary">
          <span>
            <b>{localCount}</b> local
          </span>
          <span>
            <b>{offsiteCount}</b> offsite
          </span>
          <span>
            <b>{verifiedCount}</b> verified
          </span>
        </div>
        <p className="table-scroll-hint">Swipe to see archive actions →</p>
        <div className="backup-table table-region" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th>Archive</th>
                <th>Created</th>
                <th>Size</th>
                <th>Local</th>
                <th>Offsite</th>
                <th>Verification</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {backups.length ? (
                backups.map((backup) => {
                  const local = backup.local === true;
                  const offsite = backup.offsite === true;
                  const verification = str(backup.verification, "Unknown");
                  return (
                    <tr key={str(backup.backupId)}>
                      <td>
                        <strong>{str(backup.filename, "Restore point")}</strong>
                        <small>{str(backup.backupId)}</small>
                      </td>
                      <td>{formatDateTime(backup.timestamp)}</td>
                      <td>{size(backup.archiveBytes)}</td>
                      <td>
                        <Status tone={local ? "success" : "neutral"}>
                          {local ? "Available" : "Released"}
                        </Status>
                      </td>
                      <td>
                        <Status
                          tone={
                            offsite
                              ? "success"
                              : local
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {offsite ? "Verified" : "Not verified"}
                        </Status>
                      </td>
                      <td>
                        <code>{verification}</code>
                        {Boolean(backup.errorCode) && (
                          <small>{str(backup.errorCode)}</small>
                        )}
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
                            Verify
                          </Button>
                          {local && !offsite && (
                            <Button
                              onClick={() =>
                                prepare("backup.full.retry-upload", {
                                  backupId: str(backup.backupId),
                                })
                              }
                            >
                              Retry upload
                            </Button>
                          )}
                          <Button
                            variant="danger"
                            onClick={() =>
                              prepare("backup.full.delete", {
                                backupId: str(backup.backupId),
                              })
                            }
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7}>
                    <div className="backup-empty-state">
                      <strong>No restore points yet</strong>
                      <span>
                        {ready
                          ? "Host preflight is healthy. Create the first verified backup when ready."
                          : "Resolve the readiness checks before creating the first restore point."}
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {errors.length > 0 && (
        <div className="page-notice">
          <Notice tone="warning" title="Partial backup data">
            {errors.join(" ")}
          </Notice>
        </div>
      )}

      <ActionReview
        prepared={prepared}
        onClose={() => setPrepared(null)}
        onComplete={() => void refresh()}
      />
    </>
  );
}

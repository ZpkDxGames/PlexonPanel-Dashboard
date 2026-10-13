import { Select } from "../components/Select";
import { useCallback, useEffect, useRef, useState } from "react";
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
  backupView,
  durationLabel,
  healthCopy,
  phaseLabel,
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
  const [evidence, setEvidence] = useState<{
    key: string;
    preflight: JsonMap;
    maintenance: JsonMap;
    backups: JsonMap[];
    errors: string[];
    preflightFailure: string;
    inventoryKnown: boolean;
  }>({ key: "", preflight: {}, maintenance: {}, backups: [], errors: [], preflightFailure: "", inventoryKnown: false });
  const identity = `${snap.revision}:${snap.state.serverId}:${snap.state.ready?.server.hostSession ?? ""}`;
  const generation = useRef(identity);
  generation.current = identity;
  const inFlight = useRef<string | null>(null);
  const current: Omit<typeof evidence, "key"> =
    evidence.key === identity
      ? evidence
      : { preflight: {}, maintenance: {}, backups: [], errors: [], preflightFailure: "", inventoryKnown: false };
  const { preflight, maintenance, backups, errors, preflightFailure, inventoryKnown } = current;
  const setErrors = (next: string[]) =>
    setEvidence((value) => ({ ...value, errors: next }));
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [countdown, setCountdown] = useState(300);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (
      snap.phase !== "live" ||
      !snap.state.ready?.agents.host ||
      inFlight.current === identity
    )
      return;
    inFlight.current = identity;
    setRefreshing(true);
    const result = await Promise.allSettled([
      session.query("backup.preflight", {}, "HOST"),
      session.query("maintenance.status", {}, "HOST"),
      session.query("backup.full.list", {}, "HOST"),
    ]);
    if (generation.current !== identity) return;
    const failures: string[] = [];
    const data = result.map((r, i) => {
      if (r.status === "fulfilled" && r.value.status === "SUCCESS")
        return record(r.value.data);
      const label = [
        "Backup preflight",
        "Maintenance status",
        "Backup inventory",
      ][i];
      const detail =
        r.status === "fulfilled"
          ? `${r.value.code ?? ""}: ${r.value.message ?? "Unavailable"} ${str(record(r.value.data).safeRelativePath, "")}`
          : r.reason instanceof Error
            ? r.reason.message
            : "Unavailable";
      failures.push(`${label}: ${detail}`);
      return {};
    });
    setEvidence({
      key: identity,
      preflight: data[0],
      maintenance: data[1],
      backups: records(data[2].backups),
      inventoryKnown: result[2].status === "fulfilled" && result[2].value.status === "SUCCESS",
      errors: failures,
      preflightFailure: result[0].status === "fulfilled" && result[0].value.status !== "SUCCESS"
        ? result[0].value.code ?? "PREFLIGHT_FAILED" : "",
    });
    inFlight.current = null;
    setRefreshing(false);
  }, [identity, snap.phase, snap.state.ready?.agents.host]);
  const progress = snap.state.backupProgress;
  const model = backupView({
    hostLive: snap.phase === "live" && Boolean(snap.state.ready?.agents.host),
    preflight,
    maintenance,
    phasePush: record(snap.state.maintenancePhase),
    progress,
    backups,
    preflightFailure,
  });
  const {
    operation,
    phase,
    health,
    recovery,
    ready,
    progressPercent,
    resolvedAfterRetry,
    retryAvailable,
  } = model;
  const effectiveOperation = operation;
  const operationKind = str(operation.kind, "");
  const isBackupJob = !operationKind || operationKind === "FULL_RESTORE_POINT";
  const operationActive = model.active;
  const displayProgress = progress;
  const preflightKnown = Object.keys(preflight).length > 0,
    maintenanceKnown = Object.keys(maintenance).length > 0;
  const copy = healthCopy(health);
  useEffect(() => {
    generation.current = identity;
    setPrepared(null);
    void refresh();
    const timer = window.setInterval(
      () => void refresh(),
      operationActive || recovery ? 3500 : 15000,
    );
    return () => {
      window.clearInterval(timer);
      if (generation.current === identity) generation.current = "";
    };
  }, [refresh, operationActive, recovery, identity]);

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
  const latestSuccessful = backups.find((backup) => str(backup.result, "").startsWith("SUCCESS"));
  const latestOffsite = backups.find((backup) => backup.offsite === true);
  const localCount = backups.filter((backup) => backup.local === true).length;
  const offsiteCount = backups.filter(
    (backup) => backup.offsite === true,
  ).length;
  const verifiedCount = backups.filter(
    (backup) =>
      str(backup.verification).startsWith("VERIFIED") ||
      str(backup.result).startsWith("SUCCESS"),
  ).length;
  const countdownRemaining = number(maintenance.countdownRemainingSeconds);
  const progressSpeed = speed(displayProgress?.bytesPerSecond);
  const liveBytes = number(
    displayProgress?.bytesUploaded ?? displayProgress?.bytes,
  );
  const liveTotal = number(displayProgress?.totalBytes);

  const readiness: Readiness[] = [
    {
      label: "Backup source",
      state: /^(BACKUP_SOURCE_|BACKUP_INCLUDE_|BACKUP_SYMLINK_|BACKUP_ENTRY_|BACKUP_SIZE_)/.test(preflightFailure)
        ? "blocked" : preflightKnown ? "ready" : "unknown",
      detail: preflightKnown
        ? "Configured sources passed the Host source scan."
        : (errors.find((e) => e.startsWith("Backup preflight:")) ??
          "Source readability has not been reported."),
    },
    {
      label: "Offsite provider",
      state:
        provider.status === "CONNECTED"
          ? "ready"
          : provider.status
            ? "warning"
            : "unknown",
      detail: str(provider.status, "Provider status has not been reported."),
    },
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
        recovery
          ? "blocked"
          : !preflightKnown || !maintenanceKnown
            ? "unknown"
            : "ready",
      detail: recovery
        ? "A durable recovery condition must be resolved before another backup."
        : preflightKnown && maintenanceKnown
          ? "No backup or maintenance recovery gate is active."
          : "Recovery state has not been fully reported.",
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
          : preflight.hostConfigRestartRequired === false
            ? "The loaded Host configuration matches the current file."
            : "Host configuration state has not been reported.",
    },
  ];

  const healthTone =
    health === "ready"
      ? "success"
      : health === "running" || health === "verifying"
        ? "info"
        : health === "degraded" || health === "recovery" || health === "blocked"
          ? "warning"
          : health === "failed"
            ? "error"
            : "neutral";

  return (
    <>
      <section className="backup-status-strip" data-health={health}>
        <div className="backup-health-copy">
          <div className="backup-health-line">
            <Status tone={healthTone}>{phaseLabel(health)}</Status>
            <span>Host-authoritative manual full backup</span>
          </div>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>

        <div className="backup-summary-grid" role="group" aria-label="Backup summary">
          <div>
            <span>Last successful backup</span>
            <strong>
              {latestSuccessful
                ? formatDateTime(latestSuccessful.timestamp)
                : inventoryKnown ? "None yet" : "Unavailable"}
            </strong>
          </div>
          <div>
            <span>Last verified offsite backup</span>
            <strong>{latestOffsite ? formatDateTime(latestOffsite.timestamp) : inventoryKnown ? "None yet" : "Unavailable"}</strong>
          </div>
          <div>
            <span>Provider</span>
            <strong>{str(provider.provider, "Unknown")} · {str(provider.status, "Unknown")}</strong>
          </div>
          <div>
            <span>Host authority</span>
            <strong>{snap.phase === "live" && snap.state.ready?.agents.host ? "Connected" : "Unavailable"}</strong>
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
        </div>
      </section>

      {recovery && (
        <Panel title="Recovery evidence" eyebrow="Host safety gate">
          <Notice
            tone="warning"
            title={str(operation.errorCode, "Recovery required")}
          >
            {str(
              operation.errorMessage,
              "Review the durable Host failure before resolving recovery.",
            )}
          </Notice>
          <p>
            Failure stage: {str(operation.phase)} · Minecraft stopped by Host:{" "}
            {operation.hostStoppedServer === true
              ? "Yes"
              : operation.hostStoppedServer === false
                ? "No"
                : "Unknown"}
          </p>
          <p>
            Service: {str(snap.state.service.state, "Unknown")} · RCON
            readiness:{" "}
            {snap.state.service.minecraftReady === true
              ? "Ready"
              : "Not verified"}
          </p>
          <p>
            Inspect archive partials and confirm that no destructive job owns
            the operation lock. Resolution rechecks the exact Minecraft service
            and Host-local RCON; it does not mark this backup successful.
          </p>
          {maintenance.jobRecoveryRequired === true && (
            <Button
              variant="danger"
              onClick={() => prepare("maintenance.recovery.resolve", {})}
            >
              Review recovery resolution
            </Button>
          )}
        </Panel>
      )}
      <div className="backup-operations-grid">
        {str(operation.jobId, "") && (
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
              <Notice
                tone="warning"
                title="Another Host maintenance job is active"
              >
                {phaseLabel(operationKind)} is currently in the{" "}
                {phaseLabel(str(effectiveOperation.phase, "QUEUED"))} phase.
                Backup creation remains blocked until that Host-owned job
                finishes.
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
                <strong>
                  {phase === "IDLE" || progressPercent === null ? "—" : percent(progressPercent)}
                </strong>
              </div>
              <div>
                <span>Backup ID</span>
                <strong>
                  {str(operation.backupId, str(progress?.backupId, "—"))}
                </strong>
              </div>
            </div>

            {phase !== "IDLE" && progressPercent !== null && (
              <div
                className="backup-progress-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPercent}
                aria-label="Backup job progress"
              >
                <i style={{ width: `${progressPercent}%` }} />
              </div>
            )}

            <div className="backup-stepper" role="group" aria-label="Backup phases">
              {BACKUP_TIMELINE.map((step, index) => {
                const state = stepState(
                  step,
                  phase,
                  progressPercent,
                  operation,
                );
                return (
                  <div
                    className="backup-step"
                    data-state={state}
                    key={step.key}
                  >
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
                The original backup job completed degraded, but a later Retry
                Upload verified the same restore point offsite. No additional
                server shutdown was required.
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
        )}

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
            {inventoryKnown ? `${backups.length} restore point${backups.length === 1 ? "" : "s"}` : "Inventory unavailable"}
          </span>
        }
      >
        <div className="backup-inventory-summary">
          <span>
            <b>{inventoryKnown ? localCount : "—"}</b> local
          </span>
          <span>
            <b>{inventoryKnown ? offsiteCount : "—"}</b> offsite
          </span>
          <span>
            <b>{inventoryKnown ? verifiedCount : "—"}</b> verified
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
                            offsite ? "success" : local ? "warning" : "neutral"
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
                      <strong>{inventoryKnown ? "No restore points yet" : "Inventory unavailable"}</strong>
                      <span>
                        {!inventoryKnown ? "Waiting for current Host restore-point evidence." : ready
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

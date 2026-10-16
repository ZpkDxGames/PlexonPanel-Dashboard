import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  number,
  record,
  records,
  str,
  type JsonMap,
} from "../adapter/control-state";
import { session, type Prepared } from "../adapter/session";
import { ActionReview } from "../features/ActionReview";
import { Button, Notice, Panel, Status } from "../components/ui";
import { Icon } from "../components/Icon";
import { SectionLabel } from "../components/Telemetry";
import { useSession, useNow } from "../hooks";
import { bytes } from "../store/selectors";
const phases = [
  ["QUEUED", "Queued"],
  ["PREFLIGHT", "Preflight"],
  ["COUNTDOWN", "Player warning"],
  ["FINAL_SAVE", "Final save"],
  ["STOPPING_SERVER", "Stopping service"],
  ["WAITING_FOR_STOP", "Shutdown proof"],
  ["ARCHIVING", "Archive"],
  ["HASHING", "SHA-256"],
  ["VERIFYING_LOCAL", "Local verification"],
  ["UPLOADING_REMOTE", "Upload"],
  ["VERIFYING_REMOTE", "Remote verification"],
  ["CLEANING_LOCAL", "Disk cleanup"],
  ["STARTING_SERVER", "Start service"],
  ["VERIFYING_STARTUP", "Startup readiness"],
  ["COMPLETED", "Complete"],
] as const;
const terminal = new Set([
  "COMPLETED",
  "DEGRADED",
  "FAILED",
  "RECOVERY_REQUIRED",
  "IDLE",
]);
function size(value: unknown) {
  const reading = bytes(value);
  return reading.available
    ? `${reading.value} ${reading.unit}`
    : "Not reported";
}
export default function Backups() {
  const snap = useSession(),
    now = useNow(),
    [preflight, setPreflight] = useState<JsonMap>({}),
    [operation, setOperation] = useState<JsonMap>({}),
    [backups, setBackups] = useState<JsonMap[]>([]),
    [error, setError] = useState(""),
    [prepared, setPrepared] = useState<Prepared | null>(null),
    [countdown, setCountdown] = useState(900),
    [loading, setLoading] = useState(false),
    [checkedAt, setCheckedAt] = useState(0),
    [statusAt, setStatusAt] = useState(0);
  const mounted = useRef(true),
    sequence = useRef(0);
  const refresh = async (statusOnly = false) => {
    const ticket = ++sequence.current;
    if (!statusOnly) {
      setLoading(true);
      setPreflight({});
      setCheckedAt(0);
    }
    setError("");
    const tasks = statusOnly
      ? [session.query("maintenance.status", {}, "HOST")]
      : [
          session.query("backup.preflight", {}, "HOST"),
          session.query("maintenance.status", {}, "HOST"),
          session.query("backup.full.list", {}, "HOST"),
        ];
    const results = await Promise.allSettled(tasks);
    if (!mounted.current || ticket !== sequence.current) return;
    const failures: string[] = [];
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        failures.push(
          result.reason instanceof Error
            ? result.reason.message
            : "Host query unavailable.",
        );
        return;
      }
      const data = record(result.value.data);
      if (statusOnly || index === 1) {
        setOperation(record(data.currentOperation));
        setStatusAt(Date.now());
      } else if (index === 0) {
        setPreflight(data);
        setCheckedAt(Date.now());
      } else setBackups(records(data.backups));
    });
    setError([...new Set(failures)].join(" "));
    setLoading(false);
  };
  useEffect(() => {
    mounted.current = true;
    if (snap.phase === "live") void refresh();
    return () => {
      mounted.current = false;
      sequence.current++;
    };
  }, [snap.phase, snap.revision]);
  const phase = str(operation.phase, "IDLE"),
    jobId = str(operation.jobId, ""),
    active = !terminal.has(phase),
    currentIndex = phases.findIndex(([key]) => key === phase);
  useEffect(() => {
    if (!active || snap.phase !== "live") return;
    const timer = setInterval(() => {
      if (!document.hidden) void refresh(true);
    }, 3000);
    return () => clearInterval(timer);
  }, [active, snap.phase, snap.revision]);
  const fresh = checkedAt > 0 && now - checkedAt <= 30000,
    ready =
      fresh &&
      preflight.hostAuthenticated === true &&
      preflight.operationBusy === false &&
      preflight.recoveryRequired === false &&
      preflight.backupRootWritable === true &&
      preflight.commandChannelConfigured === true;
  const raw = snap.state.backupProgress,
    progress =
      raw && jobId && str(raw.jobId, "") === jobId && active ? raw : null,
    progressPhase = str(progress?.phase, phase),
    value = number(progress?.progress),
    processed = number(progress?.bytesUploaded ?? progress?.bytes),
    total = number(progress?.totalBytes),
    durablePercent = number(operation.progressPercent);
  const ratio =
    value !== null
      ? Math.max(0, Math.min(1, value))
      : processed !== null && total !== null && total > 0
        ? Math.max(0, Math.min(1, processed / total))
        : durablePercent !== null
          ? Math.max(0, Math.min(1, durablePercent / 100))
          : null;
  const prepare = (action: string, parameters: JsonMap) => {
    try {
      setPrepared(session.prepare(action, parameters, "HOST"));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Operation unavailable.",
      );
    }
  };
  const gate = (value: unknown, inverse = false) =>
    value === true
      ? inverse
        ? "Blocked"
        : "Ready"
      : value === false
        ? inverse
          ? "Ready"
          : "Blocked"
        : "Unknown";
  const gates = [
    ["Host authenticated", gate(preflight.hostAuthenticated)],
    ["Operation clear", gate(preflight.operationBusy, true)],
    ["Recovery clear", gate(preflight.recoveryRequired, true)],
    ["Storage writable", gate(preflight.backupRootWritable)],
    ["Command channel", gate(preflight.commandChannelConfigured)],
  ];
  const title =
    phase === "IDLE"
      ? ready
        ? "Create a full restore point"
        : "Backup readiness"
      : phase === "DEGRADED"
        ? "Your off-site copy needs attention."
        : phase === "RECOVERY_REQUIRED"
          ? "Host recovery requires attention."
          : `Operation / ${phase.replaceAll("_", " ").toLowerCase()}`;
  return (
    <>
      <section className="backup-titlebar">
        <div>
          <span className="eyebrow">MANUAL FULL BACKUPS</span>
          <h2>{title}</h2>
          <p>
            A full backup saves your worlds, stops the exact service, verifies
            the archive and off-site copy, then brings Minecraft back online.
          </p>
        </div>
        <div className="backup-create">
          <label className="field">
            Player warning countdown
            <select
              value={countdown}
              onChange={(e) => setCountdown(Number(e.target.value))}
            >
              {[1800, 900, 600, 300].map((seconds) => (
                <option key={seconds} value={seconds}>
                  {seconds / 60} minutes
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="primary"
            disabled={
              !ready ||
              !!session.reason("maintenance.full-backup.create", "HOST")
            }
            title={
              !ready
                ? "Refresh and pass every authoritative preflight check."
                : session.reason("maintenance.full-backup.create", "HOST")
            }
            onClick={() =>
              prepare("maintenance.full-backup.create", {
                countdownSeconds: countdown,
              })
            }
          >
            <Icon name="backups" />
            Review new backup
          </Button>
        </div>
      </section>
      <div className="readiness-band">
        {" "}
        <Panel
          eyebrow="HOST EVIDENCE"
          title="Preflight checklist"
          description={
            fresh
              ? "Authoritative checks from the Host."
              : "Refresh evidence before creating a backup."
          }
        >
          <dl className="gate-list">
            {gates.map(([label, value]) => (
              <div className="gate-item" key={label}>
                <dt>{label}</dt>
                <dd>
                  <Status
                    tone={
                      fresh && value === "Ready"
                        ? "success"
                        : value === "Blocked"
                          ? "error"
                          : "neutral"
                    }
                  >
                    {fresh ? value : "Unknown"}
                  </Status>
                </dd>
              </div>
            ))}
          </dl>
          <div className="panel-actions">
            <Button
              loading={loading}
              disabled={!!session.reason("backup.preflight", "HOST")}
              title={session.reason("backup.preflight", "HOST")}
              onClick={() => void refresh()}
            >
              Refresh evidence
            </Button>
          </div>
          <p className="preflight-note">
            Unknown or expired checks keep creation disabled. A provider
            connectivity check does not certify an off-site backup.
          </p>
        </Panel>
      </div>
      <div className="backup-workspace">
        <div className="archive-book">
          {" "}
          <SectionLabel
            index=""
            title="Archive inventory"
            detail={`${backups.length} reported restore points`}
          />
          <Panel>
            <div
              className="backup-table table-region"
              tabIndex={0}
              role="region"
              aria-label="Backup archive inventory"
            >
              <table>
                <thead>
                  <tr>
                    <th>Restore point</th>
                    <th>Created</th>
                    <th>Archive size</th>
                    <th>Local copy</th>
                    <th>Off-site copy</th>
                    <th>Operations</th>
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
                        <td>{str(backup.timestamp)}</td>
                        <td>{size(backup.archiveBytes)}</td>
                        <td>
                          <Status
                            tone={backup.local === true ? "success" : "neutral"}
                          >
                            {backup.local === true
                              ? "Available"
                              : backup.local === false
                                ? "Absent"
                                : "Unknown"}
                          </Status>
                        </td>
                        <td>
                          <Status
                            tone={
                              backup.offsite === true ? "success" : "warning"
                            }
                          >
                            {backup.offsite === true
                              ? "Available"
                              : backup.offsite === false
                                ? "Absent"
                                : "Unknown"}
                          </Status>
                        </td>
                        <td>
                          <div className="button-row">
                            <Button
                              disabled={
                                !!session.reason("backup.full.verify", "HOST")
                              }
                              onClick={() =>
                                prepare("backup.full.verify", {
                                  backupId: str(backup.backupId),
                                })
                              }
                            >
                              Verify
                            </Button>
                            <Button
                              variant="danger"
                              disabled={
                                !!session.reason("backup.full.delete", "HOST")
                              }
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
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>No authorized inventory received.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
        <aside className="job-book">
          {" "}
          <Panel
            eyebrow="DURABLE HOST WORKFLOW"
            title={
              phase === "IDLE" ? "No reported operation" : "Latest Host job"
            }
            description={
              jobId
                ? `Job ${jobId}`
                : "The Host owns every phase, including recovery."
            }
            action={
              <Status
                tone={
                  phase === "DEGRADED"
                    ? "warning"
                    : phase === "FAILED" || phase === "RECOVERY_REQUIRED"
                      ? "error"
                      : phase === "COMPLETED"
                        ? "success"
                        : active
                          ? "info"
                          : "neutral"
                }
              >
                {phase}
              </Status>
            }
          >
            <div className="operation-register">
              <div>
                <span>Local verification</span>
                <Status
                  tone={
                    operation.localBackupVerified === true
                      ? "success"
                      : "neutral"
                  }
                >
                  {operation.localBackupVerified === true
                    ? "Verified"
                    : operation.localBackupVerified === false
                      ? "Not verified"
                      : "Unknown"}
                </Status>
              </div>
              <div>
                <span>Remote verification</span>
                <Status
                  tone={
                    operation.remoteBackupVerified === true
                      ? "success"
                      : "warning"
                  }
                >
                  {operation.remoteBackupVerified === true
                    ? "Verified"
                    : operation.remoteBackupVerified === false
                      ? "Not verified"
                      : "Unknown"}
                </Status>
              </div>
            </div>
            <div
              className="phase-timeline"
              aria-label="Backup operation phases"
            >
              {phases.map(([key, label], index) => (
                <div
                  key={key}
                  aria-current={index === currentIndex ? "step" : undefined}
                  title={
                    index < currentIndex
                      ? "Earlier workflow position; this is not a per-stage completion record."
                      : undefined
                  }
                  className={
                    currentIndex < 0
                      ? "pending"
                      : index < currentIndex
                        ? "prior"
                        : index === currentIndex
                          ? "current"
                          : "pending"
                  }
                >
                  <i />
                  <span>{label}</span>
                </div>
              ))}
            </div>
            {active && (
              <section
                className={`backup-progress ${ratio === null ? "indeterminate" : ""}`}
              >
                <header>
                  <div>
                    <span>Reported Host progress</span>
                    <strong>{progressPhase.replaceAll("_", " ")}</strong>
                  </div>
                  <strong>
                    {ratio === null ? "—" : `${Math.round(ratio * 100)}%`}
                  </strong>
                </header>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label="Reported backup progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={
                    ratio === null ? undefined : Math.round(ratio * 100)
                  }
                >
                  <i style={{ "--progress": ratio ?? 0 } as CSSProperties} />
                </div>
                <div className="backup-progress-meta">
                  <span>
                    Processed
                    <strong>
                      {size(processed)} / {size(total)}
                    </strong>
                  </span>
                  <span>
                    Transfer rate
                    <strong>
                      {number(progress?.bytesPerSecond) === null
                        ? "Not reported"
                        : `${size(progress?.bytesPerSecond)}/s`}
                    </strong>
                  </span>
                  <span>
                    Provider
                    <strong>
                      {str(progress?.providerState, "Not reported")}
                    </strong>
                  </span>
                </div>
                {phase === "COUNTDOWN" && (
                  <p className="subtle">
                    Host countdown:{" "}
                    {number(operation.remainingSeconds) ?? "Not reported"}{" "}
                    seconds remaining.
                  </p>
                )}
              </section>
            )}
            {operation.message !== undefined && (
              <div className="operation-message">
                <Notice
                  tone={phase === "DEGRADED" ? "warning" : "neutral"}
                  title={str(operation.errorCode, "Host status")}
                >
                  {str(operation.message)}
                </Notice>
              </div>
            )}
            {phase === "DEGRADED" && (
              <div className="degraded-summary">
                <div>
                  <strong>
                    {operation.localBackupVerified === true
                      ? "Local archive verified. Off-site verification is incomplete."
                      : "The Host reported a degraded operation."}
                  </strong>
                  <span>
                    Upload retry reuses the existing archive without another
                    shutdown.
                  </span>
                </div>
                {operation.retryable === true && (
                  <Button
                    disabled={
                      !!session.reason("backup.full.retry-upload", "HOST")
                    }
                    onClick={() =>
                      prepare("backup.full.retry-upload", {
                        backupId: str(operation.backupId),
                      })
                    }
                  >
                    Review upload retry
                  </Button>
                )}
              </div>
            )}
            <div className="journal-footnote">
              <p>
                Workflow order only. The highlighted phase is reported by the
                Host; earlier stages may have been skipped.
              </p>
              {statusAt
                ? `Host status read ${new Date(statusAt).toLocaleTimeString()}. Closing this browser does not cancel a job.`
                : "No durable Host status received."}
            </div>
          </Panel>
        </aside>
      </div>
      {error && (
        <div className="page-notice">
          <Notice tone="error" title="Host evidence unavailable">
            {error}
          </Notice>
        </div>
      )}
      <ActionReview
        prepared={prepared}
        onClose={() => {
          setPrepared(null);
          void refresh();
        }}
      />
    </>
  );
}

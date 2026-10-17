import { BackupScheduleCard } from "../components/BackupScheduleCard";
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
import { useTimestamp } from "../presentation/nextgen/time";
import { ActionAvailability } from "../components/nextgen/ActionAvailability";
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
  const stamp = useTimestamp();
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
    [statusAt, setStatusAt] = useState(0),
    [reads, setReads] = useState<
      Record<string, { state: string; error: string; at: number }>
    >({});
  const mounted = useRef(true),
    sequence = useRef(0),
    fullPending = useRef(false);
  const refresh = async (statusOnly = false) => {
    if (statusOnly && fullPending.current) return;
    const ticket = ++sequence.current;
    if (!statusOnly) fullPending.current = true;
    if (!statusOnly) {
      setLoading(true);
      setReads((old) =>
        Object.fromEntries(
          ["preflight", "status", "inventory"].map((key) => [
            key,
            { state: "loading", error: "", at: old[key]?.at ?? 0 },
          ]),
        ),
      );
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
    const nextReads: Record<
      string,
      { state: string; error: string; at: number }
    > = {};
    results.forEach((result, index) => {
      const key = statusOnly
        ? "status"
        : ["preflight", "status", "inventory"][index];
      if (result.status === "rejected" || result.value.status !== "SUCCESS") {
        const message =
          result.status === "rejected"
            ? result.reason instanceof Error
              ? result.reason.message
              : "Host query unavailable."
            : result.value.message || result.value.code;
        nextReads[key] = { state: "failed", error: message, at: 0 };
        if (key === "preflight") setCheckedAt(0);
        return;
      }
      nextReads[key] = { state: "received", error: "", at: Date.now() };
      const data = record(result.value.data);
      if (statusOnly || index === 1) {
        setOperation(record(data.currentOperation));
        setStatusAt(Date.now());
      } else if (index === 0) {
        setPreflight(data);
        setCheckedAt(Date.now());
      } else setBackups(records(data.backups));
    });
    setReads((old) => ({ ...old, ...nextReads }));
    fullPending.current = false;
    setLoading(false);
  };
  useEffect(() => {
    mounted.current = true;
    if (snap.phase === "live") void refresh();
    return () => {
      mounted.current = false;
      sequence.current++;
      fullPending.current = false;
    };
  }, [snap.phase, snap.revision]);
  const phase = str(operation.phase, "IDLE"),
    jobId = str(operation.jobId, ""),
    active = !terminal.has(phase);
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
      reads.preflight?.state === "received" &&
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
      <aside className="job-book">
        {" "}
        <Panel
          eyebrow="DURABLE HOST WORKFLOW"
          title={phase === "IDLE" ? "No reported operation" : "Latest Host job"}
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
          <p className="read-evidence">
            {reads.status?.error
              ? `Status read unavailable: ${reads.status.error}. Showing last received evidence.`
              : statusAt
                ? `Host status · ${Math.max(0, Math.floor((now - statusAt) / 1000))}s since receipt${now - statusAt > 30000 ? " · stale" : ""}`
                : "No durable Host status received."}
          </p>
          <div className="operation-register">
            <div>
              <span>Local verification</span>
              <Status
                tone={
                  operation.localBackupVerified === true ? "success" : "neutral"
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
              <ActionAvailability
                reason={session.reason("backup.full.retry-upload", "HOST")}
              />
              <span>
                Upload retry reuses the existing archive without another
                shutdown.
              </span>
            </div>
          )}
          <details className="phase-details">
            <summary>Phase details · {phase}</summary>
            <div
              className="phase-timeline"
              aria-label="Backup operation phases"
            >
              {[
                ["Prepare", 0, 3],
                ["Stop", 3, 6],
                ["Archive", 6, 9],
                ["Off-site", 9, 12],
                ["Return online", 12, 15],
              ].map(([label, start, end]) => (
                <details className="phase-group" key={String(label)}>
                  <summary>
                    {label}
                    {phases
                      .slice(Number(start), Number(end))
                      .some(([key]) => key === phase)
                      ? " · reported now"
                      : ""}
                  </summary>
                  {phases
                    .slice(Number(start), Number(end))
                    .map(([key, title]) => (
                      <div
                        key={key}
                        aria-current={key === phase ? "step" : undefined}
                        className={key === phase ? "current" : "pending"}
                      >
                        <i />
                        {title}
                        <small>{key}</small>
                      </div>
                    ))}
                </details>
              ))}
            </div>
          </details>
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
                  {number(operation.remainingSeconds) ?? "Not reported"} seconds
                  remaining.
                </p>
              )}
            </section>
          )}
          {operation.restartRecoveryRequired !== undefined && (
            <p className="read-evidence">
              Restart recovery:{" "}
              {operation.restartRecoveryRequired === true
                ? "Required · follow the Host operator procedure"
                : operation.restartRecoveryRequired === false
                  ? "Not required by Host"
                  : "Unknown"}
            </p>
          )}
          <div className="journal-footnote">
            <p>
              Workflow order only. The highlighted phase is reported by the
              Host; earlier stages may have been skipped.
            </p>
            {statusAt
              ? `Host status read ${stamp(statusAt)}. Closing this browser does not cancel a job.`
              : "No durable Host status received."}
          </div>
        </Panel>
      </aside>
      <BackupScheduleCard />
      <div className="backup-create-preflight">
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
                {[1800, 900, 600, 300, 0].map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds === 0
                      ? "No countdown · Host must verify empty"
                      : `${seconds / 60} minutes`}
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
          <ActionAvailability
            reason={
              !ready
                ? "Creation requires fresh successful Host preflight. Unknown or expired checks keep creation disabled."
                : session.reason("maintenance.full-backup.create", "HOST")
            }
          />
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
            {reads.preflight?.error && (
              <p className="read-error" role="status">
                Preflight unavailable: {reads.preflight.error}. Unreported
                checks remain Unknown.
              </p>
            )}
            <dl className="preflight-facts">
              <dt>Provider</dt>
              <dd>
                {str(preflight.provider, "Unknown")} ·{" "}
                {str(preflight.providerStatus, "Unknown")}
                {!fresh && " · last received / not current readiness"}
              </dd>
              <dt>Source size</dt>
              <dd>{size(preflight.sourceBytes)}</dd>
              <dt>Source entries</dt>
              <dd>
                {number(preflight.entryCount)?.toLocaleString() ?? "Unknown"}
              </dd>
              <dt>Usable storage</dt>
              <dd>{size(preflight.usableBytes)}</dd>
              <dt>Required storage</dt>
              <dd>{size(preflight.requiredBytes)}</dd>
            </dl>
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
              <ActionAvailability
                reason={session.reason("backup.preflight", "HOST")}
              />
            </div>
            <p className="preflight-note">
              Unknown or expired checks keep creation disabled. A provider
              connectivity check does not certify an off-site backup.
            </p>
          </Panel>
        </div>
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
            <p className="read-evidence">
              {reads.inventory?.error
                ? `Inventory read unavailable: ${reads.inventory.error}. Last received records retained.`
                : reads.inventory?.state === "received"
                  ? `Host inventory received ${stamp(reads.inventory.at)}. Availability is separate from verification.`
                  : "Reading authorized Host inventory…"}
            </p>
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
                        <td>
                          <time title={str(backup.timestamp)}>
                            {stamp(backup.timestamp)}
                          </time>
                        </td>
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
                          <ActionAvailability
                            reason={[
                              ...new Set(
                                [
                                  session.reason("backup.full.verify", "HOST"),
                                  session.reason("backup.full.delete", "HOST"),
                                ].filter(Boolean),
                              ),
                            ].join(" ")}
                          />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        {reads.inventory?.state === "received"
                          ? "Host reported an empty archive inventory."
                          : "No current authorized inventory received."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
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

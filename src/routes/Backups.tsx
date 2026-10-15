import { useEffect, useState, type CSSProperties } from "react";
import { number, record, records, str, type JsonMap } from "../adapter/control-state";
import { session, type Prepared } from "../adapter/session";
import { ActionReview } from "../features/ActionReview";
import { Button, Notice, Panel, Status } from "../components/ui";
import { useSession } from "../hooks";

const phases = [
  ["QUEUED", "Queued"], ["PREFLIGHT", "Preflight"], ["COUNTDOWN", "Player warning"], ["FINAL_SAVE", "Saving"],
  ["STOPPING_SERVER", "Stopping"], ["WAITING_FOR_STOP", "Shutdown check"], ["ARCHIVING", "Creating ZIP"], ["HASHING", "ZIP verification"],
  ["VERIFYING_LOCAL", "Local verification"], ["UPLOADING_REMOTE", "Remote upload"], ["VERIFYING_REMOTE", "Remote verification"],
  ["CLEANING_LOCAL", "VPS cleanup"], ["STARTING_SERVER", "Starting"], ["VERIFYING_STARTUP", "Readiness check"], ["COMPLETED", "Complete"],
] as const;
const terminalPhases = new Set(["COMPLETED", "DEGRADED", "FAILED", "RECOVERY_REQUIRED", "IDLE"]);

function size(value: unknown) {
  const amount = number(value);
  if (amount === null) return "Unavailable";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let current = amount, index = 0;
  while (current >= 1024 && index < units.length - 1) { current /= 1024; index++; }
  return `${current.toLocaleString(undefined, { maximumFractionDigits: index ? 2 : 0 })} ${units[index]}`;
}

function phaseTitle(phase: string) {
  if (phase === "IDLE") return "Ready for a restore point";
  if (phase === "DEGRADED") return "Off-site copy needs attention";
  if (phase === "RECOVERY_REQUIRED") return "Host recovery required";
  return phases.find(([key]) => key === phase)?.[1] ?? phase.replaceAll("_", " ").toLowerCase();
}

export default function Backups() {
  const snap = useSession();
  const [preflight, setPreflight] = useState<JsonMap>({});
  const [operation, setOperation] = useState<JsonMap>({});
  const [backups, setBackups] = useState<JsonMap[]>([]);
  const [error, setError] = useState("");
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [countdown, setCountdown] = useState(900);

  const refresh = async () => {
    setError("");
    try {
      const [preflightResult, statusResult, listResult] = await Promise.all([
        session.query("backup.preflight", {}, "HOST"),
        session.query("maintenance.status", {}, "HOST"),
        session.query("backup.full.list", {}, "HOST"),
      ]);
      setPreflight(record(preflightResult.data));
      setOperation(record(record(statusResult.data).currentOperation));
      setBackups(records(record(listResult.data).backups));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Backup status unavailable.");
    }
  };
  useEffect(() => { if (snap.phase === "live") void refresh(); }, [snap.phase, snap.revision]);
  const prepare = (action: string, parameters: JsonMap) => {
    try { setPrepared(session.prepare(action, parameters, "HOST")); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Action unavailable."); }
  };

  const ready = preflight.hostAuthenticated === true && preflight.operationBusy === false && preflight.recoveryRequired === false && preflight.backupRootWritable === true && preflight.commandChannelConfigured === true;
  const durablePhase = str(operation.phase, "IDLE");
  const operationJobId = str(operation.jobId, "");
  const rawProgress = snap.state.backupProgress;
  const liveProgress = rawProgress && operationJobId && str(rawProgress.jobId, "") === operationJobId && !terminalPhases.has(durablePhase) ? rawProgress : null;
  const phase = str(liveProgress?.phase, durablePhase);
  const progressValue = number(liveProgress?.progress);
  const progressBytes = number(liveProgress?.bytesUploaded ?? liveProgress?.bytes);
  const progressTotal = number(liveProgress?.totalBytes);
  const operationPercent = number(operation.progressPercent);
  const ratio = progressValue !== null ? Math.max(0, Math.min(1, progressValue)) : progressBytes !== null && progressTotal !== null && progressTotal > 0 ? Math.max(0, Math.min(1, progressBytes / progressTotal)) : operationPercent !== null ? Math.max(0, Math.min(1, operationPercent / 100)) : null;
  const currentIndex = phases.findIndex(([key]) => key === phase);
  const active = phase !== "IDLE" && !terminalPhases.has(phase);
  const heroTitle = phase === "IDLE" && !ready ? "Waiting for preflight evidence" : phaseTitle(phase);
  const progressStyle = ratio === null ? undefined : ({ "--progress": ratio } as CSSProperties);

  return <>
    <div className="backup-hero">
      <div><span className="eyebrow">Durable host workflow</span><h2>{heroTitle}</h2><p>Local ZIP integrity, remote verification and VPS cleanup remain separate. Only reported Host state advances this workflow.</p></div>
      <div className="backup-create"><label className="field">Player warning<select value={countdown} onChange={(event) => setCountdown(Number(event.target.value))}>{[1800, 900, 600, 300].map((seconds) => <option value={seconds} key={seconds}>{seconds / 60} minutes</option>)}</select></label><Button variant="primary" disabled={!ready || Boolean(session.reason("maintenance.full-backup.create", "HOST"))} title={!ready ? "A successful preflight with every required boolean true is required." : session.reason("maintenance.full-backup.create", "HOST")} onClick={() => prepare("maintenance.full-backup.create", { countdownSeconds: countdown })}>Review new backup</Button></div>
    </div>

    <div className="operations-grid">
      <Panel eyebrow={active ? "Active Host operation" : "Latest Host operation"} title="Backup phase timeline" description="Each stage is derived from durable or matching live Host state" action={<Status tone={phase === "DEGRADED" ? "warning" : phase === "FAILED" || phase === "RECOVERY_REQUIRED" ? "error" : active ? "info" : phase === "COMPLETED" ? "success" : "neutral"}>{phase}</Status>}>
        <div className="phase-timeline" aria-label="Backup operation phases" tabIndex={0}>{phases.map(([key, label], index) => {
          const state = currentIndex < 0 ? "pending" : index < currentIndex ? "done" : index === currentIndex ? "current" : "pending";
          return <div className={state} key={key}><i aria-hidden="true" /><span>{label}</span></div>;
        })}</div>
        {active && <section className={`backup-progress ${ratio === null ? "indeterminate" : ""}`} aria-live="polite">
          <header><div><span>Live Host progress</span><strong>{phaseTitle(phase)}</strong></div><strong>{ratio === null ? "—" : `${Math.round(ratio * 100)}%`}</strong></header>
          <div className="progress-track" role="progressbar" aria-label={phaseTitle(phase)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={ratio === null ? undefined : Math.round(ratio * 100)}><i style={progressStyle} /></div>
          <div className="backup-progress-meta"><span>Transferred / processed<strong>{progressBytes === null && progressTotal === null ? "Not reported" : `${size(progressBytes)} / ${size(progressTotal)}`}</strong></span><span>Current rate<strong>{number(liveProgress?.bytesPerSecond) === null ? "Not reported" : `${size(liveProgress?.bytesPerSecond)}/s`}</strong></span><span>Provider state<strong>{str(liveProgress?.providerState, "Not reported").replaceAll("_", " ")}</strong></span></div>
        </section>}
        {Boolean(operation.message) && <div className="operation-message"><Notice tone={operation.retryable ? "warning" : "neutral"} title={str(operation.errorCode, "Agent status")}>{str(operation.message)}</Notice></div>}
        {phase === "DEGRADED" && <div className="degraded-summary"><div><strong>Local backup verified; the off-site copy is not current.</strong><span>Retry upload does not stop Minecraft again.</span></div>{operation.retryable === true && <Button onClick={() => prepare("backup.full.retry-upload", { backupId: str(operation.backupId) })}>Review upload retry</Button>}</div>}
      </Panel>

      <Panel eyebrow="Strict gate" title="Preflight evidence" description="Unknown values never enable creation">
        <dl className="gate-list"><dt>Host authenticated</dt><dd>{String(preflight.hostAuthenticated ?? "unknown")}</dd><dt>No active operation</dt><dd>{preflight.operationBusy === false ? "true" : preflight.operationBusy === true ? "false" : "unknown"}</dd><dt>Recovery clear</dt><dd>{preflight.recoveryRequired === false ? "true" : preflight.recoveryRequired === true ? "false" : "unknown"}</dd><dt>Backup root writable</dt><dd>{String(preflight.backupRootWritable ?? "unknown")}</dd><dt>Command channel</dt><dd>{String(preflight.commandChannelConfigured ?? "unknown")}</dd></dl>
        <div className="panel-actions"><Button onClick={() => void refresh()}>Refresh evidence</Button>{operation.retryable === true && phase !== "DEGRADED" && <Button onClick={() => prepare("backup.full.retry-upload", { backupId: str(operation.backupId) })}>Review upload retry</Button>}</div>
      </Panel>
    </div>

    <Panel eyebrow="Retained archives" title="Backup inventory" description="Reported Host inventory; no inferred availability" action={<span className="subtle">{backups.length} records</span>}>
      <div className="backup-table table-region" tabIndex={0}><table><thead><tr><th>Archive</th><th>Created</th><th>Size</th><th>Local</th><th>Off-site</th><th>Actions</th></tr></thead><tbody>{backups.length ? backups.map((backup) => <tr key={str(backup.backupId)}><td><strong>{str(backup.filename)}</strong><small>{str(backup.backupId)}</small></td><td>{str(backup.timestamp)}</td><td>{size(backup.archiveBytes)}</td><td><Status tone={backup.local === true ? "success" : "neutral"}>{backup.local === true ? "Verified" : "Unavailable"}</Status></td><td><Status tone={backup.offsite === true ? "success" : "warning"}>{backup.offsite === true ? "Verified" : "Not verified"}</Status></td><td><div className="button-row"><Button onClick={() => prepare("backup.full.verify", { backupId: str(backup.backupId) })}>Verify</Button><Button variant="danger" onClick={() => prepare("backup.full.delete", { backupId: str(backup.backupId) })}>Delete</Button></div></td></tr>) : <tr><td colSpan={6}>No backup inventory returned.</td></tr>}</tbody></table></div>
    </Panel>
    {error && <div className="page-notice"><Notice tone="error" title="Backup data unavailable">{error}</Notice></div>}
    <ActionReview prepared={prepared} onClose={() => setPrepared(null)} />
  </>;
}

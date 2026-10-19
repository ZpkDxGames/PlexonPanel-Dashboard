"use client";
import { useEffect, useState } from "react";
import { PpSelect } from "../primitives/Select";
import { ArchiveRestore, Check, UploadCloud } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  useViewSync,
  useControl,
  useQuery,
  usePrefs,
  record,
  records,
  gib,
  time,
  date,
  validateMaintenance,
  type JsonMap,
} from "../bindings";
import { MutationButton } from "../primitives/MutationButton";
import { Tooltip } from "../primitives/Tooltip";
import { useReview } from "../primitives/ReviewProvider";
import { Title, Pane, QueryState, Table } from "./shared";
const STAGES = [
  ["PREFLIGHT", "Preflight"],
  ["ACQUIRE_LOCK", "Acquire lock"],
  ["ANNOUNCE", "Announce to players"],
  ["COUNTDOWN", "Countdown"],
  ["SAVE_ALL_FLUSH", "Save-all flush"],
  ["STOP_SERVICE", "Stop service"],
  ["STOP_PROOF", "Systemd stop proof"],
  ["BUILD_MANIFEST", "Build manifest"],
  ["ARCHIVE_PARTIAL", "ZIP to .partial"],
  ["FINALIZE_ARCHIVE", "Finalize ZIP"],
  ["LOCAL_SHA256", "Local SHA-256"],
  ["UPLOAD", "Upload to Google Drive"],
  ["REMOTE_SHA256", "Remote SHA-256 verify"],
  ["RESTART_RELEASE", "Restart and release lock"],
];
export default function Backups() {
  const { state } = useControl(),
    status = useQuery("maintenance.status"),
    config = useQuery("maintenance.settings.get"),
    preflight = useQuery("backup.preflight"),
    provider = useQuery("provider.status"),
    history = useQuery("backup.full.list"),
    prefs = usePrefs(),
    review = useReview(),
    [edit, setEdit] = useState(false),
    sync = useViewSync(),
    minutes = sync.backupCountdownMinutes,
    [enabled, setEnabled] = useState(false),
    [cadence, setCadence] = useState("INTERVAL_HOURS"),
    [hours, setHours] = useState(24),
    [at, setAt] = useState("04:00"),
    [days, setDays] = useState<string[]>(["MONDAY"]),
    [retention, setRetention] = useState(7);
  const settings = record(config.data.settings),
    full = record(settings.fullRestorePoint),
    schedule = record(full.schedule);
  useEffect(() => {
    setEnabled(schedule.enabled === true);
    setCadence(String(schedule.type ?? "INTERVAL_HOURS"));
    setHours(Number(schedule.intervalHours ?? 24));
    setAt(String(schedule.time ?? "04:00"));
    setRetention(Number(full.retentionCount ?? 7));
    if (Array.isArray(schedule.weekdays))
      setDays(schedule.weekdays.map(String));
  }, [config.data]);
  const reported = records(status.data.stageDefinitions, 14),
    stages =
      reported.length === 14
        ? reported
        : STAGES.map(([id, label]) => ({ id, label })),
    operation = {
      ...record(status.data.currentOperation),
      ...record(state.maintenancePhase),
    },
    phase = String(operation.phase ?? "IDLE"),
    phaseIndex: Record<string, number> = {
      QUEUED: 0,
      PREPARING: 1,
      COUNTDOWN: 3,
      FLUSHING: 4,
      STOPPING: 5,
      ARCHIVING: 8,
      VERIFYING: 10,
      UPLOADING: 11,
      REMOTE_VERIFYING: 12,
      STARTING: 13,
      COMPLETED: 14,
      DEGRADED: 12,
      FAILED: 0,
      RECOVERY_REQUIRED: 5,
    },
    stageId = operation.stage ?? operation.stageId,
    index = stageId
      ? stages.findIndex((s) => s.id === stageId)
      : (phaseIndex[phase] ?? 0),
    progress = state.backupProgress,
    backups = records(history.data.backups, 200),
    patch = {
      ...settings,
      schemaVersion: 2,
      fullRestorePoint: {
        ...full,
        retentionMode: "ROTATING",
        retentionCount: retention,
        schedule: {
          enabled,
          type: cadence,
          time: at,
          weekdays: days,
          intervalHours: hours,
        },
      },
    },
    validation = settings.schemaVersion
      ? validateMaintenance(patch)
      : "Wait for current Host settings.",
    gate = preflight.loading
      ? "Waiting for Host preflight."
      : preflight.error ||
        (preflight.data.recoveryRequired
          ? "Resolve the Host recovery state."
          : preflight.data.operationBusy
            ? "Another operation owns the backup lock."
            : preflight.data.hostAuthenticated === false
              ? "The Host is not authenticated."
              : preflight.data.providerStatus &&
                  preflight.data.providerStatus !== "CONNECTED"
                ? "Connect and verify the Google Drive provider."
                : "");
  return (
    <div className="pp-page">
      <Title
        code="R06 / Durability"
        title="Restore with evidence."
        detail="One Host-owned pipeline for manual and periodic Google Drive backups."
      />
      <Pane
        title="Cold backup pipeline"
        actions={
          <span
            className="pp-kicker"
            data-tone={phase === "DEGRADED" ? "amber" : "indigo"}
          >
            {phase}
          </span>
        }
      >
        <QueryState query={status} />
        <ol className="pp-pipeline">
          {stages.map((s, i) => (
            <li
              key={String(s.id)}
              data-done={i < index && phase !== "IDLE"}
              data-current={i === index && phase !== "IDLE"}
              data-near={Math.abs(i - Math.max(1, Math.min(12, index))) <= 1}
            >
              <Tooltip content={String(s.label)}>
                <button
                  className="pp-stage"
                  aria-label={`Stage ${i + 1}: ${s.label}`}
                >
                  {i < index ? <Check size={11} /> : i + 1}
                </button>
              </Tooltip>
            </li>
          ))}
        </ol>
        <div className="pp-pipeline-caption">
          <div className="row spread">
            <span>
              {phase === "IDLE"
                ? "No operation in progress"
                : `Stage ${Math.min(14, index + 1)} / 14 · ${String(stages[Math.min(13, Math.max(0, index))]?.label)}`}
            </span>
            <span className="mono">
              {String(operation.jobId ?? "No current job")}
            </span>
          </div>
          {Boolean(operation.message) && (
            <p
              style={{ marginTop: 8 }}
              data-tone={phase === "DEGRADED" ? "amber" : "indigo"}
              className="tone"
            >
              {String(operation.message)}
            </p>
          )}
          {progress && (
            <div style={{ marginTop: 12 }}>
              <span className="pp-track" data-tone="indigo">
                <i
                  style={{
                    width: `${Number(progress.totalBytes) ? Math.min(100, (Number(progress.bytesUploaded ?? progress.transferredBytes ?? 0) / Number(progress.totalBytes)) * 100) : 0}%`,
                  }}
                />
              </span>
              <small>
                {gib(progress.bytesUploaded ?? progress.transferredBytes)} /{" "}
                {gib(progress.totalBytes)} · {gib(progress.bytesPerSecond)}/s ·
                ETA {String(progress.etaSeconds ?? "—")}s
              </small>
            </div>
          )}
          {operation.retryable === true && (
            <div style={{ marginTop: 10 }}>
              <MutationButton
                action="backup.full.retry-upload"
                label="Retry upload"
                icon={UploadCloud}
                args={{
                  backupId: operation.backupId ?? operation.jobId,
                  jobId: operation.jobId,
                }}
              />
            </div>
          )}
        </div>
      </Pane>
      <section className="pp-deck pp-schedules" aria-label="Backup schedules">
        <div className="pp-cell" data-tone="indigo">
          <span className="pp-kicker">On demand</span>
          <h2 style={{ fontSize: 18 }}>Manual full backup</h2>
          <small className="muted">
            Verified cold archive ·{" "}
            {String(provider.data.remote ?? "Provider not reported")}
          </small>
          <div className="row">
            <MutationButton
              action="maintenance.full-backup.create"
              label="Create full backup"
              icon={ArchiveRestore}
              args={{ countdownSeconds: minutes * 60 }}
              extraReason={gate}
            />
            <PpSelect
              ariaLabel="Player warning countdown"
              value={String(minutes)}
              onChange={(v) =>
                sync.set("backupCountdownMinutes", Number(v) as typeof minutes)
              }
              options={[5, 10, 15, 30].map((n) => ({
                value: String(n),
                label: `${n} min warning`,
              }))}
            />
          </div>
        </div>
        <div className="pp-cell" data-tone="violet">
          <span className="pp-kicker">Automatic / Google Drive</span>
          <h2 style={{ fontSize: 18 }}>Periodic schedule</h2>
          <small className="muted">
            {schedule.enabled
              ? `${schedule.type === "INTERVAL_HOURS" ? `Every ${schedule.intervalHours}h` : String(schedule.time)} · retain ${full.retentionCount}`
              : "Disabled"}{" "}
            · {String(settings.timezone ?? "Timezone unreported")}
          </small>
          <div className="row">
            <button className="pp-ctl" onClick={() => setEdit(true)}>
              Edit schedule
            </button>
            <small className="muted">
              Next{" "}
              {status.data.nextFullRestorePoint
                ? time(String(status.data.nextFullRestorePoint), prefs.timezone)
                : "not reported"}
            </small>
          </div>
        </div>
      </section>
      <Pane
        title="Restore points"
        actions={
          <span className="muted" style={{ fontSize: 11 }}>
            {backups.length} archives
          </span>
        }
      >
        <QueryState query={history} />
        <Table label="Restore point ledger">
          <thead>
            <tr>
              {[
                "Created / archive",
                "Kind",
                "Size",
                "Destination",
                "Verified",
                "Operations",
              ].map((k) => (
                <th key={k}>{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {backups.map((b) => (
              <tr key={String(b.backupId)}>
                <td>
                  {String(b.filename ?? b.backupId)}
                  <small style={{ display: "block" }} className="muted">
                    {date(String(b.timestamp ?? ""), prefs.timezone)} ·{" "}
                    {time(String(b.timestamp), prefs.timezone)}
                  </small>
                </td>
                <td>{b.automatic ? "Periodic" : "Manual"}</td>
                <td>{gib(b.archiveBytes ?? b.sizeBytes)}</td>
                <td>{b.offsite ? "Google Drive" : "Local"}</td>
                <td>
                  {b.local || b.offsite ? (
                    <span
                      className="tone"
                      data-tone="emerald"
                      role="img"
                      aria-label="Verified archive"
                    >
                      <Check size={15} />
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <div className="row">
                    <MutationButton
                      action="backup.full.verify"
                      label="Verify"
                      args={{ backupId: b.backupId }}
                    />
                    <MutationButton
                      action="backup.full.restore"
                      label="Restore"
                      tone="rose"
                      args={{ backupId: b.backupId, startAfter: true }}
                    />
                    <MutationButton
                      action="backup.full.delete"
                      label="Delete"
                      tone="rose"
                      args={{ backupId: b.backupId }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        {!history.loading && !backups.length && (
          <div className="pp-empty">No restore points returned</div>
        )}
      </Pane>
      <Dialog.Root open={edit} onOpenChange={setEdit}>
        <Dialog.Portal>
          <Dialog.Overlay className="pp-overlay" />
          <Dialog.Content className="pp-glass pp-modal">
            <header>
              <Dialog.Title>Periodic backup schedule</Dialog.Title>
            </header>
            <div className="pp-modal-body">
              <Dialog.Description>
                Apply a reviewed update to the current Host settings.
              </Dialog.Description>
              <label className="pp-field-row">
                Enable periodic backups
                <input
                  aria-label="Enable periodic backups"
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
              </label>
              <label className="pp-field-row">
                Cadence
                <PpSelect
                  ariaLabel="Cadence"
                  value={cadence}
                  onChange={setCadence}
                  options={[
                    "INTERVAL_HOURS",
                    "DAILY",
                    "WEEKLY",
                    "SELECTED_DAYS",
                  ].map((value) => ({ value, label: value }))}
                />
              </label>
              {cadence === "INTERVAL_HOURS" ? (
                <label className="pp-field-row">
                  Interval hours
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                  />
                </label>
              ) : (
                <label className="pp-field-row">
                  Local time
                  <input
                    type="time"
                    value={at}
                    onChange={(e) => setAt(e.target.value)}
                  />
                </label>
              )}
              {["WEEKLY", "SELECTED_DAYS"].includes(cadence) && (
                <div
                  className="row"
                  style={{ flexWrap: "wrap", marginTop: 12 }}
                >
                  {[
                    "MONDAY",
                    "TUESDAY",
                    "WEDNESDAY",
                    "THURSDAY",
                    "FRIDAY",
                    "SATURDAY",
                    "SUNDAY",
                  ].map((d) => (
                    <label key={d}>
                      <input
                        type="checkbox"
                        checked={days.includes(d)}
                        onChange={(e) =>
                          setDays(
                            e.target.checked
                              ? [...days, d]
                              : days.filter((v) => v !== d),
                          )
                        }
                      />
                      {d.slice(0, 3)}
                    </label>
                  ))}
                </div>
              )}
              <label className="pp-field-row">
                Retain archives
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={retention}
                  onChange={(e) => setRetention(Number(e.target.value))}
                />
              </label>
            </div>
            <footer>
              <Dialog.Close className="pp-ctl">Cancel</Dialog.Close>
              <Tooltip content={validation || "Review exact schedule update"}>
                <button
                  className="pp-ctl"
                  aria-disabled={!!validation || undefined}
                  onClick={() => {
                    if (!validation) {
                      setEdit(false);
                      void review(
                        "maintenance.settings.update",
                        { settings: patch },
                        "HOST",
                      );
                    }
                  }}
                >
                  Review schedule
                </button>
              </Tooltip>
            </footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

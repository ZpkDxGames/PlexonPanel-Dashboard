import { useEffect, useRef, useState } from "react";
import {
  ArchiveRestore,
  CalendarClock,
  Check,
  X,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { Heading, Panel, QueryNotice } from "../shared";
import {
  useQuery,
  useControl,
  useNow,
  fmtGiB,
  fmt1,
} from "../../hooks/useControl";
import { record, records, type JsonMap } from "../../../adapter/control-state";
import { MutationButton, useReview } from "../../review/ActionReviewModal";
import { Pill } from "../../primitives/Pill";
import { Sparkline } from "../../primitives/Sparkline";
import { IconBadge } from "../../primitives/IconBadge";
const DISPLAY_STAGES = [
  "Preflight",
  "Acquire lock",
  "Announce to players",
  "Countdown",
  "Save-all flush",
  "Stop service",
  "Systemd stop proof",
  "Build manifest",
  "ZIP to .partial",
  "Finalize ZIP",
  "Local SHA-256",
  "Upload to Google Drive",
  "Remote SHA-256 verify",
  "Restart and release lock",
];
export default function Backups() {
  const { state } = useControl(),
    status = useQuery("maintenance.status"),
    config = useQuery("maintenance.settings.get"),
    provider = useQuery("provider.status"),
    preflight = useQuery("backup.preflight"),
    history = useQuery("backup.full.list"),
    [minutes, setMinutes] = useState(5),
    [enabled, setEnabled] = useState(false),
    [type, setType] = useState("DAILY"),
    [time, setTime] = useState("04:00"),
    [interval, setIntervalHours] = useState(24),
    [days, setDays] = useState(["MONDAY"]),
    [retention, setRetention] = useState(7),
    review = useReview(),
    now = useNow();
  const settings = record(config.data.settings),
    full = record(settings.fullRestorePoint),
    schedule = record(full.schedule);
  useEffect(() => {
    setEnabled(schedule.enabled === true);
    if (typeof schedule.type === "string") setType(schedule.type);
    if (typeof schedule.time === "string") setTime(schedule.time);
    if (typeof schedule.intervalHours === "number")
      setIntervalHours(schedule.intervalHours);
    if (Array.isArray(schedule.weekdays) && schedule.weekdays.length)
      setDays(schedule.weekdays.map(String));
    if (typeof full.retentionCount === "number")
      setRetention(full.retentionCount);
  }, [config.data]);
  const operation =
      state.maintenancePhase?.jobId &&
      state.maintenancePhase.jobId !==
        record(status.data.currentOperation).jobId
        ? record(state.maintenancePhase)
        : {
            ...record(status.data.currentOperation),
            ...record(state.maintenancePhase),
          },
    phase = String(state.maintenancePhase?.phase ?? operation.phase ?? "IDLE"),
    progress =
      state.backupProgress?.jobId === operation.jobId
        ? state.backupProgress
        : null,
    steps = records(status.data.stageDefinitions, 14),
    stages = steps.length
      ? steps
      : DISPLAY_STAGES.map((label, i) => ({ id: String(i + 1), label })),
    next =
      typeof status.data.nextFullRestorePoint === "string"
        ? Date.parse(status.data.nextFullRestorePoint)
        : NaN,
    remaining = Number.isFinite(next)
      ? Math.max(0, Math.floor((next - now) / 1000))
      : null,
    uploaded = Number(
      progress?.bytesUploaded ?? progress?.transferredBytes ?? 0,
    ),
    total = Number(progress?.totalBytes ?? 0),
    stageByPhase: Record<string, number> = {
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
    index = stageByPhase[phase] ?? 0;
  const [speedSamples, setSpeedSamples] = useState<(number | null)[]>([]),
    speedJob = useRef("");
  useEffect(() => {
    const job = String(operation.jobId ?? "");
    if (speedJob.current !== job) {
      speedJob.current = job;
      setSpeedSamples([]);
    }
    if (progress && typeof progress.bytesPerSecond === "number")
      setSpeedSamples((v) =>
        [...v, Number(progress.bytesPerSecond) / 1048576].slice(-120),
      );
  }, [operation.jobId, progress]);
  const reason =
    preflight.error ||
    (preflight.loading
      ? "Waiting for Host preflight."
      : preflight.data.recoveryRequired
        ? "Resolve the Host recovery state before a new backup."
        : preflight.data.operationBusy
          ? "Another operation owns the backup lock."
          : preflight.data.hostAuthenticated === false
            ? "The Host is not authenticated."
            : preflight.data.providerStatus &&
                preflight.data.providerStatus !== "CONNECTED"
              ? "Connect and verify the Google Drive provider first."
              : "");
  function reviewSchedule() {
    if (!settings.schemaVersion) return;
    review(
      "maintenance.settings.update",
      {
        settings: {
          ...settings,
          schemaVersion: 2,
          fullRestorePoint: {
            ...full,
            retentionMode: "ROTATING",
            retentionCount: retention,
            schedule: {
              enabled,
              type,
              time,
              weekdays: days,
              intervalHours: interval,
            },
          },
        },
      },
      "HOST",
    );
  }
  return (
    <>
      <Heading
        id="R06 · Backups"
        title="A restore point you can trust."
        detail="Host-owned cold backups, explicit player warnings and verified Google Drive copies."
      />
      <div className="below-grid mt-0">
        <Panel
          title="Manual — Fully Backup Now"
          tone="indigo"
          icon={ArchiveRestore}
        >
          <Pill tone="indigo">Google Drive via rclone</Pill>
          <QueryNotice query={preflight} />
          <div className="pp-well p-3 my-4 mono text-xs break-all">
            {String(
              provider.data.remote ??
                provider.data.destination ??
                "Provider destination not reported",
            )}
          </div>
          <label className="text-secondary block mb-4">
            Warn players before stopping
            <select
              aria-label="Backup countdown"
              className="block mt-2"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            >
              {[30, 15, 10, 5].map((v) => (
                <option key={v} value={v}>
                  {v} minutes
                </option>
              ))}
            </select>
          </label>
          <MutationButton
            action="maintenance.full-backup.create"
            label="Fully Backup Now"
            parameters={{ countdownSeconds: minutes * 60 }}
            extraReason={reason}
          />
          <p className="text-secondary text-xs leading-6 mt-4">
            The Host flushes saves, proves MainPID=0, builds a .partial ZIP,
            verifies both SHA-256 hashes, then restores availability. Duration
            is not yet estimated.
          </p>
        </Panel>
        <Panel title="Periodic Scheduled" tone="amber" icon={CalendarClock}>
          <QueryNotice query={config} />
          <Pill tone={enabled ? "emerald" : "slate"}>
            {enabled ? "Enabled after reviewed save" : "Disabled by default"}
          </Pill>
          <label className="settings-row">
            Enable periodic backups
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              aria-label="Enable periodic backups"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              Cadence
              <select
                className="w-full mt-2"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {["DAILY", "WEEKLY", "SELECTED_DAYS", "INTERVAL_HOURS"].map(
                  (v) => (
                    <option key={v}>{v}</option>
                  ),
                )}
              </select>
            </label>
            <label>
              {type === "INTERVAL_HOURS" ? "Interval hours" : "Local time"}
              {type === "INTERVAL_HOURS" ? (
                <input
                  className="field w-full mt-2"
                  type="number"
                  min={1}
                  max={168}
                  value={interval}
                  onChange={(e) => setIntervalHours(Number(e.target.value))}
                />
              ) : (
                <input
                  className="field w-full mt-2"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              )}
            </label>
          </div>
          {["WEEKLY", "SELECTED_DAYS", "SELECTED_WEEKDAYS"].includes(type) && (
            <div className="flex flex-wrap gap-2 my-3">
              {[
                "MONDAY",
                "TUESDAY",
                "WEDNESDAY",
                "THURSDAY",
                "FRIDAY",
                "SATURDAY",
                "SUNDAY",
              ].map((d) => (
                <label key={d} className="pill">
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
          <label className="settings-row">
            Retain restore points
            <input
              className="field w-20"
              type="number"
              min={1}
              max={52}
              value={retention}
              onChange={(e) => setRetention(Number(e.target.value))}
            />
          </label>
          <div className="pp-well p-3 mb-4 text-xs">
            <p>Timezone: {String(settings.timezone ?? "Not reported")}</p>
            <p className="mt-2 num">
              {remaining == null
                ? "Next run not reported"
                : `Next run in ${Math.floor(remaining / 3600)}h ${Math.floor(remaining / 60) % 60}m`}
            </p>
          </div>
          <MutationButton
            action="maintenance.settings.update"
            label="Review schedule"
            parameters={{
              settings: {
                ...settings,
                schemaVersion: 2,
                fullRestorePoint: {
                  ...full,
                  retentionMode: "ROTATING",
                  retentionCount: retention,
                  schedule: {
                    enabled,
                    type,
                    time,
                    weekdays: days,
                    intervalHours: interval,
                  },
                },
              },
            }}
            extraReason={
              !settings.schemaVersion
                ? "Wait for the current Host settings."
                : interval < 1 || interval > 168
                  ? "Interval must be 1–168 hours."
                  : retention < 1 || retention > 52
                    ? "Retention must be 1–52."
                    : ["WEEKLY", "SELECTED_DAYS"].includes(type) && !days.length
                      ? "Choose at least one weekday."
                      : ""
            }
          />
        </Panel>
      </div>
      <div className="mt-4">
        <Panel title="Cold backup pipeline" tone="indigo" icon={ShieldCheck}>
          <QueryNotice query={status} />
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <Pill
              tone={
                ["DEGRADED", "FAILED", "RECOVERY_REQUIRED"].includes(phase)
                  ? "rose"
                  : "indigo"
              }
            >
              {phase}
            </Pill>
            <span className="mono text-xs text-secondary">
              {String(operation.jobId ?? "No current job")}
            </span>
            {!steps.length && (
              <span className="text-muted text-xs">
                Display stages · awaiting Host stage definitions
              </span>
            )}
          </div>
          <ol className="backup-pipeline">
            {stages.map((s, i) => {
              const current = i === index,
                done = i < index && phase !== "FAILED",
                failed =
                  current &&
                  ["FAILED", "DEGRADED", "RECOVERY_REQUIRED"].includes(phase),
                state = failed
                  ? "failed"
                  : done
                    ? "done"
                    : current && phase !== "IDLE"
                      ? "running"
                      : "pending";
              return (
                <li
                  key={String(s.id)}
                  data-state={state}
                  data-tone={
                    failed
                      ? "rose"
                      : done
                        ? "emerald"
                        : current
                          ? "indigo"
                          : "slate"
                  }
                >
                  <span className="node">
                    {done ? (
                      <Check size={12} />
                    ) : failed ? (
                      <X size={12} />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span>
                    {String(s.label)}
                    <small className="block mt-1">{state}</small>
                  </span>
                </li>
              );
            })}
          </ol>
          {phase === "COUNTDOWN" && (
            <div className="pp-well p-4 mt-5" data-tone="amber">
              <strong className="num text-3xl tone-text">
                {String(status.data.countdownRemainingSeconds ?? "—")} s
              </strong>
              <p className="text-secondary mt-2">
                RCON player warning countdown · Host authoritative deadline
              </p>
            </div>
          )}
          {progress && (
            <div className="pp-well p-4 mt-5" data-tone="indigo">
              <div className="flex justify-between">
                <strong>Google Drive upload</strong>
                <span className="num">
                  {fmt1(
                    progress.bytesPerSecond
                      ? Number(progress.bytesPerSecond) / 1048576
                      : null,
                  )}{" "}
                  MB/s
                </span>
              </div>
              <div className="pp-well h-2 rounded-full mt-4 overflow-hidden">
                <i
                  className="block h-full bg-[rgb(var(--tone))]"
                  style={{
                    width: `${total ? Math.min(100, (uploaded / total) * 100) : 0}%`,
                  }}
                />
              </div>
              <div className="mt-3">
                <Sparkline values={speedSamples} height={24} />
              </div>
              <p className="text-muted text-xs mt-3 num">
                {fmtGiB(uploaded)} / {fmtGiB(total)} · ETA{" "}
                {String(progress.etaSeconds ?? "unreported")} s
              </p>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-3 mt-5">
            {["localSha256", "remoteSha256"].map((k) => (
              <div key={k} className="pp-well p-3">
                <p className="eyebrow">{k}</p>
                <code className="mono text-xs block break-all mt-2">
                  {String(
                    operation[k] ??
                      (k === "localSha256"
                        ? records(history.data.backups, 100).find(
                            (b) => b.backupId === operation.backupId,
                          )?.sha256
                        : undefined) ??
                      "Not reported",
                  )}
                </code>
              </div>
            ))}
          </div>
          {Boolean(operation.errorMessage ?? operation.message) && (
            <p className="error-banner mt-4">
              {String(operation.errorCode ?? "")}{" "}
              {String(operation.errorMessage ?? operation.message)}
            </p>
          )}
          {(operation.retryable === true ||
            status.data.uploadRetryable === true) && (
            <div className="mt-4">
              <MutationButton
                action="backup.full.retry-upload"
                label="Retry Upload"
                parameters={{
                  backupId: operation.backupId ?? operation.jobId,
                  jobId: operation.jobId,
                }}
              />
            </div>
          )}
        </Panel>
      </div>
      <div className="mt-4">
        <Panel title="Restore-point history" tone="violet">
          <QueryNotice query={history} />
          <div
            className="pp-well table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Backup history"
          >
            <table>
              <thead>
                <tr>
                  <th>Archive</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Local</th>
                  <th>Remote</th>
                </tr>
              </thead>
              <tbody>
                {records(history.data.backups, 100).map((b) => (
                  <tr key={String(b.backupId)}>
                    <td>
                      {String(b.filename ?? b.backupId)}
                      <small className="block mono text-muted mt-1">
                        {String(b.timestamp ?? "")}
                      </small>
                    </td>
                    <td>
                      <Pill tone="indigo">
                        {b.automatic ? "Periodic" : "Manual"}
                      </Pill>
                    </td>
                    <td className="num">
                      {fmtGiB(b.archiveBytes ?? b.sizeBytes)}
                    </td>
                    <td>{b.local ? "Verified archive" : "Not reported"}</td>
                    <td>
                      <Pill tone={b.offsite ? "emerald" : "amber"}>
                        {b.offsite ? "Verified" : "Unverified"}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}

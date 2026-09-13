"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { record, records, str, type JsonMap } from "../lib/control-state";
import {
  ActionButton,
  Badge,
  Empty,
  Panel,
  bytes,
  time,
  useQuery,
  type ViewProps,
} from "./control-views";
import { downloadTransfer } from "./advanced-views";

type ScheduleDraft = {
  enabled: boolean;
  type: "DAILY" | "WEEKLY" | "SELECTED_WEEKDAYS";
  weekdays: string[];
  time: string;
};
type SettingsDraft = {
  schemaVersion: number;
  timezone: string;
  restart: {
    schedule: ScheduleDraft;
    warningSeconds: number[];
    stopTimeoutSeconds: number;
    startupTimeoutSeconds: number;
  };
  fullRestorePoint: {
    schedule: ScheduleDraft;
    retentionMode: "SINGLE_CURRENT" | "ROTATING";
    retentionCount: number;
    restartAfter: boolean;
    canonicalFilename: string;
    uploadTimeoutSeconds: number;
    verificationMode: string;
    maximumBytes: number;
    excludes: string[];
  };
  liveSnapshot: { schedule: ScheduleDraft };
};

const DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

function parseSchedule(value: unknown, fallback: ScheduleDraft): ScheduleDraft {
  const raw = record(value),
    type = str(raw.type, fallback.type);
  return {
    enabled: raw.enabled === true,
    type:
      type === "WEEKLY" || type === "SELECTED_WEEKDAYS" ? type : "DAILY",
    weekdays: Array.isArray(raw.weekdays)
      ? raw.weekdays.filter((day): day is string => typeof day === "string")
      : fallback.weekdays,
    time: str(raw.time, fallback.time),
  };
}

function parseSettings(value: unknown): SettingsDraft {
  const root = record(value),
    restart = record(root.restart),
    full = record(root.fullRestorePoint),
    live = record(root.liveSnapshot);
  return {
    schemaVersion: 1,
    timezone: str(root.timezone, "America/Sao_Paulo"),
    restart: {
      schedule: parseSchedule(restart.schedule, {
        enabled: false,
        type: "DAILY",
        weekdays: [],
        time: "04:00",
      }),
      warningSeconds: Array.isArray(restart.warningSeconds)
        ? restart.warningSeconds.filter(
            (value): value is number => typeof value === "number",
          )
        : [900, 300, 60, 30, 10],
      stopTimeoutSeconds:
        typeof restart.stopTimeoutSeconds === "number"
          ? restart.stopTimeoutSeconds
          : 180,
      startupTimeoutSeconds:
        typeof restart.startupTimeoutSeconds === "number"
          ? restart.startupTimeoutSeconds
          : 180,
    },
    fullRestorePoint: {
      schedule: parseSchedule(full.schedule, {
        enabled: false,
        type: "WEEKLY",
        weekdays: ["SUNDAY"],
        time: "04:00",
      }),
      retentionMode:
        full.retentionMode === "ROTATING" ? "ROTATING" : "SINGLE_CURRENT",
      retentionCount:
        typeof full.retentionCount === "number" ? full.retentionCount : 1,
      restartAfter: full.restartAfter !== false,
      canonicalFilename: str(full.canonicalFilename, "PlexonCraft-Latest.zip"),
      uploadTimeoutSeconds:
        typeof full.uploadTimeoutSeconds === "number"
          ? full.uploadTimeoutSeconds
          : 1800,
      verificationMode: str(
        full.verificationMode,
        "SIZE_AND_HASH_WHEN_AVAILABLE",
      ),
      maximumBytes:
        typeof full.maximumBytes === "number"
          ? full.maximumBytes
          : 1_099_511_627_776,
      excludes: Array.isArray(full.excludes)
        ? full.excludes.filter(
            (value): value is string => typeof value === "string",
          )
        : ["logs", "crash-reports", "cache", ".cache"],
    },
    liveSnapshot: {
      schedule: parseSchedule(live.schedule, {
        enabled: false,
        type: "DAILY",
        weekdays: [],
        time: "03:00",
      }),
    },
  };
}

function ScheduleEditor({
  value,
  onChange,
}: {
  value: ScheduleDraft;
  onChange: (value: ScheduleDraft) => void;
}) {
  const weekday = value.weekdays[0] ?? "SUNDAY";
  return (
    <div className="cr30-schedule-grid">
      <label className="cr30-toggle-row">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
        />
        Enabled
      </label>
      <label>
        Frequency
        <select
          value={value.type}
          onChange={(event) => {
            const type = event.target.value as ScheduleDraft["type"];
            onChange({
              ...value,
              type,
              weekdays:
                type === "DAILY" ? [] : value.weekdays.length ? value.weekdays : ["SUNDAY"],
            });
          }}
        >
          <option value="DAILY">Daily</option>
          <option value="WEEKLY">Weekly</option>
          <option value="SELECTED_WEEKDAYS">Selected weekdays</option>
        </select>
      </label>
      {value.type !== "DAILY" && (
        <label>
          Weekday
          <select
            value={weekday}
            onChange={(event) =>
              onChange({ ...value, weekdays: [event.target.value] })
            }
          >
            {DAYS.map((day) => (
              <option key={day} value={day}>
                {day.charAt(0) + day.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Local time
        <input
          type="time"
          value={value.time}
          onChange={(event) => onChange({ ...value, time: event.target.value })}
        />
      </label>
    </div>
  );
}

export function BackupsView30(props: ViewProps) {
  const hostConnected = Boolean(props.state.ready?.agents.host),
    canViewMaintenance = props.can("maintenance.status", "HOST"),
    canViewBackups = props.can("backup.full.list", "HOST") || props.can("backup.list", "HOST"),
    status = useQuery("maintenance.status", {}, hostConnected && canViewMaintenance, "HOST"),
    settingsQuery = useQuery(
      "maintenance.settings.get",
      {},
      hostConnected && props.can("maintenance.settings.get", "HOST"),
      "HOST",
    ),
    fullQuery = useQuery(
      "backup.full.list",
      { page: 0 },
      hostConnected && props.can("backup.full.list", "HOST"),
      "HOST",
    ),
    liveQuery = useQuery(
      "backup.list",
      { page: 0 },
      hostConnected && props.can("backup.list", "HOST"),
      "HOST",
    ),
    providerQuery = useQuery(
      "provider.status",
      {},
      hostConnected && props.can("provider.status", "HOST"),
      "HOST",
    );
  const [draft, setDraft] = useState<SettingsDraft | null>(null),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [restore, setRestore] = useState<{
      type: "full" | "live";
      id: string;
      token: string;
      serverName: string;
    } | null>(null),
    [typed, setTyped] = useState(""),
    [download, setDownload] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null),
    persistedDraft = useMemo(
      () =>
        settingsQuery.data.settings
          ? parseSettings(settingsQuery.data.settings)
          : null,
      [settingsQuery.data.settings],
    ),
    activeDraft = draft ?? persistedDraft,
    setUnsaved = props.setUnsaved;

  useEffect(() => {
    if (!canViewMaintenance || !hostConnected) return;
    const timer = window.setInterval(status.refresh, 2000);
    return () => window.clearInterval(timer);
  }, [canViewMaintenance, hostConnected, status.refresh]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    setUnsaved?.(dirty);
    return () => setUnsaved?.(false);
  }, [dirty, setUnsaved]);

  const fullBackups = records(fullQuery.data.backups, 1000),
    liveBackups = records(liveQuery.data.backups, 1000),
    allBackups = useMemo(
      () =>
        [
          ...fullBackups.map((backup) => ({ ...backup, _kind: "full" })),
          ...liveBackups.map((backup) => ({ ...backup, _kind: "live" })),
        ].sort(
          (a, b) =>
            Date.parse(str(b.timestamp, "1970-01-01")) -
            Date.parse(str(a.timestamp, "1970-01-01")),
        ),
      [fullBackups, liveBackups],
    ),
    totalBytes = allBackups.reduce(
      (sum, backup) =>
        sum +
        (typeof backup.archiveBytes === "number"
          ? backup.archiveBytes
          : typeof backup.bytes === "number"
            ? backup.bytes
            : 0),
      0,
    ),
    last = allBackups[0],
    operation = record(status.data.currentOperation),
    progress = props.state.backupProgress,
    provider = Object.keys(providerQuery.data).length
      ? providerQuery.data
      : record(status.data.provider),
    connectedProvider = provider.configured === true;

  if (!hostConnected)
    return (
      <Empty title="Backups & Maintenance needs the Host companion">
        The browser and Paper plugin never receive systemd, rclone, or backup filesystem authority.
      </Empty>
    );
  if (!canViewBackups && !canViewMaintenance)
    return (
      <Empty title="Backups & Maintenance is unavailable">
        Your device or Host policy does not grant the required view capabilities.
      </Empty>
    );

  const refreshAll = () => {
    status.refresh();
    settingsQuery.refresh();
    fullQuery.refresh();
    liveQuery.refresh();
    providerQuery.refresh();
  };
  const mutate = (next: SettingsDraft) => {
    setDraft(next);
    setDirty(true);
  };
  const startRestore = async (type: "full" | "live", backupId: string) => {
    const action = type === "full" ? "backup.full.restore.prepare" : "backup.restore.prepare";
    const result = await props.run(action, { backupId }, "HOST");
    setTyped("");
    setRestore({
      type,
      id: backupId,
      token: str(result.data.confirmationToken, ""),
      serverName: str(result.data.serverName, ""),
    });
  };

  return (
    <div className="cr30-backups-stack">
      <div className="cr21-page-toolbar cr30-backup-toolbar">
        <div>
          <strong>Backups & Maintenance</strong>
          <span>Host-authoritative restarts, live snapshots, cold restore points and off-site verification.</span>
        </div>
        <div className="cr-actions">
          <Badge tone="green">Host connected</Badge>
          <button className="cr-button" onClick={refreshAll}>Refresh</button>
        </div>
      </div>

      {(status.error || fullQuery.error || liveQuery.error || providerQuery.error || error) && (
        <p className="cr-alert" role="alert">
          {error || status.error || fullQuery.error || liveQuery.error || providerQuery.error}
        </p>
      )}
      {(status.data.restoreRecoveryRequired === true || fullQuery.data.recoveryRequired === true) && (
        <p className="cr-alert" role="alert">
          Restore recovery is required on the Host before another destructive operation can run.
        </p>
      )}

      <section className="cr30-backup-summary" aria-label="Maintenance summary">
        <div>
          <small>Maintenance</small>
          <strong>{str(operation.phase, "Idle")}</strong>
          <span>{operation.kind ? str(operation.kind).replaceAll("_", " ") : "No destructive operation owns the Host lock."}</span>
        </div>
        <div>
          <small>Off-site provider</small>
          <strong>{connectedProvider ? "rclone connected" : str(provider.provider, "Local only")}</strong>
          <span>{str(provider.remote, connectedProvider ? "Configured remote" : "No remote credentials exposed to the browser")}</span>
        </div>
        <div>
          <small>Recovery</small>
          <strong>{status.data.jobRecoveryRequired === true ? "Attention required" : "Clear"}</strong>
          <span>Crash journals and duplicate schedule claims are persisted by the Host.</span>
        </div>
      </section>

      <section className="cr30-backup-metrics" aria-label="Backup metrics">
        <article className="cr30-backup-metric">
          <span>Last restore point</span>
          <strong>{last ? time(last.timestamp) : "None"}</strong>
          <small>{last ? str(last.type, last._kind === "full" ? "FULL_RESTORE_POINT" : "LIVE_SNAPSHOT").replaceAll("_", " ") : "No backup metadata available"}</small>
        </article>
        <article className="cr30-backup-metric">
          <span>Stored backups</span>
          <strong>{allBackups.length}</strong>
          <small>{bytes(totalBytes)} represented by loaded inventory</small>
        </article>
        <article className="cr30-backup-metric">
          <span>Next restart</span>
          <strong>{time(status.data.nextRestart)}</strong>
          <small>{str(status.data.timezone, "Host timezone")}</small>
        </article>
        <article className="cr30-backup-metric">
          <span>Next full backup</span>
          <strong>{time(status.data.nextFullRestorePoint)}</strong>
          <small>Cold full-server restore point</small>
        </article>
      </section>

      {(Object.keys(operation).length > 0 || progress) && (
        <Panel title="Current operation" aside={<Badge tone="cyan">{str(progress?.phase, str(operation.phase, "Active"))}</Badge>}>
          <div className="cr30-operation">
            <div>
              <strong>{str(operation.kind, progress?.type ? str(progress.type) : "Maintenance").replaceAll("_", " ")}</strong>
              <small>Job {str(operation.jobId, str(progress?.jobId, "—"))}</small>
            </div>
            {progress && typeof progress.progress === "number" ? (
              <progress max={1} value={progress.progress} />
            ) : (
              <progress />
            )}
            <span>
              {progress ? `${bytes(progress.bytes)} / ${bytes(progress.totalBytes)}` : "Host journal is authoritative; no ETA is invented."}
            </span>
          </div>
        </Panel>
      )}

      <div className="cr30-backup-columns">
        <Panel title="Server maintenance" aside={<Badge>Systemd + Paper</Badge>}>
          <div className="cr30-backup-actions">
            {props.can("maintenance.restart.now", "HOST") && (
              <ActionButton
                danger
                onClick={async () => {
                  if (!window.confirm("Restart PlexonCraft now? Paper will flush saves and the Host will require a fresh authenticated reconnect before success.")) return;
                  await props.run("maintenance.restart.now", { skipCountdown: true }, "HOST");
                  status.refresh();
                }}
              >Restart now</ActionButton>
            )}
            {props.can("backup.create", "HOST") && (
              <ActionButton onClick={() => props.run("backup.create", {}, "HOST").then(() => liveQuery.refresh())}>
                Create live snapshot
              </ActionButton>
            )}
            {props.can("maintenance.full-backup.create", "HOST") && (
              <ActionButton
                danger
                onClick={async () => {
                  if (!window.confirm("Create a full restore point now? PlexonCraft will temporarily go offline while the cold archive is created.")) return;
                  await props.run("maintenance.full-backup.create", { skipCountdown: true }, "HOST");
                  status.refresh();
                }}
              >Create full restore point</ActionButton>
            )}
            {props.can("provider.test", "HOST") && (
              <ActionButton onClick={() => props.run("provider.test", {}, "HOST").then((result) => props.notice(`Provider: ${str(result.data.status, "checked")}`))}>
                Test Google Drive
              </ActionButton>
            )}
          </div>
          <p className="cr-hint cr30-backup-preview-note">
            Full restore points stop Paper before reading mutable worlds or plugin databases. Google Drive credentials remain in the Host&apos;s rclone configuration.
          </p>
        </Panel>

        <Panel title="Provider" aside={<Badge tone={connectedProvider ? "green" : "quiet"}>{connectedProvider ? "Configured" : "Local"}</Badge>}>
          <dl className="cr30-provider-list">
            <div><dt>Provider</dt><dd>{str(provider.provider, "LOCAL")}</dd></div>
            <div><dt>Remote</dt><dd>{str(provider.remote, "Not configured")}</dd></div>
            <div><dt>Credentials</dt><dd>Host-local only</dd></div>
            <div><dt>Promotion</dt><dd>Staging → verify → current</dd></div>
          </dl>
        </Panel>
      </div>

      <Panel title="Backup inventory" aside={<Badge>{allBackups.length} loaded</Badge>}>
        {allBackups.length ? (
          <div className="cr-table-wrap cr30-backup-table">
            <table>
              <thead><tr><th>Created</th><th>Type</th><th>Size</th><th>Copies</th><th>Verification</th><th>Actions</th></tr></thead>
              <tbody>
                {allBackups.slice(0, 100).map((backup) => {
                  const id = str(backup.backupId),
                    full = backup._kind === "full",
                    size = full ? backup.archiveBytes : backup.bytes,
                    verified = full ? str(backup.verification, "—") : str(backup.sha256) ? "SHA-256" : "—";
                  return (
                    <tr key={`${backup._kind}-${id}`}>
                      <td>{time(backup.timestamp)}<small>{backup.automatic ? "Scheduled" : backup.emergency ? "Emergency" : "Manual"}</small></td>
                      <td><Badge tone={full ? "cyan" : "quiet"}>{full ? "Full restore point" : "Live snapshot"}</Badge></td>
                      <td>{bytes(size)}<small>{typeof backup.durationMillis === "number" ? `${Math.round(backup.durationMillis / 1000)}s` : "—"}</small></td>
                      <td><Badge tone={backup.local ? "green" : "quiet"}>Local</Badge> <Badge tone={backup.offsite ? "green" : "quiet"}>{backup.offsite ? "Off-site" : "Local only"}</Badge></td>
                      <td>{verified}<small title={str(backup.sha256)}>{str(backup.sha256, "").slice(0, 12)}{str(backup.sha256, "") ? "…" : ""}</small></td>
                      <td><div className="cr-actions">
                        {full && props.can("backup.full.verify", "HOST") && <ActionButton onClick={() => props.run("backup.full.verify", { backupId: id }, "HOST").then(() => props.notice("Restore point verified."))}>Verify</ActionButton>}
                        {full && !backup.offsite && connectedProvider && props.can("backup.full.retry-upload", "HOST") && <ActionButton onClick={() => props.run("backup.full.retry-upload", { backupId: id }, "HOST").then(() => fullQuery.refresh())}>Retry upload</ActionButton>}
                        {!full && props.can("backup.download", "HOST") && (
                          <ActionButton
                            disabled={download !== null || Number(size) > 64 * 1024 * 1024}
                            onClick={async () => {
                              controller.current = new AbortController();
                              setDownload(0);
                              try {
                                await downloadTransfer("backup.download", { backupId: id }, `PlexonPanel-${id}.zip`, "HOST", controller.current.signal, setDownload);
                              } catch (failure) {
                                setError(failure instanceof Error ? failure.message : "Download failed");
                              } finally {
                                setDownload(null);
                              }
                            }}
                          >Download</ActionButton>
                        )}
                        {props.can(full ? "backup.full.restore.prepare" : "backup.restore.prepare", "HOST") && <ActionButton danger onClick={() => startRestore(full ? "full" : "live", id)}>Restore</ActionButton>}
                        {!backup.emergency && props.can(full ? "backup.full.delete" : "backup.delete", "HOST") && (
                          <ActionButton danger onClick={async () => {
                            if (!window.confirm("Delete this local backup metadata and archive?")) return;
                            await props.run(full ? "backup.full.delete" : "backup.delete", { backupId: id }, "HOST");
                            if (full) fullQuery.refresh();
                            else liveQuery.refresh();
                          }}>Delete</ActionButton>
                        )}
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title={fullQuery.busy || liveQuery.busy ? "Loading backups…" : "No backups yet"}>
            Create a live snapshot or full restore point from the Host controls.
          </Empty>
        )}
        {download !== null && <div className="cr30-download"><progress max={1} value={download} /><button className="cr-button" onClick={() => controller.current?.abort()}>Cancel download</button></div>}
        <p className="cr-hint cr30-backup-preview-note">Browser downloads remain capped at 64 MiB. Large full restore points stay on the Host and/or Google Drive.</p>
      </Panel>

      {activeDraft && props.can("maintenance.settings.get", "HOST") && (
        <Panel title="Maintenance settings" aside={dirty ? <Badge tone="amber">Unsaved</Badge> : <Badge>Host persisted</Badge>}>
          <div className="cr30-settings-grid">
            <section>
              <h3>Restart</h3>
              <ScheduleEditor value={activeDraft.restart.schedule} onChange={(schedule) => mutate({ ...activeDraft, restart: { ...activeDraft.restart, schedule } })} />
              <label>Timezone<input value={activeDraft.timezone} onChange={(event) => mutate({ ...activeDraft, timezone: event.target.value })} placeholder="America/Sao_Paulo" /></label>
              <label>Warnings · seconds<input value={activeDraft.restart.warningSeconds.join(", ")} onChange={(event) => mutate({ ...activeDraft, restart: { ...activeDraft.restart, warningSeconds: event.target.value.split(",").map((value) => Number(value.trim())).filter((value) => Number.isFinite(value) && value >= 0) } })} /></label>
              <label>Startup timeout · seconds<input type="number" min={30} max={1800} value={activeDraft.restart.startupTimeoutSeconds} onChange={(event) => mutate({ ...activeDraft, restart: { ...activeDraft.restart, startupTimeoutSeconds: Number(event.target.value) } })} /></label>
            </section>
            <section>
              <h3>Full restore point</h3>
              <ScheduleEditor value={activeDraft.fullRestorePoint.schedule} onChange={(schedule) => mutate({ ...activeDraft, fullRestorePoint: { ...activeDraft.fullRestorePoint, schedule } })} />
              <label>Retention<select value={activeDraft.fullRestorePoint.retentionMode} onChange={(event) => mutate({ ...activeDraft, fullRestorePoint: { ...activeDraft.fullRestorePoint, retentionMode: event.target.value as "SINGLE_CURRENT" | "ROTATING" } })}><option value="SINGLE_CURRENT">Single current</option><option value="ROTATING">Rotating</option></select></label>
              {activeDraft.fullRestorePoint.retentionMode === "ROTATING" && <label>Keep<input type="number" min={1} max={52} value={activeDraft.fullRestorePoint.retentionCount} onChange={(event) => mutate({ ...activeDraft, fullRestorePoint: { ...activeDraft.fullRestorePoint, retentionCount: Number(event.target.value) } })} /></label>}
              <label>Canonical filename<input value={activeDraft.fullRestorePoint.canonicalFilename} onChange={(event) => mutate({ ...activeDraft, fullRestorePoint: { ...activeDraft.fullRestorePoint, canonicalFilename: event.target.value } })} /></label>
              <label className="cr30-toggle-row"><input type="checkbox" checked={activeDraft.fullRestorePoint.restartAfter} onChange={(event) => mutate({ ...activeDraft, fullRestorePoint: { ...activeDraft.fullRestorePoint, restartAfter: event.target.checked } })} />Restart after backup</label>
            </section>
          </div>
          <div className="cr-actions cr30-settings-actions">
            {props.can("maintenance.settings.update", "HOST") && (
              <ActionButton disabled={!dirty} onClick={() => props.run("maintenance.settings.update", { settings: activeDraft as unknown as JsonMap }, "HOST").then(() => { setDirty(false); setDraft(null); settingsQuery.refresh(); status.refresh(); props.notice("Maintenance settings saved on the Host."); })}>Save settings</ActionButton>
            )}
            <button className="cr-button" disabled={!dirty} onClick={() => { setDraft(null); setDirty(false); }}>Discard</button>
          </div>
        </Panel>
      )}

      {restore && (
        <Panel title="Confirm restore">
          <div className="cr-form cr-pad">
            <p>
              {restore.type === "full"
                ? "This full restore point replaces the stopped server tree after an emergency pre-restore backup and hash verification. PlexonCraft will be unavailable during restore."
                : "Paper must remain stopped. The Host will create an emergency backup, verify the archive, and keep a rollback journal."}
            </p>
            <label>Type {restore.serverName} to continue<input value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" /></label>
            <div className="cr-actions">
              <ActionButton
                danger
                disabled={typed !== restore.serverName}
                onClick={() =>
                  props
                    .run(
                      restore.type === "full" ? "backup.full.restore" : "backup.restore",
                      { backupId: restore.id, confirmationToken: restore.token, serverName: typed, startAfter: true },
                      "HOST",
                    )
                    .then(() => {
                      setRestore(null);
                      refreshAll();
                    })
                }
              >Execute restore</ActionButton>
              <button className="cr-button" onClick={() => setRestore(null)}>Cancel</button>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}

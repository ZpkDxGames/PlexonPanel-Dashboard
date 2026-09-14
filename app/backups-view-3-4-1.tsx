"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ActionError } from "../lib/data-source";
import {
  number,
  record,
  records,
  str,
  type JsonMap,
} from "../lib/control-state";
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
};

type BackupRow = JsonMap & { _kind: "full" | "live" };
type FailureRecord = {
  action: string;
  requestId: string;
  status: string;
  code: string;
  phase: string;
  message: string;
  safeRelativePath: string;
  retryable: boolean;
  timestamp: string;
};
type ReadinessState = "Ready" | "Warning" | "Failed" | "Unknown" | "Not configured";

const FAILURE_KEY = "plexonpanel.backup.last-safe-failure.v1";
const DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];
const PHASES = [
  "COORDINATING_PAPER",
  "PREFLIGHT",
  "ARCHIVING",
  "HASHING",
  "UPLOADING",
  "FINALIZING",
  "COMPLETE",
];

function parseSchedule(value: unknown, fallback: ScheduleDraft): ScheduleDraft {
  const raw = record(value);
  const kind = str(raw.type, fallback.type);
  return {
    enabled: raw.enabled === true,
    type:
      kind === "WEEKLY" || kind === "SELECTED_WEEKDAYS" ? kind : "DAILY",
    weekdays: Array.isArray(raw.weekdays)
      ? raw.weekdays.filter((day): day is string => typeof day === "string")
      : fallback.weekdays,
    time: str(raw.time, fallback.time),
  };
}

function parseSettings(value: unknown): SettingsDraft {
  const root = record(value);
  const restart = record(root.restart);
  const full = record(root.fullRestorePoint);
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
          onChange={(event) =>
            onChange({ ...value, enabled: event.target.checked })
          }
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
                type === "DAILY"
                  ? []
                  : value.weekdays.length
                    ? value.weekdays
                    : ["SUNDAY"],
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

function readinessTone(state: ReadinessState): string {
  if (state === "Ready") return "green";
  if (state === "Failed") return "red";
  if (state === "Warning") return "amber";
  return "quiet";
}

function ReadinessItem({
  label,
  state,
  detail,
}: {
  label: string;
  state: ReadinessState;
  detail: string;
}) {
  return (
    <div className="cr341-readiness-item">
      <div>
        <strong>{label}</strong>
        <small>{detail}</small>
      </div>
      <Badge tone={readinessTone(state)}>{state}</Badge>
    </div>
  );
}

function queryAlert(
  title: string,
  query: { error: string; hasSuccess: boolean; updatedAt: number },
) {
  if (!query.error) return null;
  return (
    <p className="cr-alert" role="alert">
      <strong>{title}</strong> — {query.error}
      {query.hasSuccess && query.updatedAt > 0
        ? ` Showing last confirmed data from ${new Date(query.updatedAt).toLocaleString()}.`
        : " No authoritative state is available."}
    </p>
  );
}

function listStrings(value: unknown, limit = 16): string[] {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string")
        .slice(0, limit)
    : [];
}

export function BackupsView30(props: ViewProps) {
  const hostConnected = Boolean(props.state.ready?.agents.host);
  const paperConnected = Boolean(props.state.ready?.agents.paper);
  const canMaintenance = props.can("maintenance.status", "HOST");
  const canBackups =
    props.can("backup.full.list", "HOST") || props.can("backup.list", "HOST");

  const status = useQuery(
    "maintenance.status",
    {},
    hostConnected && canMaintenance,
    "HOST",
  );
  const settingsQuery = useQuery(
    "maintenance.settings.get",
    {},
    hostConnected && props.can("maintenance.settings.get", "HOST"),
    "HOST",
  );
  const fullQuery = useQuery(
    "backup.full.list",
    { page: 0 },
    hostConnected && props.can("backup.full.list", "HOST"),
    "HOST",
  );
  const liveQuery = useQuery(
    "backup.list",
    { page: 0 },
    hostConnected && props.can("backup.list", "HOST"),
    "HOST",
  );
  const providerQuery = useQuery(
    "provider.status",
    {},
    hostConnected && props.can("provider.status", "HOST"),
    "HOST",
  );

  const [diagnosticsData, setDiagnosticsData] = useState<JsonMap | null>(null);
  const [diagnosticsAt, setDiagnosticsAt] = useState(0);
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [localError, setLocalError] = useState("");
  const [lastFailure, setLastFailure] = useState<FailureRecord | null>(null);
  const [restore, setRestore] = useState<{
    type: "full" | "live";
    id: string;
    token: string;
    serverName: string;
  } | null>(null);
  const [typed, setTyped] = useState("");
  const [download, setDownload] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    try {
      const stored = window.sessionStorage.getItem(FAILURE_KEY);
      if (stored) {
        timer = window.setTimeout(() => {
          try {
            setLastFailure(JSON.parse(stored) as FailureRecord);
          } catch {
            // Invalid persisted diagnostics are ignored.
          }
        }, 0);
      }
    } catch {
      // A blocked session store must not block operational controls.
    }
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);
  useEffect(() => () => controller.current?.abort(), []);
  const setUnsaved = props.setUnsaved;
  useEffect(() => {
    setUnsaved?.(dirty);
    return () => setUnsaved?.(false);
  }, [dirty, setUnsaved]);
  useEffect(() => {
    if (!hostConnected || !canMaintenance) return;
    const timer = window.setInterval(status.refresh, 2000);
    return () => window.clearInterval(timer);
  }, [hostConnected, canMaintenance, status.refresh]);

  const persistedDraft = useMemo(
    () =>
      settingsQuery.hasSuccess && settingsQuery.data.settings
        ? parseSettings(settingsQuery.data.settings)
        : null,
    [settingsQuery.hasSuccess, settingsQuery.data.settings],
  );
  const activeDraft = draft ?? persistedDraft;
  const diagnostics = diagnosticsData ?? {};
  const provider = providerQuery.hasSuccess ? providerQuery.data : {};
  const operation = status.hasSuccess
    ? record(status.data.currentOperation)
    : {};
  const progress = props.state.backupProgress;

  const captureFailure = (action: string, error: unknown) => {
    const data = error instanceof ActionError ? error.data : {};
    const safe: FailureRecord = {
      action: error instanceof ActionError && error.action ? error.action : action,
      requestId: error instanceof ActionError ? error.requestId : "",
      status: error instanceof ActionError ? error.status : "FAILED",
      code: error instanceof ActionError ? error.code : "CLIENT_ERROR",
      phase: str(data.phase, "UNKNOWN"),
      message:
        error instanceof Error ? error.message : "The operation could not be completed.",
      safeRelativePath: str(data.safeRelativePath, ""),
      retryable: data.retryable === true,
      timestamp: new Date().toISOString(),
    };
    setLastFailure(safe);
    try {
      window.sessionStorage.setItem(FAILURE_KEY, JSON.stringify(safe));
    } catch {
      // The visible failure card remains available for this render session.
    }
  };

  const runOperation = async (
    action: string,
    parameters: JsonMap = {},
  ) => {
    setLocalError("");
    try {
      return await props.run(action, parameters, "HOST");
    } catch (error) {
      captureFailure(action, error);
      throw error;
    }
  };

  const runDiagnostics = async () => {
    const result = await runOperation("backup.preflight", {});
    setDiagnosticsData(result.data);
    setDiagnosticsAt(Date.now());
  };

  const refreshAll = () => {
    status.refresh();
    settingsQuery.refresh();
    fullQuery.refresh();
    liveQuery.refresh();
    providerQuery.refresh();
  };

  if (!hostConnected)
    return (
      <Empty title="Backups & Maintenance needs the Host companion">
        The browser and Paper plugin never receive systemd, rclone, or backup filesystem authority.
      </Empty>
    );
  if (!canBackups && !canMaintenance)
    return (
      <Empty title="Backups & Maintenance is unavailable">
        Your device or Host policy does not grant the required view capabilities.
      </Empty>
    );

  const unreadable = number(diagnostics.unreadableDurableCount);
  const missingIncludes = listStrings(diagnostics.missingIncludes);
  const symlinkIssues = listStrings(diagnostics.symlinkIssues);
  const providerState = str(provider.status, "UNKNOWN");
  const providerConfigured = provider.configured === true;
  const providerReadiness: ReadinessState = !providerQuery.hasSuccess
    ? "Unknown"
    : providerState === "LOCAL"
      ? "Not configured"
      : providerState === "CONNECTED"
        ? "Ready"
        : providerState === "DEGRADED" || providerState === "ERROR"
          ? "Failed"
          : providerState === "CONFIGURED_UNTESTED"
            ? "Warning"
            : "Unknown";
  const readReadiness: ReadinessState = !diagnosticsData
    ? "Unknown"
    : (unreadable ?? 0) > 0 || symlinkIssues.length > 0
      ? "Failed"
      : missingIncludes.length > 0
        ? "Warning"
        : "Ready";
  const storageReadiness: ReadinessState = !diagnosticsData
    ? "Unknown"
    : diagnostics.backupRootWritable === true
      ? "Ready"
      : "Failed";
  const recoveryKnown = status.hasSuccess || fullQuery.hasSuccess || liveQuery.hasSuccess;
  const recoveryRequired =
    status.data.jobRecoveryRequired === true ||
    status.data.restoreRecoveryRequired === true ||
    fullQuery.data.recoveryRequired === true ||
    liveQuery.data.recoveryRequired === true ||
    diagnostics.recoveryRequired === true;

  const fullBackups = records(fullQuery.data.backups, 1000);
  const liveBackups = records(liveQuery.data.backups, 1000);
  const allBackups: BackupRow[] = [
    ...fullBackups.map(
      (backup): BackupRow => ({ ...backup, _kind: "full" }),
    ),
    ...liveBackups.map(
      (backup): BackupRow => ({ ...backup, _kind: "live" }),
    ),
  ].sort(
    (a, b) =>
      Date.parse(str(b.timestamp, "1970-01-01")) -
      Date.parse(str(a.timestamp, "1970-01-01")),
  );

  const startRestore = async (type: "full" | "live", backupId: string) => {
    const action =
      type === "full" ? "backup.full.restore.prepare" : "backup.restore.prepare";
    const result = await runOperation(action, { backupId });
    setTyped("");
    setRestore({
      type,
      id: backupId,
      token: str(result.data.confirmationToken, ""),
      serverName: str(result.data.serverName, ""),
    });
  };

  const currentPhase = str(progress?.phase, str(operation.phase, ""));
  const currentIndex = PHASES.indexOf(currentPhase);
  const warnings = listStrings(progress?.warnings ?? operation.warnings);

  return (
    <div className="cr30-backups-stack">
      <div className="cr21-page-toolbar cr30-backup-toolbar">
        <div>
          <strong>Backups & Maintenance</strong>
          <span>
            Host-authoritative backup readiness, recovery, scheduling and off-site verification.
          </span>
        </div>
        <div className="cr-actions">
          <Badge tone="green">Host connected</Badge>
          <button className="cr-button" onClick={refreshAll}>Refresh</button>
        </div>
      </div>

      {queryAlert("Maintenance status unavailable", status)}
      {queryAlert("Full restore-point inventory unavailable", fullQuery)}
      {queryAlert("Live snapshot inventory unavailable", liveQuery)}
      {queryAlert("Provider status unavailable", providerQuery)}
      {localError && <p className="cr-alert" role="alert">{localError}</p>}

      <Panel
        title="Backup readiness"
        aside={
          props.can("backup.preflight", "HOST") ? (
            <ActionButton onClick={runDiagnostics}>Run backup diagnostics</ActionButton>
          ) : undefined
        }
      >
        <div className="cr341-readiness-grid">
          <ReadinessItem
            label="Paper coordination"
            state={paperConnected ? "Ready" : "Failed"}
            detail={paperConnected ? "Authenticated Paper agent is present." : "Paper is not currently authenticated."}
          />
          <ReadinessItem
            label="Host companion"
            state="Ready"
            detail="Authenticated Host control plane is connected."
          />
          <ReadinessItem
            label="Backup storage"
            state={storageReadiness}
            detail={
              diagnosticsData
                ? diagnostics.backupRootWritable === true
                  ? `${bytes(diagnostics.backupRootUsableBytes)} usable`
                  : "Configured backup root is not writable."
                : "Run backup diagnostics to verify storage."
            }
          />
          <ReadinessItem
            label="Filesystem read contract"
            state={readReadiness}
            detail={
              diagnosticsData
                ? `${unreadable ?? 0} unreadable durable · ${missingIncludes.length} missing includes · ${number(diagnostics.volatileExcludedCount) ?? 0} volatile excluded`
                : "Run backup diagnostics after Paper save flush."
            }
          />
          <ReadinessItem
            label="Systemd control"
            state={
              !diagnosticsData
                ? "Unknown"
                : str(diagnostics.serviceState, "unknown").toLowerCase() === "active"
                  ? "Ready"
                  : "Warning"
            }
            detail={diagnosticsData ? `Paper service: ${str(diagnostics.serviceState, "unknown")}` : "No destructive service test is run automatically."}
          />
          <ReadinessItem
            label="Off-site provider"
            state={providerReadiness}
            detail={
              providerQuery.hasSuccess
                ? providerState === "LOCAL"
                  ? "Running Host explicitly reports LOCAL."
                  : `${str(provider.provider, "RCLONE")} · ${str(provider.remote, "remote label unavailable")}`
                : "Provider truth is unavailable; LOCAL is not inferred."
            }
          />
          <ReadinessItem
            label="Recovery"
            state={!recoveryKnown && !diagnosticsData ? "Unknown" : recoveryRequired ? "Failed" : "Ready"}
            detail={recoveryRequired ? "Host recovery must be resolved before destructive operations." : recoveryKnown || diagnosticsData ? "No recovery requirement reported." : "Recovery state unavailable."}
          />
          <ReadinessItem
            label="Scheduler"
            state={status.hasSuccess ? "Ready" : "Unknown"}
            detail={status.hasSuccess ? `Host timezone: ${str(status.data.timezone, "unknown")}` : "Maintenance status has not been confirmed."}
          />
        </div>
        {diagnosticsAt > 0 && (
          <p className="cr-hint cr30-backup-preview-note">
            Diagnostics last ran {new Date(diagnosticsAt).toLocaleString()}. Provider reachability is not tested by preflight.
          </p>
        )}
        {missingIncludes.length > 0 && (
          <p className="cr-alert" role="alert">
            Missing configured includes: {missingIncludes.join(", ")}
          </p>
        )}
      </Panel>

      <div className="cr30-backup-columns">
        <Panel title="Non-disruptive actions" aside={<Badge>Paper remains online</Badge>}>
          <div className="cr30-backup-actions">
            {props.can("backup.preflight", "HOST") && (
              <ActionButton onClick={runDiagnostics}>Run backup diagnostics</ActionButton>
            )}
            {props.can("backup.create", "HOST") && (
              <ActionButton
                onClick={async () => {
                  await runOperation("backup.create", {});
                  liveQuery.refresh();
                }}
              >Create live snapshot</ActionButton>
            )}
            {props.can("provider.test", "HOST") && (
              <ActionButton
                onClick={async () => {
                  const result = await runOperation("provider.test", {});
                  props.notice(`Provider: ${str(result.data.status, "checked")}`);
                  providerQuery.refresh();
                }}
              >Test Google Drive</ActionButton>
            )}
          </div>
        </Panel>

        <Panel title="Disruptive maintenance" aside={<Badge tone="amber">Paper may stop</Badge>}>
          <div className="cr30-backup-actions">
            {props.can("maintenance.restart.now", "HOST") && (
              <ActionButton
                danger
                onClick={async () => {
                  if (!window.confirm("Restart PlexonCraft now? Paper will flush saves and the Host will require a fresh authenticated reconnect before reporting success.")) return;
                  await runOperation("maintenance.restart.now", { skipCountdown: true });
                  status.refresh();
                }}
              >Restart server</ActionButton>
            )}
            {props.can("maintenance.full-backup.create", "HOST") && (
              <ActionButton
                danger
                onClick={async () => {
                  if (!window.confirm("Create a full restore point now? Paper will be stopped while the cold full-server archive is created.")) return;
                  await runOperation("maintenance.full-backup.create", { skipCountdown: true });
                  status.refresh();
                  fullQuery.refresh();
                }}
              >Create full restore point</ActionButton>
            )}
          </div>
          <p className="cr-hint cr30-backup-preview-note">
            Full restore points intentionally stop Paper before mutable worlds and plugin databases are copied.
          </p>
        </Panel>
      </div>

      <Panel
        title="Provider"
        aside={<Badge tone={readinessTone(providerReadiness)}>{providerReadiness}</Badge>}
      >
        <dl className="cr30-provider-list">
          <div><dt>Provider</dt><dd>{providerQuery.hasSuccess ? str(provider.provider, "Unknown") : "Unknown"}</dd></div>
          <div><dt>Remote</dt><dd>{providerQuery.hasSuccess ? str(provider.remote, providerConfigured ? "Unavailable" : "Not configured") : "Unavailable"}</dd></div>
          <div><dt>Runtime state</dt><dd>{providerQuery.hasSuccess ? providerState : "UNKNOWN"}</dd></div>
          <div><dt>Last test</dt><dd>{providerQuery.hasSuccess ? time(provider.lastTestAt) : "—"}</dd></div>
          <div><dt>Last successful verification</dt><dd>{providerQuery.hasSuccess ? time(provider.lastSuccessfulVerificationAt) : "—"}</dd></div>
          <div><dt>Host config</dt><dd>{provider.hostConfigRestartRequired === true ? "Configuration changed on disk — restart Host to apply" : providerQuery.hasSuccess ? "Loaded configuration is current" : "Unknown"}</dd></div>
          <div><dt>Credentials</dt><dd>Host-local only</dd></div>
        </dl>
      </Panel>

      {(Object.keys(operation).length > 0 || progress) && (
        <Panel title="Current operation" aside={<Badge tone="cyan">{currentPhase || "Active"}</Badge>}>
          <div className="cr341-phase-list" aria-label="Backup operation phases">
            {PHASES.map((phase, index) => {
              const state = currentIndex < 0 ? "pending" : index < currentIndex ? "done" : index === currentIndex ? "active" : "pending";
              return (
                <div className={`cr341-phase ${state}`} key={phase}>
                  <span aria-hidden>{state === "done" ? "✓" : state === "active" ? "●" : "○"}</span>
                  <strong>{phase.replaceAll("_", " ").toLowerCase()}</strong>
                </div>
              );
            })}
          </div>
          <dl className="cr30-provider-list">
            <div><dt>Request / job</dt><dd>{str(progress?.requestId, str(progress?.jobId, str(operation.jobId, "—")))}</dd></div>
            <div><dt>Started</dt><dd>{time(progress?.startedAt ?? operation.startedAt)}</dd></div>
            <div><dt>Bytes</dt><dd>{bytes(progress?.bytes)}</dd></div>
            <div><dt>Entries</dt><dd>{number(progress?.entries) ?? "—"}</dd></div>
            <div><dt>Skipped transient</dt><dd>{number(progress?.skippedTransientCount ?? progress?.skipped) ?? "—"}</dd></div>
          </dl>
          {warnings.length > 0 && <p className="cr-alert">Warnings: {warnings.join(" · ")}</p>}
          <p className="cr-hint cr30-backup-preview-note">No ETA is invented when the Host does not know one.</p>
        </Panel>
      )}

      {lastFailure && (
        <Panel title="Last operation failure" aside={<Badge tone="red">{lastFailure.code}</Badge>}>
          <dl className="cr30-provider-list">
            <div><dt>Action</dt><dd>{lastFailure.action}</dd></div>
            <div><dt>Request ID</dt><dd>{lastFailure.requestId || "Unavailable"}</dd></div>
            <div><dt>Status</dt><dd>{lastFailure.status}</dd></div>
            <div><dt>Phase</dt><dd>{lastFailure.phase}</dd></div>
            {lastFailure.safeRelativePath && <div><dt>Affected path</dt><dd>{lastFailure.safeRelativePath}</dd></div>}
            <div><dt>Reason</dt><dd>{lastFailure.message}</dd></div>
            <div><dt>Timestamp</dt><dd>{time(lastFailure.timestamp)}</dd></div>
            <div><dt>Retry</dt><dd>{lastFailure.retryable ? "Retryable after the underlying condition clears" : "Operator intervention may be required"}</dd></div>
          </dl>
          <div className="cr-actions">
            <button
              className="cr-button"
              onClick={() => void navigator.clipboard.writeText(JSON.stringify(lastFailure, null, 2))}
            >Copy safe diagnostic</button>
            <button
              className="cr-button"
              onClick={() => {
                setLastFailure(null);
                try { window.sessionStorage.removeItem(FAILURE_KEY); } catch {}
              }}
            >Clear card</button>
          </div>
        </Panel>
      )}

      <Panel title="Backup inventory" aside={<Badge>{allBackups.length} loaded</Badge>}>
        {allBackups.length ? (
          <div className="cr-table-wrap cr30-backup-table">
            <table>
              <thead>
                <tr><th>Created</th><th>Type</th><th>Size</th><th>Copies</th><th>Verification</th><th>Warnings</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {allBackups.slice(0, 100).map((backup) => {
                  const id = str(backup.backupId);
                  const full = backup._kind === "full";
                  const size = full ? backup.archiveBytes : backup.bytes;
                  const backupWarnings = listStrings(backup.warnings);
                  const skipped = number(backup.skippedTransientCount) ?? 0;
                  const missing = listStrings(backup.missingIncludeWarnings);
                  return (
                    <tr key={`${backup._kind}-${id}`}>
                      <td>{time(backup.timestamp)}<small>{backup.automatic ? "Scheduled" : backup.emergency ? "Emergency" : "Manual"}</small></td>
                      <td><Badge tone={full ? "cyan" : "quiet"}>{full ? "Full restore point" : "Live snapshot"}</Badge></td>
                      <td>{bytes(size)}<small>{typeof backup.durationMillis === "number" ? `${Math.round(backup.durationMillis / 1000)}s` : "—"}</small></td>
                      <td><Badge tone={backup.local ? "green" : "quiet"}>{backup.local ? "Local" : "No local"}</Badge> <Badge tone={backup.offsite ? "green" : "quiet"}>{backup.offsite ? "Off-site" : "No off-site"}</Badge></td>
                      <td>{str(backup.verification, str(backup.sha256, "") ? "SHA-256" : "—")}<small title={str(backup.sha256, "")}>{str(backup.sha256, "").slice(0, 12)}{str(backup.sha256, "") ? "…" : ""}</small></td>
                      <td>{backupWarnings.length || skipped || missing.length ? <Badge tone="amber">{backupWarnings.length + missing.length} warnings · {skipped} skipped</Badge> : <Badge tone="green">Clear</Badge>}</td>
                      <td>
                        <div className="cr-actions">
                          {full && props.can("backup.full.verify", "HOST") && (
                            <ActionButton onClick={async () => { await runOperation("backup.full.verify", { backupId: id }); props.notice("Restore point verified."); }}>Verify</ActionButton>
                          )}
                          {full && !backup.offsite && providerConfigured && props.can("backup.full.retry-upload", "HOST") && (
                            <ActionButton onClick={async () => { await runOperation("backup.full.retry-upload", { backupId: id }); fullQuery.refresh(); }}>Retry upload</ActionButton>
                          )}
                          {!full && props.can("backup.download", "HOST") && (
                            <ActionButton
                              disabled={download !== null || Number(size) > 64 * 1024 * 1024}
                              onClick={async () => {
                                controller.current = new AbortController();
                                setDownload(0);
                                try {
                                  await downloadTransfer("backup.download", { backupId: id }, `PlexonPanel-${id}.zip`, "HOST", controller.current.signal, setDownload);
                                } catch (failure) {
                                  setLocalError(failure instanceof Error ? failure.message : "Download failed");
                                } finally {
                                  setDownload(null);
                                }
                              }}
                            >Download</ActionButton>
                          )}
                          {props.can(full ? "backup.full.restore.prepare" : "backup.restore.prepare", "HOST") && (
                            <ActionButton danger onClick={() => startRestore(full ? "full" : "live", id)}>Restore</ActionButton>
                          )}
                          {!backup.emergency && props.can(full ? "backup.full.delete" : "backup.delete", "HOST") && (
                            <ActionButton
                              danger
                              onClick={async () => {
                                if (!window.confirm("Delete this local backup metadata and archive?")) return;
                                await runOperation(full ? "backup.full.delete" : "backup.delete", { backupId: id });
                                if (full) fullQuery.refresh(); else liveQuery.refresh();
                              }}
                            >Delete</ActionButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title={fullQuery.busy || liveQuery.busy ? "Loading backups…" : "No confirmed backups"}>
            Inventory remains unknown if its query failed; an empty result is shown only from confirmed query data.
          </Empty>
        )}
        {download !== null && (
          <div className="cr30-download">
            <progress max={1} value={download} />
            <button className="cr-button" onClick={() => controller.current?.abort()}>Cancel download</button>
          </div>
        )}
        <p className="cr-hint cr30-backup-preview-note">Browser downloads remain capped at 64 MiB.</p>
      </Panel>

      <Panel title="Schedules" aside={<Badge>{status.hasSuccess ? str(status.data.timezone, "Host timezone") : "Unknown timezone"}</Badge>}>
        <div className="cr30-backup-metrics">
          <article className="cr30-backup-metric"><span>Next restart</span><strong>{status.hasSuccess ? time(status.data.nextRestart) : "Unknown"}</strong><small>Calendar maintenance</small></article>
          <article className="cr30-backup-metric"><span>Next full restore point</span><strong>{status.hasSuccess ? time(status.data.nextFullRestorePoint) : "Unknown"}</strong><small>Cold full-server archive</small></article>
          <article className="cr30-backup-metric"><span>Live snapshot</span><strong>{diagnosticsData ? number(diagnostics.legacyIntervalMinutes) === 0 ? "Disabled" : `Every ${number(diagnostics.legacyIntervalMinutes)} min` : "Unknown"}</strong><small>Protocol 3 Host interval scheduler · no decorative calendar schedule</small></article>
        </div>
        <p className="cr-hint cr30-backup-preview-note">
          Same-time full restore point + restart collapses into one serialized maintenance operation. Live snapshots remain on the separate Protocol 3 Host interval scheduler and all backup/maintenance work shares the Host operation lock. Keep unattended destructive schedules disabled until the intended live validation gates have been exercised.
        </p>
      </Panel>

      {activeDraft && props.can("maintenance.settings.get", "HOST") && (
        <Panel title="Maintenance settings" aside={dirty ? <Badge tone="amber">Unsaved</Badge> : <Badge>Host persisted</Badge>}>
          <div className="cr30-settings-grid">
            <section>
              <h3>Restart</h3>
              <ScheduleEditor value={activeDraft.restart.schedule} onChange={(schedule) => { setDraft({ ...activeDraft, restart: { ...activeDraft.restart, schedule } }); setDirty(true); }} />
              <label>Timezone<input value={activeDraft.timezone} onChange={(event) => { setDraft({ ...activeDraft, timezone: event.target.value }); setDirty(true); }} placeholder="America/Sao_Paulo" /></label>
              <label>Warnings · seconds<input value={activeDraft.restart.warningSeconds.join(", ")} onChange={(event) => { setDraft({ ...activeDraft, restart: { ...activeDraft.restart, warningSeconds: event.target.value.split(",").map((value) => Number(value.trim())).filter((value) => Number.isFinite(value) && value >= 0) } }); setDirty(true); }} /></label>
              <label>Startup timeout · seconds<input type="number" min={30} max={1800} value={activeDraft.restart.startupTimeoutSeconds} onChange={(event) => { setDraft({ ...activeDraft, restart: { ...activeDraft.restart, startupTimeoutSeconds: Number(event.target.value) } }); setDirty(true); }} /></label>
            </section>
            <section>
              <h3>Full restore point</h3>
              <ScheduleEditor value={activeDraft.fullRestorePoint.schedule} onChange={(schedule) => { setDraft({ ...activeDraft, fullRestorePoint: { ...activeDraft.fullRestorePoint, schedule } }); setDirty(true); }} />
              <label>Retention<select value={activeDraft.fullRestorePoint.retentionMode} onChange={(event) => { setDraft({ ...activeDraft, fullRestorePoint: { ...activeDraft.fullRestorePoint, retentionMode: event.target.value as "SINGLE_CURRENT" | "ROTATING" } }); setDirty(true); }}><option value="SINGLE_CURRENT">Single current</option><option value="ROTATING">Rotating</option></select></label>
              {activeDraft.fullRestorePoint.retentionMode === "ROTATING" && <label>Keep<input type="number" min={1} max={52} value={activeDraft.fullRestorePoint.retentionCount} onChange={(event) => { setDraft({ ...activeDraft, fullRestorePoint: { ...activeDraft.fullRestorePoint, retentionCount: Number(event.target.value) } }); setDirty(true); }} /></label>}
              <label>Canonical filename<input value={activeDraft.fullRestorePoint.canonicalFilename} onChange={(event) => { setDraft({ ...activeDraft, fullRestorePoint: { ...activeDraft.fullRestorePoint, canonicalFilename: event.target.value } }); setDirty(true); }} /></label>
              <label className="cr30-toggle-row"><input type="checkbox" checked={activeDraft.fullRestorePoint.restartAfter} onChange={(event) => { setDraft({ ...activeDraft, fullRestorePoint: { ...activeDraft.fullRestorePoint, restartAfter: event.target.checked } }); setDirty(true); }} />Restart after backup</label>
            </section>
          </div>
          <div className="cr-actions cr30-settings-actions">
            {props.can("maintenance.settings.update", "HOST") && (
              <ActionButton
                disabled={!dirty}
                onClick={async () => {
                  await runOperation("maintenance.settings.update", { settings: activeDraft as unknown as JsonMap });
                  setDirty(false);
                  setDraft(null);
                  settingsQuery.refresh();
                  status.refresh();
                  props.notice("Maintenance settings saved on the Host.");
                }}
              >Save settings</ActionButton>
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
                onClick={async () => {
                  await runOperation(
                    restore.type === "full" ? "backup.full.restore" : "backup.restore",
                    { backupId: restore.id, confirmationToken: restore.token, serverName: typed, startAfter: true },
                  );
                  setRestore(null);
                  refreshAll();
                }}
              >Execute restore</ActionButton>
              <button className="cr-button" onClick={() => setRestore(null)}>Cancel</button>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}

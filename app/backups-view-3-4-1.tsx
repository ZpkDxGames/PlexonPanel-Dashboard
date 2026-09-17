"use client";

import { useEffect, useMemo, useState } from "react";
import { ActionError } from "../lib/data-source";
import { number, record, records, str, type JsonMap } from "../lib/control-state";
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

type PhaseDefinition = { key: string; label: string };

const FAILURE_KEY = "plexonpanel.backup.last-safe-failure.v2";
const DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];
const COUNTDOWN_OPTIONS = [
  { seconds: 1800, label: "30 minutes", short: "30m", detail: "Recommended for busy hours" },
  { seconds: 900, label: "15 minutes", short: "15m", detail: "Balanced notice window" },
  { seconds: 600, label: "10 minutes", short: "10m", detail: "Short maintenance notice" },
  { seconds: 300, label: "5 minutes", short: "5m", detail: "Minimum safe preset" },
] as const;
type CountdownSeconds = (typeof COUNTDOWN_OPTIONS)[number]["seconds"];
const COUNTDOWN_BOUNDARIES = [1800, 900, 60, 30, 15, 5] as const;
const PHASES: PhaseDefinition[] = [
  { key: "QUEUED", label: "Queued" },
  { key: "PREFLIGHT", label: "Preflight" },
  { key: "COUNTDOWN", label: "Player warning countdown" },
  { key: "FINAL_SAVE", label: "Saving server" },
  { key: "STOPPING_SERVER", label: "Stopping Minecraft" },
  { key: "WAITING_FOR_STOP", label: "Confirming shutdown" },
  { key: "ARCHIVING", label: "Creating backup" },
  { key: "VERIFYING_LOCAL", label: "Verifying local backup" },
  { key: "UPLOADING_REMOTE", label: "Uploading to Google Drive" },
  { key: "VERIFYING_REMOTE", label: "Verifying Google Drive backup" },
  { key: "STARTING_SERVER", label: "Starting Minecraft" },
  { key: "VERIFYING_STARTUP", label: "Checking readiness" },
  { key: "COMPLETED", label: "Complete" },
];
const TERMINAL_PHASES = new Set(["COMPLETED", "DEGRADED", "FAILED"]);

function parseSchedule(value: unknown, fallback: ScheduleDraft): ScheduleDraft {
  const raw = record(value);
  const kind = str(raw.type, fallback.type);
  return {
    enabled: raw.enabled === true,
    type: kind === "WEEKLY" || kind === "SELECTED_WEEKDAYS" ? kind : "DAILY",
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
    schemaVersion: typeof root.schemaVersion === "number" ? root.schemaVersion : 1,
    timezone: str(root.timezone, "America/Sao_Paulo"),
    restart: {
      schedule: parseSchedule(restart.schedule, {
        enabled: false,
        type: "DAILY",
        weekdays: [],
        time: "04:00",
      }),
      warningSeconds: Array.isArray(restart.warningSeconds)
        ? restart.warningSeconds.filter((value): value is number => typeof value === "number")
        : [900, 300, 60, 30, 10],
      stopTimeoutSeconds:
        typeof restart.stopTimeoutSeconds === "number" ? restart.stopTimeoutSeconds : 180,
      startupTimeoutSeconds:
        typeof restart.startupTimeoutSeconds === "number" ? restart.startupTimeoutSeconds : 180,
    },
    fullRestorePoint: {
      retentionMode: full.retentionMode === "ROTATING" ? "ROTATING" : "SINGLE_CURRENT",
      retentionCount: typeof full.retentionCount === "number" ? full.retentionCount : 1,
      restartAfter: true,
      canonicalFilename: str(full.canonicalFilename, "PlexonCraft-Latest.zip"),
      uploadTimeoutSeconds:
        typeof full.uploadTimeoutSeconds === "number" ? full.uploadTimeoutSeconds : 1800,
      verificationMode: str(full.verificationMode, "SIZE_AND_HASH_WHEN_AVAILABLE"),
      maximumBytes:
        typeof full.maximumBytes === "number" ? full.maximumBytes : 1_099_511_627_776,
      excludes: Array.isArray(full.excludes)
        ? full.excludes.filter((entry): entry is string => typeof entry === "string")
        : ["logs", "crash-reports", "cache", ".cache"],
    },
  };
}

function isCountdownSeconds(value: number): value is CountdownSeconds {
  return COUNTDOWN_OPTIONS.some((option) => option.seconds === value);
}

function countdownLabel(seconds: number): string {
  return COUNTDOWN_OPTIONS.find((option) => option.seconds === seconds)?.label ?? `${seconds}s`;
}

function countdownWarnings(seconds: CountdownSeconds): number[] {
  return Array.from(
    new Set([seconds, ...COUNTDOWN_BOUNDARIES.filter((boundary) => boundary <= seconds)]),
  ).sort((left, right) => right - left);
}

function countdownWarningLabel(seconds: CountdownSeconds): string {
  return countdownWarnings(seconds)
    .map((value) => (value >= 60 ? `${value / 60}m` : `${value}s`))
    .join(" / ");
}

function restartCountdown(value: number[]): CountdownSeconds {
  const largest = Math.max(...value, 0);
  return isCountdownSeconds(largest) ? largest : 900;
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
      {value.type === "WEEKLY" && (
        <label>
          Weekday
          <select
            value={weekday}
            onChange={(event) => onChange({ ...value, weekdays: [event.target.value] })}
          >
            {DAYS.map((day) => (
              <option key={day} value={day}>
                {day.charAt(0) + day.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </label>
      )}
      {value.type === "SELECTED_WEEKDAYS" && (
        <fieldset className="cr35-weekday-picker">
          <legend>Restart days</legend>
          <div>
            {DAYS.map((day) => {
              const selected = value.weekdays.includes(day);
              return (
                <label key={day} className={selected ? "selected" : ""}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) => {
                      const weekdays = event.target.checked
                        ? DAYS.filter((candidate) =>
                            candidate === day || value.weekdays.includes(candidate),
                          )
                        : value.weekdays.filter((candidate) => candidate !== day);
                      onChange({ ...value, weekdays });
                    }}
                  />
                  {day.slice(0, 3)}
                </label>
              );
            })}
          </div>
        </fieldset>
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
    ? value.filter((entry): entry is string => typeof entry === "string").slice(0, limit)
    : [];
}

function booleanState(value: unknown): ReadinessState {
  return value === true ? "Ready" : value === false ? "Failed" : "Unknown";
}

function phaseLabel(phase: string): string {
  if (phase === "DEGRADED") return "Degraded — retry upload available";
  if (phase === "RECOVERY_REQUIRED") return "Recovery required";
  if (phase === "FAILED") return "Failed";
  return PHASES.find((entry) => entry.key === phase)?.label ?? phase.replaceAll("_", " ").toLowerCase();
}

function formatCountdown(value: number | null): string {
  if (value === null) return "Host countdown unavailable";
  const seconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function BackupsView30(props: ViewProps) {
  const hostConnected = Boolean(props.state.ready?.agents.host);
  const paperConnected = Boolean(props.state.ready?.agents.paper);
  const canMaintenance = props.can("maintenance.status", "HOST");
  const canBackups = props.can("backup.full.list", "HOST");
  const canPreflight = props.can("backup.preflight", "HOST");
  const canRunFullBackup = props.can("maintenance.full-backup.create", "HOST");
  const canResolveRecovery = props.can("maintenance.recovery.resolve", "HOST");

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
  const providerQuery = useQuery(
    "provider.status",
    {},
    hostConnected && props.can("provider.status", "HOST"),
    "HOST",
  );
  const preflight = useQuery(
    "backup.preflight",
    {},
    hostConnected && canPreflight,
    "HOST",
  );

  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmBackup, setConfirmBackup] = useState(false);
  const [backupCountdownSeconds, setBackupCountdownSeconds] =
    useState<CountdownSeconds>(1800);
  const [localError, setLocalError] = useState("");
  const [lastFailure, setLastFailure] = useState<FailureRecord | null>(null);

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
  const provider = providerQuery.hasSuccess ? providerQuery.data : {};
  const operation = status.hasSuccess ? record(status.data.currentOperation) : {};
  const operationPhase = str(operation.phase, "");
  const operationJobId = str(operation.jobId, "");
  const operationTerminal = TERMINAL_PHASES.has(operationPhase);
  const operationBlocking = Boolean(operationJobId) && (!operationTerminal || operationPhase === "RECOVERY_REQUIRED");
  const rawProgress = props.state.backupProgress;
  const progress =
    rawProgress && operationJobId && str(rawProgress.jobId, "") === operationJobId
      ? rawProgress
      : null;
  const displayedPhase = str(progress?.phase, operationPhase);
  const currentIndex = PHASES.findIndex((entry) => entry.key === displayedPhase);
  const service = props.state.service;
  const serviceState = str(service.state, "unknown").toLowerCase();
  const serviceKnown = ["active", "inactive", "failed"].includes(serviceState);
  const minecraftOnline = serviceState === "active";
  const commandConfigured = preflight.data.commandChannelConfigured === true;
  const minecraftReady = service.minecraftReady === true;
  const commandReady = !minecraftOnline || (commandConfigured && minecraftReady);
  const providerState = str(provider.status, "UNKNOWN");
  const providerConfigured = provider.configured === true;
  const recoveryKnown = status.hasSuccess || fullQuery.hasSuccess || preflight.hasSuccess;
  const jobRecoveryRequired =
    operationPhase === "RECOVERY_REQUIRED" ||
    operation.restartRecoveryRequired === true ||
    status.data.jobRecoveryRequired === true;
  const restoreRecoveryRequired =
    status.data.restoreRecoveryRequired === true ||
    fullQuery.data.recoveryRequired === true ||
    preflight.data.recoveryRequired === true ||
    service.recoveryRequired === true;
  const recoveryRequired = jobRecoveryRequired || restoreRecoveryRequired;
  const recoveryResolveReady =
    hostConnected &&
    canResolveRecovery &&
    jobRecoveryRequired &&
    minecraftOnline &&
    commandConfigured &&
    minecraftReady;
  const preflightReady =
    preflight.hasSuccess &&
    preflight.data.hostAuthenticated === true &&
    preflight.data.operationBusy !== true &&
    preflight.data.recoveryRequired !== true &&
    preflight.data.backupRootWritable === true &&
    serviceKnown &&
    commandReady;
  const actionReady =
    hostConnected &&
    canRunFullBackup &&
    preflightReady &&
    !operationBlocking &&
    !recoveryRequired;

  const fullBackups = fullQuery.hasSuccess ? records(fullQuery.data.backups, 1000) : [];
  const lastLocal = fullBackups.find((backup) => backup.local === true);
  const lastRemote = fullBackups.find((backup) => backup.offsite === true);
  const unreadable = number(preflight.data.unreadableDurableCount);
  const missingIncludes = listStrings(preflight.data.missingIncludes);
  const symlinkIssues = listStrings(preflight.data.symlinkIssues);
  const countdownRemaining = number(status.data.countdownRemainingSeconds);
  const countdownInitial = number(status.data.countdownInitialSeconds);
  const localVerified = operation.localBackupVerified === true;
  const remoteVerified = operation.remoteBackupVerified === true;
  const warnings = listStrings(progress?.warnings ?? operation.warnings);
  const progressRatio = number(progress?.progress);
  const progressPercent =
    progressRatio !== null
      ? Math.min(100, Math.round(progressRatio * 100))
      : number(operation.progressPercent);
  const progressBytes = progress?.bytesUploaded ?? progress?.bytes;
  const progressTotal = progress?.totalBytes;

  const captureFailure = (action: string, error: unknown) => {
    const data = error instanceof ActionError ? error.data : {};
    const safe: FailureRecord = {
      action: error instanceof ActionError && error.action ? error.action : action,
      requestId: error instanceof ActionError ? error.requestId : "",
      status: error instanceof ActionError ? error.status : "FAILED",
      code: error instanceof ActionError ? error.code : "CLIENT_ERROR",
      phase: str(data.phase, "UNKNOWN"),
      message: error instanceof Error ? error.message : "The operation could not be completed.",
      safeRelativePath: str(data.safeRelativePath, ""),
      retryable: data.retryable === true,
      timestamp: new Date().toISOString(),
    };
    setLastFailure(safe);
    setLocalError(safe.message);
    try {
      window.sessionStorage.setItem(FAILURE_KEY, JSON.stringify(safe));
    } catch {
      // The visible failure card remains available for this render session.
    }
  };

  const runOperation = async (
    action: string,
    parameters: JsonMap = {},
    confirmationMode: "default" | "preconfirmed" = "default",
  ) => {
    setLocalError("");
    try {
      return await props.run(action, parameters, "HOST", confirmationMode);
    } catch (error) {
      captureFailure(action, error);
      throw error;
    }
  };

  const refreshAll = () => {
    status.refresh();
    settingsQuery.refresh();
    fullQuery.refresh();
    providerQuery.refresh();
    preflight.refresh();
  };

  const readinessReason = !hostConnected
    ? "Host Companion is disconnected."
    : !canRunFullBackup
      ? "This device does not have maintenance.run."
      : recoveryRequired
        ? "Host recovery is required before another destructive operation."
        : operationBlocking
          ? "Another destructive Host operation is active."
          : !preflight.hasSuccess
            ? preflight.error || "Host preflight has not completed successfully."
            : !serviceKnown
              ? "Minecraft service state is not in a stable controllable state."
              : !commandReady
                ? "The Host command channel / RCON readiness check is not ready while Minecraft is online."
                : !preflightReady
                  ? "Host preflight is not ready."
                  : `Host preflight passed. The ${countdownLabel(backupCountdownSeconds)} countdown will begin only after confirmation.`;

  if (!hostConnected)
    return (
      <Empty title="Backups & Maintenance needs the Host Companion">
        Fully Backup Now is Host-authoritative. Paper is informative only and is not required for the backup critical path.
      </Empty>
    );

  if (!canBackups && !canMaintenance)
    return (
      <Empty title="Backups & Maintenance is unavailable">
        Your device or Host policy does not grant the required view capabilities.
      </Empty>
    );

  const providerReadiness: ReadinessState = !providerQuery.hasSuccess
    ? "Unknown"
    : providerState === "CONNECTED"
      ? "Ready"
      : providerState === "CONFIGURED_UNTESTED"
        ? "Warning"
        : providerConfigured
          ? "Failed"
          : "Not configured";
  const storageReadiness: ReadinessState = !preflight.hasSuccess
    ? preflight.error
      ? "Failed"
      : "Unknown"
    : preflight.data.backupRootWritable === true
      ? "Ready"
      : "Failed";
  const filesystemReadiness: ReadinessState = !preflight.hasSuccess
    ? preflight.error
      ? "Failed"
      : "Unknown"
    : (unreadable ?? 0) > 0 || symlinkIssues.length > 0
      ? "Failed"
      : missingIncludes.length > 0
        ? "Warning"
        : "Ready";

  return (
    <div className="cr30-backups-stack">
      <div className="cr21-page-toolbar cr30-backup-toolbar">
        <div>
          <strong>Backups & Maintenance</strong>
          <span>Host-authoritative manual full backups, verified history and recovery.</span>
        </div>
        <div className="cr-actions">
          <Badge tone="green">Host connected</Badge>
          <Badge tone={paperConnected ? "green" : "quiet"}>Paper {paperConnected ? "online" : "offline"}</Badge>
          <Badge tone="cyan">Manual full backup only</Badge>
          <button className="cr-button" onClick={refreshAll}>Refresh</button>
        </div>
      </div>

      {queryAlert("Maintenance status unavailable", status)}
      {queryAlert("Host backup preflight failed", preflight)}
      {queryAlert("Full restore-point inventory unavailable", fullQuery)}
      {queryAlert("Provider status unavailable", providerQuery)}
      {localError && <p className="cr-alert" role="alert">{localError}</p>}

      {recoveryRequired && (
        <div className="cr-step8-recovery" role="alert">
          <div>
            <strong>Recovery required</strong>
            <span>
              {jobRecoveryRequired
                ? "The previous maintenance job failed after crossing the stop boundary. Verify Minecraft is running and Host-local RCON readiness is healthy, then acknowledge recovery. This does not mark the backup successful."
                : "A restore recovery gate is unresolved. New backups remain blocked until Host recovery is completed."}
            </span>
          </div>
          <div className="cr-actions">
            <Badge tone="red">Blocked</Badge>
            {jobRecoveryRequired && canResolveRecovery && (
              <button
                className="cr-button"
                disabled={!recoveryResolveReady}
                onClick={async () => {
                  if (!window.confirm("Acknowledge this failed maintenance job after verifying Minecraft is online and Host-local RCON readiness is healthy? This will clear the recovery gate but will not mark the backup successful.")) return;
                  await runOperation("maintenance.recovery.resolve", {}, "preconfirmed");
                  refreshAll();
                  props.notice("Maintenance recovery acknowledged. The failed job remains recorded as failed.");
                }}
              >Verify & resolve recovery</button>
            )}
          </div>
        </div>
      )}

      <Panel title="Backup readiness" aside={<Badge tone={actionReady ? "green" : "amber"}>{actionReady ? "Ready" : "Not ready"}</Badge>}>
        <div className="cr341-readiness-grid">
          <ReadinessItem
            label="Host Companion"
            state="Ready"
            detail="Connected and authoritative for lifecycle, backup state, provider work and recovery."
          />
          <ReadinessItem
            label="maintenance.run"
            state={canRunFullBackup ? "Ready" : "Failed"}
            detail={canRunFullBackup ? "This device may start manual full maintenance." : "Required scope is not granted."}
          />
          <ReadinessItem
            label="Minecraft / systemd"
            state={serviceKnown ? "Ready" : serviceState === "unknown" ? "Unknown" : "Warning"}
            detail={`Service state: ${serviceState}${service.pid ? ` · PID ${String(service.pid)}` : ""}`}
          />
          <ReadinessItem
            label="Command channel / RCON"
            state={!minecraftOnline ? "Ready" : booleanState(commandConfigured && minecraftReady)}
            detail={!minecraftOnline ? "Not required while Minecraft is already stopped." : commandReady ? "Host command channel and readiness probe are healthy." : "Required before warning/save/shutdown while Minecraft is online."}
          />
          <ReadinessItem
            label="Backup storage"
            state={storageReadiness}
            detail={preflight.hasSuccess ? `${bytes(preflight.data.usableBytes ?? preflight.data.backupRootUsableBytes)} usable · ${bytes(preflight.data.requiredBytes)} required` : "Host preflight must verify writable storage and free space."}
          />
          <ReadinessItem
            label="Filesystem read contract"
            state={filesystemReadiness}
            detail={preflight.hasSuccess ? `${unreadable ?? 0} unreadable · ${missingIncludes.length} missing includes · ${symlinkIssues.length} symlink issues` : "Host preflight scans the durable source tree."}
          />
          <ReadinessItem
            label="Google Drive / rclone"
            state={providerReadiness}
            detail={preflight.hasSuccess ? `${str(preflight.data.provider, str(provider.provider, "RCLONE"))} · ${str(preflight.data.providerStatus, providerState)} · ${str(preflight.data.remote, str(provider.remote, "remote unavailable"))}` : providerConfigured ? `Configured · ${providerState}` : "Provider is not confirmed ready."}
          />
          <ReadinessItem
            label="Recovery / conflicts"
            state={!recoveryKnown ? "Unknown" : recoveryRequired ? "Failed" : operationBlocking ? "Warning" : "Ready"}
            detail={recoveryRequired ? "Resolve Host recovery before continuing." : operationBlocking ? `Current operation: ${phaseLabel(operationPhase)}` : "No blocking destructive operation reported."}
          />
        </div>
        <div className="cr-step8-readiness-footer">
          <span>{readinessReason}</span>
          {canPreflight && <ActionButton onClick={async () => preflight.refresh()}>Re-run Host preflight</ActionButton>}
        </div>
      </Panel>

      <Panel title="Fully Backup Now" className="cr-step8-primary-panel cr35-backup-launch" aside={<Badge tone="cyan">Manual · Host-owned</Badge>}>
        <div className="cr35-backup-hero">
          <div className="cr35-backup-intro">
            <span className="cr35-eyebrow">Complete cold-backup workflow</span>
            <strong>Save, stop, protect, upload and recover—under one durable Host job.</strong>
            <p>
              Choose how long players are warned. The Host then requires <code>save-all flush</code>, proves Minecraft stopped, verifies the local archive, promotes it to Google Drive and brings the server back online.
            </p>
            <div className="cr35-flow-chips" aria-label="Backup workflow summary">
              <span>1 · Player notice</span>
              <span>2 · Save &amp; stop</span>
              <span>3 · Verify locally</span>
              <span>4 · Google Drive</span>
              <span>5 · Auto-restart</span>
            </div>
          </div>
          <div className="cr35-launch-action">
            <span>Selected warning</span>
            <strong>{countdownLabel(backupCountdownSeconds)}</strong>
            <small>{countdownWarningLabel(backupCountdownSeconds)} notices</small>
            <button
              className="cr-button danger cr-step8-primary-button"
              disabled={!actionReady}
              onClick={() => setConfirmBackup(true)}
            >
              Review &amp; start backup
            </button>
          </div>
        </div>
        <div className="cr35-countdown-panel">
          <div>
            <strong>Initial player countdown</strong>
            <small>The selection is persisted by the Host and survives a browser refresh or Host reconnect.</small>
          </div>
          <div className="cr35-countdown-grid" role="radiogroup" aria-label="Initial backup countdown">
            {COUNTDOWN_OPTIONS.map((option) => {
              const selected = backupCountdownSeconds === option.seconds;
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`cr35-countdown-option ${selected ? "selected" : ""}`}
                  key={option.seconds}
                  onClick={() => setBackupCountdownSeconds(option.seconds)}
                >
                  <strong>{option.short}</strong>
                  <span>{option.detail}</span>
                </button>
              );
            })}
          </div>
          <div className="cr35-readiness-line">
            <span className={actionReady ? "ready" : "blocked"} aria-hidden />
            <small>{readinessReason}</small>
          </div>
        </div>
      </Panel>

      {operationJobId && (
        <Panel
          title={operationTerminal ? "Latest Host operation" : "Active Host operation"}
          aside={
            <Badge tone={operationPhase === "DEGRADED" ? "amber" : operationPhase === "FAILED" || operationPhase === "RECOVERY_REQUIRED" ? "red" : operationTerminal ? "green" : "cyan"}>
              {phaseLabel(displayedPhase || operationPhase)}
            </Badge>
          }
        >
          <div className="cr341-phase-list" aria-label="Backup operation phases">
            {PHASES.map((phase, index) => {
              const effectiveIndex = currentIndex < 0 ? PHASES.findIndex((entry) => entry.key === operationPhase) : currentIndex;
              const state = effectiveIndex < 0 ? "pending" : index < effectiveIndex ? "done" : index === effectiveIndex ? "active" : "pending";
              return (
                <div className={`cr341-phase ${state}`} key={phase.key}>
                  <span aria-hidden>{state === "done" ? "✓" : state === "active" ? "●" : "○"}</span>
                  <strong>
                    {phase.key === "COUNTDOWN"
                      ? `${countdownLabel(countdownInitial ?? backupCountdownSeconds)} countdown`
                      : phase.label}
                  </strong>
                </div>
              );
            })}
          </div>
          <dl className="cr30-provider-list">
            <div><dt>Job ID</dt><dd>{operationJobId}</dd></div>
            <div><dt>Current phase</dt><dd>{phaseLabel(displayedPhase || operationPhase)}</dd></div>
            <div><dt>Phase started</dt><dd>{time(operation.phaseTimestamp)}</dd></div>
            <div><dt>Job started</dt><dd>{time(operation.startedAt)}</dd></div>
            {countdownInitial !== null && <div><dt>Initial countdown</dt><dd>{countdownLabel(countdownInitial)}</dd></div>}
            {operationPhase === "COUNTDOWN" && <div><dt>Host countdown remaining</dt><dd>{formatCountdown(countdownRemaining)}</dd></div>}
            {operationPhase === "COUNTDOWN" && <div><dt>Host countdown deadline</dt><dd>{time(status.data.countdownDeadline)}</dd></div>}
            <div><dt>Progress</dt><dd>{progressPercent === null ? "Host has not reported a percentage" : `${progressPercent}%`}</dd></div>
            <div><dt>Transferred / archived</dt><dd>{progress ? `${bytes(progressBytes)} / ${bytes(progressTotal)}` : "No live byte counter reported for this phase"}</dd></div>
            <div><dt>Local verification</dt><dd>{localVerified ? "Verified" : operationTerminal ? "Not verified" : "Pending"}</dd></div>
            <div><dt>Remote verification</dt><dd>{remoteVerified ? "Verified" : operationPhase === "DEGRADED" ? "Not current — retryable" : operationTerminal ? "Not verified" : "Pending"}</dd></div>
            <div><dt>Result</dt><dd>{str(operation.result, operationTerminal ? operationPhase : "In progress")}</dd></div>
            <div><dt>Error code</dt><dd>{str(operation.errorCode, "—") || "—"}</dd></div>
            <div><dt>Safe message</dt><dd>{str(operation.errorMessage, "—") || "—"}</dd></div>
          </dl>
          {warnings.length > 0 && <p className="cr-alert">Warnings: {warnings.join(" · ")}</p>}
          {operationPhase === "DEGRADED" && (
            <div className="cr-step8-degraded">
              <div>
                <strong>Local backup verified; off-site copy is not current.</strong>
                <span>Minecraft availability has been restored. Retry Upload does not stop Minecraft again.</span>
              </div>
              {str(operation.backupId, "") && props.can("backup.full.retry-upload", "HOST") && (
                <ActionButton
                  onClick={async () => {
                    await runOperation("backup.full.retry-upload", { backupId: str(operation.backupId) });
                    refreshAll();
                    props.notice("Google Drive upload retry completed.");
                  }}
                >Retry Upload</ActionButton>
              )}
            </div>
          )}
          <p className="cr-hint cr30-backup-preview-note">
            This state is reconstructed from the durable Host job. Live byte progress is shown only when the event job ID matches this job; no ETA is invented.
          </p>
        </Panel>
      )}

      <div className="cr30-backup-columns">
        <Panel title="Provider & diagnostics" aside={<Badge tone={readinessTone(providerReadiness)}>{providerReadiness}</Badge>}>
          <dl className="cr30-provider-list">
            <div><dt>Provider</dt><dd>{providerQuery.hasSuccess ? str(provider.provider, "Unknown") : "Unknown"}</dd></div>
            <div><dt>Remote</dt><dd>{providerQuery.hasSuccess ? str(provider.remote, providerConfigured ? "Unavailable" : "Not configured") : "Unavailable"}</dd></div>
            <div><dt>Runtime state</dt><dd>{providerQuery.hasSuccess ? providerState : "UNKNOWN"}</dd></div>
            <div><dt>Last test</dt><dd>{providerQuery.hasSuccess ? time(provider.lastTestAt) : "—"}</dd></div>
            <div><dt>Last remote verification</dt><dd>{providerQuery.hasSuccess ? time(provider.lastSuccessfulVerificationAt) : lastRemote ? time(lastRemote.timestamp) : "—"}</dd></div>
            <div><dt>Credentials</dt><dd>Host-local only</dd></div>
          </dl>
          <div className="cr-actions cr-step8-inline-actions">
            {props.can("provider.test", "HOST") && (
              <ActionButton
                onClick={async () => {
                  const result = await runOperation("provider.test", {});
                  props.notice(`Provider: ${str(result.data.status, "checked")}`);
                  providerQuery.refresh();
                  preflight.refresh();
                }}
              >Test Google Drive</ActionButton>
            )}
          </div>
        </Panel>

        <Panel title="Last full backup" aside={<Badge>{lastLocal ? "Available" : "None"}</Badge>}>
          <dl className="cr30-provider-list">
            <div><dt>Last verified local</dt><dd>{lastLocal ? time(lastLocal.timestamp) : "—"}</dd></div>
            <div><dt>Size</dt><dd>{lastLocal ? bytes(lastLocal.archiveBytes) : "—"}</dd></div>
            <div><dt>Local verification</dt><dd>{lastLocal ? str(lastLocal.verification, str(lastLocal.sha256, "") ? "SHA-256" : "Unknown") : "—"}</dd></div>
            <div><dt>Off-site</dt><dd>{lastLocal ? (lastLocal.offsite === true ? "Verified" : "Not current") : "—"}</dd></div>
            <div><dt>Automatic backups</dt><dd>Retired — manual only</dd></div>
            <div><dt>Paper dependency</dt><dd>None for the backup critical path</dd></div>
          </dl>
        </Panel>
      </div>

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
          <div className="cr-actions cr-step8-inline-actions">
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

      <Panel title="Verified backup history" aside={<Badge>{fullBackups.length} loaded</Badge>}>
        <p className="cr-hint cr35-history-note">
          Verification, retry-upload and retention controls remain available here. Direct server-tree restore is intentionally excluded from the stable Host contract so the always-on Host can keep the Minecraft tree read-only.
        </p>
        {fullBackups.length ? (
          <div className="cr-table-wrap cr30-backup-table">
            <table>
              <thead>
                <tr><th>Created</th><th>Size</th><th>Copies</th><th>Verification</th><th>Result</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {fullBackups.slice(0, 100).map((backup) => {
                  const id = str(backup.backupId);
                  return (
                    <tr key={id}>
                      <td>{time(backup.timestamp)}<small>{backup.emergency ? "Emergency" : backup.automatic ? "Legacy scheduled" : "Manual"}</small></td>
                      <td>{bytes(backup.archiveBytes)}</td>
                      <td><Badge tone={backup.local ? "green" : "quiet"}>{backup.local ? "Local" : "No local"}</Badge> <Badge tone={backup.offsite ? "green" : "quiet"}>{backup.offsite ? "Off-site" : "No off-site"}</Badge></td>
                      <td>{str(backup.verification, str(backup.sha256, "") ? "SHA-256" : "—")}<small title={str(backup.sha256, "")}>{str(backup.sha256, "").slice(0, 12)}{str(backup.sha256, "") ? "…" : ""}</small></td>
                      <td><Badge tone={backup.result === "DEGRADED" ? "amber" : backup.errorCode ? "red" : "green"}>{str(backup.result, backup.offsite ? "Verified" : "Local")}</Badge></td>
                      <td>
                        <div className="cr-actions">
                          {props.can("backup.full.verify", "HOST") && (
                            <ActionButton onClick={async () => { await runOperation("backup.full.verify", { backupId: id }); props.notice("Backup verified."); }}>Verify</ActionButton>
                          )}
                          {backup.offsite !== true && backup.local === true && providerConfigured && props.can("backup.full.retry-upload", "HOST") && (
                            <ActionButton onClick={async () => { await runOperation("backup.full.retry-upload", { backupId: id }); fullQuery.refresh(); providerQuery.refresh(); }}>Retry Upload</ActionButton>
                          )}
                          {!backup.emergency && props.can("backup.full.delete", "HOST") && (
                            <ActionButton
                              danger
                              onClick={async () => {
                                if (!window.confirm("Delete this local full restore-point metadata and archive?")) return;
                                await runOperation("backup.full.delete", { backupId: id }, "preconfirmed");
                                fullQuery.refresh();
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
          <Empty title={fullQuery.busy ? "Loading backup history…" : "No confirmed backups"}>
            Inventory is shown only from confirmed Host data.
          </Empty>
        )}
      </Panel>

      <Panel title="Automatic restart schedule" aside={<Badge>{status.hasSuccess ? str(status.data.timezone, "Host timezone") : "Unknown timezone"}</Badge>}>
        <div className="cr30-backup-metrics">
          <article className="cr30-backup-metric"><span>Next restart</span><strong>{status.hasSuccess ? time(status.data.nextRestart) : "Unknown"}</strong><small>Restart-only maintenance</small></article>
          <article className="cr30-backup-metric"><span>Full backups</span><strong>Manual only</strong><small>No automatic full-backup schedule</small></article>
        </div>
        <div className="cr-actions cr-step8-inline-actions">
          {props.can("maintenance.restart.now", "HOST") && (
            <ActionButton
              danger
              disabled={operationBlocking || recoveryRequired}
              onClick={async () => {
                if (!window.confirm("Restart PlexonCraft using the Host-owned maintenance warning and readiness workflow?")) return;
                await runOperation("maintenance.restart.now", {}, "preconfirmed");
                status.refresh();
              }}
            >Restart server</ActionButton>
          )}
        </div>
      </Panel>

      {activeDraft && props.can("maintenance.settings.get", "HOST") && (
        <Panel title="Supported maintenance settings" aside={dirty ? <Badge tone="amber">Unsaved</Badge> : <Badge>Host persisted</Badge>}>
          <div className="cr30-settings-grid">
            <section>
              <h3>Automatic restart schedule</h3>
              <ScheduleEditor
                value={activeDraft.restart.schedule}
                onChange={(schedule) => {
                  setDraft({ ...activeDraft, restart: { ...activeDraft.restart, schedule } });
                  setDirty(true);
                }}
              />
              <label>Timezone<input value={activeDraft.timezone} onChange={(event) => { setDraft({ ...activeDraft, timezone: event.target.value }); setDirty(true); }} placeholder="America/Sao_Paulo" /></label>
              <label>
                Initial player countdown
                <select
                  value={restartCountdown(activeDraft.restart.warningSeconds)}
                  onChange={(event) => {
                    const seconds = Number(event.target.value);
                    if (!isCountdownSeconds(seconds)) return;
                    setDraft({
                      ...activeDraft,
                      restart: {
                        ...activeDraft.restart,
                        warningSeconds: countdownWarnings(seconds),
                      },
                    });
                    setDirty(true);
                  }}
                >
                  {COUNTDOWN_OPTIONS.map((option) => (
                    <option key={option.seconds} value={option.seconds}>
                      {option.label} · {countdownWarningLabel(option.seconds)} notices
                    </option>
                  ))}
                </select>
              </label>
              <label>Shutdown timeout · seconds<input type="number" min={30} max={1800} value={activeDraft.restart.stopTimeoutSeconds} onChange={(event) => { setDraft({ ...activeDraft, restart: { ...activeDraft.restart, stopTimeoutSeconds: Number(event.target.value) } }); setDirty(true); }} /></label>
              <label>Startup timeout · seconds<input type="number" min={30} max={1800} value={activeDraft.restart.startupTimeoutSeconds} onChange={(event) => { setDraft({ ...activeDraft, restart: { ...activeDraft.restart, startupTimeoutSeconds: Number(event.target.value) } }); setDirty(true); }} /></label>
            </section>
            <section>
              <h3>Manual full backup</h3>
              <p className="cr-hint">Automatic backups are retired. Full backup creation is manually initiated through Fully Backup Now and executed by the always-on Host Companion.</p>
              <label>Retention<select value={activeDraft.fullRestorePoint.retentionMode} onChange={(event) => { setDraft({ ...activeDraft, fullRestorePoint: { ...activeDraft.fullRestorePoint, retentionMode: event.target.value as "SINGLE_CURRENT" | "ROTATING" } }); setDirty(true); }}><option value="SINGLE_CURRENT">Single current</option><option value="ROTATING">Rotating</option></select></label>
              {activeDraft.fullRestorePoint.retentionMode === "ROTATING" && <label>Keep<input type="number" min={1} max={52} value={activeDraft.fullRestorePoint.retentionCount} onChange={(event) => { setDraft({ ...activeDraft, fullRestorePoint: { ...activeDraft.fullRestorePoint, retentionCount: Number(event.target.value) } }); setDirty(true); }} /></label>}
              <label>Canonical filename<input value={activeDraft.fullRestorePoint.canonicalFilename} onChange={(event) => { setDraft({ ...activeDraft, fullRestorePoint: { ...activeDraft.fullRestorePoint, canonicalFilename: event.target.value } }); setDirty(true); }} /></label>
              <div className="cr-step8-fixed-setting">
                <span>Restart after backup</span>
                <Badge tone="green">Required</Badge>
                <small>Minecraft service recovery is mandatory after a manual full backup or safely degraded completion.</small>
              </div>
            </section>
          </div>
          <div className="cr-actions cr30-settings-actions">
            {props.can("maintenance.settings.update", "HOST") && (
              <ActionButton
                disabled={!dirty}
                onClick={async () => {
                  const settings = {
                    ...activeDraft,
                    fullRestorePoint: {
                      ...activeDraft.fullRestorePoint,
                      restartAfter: true,
                    },
                  } as unknown as JsonMap;
                  await runOperation("maintenance.settings.update", { settings });
                  setDirty(false);
                  setDraft(null);
                  settingsQuery.refresh();
                  status.refresh();
                  preflight.refresh();
                  props.notice("Maintenance settings saved on the Host.");
                }}
              >Save settings</ActionButton>
            )}
            <button className="cr-button" disabled={!dirty} onClick={() => { setDraft(null); setDirty(false); }}>Discard</button>
          </div>
        </Panel>
      )}

      {confirmBackup && (
        <div className="cr-step8-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setConfirmBackup(false); }}>
          <section className="cr-step8-modal" role="dialog" aria-modal="true" aria-labelledby="fully-backup-confirm-title">
            <div className="cr-step8-modal-head">
              <div>
                <span>Destructive maintenance confirmation</span>
                <h2 id="fully-backup-confirm-title">Fully Backup Now</h2>
              </div>
              <button className="cr-button" onClick={() => setConfirmBackup(false)}>Cancel</button>
            </div>
            <div className="cr-step8-confirm-copy">
              <p>This operation is durable and continues even if this browser closes or reconnects.</p>
              <ol>
                <li>The Host begins the selected <strong>{countdownLabel(backupCountdownSeconds)}</strong> player countdown, with notices at {countdownWarningLabel(backupCountdownSeconds)}.</li>
                <li>The Host requires an affirmative <code>save-all flush</code> response, then stops Minecraft and independently proves shutdown.</li>
                <li>A cold full-server archive is created and locally verified with durable metadata/hash.</li>
                <li>The archive is uploaded to the configured Google Drive/rclone destination using safe staging/promotion and remotely verified.</li>
                <li>Minecraft automatically restarts and the Host verifies readiness.</li>
                <li>If off-site upload ultimately fails after a valid local backup exists, the server is restored online and the job may become degraded/retryable; Retry Upload does not require another shutdown.</li>
              </ol>
            </div>
            <div className="cr-step8-confirm-grid">
              <ReadinessItem label="Host" state="Ready" detail="Connected and authenticated." />
              <ReadinessItem label="Minecraft service" state={serviceKnown ? "Ready" : "Unknown"} detail={serviceKnown ? serviceState : "State unavailable"} />
              <ReadinessItem label="Google Drive" state={providerReadiness} detail={preflight.hasSuccess ? str(preflight.data.providerStatus, providerState) : providerState} />
              <ReadinessItem label="Backup storage" state={storageReadiness} detail={preflight.hasSuccess ? `${bytes(preflight.data.usableBytes)} usable` : "Not confirmed"} />
              <ReadinessItem label="Conflicting operation" state={operationBlocking ? "Failed" : "Ready"} detail={operationBlocking ? phaseLabel(operationPhase) : "None"} />
              <ReadinessItem label="Recovery gate" state={recoveryRequired ? "Failed" : "Ready"} detail={recoveryRequired ? "Recovery required" : "Clear"} />
            </div>
            <div className="cr-step8-modal-actions">
              <button className="cr-button" onClick={() => setConfirmBackup(false)}>Cancel</button>
              <ActionButton
                danger
                disabled={!actionReady}
                onClick={async () => {
                  await runOperation(
                    "maintenance.full-backup.create",
                    { countdownSeconds: backupCountdownSeconds },
                    "preconfirmed",
                  );
                  setConfirmBackup(false);
                  status.refresh();
                  fullQuery.refresh();
                  preflight.refresh();
                  props.notice(`Fully Backup Now queued with a ${countdownLabel(backupCountdownSeconds)} player countdown. You may close this page; the Host job will continue.`);
                }}
              >Confirm Fully Backup Now</ActionButton>
            </div>
          </section>
        </div>
      )}

    </div>
  );
}

"use client";

import { ActionButton, Badge, Button, Empty, PageHeader, Panel, Select } from "./ui/workspace";
import { Dialog, Disclosure } from "./ui/primitives";
import { BackupDestination } from "./backup-destination";
import { backupCheckState, backupProviderReadiness, backupProviderSnapshot, type BackupReadiness } from "../lib/backup-readiness";

import { useEffect, useMemo, useRef, useState } from "react";
import { ActionError, captureActionTarget } from "../lib/data-source";
import { number, record, records, str, type JsonMap } from "../lib/control-state";
import {
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
  serverId: string;
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

type ReadinessState = BackupReadiness;

type PhaseDefinition = { key: string; label: string };

const FAILURE_KEY = "plexonpanel.backup.last-safe-failure.v3";
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
  { key: "ARCHIVING", label: "Creating ZIP" },
  { key: "HASHING", label: "Verifying ZIP" },
  { key: "VERIFYING_LOCAL", label: "Verifying local backup" },
  { key: "UPLOADING_REMOTE", label: "Uploading to Google Drive" },
  { key: "VERIFYING_REMOTE", label: "Verifying Google Drive backup" },
  { key: "CLEANING_LOCAL", label: "Removing VPS ZIP" },
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
    <div className="view-schedule-grid">
      <label className="view-toggle-row">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
        />
        Enabled
      </label>
      <label>
        Frequency
        <Select aria-label="Frequency"
          value={value.type}
          onValueChange={(selectedValue) => {
            const type = selectedValue as ScheduleDraft["type"];
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
        </Select>
      </label>
      {value.type === "WEEKLY" && (
        <label>
          Weekday
          <Select aria-label="Weekday"
            value={weekday}
            onValueChange={(selectedValue) => onChange({ ...value, weekdays: [selectedValue] })}
          >
            {DAYS.map((day) => (
              <option key={day} value={day}>
                {day.charAt(0) + day.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </label>
      )}
      {value.type === "SELECTED_WEEKDAYS" && (
        <fieldset className="backup-weekday-picker">
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
    <div className="pp-list-row">
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
    <p className="pp-notice" role="alert">
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

export function BackupsView(props: ViewProps) {
  const failureKey = `${FAILURE_KEY}:${props.state.serverId}`;
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
  const backupReviewTarget=useRef<ReturnType<typeof captureActionTarget>|null>(null);
  const openBackupReview=()=>{try{backupReviewTarget.current=captureActionTarget(props.state.serverId,'HOST');setConfirmBackup(true);}catch{props.notice('The Host connection changed. Reconnect and review the backup again.');}};
  useEffect(()=>{if(!confirmBackup)return;let current;try{current=captureActionTarget(props.state.serverId,'HOST');}catch{}if(current?.generation!==backupReviewTarget.current?.generation){queueMicrotask(()=>setConfirmBackup(false));}},[confirmBackup,props.state.ready,props.state.serverId]);
  const [backupCountdownSeconds, setBackupCountdownSeconds] =
    useState<CountdownSeconds>(1800);
  const [localError, setLocalError] = useState("");
  const [lastFailure, setLastFailure] = useState<FailureRecord | null>(null);
  const [refreshCooldown, setRefreshCooldown] = useState(false);
  useEffect(() => {
    if (!refreshCooldown) return;
    const timer = window.setTimeout(() => setRefreshCooldown(false), 5000);
    return () => window.clearTimeout(timer);
  }, [refreshCooldown]);

  useEffect(() => {
    let timer: number | undefined;
    try {
      const stored = window.sessionStorage.getItem(failureKey);
      if (stored) {
        timer = window.setTimeout(() => {
          try {
            const failure = JSON.parse(stored) as FailureRecord;
            if (failure.serverId === props.state.serverId) setLastFailure(failure);
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
  }, [failureKey, props.state.serverId]);

  const setUnsaved = props.setUnsaved;
  useEffect(() => {
    setUnsaved?.(dirty);
    return () => setUnsaved?.(false);
  }, [dirty, setUnsaved]);

  const persistedDraft = useMemo(
    () =>
      settingsQuery.hasSuccess && settingsQuery.data.settings
        ? parseSettings(settingsQuery.data.settings)
        : null,
    [settingsQuery.hasSuccess, settingsQuery.data.settings],
  );
  const activeDraft = draft ?? persistedDraft;
  const { data: provider, fromPreflight: providerFromPreflight, known: providerKnown } = backupProviderSnapshot(providerQuery, preflight);
  const operation = status.hasSuccess ? record(status.data.currentOperation) : {};
  const operationPhase = str(operation.phase, "");
  const operationJobId = str(operation.jobId, "");
  const operationTerminal = TERMINAL_PHASES.has(operationPhase);
  const operationBlocking = Boolean(operationJobId) && (!operationTerminal || operationPhase === "RECOVERY_REQUIRED");
  const { busy: statusBusy, refresh: refreshStatus } = status;
  useEffect(() => {
    if (!hostConnected || !canMaintenance || statusBusy) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") refreshStatus();
    }, operationBlocking ? 2000 : 15000);
    return () => window.clearInterval(timer);
  }, [hostConnected, canMaintenance, operationBlocking, statusBusy, refreshStatus]);
  const rawProgress = props.state.backupProgress;
  const progress =
    rawProgress && operationJobId && str(rawProgress.jobId, "") === operationJobId
      ? rawProgress
      : null;
  const livePhaseIndex = PHASES.findIndex(entry => entry.key === str(progress?.phase, ""));
  const durablePhaseIndex = PHASES.findIndex(entry => entry.key === operationPhase);
  const liveBackupProgress = progress && !operationTerminal && livePhaseIndex >= 0 && livePhaseIndex >= durablePhaseIndex ? progress : null;
  const displayedPhase = str(liveBackupProgress?.phase, operationPhase);
  const observeBackupPhase = props.observeBackupPhase;
  useEffect(() => {
    if (operationJobId && displayedPhase) observeBackupPhase?.(operationJobId, displayedPhase);
  }, [operationJobId, displayedPhase, observeBackupPhase]);
  const currentIndex = PHASES.findIndex((entry) => entry.key === displayedPhase);
  const service = props.state.service;
  const serviceState = str(service.state, "unknown").toLowerCase();
  const serviceKnown = ["active", "inactive", "failed"].includes(serviceState);
  const minecraftOnline = serviceState === "active";
  const statusCommandChannel = record(status.data.commandChannel);
  const commandConfigured =
    statusCommandChannel.enabled === true ||
    preflight.data.commandChannelConfigured === true;
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
    !preflight.error && !preflight.busy &&
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
  const lastRemote = fullBackups.find((backup) => backup.offsite === true);
  const lastBackup = fullBackups.find(
    (backup) => backup.local === true || backup.offsite === true,
  );
  const unreadable = number(preflight.data.unreadableDurableCount);
  const missingIncludes = listStrings(preflight.data.missingIncludes);
  const symlinkIssues = listStrings(preflight.data.symlinkIssues);
  const countdownRemaining = number(status.data.countdownRemainingSeconds);
  const countdownInitial = number(status.data.countdownInitialSeconds);
  const localVerified = operation.localBackupVerified === true;
  const remoteVerified = operation.remoteBackupVerified === true;
  const warnings = listStrings(liveBackupProgress?.warnings ?? operation.warnings);
  const progressRatio = number(liveBackupProgress?.progress);

  const progressBytes = liveBackupProgress?.bytesUploaded ?? liveBackupProgress?.bytes;
  const progressTotal = liveBackupProgress?.totalBytes;
  const progressBytesValue = number(progressBytes);
  const progressTotalValue = number(progressTotal);
  const progressBytesPerSecond = number(liveBackupProgress?.bytesPerSecond);
  const liveProgressRatio =
    progressRatio !== null
      ? Math.max(0, Math.min(1, progressRatio))
      : progressBytesValue !== null && progressTotalValue !== null && progressTotalValue > 0
        ? Math.max(0, Math.min(1, progressBytesValue / progressTotalValue))
        : null;
  const liveProgressPercent =
    liveProgressRatio === null ? number(operation.progressPercent) : Math.min(100, Math.round(liveProgressRatio * 100));
  const progressState = str(liveBackupProgress?.providerState, "");
  const liveProgressKind =
    displayedPhase === "ARCHIVING" || displayedPhase === "HASHING"
      ? "archive"
      : displayedPhase === "UPLOADING_REMOTE"
        ? "upload"
        : displayedPhase === "CLEANING_LOCAL"
          ? "cleanup"
          : "verify";
  const liveProgressTitle =
    displayedPhase === "ARCHIVING"
      ? "Creating ZIP archive"
      : displayedPhase === "HASHING"
        ? "Finalizing and verifying ZIP"
        : displayedPhase === "UPLOADING_REMOTE"
          ? "Uploading ZIP to Google Drive"
          : displayedPhase === "VERIFYING_REMOTE"
            ? "Verifying Google Drive copy"
            : displayedPhase === "CLEANING_LOCAL"
              ? "Removing temporary VPS ZIP"
              : "Processing backup";
  const liveProgressDetail =
    displayedPhase === "ARCHIVING"
      ? "Source data read and compressed by the Host"
      : displayedPhase === "HASHING"
        ? "ZIP write complete; checking archive integrity and SHA-256"
        : displayedPhase === "UPLOADING_REMOTE"
          ? "Verified ZIP bytes transferred by rclone"
          : displayedPhase === "VERIFYING_REMOTE"
            ? "Checking the staged object before canonical promotion"
            : progressState === "LOCAL_RELEASED"
              ? "Remote copy verified; temporary VPS ZIP removed"
              : progressState === "LOCAL_RETAINED"
                ? "Remote copy verified; VPS ZIP retained with a cleanup warning"
                : "Remote copy verified; releasing temporary disk space";

  const captureFailure = (action: string, error: unknown) => {
    const data = error instanceof ActionError ? error.data : {};
    const safe: FailureRecord = {
      serverId: props.state.serverId,
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
      window.sessionStorage.setItem(failureKey, JSON.stringify(safe));
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
      if (!(error instanceof Error && error.message === "Cancelled")) captureFailure(action, error);
      throw error;
    }
  };

  const refreshAll = () => {
    setRefreshCooldown(true);
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
      <section className="pp-workspace" data-ui6-workspace="Backups"><PageHeader title="Backups" description="Host companion disconnected." primary={<Button disabled disabledReason="Reconnect the authenticated Host.">Fully Backup Now</Button>}/><Panel title="Backup readiness"><dl className="pp-facts">{["Host","Device","Service","RCON","Storage","Recovery"].map(label=><div key={label}><dt>{label}</dt><dd><Badge>Unknown</Badge> Reconnect Host to run preflight.</dd></div>)}</dl></Panel></section>
    );

  if (!canBackups && !canMaintenance)
    return (
      <Empty title="Backups & Maintenance is unavailable">
        Your device or Host policy does not grant the required view capabilities.
      </Empty>
    );

  const providerReadiness = backupProviderReadiness(providerQuery, preflight);
  const storageReadiness = backupCheckState(preflight, "storage");
  const filesystemReadiness = backupCheckState(preflight, "source");

  const retryPrimary=operationPhase==='DEGRADED'&&operation.retryable===true&&Boolean(str(operation.backupId,''))&&props.can('backup.full.retry-upload','HOST');
  return (
    <div className="pp-workspace" data-ui6-workspace="Backups">
      <PageHeader title="Backups" description={operationJobId ? `Host job: ${phaseLabel(displayedPhase)}.` : "Manual full backups run on the Host."}
        primary={retryPrimary?<ActionButton variant="primary" onClick={async()=>{const result=await runOperation('backup.full.retry-upload',{backupId:str(operation.backupId)});refreshAll();return result;}}>Retry Upload</ActionButton>:<Button variant="primary" disabled={!actionReady} disabledReason={readinessReason} onClick={openBackupReview}>Fully Backup Now</Button>}
        secondary={<Disclosure title="More">{retryPrimary&&<Button disabled={!actionReady} disabledReason={readinessReason} onClick={openBackupReview}>Fully Backup Now</Button>}<div className="pp-row view-backup-toolbar"><Badge tone="green">Host connected</Badge><Badge tone={paperConnected ? "green" : "quiet"}>Paper {paperConnected ? "online" : "offline"}</Badge><Button disabled={refreshCooldown || status.busy || settingsQuery.busy || fullQuery.busy || providerQuery.busy || preflight.busy} onClick={refreshAll}>Refresh</Button></div></Disclosure>}/>

      {queryAlert("Maintenance status unavailable", status)}
      {queryAlert("Host backup preflight failed", preflight)}
      {queryAlert("Full restore-point inventory unavailable", fullQuery)}
      {queryAlert("Provider status unavailable", providerQuery)}
      {localError && <p className="pp-notice" role="alert">{localError}</p>}

      <BackupDestination state={props.state} configured={providerConfigured}
        remote={str(provider.remote, "")}
        restartRequired={provider.hostConfigRestartRequired === true} />

      {recoveryRequired && (
        <div className="pp-notice" role="alert">
          <div>
            <strong>Recovery required</strong>
            <span>
              {jobRecoveryRequired
                ? "The previous maintenance job failed after crossing the stop boundary. Verify Minecraft is running and Host-local RCON readiness is healthy, then acknowledge recovery. This does not mark the backup successful."
                : "A restore recovery gate is unresolved. New backups remain blocked until Host recovery is completed."}
            </span>
          </div>
          <div className="pp-row">
            <Badge tone="red">Blocked</Badge>
            {jobRecoveryRequired && canResolveRecovery && (
              <ActionButton
                disabled={!recoveryResolveReady}
                onClick={async () => {
                  await runOperation("maintenance.recovery.resolve");
                  refreshAll();
                  props.notice("Maintenance recovery acknowledged. The failed job remains recorded as failed.");
                }}
              >Verify & resolve recovery</ActionButton>
            )}
            {jobRecoveryRequired && !canResolveRecovery && (
              <Badge tone="amber">Re-pair Owner to resolve</Badge>
            )}
          </div>
        </div>
      )}

      <Panel title="Backup readiness" aside={<Badge tone={actionReady ? "green" : "amber"}>{actionReady ? "Ready" : "Not ready"}</Badge>}>
        <div className="pp-data-grid">
          <ReadinessItem
            label="Host Companion"
            state="Ready"
            detail="Connected and authoritative for lifecycle, backup state, provider work and recovery."
          />
          <ReadinessItem
            label="maintenance.run"
            state={canRunFullBackup ? "Ready" : "Failed"}
            detail={canRunFullBackup ? "This device may start manual full maintenance." : "This browser's signed grant does not include maintenance.run; re-pair as Owner."}
          />
          <ReadinessItem
            label="Minecraft / systemd"
            state={serviceKnown ? "Ready" : serviceState === "unknown" ? "Unknown" : "Warning"}
            detail={`Service state: ${serviceState}${service.pid ? `. PID ${String(service.pid)}` : ""}`}
          />
          <ReadinessItem
            label="Command channel / RCON"
            state={!minecraftOnline ? "Ready" : booleanState(commandConfigured && minecraftReady)}
            detail={!minecraftOnline ? "Not required while Minecraft is already stopped." : commandReady ? "Host command channel and readiness probe are healthy." : "Required before warning/save/shutdown while Minecraft is online."}
          />
          <ReadinessItem
            label="Backup storage"
            state={storageReadiness}
            detail={storageReadiness === "Unknown" ? "Not verified. Complete the earlier preflight gate, then refresh." : preflight.hasSuccess ? `${bytes(preflight.data.usableBytes ?? preflight.data.backupRootUsableBytes)} usable. ${bytes(preflight.data.requiredBytes)} required` : "Host preflight reported a storage failure."}
          />
          <ReadinessItem
            label="Filesystem read contract"
            state={filesystemReadiness}
            detail={filesystemReadiness === "Unknown" ? "Not verified. Provider setup must pass before the Host scans the source tree." : preflight.hasSuccess ? `${unreadable ?? "Not supplied"} unreadable. ${missingIncludes.length} missing includes. ${symlinkIssues.length} symlink issues` : "Host preflight reported a source-read failure."}
          />
          <ReadinessItem
            label="Google Drive / rclone"
            state={providerReadiness}
            detail={preflight.hasSuccess ? `${str(preflight.data.provider, str(provider.provider, "RCLONE"))}. ${str(preflight.data.providerStatus, providerState)}. ${str(preflight.data.remote, str(provider.remote, "remote unavailable"))}` : providerConfigured ? `Configured. ${providerState}` : "Provider is not confirmed ready."}
          />
          <ReadinessItem
            label="Recovery / conflicts"
            state={!recoveryKnown ? "Unknown" : recoveryRequired ? "Failed" : operationBlocking ? "Warning" : "Ready"}
            detail={recoveryRequired ? "Resolve Host recovery before continuing." : operationBlocking ? `Current operation: ${phaseLabel(operationPhase)}` : "No blocking destructive operation reported."}
          />
        </div>
        <div className="backup-ui-readiness-footer">
          <span>{readinessReason}</span>
          {canPreflight && <ActionButton onClick={async () => preflight.refresh()}>Re-run Host preflight</ActionButton>}
        </div>
      </Panel>

      <Disclosure title="Full backup workflow and countdown">
        <p>The Host warns players, saves and stops Minecraft, verifies an archive, uploads it and restarts the service. Reloading the browser does not cancel the job.</p>
        <label>Initial backup countdown<Select aria-label="Initial backup countdown" value={backupCountdownSeconds} onValueChange={value=>{const seconds=Number(value);if(isCountdownSeconds(seconds))setBackupCountdownSeconds(seconds);}}>{COUNTDOWN_OPTIONS.map(option=><option key={option.seconds} value={option.seconds}>{option.label}</option>)}</Select></label>
      </Disclosure>

      {operationJobId && (
        <Panel
          title={operationTerminal ? "Latest Host operation" : "Active Host operation"}
          aside={
            <Badge tone={operationPhase === "DEGRADED" ? "amber" : operationPhase === "FAILED" || operationPhase === "RECOVERY_REQUIRED" ? "red" : operationTerminal ? "green" : "cyan"}>
              {phaseLabel(displayedPhase || operationPhase)}
            </Badge>
          }
        >
          <div className="pp-phase-list" aria-label="Backup operation phases">
            {PHASES.map((phase, index) => {
              const effectiveIndex = currentIndex < 0 ? PHASES.findIndex((entry) => entry.key === operationPhase) : currentIndex;
              const state = effectiveIndex < 0 ? "pending" : index < effectiveIndex ? "done" : index === effectiveIndex ? "active" : "pending";
              return (
                <div className={`backup-phase ${state}`} key={phase.key}>
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
          {(
            <section
              className={`pp-record backup-live-progress ${liveProgressKind}`}
              aria-live="polite"
              aria-label={liveProgressTitle}
            >
              <header>
                <div>
                  <span>Live Host progress</span>
                  <strong>{liveProgressTitle}</strong>
                  <small>{liveProgressDetail}</small>
                </div>
                <strong className="backup-live-progress-percent">
                  {liveProgressPercent === null ? "Not supplied" : liveProgressPercent}
                  {liveProgressPercent !== null && <small>%</small>}
                </strong>
              </header>
              <progress
                max={1}
                value={liveProgressRatio ?? undefined}
                aria-label={`${liveProgressTitle}${liveProgressPercent === null ? "" : `: ${liveProgressPercent}%`}`}
              />
              <div className="pp-stat-grid">
                <span>
                  {displayedPhase === "ARCHIVING" || displayedPhase === "HASHING"
                    ? "Source processed"
                    : "ZIP transferred"}
                  <strong>{progressBytesValue===null ? "Not supplied" : bytes(progressBytesValue)} / {progressTotalValue===null ? "Not supplied" : bytes(progressTotalValue)}</strong>
                </span>
                {progressBytesPerSecond !== null && progressBytesPerSecond > 0 && (
                  <span>Current rate<strong>{bytes(progressBytesPerSecond)}/s</strong></span>
                )}
                {progressState && (
                  <span>Host state<strong>{progressState.replaceAll("_", " ").toLowerCase()}</strong></span>
                )}
              </div>
            </section>
          )}
          <div className="backup-job-groups">
            <section><h3>Job</h3><dl className="pp-facts">
              <div><dt>Job ID</dt><dd>{operationJobId || 'Not supplied'}</dd></div>
              <div><dt>Job started</dt><dd>{operation.startedAt ? time(operation.startedAt) : 'Not supplied'}</dd></div>
              <div><dt>Current phase</dt><dd>{phaseLabel(displayedPhase || operationPhase) || 'Not supplied'}</dd></div>
              <div><dt>Phase started</dt><dd>{operation.phaseTimestamp ? time(operation.phaseTimestamp) : 'Not supplied'}</dd></div>
              <div><dt>Result</dt><dd>{str(operation.result,'Not supplied')}</dd></div>
            </dl></section>
            <section><h3>Local verification</h3><dl className="pp-facts"><div><dt>Local verification</dt><dd>{operation.localBackupVerified===undefined?'Not supplied':localVerified?'Verified':operationTerminal?'Not verified':'Pending'}</dd></div></dl></section>
            <section><h3>Remote verification</h3><dl className="pp-facts"><div><dt>Remote verification</dt><dd>{operation.remoteBackupVerified===undefined?'Not supplied':remoteVerified?'Verified':operationPhase==='DEGRADED'?'Not current — retryable':operationTerminal?'Not verified':'Pending'}</dd></div></dl><p className="pp-muted">Remote backup verification is separate from the provider connectivity test.</p></section>
            <section><h3>Progress</h3><dl className="pp-facts">
              {countdownInitial!==null&&<div><dt>Initial countdown</dt><dd>{countdownLabel(countdownInitial)}</dd></div>}
              {operationPhase==='COUNTDOWN'&&<><div><dt>Host countdown remaining</dt><dd>{formatCountdown(countdownRemaining)}</dd></div><div><dt>Host countdown deadline</dt><dd>{status.data.countdownDeadline?time(status.data.countdownDeadline):'Not supplied'}</dd></div></>}
              <div><dt>Progress</dt><dd>{liveProgressTitle ? 'Shown for the current phase above.' : 'Not supplied'}</dd></div>
              <div><dt>Transferred / archived</dt><dd>{liveProgressTitle ? 'Shown for the current phase above.' : 'Not supplied'}</dd></div>
            </dl></section>
            <section><h3>Error</h3><dl className="pp-facts"><div><dt>Error code</dt><dd>{str(operation.errorCode,'Not supplied')||'Not supplied'}</dd></div><div><dt>Safe message</dt><dd>{str(operation.errorMessage,'Not supplied')||'Not supplied'}</dd></div></dl></section>
          </div>
          {warnings.length > 0 && <p className="pp-notice">Warnings: {warnings.join(". ")}</p>}

          {operationPhase === "DEGRADED" && (
            <div className="pp-notice">
              <div>
                <strong>{localVerified ? 'Local backup verified. Off-site copy not current.' : 'Off-site copy not current. Review local verification.'}</strong>
                <span>{minecraftOnline && minecraftReady ? 'Minecraft availability restored.' : 'Minecraft availability: check the Host service state.'} Retry Upload does not stop Minecraft again.</span>{str(operation.errorCode,'')==='REMOTE_VERIFY_FAILED'&&<p>The Host could not verify the remote copy. Check the Google Drive connection on the server, then retry.</p>}
              </div>
              {!retryPrimary && str(operation.backupId, "") && props.can("backup.full.retry-upload", "HOST") && (
                <ActionButton
                  onClick={async () => {
                    await runOperation("backup.full.retry-upload", { backupId: str(operation.backupId) });
                    refreshAll();

                  }}
                >Retry Upload</ActionButton>
              )}
            </div>
          )}
          <p className="pp-muted view-backup-preview-note">
            This state is reconstructed from the durable Host job. ZIP and upload byte counters are shown only when a live Host event matches this job; remote verification and VPS cleanup remain separate phases, and no ETA is invented.
          </p>
        </Panel>
      )}

      <div className="pp-data-grid">
        <Panel title="Provider & diagnostics" aside={<Badge tone={readinessTone(providerReadiness)}>{providerReadiness}</Badge>}>
          <dl className="pp-facts">
            <div><dt>Provider</dt><dd>{providerKnown ? str(provider.provider, "Unknown") : "Unknown"}</dd></div>
            <div><dt>Remote</dt><dd>{providerKnown ? str(provider.remote, providerConfigured ? "Unavailable" : "Not configured") : "Unavailable"}</dd></div>
            <div><dt>Runtime state</dt><dd>{providerKnown ? providerState : "UNKNOWN"}</dd></div>
            <div><dt>Last test</dt><dd>{providerFromPreflight ? "Passed during latest preflight" : providerQuery.hasSuccess ? time(provider.lastTestAt) : "—"}</dd></div>
            <div><dt>Last remote verification</dt><dd>{providerQuery.hasSuccess ? time(provider.lastSuccessfulVerificationAt) : lastRemote ? time(lastRemote.timestamp) : "—"}</dd></div>
            <div><dt>Credentials</dt><dd>Host-local only</dd></div>
          </dl>
          <div className="pp-row ">
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

        <Panel
          title="Last full backup"
          aside={
            <Badge tone={lastBackup ? "green" : "quiet"}>
              {lastBackup ? (lastBackup.offsite ? (lastBackup.local ? "VPS + Drive" : "Google Drive") : "VPS only") : "None"}
            </Badge>
          }
        >
          <dl className="pp-facts">
            <div><dt>Last verified</dt><dd>{lastBackup ? time(lastBackup.timestamp) : "—"}</dd></div>
            <div><dt>Size</dt><dd>{lastBackup ? bytes(lastBackup.archiveBytes) : "—"}</dd></div>
            <div><dt>Verification</dt><dd>{lastBackup ? str(lastBackup.verification, str(lastBackup.sha256, "") ? "SHA-256" : "Unknown") : "—"}</dd></div>
            <div><dt>Availability</dt><dd>{lastBackup ? (lastBackup.offsite === true ? (lastBackup.local === true ? "Google Drive + VPS" : "Google Drive. VPS temporary ZIP released") : "VPS only") : "—"}</dd></div>
            <div><dt>Automatic backups</dt><dd>Retired — manual only</dd></div>
            <div><dt>Paper dependency</dt><dd>None for the backup critical path</dd></div>
          </dl>
        </Panel>
      </div>

      {lastFailure && (
        <Panel title="Last operation failure" aside={<Badge tone="red">{lastFailure.code}</Badge>}>
          <dl className="pp-facts">
            <div><dt>Action</dt><dd>{lastFailure.action}</dd></div>
            <div><dt>Request ID</dt><dd>{lastFailure.requestId || "Unavailable"}</dd></div>
            <div><dt>Status</dt><dd>{lastFailure.status}</dd></div>
            <div><dt>Phase</dt><dd>{lastFailure.phase}</dd></div>
            {lastFailure.safeRelativePath && <div><dt>Affected path</dt><dd>{lastFailure.safeRelativePath}</dd></div>}
            <div><dt>Reason</dt><dd>{lastFailure.message}</dd></div>
            <div><dt>Timestamp</dt><dd>{time(lastFailure.timestamp)}</dd></div>
            <div><dt>Retry</dt><dd>{lastFailure.retryable ? "Retryable after the underlying condition clears" : "Operator intervention may be required"}</dd></div>
          </dl>
          <div className="pp-row ">
            <Button

              onClick={() => void navigator.clipboard.writeText(JSON.stringify(lastFailure, null, 2))}
            >Copy safe diagnostic</Button>
            <Button

              onClick={() => {
                setLastFailure(null);
                try { window.sessionStorage.removeItem(failureKey); } catch {}
              }}
            >Clear card</Button>
          </div>
        </Panel>
      )}

      <Panel title="Verified backup history" aside={<Badge>{fullBackups.length} loaded</Badge>}>
        <p className="pp-muted backup-history-note">
          Verification, retry-upload and retention controls remain available here. Direct server-tree restore is intentionally excluded from the stable Host contract so the always-on Host can keep the Minecraft tree read-only.
        </p>
        {fullBackups.length ? (
          <div className="pp-table-wrap" data-cards="true">
            <table className="pp-table"><caption className="pp-sr-only">Verified backup history</caption>
              <thead>
                <tr><th>Created</th><th>Size</th><th>Copies</th><th>Verification</th><th>Result</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {fullBackups.slice(0, 100).map((backup) => {
                  const id = str(backup.backupId);
                  return (
                    <tr key={id}>
                      <td data-label="Created">{time(backup.timestamp)}<small>{backup.emergency ? "Emergency" : backup.automatic ? "Legacy scheduled" : "Manual"}</small></td>
                      <td data-label="Size">{bytes(backup.archiveBytes)}</td>
                      <td data-label="Copies"><Badge tone={backup.local ? "green" : "quiet"}>{backup.local ? "VPS retained" : "VPS temp released"}</Badge> <Badge tone={backup.offsite ? "green" : "quiet"}>{backup.offsite ? "Google Drive" : "No off-site"}</Badge></td>
                      <td data-label="Verification">{str(backup.verification, str(backup.sha256, "") ? "SHA-256" : "—")}<small title={str(backup.sha256, "")}>{str(backup.sha256, "").slice(0, 12)}{str(backup.sha256, "") ? "…" : ""}</small></td>
                      <td data-label="Result"><Badge tone={backup.result === "DEGRADED" || backup.result === "SUCCESS_WITH_WARNING" ? "amber" : backup.errorCode ? "red" : "green"}>{str(backup.result, backup.offsite ? "Verified" : "Local")}</Badge></td>
                      <td data-label="Actions">
                        <div className="pp-row">
                          {backup.local === true && props.can("backup.full.verify", "HOST") && (
                            <ActionButton onClick={async () => { await runOperation("backup.full.verify", { backupId: id }); props.notice("Backup verified."); }}>Verify</ActionButton>
                          )}
                          {backup.offsite !== true && backup.local === true && providerConfigured && props.can("backup.full.retry-upload", "HOST") && (
                            <ActionButton onClick={async () => { await runOperation("backup.full.retry-upload", { backupId: id }); fullQuery.refresh(); providerQuery.refresh(); }}>Retry Upload</ActionButton>
                          )}
                          {!backup.emergency && props.can("backup.full.delete", "HOST") && (
                            <ActionButton
                              danger
                              onClick={async () => {
                                await runOperation("backup.full.delete", { backupId: id });
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
        <div className="pp-stat-grid">
          <article className="pp-stat"><span>Next restart</span><strong>{status.hasSuccess ? time(status.data.nextRestart) : "Unknown"}</strong><small>Restart-only maintenance</small></article>
          <article className="pp-stat"><span>Full backups</span><strong>Manual only</strong><small>No automatic full-backup schedule</small></article>
        </div>
        <div className="pp-row ">
          {props.can("maintenance.restart.now", "HOST") && (
            <ActionButton
              danger
              disabled={operationBlocking || recoveryRequired}
              onClick={async () => {
                await runOperation("maintenance.restart.now");
                status.refresh();
              }}
            >Restart server</ActionButton>
          )}
        </div>
      </Panel>

      {activeDraft && props.can("maintenance.settings.get", "HOST") && (
        <Panel title="Supported maintenance settings" aside={dirty ? <Badge tone="amber">Unsaved</Badge> : <Badge>Host persisted</Badge>}>
          <div className="pp-data-grid">
            <section className="pp-form">
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
                <Select aria-label="Initial player countdown"
                  value={restartCountdown(activeDraft.restart.warningSeconds)}
                  onValueChange={(selectedValue) => {
                    const seconds = Number(selectedValue);
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
                      {option.label}. {countdownWarningLabel(option.seconds)} notices
                    </option>
                  ))}
                </Select>
              </label>
              <label>Shutdown timeout. seconds<input type="number" min={30} max={1800} value={activeDraft.restart.stopTimeoutSeconds} onChange={(event) => { setDraft({ ...activeDraft, restart: { ...activeDraft.restart, stopTimeoutSeconds: Number(event.target.value) } }); setDirty(true); }} /></label>
              <label>Startup timeout. seconds<input type="number" min={30} max={1800} value={activeDraft.restart.startupTimeoutSeconds} onChange={(event) => { setDraft({ ...activeDraft, restart: { ...activeDraft.restart, startupTimeoutSeconds: Number(event.target.value) } }); setDirty(true); }} /></label>
            </section>
            <section className="pp-form">
              <h3>Manual full backup</h3>
              <p className="pp-muted">Automatic backups are retired. Full backup creation is manually initiated through Fully Backup Now and executed by the always-on Host Companion.</p>
              <label>Retention<Select aria-label="Retention" value={activeDraft.fullRestorePoint.retentionMode} onValueChange={(selectedValue) => { setDraft({ ...activeDraft, fullRestorePoint: { ...activeDraft.fullRestorePoint, retentionMode: selectedValue as "SINGLE_CURRENT" | "ROTATING" } }); setDirty(true); }}><option value="SINGLE_CURRENT">Single current</option><option value="ROTATING">Rotating</option></Select></label>
              {activeDraft.fullRestorePoint.retentionMode === "ROTATING" && <label>Keep<input type="number" min={1} max={52} value={activeDraft.fullRestorePoint.retentionCount} onChange={(event) => { setDraft({ ...activeDraft, fullRestorePoint: { ...activeDraft.fullRestorePoint, retentionCount: Number(event.target.value) } }); setDirty(true); }} /></label>}
              <label>Canonical filename<input value={activeDraft.fullRestorePoint.canonicalFilename} onChange={(event) => { setDraft({ ...activeDraft, fullRestorePoint: { ...activeDraft.fullRestorePoint, canonicalFilename: event.target.value } }); setDirty(true); }} /></label>
              <div className="pp-notice">
                <span>Restart after backup</span>
                <Badge tone="green">Required</Badge>
                <small>Minecraft service recovery is mandatory after a manual full backup or safely degraded completion.</small>
              </div>
            </section>
          </div>
          <div className="pp-row pp-form-footer">
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
                  const result=await runOperation("maintenance.settings.update", { settings });
                  setDirty(false);
                  setDraft(null);
                  settingsQuery.refresh();
                  status.refresh();
                  preflight.refresh();
                  return result;
                }}
              >Save settings</ActionButton>
            )}
            <Button disabled={!dirty} onClick={() => { setDraft(null); setDirty(false); }}>Discard</Button>
          </div>
        </Panel>
      )}

      {confirmBackup && (
          <Dialog open title="Fully Backup Now" className="backup-ui-modal" onClose={()=>setConfirmBackup(false)}>
            <label>Initial backup countdown<Select aria-label="Confirmation countdown" value={backupCountdownSeconds} onValueChange={value=>{const seconds=Number(value);if(isCountdownSeconds(seconds))setBackupCountdownSeconds(seconds);}}>{COUNTDOWN_OPTIONS.map(option=><option key={option.seconds} value={option.seconds}>{option.label}</option>)}</Select></label>
            <div className="pp-prose">
              <p>This cold backup runs on <strong>{props.state.ready?.server.serverName ?? "this server"}</strong> (<code>{props.state.serverId}</code>). It continues even if this browser closes or reconnects.</p>
              <ol>
                <li>The Host begins the selected <strong>{countdownLabel(backupCountdownSeconds)}</strong> player countdown, with notices at {countdownWarningLabel(backupCountdownSeconds)}.</li>
                <li>The Host requires an affirmative <code>save-all flush</code> response, then stops Minecraft and independently proves shutdown.</li>
                <li>A cold full-server archive is created and locally verified with durable metadata/hash.</li>
                <li>The archive is uploaded to the configured Google Drive/rclone destination using safe staging/promotion and remotely verified.</li>
                <li>Minecraft automatically restarts and the Host verifies readiness.</li>
                <li>If off-site upload ultimately fails after a valid local backup exists, the server is restored online and the job may become degraded/retryable; Retry Upload does not require another shutdown.</li>
              </ol>
            </div>
            <div className="pp-data-grid">
              <ReadinessItem label="Host" state="Ready" detail="Connected and authenticated." />
              <ReadinessItem label="Minecraft service" state={serviceKnown ? "Ready" : "Unknown"} detail={serviceKnown ? serviceState : "State unavailable"} />
              <ReadinessItem label="Google Drive" state={providerReadiness} detail={preflight.hasSuccess ? str(preflight.data.providerStatus, providerState) : providerState} />
              <ReadinessItem label="Backup storage" state={storageReadiness} detail={preflight.hasSuccess ? `${bytes(preflight.data.usableBytes)} usable` : "Not confirmed"} />
              <ReadinessItem label="Conflicting operation" state={operationBlocking ? "Failed" : "Ready"} detail={operationBlocking ? phaseLabel(operationPhase) : "None"} />
              <ReadinessItem label="Recovery gate" state={recoveryRequired ? "Failed" : "Ready"} detail={recoveryRequired ? "Recovery required" : "Clear"} />
            </div>
            <div className="pp-form-footer">
              <Button onClick={() => setConfirmBackup(false)}>Cancel</Button>
              <ActionButton
                danger
                disabled={!actionReady}
                onClick={async () => {
                  if(backupReviewTarget.current?.generation!==captureActionTarget(props.state.serverId,'HOST').generation)throw new Error('The Host target changed. Review the backup again.');
                  const result=await runOperation(
                    "maintenance.full-backup.create",
                    { countdownSeconds: backupCountdownSeconds },
                    "preconfirmed",
                  );
                  setConfirmBackup(false);
                  status.refresh();
                  fullQuery.refresh();
                  preflight.refresh();
                  return result;
                }}
              >Confirm Fully Backup Now</ActionButton>
            </div>
          </Dialog>
      )}

    </div>
  );
}

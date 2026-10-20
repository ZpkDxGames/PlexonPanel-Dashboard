"use client";
import { useState } from "react";
import {
  ArchiveRestore,
  Check,
  Copy,
  RefreshCw,
  UploadCloud,
  X,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { PpSelect } from "../primitives/Select";
import { MutationButton } from "../primitives/MutationButton";
import { useReview } from "../primitives/ReviewProvider";
import { useBackupsVm } from "../bindings/backups-bindings";
import {
  session,
  record,
  gib,
  date,
  time,
  usePrefs,
  validateMaintenance,
  type JsonMap,
} from "../bindings";
import {
  buildStages,
  classifyArchive,
  deriveCreateGate,
  timeOptions,
  retentionOptions,
  type DestinationMode,
  type PreflightView,
} from "../bindings/backups-model";
import { formatMmSs } from "../bindings/maintenance";
import { useViewSync } from "../bindings/view-sync";
import { QueryState, Table } from "./shared";
type Vm = ReturnType<typeof useBackupsVm>;
const DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];
const MODES: { value: DestinationMode; label: string }[] = [
  { value: "AUTO", label: "Auto" },
  { value: "DRIVE_AND_LOCAL", label: "Drive + Local" },
  { value: "LOCAL_ONLY", label: "Local VPS only" },
];
function State({
  ok,
  children,
}: {
  ok: boolean | null;
  children: React.ReactNode;
}) {
  return (
    <span
      className="pp-state"
      data-tone={ok === null ? "warn" : ok ? "ok" : "bad"}
    >
      {children}
    </span>
  );
}
function PreflightRibbon({
  p,
  gateCode,
  busy,
}: {
  p: PreflightView | null;
  gateCode: string | null;
  busy: boolean;
}) {
  if (!p)
    return (
      <div
        className="pp-ribbon"
        data-testid="preflight-ribbon"
        aria-busy={busy}
      >
        {["recovery", "source", "storage", "provider"].map((g, i) => (
          <div className="pp-ribbon__cell" data-gate={g} key={g}>
            <span className="pp-kicker">
              0{i + 1} · {g}
            </span>
            <span className="muted">
              {busy ? "Checking…" : "Unavailable · re-run preflight"}
            </span>
          </div>
        ))}
      </div>
    );
  return (
    <div className="pp-ribbon" data-testid="preflight-ribbon" aria-busy={busy}>
      <div
        className="pp-ribbon__cell"
        data-gate="recovery"
        data-code={gateCode === "RECOVERY_REQUIRED" ? gateCode : undefined}
      >
        <span className="pp-kicker">01 · Recovery &amp; lock</span>
        <State ok={!p.recoveryRequired}>
          {p.recoveryRequired
            ? "Recovery required"
            : gateCode === "JOB_RUNNING"
              ? "Operation active"
              : "Clear"}
        </State>
        <small className="muted">
          {p.recoveryRequired
            ? "Resolve to unlock backups"
            : gateCode === "JOB_RUNNING"
              ? "Wait for the current operation"
              : "Recovery journal clear"}
        </small>
      </div>
      <div
        className="pp-ribbon__cell"
        data-gate="source"
        data-code={p.sourceErrorCode ?? undefined}
      >
        <span className="pp-kicker">02 · World source scan</span>
        <State ok={p.legacyHost ? null : p.sourceState === "READY"}>
          {p.legacyHost
            ? "Legacy Host preflight"
            : p.sourceState === "READY"
              ? `Ready · ${gib(p.sourceBytes)}`
              : (p.sourceErrorCode ?? "Failed")}
        </State>
        <small className="muted">
          {p.legacyHost
            ? "Detailed scan not reported"
            : `${p.entryCount.toLocaleString()} files · ${p.includes.length} roots`}
        </small>
      </div>
      <div
        className="pp-ribbon__cell"
        data-gate="storage"
        data-code={p.storageErrorCode ?? undefined}
      >
        <span className="pp-kicker">03 · VPS disk headroom</span>
        <State ok={p.legacyHost ? null : p.storageState === "READY"}>
          {p.legacyHost
            ? "Detailed storage not reported"
            : p.storageState === "READY"
              ? `Ready · ${gib(p.usableBytes)} free`
              : (p.storageErrorCode ?? "Failed")}
        </State>
        <small className="muted">
          {p.legacyHost
            ? "Upgrade Host for independent gates"
            : `${gib(p.requiredBytes)} required · 2× + safety margin`}
        </small>
      </div>
      <div
        className="pp-ribbon__cell"
        data-gate="provider"
        data-code={p.providerErrorCode ?? undefined}
      >
        <span className="pp-kicker">04 · Off-site rclone</span>
        <State
          ok={
            p.providerState === "CONNECTED"
              ? true
              : p.localBackupReady
                ? null
                : false
          }
        >
          {p.legacyHost
            ? "Host update required for local backups"
            : p.providerState === "CONNECTED"
              ? "Connected"
              : p.providerState === "NOT_CONFIGURED"
                ? p.localBackupReady
                  ? "Local only"
                  : "Not configured"
                : "Unreachable"}
        </State>
        <small
          className="muted pp-ellipsis"
          title={p.providerMessage ?? p.remote ?? ""}
        >
          {p.providerErrorCode ?? p.remote ?? "No provider evidence"}
        </small>
      </div>
    </div>
  );
}
export default function Backups() {
  const vm = useBackupsVm(),
    prefs = usePrefs(),
    sync = useViewSync(),
    review = useReview(),
    [mode, setMode] = useState<DestinationMode>("AUTO"),
    [scheduleOpen, setScheduleOpen] = useState(false),
    [restoreReview, setRestoreReview] = useState(false),
    [filter, setFilter] = useState<"ALL" | "DRIVE" | "LOCAL">("ALL"),
    [pending, setPending] = useState(""),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(""),
    p = vm.preflight,
    legacy = p?.legacyHost ?? true,
    recovery = vm.recoveryRequired || p?.recoveryRequired,
    busy = vm.jobState === "ACTIVE" || p?.operationBusy === true,
    gate = deriveCreateGate({
      jobBusy: busy,
      preflight: p,
      mode,
      allowLocalFallback: vm.full.allowLocalFallback === true,
    }),
    reason =
      session.reason("backup.create", "HOST") ||
      (recovery
        ? "Recovery gate is active. Clear it before backing up."
        : gate.title),
    blocked = !!reason || vm.preflightBusy || !!pending,
    stages = buildStages({
      labels: vm.labels,
      currentIndex: vm.stageIndex,
      skipped: vm.skippedStages,
      failed: vm.jobState === "FAILED" || !!recovery,
    }),
    rows = vm.restorePoints.filter(
      (r) =>
        filter === "ALL" ||
        (filter === "DRIVE" ? r.offsite : r.local && !r.offsite),
    );
  async function act(action: string, args: JsonMap = {}) {
    if (pending) return;
    setPending(action);
    setError("");
    try {
      await vm.invoke(action, args);
      await vm.refresh();
      vm.history.retry();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending("");
    }
  }
  const clear = () => {
    setRestoreReview(false);
    void act(
      "maintenance.recovery.resolve",
      p?.restoreRecoveryRequired ? { acknowledgeRestore: true } : {},
    );
  };
  return (
    <div className="pp-page" data-route="backups">
      <h1 className="sr-only">Backup durability workbench</h1>
      <section className="pp-pane pp-durability" aria-labelledby="pp-dur-title">
        <header className="pp-durability__head">
          <h2 id="pp-dur-title">
            Cold backup pipeline{" "}
            <span className="muted">· {stages.length} stages</span>
          </h2>
          <State
            ok={
              recovery
                ? null
                : vm.jobState === "FAILED"
                  ? false
                  : vm.jobState === "ACTIVE"
                    ? true
                    : null
            }
          >
            {recovery
              ? "Recovery required"
              : vm.jobState === "ACTIVE"
                ? "Active"
                : vm.jobState === "FAILED"
                  ? "Failed"
                  : "Idle"}
          </State>
          <span className="pp-durability__spacer" />
          <button
            className="pp-ctl"
            disabled={vm.preflightBusy || !!pending}
            onClick={() => void vm.rerun(true)}
          >
            <RefreshCw size={12} />
            Re-run preflight
          </button>
          <button
            className="pp-ctl"
            disabled={!!pending || !!session.reason("provider.test", "HOST")}
            onClick={() => void act("provider.test")}
          >
            Test Drive
          </button>
        </header>
        {recovery && (
          <div
            className="pp-gate-band"
            role="alert"
            data-testid="recovery-band"
          >
            <div className="pp-gate-band__text">
              <strong>RECOVERY GATE ACTIVE</strong>
              {p?.recoveryJob && (
                <span>
                  Job {p.recoveryJob.jobId.slice(0, 8)} · Stage{" "}
                  {p.recoveryJob.stageIndex} / {stages.length} ·{" "}
                  {p.recoveryJob.stage} · {p.recoveryJob.errorCode}
                </span>
              )}
              <span className="pp-gate-band__sub">
                {vm.hostName} is currently{" "}
                {vm.hostOnline ? "online" : "offline"}.{" "}
                {p?.restoreRecoveryRequired
                  ? "A restore was interrupted. Review the world before clearing."
                  : "The Host verifies service and Minecraft readiness before clearing."}
              </span>
            </div>
            <button
              className="pp-ctl"
              data-primary="true"
              data-tone="amber"
              disabled={
                !!pending ||
                !vm.hostOnline ||
                !!session.reason("maintenance.recovery.resolve", "HOST")
              }
              onClick={() =>
                p?.restoreRecoveryRequired ? setRestoreReview(true) : clear()
              }
            >
              <Check size={14} />
              Verify Running &amp; Clear Recovery Gate
            </button>
          </div>
        )}
        <ol
          className="pp-pipeline pp-backup-rail"
          data-testid="backup-rail"
          aria-label="Backup stages"
        >
          {stages.map((s) => (
            <li
              key={s.index}
              data-state={s.state}
              data-done={s.state === "done"}
              data-current={s.state === "current"}
              data-near="true"
              aria-current={s.state === "current" ? "step" : undefined}
              title={`${s.label} · ${s.state}`}
            >
              <span
                className="pp-pipeline__stage"
                role="img"
                aria-label={`Stage ${s.index}: ${s.label}, ${s.state}`}
              >
                {s.state === "done" ? <Check size={11} /> : s.index}
              </span>
            </li>
          ))}
        </ol>
        <div className="pp-rail__caption">
          <span>
            {vm.stageIndex
              ? `Stage ${Math.min(vm.stageIndex, stages.length)} / ${stages.length} · ${stages[Math.min(vm.stageIndex - 1, stages.length - 1)]?.label}`
              : "No job running"}
          </span>
          {typeof vm.progress.bytesPerSecond === "number" && (
            <span>
              {(vm.progress.bytesPerSecond / 1024 ** 2).toFixed(1)} MB/s
            </span>
          )}
          {vm.remainingSeconds !== null && (
            <span>{formatMmSs(vm.remainingSeconds)} remaining</span>
          )}
          {vm.jobId && <code>{vm.jobId}</code>}
        </div>
        <PreflightRibbon
          p={p}
          gateCode={recovery ? "RECOVERY_REQUIRED" : gate.code}
          busy={vm.preflightBusy}
        />
        {(vm.preflightError || vm.statusError) && (
          <div className="pp-durability__notice" role="status">
            {vm.preflightError || vm.statusError}
          </div>
        )}
      </section>
      {error && (
        <div className="pp-durability__notice" role="alert">
          {error}
        </div>
      )}
      <section
        className="pp-deck pp-deck--exec"
        aria-label="Backup execution and schedule"
      >
        <div className="pp-deck__cell">
          <h2 className="pp-kicker">Manual cold restore point</h2>
          <div className="pp-deck__controls">
            <div className="pp-field">
              <span>Warning countdown</span>
              <PpSelect
                ariaLabel="Player warning countdown"
                value={String(sync.backupCountdownMinutes)}
                onChange={(v) =>
                  sync.set(
                    "backupCountdownMinutes",
                    Number(v) as 5 | 10 | 15 | 30,
                  )
                }
                options={[5, 10, 15, 30].map((n) => ({
                  value: String(n),
                  label: `${n} min warning`,
                }))}
              />
            </div>
            <div className="pp-field">
              <span>Destination</span>
              <div
                className="pp-seg"
                role="radiogroup"
                aria-label="Destination"
              >
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    role="radio"
                    aria-checked={mode === m.value}
                    data-mode={m.value}
                    tabIndex={mode === m.value ? 0 : -1}
                    onKeyDown={(event) => {
                      if (
                        ![
                          "ArrowLeft",
                          "ArrowRight",
                          "ArrowUp",
                          "ArrowDown",
                          "Home",
                          "End",
                        ].includes(event.key)
                      )
                        return;
                      event.preventDefault();
                      const options = MODES.filter(
                          (option) => !legacy || option.value === "AUTO",
                        ),
                        index = options.findIndex(
                          (option) => option.value === mode,
                        );
                      const next =
                        event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? options.length - 1
                            : (index +
                                (["ArrowLeft", "ArrowUp"].includes(event.key)
                                  ? -1
                                  : 1) +
                                options.length) %
                              options.length;
                      setMode(options[next].value);
                      event.currentTarget.parentElement
                        ?.querySelector<HTMLButtonElement>(
                          `[data-mode="${options[next].value}"]`,
                        )
                        ?.focus();
                    }}
                    disabled={legacy && m.value !== "AUTO"}
                    onClick={() => setMode(m.value)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="pp-deck__actions">
            <button
              className="pp-ctl"
              data-primary="true"
              disabled={blocked}
              aria-describedby="pp-create-gate-desc"
              onClick={() =>
                void act("backup.create", {
                  countdownSeconds: sync.backupCountdownMinutes * 60,
                  ...(!legacy ? { destinationMode: mode } : {}),
                })
              }
            >
              <ArchiveRestore size={14} />
              Create full backup
            </button>
            {!recovery &&
              gate.blocked &&
              gate.resolution === "SWITCH_TO_LOCAL" && (
                <button
                  className="pp-ctl"
                  onClick={() => setMode("LOCAL_ONLY")}
                >
                  Use Local VPS only
                </button>
              )}
            {!recovery &&
              gate.blocked &&
              gate.resolution === "RERUN_PREFLIGHT" && (
                <button
                  className="pp-ctl"
                  disabled={vm.preflightBusy}
                  onClick={() => void vm.rerun(true)}
                >
                  Check readiness
                </button>
              )}
            <span id="pp-create-gate-desc" className="sr-only">
              {reason
                ? `${recovery ? "RECOVERY_REQUIRED" : (gate.code ?? "AUTHORITY")}: ${reason}`
                : "Ready"}
            </span>
          </div>
        </div>
        <div className="pp-deck__cell">
          <h2 className="pp-kicker">
            Periodic schedule ·{" "}
            {String(vm.settings.timezone ?? "Host timezone")}
          </h2>
          <div className="pp-deck__controls">
            <State ok={vm.schedule.enabled === true}>
              {vm.schedule.enabled ? "Enabled" : "Disabled"}
            </State>
            <span className="mono">
              {vm.schedule.type === "INTERVAL_HOURS"
                ? `Every ${vm.schedule.intervalHours}h`
                : `${String(vm.schedule.type ?? "Daily").replaceAll("_", " ")} at ${String(vm.schedule.time ?? "04:00")}`}{" "}
              · Keep {String(vm.full.retentionCount ?? 7)}
            </span>
            <small className="muted">
              Next backup:{" "}
              {vm.statusData.nextFullRestorePoint
                ? time(
                    String(vm.statusData.nextFullRestorePoint),
                    prefs.timezone,
                  )
                : "not reported"}{" "}
              · Restart:{" "}
              {vm.statusData.nextRestart
                ? time(String(vm.statusData.nextRestart), prefs.timezone)
                : "not reported"}
            </small>
          </div>
          <div className="pp-deck__actions">
            <button
              className="pp-ctl"
              disabled={
                vm.config.loading ||
                !!session.reason("maintenance.settings.update", "HOST")
              }
              onClick={() => setScheduleOpen(true)}
            >
              Configure schedule
            </button>
          </div>
        </div>
      </section>
      <section className="pp-pane" aria-labelledby="pp-rp-title">
        <header className="pp-durability__head">
          <h2 id="pp-rp-title">
            Restore points{" "}
            <span className="muted">· {vm.restorePoints.length} archives</span>
          </h2>
          <span className="pp-durability__spacer" />
          <div className="pp-seg" role="group" aria-label="Archive location">
            {["ALL", "DRIVE", "LOCAL"].map((f) => (
              <button
                key={f}
                aria-pressed={filter === f}
                onClick={() => setFilter(f as typeof filter)}
              >
                {f[0] + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </header>
        <QueryState query={vm.history} />
        <div data-testid="restore-ledger">
          <Table label="Restore point ledger">
            <thead>
              <tr>
                {[
                  "Created",
                  "Trigger",
                  "Size",
                  "Location & integrity",
                  "SHA-256",
                  "Actions",
                ].map((k) => (
                  <th key={k}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const kind = classifyArchive(r);
                return (
                  <tr key={r.id}>
                    <td>
                      <time dateTime={r.createdAt}>
                        {date(r.createdAt, prefs.timezone)}
                        <small className="muted">
                          {" "}
                          · {time(r.createdAt, prefs.timezone)}
                        </small>
                      </time>
                    </td>
                    <td>{r.trigger}</td>
                    <td className="mono">{gib(r.sizeBytes)}</td>
                    <td>
                      <State ok={kind !== "UNVERIFIED"}>
                        {kind === "DRIVE_AND_LOCAL"
                          ? "Drive + Local (Verified)"
                          : kind === "LOCAL_ONLY"
                            ? "Local VPS (Verified)"
                            : kind === "DRIVE_ONLY"
                              ? "Drive (Verified)"
                              : "Unverified"}
                      </State>
                    </td>
                    <td>
                      <div className="row">
                        <code>
                          {r.sha256
                            ? `${r.sha256.slice(0, 4)}…${r.sha256.slice(-4)}`
                            : "—"}
                        </code>
                        {r.sha256 && (
                          <button
                            className="pp-ctl"
                            aria-label={`Copy SHA-256 for ${r.id}`}
                            onClick={() =>
                              void navigator.clipboard
                                .writeText(r.sha256!)
                                .then(() => setCopied(r.id))
                                .catch(() =>
                                  setError(
                                    "Clipboard is unavailable. Try a secure browser context.",
                                  ),
                                )
                            }
                          >
                            <Copy size={12} />
                          </button>
                        )}
                        {copied === r.id && (
                          <span className="sr-only" role="status">
                            SHA-256 copied
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="pp-table__actions">
                        <MutationButton
                          action="backup.full.verify"
                          label="Verify"
                          args={{ backupId: r.id }}
                        />
                        {kind === "LOCAL_ONLY" && (
                          <button
                            className="pp-ctl"
                            disabled={
                              p?.providerState !== "CONNECTED" ||
                              !!pending ||
                              busy ||
                              !!session.reason(
                                "backup.full.retry-upload",
                                "HOST",
                              )
                            }
                            onClick={() =>
                              void act("backup.full.retry-upload", {
                                backupId: r.id,
                              })
                            }
                          >
                            <UploadCloud size={12} />
                            Promote to Drive
                          </button>
                        )}
                        <MutationButton
                          action="backup.full.restore"
                          label="Restore"
                          tone="rose"
                          args={{ backupId: r.id, startAfter: true }}
                        />
                        <MutationButton
                          action="backup.full.delete"
                          label="Delete"
                          tone="rose"
                          args={{ backupId: r.id }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!vm.history.loading && !rows.length && (
                <tr>
                  <td colSpan={6} className="pp-empty">
                    No restore points returned
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      </section>
      {scheduleOpen && (
        <ScheduleDialog
          vm={vm}
          onClose={() => setScheduleOpen(false)}
          review={review}
        />
      )}
      <Dialog.Root open={restoreReview} onOpenChange={setRestoreReview}>
        <Dialog.Portal>
          <Dialog.Overlay className="pp-overlay" />
          <Dialog.Content className="pp-glass pp-modal">
            <header>
              <Dialog.Title>Review interrupted restore</Dialog.Title>
            </header>
            <div className="pp-modal-body">
              <Dialog.Description>
                A restore was interrupted. Confirm you reviewed the world.
                Clearing this gate acknowledges its current state and preserves
                the recovery journal for audit.
              </Dialog.Description>
            </div>
            <footer>
              <Dialog.Close className="pp-ctl">Cancel</Dialog.Close>
              <button className="pp-ctl" data-tone="amber" onClick={clear}>
                I reviewed the world · Clear recovery
              </button>
            </footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
function ScheduleDialog({
  vm,
  onClose,
  review,
}: {
  vm: Vm;
  onClose: () => void;
  review: ReturnType<typeof useReview>;
}) {
  const schedule = vm.schedule,
    [enabled, setEnabled] = useState(schedule.enabled === true),
    [cadence, setCadence] = useState(String(schedule.type ?? "DAILY")),
    [days, setDays] = useState<string[]>(
      Array.isArray(schedule.weekdays)
        ? schedule.weekdays.map(String)
        : ["MONDAY"],
    ),
    [at, setAt] = useState(String(schedule.time ?? "04:00")),
    [hours, setHours] = useState(Number(schedule.intervalHours ?? 24)),
    [keep, setKeep] = useState(Number(vm.full.retentionCount ?? 7)),
    [fallback, setFallback] = useState(vm.full.allowLocalFallback === true),
    legacy = vm.preflight?.legacyHost ?? true,
    weekly = ["WEEKLY", "SELECTED_DAYS", "SELECTED_WEEKDAYS"].includes(cadence),
    patch = {
      ...vm.settings,
      schemaVersion: 2,
      fullRestorePoint: {
        ...vm.full,
        retentionMode: "ROTATING",
        retentionCount: keep,
        ...(!legacy ? { allowLocalFallback: fallback } : {}),
        schedule: {
          ...schedule,
          enabled,
          type: cadence,
          time: at,
          weekdays: days,
          intervalHours: hours,
        },
      },
    },
    validation = validateMaintenance(patch);
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="pp-overlay" />
        <Dialog.Content className="pp-glass pp-modal pp-schedule-dialog">
          <header>
            <Dialog.Title>Configure schedule</Dialog.Title>
            <Dialog.Close className="pp-ctl push" aria-label="Close schedule">
              <X size={13} />
            </Dialog.Close>
          </header>
          <div className="pp-modal-body">
            <Dialog.Description>
              Use the Host timezone and retain the current safety and exclusion
              settings.
            </Dialog.Description>
            <div className="pp-form">
              <div className="pp-field">
                <span>Status</span>
                <div
                  className="pp-seg"
                  role="group"
                  aria-label="Schedule status"
                >
                  {[true, false].map((value) => (
                    <button
                      key={String(value)}
                      aria-pressed={enabled === value}
                      onClick={() => setEnabled(value)}
                    >
                      {value ? "Enabled" : "Disabled"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pp-field">
                <span>Cadence</span>
                <PpSelect
                  ariaLabel="Cadence"
                  value={cadence}
                  onChange={setCadence}
                  options={[
                    ...new Set([
                      "INTERVAL_HOURS",
                      "DAILY",
                      "WEEKLY",
                      "SELECTED_DAYS",
                      cadence,
                    ]),
                  ].map((value) => ({
                    value,
                    label: value.replaceAll("_", " "),
                  }))}
                />
              </div>
              {weekly && (
                <div className="pp-field">
                  <span>Days</span>
                  <div className="pp-wk" role="group" aria-label="Weekdays">
                    {DAYS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        className="pp-wk__pill"
                        aria-pressed={days.includes(d)}
                        onClick={() =>
                          setDays((previous) =>
                            previous.includes(d)
                              ? previous.filter((x) => x !== d)
                              : [...previous, d],
                          )
                        }
                      >
                        {d.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {cadence === "INTERVAL_HOURS" ? (
                <div className="pp-field">
                  <span>Interval</span>
                  <PpSelect
                    ariaLabel="Interval hours"
                    value={String(hours)}
                    onChange={(v) => setHours(Number(v))}
                    options={[
                      ...new Set([
                        1,
                        2,
                        3,
                        4,
                        6,
                        8,
                        12,
                        24,
                        48,
                        72,
                        168,
                        hours,
                      ]),
                    ]
                      .sort((a, b) => a - b)
                      .map((n) => ({
                        value: String(n),
                        label: `Every ${n} hours`,
                      }))}
                  />
                </div>
              ) : (
                <div className="pp-field">
                  <span>Time · {String(vm.settings.timezone ?? "Host")}</span>
                  <PpSelect
                    ariaLabel="Schedule time"
                    value={at}
                    onChange={setAt}
                    options={timeOptions(String(schedule.time ?? "04:00")).map(
                      (value) => ({ value, label: value }),
                    )}
                  />
                </div>
              )}
              <div className="pp-field">
                <span>Keep</span>
                <PpSelect
                  ariaLabel="Retention"
                  value={String(keep)}
                  onChange={(v) => setKeep(Number(v))}
                  options={retentionOptions(
                    Number(vm.full.retentionCount ?? 7),
                  ).map((n) => ({
                    value: String(n),
                    label: `${n} restore points`,
                  }))}
                />
              </div>
              <div className="pp-field">
                <span>If Drive is unreachable</span>
                <div
                  className="pp-seg"
                  role="group"
                  aria-label="Provider fallback"
                >
                  <button
                    aria-pressed={!fallback}
                    onClick={() => setFallback(false)}
                  >
                    Fail the run
                  </button>
                  <button
                    disabled={legacy}
                    aria-pressed={fallback}
                    onClick={() => setFallback(true)}
                  >
                    Keep a local backup
                  </button>
                </div>
                {legacy && (
                  <small className="muted">
                    Host update required for local backups
                  </small>
                )}
              </div>
            </div>
            {validation && (
              <div role="status" className="pp-durability__notice">
                {validation}
              </div>
            )}
          </div>
          <footer>
            <Dialog.Close className="pp-ctl">Cancel</Dialog.Close>
            <button
              className="pp-ctl"
              data-primary="true"
              disabled={!!validation || (weekly && !days.length)}
              onClick={() => {
                onClose();
                void review(
                  "maintenance.settings.update",
                  { settings: patch },
                  "HOST",
                );
              }}
            >
              Save schedule
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

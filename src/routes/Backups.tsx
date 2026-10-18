"use client";
import { useState } from "react";
import { CloudUpload, HardDrive, RefreshCw, ShieldCheck } from "lucide-react";
import { useNow, useSession } from "../hooks";
import { number, record, records, str } from "../adapter/control-state";
import { useQuery } from "../features/useQuery";
import { ActionButton, useOperation } from "../features/operations";
import { BackupScheduleCard } from "../components/BackupScheduleCard";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Field, Select } from "../components/ui/input";
import { Empty, Notice } from "../components/ui/empty";
import { valueLabel } from "../components/charts/TelemetryChart";
const phases = [
  "QUEUED",
  "PREFLIGHT",
  "COUNTDOWN",
  "FINAL_SAVE",
  "STOPPING_SERVER",
  "WAITING_FOR_STOP",
  "ARCHIVING",
  "HASHING",
  "VERIFYING_LOCAL",
  "UPLOADING_REMOTE",
  "VERIFYING_REMOTE",
  "CLEANING_LOCAL",
  "STARTING_SERVER",
  "VERIFYING_STARTUP",
  "COMPLETED",
];
export default function Backups() {
  const snap = useSession(),
    now = useNow(),
    op = useOperation(),
    [countdown, setCountdown] = useState(900),
    preflight = useQuery("backup.preflight"),
    status = useQuery("maintenance.status", "HOST", {}, 3000),
    inventory = useQuery("backup.full.list"),
    provider = useQuery("provider.status");
  const current = record(status.data.currentOperation),
    phase = str(current.phase, "UNKNOWN"),
    jobId = str(current.jobId, ""),
    progress =
      snap.state.backupProgress?.jobId === jobId && jobId
        ? snap.state.backupProgress
        : null;
  const ready =
    preflight.at > 0 &&
    now - preflight.at <= 30000 &&
    preflight.data.hostAuthenticated === true &&
    preflight.data.operationBusy === false &&
    preflight.data.recoveryRequired === false &&
    preflight.data.backupRootWritable === true &&
    preflight.data.commandChannelConfigured === true;
  const processed = number(progress?.bytesUploaded ?? progress?.bytes),
    total = number(progress?.totalBytes),
    rawPercent = number(current.progressPercent),
    ratio =
      processed !== null && total !== null && total > 0
        ? Math.max(0, Math.min(1, processed / total))
        : rawPercent !== null
          ? Math.max(0, Math.min(1, rawPercent / 100))
          : null;
  const backups = records(inventory.data.backups),
    refresh = () => {
      void preflight.refresh();
      void status.refresh();
      void inventory.refresh();
      void provider.refresh();
    };
  return (
    <div className="space-y-5">
      <PageHeader
        title="Backups"
        description="Verified cold backups. Local certainty, off-site resilience."
        action={
          <Button variant="outline" onClick={refresh}>
            <RefreshCw />
            Refresh evidence
          </Button>
        }
      />
      <Card
        className={
          phase === "RECOVERY_REQUIRED"
            ? "border-rose-500/40"
            : "border-primary/20"
        }
      >
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-primary/10 p-3 text-primary">
                <CloudUpload size={22} />
              </span>
              <div>
                <p className="text-[10px] text-muted-foreground">
                  HOST MAINTENANCE
                </p>
                <h2 className="mt-1 text-base font-semibold">
                  {phase === "IDLE"
                    ? "Ready for your next restore point"
                    : phase === "UNKNOWN"
                      ? "Awaiting durable job status"
                      : phase.replaceAll("_", " ")}
                </h2>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {jobId || status.error || "No durable operation ID reported"}
                </p>
              </div>
            </div>
            <Badge
              tone={
                phase === "DEGRADED" || phase === "RECOVERY_REQUIRED"
                  ? "warning"
                  : phase === "COMPLETED"
                    ? "success"
                    : "neutral"
              }
            >
              {phase}
            </Badge>
          </div>
          {ratio !== null && (
            <div className="mt-5">
              <div
                role="progressbar"
                aria-label="Current Host job progress"
                aria-valuenow={Math.round(ratio * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-1.5 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${ratio * 100}%` }}
                />
              </div>
              <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                {processed !== null
                  ? valueLabel(processed, "bytes")
                  : "Processed bytes not reported"}
                {total !== null ? ` / ${valueLabel(total, "bytes")}` : ""} ·{" "}
                {valueLabel(number(progress?.bytesPerSecond), "bytes")}/s
              </p>
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-1.5">
            {phases.map((p) => (
              <span
                key={p}
                className={`rounded border px-2 py-1 font-mono text-[8px] ${p === phase ? "border-primary/30 bg-primary/10 text-primary" : "text-muted-foreground"}`}
              >
                {p.replaceAll("_", " ")}
              </span>
            ))}
          </div>
          {typeof current.message === "string" && (
            <p className="mt-4 text-xs text-muted-foreground">
              {str(current.message)}
            </p>
          )}
          {current.retryable === true && (
            <div className="mt-4">
              <ActionButton
                action="backup.full.retry-upload"
                variant="outline"
                onClick={() =>
                  op.prepare("backup.full.retry-upload", {
                    backupId: str(current.backupId),
                  })
                }
              >
                Retry verified local upload
              </ActionButton>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Manual full backup"
            description="Save → stop → archive → verify → Drive → restart"
            icon={<HardDrive size={17} className="text-primary" />}
          />
          <CardContent className="space-y-5">
            <p className="text-xs leading-6 text-muted-foreground">
              The Host Companion controls the entire operation and restarts
              Minecraft after the cold archive, including when a Drive upload
              fails.
            </p>
            <div className="space-y-3 rounded-xl border bg-background p-4">
              {[
                ["Host authenticated", "hostAuthenticated", true],
                ["Operation clear", "operationBusy", false],
                ["Recovery clear", "recoveryRequired", false],
                ["Storage writable", "backupRootWritable", true],
                ["Command channel", "commandChannelConfigured", true],
              ].map(([label, key, wanted]) => (
                <div
                  key={String(key)}
                  className="flex justify-between gap-3 text-[11px]"
                >
                  <span className="text-muted-foreground">{label}</span>
                  <Badge
                    tone={
                      preflight.data[String(key)] === wanted
                        ? "success"
                        : typeof preflight.data[String(key)] === "boolean"
                          ? "danger"
                          : "neutral"
                    }
                  >
                    {preflight.data[String(key)] === wanted
                      ? "Ready"
                      : typeof preflight.data[String(key)] === "boolean"
                        ? "Blocked"
                        : "Unknown"}
                  </Badge>
                </div>
              ))}
              <div className="flex justify-between gap-3 text-[11px]">
                <span className="text-muted-foreground">Google Drive</span>
                <span>{str(provider.data.status, "Not reported")}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Disk headroom:{" "}
                {valueLabel(number(preflight.data.usableBytes), "bytes")}
              </p>
            </div>
            {preflight.error && <Notice>{preflight.error}</Notice>}
            <Field label="Player warning countdown">
              <Select
                value={countdown}
                onChange={(e) => setCountdown(Number(e.target.value))}
              >
                {[1800, 900, 600, 300, 0].map((v) => (
                  <option key={v} value={v}>
                    {v
                      ? `${v / 60} minutes`
                      : "Immediate · Host must prove zero players"}
                  </option>
                ))}
              </Select>
            </Field>
            <ActionButton
              action="maintenance.full-backup.create"
              blocked={
                !ready
                  ? "Refresh and pass current Host preflight before creating a backup."
                  : ""
              }
              onClick={() =>
                op.prepare("maintenance.full-backup.create", {
                  countdownSeconds: countdown,
                })
              }
            >
              <CloudUpload />
              Fully Backup Now
            </ActionButton>
          </CardContent>
        </Card>
        <BackupScheduleCard />
      </div>
      <Card>
        <CardHeader
          title="Restore points"
          description="Verification is reported separately from archive availability"
          icon={<ShieldCheck size={17} className="text-muted-foreground" />}
        />
        {inventory.error && (
          <div className="p-4">
            <Notice>{inventory.error}</Notice>
          </div>
        )}
        {backups.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-xs">
              <thead className="bg-background text-[9px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-4">Restore point</th>
                  <th className="p-4">Size</th>
                  <th className="p-4">Verification</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={str(b.backupId)} className="border-t">
                    <td className="max-w-72 p-4">
                      <p className="font-medium">{str(b.filename)}</p>
                      <p className="mt-2 font-mono text-[9px] text-muted-foreground">
                        {str(b.backupId)}
                      </p>
                      <p className="mt-1 break-all font-mono text-[8px] text-muted-foreground">
                        SHA-256 {str(b.sha256, "not reported")}
                      </p>
                    </td>
                    <td className="p-4 font-mono text-[10px]">
                      {valueLabel(number(b.archiveBytes), "bytes")}
                    </td>
                    <td className="p-4">
                      <Badge
                        tone={
                          b.remoteVerified === true ||
                          b.remoteBackupVerified === true
                            ? "success"
                            : "neutral"
                        }
                      >
                        {b.remoteVerified === true ||
                        b.remoteBackupVerified === true
                          ? "VERIFIED REMOTE"
                          : b.localVerified === true ||
                              b.localBackupVerified === true
                            ? "VERIFIED LOCAL"
                            : "Unverified"}
                      </Badge>
                      <p className="mt-2 text-[9px] text-muted-foreground">
                        {b.local === true
                          ? "Local available"
                          : "Local unreported"}{" "}
                        ·{" "}
                        {b.offsite === true
                          ? "Off-site available"
                          : "Off-site unreported"}
                      </p>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <ActionButton
                          action="backup.full.verify"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            op.prepare("backup.full.verify", {
                              backupId: str(b.backupId),
                            })
                          }
                        >
                          Verify
                        </ActionButton>
                        <ActionButton
                          action="backup.full.delete"
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            op.prepare("backup.full.delete", {
                              backupId: str(b.backupId),
                            })
                          }
                        >
                          Delete
                        </ActionButton>
                        {b.retryUploadAvailable === true && (
                          <ActionButton
                            action="backup.full.retry-upload"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              op.prepare("backup.full.retry-upload", {
                                backupId: str(b.backupId),
                              })
                            }
                          >
                            Retry upload
                          </ActionButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No restore points received">
            Read the Host inventory to inspect available archives.
          </Empty>
        )}
      </Card>
      {op.review}
    </div>
  );
}

"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useMaintenanceCountdown, formatMmSs } from "../bindings/maintenance";
import { deriveCreateGate } from "../bindings/backups-model";
import { record } from "../bindings";
import { Play, RotateCw, Square, ArchiveRestore, Search } from "lucide-react";
import {
  session,
  useActiveServer,
  useControl,
  useLedger,
  useServers,
  duration,
  type Phase,
} from "../bindings";
import { PpSelect } from "../primitives/Select";
import { Tooltip } from "../primitives/Tooltip";
import { MutationButton } from "../primitives/MutationButton";
export function AuthorityLedgerPill() {
  const l = useLedger(),
    snap = useControl();
  return (
    <Tooltip
      content={
        <>
          <div className="row spread">
            <b>Paper</b>
            <span>
              {l.paper.state} ·{" "}
              {l.paper.ageMs == null
                ? "unreported"
                : `${Math.round(l.paper.ageMs / 1000)}s`}
            </span>
          </div>
          <div className="row spread">
            <b>Host Companion</b>
            <span>
              {l.host.state} ·{" "}
              {l.host.ageMs == null
                ? "unreported"
                : `${Math.round(l.host.ageMs / 1000)}s`}
            </span>
          </div>
          <div
            style={{
              borderTop: "1px solid rgb(var(--line)/.12)",
              marginTop: 8,
              paddingTop: 8,
            }}
          >
            Relay {snap.phase === "live" ? "connected" : snap.phase} · Signed
            Protocol 3 · {snap.state.ready?.device.role ?? "Unknown"} access
          </div>
        </>
      }
    >
      <button
        className="pp-ctl pp-ledger"
        aria-label={`Paper ${l.paper.state}, Host ${l.host.state}`}
      >
        {(["paper", "host"] as const).map((k) => (
          <span
            key={k}
            data-tone={
              l[k].state === "live"
                ? "emerald"
                : l[k].state === "offline"
                  ? "rose"
                  : "amber"
            }
          >
            <i className="pp-dot" />
            <span className="pp-ledger__text">
              {k === "paper" ? "Paper" : "Host"}{" "}
              <b>{l[k].state === "live" ? "Live" : l[k].state}</b>
            </span>
          </span>
        ))}
      </button>
    </Tooltip>
  );
}
export function PowerAndBackupGroup({ phase }: { phase: Phase }) {
  const d = useMaintenanceCountdown(),
    router = useRouter(),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const full = record(record(d.config.data.settings).fullRestorePoint),
    gate = deriveCreateGate({
      jobBusy: d.jobBusy,
      preflight: d.preflight,
      mode: "AUTO",
      allowLocalFallback: full.allowLocalFallback === true,
    }),
    reason =
      d.recoveryRequired || d.preflight?.recoveryRequired
        ? "Host recovery gate is active — resolve on Backups page."
        : session.reason("backup.create", "HOST") ||
          (d.preflightBusy
            ? "Waiting for current Host preflight."
            : gate.blocked
              ? `${gate.code}: ${gate.title}${gate.resolution === "SWITCH_TO_LOCAL" ? " Open Backups to use Local VPS only." : ""}`
              : "");
  const quick = (
    <button
      className="pp-ctl pp-quick"
      aria-label="Quick Backup"
      aria-disabled={!!reason || pending || undefined}
      onClick={() => {
        if (reason) {
          router.push("/backups");
          return;
        }
        if (pending) return;
        setPending(true);
        setError("");
        void d
          .invoke("backup.create", {
            countdownSeconds: 300,
            destinationMode: "AUTO",
          })
          .then(() => d.refresh())
          .catch((e) => setError((e as Error).message))
          .finally(() => setPending(false));
      }}
    >
      <ArchiveRestore size={14} aria-hidden />
      <span>Quick Backup</span>
    </button>
  );
  return (
    <div className="pp-power-group">
      <div className="pp-power" role="group" aria-label="Server power">
        <MutationButton
          action="server.start"
          label="Start"
          icon={Play}
          tone="emerald"
          foreground={phase === "offline"}
        />
        <MutationButton
          action="maintenance.restart.now"
          extraReason={
            ["starting", "stopping", "unknown"].includes(phase)
              ? "Wait for a confirmed service phase before restarting."
              : ""
          }
          label="Restart"
          icon={RotateCw}
          tone="amber"
          foreground={phase === "online"}
        />
        <MutationButton
          action="server.stop"
          label="Stop"
          icon={Square}
          tone="rose"
          foreground={phase === "online"}
        />
      </div>
      {reason ? <Tooltip content={reason}>{quick}</Tooltip> : quick}
      {error &&
        createPortal(
          <div role="alert" className="pp-glass pp-toast">
            {error}
            <button
              className="pp-ctl"
              aria-label="Dismiss backup error"
              onClick={() => setError("")}
            >
              ×
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
export function MissionControlHeader({ onPalette }: { onPalette: () => void }) {
  const s = useActiveServer(),
    servers = useServers(),
    countdown = useMaintenanceCountdown();
  return (
    <header className="pp-ribbon-bar" role="banner">
      <PpSelect
        className="pp-server-switch"
        ariaLabel="Active server"
        value={s.id}
        onChange={(v) => void session.select(v)}
        options={servers.map((r) => ({
          value: r.id,
          label: r.name,
          leading: (
            <i
              className="pp-dot"
              data-tone={
                r.phase === "online"
                  ? "emerald"
                  : r.phase === "offline"
                    ? "rose"
                    : "amber"
              }
            />
          ),
        }))}
      />
      <div
        className="pp-ribbon-bar__meta"
        data-tone={
          s.phase === "online"
            ? "emerald"
            : s.phase === "offline"
              ? "rose"
              : "amber"
        }
      >
        <i className="pp-ring" data-phase={s.phase} />
        <span className="phase">{s.phase}</span>
        <span className="detail">
          {s.version} · Up {duration(s.uptimeMs)} · epoch{" "}
          <code>{s.epochId.slice(0, 8) || "—"}</code>
        </span>
      </div>
      <AuthorityLedgerPill />
      <button
        className="pp-ctl pp-palette-trigger"
        aria-label="Open command palette"
        onClick={onPalette}
      >
        <Search size={14} />
        <kbd className="pp-kbd">⌘K</kbd>
      </button>
      {countdown.countdownState === "ACTIVE" &&
        countdown.remainingSeconds !== null && (
          <span
            className="pp-countdown-pill"
            role="timer"
            aria-live="off"
            data-testid="countdown-pill"
            data-kind={countdown.countdownKind ?? undefined}
            aria-label={`${countdown.countdownKind === "RESTART" ? "Restart" : countdown.countdownKind === "STOP" ? "Stop" : "Backup"} in ${formatMmSs(countdown.remainingSeconds)}`}
          >
            <span aria-hidden="true">⟳</span>
            <span className="pp-countdown-pill__label">
              {countdown.countdownKind === "RESTART"
                ? "Restart"
                : countdown.countdownKind === "STOP"
                  ? "Stop"
                  : "Backup"}{" "}
              in
            </span>
            <span className="pp-countdown-pill__time">
              {formatMmSs(countdown.remainingSeconds)}
            </span>
          </span>
        )}
      <PowerAndBackupGroup phase={s.phase} />
    </header>
  );
}

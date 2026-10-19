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
      <MutationButton
        action="backup.create"
        label="Quick Backup"
        icon={ArchiveRestore}
        args={{ countdownSeconds: 300 }}
        className="pp-quick"
      />
    </div>
  );
}
export function MissionControlHeader({ onPalette }: { onPalette: () => void }) {
  const s = useActiveServer(),
    servers = useServers();
  return (
    <header className="pp-ribbon-bar" role="banner">
      <select
        className="pp-server-switch"
        aria-label="Active server"
        value={s.id}
        onChange={(e) => void session.select(e.target.value)}
      >
        {servers.map((r) => (
          <option value={r.id} key={r.id}>
            {r.name}
          </option>
        ))}
      </select>
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
      <PowerAndBackupGroup phase={s.phase} />
    </header>
  );
}

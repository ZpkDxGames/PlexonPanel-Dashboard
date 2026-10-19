import {
  Box,
  Layers,
  Clock,
  Play,
  RotateCw,
  Square,
  ArchiveRestore,
} from "lucide-react";
import { useControl, useSource, duration } from "../hooks/useControl";
import { Pill } from "../primitives/Pill";
import { StatusRing } from "../primitives/StatusRing";
import { FreshnessChip } from "../primitives/FreshnessChip";
import { IconBadge } from "../primitives/IconBadge";
import { MutationButton } from "../review/ActionReviewModal";
import { serverState } from "./server-view";
export function ServerHero() {
  const { state: s } = useControl(),
    paper = useSource("paperHealth"),
    host = useSource("service"),
    status = serverState(s, paper.usable, host.usable),
    band =
      paper.kind === "live"
        ? "live"
        : paper.kind === "delayed"
          ? "delayed"
          : "stale";
  return (
    <section
      className="pp-card server-hero"
      data-tone={status === "online" ? "emerald" : "slate"}
    >
      <div className="flex items-center gap-4 min-w-0">
        <IconBadge icon={Box} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1>{s.ready?.server.serverName ?? "Server workspace"}</h1>
            <Pill tone={status === "online" ? "emerald" : "amber"}>
              <StatusRing state={status} />
              {status}
            </Pill>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <Pill tone="sky">
              <Layers size={12} />
              Paper {s.ready?.server.minecraftVersion ?? "unreported"}
            </Pill>
            <Pill tone="slate">
              <Clock size={12} />
              Up{" "}
              {duration(
                s.system.processUptimeMillis ?? s.server.uptimeMillis,
              )}{" "}
              · epoch{" "}
              {String(
                s.service.invocationId ??
                  s.ready?.server.paperSession ??
                  "unknown",
              ).slice(0, 9)}
            </Pill>
            <FreshnessChip band={band} />
          </div>
        </div>
      </div>
      <div className="hero-actions">
        <MutationButton
          action="server.start"
          label="Start"
          tone="emerald"
          icon={Play}
        />
        <MutationButton
          action="maintenance.restart.now"
          label="Restart"
          icon={RotateCw}
          tone="amber"
        />
        <MutationButton
          action="server.stop"
          label="Stop"
          tone="rose"
          icon={Square}
        />
        <MutationButton
          action="backup.create"
          label="Quick Backup"
          icon={ArchiveRestore}
          solid
          parameters={{ countdownSeconds: 300 }}
        />
      </div>
    </section>
  );
}

import type { Tone } from "../types";
import {
  Activity,
  Users,
  TrendingUp,
  Cpu,
  MemoryStick,
  type LucideIcon,
} from "lucide-react";
import { InstrumentCard } from "./InstrumentCard";
import { Pill } from "../primitives/Pill";
import { EqualizerBars } from "../primitives/EqualizerBars";
import { AvatarStack } from "../primitives/AvatarStack";
import { DualGauge } from "../primitives/DualGauge";
import { SegmentedMemoryBar } from "../primitives/SegmentedMemoryBar";
import { SourceChip } from "../primitives/SourceChip";
import { FreshnessChip } from "../primitives/FreshnessChip";
import { Skeleton } from "../primitives/Skeleton";
import {
  useTelemetry,
  usePlayers,
  useCompute,
  useMemoryTiers,
  fmt1,
} from "../hooks/useControl";
export function OnlinePlayersCard() {
  const p = usePlayers(); // current Paper roster + boot-session peak
  const pct = p.capacity ? ((p.count ?? 0) / p.capacity) * 100 : 0;
  return (
    <InstrumentCard
      tone={pct >= 90 ? "amber" : "emerald"}
      icon={Users}
      label="Online Players"
      source="Paper"
      band={p.band}
      value={p.count ?? "—"}
      unit={p.capacity ? `/ ${p.capacity}` : "players"}
      pill={
        <Pill tone="sky" size="sm">
          <TrendingUp className="size-3" />
          peak {p.sessionPeak}
        </Pill>
      }
      viz={
        <div className="space-y-2.5">
          <AvatarStack players={p.online} />
          <div className="pp-well relative h-1.5 rounded-full">
            <i
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[rgb(var(--tone)/.55)] to-[rgb(var(--tone))] transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      }
      meta="Live Paper roster · this boot session"
    />
  );
}

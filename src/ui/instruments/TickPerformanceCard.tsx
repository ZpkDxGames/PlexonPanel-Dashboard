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
export function TickPerformanceCard() {
  const t = useTelemetry(); // thin hook over presentation/telemetry.ts
  const tps = t.tps.latest; // number | null
  const tone: Tone =
    tps == null
      ? "slate"
      : tps >= 19.5
        ? "emerald"
        : tps >= 17
          ? "amber"
          : "rose";
  return (
    <InstrumentCard
      tone={tone}
      icon={Activity}
      label="Tick Performance"
      source="Paper"
      band={t.tps.band}
      value={tps == null ? "—" : tps.toFixed(2)}
      unit="TPS"
      pill={
        t.msptP95.latest != null && (
          <Pill tone="violet" size="sm">
            p95 {t.msptP95.latest.toFixed(1)} ms
          </Pill>
        )
      }
      viz={
        <div className="space-y-2">
          <EqualizerBars samples={t.mspt.recent} ceil={60} />
          {/* TPS target bar: 20.0 TPS is the ceiling */}
          <div className="flex items-center gap-2 text-[11px] text-[rgb(var(--text-3))]">
            <div className="pp-well relative h-1.5 flex-1 rounded-full">
              <i
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[rgb(var(--tone)/.6)] to-[rgb(var(--tone))]"
                style={{ width: `${Math.min(100, ((tps ?? 0) / 20) * 100)}%` }}
              />
            </div>
            <span className="num">target 20.0</span>
          </div>
        </div>
      }
      meta={`${fmt1(t.mspt.mean)} ms mean · 50 ms budget`}
    />
  );
}

import { AnimatedNumber } from "../primitives/AnimatedNumber";
import type { Tone } from "../types";
import {
  Activity,
  Users,
  TrendingUp,
  Cpu,
  MemoryStick,
  type LucideIcon,
} from "lucide-react";
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
export function InstrumentCard({
  tone,
  icon: Icon,
  label,
  value,
  unit,
  pill,
  viz,
  meta,
  source,
  band = "live",
  loading,
}: {
  tone: Tone;
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  unit?: string;
  pill?: React.ReactNode;
  viz: React.ReactNode;
  meta?: React.ReactNode;
  source: "Paper" | "Host";
  band?: "live" | "delayed" | "stale";
  loading?: boolean;
}) {
  return (
    <section
      data-tone={band === "stale" ? "rose" : tone}
      aria-label={label}
      className="pp-card group flex min-h-[176px] flex-col gap-3 data-[stale=true]:opacity-70"
      data-stale={band === "stale"}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-medium text-[rgb(var(--text-2))]">
            {label}
          </p>
          <div className="mt-2 flex items-baseline gap-1.5">
            {loading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <span className="num text-[34px] font-semibold leading-9 tracking-tight text-[rgb(var(--text))]">
                {typeof value === "number" || typeof value === "string" ? (
                  <AnimatedNumber value={value} />
                ) : (
                  value
                )}
              </span>
            )}
            {unit && (
              <span className="text-[13px] font-medium text-[rgb(var(--text-3))]">
                {unit}
              </span>
            )}
            {pill && <span className="ml-1 self-center">{pill}</span>}
          </div>
        </div>
        <div className="pp-icon-badge shrink-0" data-tone={tone}>
          <Icon className="size-[18px]" strokeWidth={1.75} />
        </div>
      </header>

      {/* mandatory embedded visualization footer, always an L3 well or a bare viz on a hairline */}
      <div data-slot="viz" className="mt-auto">
        {viz}
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-[rgb(var(--line)/0.06)] pt-2 text-[11px] text-[rgb(var(--text-3))]">
        <span className="truncate">{meta}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          <SourceChip source={source} />
          <FreshnessChip band={band} />
        </span>
      </footer>
    </section>
  );
}

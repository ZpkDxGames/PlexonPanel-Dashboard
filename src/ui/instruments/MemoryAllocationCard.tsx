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
export function MemoryAllocationCard() {
  const m = useMemoryTiers(); // bytes: heapUsed, heapCommitted, cgroup|null, heapMax
  const usedPct =
    m.heapUsed != null && m.heapMax ? (m.heapUsed / m.heapMax) * 100 : 0;
  return (
    <InstrumentCard
      tone={usedPct > 90 ? "rose" : usedPct > 75 ? "amber" : "violet"}
      icon={MemoryStick}
      label="Memory Allocation"
      source="Paper"
      band={m.band}
      value={m.heapUsed == null ? "—" : (m.heapUsed / 2 ** 30).toFixed(1)}
      unit="GiB"
      pill={
        <Pill tone="violet" size="sm">
          {usedPct.toFixed(0)}% heap
        </Pill>
      }
      viz={
        m.heapUsed != null && m.heapCommitted != null && m.heapMax ? (
          <SegmentedMemoryBar
            used={m.heapUsed}
            committed={m.heapCommitted}
            cgroup={m.cgroup}
            max={m.heapMax}
          />
        ) : (
          <div className="pp-well p-3">Memory capture unavailable</div>
        )
      }
      meta={`JVM heap · Host cgroup ${m.cgroupBand}`}
    />
  );
}

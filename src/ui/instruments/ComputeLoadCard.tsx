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
export function ComputeLoadCard() {
  const c = useCompute(); // service: % of one core (may be >100). node: % of VPS or null
  return (
    <InstrumentCard
      tone={(c.service ?? 0) > 100 ? "amber" : "indigo"}
      icon={Cpu}
      label="Compute Load"
      source="Host"
      band={c.band}
      value={fmt1(c.service)}
      unit="%"
      pill={
        (c.service ?? 0) > 100 ? (
          <Pill tone="amber" size="sm">
            burst · {((c.service ?? 0) / 100).toFixed(1)} cores
          </Pill>
        ) : (
          <Pill tone="indigo" size="sm">
            of 1 core
          </Pill>
        )
      }
      viz={
        <DualGauge service={c.service} node={c.node} nodeBand={c.nodeBand} />
      }
      meta={`Minecraft cgroup · node ${c.nodeBand}`}
    />
  );
}

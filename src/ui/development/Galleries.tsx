import { Box, Activity, Terminal } from "lucide-react";
import { usePreferences, preferences } from "../../store/preferences";
import { IconBadge } from "../primitives/IconBadge";
import { Pill } from "../primitives/Pill";
import { Sparkline } from "../primitives/Sparkline";
import { EqualizerBars } from "../primitives/EqualizerBars";
import { DualGauge } from "../primitives/DualGauge";
import { SegmentedMemoryBar } from "../primitives/SegmentedMemoryBar";
import { StatusRing } from "../primitives/StatusRing";
import { FreshnessChip } from "../primitives/FreshnessChip";
import { SourceChip } from "../primitives/SourceChip";
import { Skeleton } from "../primitives/Skeleton";
import { AvatarStack } from "../primitives/AvatarStack";
export function Gallery() {
  const p = usePreferences();
  return (
    <div className="pp-canvas min-h-dvh p-8">
      <h1>Surface & primitive proofs</h1>
      <div className="flex gap-3 my-6">
        <button
          className="btn"
          onClick={() =>
            preferences.update({
              theme: p.theme === "light" ? "dark" : "light",
            })
          }
        >
          Toggle theme
        </button>
        {["teal", "blue", "violet"].map((a) => (
          <button
            className="btn"
            key={a}
            onClick={() => preferences.update({ accent: a as typeof p.accent })}
          >
            {a}
          </button>
        ))}
      </div>
      <div className="pp-shell p-5">
        <h2>L1 · elevated shell</h2>
        <div className="grid md:grid-cols-3 gap-4 mt-4">
          {["emerald", "cyan", "violet"].map((tone) => (
            <section key={tone} className="pp-card" data-tone={tone}>
              <div className="card-header">
                <IconBadge icon={Box} tone={tone as "cyan"} />
                <h2>L2 · instrument card</h2>
              </div>
              <div className="pp-well p-4">
                <p>L3 · recessed well</p>
                <Sparkline values={[2, 3, 4, 3, 7, 5, 8]} />
              </div>
              <div className="pp-glass p-3 mt-4">
                <Pill tone={tone as "cyan"}>L4 · floating glass</Pill>
              </div>
            </section>
          ))}
        </div>
      </div>
      <div className="detail-grid">
        <section className="pp-card" data-tone="emerald">
          <h2>Equalizer + status</h2>
          <div className="my-5">
            <EqualizerBars samples={[5, 10, 20, 30, 40, 50, 60, 20, 10]} />
          </div>
          <div className="flex gap-3">
            <StatusRing state="online" />
            <FreshnessChip band="live" />
            <SourceChip source="Paper" />
          </div>
        </section>
        <section className="pp-card" data-tone="indigo">
          <h2>Multi-core burst</h2>
          <div className="my-5">
            <DualGauge service={146.2} node={27.6} />
          </div>
          <Skeleton className="h-12" />
        </section>
        <section className="pp-card" data-tone="violet">
          <h2>Memory layers</h2>
          <div className="my-5">
            <SegmentedMemoryBar
              used={3.2 * 2 ** 30}
              committed={6 * 2 ** 30}
              cgroup={4.1 * 2 ** 30}
              max={8 * 2 ** 30}
            />
          </div>
          <AvatarStack players={[]} />
        </section>
      </div>
    </div>
  );
}

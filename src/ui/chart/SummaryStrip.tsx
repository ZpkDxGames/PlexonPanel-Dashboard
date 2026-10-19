import type { Tone } from "../types";
import { cn } from "../cn";
import { SourceChip } from "../primitives/SourceChip";
import { Sparkline } from "../primitives/Sparkline";
type Metric = {
  key: string;
  label: string;
  value: string;
  unit: string;
  tone: Tone;
  spark: (number | null)[];
  source: "Paper" | "Host";
};

export function SummaryStrip({
  metrics,
  active,
  onToggle,
}: {
  metrics: Metric[];
  active: Set<string>;
  onToggle: (k: string) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Chart series"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5"
    >
      {metrics.map((m) => {
        const on = active.has(m.key);
        return (
          <button
            key={m.key}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(m.key)}
            data-tone={m.tone}
            className={cn(
              "group relative overflow-hidden rounded-xl border px-3 pb-2 pt-3 text-left transition",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--accent))]",
              on
                ? "border-[rgb(var(--tone)/.32)] bg-[linear-gradient(180deg,rgb(var(--tone)/.10),rgb(var(--tone)/.02))] shadow-[inset_0_1px_0_0_rgb(var(--specular)/.08)]"
                : "border-[rgb(var(--line)/.07)] bg-[rgb(var(--line)/.02)] opacity-60 hover:opacity-100",
            )}
          >
            {/* glowing top indicator bar */}
            <i
              className={cn(
                "absolute inset-x-3 top-0 h-[2px] rounded-b-full bg-[rgb(var(--tone))] transition",
                on
                  ? "opacity-100 shadow-[0_0_12px_2px_rgb(var(--tone)/.6)]"
                  : "opacity-25",
              )}
            />
            <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.12em] text-[rgb(var(--text-3))]">
              {m.label}
              <SourceChip source={m.source} />
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="num text-[20px] font-semibold leading-6 text-[rgb(var(--text))]">
                {m.value}
              </span>
              <span className="text-[11px] text-[rgb(var(--text-3))]">
                {m.unit}
              </span>
            </div>
            <div className="mt-1 h-5 opacity-90">
              <Sparkline values={m.spark} height={20} filled={false} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

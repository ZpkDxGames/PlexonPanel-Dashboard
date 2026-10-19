import { MemoryMini, GcMini } from "./MemoryMini";
import { useState } from "react";
import { Heading, Panel } from "../shared";
import { TelemetryStudio } from "../../chart/TelemetryStudio";
import { useControl, fmt1 } from "../../hooks/useControl";
import { Sparkline } from "../../primitives/Sparkline";
import { DualGauge } from "../../primitives/DualGauge";
export default function Performance() {
  const { state: s } = useControl(),
    [pin, setPin] = useState<string | undefined>(),
    epochs = [...new Set(s.history.map((s) => s.epoch ?? "current"))],
    buckets = Array.from({ length: 10 }, (_, i) => ({
      label: `${i * 10}–${i * 10 + 10}`,
      count: s.history.filter(
        (s) =>
          s.mspt != null &&
          s.mspt >= i * 10 &&
          (i === 9 || s.mspt < i * 10 + 10),
      ).length,
      tone: i < 4 ? "emerald" : i < 5 ? "amber" : "rose",
    })),
    max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <>
      <Heading
        id="R03 · Performance"
        title="Every millisecond matters."
        detail="Independent capture clocks, percentile bands and honest boot boundaries."
      />
      <div className="flex items-center gap-3 mb-4">
        <label htmlFor="pin-epoch" className="text-secondary">
          Pin to epoch
        </label>
        <select
          id="pin-epoch"
          value={pin ?? ""}
          onChange={(e) => setPin(e.target.value || undefined)}
        >
          <option value="">All observed epochs</option>
          {epochs.map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
      </div>
      <TelemetryStudio tall pinned={pin} />
      <div className="detail-grid">
        <Panel title="MSPT distribution" tone="emerald">
          <div className="pp-well flex items-end gap-2 p-3 h-44">
            {buckets.map((b) => (
              <div
                key={b.label}
                data-tone={b.tone}
                className="flex-1 h-full flex flex-col justify-end gap-2"
              >
                <span className="num text-xs text-center">{b.count}</span>
                <i
                  className="block rounded-t bg-[rgb(var(--tone))]"
                  style={{ height: `${(b.count / max) * 100}px` }}
                />
                <span className="num text-[11px] text-center text-muted">
                  {b.label}
                </span>
              </div>
            ))}
          </div>
          <p className="text-muted text-xs mt-3">
            Observed sample bins in ms; 90–100 includes overflow.
          </p>
        </Panel>
        <Panel title="GC pause timeline" tone="rose">
          <GcMini />
          <div className="pp-well p-3 mt-4 text-secondary text-xs">
            Counter deltas preserve resets; they do not imply pause event
            timestamps.
          </div>
        </Panel>
        <Panel title="Memory tiers" tone="violet">
          <MemoryMini />
          <p className="text-muted text-xs mt-3">
            Paper heap · Host cgroup · overlapping tiers
          </p>
        </Panel>
        <Panel title="CPU service vs node" tone="indigo">
          <Sparkline values={s.history.map((h) => h.serviceCpu ?? null)} />
          <div data-tone="cyan" className="mt-4">
            <Sparkline values={s.history.map((h) => h.hostCpu)} />
          </div>
        </Panel>
        <Panel title="Chunk & entity trend" tone="emerald">
          <Sparkline values={s.history.map((h) => h.chunks ?? null)} />
          <div data-tone="amber" className="mt-4">
            <Sparkline values={s.history.map((h) => h.entities ?? null)} />
          </div>
        </Panel>
        <Panel title="Epoch history" tone="amber">
          <ol className="timeline">
            {epochs.map((e) => (
              <li key={e}>
                <button className="tone-link" onClick={() => setPin(e)}>
                  {e.slice(0, 28)}
                </button>
                <div className="pp-well mt-2 h-2 rounded-full">
                  <i
                    className="block h-full rounded-full bg-[rgb(var(--tone))]"
                    style={{
                      width: `${(s.history.filter((h) => (h.epoch ?? "current") === e).length / Math.max(1, s.history.length)) * 100}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ol>
          <p className="text-secondary text-xs mt-4">
            Tick-wait measurements are not reported by this producer.
          </p>
        </Panel>
      </div>
    </>
  );
}

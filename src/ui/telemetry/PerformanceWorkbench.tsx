import { useEffect } from "react";
import { Pause, Play, Download } from "lucide-react";
import { useViewSync, usePrefs, type Horizon } from "../bindings";
import { HorizonSelector, SignalGroups } from "../studio/TelemetryStudio";
import {
  GROUPS,
  SERIES,
  seriesKey,
  type Sample,
  type SeriesKey,
} from "./series";
import { Stage } from "./Stage";
import { Ribbon } from "./Ribbon";
import { TimeAxis } from "./TimeAxis";
import { ReadoutBar } from "./ReadoutBar";
import { crosshair } from "./crosshair";
function DeckCell({
  index,
  title,
  keys,
  samples,
  domainT,
  range,
}: {
  index: string;
  title: string;
  keys: SeriesKey[];
  samples: Sample[];
  domainT: [number, number];
  range: Horizon;
}) {
  return (
    <article className="pp-deck__cell" data-testid={`deck-${index}`}>
      <header className="pp-deck__head">
        <span>{index}</span>
        <h2>{title}</h2>
      </header>
      <div className="pp-deck__lanes">
        {keys.map((key) => (
          <Stage
            key={key}
            spec={SERIES[key]}
            samples={samples}
            domainT={domainT}
            minHeight={keys.length > 2 ? 60 : 80}
          />
        ))}
      </div>
      <footer className="pp-deck__edge" aria-hidden="true">
        <span>−{range}</span>
        <span>now</span>
      </footer>
    </article>
  );
}
export function PerformanceWorkbench({
  samples,
  domainT,
  paused,
  onTogglePause,
  onRawSamples,
  retained,
}: {
  samples: Sample[];
  domainT: [number, number];
  paused: boolean;
  onTogglePause: () => void;
  onRawSamples: () => void;
  retained: number;
}) {
  const sync = useViewSync(),
    prefs = usePrefs(),
    group = GROUPS.find((g) => g.id === sync.studioView)!,
    candidate = seriesKey(sync.activeSeries),
    selected = group.series.includes(candidate) ? candidate : group.series[0];
  useEffect(() => {
    crosshair.set(null);
    return () => crosshair.set(null);
  }, []);
  return (
    <section
      className="pp-pane pp-bench pp-analyzer"
      aria-label="Performance workbench"
    >
      <header className="pp-bench__bar">
        <h1>Analyzer</h1>
        <SignalGroups
          value={group.id}
          onChange={(v) =>
            sync.patch({
              studioView: v,
              activeSeries: GROUPS.find((g) => g.id === v)!.series[0],
            })
          }
        />
        <div className="row push">
          <HorizonSelector
            value={sync.horizon}
            onChange={(v) => sync.set("horizon", v)}
            extended
          />
          <button
            className="pp-ctl"
            aria-label={paused ? "Resume analyzer" : "Pause analyzer"}
            aria-pressed={paused}
            onClick={onTogglePause}
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
            <span>{paused ? "Resume" : "Pause"}</span>
          </button>
          <button
            className="pp-ctl"
            aria-label="Open raw samples"
            onClick={onRawSamples}
          >
            <Download size={13} />
            <span>Raw samples</span>
          </button>
        </div>
      </header>
      <ReadoutBar samples={samples} />
      <div className="pp-bench__primary">
        <Ribbon
          keys={group.series}
          selected={selected}
          onSelect={(key) => sync.set("activeSeries", key)}
          samples={samples}
        />
        <div className="pp-bench__primary-stage" key={selected}>
          <Stage
            spec={SERIES[selected]}
            samples={samples}
            domainT={domainT}
            height={280}
            kicker="01 · SELECTED"
            selected
          />
        </div>
        <TimeAxis domainT={domainT} />
      </div>
      <div className="pp-deck">
        <DeckCell
          index="02"
          title="GC pauses · interval Δ"
          keys={["gc"]}
          samples={samples}
          domainT={domainT}
          range={sync.horizon}
        />
        <DeckCell
          index="03"
          title="Memory tiers · GiB"
          keys={["heapUsed", "committed", "cgroup"]}
          samples={samples}
          domainT={domainT}
          range={sync.horizon}
        />
        <DeckCell
          index="04"
          title="Service and node CPU · %"
          keys={["svcCpu", "nodeCpu"]}
          samples={samples}
          domainT={domainT}
          range={sync.horizon}
        />
        <DeckCell
          index="05"
          title="Loaded chunks and entities"
          keys={["chunks", "entities"]}
          samples={samples}
          domainT={domainT}
          range={sync.horizon}
        />
      </div>
      <footer className="pp-bench__foot">
        {prefs.timezone === "UTC"
          ? "UTC"
          : Intl.DateTimeFormat().resolvedOptions().timeZone}{" "}
        · {retained} retained samples
        {sync.horizon === "2h" &&
          " · 2h requests show only retained history (35m maximum)"}
      </footer>
    </section>
  );
}

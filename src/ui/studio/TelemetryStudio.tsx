import { useMemo, useEffect } from "react";
import { GROUPS, SERIES, seriesKey, shapeTelemetry } from "../telemetry/series";
import { Stage } from "../telemetry/Stage";
import { Ribbon } from "../telemetry/Ribbon";
import { TimeAxis } from "../telemetry/TimeAxis";
import { crosshair } from "../telemetry/crosshair";
import Link from "next/link";
import { Maximize2 } from "lucide-react";
import {
  useViewSync,
  useTelemetry,
  observedSummary,
  useLedger,
  fmt,
  type Horizon,
  type TelemetryView,
  type Tone,
} from "../bindings";
import { Tabs } from "../primitives/Tabs";
import { type ChartView } from "./StudioChart";
type Metric = {
  id: string;
  label: string;
  tone: Tone;
  unit: string;
  value: number | null;
  values: (number | null)[];
};
export function metricList(t: TelemetryView, view: ChartView): Metric[] {
  if (view === "memory")
    return [
      {
        id: "heap",
        label: "Heap used",
        tone: "violet",
        unit: "GiB",
        value: t.heap == null ? null : t.heap / 2 ** 30,
        values: t.system.map((s) => (s.heap == null ? null : s.heap / 2 ** 30)),
      },
      {
        id: "committed",
        label: "Committed",
        tone: "violet",
        unit: "GiB",
        value: t.committed == null ? null : t.committed / 2 ** 30,
        values: t.system.map((s) =>
          s.committed == null ? null : s.committed / 2 ** 30,
        ),
      },
      {
        id: "cgroup",
        label: "Cgroup",
        tone: "indigo",
        unit: "GiB",
        value: t.cgroup == null ? null : t.cgroup / 2 ** 30,
        values: t.service.map((s) =>
          s.serviceMemory == null ? null : s.serviceMemory / 2 ** 30,
        ),
      },
      {
        id: "max",
        label: "Heap max",
        tone: "cyan",
        unit: "GiB",
        value: t.max == null ? null : t.max / 2 ** 30,
        values: [],
      },
      {
        id: "gc",
        label: "GC total",
        tone: "rose",
        unit: "ms",
        value: t.gc,
        values: t.system.map((s) => s.gc),
      },
    ];
  if (view === "cpu")
    return [
      {
        id: "cpu",
        label: "Service CPU",
        tone: "indigo",
        unit: "%",
        value: t.cpu,
        values: t.service.map((s) => s.serviceCpu ?? null),
      },
      {
        id: "node",
        label: "Node CPU",
        tone: "cyan",
        unit: "%",
        value: t.nodeCpu,
        values: t.host.map((s) => s.hostCpu),
      },
      {
        id: "chunks",
        label: "Chunks",
        tone: "emerald",
        unit: "",
        value: t.paper.at(-1)?.chunks ?? null,
        values: t.paper.map((s) => s.chunks ?? null),
      },
      {
        id: "entities",
        label: "Entities",
        tone: "violet",
        unit: "",
        value: t.paper.at(-1)?.entities ?? null,
        values: t.paper.map((s) => s.entities ?? null),
      },
      {
        id: "peak",
        label: "Service peak",
        tone: "amber",
        unit: "%",
        value: observedSummary(t.service, "serviceCpu").max,
        values: [],
      },
    ];
  return [
    {
      id: "tps",
      label: "TPS",
      tone: "emerald",
      unit: "",
      value: t.tps,
      values: t.paper.map((s) => s.tps),
    },
    {
      id: "mspt",
      label: "Mean MSPT",
      tone: "cyan",
      unit: "ms",
      value: t.mspt,
      values: t.paper.map((s) => s.mspt),
    },
    {
      id: "p95",
      label: "p95 MSPT",
      tone: "violet",
      unit: "ms",
      value: t.p95,
      values: t.paper.map((s) => s.p95 ?? null),
    },
    {
      id: "p99",
      label: "p99 MSPT",
      tone: "amber",
      unit: "ms",
      value: t.p99,
      values: t.paper.map((s) => s.p99 ?? null),
    },
    {
      id: "gc",
      label: "GC pauses Δ",
      tone: "rose",
      unit: "ms",
      value:
        t.system.length > 1 && t.system.at(-1)?.epoch === t.system.at(-2)?.epoch
          ? Math.max(0, (t.system.at(-1)?.gc ?? 0) - (t.system.at(-2)?.gc ?? 0))
          : null,
      values: t.system.map((s, i) =>
        i &&
        s.epoch === t.system[i - 1].epoch &&
        s.gc != null &&
        t.system[i - 1].gc != null
          ? Math.max(0, s.gc - t.system[i - 1].gc!)
          : null,
      ),
    },
  ];
}
export function Sparkline({
  values,
  tone,
  ticks = false,
}: {
  values: (number | null)[];
  tone: Tone;
  ticks?: boolean;
}) {
  const vs = values.slice(-30),
    finite = vs.filter((v): v is number => v != null),
    min = Math.min(...finite),
    max = Math.max(...finite),
    y = (v: number) => 20 - ((v - min) / Math.max(1, max - min)) * 17;
  return (
    <svg viewBox="0 0 56 22" aria-hidden>
      {ticks ? (
        vs.map((v, i) =>
          v != null && v > 0 ? (
            <line
              key={i}
              x1={(i / Math.max(1, vs.length - 1)) * 56}
              x2={(i / Math.max(1, vs.length - 1)) * 56}
              y1="21"
              y2={y(v)}
              stroke={`rgb(var(--${tone}))`}
            />
          ) : null,
        )
      ) : (
        <polyline
          points={vs
            .flatMap((v, i) =>
              v == null
                ? []
                : [`${(i / Math.max(1, vs.length - 1)) * 56},${y(v)}`],
            )
            .join(" ")}
          fill="none"
          stroke={`rgb(var(--${tone}))`}
          strokeWidth="1.4"
        />
      )}
    </svg>
  );
}
export { Ribbon as MetricRibbon } from "../telemetry/Ribbon";
export function HorizonSelector({
  value,
  onChange,
  extended = false,
}: {
  value: Horizon;
  onChange: (v: Horizon) => void;
  extended?: boolean;
}) {
  return (
    <div className="pp-seg" role="group" aria-label="Time horizon">
      {(
        ["1m", "5m", "15m", "35m", ...(extended ? ["2h"] : [])] as Horizon[]
      ).map((h) => (
        <button key={h} aria-pressed={h === value} onClick={() => onChange(h)}>
          {h}
        </button>
      ))}
    </div>
  );
}
export function SignalGroups({
  value,
  onChange,
}: {
  value: "tick" | "memory" | "cpu";
  onChange: (value: "tick" | "memory" | "cpu") => void;
}) {
  return (
    <Tabs
      value={value}
      onChange={onChange}
      label="Studio view"
      items={GROUPS.map((g) => ({ id: g.id, label: g.label }))}
    />
  );
}
export function TelemetryStudio() {
  const sync = useViewSync(),
    win = sync.horizon === "2h" ? "35m" : sync.horizon,
    t = useTelemetry(win),
    l = useLedger(),
    samples = useMemo(
      () => shapeTelemetry(t),
      [t.paper, t.system, t.host, t.service],
    ),
    domainT = useMemo(
      () => [t.since, t.now] as [number, number],
      [t.since, t.now],
    ),
    group = GROUPS.find((g) => g.id === sync.studioView)!,
    candidate = seriesKey(sync.activeSeries),
    selected = group.series.includes(candidate) ? candidate : group.series[0];
  useEffect(() => {
    crosshair.set(null);
    return () => crosshair.set(null);
  }, []);
  return (
    <section className="pp-pane pp-studio" aria-label="Telemetry studio">
      <header className="pp-pane__head pp-studio__bar">
        <h2>Telemetry Studio</h2>
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
          <div className="pp-seg" role="group" aria-label="Chart view">
            {(["focus", "split"] as const).map((mode) => (
              <button
                key={mode}
                aria-pressed={sync.studioMode === mode}
                onClick={() => sync.set("studioMode", mode)}
              >
                {mode === "focus" ? "Focus" : "Split"}
              </button>
            ))}
          </div>
          <HorizonSelector
            value={win}
            onChange={(v) => sync.set("horizon", v)}
          />
          <Link
            href="/performance"
            className="pp-ctl"
            aria-label="Open Performance analyzer"
          >
            <Maximize2 size={13} />
          </Link>
        </div>
      </header>
      <Ribbon
        keys={group.series}
        selected={selected}
        onSelect={(v) => sync.set("activeSeries", v)}
        samples={samples}
      />
      {sync.studioMode === "focus" ? (
        <div className="pp-studio__focus" key={selected}>
          <Stage
            spec={SERIES[selected]}
            samples={samples}
            domainT={domainT}
            height={300}
            kicker="SELECTED"
            selected
            stale={l.paper.state !== "live" && group.id === "tick"}
          />
        </div>
      ) : (
        <div className="pp-studio__split">
          {group.series.map((key, i) => (
            <Stage
              key={key}
              spec={SERIES[key]}
              samples={samples}
              domainT={domainT}
              height={110}
              kicker={String(i + 1).padStart(2, "0")}
              selected={key === selected}
              onSelect={() => sync.set("activeSeries", key)}
            />
          ))}
        </div>
      )}
      <TimeAxis domainT={domainT} />
    </section>
  );
}

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
import { StudioChart, type ChartView } from "./StudioChart";
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
export function MetricRibbon({
  metrics,
  active,
  onSelect,
}: {
  metrics: Metric[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="pp-ribbon" role="tablist" aria-label="Telemetry series">
      {metrics.map((m, i) => (
        <button
          key={m.id}
          role="tab"
          aria-selected={active === m.id}
          tabIndex={active === m.id ? 0 : -1}
          data-active={active === m.id}
          data-tone={m.tone}
          className="pp-metric"
          onClick={() => onSelect(m.id)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              const n =
                (i + (e.key === "ArrowRight" ? 1 : -1) + metrics.length) %
                metrics.length;
              onSelect(metrics[n].id);
              (
                e.currentTarget.parentElement?.children[n] as HTMLElement
              )?.focus();
            }
          }}
        >
          <span className="pp-kicker pp-metric__label">{m.label}</span>
          <span className="pp-metric__value pp-num">
            {fmt(m.value)}
            <span className="pp-metric__unit">{m.unit}</span>
          </span>
          {m.value != null && m.values.some((v) => v != null) && (
            <Sparkline values={m.values} tone={m.tone} ticks={m.id === "gc"} />
          )}
        </button>
      ))}
    </div>
  );
}
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
export function TelemetryStudio() {
  const sync = useViewSync(),
    view = sync.studioView,
    win = sync.horizon === "2h" ? "35m" : sync.horizon,
    setWin = (v: Horizon) => sync.set("horizon", v),
    setActive = (v: string) => sync.set("activeSeries", v),
    t = useTelemetry(win),
    l = useLedger(),
    metrics = metricList(t, view),
    active = metrics.some((m) => m.id === sync.activeSeries)
      ? sync.activeSeries
      : metrics[0].id;
  return (
    <section className="pp-pane pp-studio" aria-label="Telemetry studio">
      <header className="pp-pane__head">
        <h2 className="pp-pane__title">Telemetry Studio</h2>
        <Tabs
          value={view}
          onChange={(v) => {
            sync.patch({
              studioView: v,
              activeSeries:
                v === "tick" ? "tps" : v === "memory" ? "heap" : "cpu",
            });
          }}
          label="Studio view"
          items={[
            { id: "tick", label: "Tick & MSPT" },
            { id: "memory", label: "Memory tiers" },
            { id: "cpu", label: "CPU & chunks" },
          ]}
        />
        <div className="row push">
          <HorizonSelector value={win} onChange={setWin} />
          <Link
            href="/performance"
            className="pp-ctl"
            aria-label="Open Performance analyzer"
          >
            <Maximize2 size={13} />
          </Link>
        </div>
      </header>
      <MetricRibbon metrics={metrics} active={active} onSelect={setActive} />
      <StudioChart
        data={t}
        view={view}
        active={active}
        stale={l.paper.state !== "live"}
      />
    </section>
  );
}

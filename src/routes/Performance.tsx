import { useMemo, useState } from "react";
import { useSession, useNow } from "../hooks";
import { number } from "../adapter/control-state";
import {
  sourceEvidence,
  historyFor,
  observedSummary,
  gcMovement,
} from "../presentation/telemetry";
import { CrosshairGroup, TimeSeries } from "../components/charts/TimeSeries";
import { Panel, Status } from "../components/ui";
import { Coverage, SectionLabel } from "../components/Telemetry";
const plots = [
  {
    title: "Minecraft service CPU",
    source: "service" as const,
    key: "serviceCpu" as const,
    label: "Cgroup CPU",
    unit: "% of one core",
    color: "var(--chart-1)",
    description: "Host · exact systemd cgroup. 150% equals 1.5 cores.",
  },
  {
    title: "Paper process CPU",
    source: "paperSystem" as const,
    key: "processCpu" as const,
    label: "Paper process",
    unit: "%",
    color: "var(--chart-2)",
    description: "Paper JVM process · independent of Host process CPU.",
  },
  {
    title: "Node CPU",
    source: "hostSystem" as const,
    key: "hostCpu" as const,
    label: "Node total",
    unit: "%",
    color: "var(--chart-4)",
    description: "Host · machine total. Shared across instances on this node.",
  },
  {
    title: "JVM heap",
    source: "paperSystem" as const,
    key: "heap" as const,
    label: "Paper heap",
    unit: "bytes",
    color: "var(--chart-1)",
    description: "Paper · Java heap usage, separate from process RSS.",
  },
  {
    title: "Minecraft service memory",
    source: "service" as const,
    key: "serviceMemory" as const,
    label: "Cgroup memory",
    unit: "bytes",
    color: "var(--chart-2)",
    description: "Host · memory accounted to the Minecraft service cgroup.",
  },
  {
    title: "Node memory",
    source: "hostSystem" as const,
    key: "memory" as const,
    label: "Node used",
    unit: "bytes",
    color: "var(--chart-4)",
    description: "Host · total used memory on the machine.",
  },
];
export default function Performance() {
  const { state } = useSession(),
    now = useNow(),
    [minutes, setMinutes] = useState(15);
  const cutoff = Math.floor(now / 10000) * 10000 - minutes * 60_000;
  const samples = state.history;
  const health = useMemo(
      () => historyFor(samples, "paperHealth", cutoff),
      [samples, cutoff],
    ),
    spikes = health.filter(
      (sample) => sample.mspt !== null && sample.mspt > 50,
    ),
    paper = sourceEvidence(state, "paperHealth", now),
    gcRate = gcMovement(historyFor(samples, "paperSystem", cutoff));
  return (
    <CrosshairGroup>
      <div className="performance-toolbar">
        <div className="segmented" aria-label="Time range">
          {[1, 5, 15, 30].map((value) => (
            <button
              key={value}
              aria-pressed={minutes === value}
              className={minutes === value ? "active" : ""}
              onClick={() => setMinutes(value)}
            >
              {value}m
            </button>
          ))}
        </div>
        <span>Retained session window · shared sample inspection</span>
      </div>
      <div className="lab-grid">
        <Panel
          eyebrow="01 / TICK DIAGNOSTICS"
          title="Runtime, at resolution"
          className="wide-panel instrument-panel"
          action={
            <Status
              tone={
                spikes.length
                  ? "warning"
                  : health.length
                    ? "success"
                    : "neutral"
              }
            >
              {spikes.length
                ? `${spikes.length} budget crossings`
                : health.length
                  ? "No observed crossings"
                  : "No observations"}
            </Status>
          }
        >
          <div className="lab-ticks">
            {[
              {
                key: "tps" as const,
                label: "Tick rate",
                unit: "TPS",
                color: "var(--chart-1)",
                max: 20,
              },
              {
                key: "mspt" as const,
                label: "Mean tick duration",
                unit: "ms",
                color: "var(--chart-2)",
                max: undefined,
              },
            ].map((item) => {
              const summary = observedSummary(health, item.key);
              return (
                <div className="instrument-track" key={item.key}>
                  <div className="lab-readout">
                    {summary.mean === null
                      ? "—"
                      : summary.mean.toFixed(item.key === "tps" ? 2 : 1)}
                    <small>{item.unit} · observed mean</small>
                  </div>
                  <TimeSeries
                    title={item.label}
                    samples={samples}
                    windowStart={cutoff}
                    series={[
                      {
                        key: item.key,
                        label: item.label,
                        unit: item.unit,
                        color: item.color,
                      },
                    ]}
                    height={230}
                    yMax={item.max}
                    threshold={item.key === "mspt" ? 50 : undefined}
                    evidence={paper}
                  />
                </div>
              );
            })}
          </div>
          <div className="diagnostic-note">
            TPS and milliseconds use separate axes. Crosshairs align by source
            capture time; no additional observations are interpolated.
          </div>
        </Panel>
      </div>
      <SectionLabel
        index="02"
        title="Resource instruments"
        detail="One source and unit per plot"
      />
      <div className="lab-grid">
        {plots.map((plot) => (
          <Panel
            key={plot.key}
            eyebrow={`${plot.source === "paperSystem" ? "PAPER JVM" : plot.source === "service" ? "MINECRAFT SERVICE" : "HOST NODE"} / ${plot.unit === "bytes" ? "MEMORY" : "COMPUTE"}`}
            title={plot.title}
            description={plot.description}
            className="instrument-panel"
          >
            <TimeSeries
              title={plot.title}
              source={plot.description}
              samples={samples}
              windowStart={cutoff}
              series={[
                {
                  key: plot.key,
                  label: plot.label,
                  unit: plot.unit,
                  color: plot.color,
                },
              ]}
              height={220}
              yMax={plot.unit === "%" ? 100 : undefined}
              evidence={sourceEvidence(state, plot.source, now)}
            />
          </Panel>
        ))}
      </div>
      <SectionLabel index="03" title="Observation notes" />
      <div className="lab-grid">
        <Panel eyebrow="TICK BUDGET" title="Recent mean tick samples">
          <div className="coverage-block">
            <Coverage samples={health} />
            <div className="spike-list">
              {spikes
                .slice(-5)
                .reverse()
                .map((sample) => (
                  <div key={sample.at}>
                    <time>{new Date(sample.at).toLocaleTimeString()}</time>
                    <strong>{sample.mspt!.toFixed(1)} ms</strong>
                    <span>Above 50 ms</span>
                  </div>
                ))}
              {!spikes.length && (
                <p>No mean samples above 50 ms in this window.</p>
              )}
            </div>
          </div>
        </Panel>
        <Panel
          eyebrow="GARBAGE COLLECTION / PAPER"
          title="Cumulative pause movement"
        >
          <div className="single-evidence">
            <strong>
              {gcRate === null ? "—" : gcRate.toFixed(1)} <small>ms/min</small>
            </strong>
            <span>
              Counter movement over the observed window. A reset makes this rate
              unavailable.
            </span>
            <small>
              Current collections:{" "}
              {number(state.system.gcCollections)?.toLocaleString() ??
                "Unavailable"}
              . Tick and pause percentiles require source distributions and are
              not inferred from means.
            </small>
          </div>
        </Panel>
      </div>
    </CrosshairGroup>
  );
}

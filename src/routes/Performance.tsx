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
import { Status } from "../components/ui";
import { Coverage } from "../components/Telemetry";
import { usePlotHistory } from "../presentation/PlotHistory";
import { Icon } from "../components/Icon";
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
    [minutes, setMinutes] = useState(15),
    [selected, setSelected] = useState("tps"),
    [allSignals, setAllSignals] = useState(false);
  const epochs = usePlotHistory();
  const cutoff = Math.floor(now / 10000) * 10000 - minutes * 60000,
    samples = state.history;
  const health = useMemo(
    () => historyFor(epochs?.paperHealth ?? samples, "paperHealth", cutoff),
    [samples, cutoff, epochs],
  );
  const instruments = [
    {
      title: "Tick rate",
      source: "paperHealth" as const,
      key: "tps" as const,
      label: "Tick rate",
      unit: "TPS",
      color: "var(--chart-1)",
      description: "Paper · Minecraft runtime tick frequency.",
    },
    {
      title: "Mean tick duration",
      source: "paperHealth" as const,
      key: "mspt" as const,
      label: "Mean tick duration",
      unit: "ms",
      color: "var(--chart-2)",
      description: "Paper · observed average tick duration, not a percentile.",
    },
    ...plots,
  ];
  const active =
      instruments.find((plot) => plot.key === selected) ?? instruments[0],
    summary = observedSummary(
      historyFor(epochs?.[active.source] ?? samples, active.source, cutoff),
      active.key,
    ),
    gcRate = gcMovement(
      historyFor(epochs?.paperSystem ?? samples, "paperSystem", cutoff),
    );
  const display = (value: number | null, unit = active.unit) =>
    value === null
      ? "—"
      : unit === "bytes"
        ? `${(value / 2 ** 30).toFixed(2)} GiB`
        : `${value.toFixed(unit === "TPS" ? 2 : 1)} ${unit}`;
  return (
    <CrosshairGroup>
      <div className="analysis-toolbar">
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
        <span className="subtle">Source capture time · retained session</span>
        <button
          className={`button ${allSignals ? "primary" : "secondary"}`}
          aria-pressed={allSignals}
          onClick={() => setAllSignals((value) => !value)}
        >
          {allSignals ? "Focus one signal" : "Compare all signals"}
        </button>
      </div>
      <label className="mobile-signal-picker">
        <span className="eyebrow">SELECT AN INSTRUMENT</span>
        <select
          aria-label="Performance signal"
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setAllSignals(false);
          }}
        >
          {["Runtime", "Compute", "Memory"].map((category) => (
            <optgroup label={category} key={category}>
              {instruments
                .filter((plot) =>
                  category === "Runtime"
                    ? plot.source === "paperHealth"
                    : category === "Memory"
                      ? plot.unit === "bytes"
                      : plot.source !== "paperHealth" && plot.unit !== "bytes",
                )
                .map((plot) => (
                  <option key={plot.key} value={plot.key}>
                    {plot.title}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <div className="analysis-workspace">
        <aside className="signal-catalog" aria-label="Signal catalog">
          {["Runtime", "Compute", "Memory"].map((category, i) => (
            <div className="signal-category" key={category}>
              <span className="eyebrow">
                0{i + 1} / {category}
              </span>
              {instruments
                .filter((plot) =>
                  category === "Runtime"
                    ? plot.source === "paperHealth"
                    : category === "Memory"
                      ? plot.unit === "bytes"
                      : plot.source !== "paperHealth" && plot.unit !== "bytes",
                )
                .map((plot) => (
                  <button
                    key={plot.key}
                    className={selected === plot.key ? "active" : ""}
                    aria-pressed={selected === plot.key}
                    onClick={() => {
                      setSelected(plot.key);
                      setAllSignals(false);
                    }}
                  >
                    <span
                      className="signal-indicator"
                      style={{ background: plot.color }}
                    />
                    <span>
                      <strong>{plot.title}</strong>
                      <small>
                        {plot.source === "paperHealth"
                          ? "Paper runtime"
                          : plot.source === "paperSystem"
                            ? "Paper process"
                            : plot.source === "service"
                              ? "Minecraft cgroup"
                              : "Host node"}
                      </small>
                    </span>
                    <span className="catalog-arrow">↗</span>
                  </button>
                ))}
            </div>
          ))}
        </aside>
        <section className="analysis-focus">
          <header className="analysis-title">
            <div>
              <span className="eyebrow">
                {allSignals
                  ? "CAPTURE-ALIGNED SIGNALS"
                  : `${active.source === "paperHealth" ? "PAPER RUNTIME" : active.source === "paperSystem" ? "PAPER JVM" : active.source === "service" ? "MINECRAFT SERVICE" : "HOST NODE"} / ${active.unit === "bytes" ? "MEMORY" : "INSTRUMENT"}`}
              </span>
              <h2>{allSignals ? "Every source, in context." : active.title}</h2>
              <p>
                {allSignals
                  ? "Independent units and scales. Inspection synchronizes by actual capture time."
                  : active.description}
              </p>
            </div>
            <Status
              tone={
                sourceEvidence(state, active.source, now).kind === "live"
                  ? "success"
                  : "neutral"
              }
            >
              {sourceEvidence(state, active.source, now).kind}
            </Status>
          </header>
          {!allSignals && (
            <>
              <div className="analysis-summary">
                <div>
                  <span>OBSERVED MEAN</span>
                  <strong>{display(summary.mean)}</strong>
                </div>
                <div>
                  <span>LOWEST</span>
                  <strong>{display(summary.min)}</strong>
                </div>
                <div>
                  <span>HIGHEST</span>
                  <strong>{display(summary.max)}</strong>
                </div>
                <div>
                  <span>ACTUAL SAMPLES</span>
                  <strong>{summary.count.toLocaleString()}</strong>
                </div>
              </div>
              <TimeSeries
                key={active.key}
                title={active.title}
                source={active.description}
                samples={samples}
                windowStart={cutoff}
                series={[
                  {
                    key: active.key,
                    label: active.label,
                    unit: active.unit,
                    color: active.color,
                  },
                ]}
                height={360}
                yMax={
                  active.key === "tps"
                    ? 20
                    : active.unit === "%"
                      ? 100
                      : undefined
                }
                threshold={active.key === "mspt" ? 50 : undefined}
                evidence={sourceEvidence(state, active.source, now)}
              />
              <div className="analysis-explanation">
                <Icon name="performance" />
                <p>
                  {active.key === "serviceCpu"
                    ? "This scale is percent of one core. A reading above 100% is valid; 150% represents 1.5 cores."
                    : active.key === "mspt"
                      ? "50 ms is the tick budget for 20 TPS. The observations are means; no percentiles or causes are inferred."
                      : active.unit === "bytes"
                        ? "Binary memory units. Node, service cgroup and JVM heap account for different scopes and should be read separately."
                        : "Inspect with the arrow keys or touch a sample to pin it. Missing measurements and source boundaries remain disconnected."}
                </p>
              </div>
            </>
          )}
          {allSignals && (
            <div className="comparison-tracks">
              {instruments.map((plot) => (
                <section className="comparison-track" key={plot.key}>
                  <header>
                    <h3>{plot.title}</h3>
                    <p>{plot.description}</p>
                  </header>
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
                    height={190}
                    yMax={
                      plot.key === "tps"
                        ? 20
                        : plot.unit === "%"
                          ? 100
                          : undefined
                    }
                    threshold={plot.key === "mspt" ? 50 : undefined}
                    evidence={sourceEvidence(state, plot.source, now)}
                  />
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
      <section className="observation-ledger">
        <div>
          <span className="eyebrow">TICK BUDGET / PAPER</span>
          <h2>Observed mean samples.</h2>
          <Coverage samples={health} />
          <p>
            {health.filter((s) => s.mspt !== null && s.mspt > 50).length}{" "}
            samples above 50 ms in this window. Unobserved periods have no
            inferred state.
          </p>
        </div>
        <div>
          <span className="eyebrow">GARBAGE COLLECTION / PAPER</span>
          <h2>
            {gcRate === null ? "—" : gcRate.toFixed(1)} <small>ms/min</small>
          </h2>
          <p>
            Cumulative pause movement across the observed window. A counter
            reset makes the rate unavailable. Current collections:{" "}
            {number(state.system.gcCollections)?.toLocaleString() ??
              "Unavailable"}
            .
          </p>
        </div>
      </section>
    </CrosshairGroup>
  );
}

import { HostTelemetry } from "../components/HostTelemetry";
import { Segmented } from "../components/Segmented";
import { copy } from "../i18n/en";
import { useMemo } from "react";
import { useSession } from "../hooks";
import { TimeSeries } from "../components/charts/TimeSeries";
import { ResourcePanel } from "../components/ResourcePanel";
import { Panel, Status } from "../components/ui";
import { sampleStats, windowStart } from "../lib/chart";
import { number, str } from "../adapter/control-state";
import { entityDensity } from "../store/selectors";
import { preferences, usePreferences } from "../store/preferences";
import { chartWindowLabel, formatTime } from "../lib/time";
const CPU_OPTIONS = [
  {
    key: "serviceCpu",
    shortLabel: "Minecraft",
    label: "Minecraft service · % of one core",
    unit: "%",
    color: "var(--c1)",
    source: "Host service",
  },
  {
    key: "processCpu",
    shortLabel: "JVM",
    label: "JVM process",
    unit: "%",
    color: "var(--c4)",
    source: "Paper JVM",
  },
  {
    key: "hostCpu",
    shortLabel: "Host",
    label: "Host utilization",
    unit: "%",
    color: "var(--c5)",
    source: "Host",
  },
] as const;
const MEMORY_OPTIONS = [
  {
    key: "serviceMemory",
    shortLabel: "Minecraft",
    label: "Minecraft service memory",
    unit: "bytes",
    color: "var(--c4)",
    source: "Host service",
  },
  {
    key: "heap",
    shortLabel: "Heap",
    label: "JVM heap used",
    unit: "bytes",
    color: "var(--c3)",
    source: "Paper JVM",
  },
  {
    key: "memory",
    shortLabel: "Host",
    label: "Physical Host memory used",
    unit: "bytes",
    color: "var(--c1)",
    source: "Host",
  },
] as const;
export default function Performance() {
  const { state } = useSession();
  const prefs = usePreferences();
  const windowMs = prefs.chartWindowMs;
  const samples = useMemo(
    () =>
      state.history.slice(
        windowStart(
          state.history,
          (state.history.at(-1)?.at ?? Date.now()) - windowMs,
        ),
      ),
    [state.history, windowMs],
  );
  const spikes = samples.filter((s) => s.mspt !== null && s.mspt > 50);
  const gcRate = useMemo(() => {
    const first = samples.find((s) => s.gc !== null),
      last = samples.findLast((s) => s.gc !== null);
    return first && last && last.at > first.at && last.gc! >= first.gc!
      ? (last.gc! - first.gc!) / ((last.at - first.at) / 60000)
      : null;
  }, [samples]);
  const tps = sampleStats(
      samples.map((s) => s.tps).filter((v): v is number => v !== null),
    ),
    mspt = sampleStats(
      samples.map((s) => s.mspt).filter((v): v is number => v !== null),
    );
  const live = Boolean(state.ready?.agents.paper);
  return (
    <>
      <div className="performance-toolbar">
        <Segmented label={copy.time_range_22cd3} value={windowMs}>
          {(
            [
              [30_000, "30s"],
              [60_000, "1min"],
              [300_000, "5min"],
              [600_000, "10min"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() =>
                preferences.update({
                  chartWindowMs: value as 30_000 | 60_000 | 300_000 | 600_000,
                })
              }
              className={value === windowMs ? "active" : ""}
              aria-pressed={value === windowMs}
            >
              {label}
            </button>
          ))}
        </Segmented>
        <span>
          {chartWindowLabel(windowMs)} live window · 35 min retained · São Paulo
          time
        </span>
      </div>
      <div className="performance-grid">
        <Panel
          title={copy.tick_rate_528a7}
          eyebrow={
            tps
              ? `Average ${tps.average.toFixed(2)} TPS · lowest ${tps.min.toFixed(2)}`
              : "Waiting for tick samples"
          }
          action={
            <Status
              tone={spikes.length ? "warning" : live ? "success" : "neutral"}
            >
              {!live
                ? "History"
                : spikes.length
                  ? "Needs attention"
                  : "Within tick budget"}
            </Status>
          }
        >
          <TimeSeries
            samples={samples}
            windowMs={windowMs}
            title={copy.tick_rate_528a7}
            threshold={18}
            live={live}
            series={[
              { key: "tps", label: "TPS", unit: "TPS", color: "var(--c2)" },
            ]}
          />
        </Panel>
        <Panel
          title={copy.tick_duration_411a2}
          eyebrow={
            mspt
              ? `Peak ${mspt.max.toFixed(1)} ms · 50 ms budget`
              : "Waiting for tick samples"
          }
        >
          <TimeSeries
            samples={samples}
            windowMs={windowMs}
            title={copy.mean_tick_duration_c262d}
            threshold={50}
            live={live}
            series={[
              {
                key: "mspt",
                label: "Mean MSPT",
                unit: "ms",
                color: "var(--c3)",
              },
            ]}
          />
        </Panel>
        <ResourcePanel
          key={`${state.serverId}:${state.ready?.server.paperSession}:${state.ready?.server.hostSession}`}
          title={copy.cpu_load_01bd8}
          eyebrow="Inspect one CPU authority at a time, or compare them."
          resources={state.resources}
          windowMs={windowMs}
          connections={{ paper: live, host: Boolean(state.ready?.agents.host) }}
          defaultMetric="serviceCpu"
          options={CPU_OPTIONS}
        />
        <ResourcePanel
          key={`${state.serverId}:${state.ready?.server.paperSession}:${state.ready?.server.hostSession}`}
          title={copy.memory_89c8a}
          eyebrow="Separate heap, Minecraft service and physical Host memory."
          resources={state.resources}
          windowMs={windowMs}
          connections={{ paper: live, host: Boolean(state.ready?.agents.host) }}
          defaultMetric="serviceMemory"
          options={MEMORY_OPTIONS}
        />
        <Panel
          title={copy.slow_ticks_832c6}
          eyebrow={copy.mean_samples_above_the_50_ms_budget_2526c}
        >
          <div
            className="heat-strip"
            aria-label={`${spikes.length} slow samples`}
          >
            {samples.slice(-120).map((s) => (
              <i
                key={s.at}
                className={s.mspt === null ? "gap" : s.mspt > 50 ? "hot" : "ok"}
                title={`${formatTime(s.at, { seconds: true })} · ${s.mspt ?? "—"} ms`}
              />
            ))}
          </div>
          <div className="spike-list">
            {spikes.length ? (
              spikes
                .slice(-5)
                .reverse()
                .map((s) => (
                  <div key={s.at}>
                    <time>{formatTime(s.at, { seconds: true })}</time>
                    <strong>
                      {s.mspt!.toFixed(1)}
                      {copy._ms_c980f}
                    </strong>
                    <span>
                      {copy.over_budget_inspect_logs_for_context_fd0a1}
                    </span>
                  </div>
                ))
            ) : (
              <p>{copy.no_slow_samples_in_this_window_everyth_f972a}</p>
            )}
          </div>
        </Panel>
        <Panel
          title={copy.garbage_collection_84841}
          eyebrow={copy.movement_in_the_cumulative_pause_count_6f417}
        >
          <div className="single-evidence">
            <strong>
              {gcRate === null ? "—" : `${gcRate.toFixed(1)} ms/min`}
            </strong>
            <span>{copy.calculated_from_the_first_and_last_ava_a9aff}</span>
            <small>{copy.per_tick_p95_p99_and_individual_pause_1ad7e}</small>
          </div>
        </Panel>
        <Panel
          title={copy.world_workload_806c0}
          eyebrow={copy.chunks_and_entities_reported_by_paper_657fb}
          className="wide-panel"
        >
          <p className="table-scroll-hint">Swipe to see every world metric →</p>
          <div className="table-region" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>{copy.world_70c07}</th>
                  <th>{copy.loaded_chunks_1e674}</th>
                  <th>{copy.entities_f7638}</th>
                  <th>{copy.entities_per_chunk_92399}</th>
                </tr>
              </thead>
              <tbody>
                {state.worlds.map((w) => (
                  <tr key={str(w.name)}>
                    <td>{str(w.name)}</td>
                    <td>{number(w.loadedChunks) ?? "—"}</td>
                    <td>{number(w.entities) ?? "—"}</td>
                    <td>
                      {entityDensity(w.entities, w.loadedChunks)?.toFixed(2) ??
                        "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!state.worlds.length && (
              <div className="inline-empty">
                <strong>{copy.no_worlds_received_a1121}</strong>
                <span>{copy.world_metrics_appear_after_paper_conne_0c912}</span>
              </div>
            )}
          </div>
        </Panel>
        <HostTelemetry />
      </div>
    </>
  );
}

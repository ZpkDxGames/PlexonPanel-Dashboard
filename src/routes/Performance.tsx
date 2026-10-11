import { copy } from "../i18n/en";
import { useMemo, useState } from "react";
import { useSession } from "../hooks";
import { CrosshairGroup, TimeSeries } from "../components/charts/TimeSeries";
import { Panel, Status } from "../components/ui";
import { sampleStats, windowStart } from "../lib/chart";
import { number, str } from "../adapter/control-state";
import { entityDensity } from "../store/selectors";
export default function Performance() {
  const { state } = useSession();
  const [minutes, setMinutes] = useState(15);
  const samples = useMemo(
    () =>
      state.history.slice(
        windowStart(
          state.history,
          (state.history.at(-1)?.at ?? Date.now()) - minutes * 60000,
        ),
      ),
    [state.history, minutes],
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
    <CrosshairGroup>
      <div className="performance-toolbar">
        <div className="segmented" aria-label={copy.time_range_22cd3}>
          {[5, 15, 35].map((m) => (
            <button
              key={m}
              onClick={() => setMinutes(m)}
              className={m === minutes ? "active" : ""}
              aria-pressed={m === minutes}
            >
              {m}
              {copy._min_f4e8a}
            </button>
          ))}
        </div>
        <span>{copy.up_to_35_minutes_retained_gaps_stay_vi_5d7df}</span>
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
        <Panel
          title={copy.cpu_load_01bd8}
          eyebrow={copy.jvm_process_and_host_utilization_8cbd1}
        >
          <TimeSeries
            samples={samples}
            height={240}
            title={copy.cpu_utilization_241cc}
            live={live}
            series={[
              {
                key: "processCpu",
                label: "JVM process",
                unit: "%",
                color: "var(--c4)",
              },
              { key: "hostCpu", label: "Host", unit: "%", color: "var(--c5)" },
            ]}
            source="Paper + Host"
          />
        </Panel>
        <Panel
          title={copy.memory_89c8a}
          eyebrow={copy.jvm_heap_and_physical_host_memory_08742}
        >
          <TimeSeries
            samples={samples}
            height={240}
            title={copy.memory_usage_530f6}
            live={live}
            series={[
              { key: "heap", label: "Heap", unit: "bytes", color: "var(--c3)" },
              {
                key: "memory",
                label: "Host memory",
                unit: "bytes",
                color: "var(--c1)",
              },
            ]}
            source="Paper + Host"
          />
        </Panel>
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
                title={`${new Date(s.at).toLocaleTimeString()} · ${s.mspt ?? "—"} ms`}
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
                    <time>{new Date(s.at).toLocaleTimeString()}</time>
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
        <Panel
          title={copy.more_telemetry_b143e}
          eyebrow={copy.available_when_the_server_reports_it_933e4}
          className="wide-panel"
        >
          <div className="coverage">
            <span>{copy.per_core_cpu_network_i_o_disk_i_o_thre_34eb0}</span>
            <Status>{copy.not_available_on_this_server_911d0}</Status>
          </div>
          <p className="subtle" style={{ marginTop: 10 }}>
            {copy.these_measurements_need_a_supported_ba_e799b}
          </p>
        </Panel>
      </div>
    </CrosshairGroup>
  );
}

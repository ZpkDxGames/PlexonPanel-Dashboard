import { useMemo, useState } from "react";
import { useSession, useNow } from "../hooks";
import { number, record, str } from "../adapter/control-state";
import { session, type Prepared } from "../adapter/session";
import { bytes, metric, entityDensity } from "../store/selectors";
import {
  sourceEvidence,
  historyFor,
  observedSummary,
} from "../presentation/telemetry";
import { Button, Panel, Status } from "../components/ui";
import { Icon } from "../components/Icon";
import { MetricCell, SectionLabel, Coverage } from "../components/Telemetry";
import { CrosshairGroup, TimeSeries } from "../components/charts/TimeSeries";
import { ActionReview } from "../features/ActionReview";
const tpsSeries = [
  {
    key: "tps" as const,
    label: "Tick rate",
    unit: "TPS",
    color: "var(--chart-1)",
  },
];
const msptSeries = [
  {
    key: "mspt" as const,
    label: "Mean tick time",
    unit: "ms",
    color: "var(--chart-2)",
  },
];
const heapSeries = [
  {
    key: "heap" as const,
    label: "JVM heap",
    unit: "bytes",
    color: "var(--chart-1)",
  },
];
export default function Overview() {
  const snap = useSession(),
    now = useNow(),
    state = snap.state;
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const paper = sourceEvidence(state, "paperHealth", now),
    system = sourceEvidence(state, "paperSystem", now),
    host = sourceEvidence(state, "hostSystem", now),
    service = sourceEvidence(state, "service", now);
  const connected = Boolean(state.ready?.agents.paper),
    resources = record(state.service.resources);
  const tps = connected
      ? number(Array.isArray(state.server.tps) ? state.server.tps[0] : null)
      : null,
    mspt = connected ? number(state.server.averageTickMillis) : null;
  const heap = bytes(connected ? state.system.jvmHeapUsedBytes : null),
    players = connected ? number(state.server.onlinePlayers) : null;
  const stats = useMemo(
    () => observedSummary(historyFor(state.history, "paperHealth"), "tps"),
    [state.history],
  );
  const peak = useMemo(
    () =>
      observedSummary(historyFor(state.history, "paperHealth"), "players").max,
    [state.history],
  );
  const spikes = useMemo(
    () =>
      historyFor(state.history, "paperHealth").filter(
        (sample) => sample.mspt !== null && sample.mspt > 50,
      ).length,
    [state.history],
  );
  const lifecycle = (action: string) => {
    try {
      setPrepared(session.prepare(action, {}, "HOST"));
    } catch {
      /* Current reason remains visible. */
    }
  };
  const historical =
    paper.kind === "live"
      ? "Paper · current"
      : `Paper · ${paper.kind === "skew" ? "clock offset" : "last observed"}`;
  return (
    <>
      <div className="metric-ledger" aria-label="Current server condition">
        <MetricCell
          label="Online players"
          reading={metric(players, "players", 0)}
          detail={historical}
          icon="players"
          history={state.history}
          metric="players"
        />
        <MetricCell
          label="Mean tick time"
          reading={metric(mspt, "ms", 1)}
          detail={`${historical} · mean`}
          icon="clock"
          history={state.history}
          metric="mspt"
        />
        <MetricCell
          label="Paper process CPU"
          reading={metric(
            connected ? number(state.system.processCpuPercent) : null,
            "%",
            1,
          )}
          detail={`Paper JVM · ${system.kind}`}
          icon="performance"
          history={state.history}
          metric="processCpu"
        />
        <MetricCell
          label="JVM heap used"
          reading={heap}
          detail={`Paper JVM · ${system.kind}`}
          icon="server"
          history={state.history}
          metric="heap"
        />
      </div>
      <CrosshairGroup>
        <div className="cockpit-grid">
          <section
            className="panel instrument-panel"
            aria-label="Tick instrumentation"
          >
            <header className="instrument-top">
              <div>
                <span className="eyebrow">PAPER / RUNTIME SIGNAL</span>
                <h2>Every tick tells a story.</h2>
                <p>Tick rate and duration, on independent scales.</p>
              </div>
              <Status
                tone={
                  paper.kind === "live"
                    ? "success"
                    : paper.kind === "skew" || paper.kind === "stale"
                      ? "warning"
                      : "neutral"
                }
              >
                {paper.kind === "live" ? "Live signal" : paper.kind}
              </Status>
            </header>
            <div className="instrument-track">
              <div className="instrument-summary">
                <strong>{tps === null ? "—" : tps.toFixed(2)}</strong>
                <span>TPS</span>
                <small>
                  {stats.min === null
                    ? "No retained measurements"
                    : `Observed low ${stats.min.toFixed(2)} TPS`}
                </small>
              </div>
              <TimeSeries
                title="Paper tick rate"
                samples={state.history}
                series={tpsSeries}
                yMax={20}
                height={220}
                evidence={paper}
              />
            </div>
            <div className="instrument-track">
              <div className="track-title">
                <h3>Mean tick duration</h3>
                <strong>{mspt === null ? "—" : `${mspt.toFixed(1)} ms`}</strong>
              </div>
              <TimeSeries
                title="Paper mean tick duration"
                samples={state.history}
                series={msptSeries}
                threshold={50}
                height={180}
                evidence={paper}
              />
            </div>
          </section>
          <aside className="context-stack">
            <section className="source-card">
              <header>
                <h2>Source health</h2>
                <Icon name="performance" />
              </header>
              <div className="source-row">
                <span>Paper runtime</span>
                <Status
                  tone={
                    paper.kind === "live"
                      ? "success"
                      : paper.usable
                        ? "warning"
                        : "neutral"
                  }
                >
                  {paper.kind}
                </Status>
              </div>
              <div className="source-row">
                <span>Host telemetry</span>
                <Status
                  tone={
                    host.kind === "live"
                      ? "success"
                      : host.usable
                        ? "warning"
                        : "neutral"
                  }
                >
                  {host.kind}
                </Status>
              </div>
              <div className="source-row">
                <span>Minecraft service</span>
                <b>
                  {service.usable
                    ? str(state.service.state, "Unknown")
                    : "Unknown"}
                </b>
              </div>
              <div className="source-row">
                <span>Service CPU</span>
                <b>
                  {service.usable &&
                  resources.cpuAvailable === true &&
                  resources.cpuUnit === "PERCENT_OF_ONE_CORE" &&
                  resources.scope === "MINECRAFT_SERVICE"
                    ? `${number(resources.cpuPercent)?.toFixed(1) ?? "—"}% / core`
                    : "Unavailable"}
                </b>
              </div>
              <div className="source-row">
                <span>Node CPU</span>
                <b>
                  {host.usable
                    ? `${number(state.hostSystem.hostCpuPercent)?.toFixed(1) ?? "—"}%`
                    : "Unavailable"}
                </b>
              </div>
            </section>
            <section className="source-card">
              <header>
                <h2>Server controls</h2>
                <Icon name="server" />
              </header>
              <p>Manage the selected Minecraft service through its Host.</p>
              <div className="lifecycle-buttons">
                {[
                  ["Start", "server.start"],
                  ["Restart", "server.restart"],
                  ["Stop", "server.stop"],
                ].map(([label, action]) => (
                  <Button
                    key={action}
                    variant={label === "Stop" ? "danger" : "secondary"}
                    disabled={Boolean(session.reason(action, "HOST"))}
                    title={session.reason(action, "HOST")}
                    onClick={() => lifecycle(action)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <p>
                {session.reason("server.restart", "HOST") ||
                  "Each operation opens a review before dispatch."}
              </p>
            </section>
            <section className="source-card">
              <header>
                <h2>Observed attention</h2>
                <Icon name="alert" />
              </header>
              <div className="attention-row">
                <strong>{spikes} tick-budget crossings</strong>
                <span>
                  Mean samples above 50 ms in retained history. Cause is not
                  inferred.
                </span>
              </div>
              {paper.kind !== "live" && (
                <div className="attention-row">
                  <strong>Paper · {paper.kind}</strong>
                  <span>{paper.label}</span>
                </div>
              )}
              <div className="attention-row">
                <strong>{state.history.length} retained observations</strong>
                <span>
                  History remains local to this server session. Observed player
                  peak: {peak === null ? "unavailable" : peak}.
                </span>
              </div>
            </section>
          </aside>
        </div>
        <SectionLabel
          index="02"
          title="Inside your worlds"
          detail="Source / Paper"
        />
        <div className="overview-secondary">
          <Panel
            eyebrow="LOADED WORLD SNAPSHOT"
            title="Activity by world"
            action={<Status>{state.worlds.length} worlds</Status>}
          >
            <div className="world-list">
              {state.worlds.length ? (
                state.worlds.map((world) => {
                  const chunks = number(world.loadedChunks),
                    entities = number(world.entities),
                    max = Math.max(
                      1,
                      ...state.worlds.map((w) => number(w.entities) ?? 0),
                    ),
                    density = entityDensity(entities, chunks);
                  return (
                    <div className="world-row" key={str(world.name)}>
                      <strong>{str(world.name)}</strong>
                      <small>
                        {entities?.toLocaleString() ?? "—"} entities
                      </small>
                      <div className="world-bar">
                        <i
                          style={{
                            width:
                              entities === null
                                ? "0%"
                                : `${(entities / max) * 100}%`,
                          }}
                        />
                      </div>
                      <span>
                        {chunks?.toLocaleString() ?? "Unknown"} loaded chunks
                      </span>
                      <small>
                        {density === null
                          ? "Density unavailable"
                          : `${density.toFixed(2)} entities / chunk`}
                      </small>
                    </div>
                  );
                })
              ) : (
                <p className="subtle">Waiting for world telemetry.</p>
              )}
            </div>
          </Panel>
          <Panel
            eyebrow="MEMORY / PAPER JVM"
            title="Heap working set"
            description="Heap is separate from service and total node memory."
          >
            <TimeSeries
              title="JVM heap working set"
              samples={state.history}
              series={heapSeries}
              height={210}
              evidence={system}
            />
          </Panel>
        </div>
      </CrosshairGroup>
      <SectionLabel
        index="03"
        title="Recent tick observations"
        detail="Amber / above 50 ms"
      />
      <div className="coverage-block">
        <Coverage samples={state.history} />
        <p>
          Each segment is an observed mean tick sample. Missing values stay
          unfilled.
        </p>
      </div>
      <ActionReview prepared={prepared} onClose={() => setPrepared(null)} />
    </>
  );
}

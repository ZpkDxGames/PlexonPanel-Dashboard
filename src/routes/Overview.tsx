import { usePlotHistory } from "../presentation/PlotHistory";
import { useMemo, useState } from "react";
import { useSession, useNow } from "../hooks";
import { number, record, str } from "../adapter/control-state";
import { session, type Prepared } from "../adapter/session";
import { bytes, entityDensity } from "../store/selectors";
import {
  sourceEvidence,
  historyFor,
  observedSummary,
} from "../presentation/telemetry";
import { Button, Status } from "../components/ui";
import { Icon } from "../components/Icon";
import { Sparkline, Coverage } from "../components/Telemetry";
import { CrosshairGroup, TimeSeries } from "../components/charts/TimeSeries";
import { ActionReview } from "../features/ActionReview";
import { navigate } from "../router";
const ticks = [
    {
      key: "tps" as const,
      label: "Tick rate",
      unit: "TPS",
      color: "var(--chart-1)",
    },
  ],
  duration = [
    {
      key: "mspt" as const,
      label: "Mean tick time",
      unit: "ms",
      color: "var(--chart-2)",
    },
  ];
export default function Overview() {
  const snap = useSession(),
    now = useNow(),
    state = snap.state,
    [prepared, setPrepared] = useState<Prepared | null>(null);
  const epochs = usePlotHistory();
  const paper = sourceEvidence(state, "paperHealth", now),
    system = sourceEvidence(state, "paperSystem", now),
    host = sourceEvidence(state, "hostSystem", now),
    service = sourceEvidence(state, "service", now),
    connected = Boolean(state.ready?.agents.paper),
    resources = record(state.service.resources);
  const tps = connected
      ? number(Array.isArray(state.server.tps) ? state.server.tps[0] : null)
      : null,
    mspt = connected ? number(state.server.averageTickMillis) : null,
    heap = bytes(connected ? state.system.jvmHeapUsedBytes : null),
    players = connected ? number(state.server.onlinePlayers) : null;
  const stats = useMemo(
      () =>
        observedSummary(
          historyFor(epochs?.paperHealth ?? state.history, "paperHealth"),
          "tps",
        ),
      [state.history, epochs],
    ),
    peak = useMemo(
      () =>
        observedSummary(
          historyFor(epochs?.paperHealth ?? state.history, "paperHealth"),
          "players",
        ).max,
      [state.history, epochs],
    );
  const spikes = useMemo(
    () =>
      historyFor(epochs?.paperHealth ?? state.history, "paperHealth").filter(
        (sample) => sample.mspt !== null && sample.mspt > 50,
      ).length,
    [state.history, epochs],
  );
  const lifecycle = (action: string) => {
    try {
      setPrepared(session.prepare(action, {}, "HOST"));
    } catch {
      /* The authority reason remains visible. */
    }
  };
  const readings = [
    {
      label: "Online players",
      value: players?.toLocaleString() ?? "—",
      unit: "players",
      key: "players" as const,
      source: `Paper · ${paper.kind}`,
      detail:
        peak === null ? "No retained player peak" : `Observed peak ${peak}`,
    },
    {
      label: "Mean tick time",
      value: mspt?.toFixed(1) ?? "—",
      unit: "ms",
      key: "mspt" as const,
      source: `Paper · ${paper.kind}`,
      detail: "Mean, not a percentile",
    },
    {
      label: "Paper process CPU",
      value: connected
        ? (number(state.system.processCpuPercent)?.toFixed(1) ?? "—")
        : "—",
      unit: "%",
      key: "processCpu" as const,
      source: `Paper JVM · ${system.kind}`,
      detail: "Independent of Host process",
    },
    {
      label: "JVM heap used",
      value: heap.value,
      unit: heap.unit,
      key: "heap" as const,
      source: `Paper JVM · ${system.kind}`,
      detail: "Separate from service memory",
    },
  ];
  return (
    <>
      <div className="operation-toolbar">
        <div>
          <Status
            tone={
              service.usable && str(state.service.state) === "active"
                ? "success"
                : "neutral"
            }
          >
            {service.usable
              ? str(state.service.state, "Unknown")
              : "Service state unknown"}
          </Status>
          <span className="subtle">Host / Minecraft service</span>
        </div>
        <div className="lifecycle-buttons">
          {[
            ["Start", "server.start"],
            ["Restart", "server.restart"],
            ["Stop", "server.stop"],
          ].map(([label, action]) => (
            <Button
              key={action}
              variant={label === "Stop" ? "danger" : "secondary"}
              disabled={!!session.reason(action, "HOST")}
              title={session.reason(action, "HOST")}
              onClick={() => lifecycle(action)}
            >
              <Icon
                name={
                  label === "Start"
                    ? "play"
                    : label === "Restart"
                      ? "refresh"
                      : "stop"
                }
              />
              {label}
            </Button>
          ))}
        </div>
      </div>
      <CrosshairGroup>
        <section className="signal-landscape" aria-label="Tick instrumentation">
          <div className="landscape-reading">
            <span className="eyebrow">PAPER RUNTIME / TICK RATE</span>
            <div className="hero-reading">
              {tps === null ? "—" : tps.toFixed(2)}
              <small>TPS</small>
            </div>
            <Status
              tone={
                paper.kind === "live"
                  ? "success"
                  : paper.usable
                    ? "warning"
                    : "neutral"
              }
            >
              {paper.kind === "live" ? "Live signal" : paper.kind}
            </Status>
            <p>
              {stats.min === null ? (
                "Waiting for runtime measurements."
              ) : (
                <>
                  Observed low <b>{stats.min.toFixed(2)} TPS</b>
                  <br />
                  {stats.count.toLocaleString()} retained measurements
                </>
              )}
            </p>
            <button
              className="text-link"
              onClick={() => navigate("Performance")}
            >
              Inspect performance <Icon name="arrow" />
            </button>
          </div>
          <div className="landscape-plot">
            <div className="landscape-caption">
              <span>Server cadence</span>
              <span>20 TPS reference · independent capture clock</span>
            </div>
            <TimeSeries
              title="Paper tick rate"
              samples={state.history}
              series={ticks}
              yMax={20}
              height={260}
              evidence={paper}
            />
          </div>
        </section>
        <div className="overview-registers">
          <section className="runtime-register">
            <header className="section-heading">
              <div>
                <span className="eyebrow">THE RUNTIME REGISTER</span>
                <h2>A closer look.</h2>
              </div>
              <Icon name="performance" />
            </header>
            {readings.map((row) => (
              <div className="runtime-row" key={row.key}>
                <div>
                  <strong>{row.label}</strong>
                  <small>{row.detail}</small>
                </div>
                <div className="register-value">
                  {row.value}
                  <small>{row.unit}</small>
                </div>
                <Sparkline samples={state.history} metric={row.key} />
                <span className="register-source">{row.source}</span>
              </div>
            ))}
            <details className="inline-disclosure">
              <summary>
                Infrastructure measurements <span>Host / node & service</span>
              </summary>
              <dl className="identity-facts">
                <dt>Host node CPU</dt>
                <dd>
                  {host.usable
                    ? `${number(state.hostSystem.hostCpuPercent)?.toFixed(1) ?? "—"}%`
                    : "Unavailable"}
                </dd>
                <dt>Minecraft service CPU</dt>
                <dd>
                  {service.usable &&
                  resources.cpuAvailable === true &&
                  resources.cpuUnit === "PERCENT_OF_ONE_CORE" &&
                  resources.scope === "MINECRAFT_SERVICE"
                    ? `${number(resources.cpuPercent)?.toFixed(1) ?? "—"}% / core`
                    : "Unavailable"}
                </dd>
                <dt>Paper runtime</dt>
                <dd>{paper.label}</dd>
                <dt>Host telemetry</dt>
                <dd>{host.label}</dd>
              </dl>
              <p className="subtle">
                Service CPU is percent of one core. 150% represents 1.5 cores.
              </p>
            </details>
          </section>
          <section className="world-directory">
            <header className="section-heading">
              <div>
                <span className="eyebrow">LOADED WORLDS / PAPER</span>
                <h2>Room to explore.</h2>
              </div>
              <span className="count-label">
                {state.worlds.length.toString().padStart(2, "0")}
              </span>
            </header>
            <div className="world-columns">
              {state.worlds.length ? (
                state.worlds.map((world, index) => {
                  const entities = number(world.entities),
                    chunks = number(world.loadedChunks),
                    density = entityDensity(entities, chunks),
                    maximum = Math.max(
                      1,
                      ...state.worlds.map((w) => number(w.entities) ?? 0),
                    );
                  return (
                    <article className="world-column" key={str(world.name)}>
                      <span className="world-index">
                        WORLD / {String(index + 1).padStart(2, "0")}
                      </span>
                      <h3>{str(world.name)}</h3>
                      <div className="world-glyph" aria-hidden="true">
                        <i
                          style={{
                            height:
                              entities === null
                                ? 0
                                : `${entities === 0 ? 0 : Math.max(3, (entities / maximum) * 100)}%`,
                          }}
                        />
                        <span />
                      </div>
                      <div className="world-count">
                        {entities?.toLocaleString() ?? "—"}
                        <small>entities</small>
                      </div>
                      <p>
                        {chunks?.toLocaleString() ?? "Unknown"} loaded chunks
                      </p>
                      <small>
                        {density === null
                          ? "Density unavailable"
                          : `${density.toFixed(2)} entities / chunk`}
                      </small>
                    </article>
                  );
                })
              ) : (
                <p className="subtle">Waiting for world telemetry.</p>
              )}
            </div>
            <p className="chart-footnote">
              Column heights compare reported entity counts within this
              snapshot.
            </p>
          </section>
        </div>
        <section className="duration-register">
          <header className="section-heading">
            <div>
              <span className="eyebrow">TICK DURATION / PAPER</span>
              <h2>Time behind the tick.</h2>
            </div>
            <span className="inline-reading">
              {mspt?.toFixed(1) ?? "—"}
              <small>ms mean</small>
            </span>
          </header>
          <div className="duration-layout">
            <div>
              <strong>{spikes.toLocaleString()}</strong>
              <span>
                observed samples
                <br />
                above the 50 ms budget
              </span>
              <Coverage samples={epochs?.paperHealth ?? state.history} />
              <p>
                Mean observations only. Gaps stay open; causes and percentiles
                are not inferred.
              </p>
            </div>
            <TimeSeries
              title="Paper mean tick duration"
              samples={state.history}
              series={duration}
              threshold={50}
              height={190}
              evidence={paper}
            />
          </div>
        </section>
      </CrosshairGroup>
      <ActionReview prepared={prepared} onClose={() => setPrepared(null)} />
    </>
  );
}

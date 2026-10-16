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
import { hasScope } from "../presentation/authority";
import { usePlotHistory } from "../presentation/PlotHistory";
import { Button, Panel, Status, Empty } from "../components/ui";
import { Icon } from "../components/Icon";
import { Sparkline, Coverage } from "../components/Telemetry";
import { PlayerHead } from "../components/PlayerHead";
import { ConsolePreview } from "../components/ConsolePreview";
import { CrosshairGroup, TimeSeries } from "../components/charts/TimeSeries";
import { ActionReview } from "../features/ActionReview";
import { navigate } from "../router";
import { ActionAvailability } from "../components/nextgen/ActionAvailability";
const metrics = [
  {
    key: "tps" as const,
    title: "Paper tick rate",
    label: "Tick rate",
    unit: "TPS",
    source: "paperHealth" as const,
    color: "var(--chart-1)",
  },
  {
    key: "serviceCpu" as const,
    title: "Minecraft service CPU",
    label: "Service CPU",
    unit: "% of one core",
    source: "service" as const,
    color: "var(--chart-3)",
  },
  {
    key: "heap" as const,
    title: "Paper JVM heap",
    label: "JVM heap",
    unit: "bytes",
    source: "paperSystem" as const,
    color: "var(--chart-2)",
  },
];
const tickDuration = [
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
    state = snap.state;
  const [prepared, setPrepared] = useState<Prepared | null>(null),
    [metric, setMetric] = useState("tps"),
    [minutes, setMinutes] = useState(15);
  const epochs = usePlotHistory();
  const paper = sourceEvidence(state, "paperHealth", now),
    system = sourceEvidence(state, "paperSystem", now),
    host = sourceEvidence(state, "hostSystem", now),
    service = sourceEvidence(state, "service", now);
  const connected = Boolean(state.ready?.agents.paper),
    resources = record(state.service.resources);
  const tps = connected
      ? number(Array.isArray(state.server.tps) ? state.server.tps[0] : null)
      : null,
    mspt = connected ? number(state.server.averageTickMillis) : null,
    players = connected ? number(state.server.onlinePlayers) : null,
    capacity = connected ? number(state.server.maxPlayers) : null;
  const heap = bytes(connected ? state.system.jvmHeapUsedBytes : null);
  const health = useMemo(
    () => historyFor(epochs?.paperHealth ?? state.history, "paperHealth"),
    [state.history, epochs],
  );
  const stats = useMemo(() => observedSummary(health, "tps"), [health]);
  const peak = useMemo(() => observedSummary(health, "players").max, [health]);
  const spikes = useMemo(
    () => health.filter((s) => s.mspt !== null && s.mspt > 50).length,
    [health],
  );
  const current = metrics.find((item) => item.key === metric) ?? metrics[0];
  const usageSeries = useMemo(() => [current], [current]);
  const cutoff = Math.floor(now / 10000) * 10000 - minutes * 60000;
  const currentSummary = useMemo(
    () =>
      observedSummary(
        historyFor(
          epochs?.[current.source] ?? state.history,
          current.source,
          cutoff,
        ),
        current.key,
      ),
    [state.history, epochs, current, cutoff],
  );
  const canPlayers = hasScope(snap, "players.view");
  const lifecycle = (action: string) => {
    try {
      setPrepared(session.prepare(action, {}, "HOST"));
    } catch {
      /* The disabled reason remains visible. */
    }
  };
  const knownHeap = system.usable
      ? number(state.system.jvmHeapUsedBytes)
      : null,
    maxHeap = number(state.system.jvmHeapMaximumBytes);
  const knownMemory = host.usable
      ? number(state.hostSystem.physicalMemoryUsedBytes)
      : null,
    maxMemory = number(state.hostSystem.physicalMemoryTotalBytes);
  const formatBytes = (value: number | null) => {
    const b = bytes(value);
    return b.available ? `${b.value} ${b.unit}` : "Unavailable";
  };
  const resourceRow = (
    label: string,
    value: number | null,
    max: number | null,
    source: string,
  ) => (
    <div className="resource-row">
      <div>
        <strong>{label}</strong>
        <small>{source}</small>
      </div>
      <b>
        {formatBytes(value)}
        {max !== null && max > 0 ? <small> / {formatBytes(max)}</small> : null}
      </b>
      {value !== null && max !== null && max > 0 && value <= max ? (
        <meter min={0} max={max} value={value} aria-label={label} />
      ) : (
        <span className="resource-unavailable">
          Capacity{" "}
          {max === null || max <= 0 ? "not reported" : "not currently usable"}
        </span>
      )}
    </div>
  );
  return (
    <>
      <section className="server-banner" aria-label="Selected Minecraft server">
        <div className="server-banner-identity">
          <span className="voxel-emblem">
            <Icon name="server" />
          </span>
          <div>
            <div className="server-title-line">
              <h2>
                {String(
                  state.ready?.server.serverName ??
                    snap.labels[state.serverId] ??
                    state.serverId,
                )}
              </h2>
              <Status
                tone={
                  service.usable && str(state.service.state) === "active"
                    ? "success"
                    : "neutral"
                }
              >
                {service.usable
                  ? str(state.service.state, "Unknown")
                  : "Service unknown"}
              </Status>
            </div>
          </div>
        </div>
        <div className="lifecycle-buttons">
          {[
            ["Start", "server.start", "play"],
            ["Restart", "server.restart", "refresh"],
            ["Stop", "server.stop", "stop"],
          ].map(([label, action, icon]) => (
            <Button
              key={action}
              variant={label === "Stop" ? "danger" : "secondary"}
              disabled={!!session.reason(action, "HOST")}
              title={session.reason(action, "HOST")}
              onClick={() => lifecycle(action)}
            >
              <Icon name={icon} />
              {label}
            </Button>
          ))}
        </div>
      </section>
      <ActionAvailability
        reason={[
          ...new Set(
            ["server.start", "server.restart", "server.stop"]
              .map((a) => session.reason(a, "HOST"))
              .filter(Boolean),
          ),
        ].join(" ")}
      />
      <section
        className="metric-strip"
        aria-label="Current runtime measurements"
      >
        {[
          {
            label: "Tick rate",
            value: tps?.toFixed(2) ?? "—",
            unit: "TPS",
            key: "tps" as const,
            detail: `Paper · ${paper.kind}`,
            icon: "performance",
          },
          {
            label: "Mean tick time",
            value: mspt?.toFixed(1) ?? "—",
            unit: "ms",
            key: "mspt" as const,
            detail: `Paper · ${paper.kind}`,
            icon: "clock",
          },
          {
            label: "Online players",
            value: players?.toLocaleString() ?? "—",
            unit: capacity !== null ? `/ ${capacity}` : "players",
            key: "players" as const,
            detail:
              peak === null ? "No retained peak" : `Observed peak ${peak}`,
            icon: "players",
          },
          {
            label: "JVM heap",
            value: heap.value,
            unit: heap.unit,
            key: "heap" as const,
            detail: `Paper JVM · ${system.kind}`,
            icon: "server",
          },
        ].map((row) => (
          <article className="stat-cell" key={row.key}>
            <div className="stat-label">
              <Icon name={row.icon} />
              {row.label}
            </div>
            <div className="stat-reading">
              <strong>{row.value}</strong>
              <span>{row.unit}</span>
              <Sparkline samples={state.history} metric={row.key} />
            </div>
            <small>{row.detail}</small>
          </article>
        ))}
      </section>
      <CrosshairGroup>
        <div className="overview-grid">
          <Panel
            title="Usage instrument"
            className="usage-panel"
            action={
              <button
                className="text-link"
                onClick={() => navigate("Performance")}
              >
                All signals <Icon name="arrow" />
              </button>
            }
          >
            <div className="usage-controls">
              <div className="segmented" aria-label="Overview metric">
                {metrics.map((item) => (
                  <button
                    key={item.key}
                    className={metric === item.key ? "active" : ""}
                    aria-pressed={metric === item.key}
                    onClick={() => setMetric(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <select
                aria-label="Overview time range"
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              >
                {[1, 5, 15, 30].map((value) => (
                  <option key={value} value={value}>
                    {value} minutes
                  </option>
                ))}
              </select>
            </div>
            <div className="usage-reading">
              <strong>
                {currentSummary.mean === null
                  ? "—"
                  : current.unit === "bytes"
                    ? formatBytes(currentSummary.mean)
                    : `${currentSummary.mean.toFixed(2)} ${current.unit}`}
              </strong>
              <span>Observed mean · {currentSummary.count} actual samples</span>
            </div>
            <TimeSeries
              key={current.key}
              title={current.title}
              samples={state.history}
              series={usageSeries}
              yMax={current.key === "tps" ? 20 : undefined}
              height={190}
              mobileHeight={240}
              windowStart={cutoff}
              evidence={sourceEvidence(state, current.source, now)}
              source={
                current.source === "service"
                  ? "Host · Minecraft cgroup"
                  : current.source === "paperSystem"
                    ? "Paper JVM"
                    : "Paper"
              }
            />
            <p className="chart-footnote">
              {current.key === "tps"
                ? `20 TPS reference · observed low ${stats.min?.toFixed(2) ?? "—"} TPS.`
                : current.key === "serviceCpu"
                  ? "Percent of one CPU core. Service usage can exceed 100%."
                  : "Java heap usage is separate from service and node memory."}{" "}
              Missing samples remain gaps.
            </p>
          </Panel>
          <ConsolePreview />
          <Panel
            title="Infrastructure layers"
            className="resource-summary"
            action={<Icon name="performance" />}
          >
            <div className="resource-list strata-layers">
              {resourceRow(
                "Minecraft service memory",
                service.usable &&
                  resources.scope === "MINECRAFT_SERVICE" &&
                  resources.memoryAvailable === true
                  ? number(resources.memoryBytes)
                  : null,
                null,
                `Host cgroup · ${service.kind}`,
              )}
              {resourceRow(
                "JVM heap",
                knownHeap,
                maxHeap,
                `Paper · ${system.kind}`,
              )}
              {resourceRow(
                "Node memory",
                knownMemory,
                maxMemory,
                `Host node · ${host.kind}`,
              )}
              <div className="resource-row">
                <div>
                  <strong>Minecraft service CPU</strong>
                  <small>Host cgroup · {service.kind}</small>
                </div>
                <b>
                  {service.usable &&
                  resources.scope === "MINECRAFT_SERVICE" &&
                  resources.cpuAvailable === true &&
                  resources.cpuUnit === "PERCENT_OF_ONE_CORE"
                    ? `${number(resources.cpuPercent)?.toFixed(1) ?? "—"}%`
                    : "Unavailable"}
                  <small> of one core</small>
                </b>
                <span className="resource-unavailable">
                  150% = 1.5 cores · no 100% clamp
                </span>
              </div>
            </div>
            <details className="inline-disclosure">
              <summary>Paper process & source evidence</summary>
              <dl className="identity-facts">
                <dt>Paper process CPU</dt>
                <dd>
                  {system.usable
                    ? `${number(state.system.processCpuPercent)?.toFixed(1) ?? "—"}%`
                    : "Unavailable"}
                </dd>
                <dt>Host node CPU</dt>
                <dd>
                  {host.usable
                    ? `${number(state.hostSystem.hostCpuPercent)?.toFixed(1) ?? "—"}%`
                    : "Unavailable"}
                </dd>
                <dt>Paper capture</dt>
                <dd>{paper.capturedAt ?? "Unavailable"}</dd>
                <dt>Host capture</dt>
                <dd>{host.capturedAt ?? "Unavailable"}</dd>
              </dl>
            </details>
          </Panel>
          <Panel
            title="Loaded worlds"
            eyebrow="PAPER SNAPSHOT"
            className="world-panel"
          >
            <div className="world-list">
              {state.worlds.length && connected ? (
                state.worlds.map((world) => {
                  const entities = number(world.entities),
                    chunks = number(world.loadedChunks),
                    density = entityDensity(entities, chunks);
                  return (
                    <article className="world-row" key={str(world.name)}>
                      <span className="world-icon">
                        <Icon name="overview" />
                      </span>
                      <div>
                        <strong>{str(world.name)}</strong>
                        <small>
                          {chunks?.toLocaleString() ?? "Unknown"} loaded chunks
                        </small>
                      </div>
                      <div>
                        <b>{entities?.toLocaleString() ?? "—"}</b>
                        <small>
                          entities ·{" "}
                          {density === null
                            ? "density unavailable"
                            : `${density.toFixed(2)}/chunk`}
                        </small>
                      </div>
                    </article>
                  );
                })
              ) : (
                <Empty title="World telemetry unavailable">
                  Waiting for a Paper snapshot.
                </Empty>
              )}
            </div>
          </Panel>
          <Panel
            title="Active players"
            className="active-players"
            action={
              <button className="text-link" onClick={() => navigate("Players")}>
                View all <Icon name="arrow" />
              </button>
            }
          >
            <div className="active-player-list">
              {canPlayers && connected && state.players.length ? (
                state.players.slice(0, 4).map((player) => (
                  <button
                    className="active-player"
                    key={str(player.uuid)}
                    onClick={() => navigate("Players")}
                  >
                    <PlayerHead
                      uuid={str(player.uuid)}
                      name={str(player.name)}
                    />
                    <span>
                      <strong>{str(player.name)}</strong>
                      <small>{str(player.world, "World not reported")}</small>
                    </span>
                    <Icon name="chevron" />
                  </button>
                ))
              ) : (
                <Empty
                  title={
                    !canPlayers
                      ? "Roster access restricted"
                      : !connected
                        ? "Paper unavailable"
                        : "No players reported"
                  }
                >
                  {!canPlayers
                    ? "Requires players.view."
                    : "Player presence comes from Paper."}
                </Empty>
              )}
            </div>
          </Panel>
          <Panel
            title="Tick health"
            eyebrow="PAPER / MEAN DURATION"
            className="tick-health"
          >
            <div className="tick-health-summary">
              <strong>
                {mspt?.toFixed(1) ?? "—"}
                <small> ms</small>
              </strong>
              <span>{spikes} retained samples above 50 ms</span>
            </div>
            <Coverage samples={epochs?.paperHealth ?? state.history} />
            <TimeSeries
              title="Paper mean tick duration"
              samples={state.history}
              series={tickDuration}
              threshold={50}
              height={170}
              evidence={paper}
            />
            <p className="chart-footnote">
              50 ms is the tick budget for 20 TPS. Means only; no inferred
              percentiles.
            </p>
          </Panel>
          <Panel
            title="Instance details"
            className="server-info"
            action={<Icon name="server" />}
          >
            <div className="server-info-game">
              <span className="game-cube" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <div>
                <strong>Minecraft</strong>
                <span>Paper server instance</span>
              </div>
            </div>
            <dl className="identity-facts">
              <dt>Minecraft version</dt>
              <dd>{state.ready?.server.minecraftVersion ?? "Unavailable"}</dd>
              <dt>Instance key</dt>
              <dd>{state.ready?.server.instanceKey ?? "Legacy instance"}</dd>
              <dt>Server ID</dt>
              <dd>
                <code>{state.serverId || "Unavailable"}</code>
              </dd>
              <dt>Paper version</dt>
              <dd>{state.ready?.server.pluginVersion ?? "Unavailable"}</dd>
              <dt>Host version</dt>
              <dd>{state.ready?.server.hostVersion ?? "Unavailable"}</dd>
              <dt>Service state</dt>
              <dd>
                {service.usable ? str(state.service.state) : "Unavailable"}
              </dd>
            </dl>
          </Panel>
          <Panel title="Quick tools" className="quick-tools">
            <div className="quick-tool-grid">
              {[
                ["Performance", "performance", "Inspect signals"],
                ["Backups", "backups", "Restore points"],
                ["Access", "access", "Device access"],
              ].map(([route, icon, label]) => (
                <button
                  key={route}
                  onClick={() =>
                    navigate(route as "Performance" | "Backups" | "Access")
                  }
                >
                  <Icon name={icon} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </CrosshairGroup>
      <ActionReview prepared={prepared} onClose={() => setPrepared(null)} />
    </>
  );
}

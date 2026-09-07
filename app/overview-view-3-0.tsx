"use client";

import { Badge, Empty, Panel, bytes, duration, metric, time, type ViewProps } from "./control-views";
import { diagnostics, number, str, type Sample } from "../lib/control-state";

type MetricField = "tps" | "mspt" | "hostCpu" | "processCpu" | "heap" | "memory" | "players";
type Tone = "healthy" | "warning" | "critical" | "neutral";

function sampleValue(sample: Sample, field: MetricField) {
  const value = sample[field];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sparkPath(history: Sample[], field: MetricField, maximum?: number) {
  const points = history.slice(-42).map((sample) => sampleValue(sample, field));
  const valid = points.filter((value): value is number => value !== null);
  if (valid.length < 2) return "";
  const min = field === "tps" || field === "mspt" || field === "hostCpu" || field === "processCpu" || field === "players" ? 0 : Math.min(...valid) * .94;
  const max = Math.max(maximum ?? 0, ...valid, min + 1);
  const width = 180;
  const height = 42;
  const step = width / Math.max(1, points.length - 1);
  let path = "";
  let drawing = false;
  points.forEach((value, index) => {
    if (value === null) {
      drawing = false;
      return;
    }
    const x = index * step;
    const y = height - ((value - min) / Math.max(.001, max - min)) * height;
    path += `${drawing ? " L" : "M"}${x.toFixed(1)} ${Math.max(0, Math.min(height, y)).toFixed(1)}`;
    drawing = true;
  });
  return path;
}

function trend(history: Sample[], field: MetricField) {
  const values = history
    .slice(-24)
    .map((sample) => sampleValue(sample, field))
    .filter((value): value is number => value !== null);
  if (values.length < 2) return "Waiting for trend";
  const first = values[0];
  const last = values.at(-1) ?? first;
  const delta = (last - first) / Math.max(1, Math.abs(first));
  if (Math.abs(delta) < .025) return "Stable";
  return delta > 0 ? "Rising" : "Falling";
}

function MetricSignal({
  label,
  value,
  detail,
  history,
  field,
  tone = "neutral",
  maximum,
}: {
  label: string;
  value: string;
  detail: string;
  history: Sample[];
  field: MetricField;
  tone?: Tone;
  maximum?: number;
}) {
  const path = sparkPath(history, field, maximum);
  return (
    <article className="cr30-signal-card" data-tone={tone}>
      <div className="cr30-signal-heading">
        <span>{label}</span>
        <i aria-hidden />
      </div>
      <strong>{value}</strong>
      <div className="cr30-signal-meta">
        <small>{detail}</small>
        <small>{trend(history, field)}</small>
      </div>
      <svg viewBox="0 0 180 42" preserveAspectRatio="none" aria-hidden="true">
        {path ? <path d={path} /> : null}
      </svg>
    </article>
  );
}

function WorldActivity({ worlds }: { worlds: Record<string, unknown>[] }) {
  if (!worlds.length) return <Empty title="Waiting for world telemetry" />;
  return (
    <div className="cr30-world-grid">
      {worlds.slice(0, 8).map((world) => (
        <article key={str(world.name)}>
          <strong>{str(world.name)}</strong>
          <dl>
            <div><dt>Players</dt><dd>{String(world.players ?? "—")}</dd></div>
            <div><dt>Chunks</dt><dd>{String(world.loadedChunks ?? "—")}</dd></div>
            <div><dt>Entities</dt><dd>{String(world.entities ?? "—")}</dd></div>
          </dl>
        </article>
      ))}
    </div>
  );
}

export function OverviewView30(props: ViewProps) {
  const { state } = props;
  const paper = Boolean(state.ready?.agents.paper);
  const hostConnected = Boolean(state.ready?.agents.host);
  const hostInstalled = Boolean(state.ready?.agents.hostInstalled);
  const host = hostConnected ? state.hostSystem : state.system;
  const tps = Array.isArray(state.server.tps) ? number(state.server.tps[0]) : null;
  const mspt = number(state.server.averageTickMillis);
  const cpuField: MetricField = hostConnected ? "hostCpu" : "processCpu";
  const cpuValue = number(hostConnected ? host.hostCpuPercent : state.system.processCpuPercent);
  const memoryField: MetricField = hostConnected ? "memory" : "heap";
  const memoryValue = number(hostConnected ? host.physicalMemoryUsedBytes : state.system.jvmHeapUsedBytes);
  const memoryMax = number(hostConnected ? host.physicalMemoryTotalBytes : state.system.jvmHeapMaximumBytes) ?? undefined;
  const players = number(state.server.onlinePlayers);
  const playerMax = number(state.server.maximumPlayers) ?? undefined;
  const overall = !props.connected ? "Offline" : paper ? "Live" : "Degraded";
  const overallTone = !props.connected ? "amber" : paper ? "green" : "amber";

  const warnings: { title: string; detail: string; tone: Tone }[] = [];
  if (!paper) warnings.push({ title: "Paper agent offline", detail: "Paper-authoritative telemetry and player operations are unavailable.", tone: "critical" });
  if (hostInstalled && !hostConnected) warnings.push({ title: "Host companion offline", detail: "Host-authoritative lifecycle and host telemetry may be unavailable.", tone: "warning" });
  if (tps !== null && tps < 18) warnings.push({ title: "TPS degraded", detail: `Current TPS is ${tps.toFixed(2)}.`, tone: tps < 15 ? "critical" : "warning" });
  if (mspt !== null && mspt > 50) warnings.push({ title: "Tick budget exceeded", detail: `Current average MSPT is ${mspt.toFixed(2)} ms.`, tone: mspt > 80 ? "critical" : "warning" });
  if (cpuValue !== null && cpuValue >= 90) warnings.push({ title: "CPU pressure", detail: `${hostConnected ? "Host" : "Paper process"} CPU is ${cpuValue.toFixed(1)}%.`, tone: "warning" });

  const activity = state.presenceDeltas
    .slice(-8)
    .reverse()
    .map((event) => ({
      key: str(event.eventId, `${event.uuid}-${event.observedAt}`),
      title: `${str(event.name, "Player")} ${event.state === "LEFT" ? "left" : "joined"}`,
      detail: event.state === "LEFT" ? "Player presence ended" : "Player presence started",
      at: event.observedAt,
    }));

  return (
    <div className="cr30-overview-stack">
      <section className="cr30-status-strip" aria-label="Server status summary">
        <div className="cr30-status-primary">
          <span className={`cr-dot ${props.connected && paper ? "online" : ""}`} />
          <div>
            <small>Overall</small>
            <strong>{overall}</strong>
          </div>
          <Badge tone={overallTone}>{props.connected ? "Connected" : "Disconnected"}</Badge>
        </div>
        <div><small>Paper</small><strong>{paper ? "Live" : "Offline"}</strong></div>
        <div><small>Host</small><strong>{hostConnected ? "Live" : hostInstalled ? "Offline" : "Not installed"}</strong></div>
        <div><small>Minecraft</small><strong>{state.ready?.server.minecraftVersion ?? "—"}</strong></div>
        <div><small>Uptime</small><strong>{duration(state.system.processUptimeMillis)}</strong></div>
        <div><small>Players</small><strong>{players === null ? "—" : `${players}${playerMax ? ` / ${playerMax}` : ""}`}</strong></div>
        <div><small>Last update</small><strong>{state.updatedAt ? new Date(state.updatedAt).toLocaleTimeString() : "Waiting"}</strong></div>
      </section>

      <section className="cr30-primary-signals" aria-label="Primary server signals">
        <MetricSignal
          label="TPS"
          value={tps === null ? "—" : tps.toFixed(2)}
          detail="20 target"
          history={state.history}
          field="tps"
          maximum={20}
          tone={tps === null ? "neutral" : tps < 15 ? "critical" : tps < 18 ? "warning" : "healthy"}
        />
        <MetricSignal
          label="MSPT"
          value={mspt === null ? "—" : `${mspt.toFixed(2)} ms`}
          detail="50 ms tick budget"
          history={state.history}
          field="mspt"
          maximum={Math.max(55, mspt ?? 0)}
          tone={mspt === null ? "neutral" : mspt > 80 ? "critical" : mspt > 50 ? "warning" : "healthy"}
        />
        <MetricSignal
          label={hostConnected ? "Host CPU" : "Paper CPU"}
          value={cpuValue === null ? "—" : `${cpuValue.toFixed(1)}%`}
          detail={hostConnected ? "Host utilization" : "Process utilization"}
          history={state.history}
          field={cpuField}
          maximum={100}
          tone={cpuValue === null ? "neutral" : cpuValue >= 95 ? "critical" : cpuValue >= 85 ? "warning" : "healthy"}
        />
        <MetricSignal
          label={hostConnected ? "Host memory" : "JVM heap"}
          value={bytes(memoryValue)}
          detail={memoryMax ? `${bytes(memoryMax)} capacity` : "Capacity unavailable"}
          history={state.history}
          field={memoryField}
          maximum={memoryMax}
          tone="neutral"
        />
        <MetricSignal
          label="Players"
          value={players === null ? "—" : String(players)}
          detail={playerMax ? `${playerMax} slots` : "Maximum unavailable"}
          history={state.history}
          field="players"
          maximum={playerMax}
          tone="neutral"
        />
      </section>

      <div className="cr30-overview-columns">
        <Panel title="Health summary" aside={<Badge tone={warnings.length ? "amber" : "green"}>{warnings.length ? `${warnings.length} active` : "No active warnings"}</Badge>}>
          {warnings.length ? (
            <div className="cr30-health-list">
              {warnings.map((warning) => (
                <article key={warning.title} data-tone={warning.tone}>
                  <i aria-hidden />
                  <div><strong>{warning.title}</strong><p>{warning.detail}</p></div>
                </article>
              ))}
            </div>
          ) : (
            <p className="cr30-health-clear">No warning thresholds are active in the telemetry currently received by this browser.</p>
          )}
        </Panel>

        <Panel title="Recent activity" aside={<Badge>{activity.length} recent</Badge>}>
          {activity.length ? (
            <div className="cr30-activity-list">
              {activity.map((item) => (
                <article key={item.key}>
                  <i aria-hidden />
                  <div><strong>{item.title}</strong><small>{item.detail}</small></div>
                  <time>{time(item.at)}</time>
                </article>
              ))}
            </div>
          ) : (
            <Empty title="No recent presence activity">
              Player joins and leaves appear here when Paper supplies authorized presence events.
            </Empty>
          )}
        </Panel>
      </div>

      <Panel title="World activity">
        <WorldActivity worlds={state.worlds} />
      </Panel>

      <div className="cr21-inline-actions cr30-overview-actions">
        <button
          className="cr-button"
          onClick={() =>
            void navigator.clipboard
              .writeText(diagnostics(state))
              .then(() => props.notice("Safe diagnostics copied."))
          }
        >
          Copy safe diagnostics
        </button>
        <span>{metric(state.system.processCpuPercent, "%", 1)} Paper process CPU · {bytes(state.system.jvmHeapUsedBytes)} JVM heap</span>
      </div>
    </div>
  );
}

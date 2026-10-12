import { classifyTelemetry } from "../adapter/telemetry-freshness";
import { Segmented } from "../components/Segmented";
import { copy } from "../i18n/en";
import { useMemo, useState } from "react";
import { useSession, useNow } from "../hooks";
import { number, str } from "../adapter/control-state";
import { bytes, sourceStatus } from "../store/selectors";
import { Button, Panel } from "../components/ui";
import {
  Sparkline,
  TimeSeries,
  type MetricKey,
} from "../components/charts/TimeSeries";
import { Kpi } from "../components/Kpi";
import { ActionReview } from "../features/ActionReview";
import { session, type Prepared } from "../adapter/session";
import { ServerIcon } from "../components/ServerIcon";
import { Icon } from "../components/Icon";
import { PlayerHead } from "../components/PlayerHead";
import { FormattedText } from "../components/FormattedText";
import { ConsoleView } from "../components/ConsoleView";
import { duration, relative } from "../lib/format";
import { sampleStats, windowStart } from "../lib/chart";
import { groupLogs } from "../lib/log-parser";
import { navigate } from "../router";
import { preferences, usePreferences } from "../store/preferences";
import { playerPingMillis } from "../lib/player-telemetry";
export default function Overview() {
  const snap = useSession(),
    now = useNow(),
    state = snap.state,
    prefs = usePreferences(),
    windowMs = prefs.chartWindowMs;
  const [prepared, setPrepared] = useState<Prepared | null>(null),
    [selected, setSelected] = useState<MetricKey>("tps");
  const paper = sourceStatus(
    state,
    "Paper",
    Boolean(state.ready?.agents.paper),
    now,
  );
  const online = Boolean(state.ready?.agents.paper),
    fresh = paper.usable;
  const systemFresh = classifyTelemetry({
    capturedAt: state.system.capturedAt,
    receivedAt: state.receipts?.paperSystem,
    connected: Boolean(state.ready?.agents.paper),
    now,
  }).usable;
  const metricLive = selected === "processCpu" ? systemFresh : fresh;
  const tps = fresh
      ? number(Array.isArray(state.server.tps) ? state.server.tps[0] : null)
      : null,
    cpu = systemFresh ? number(state.system.processCpuPercent) : null,
    players = online ? number(state.server.onlinePlayers) : null,
    max = number(state.server.maximumPlayers ?? state.server.maxPlayers),
    heap = systemFresh ? number(state.system.jvmHeapUsedBytes) : null,
    heapMax = number(state.system.jvmHeapMaximumBytes);
  const heapPct = heap !== null && heapMax ? (heap / heapMax) * 100 : null;
  const uptime = number(state.server.uptimeMillis ?? state.system.uptimeMillis);
  const samples = useMemo(
    () =>
      state.history.slice(
        windowStart(
          state.history,
          (state.history.at(-1)?.at ?? now) - windowMs,
        ),
      ),
    [state.history, windowMs],
  );
  const key = selected,
    values = samples
      .map((s) => s[key])
      .filter((v): v is number => typeof v === "number"),
    stats = sampleStats(values);
  const metricName = key === "tps" ? "TPS" : key === "mspt" ? "MSPT" : "CPU",
    metricUnit = key === "tps" ? "TPS" : key === "mspt" ? "ms" : "%",
    color =
      key === "tps" ? "var(--c2)" : key === "mspt" ? "var(--c3)" : "var(--c4)";
  const logs = useMemo(() => groupLogs(state.console), [state.console]);
  const events = logs
    .filter(
      (e) => e.kind !== "info" && e.kind !== "command" && e.kind !== "chat",
    )
    .slice(-6)
    .reverse();
  const healthy =
    tps !== null && tps >= 18 && (heapPct === null || heapPct < 90);
  const health = !online
    ? "Server offline"
    : !fresh
      ? "Waiting for a fresh sample"
      : healthy
        ? "Healthy"
        : "Needs attention";
  const insight = stats
    ? `${key === "tps" ? "Lowest" : "Peak"} ${key === "tps" ? stats.min.toFixed(2) : stats.max.toFixed(1)} ${metricUnit} in this window.`
    : "Metrics appear after the server connects.";
  const lifecycle = (action: string) => {
    try {
      setPrepared(session.prepare(action, {}, "HOST"));
    } catch {}
  };
  const uptimeLabel = duration(uptime);
  const entityTotal = state.worlds.reduce(
    (n, w) => n + (number(w.entities) ?? 0),
    0,
  );
  const chunks = state.worlds.reduce(
    (n, w) => n + (number(w.loadedChunks) ?? 0),
    0,
  );
  return (
    <>
      <section className="card server">
        <div className="server-icon">
          <ServerIcon />
        </div>
        <div>
          <div className="server-name">
            <h1>{state.ready?.server.serverName ?? "Your server"}</h1>
            <span className="status" data-state={online ? "online" : "offline"}>
              <i />
              {online ? "Online" : "Offline"}
            </span>
          </div>
          <div className="server-meta">
            {state.server.motd ? (
              <span className="motd">
                <FormattedText value={str(state.server.motd)} />
              </span>
            ) : (
              <span className="chip">
                {state.ready?.server.instanceKey ?? "Minecraft server"}
              </span>
            )}
            <span className="chip">
              {copy.paper_f2add}
              {state.ready?.server.minecraftVersion ?? "—"}
            </span>
            {Boolean(state.server.address) && (
              <button
                className="chip"
                title={copy.copy_address_4eaae}
                onClick={() =>
                  void navigator.clipboard.writeText(str(state.server.address))
                }
              >
                <Icon name="copy" />
                {str(state.server.address)}
              </button>
            )}
            <span className="chip">
              <Icon name="clock" />
              {copy.up_68670}
              {uptimeLabel}
            </span>
          </div>
          <div
            className="health"
            data-level={!online ? "bad" : healthy ? "ok" : "warn"}
          >
            <Icon name="access" />
            <b>{health}</b>
            <span>
              {!online
                ? "Start the server when you’re ready."
                : !fresh
                  ? "The last known history stays available."
                  : players === 0
                    ? "No players online. Everything is idle."
                    : `TPS ${tps?.toFixed(1) ?? "—"}${heapPct !== null ? `, memory at ${Math.round(heapPct)}%.` : "."}`}
            </span>
          </div>
        </div>
        <div className="controls">
          {[
            ["server.start", "Start", "play"],
            ["server.restart", "Restart", "restart"],
            ["server.stop", "Stop", "stop"],
          ].map(([a, label, icon]) => (
            <Button
              key={a}
              onClick={() => lifecycle(a)}
              disabled={
                Boolean(session.reason(a, "HOST")) ||
                (a === "server.start" ? online : !online)
              }
              title={session.reason(a, "HOST")}
            >
              <Icon name={icon} />
              {label}
            </Button>
          ))}
          <Button
            variant="danger"
            disabled
            title={copy.force_kill_is_not_advertised_by_this_s_4a4e5}
          >
            {copy.force_kill_e5eac}
          </Button>
        </div>
      </section>
      <div className="kpis overview-kpis">
        <Kpi
          label={copy.players_online_3d510}
          sub="right now"
          value={players}
          unit={max === null ? "players" : `/ ${max}`}
          color="var(--c1)"
          icon="players"
          context={
            players === 0 ? "All quiet" : `${state.players.length} in roster`
          }
          values={samples.map((s) => s.players)}
        />
        <Kpi
          label={copy.tick_rate_528a7}
          sub="target 20"
          value={tps}
          unit="TPS"
          decimals={2}
          color="var(--c2)"
          icon="performance"
          context={
            fresh
              ? `${sampleStats(samples.map((s) => s.tps).filter((v): v is number => v !== null))?.average.toFixed(1) ?? "—"} avg`
              : "Waiting for data"
          }
          values={samples.map((s) => s.tps)}
        />
        <Kpi
          label={copy.memory_89c8a}
          sub={`of ${heapMax ? bytes(heapMax).value + " " + bytes(heapMax).unit : "unknown limit"}`}
          value={heap === null ? null : heap / 2 ** 30}
          unit="GiB"
          decimals={1}
          color="var(--c3)"
          icon="memory"
          context={
            heapPct === null ? "Limit unavailable" : `${Math.round(heapPct)}%`
          }
          gauge={heapPct ?? 0}
        />
        <Kpi
          label={copy.cpu_load_01bd8}
          sub="server process"
          value={cpu}
          unit="%"
          decimals={1}
          color="var(--c4)"
          icon="cpu"
          context={systemFresh ? "JVM process" : "Waiting for data"}
          values={samples.map((s) => s.processCpu)}
        />
        <Kpi
          label={copy.uptime_6aafa}
          sub="since restart"
          value={
            online && uptime !== null ? Math.floor(uptime / 86400000) : null
          }
          unit={
            uptime !== null
              ? "d · " + uptimeLabel.split(" ").slice(1).join(" ")
              : "unavailable"
          }
          color="var(--c5)"
          icon="clock"
          context={online ? "Current session" : "Server stopped"}
          values={
            uptime !== null
              ? samples.map((s) => (uptime - (now - s.at)) / 3600000)
              : []
          }
        />
      </div>
      <>
        <div className="grid">
          <Panel
            title={copy.server_performance_cd946}
            eyebrow={
              players === 0 && fresh
                ? "No players online. The server is idle and healthy."
                : insight
            }
            className="c-8 hero overview-hero"
          >
            <div className="head-tools">
              {metricLive && online && (
                <span className="live">
                  <i />
                  {copy.live_65c82}
                </span>
              )}
              <Segmented label={copy.metric_b2bb7} value={selected}>
                {(["tps", "mspt", "processCpu"] as MetricKey[]).map((k) => (
                  <button
                    key={k}
                    className={key === k ? "active" : ""}
                    aria-pressed={key === k}
                    onClick={() => setSelected(k)}
                  >
                    {k === "tps" ? "TPS" : k === "mspt" ? "MSPT" : "CPU"}
                  </button>
                ))}
              </Segmented>
              <Segmented label={copy.range_a16c5} value={windowMs}>
                {[
                  [30_000, "30s"],
                  [60_000, "1min"],
                  [300_000, "5min"],
                  [600_000, "10min"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={windowMs === value ? "active" : ""}
                    aria-pressed={windowMs === value}
                    onClick={() =>
                      preferences.update({
                        chartWindowMs: value as
                          | 30_000
                          | 60_000
                          | 300_000
                          | 600_000,
                      })
                    }
                  >
                    {label}
                  </button>
                ))}
              </Segmented>
            </div>
            <div className="stats-row">
              {[
                [online ? "Now" : "Last sample", stats?.current],
                ["Average", stats?.average],
                ["Lowest", stats?.min],
                ["Peak", stats?.max],
              ].map(([label, value]) => (
                <div className="stat" key={String(label)}>
                  <b>
                    {typeof value === "number"
                      ? value.toFixed(key === "tps" ? 2 : 1)
                      : "—"}
                  </b>
                  <span>
                    {label} · {metricName}
                  </span>
                </div>
              ))}
            </div>
            <TimeSeries
              title={metricName}
              samples={samples}
              windowMs={windowMs}
              live={online && metricLive}
              threshold={key === "tps" ? 18 : key === "mspt" ? 50 : undefined}
              series={[{ key, label: metricName, unit: metricUnit, color }]}
            />
          </Panel>
          <Panel
            title={copy.online_players_621c6}
            eyebrow={
              players === 0
                ? "Nobody is playing right now"
                : `Peak in this session: ${sampleStats(samples.map((s) => s.players).filter((v): v is number => v !== null))?.max ?? "—"}`
            }
            className="c-4 overview-players"
            action={
              <button className="link" onClick={() => navigate("Players")}>
                {copy.view_all_931e1}
              </button>
            }
          >
            <div className="players-meta">
              <div className="big num">
                {players ?? "—"} <small>/ {max ?? "—"}</small>
              </div>
              <div style={{ width: 120 }}>
                <Sparkline values={samples.map((s) => s.players)} />
              </div>
            </div>
            <div className="players">
              {state.players.slice(0, 7).map((p) => (
                <div className="player" key={str(p.uuid)}>
                  <PlayerHead name={str(p.name)} uuid={str(p.uuid)} />
                  <div>
                    <b>{str(p.name)}</b>
                    <small>
                      {copy.online_for_9a0d3}
                      {duration(number(p.onlineDurationMillis))}
                    </small>
                  </div>
                  <span
                    className={`ping ${(playerPingMillis(p) ?? 0) > 100 ? "high" : (playerPingMillis(p) ?? 0) > 70 ? "mid" : ""}`}
                  >
                    <i />
                    {playerPingMillis(p) ?? "—"}
                    {copy._ms_c980f}
                  </span>
                </div>
              ))}
              {!state.players.length && (
                <div className="empty">
                  <b>{online ? "No one is online" : "Server offline"}</b>
                  <p>
                    {online
                      ? "The server is quiet. New joins appear here as they happen."
                      : "The roster appears when the server starts."}
                  </p>
                </div>
              )}
              {state.players.length > 7 && (
                <p className="subtle">
                  + {state.players.length - 7}
                  {copy._more_online_13bfa}
                </p>
              )}
            </div>
          </Panel>
          <Panel
            title={copy.player_activity_2e166}
            eyebrow={
              online
                ? "Players across the current window"
                : "Retained player history · server offline"
            }
            className="c-4"
          >
            <div className="key">
              <span>
                <i style={{ background: "var(--c1)" }} />
                {copy.online_players_621c6}
              </span>
            </div>
            <div className="stat-bars">
              {Array.from({ length: 7 }, (_, i) => {
                const values = samples
                  .slice(
                    Math.floor((i * samples.length) / 7),
                    Math.floor(((i + 1) * samples.length) / 7),
                  )
                  .map((s) => s.players)
                  .filter((v): v is number => v !== null);
                const peak = values.length ? Math.max(...values) : 0;
                return (
                  <div key={i}>
                    <i
                      style={{
                        height: `${(peak / Math.max(1, ...samples.map((s) => s.players ?? 0))) * 120}px`,
                      }}
                    />
                    <span>{peak}</span>
                  </div>
                );
              })}
            </div>
            <p className="subtle">
              {copy.session_history_no_daily_totals_inferr_d5344}
            </p>
          </Panel>
          <Panel
            title={copy.memory_89c8a}
            eyebrow={`JVM allocation${heapMax ? ", " + bytes(heapMax).value + " " + bytes(heapMax).unit + " limit" : ""}`}
            className="c-4"
          >
            <div className="donut-wrap">
              <div className="donut">
                <svg viewBox="0 0 180 180" aria-hidden="true">
                  <circle className="track" cx="90" cy="90" r="64" />
                  {heapPct !== null && (
                    <circle
                      className="seg-arc"
                      cx="90"
                      cy="90"
                      r="64"
                      strokeDasharray={`${(Math.min(100, heapPct) / 100) * 402} 402`}
                      style={{ "--c": "var(--c1)" } as React.CSSProperties}
                    />
                  )}
                </svg>
                <div className="donut-center">
                  <b>{heap === null ? "—" : (heap / 2 ** 30).toFixed(1)}</b>
                  <span>{copy.gib_used_24de6}</span>
                </div>
              </div>
              <div className="legend">
                {[
                  ["Heap", heap, "var(--c1)"],
                  [
                    "Committed",
                    number(state.system.jvmHeapCommittedBytes),
                    "var(--c3)",
                  ],
                  [
                    "Free",
                    heapMax && heap !== null ? heapMax - heap : null,
                    "var(--c5)",
                  ],
                ].map(([label, value, c]) => (
                  <div className="legend-row" key={String(label)}>
                    <i style={{ "--c": c } as React.CSSProperties} />
                    {label}
                    <b>
                      {typeof value === "number"
                        ? (value / 2 ** 30).toFixed(1)
                        : "—"}
                    </b>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
          <Panel
            title={copy.worlds_8e4d9}
            eyebrow={`${chunks.toLocaleString()} loaded chunks · ${entityTotal.toLocaleString()} entities`}
            className="c-4"
          >
            <div className="bars-h">
              {state.worlds.map((w, i) => {
                const n = number(w.loadedChunks) ?? 0;
                return (
                  <div
                    className="bar-row"
                    key={str(w.name)}
                    style={
                      {
                        "--c": `var(--c${(i % 5) + 1})`,
                        "--i": i,
                      } as React.CSSProperties
                    }
                  >
                    <span title={str(w.name)}>
                      {str(w.name).replace("world_", "")}
                    </span>
                    <div className="track">
                      <div
                        className="fill"
                        style={{ width: `${(n / Math.max(1, chunks)) * 100}%` }}
                      />
                    </div>
                    <b>
                      {n}
                      {copy._chunks_9ff2c}
                    </b>
                  </div>
                );
              })}
            </div>
            {!state.worlds.length && (
              <div className="empty">
                <b>{copy.no_worlds_received_a1121}</b>
                <p>{copy.world_telemetry_appears_when_paper_con_33d29}</p>
              </div>
            )}
            <p className="subtle" style={{ marginTop: 18 }}>
              {copy.disk_size_is_not_reported_by_this_serv_ef08f}
            </p>
          </Panel>
        </div>
      </>
      <div className="overview-bottom">
        <ConsoleView mini />
        <div className="support-stack">
          <Panel
            title={copy.activity_81c0d}
            eyebrow={copy.joins_saves_and_warnings_79f90}
          >
            <div className="feed">
              {events.map((e) => (
                <div className="feed-row" key={e.id}>
                  <span
                    className={`feed-ic ${e.kind === "join" ? "ok" : e.kind === "error" ? "bad" : "pri"}`}
                  >
                    <Icon
                      name={
                        e.kind === "error"
                          ? "alert"
                          : e.kind === "join"
                            ? "players"
                            : "clock"
                      }
                    />
                  </span>
                  <p>{e.message}</p>
                  <time>
                    {relative(
                      state.console.find((l) => l.id === e.id)?.capturedAt,
                      now,
                    )}
                  </time>
                </div>
              ))}
              {!events.length && (
                <div className="empty">
                  <b>{copy.nothing_yet_76eb7}</b>
                  <p>{copy.joins_saves_and_warnings_show_up_here_8b036}</p>
                </div>
              )}
            </div>
          </Panel>
          <Panel
            title={copy.up_next_567bf}
            eyebrow={copy.backups_and_server_maintenance_758e0}
          >
            <div className="next">
              <button
                className="next-row next-button"
                onClick={() => navigate("Backups")}
              >
                <span className="feed-ic pri">
                  <Icon name="backups" />
                </span>
                <div>
                  <b>{copy.backups_530cc}</b>
                  <small>{copy.check_local_and_offsite_copies_ecf6a}</small>
                </div>
                <span className="when">{copy.open_cf9b7}</span>
              </button>
              <button
                className="next-row next-button"
                onClick={() => navigate("Schedules")}
              >
                <span className="feed-ic warn">
                  <Icon name="clock" />
                </span>
                <div>
                  <b>{copy.restart_schedule_d7561}</b>
                  <small>{copy.view_the_host_maintenance_policy_043e9}</small>
                </div>
                <span className="when">{copy.view_69bd4}</span>
              </button>
            </div>
          </Panel>
        </div>
      </div>
      <ActionReview prepared={prepared} onClose={() => setPrepared(null)} />
    </>
  );
}

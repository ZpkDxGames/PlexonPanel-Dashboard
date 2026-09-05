"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { sendDashboardAction, type ActionCompletion } from "../lib/data-source";
import {
  diagnostics,
  number,
  str,
  type ControlState,
  type JsonMap,
  type Sample,
} from "../lib/control-state";
export interface ViewProps {
  state: ControlState;
  can: (action: string, kind?: "PAPER" | "HOST") => boolean;
  run: (
    action: string,
    parameters: JsonMap,
    kind?: "PAPER" | "HOST",
  ) => Promise<ActionCompletion>;
  notice: (message: string) => void;
  connected: boolean;
  setUnsaved?: (dirty: boolean) => void;
}
export function bytes(value: unknown): string {
  const n = number(value);
  if (n === null) return "Unavailable";
  if (n === 0) return "0 B";
  const unit = Math.min(4, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** unit).toFixed(unit ? 1 : 0)} ${["B", "KiB", "MiB", "GiB", "TiB"][unit]}`;
}
export function metric(value: unknown, suffix = "", digits = 1): string {
  const n = number(value);
  return n === null ? "—" : `${n.toFixed(digits)}${suffix}`;
}
export function time(value: unknown): string {
  const date =
    typeof value === "number"
      ? new Date(value * 1000)
      : new Date(str(value, ""));
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "—";
}
export function duration(value: unknown): string {
  const n = number(value);
  if (n === null) return "—";
  const minutes = Math.floor(n / 60000);
  return minutes < 60
    ? `${minutes}m`
    : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
export function Badge({
  children,
  tone = "quiet",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`cr-badge ${tone}`}>{children}</span>;
}
export function Panel({
  title,
  aside,
  children,
  className = "",
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`cr-panel ${className}`}>
      <div className="cr-panel-head">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="cr-empty">
      <span className="cr-empty-mark" aria-hidden>
        ◇
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
export function ActionButton({
  children,
  onClick,
  danger = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => Promise<unknown>;
  danger?: boolean;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={danger ? "cr-button danger" : "cr-button"}
      disabled={busy || disabled}
      onClick={() => {
        setBusy(true);
        void onClick()
          .catch(() => {})
          .finally(() => setBusy(false));
      }}
    >
      {busy ? "Working…" : children}
    </button>
  );
}
export function useQuery(
  action: string,
  parameters: JsonMap,
  enabled: boolean,
  kind?: "PAPER" | "HOST",
) {
  const [data, setData] = useState<JsonMap>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  const key = JSON.stringify(parameters);
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    void Promise.resolve()
      .then(() => {
        if (current) {
          setBusy(true);
          setError("");
        }
        return sendDashboardAction(action, JSON.parse(key) as JsonMap, kind);
      })
      .then((result) => {
        if (current) setData(result.data);
      })
      .catch((e) => {
        if (current)
          setError(e instanceof Error ? e.message : "Request failed");
      })
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [action, key, enabled, kind, revision]);
  return {
    data,
    error,
    busy,
    refresh: useCallback(() => setRevision((r) => r + 1), []),
  };
}
function Stat({
  label,
  value,
  detail,
  tone = "",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: string;
}) {
  return (
    <div className={`cr-stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
export function Chart({
  history,
  field,
  label,
  unit = "",
  windowMinutes = 5,
}: {
  history: Sample[];
  field: keyof Omit<Sample, "at">;
  label: string;
  unit?: string;
  windowMinutes?: number;
}) {
  const end = history.at(-1)?.at ?? 0;
  const points = history.filter((p) => p.at >= end - windowMinutes * 60000);
  const values = points
    .map((p) => p[field])
    .filter((n): n is number => n !== null);
  const min = values.length ? Math.min(...values) : 0,
    max = values.length ? Math.max(...values) : 1,
    avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const lower = Math.max(0, min - (max - min || 1) * 0.1),
    upper = max + (max - min || 1) * 0.1;
  const start = points[0]?.at ?? end;
  let path = "";
  let gap = true;
  for (const point of points) {
    const n = point[field];
    if (n === null) {
      gap = true;
      continue;
    }
    const x = 10 + ((point.at - start) / Math.max(1, end - start)) * 680,
      y = 160 - ((n - lower) / Math.max(0.01, upper - lower)) * 140;
    path += `${gap ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)} `;
    gap = false;
  }
  return (
    <Panel title={label} aside={<Badge>{windowMinutes} minutes</Badge>}>
      <div className="cr-chart-summary">
        <strong>
          {values.length
            ? `${values.at(-1)!.toFixed(1)}${unit}`
            : "Unavailable"}
        </strong>
        <span>
          Min {values.length ? min.toFixed(1) : "—"} · Avg{" "}
          {values.length ? avg.toFixed(1) : "—"} · Max{" "}
          {values.length ? max.toFixed(1) : "—"}
        </span>
      </div>
      {values.length ? (
        <svg
          className="cr-chart"
          viewBox="0 0 700 180"
          role="img"
          aria-label={`${label}: current ${values.at(-1)?.toFixed(1)}, minimum ${min.toFixed(1)}, maximum ${max.toFixed(1)}`}
        >
          <path d="M10 20H690 M10 90H690 M10 160H690" className="cr-gridline" />
          <path d={path} className="cr-trend" />
        </svg>
      ) : (
        <Empty title="Waiting for samples">
          Keep this browser open to build a rolling history.
        </Empty>
      )}
      <div className="cr-chart-foot">
        <span>
          {points.length ? new Date(start).toLocaleTimeString() : "No data"}
        </span>
        <span>Browser session history</span>
        <span>{points.length ? new Date(end).toLocaleTimeString() : "—"}</span>
      </div>
    </Panel>
  );
}
export function OverviewView({ state, ...props }: ViewProps) {
  const system = state.ready?.agents.host ? state.hostSystem : state.system,
    tps = Array.isArray(state.server.tps) ? state.server.tps[0] : null,
    warnings = state.console
      .filter((l) => l.level === "WARN" || l.level === "ERROR")
      .slice(-5)
      .reverse();
  return (
    <>
      <div className="cr-stat-grid">
        <Stat
          label="TPS"
          value={metric(tps, "", 2)}
          detail="1 minute average"
          tone={number(tps)! >= 19 ? "healthy" : ""}
        />
        <Stat
          label="MSPT"
          value={metric(state.server.averageTickMillis, " ms")}
          detail="Average tick time"
        />
        <Stat
          label="Players"
          value={
            number(state.server.onlinePlayers) === null
              ? "—"
              : `${state.server.onlinePlayers} / ${state.server.maximumPlayers ?? "—"}`
          }
          detail="Current Paper session"
        />
        <Stat
          label="Uptime"
          value={duration(state.system.processUptimeMillis)}
          detail="Paper process"
        />
      </div>
      <div className="cr-two">
        <Chart history={state.history} field="tps" label="Server performance" />
        <Panel title="Resources" aside={<Badge>Live</Badge>}>
          <Resource
            label="Host CPU"
            value={metric(system.hostCpuPercent, "%")}
            percent={number(system.hostCpuPercent)}
            detail={`Paper process: ${metric(state.system.processCpuPercent, "%")}`}
          />
          <Resource
            label="Host memory"
            value={bytes(system.physicalMemoryUsedBytes)}
            percent={ratio(
              system.physicalMemoryUsedBytes,
              system.physicalMemoryTotalBytes,
            )}
            detail={`${bytes(system.physicalMemoryAvailableBytes)} available · ${bytes(system.physicalMemoryTotalBytes)} total`}
          />
          <Resource
            label="JVM heap"
            value={bytes(state.system.jvmHeapUsedBytes)}
            percent={ratio(
              state.system.jvmHeapUsedBytes,
              state.system.jvmHeapMaximumBytes,
            )}
            detail={`${bytes(state.system.jvmHeapMaximumBytes)} maximum`}
          />
          <Resource
            label="Server filesystem"
            value={bytes(system.diskUsedBytes)}
            percent={number(system.diskUsedPercent)}
            detail={`${bytes(system.diskUsableBytes)} available`}
          />
        </Panel>
      </div>
      <div className="cr-two">
        <Panel title="World activity">
          {state.worlds.length ? (
            <WorldTable worlds={state.worlds} />
          ) : (
            <Empty title="No world snapshot yet" />
          )}
        </Panel>
        <Panel title="Recent warnings">
          {warnings.length ? (
            <div className="cr-events">
              {warnings.map((line, i) => (
                <div key={`${line.fingerprint}-${i}`}>
                  <Badge tone="amber">{str(line.level)}</Badge>
                  <p>{str(line.content)}</p>
                  <small>{time(line.capturedAt)}</small>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="No warnings in this browser session">
              New warnings appear here when error streaming is enabled.
            </Empty>
          )}
        </Panel>
      </div>
      <Panel title="Agent connections">
        <div className="cr-agent-row">
          <Agent
            name="Paper agent"
            online={Boolean(state.ready?.agents.paper)}
            detail={state.ready?.server.pluginVersion ?? "Waiting for identity"}
          />
          <Agent
            name="Host companion"
            online={Boolean(state.ready?.agents.host)}
            detail={
              state.ready?.agents.hostInstalled
                ? (state.ready.server.hostVersion ?? "Disconnected")
                : "Not installed"
            }
          />
          <button
            className="cr-button"
            onClick={() =>
              void navigator.clipboard
                .writeText(diagnostics(state))
                .then(() => props.notice("Safe diagnostics copied."))
            }
          >
            Copy diagnostics
          </button>
        </div>
      </Panel>
    </>
  );
}
export function ratio(a: unknown, b: unknown) {
  const x = number(a),
    y = number(b);
  return x !== null && y !== null && y > 0 ? (x / y) * 100 : null;
}
function Resource({
  label,
  value,
  percent,
  detail,
}: {
  label: string;
  value: string;
  percent: number | null;
  detail: string;
}) {
  return (
    <div className="cr-resource">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="cr-meter" aria-hidden>
        <i style={{ width: `${Math.max(0, Math.min(100, percent ?? 0))}%` }} />
      </div>
      <small>{detail}</small>
    </div>
  );
}
export function Agent({
  name,
  online,
  detail,
}: {
  name: string;
  online: boolean;
  detail: string;
}) {
  return (
    <div className="cr-agent">
      <span className={`cr-dot ${online ? "online" : ""}`} />
      <div>
        <strong>{name}</strong>
        <small>{detail}</small>
      </div>
      <Badge tone={online ? "green" : "quiet"}>
        {online ? "Connected" : "Disconnected"}
      </Badge>
    </div>
  );
}
function WorldTable({ worlds }: { worlds: JsonMap[] }) {
  return (
    <div className="cr-table-wrap">
      <table>
        <thead>
          <tr>
            <th>World</th>
            <th>Chunks</th>
            <th>Entities</th>
            <th>Players</th>
          </tr>
        </thead>
        <tbody>
          {worlds.map((w) => (
            <tr key={str(w.name)}>
              <td>{str(w.name)}</td>
              <td>{String(w.loadedChunks ?? "—")}</td>
              <td>{String(w.entities ?? "—")}</td>
              <td>{String(w.players ?? "—")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function PerformanceView(props: ViewProps) {
  const [windowMinutes, setWindow] = useState(5),
    s = props.state;
  return (
    <>
      <div className="cr-toolbar">
        <p>Rolling samples stay in this browser for up to 30 minutes.</p>
        <label>
          Window
          <select
            value={windowMinutes}
            onChange={(e) => setWindow(Number(e.target.value))}
          >
            {[1, 5, 15, 30].map((n) => (
              <option key={n} value={n}>
                {n} minutes
              </option>
            ))}
          </select>
        </label>
        <button
          className="cr-button"
          onClick={() =>
            void navigator.clipboard
              .writeText(diagnostics(s))
              .then(() => props.notice("Safe diagnostics copied."))
          }
        >
          Copy diagnostics
        </button>
      </div>
      <div className="cr-two">
        {(
          [
            ["tps", "TPS", ""],
            ["mspt", "Tick time", " ms"],
            ["hostCpu", "Host CPU", "%"],
            ["processCpu", "Paper process CPU", "%"],
          ] as const
        ).map(([field, label, unit]) => (
          <Chart
            key={field}
            history={s.history}
            field={field}
            label={label}
            unit={unit}
            windowMinutes={windowMinutes}
          />
        ))}
      </div>
      <Panel title="Tick sample statistics">
        <div className="cr-stat-grid">
          <Stat
            label="Minimum"
            value={metric(s.server.minimumSampleTickMillis, " ms")}
            detail="Recent Paper tick sample"
          />
          <Stat
            label="Average"
            value={metric(s.server.averageTickMillis, " ms")}
            detail="Paper rolling tick time"
          />
          <Stat
            label="95th percentile"
            value={metric(s.server.p95TickMillis, " ms")}
            detail="Recent Paper tick sample"
          />
          <Stat
            label="Maximum"
            value={metric(s.server.maximumSampleTickMillis, " ms")}
            detail="Recent Paper tick sample"
          />
        </div>
      </Panel>
      <Panel title="Memory and garbage collection">
        <div className="cr-stat-grid">
          <Stat
            label="Heap used"
            value={bytes(s.system.jvmHeapUsedBytes)}
            detail={`Committed ${bytes(s.system.jvmHeapCommittedBytes)}`}
          />
          <Stat
            label="Non-heap"
            value={bytes(s.system.jvmNonHeapBytes)}
            detail={`Direct buffers ${bytes(s.system.directBufferBytes)}`}
          />
          <Stat
            label="Process RSS"
            value={bytes(s.system.processRssBytes)}
            detail={`Swap used ${bytes(s.system.swapUsedBytes)}`}
          />
          <Stat
            label="GC pauses"
            value={metric(s.system.gcPauseTotalMillis, " ms", 0)}
            detail={`${s.system.gcCollections ?? "—"} collections since start`}
          />
        </div>
      </Panel>
      <Panel title="Linux load averages">
        <div className="cr-stat-grid">
          {[1, 5, 15].map((minutes) => (
            <Stat
              key={minutes}
              label={`${minutes} minute${minutes > 1 ? "s" : ""}`}
              value={metric(
                (s.ready?.agents.host ? s.hostSystem : s.system)[
                  `loadAverage${minutes}m`
                ],
                "",
                2,
              )}
              detail="Runnable and uninterruptible tasks"
            />
          ))}
        </div>
      </Panel>
      <Panel title="Worlds">
        <WorldTable worlds={s.worlds} />
      </Panel>
    </>
  );
}
export function PlayersView(props: ViewProps) {
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string | null>(null);
  const players = props.state.players.filter((p) =>
      str(p.name).toLowerCase().includes(search.toLowerCase()),
    ),
    player = props.state.players.find((p) => p.uuid === selected);
  return (
    <>
      <div className="cr-toolbar">
        <label className="cr-search">
          Find a player
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search username"
          />
        </label>
        <Badge>{props.state.players.length} online</Badge>
      </div>
      <Panel title="Online players">
        {players.length ? (
          <div className="cr-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>World</th>
                  <th>Ping</th>
                  <th>Game mode</th>
                  <th>Session</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={str(p.uuid)}>
                    <td>
                      <div className="cr-person">
                        <span className="cr-avatar">
                          {str(p.name).slice(0, 2)}
                        </span>
                        <strong>{str(p.name)}</strong>
                      </div>
                    </td>
                    <td>{str(p.world)}</td>
                    <td>{metric(p.pingMillis, " ms", 0)}</td>
                    <td>{str(p.gameMode).toLowerCase()}</td>
                    <td>{duration(p.onlineDurationMillis)}</td>
                    <td>
                      <button
                        className="cr-button"
                        onClick={() => setSelected(str(p.uuid))}
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title={search ? "No matching players" : "No players online"} />
        )}
      </Panel>
      {player && (
        <PlayerDrawer
          key={selected}
          {...props}
          player={player}
          close={() => setSelected(null)}
        />
      )}
    </>
  );
}
function PlayerDrawer({
  player,
  close,
  ...props
}: ViewProps & { player: JsonMap; close: () => void }) {
  const [tab, setTab] = useState("Overview"),
    [message, setMessage] = useState(""),
    [reason, setReason] = useState(""),
    [gameMode, setGameMode] = useState("SURVIVAL"),
    [world, setWorld] = useState(str(player.world, "")),
    [coordinates, setCoordinates] = useState({ x: "", y: "", z: "" });
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const base = { playerId: player.uuid };
  return (
    <dialog
      className="cr-drawer"
      ref={ref}
      onCancel={close}
      aria-labelledby="player-title"
    >
      <div className="cr-panel-head">
        <div>
          <small>Player management</small>
          <h2 id="player-title">{str(player.name)}</h2>
        </div>
        <button
          className="cr-button"
          onClick={close}
          aria-label="Close player details"
        >
          ×
        </button>
      </div>
      <div className="cr-tabs">
        {["Overview", "Actions", "Moderation"].map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === "Overview" ? (
        <>
          <dl className="cr-details">
            {[
              ["UUID", player.uuid],
              ["World", player.world],
              [
                "Health",
                `${player.health ?? "—"} / ${player.maximumHealth ?? "—"}`,
              ],
              ["Food", player.food],
              ["XP level", player.experienceLevel],
              ["Online", duration(player.onlineDurationMillis)],
              [
                "Position",
                player.position
                  ? JSON.stringify(player.position)
                  : "Not shared",
              ],
              ["IP address", player.address ?? "Not shared"],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <dt>{String(k)}</dt>
                <dd>{String(v ?? "—")}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : tab === "Actions" ? (
        <div className="cr-form">
          {props.can("player.message") && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void props
                  .run("player.message", { ...base, message })
                  .then(() => setMessage(""))
                  .catch(() => {});
              }}
            >
              <label>
                Private message
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                  required
                />
              </label>
              <button className="cr-button">Send message</button>
            </form>
          )}
          <div className="cr-actions">
            {["heal", "feed"]
              .filter((a) => props.can(`player.${a}`))
              .map((a) => (
                <ActionButton
                  key={a}
                  onClick={() => props.run(`player.${a}`, base)}
                >
                  {a === "heal" ? "Heal" : "Feed"}
                </ActionButton>
              ))}
          </div>
          {props.can("player.gamemode") && (
            <div className="cr-form">
              <label>
                Game mode
                <select
                  value={gameMode}
                  onChange={(e) => setGameMode(e.target.value)}
                >
                  {["SURVIVAL", "CREATIVE", "ADVENTURE", "SPECTATOR"].map(
                    (g) => (
                      <option key={g}>{g}</option>
                    ),
                  )}
                </select>
              </label>
              <ActionButton
                onClick={() =>
                  props.run("player.gamemode", { ...base, gameMode })
                }
              >
                Set game mode
              </ActionButton>
            </div>
          )}
          {props.can("player.teleport") && (
            <div className="cr-form">
              <label>
                Destination world
                <input
                  value={world}
                  onChange={(e) => setWorld(e.target.value)}
                />
              </label>
              <div className="cr-three">
                {(["x", "y", "z"] as const).map((k) => (
                  <label key={k}>
                    {k.toUpperCase()}
                    <input
                      type="number"
                      value={coordinates[k]}
                      onChange={(e) =>
                        setCoordinates({ ...coordinates, [k]: e.target.value })
                      }
                    />
                  </label>
                ))}
              </div>
              <ActionButton
                disabled={Object.values(coordinates).some((v) => v === "")}
                onClick={() =>
                  props.run("player.teleport", {
                    ...base,
                    world,
                    x: Number(coordinates.x),
                    y: Number(coordinates.y),
                    z: Number(coordinates.z),
                  })
                }
              >
                Teleport
              </ActionButton>
            </div>
          )}
        </div>
      ) : (
        <div className="cr-form">
          <label>
            Moderation reason
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={2000}
            />
          </label>
          <div className="cr-actions">
            {[
              "kick",
              "ban",
              "unban",
              "whitelist.add",
              "whitelist.remove",
              "kill",
              "op",
              "deop",
            ]
              .filter((a) => props.can(`player.${a}`))
              .map((a) => (
                <ActionButton
                  key={a}
                  danger={["ban", "kill", "op", "deop"].includes(a)}
                  onClick={() => props.run(`player.${a}`, { ...base, reason })}
                >
                  {a.replaceAll(".", " ")}
                </ActionButton>
              ))}
          </div>
          <p className="cr-hint">
            Every operation is checked and audited locally. Operator changes
            require an Owner device.
          </p>
        </div>
      )}
    </dialog>
  );
}
export function ConsoleView(props: ViewProps) {
  const [search, setSearch] = useState(""),
    [level, setLevel] = useState("ALL"),
    [paused, setPaused] = useState<JsonMap[] | null>(null),
    [autoScroll, setAuto] = useState(true),
    [clearAt, setClear] = useState(0),
    [command, setCommand] = useState(""),
    [output, setOutput] = useState<string[]>([]),
    [history, setHistory] = useState<string[]>([]),
    [historyIndex, setHistoryIndex] = useState(-1);
  const viewport = useRef<HTMLDivElement>(null);
  const entries = (paused ?? props.state.console)
    .filter(
      (l) =>
        (!clearAt || Date.parse(str(l.capturedAt, "")) > clearAt) &&
        (level === "ALL" || l.level === level) &&
        str(l.content).toLowerCase().includes(search.toLowerCase()),
    )
    .slice(-300);
  useEffect(() => {
    if (autoScroll && viewport.current)
      viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [entries.length, props.state.console, autoScroll]);
  return (
    <>
      <div className="cr-toolbar">
        <label className="cr-search">
          Search output
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label>
          Level
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            {["ALL", "INFO", "WARN", "ERROR"].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <button
          className="cr-button"
          onClick={() => setPaused(paused ? null : [...props.state.console])}
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          className="cr-button"
          aria-pressed={autoScroll}
          onClick={() => setAuto(!autoScroll)}
        >
          Auto-scroll {autoScroll ? "on" : "off"}
        </button>
        <button className="cr-button" onClick={() => setClear(Date.now())}>
          Clear view
        </button>
      </div>
      <Panel
        title="Live console"
        aside={
          <Badge tone={props.connected ? "green" : "amber"}>
            {props.connected ? "Connected" : "Reconnecting"}
          </Badge>
        }
      >
        <div className="cr-console" ref={viewport} role="log" aria-live="off">
          {entries.length ? (
            entries.map((l, i) => (
              <div
                className={`cr-console-line ${str(l.level).toLowerCase()}`}
                key={`${l.fingerprint}-${i}`}
              >
                <time>{time(l.capturedAt)}</time>
                <span>{str(l.level)}</span>
                <code>
                  {str(l.content).replace(
                    new RegExp(
                      String.fromCharCode(27) + "\\[[0-?]*[ -/]*[@-~]",
                      "g",
                    ),
                    "",
                  )}
                </code>
                <button
                  title="Copy line"
                  aria-label="Copy console line"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(str(l.content))
                      .then(() => props.notice("Line copied."))
                  }
                >
                  Copy
                </button>
              </div>
            ))
          ) : (
            <Empty title="No console lines to display">
              Full console streaming is disabled on fresh installs. Warning and
              error access depends on your device scope.
            </Empty>
          )}
        </div>
        {props.can("console.execute") ? (
          <form
            className="cr-command"
            onSubmit={(e) => {
              e.preventDefault();
              const value = command.trim();
              if (!value) return;
              setCommand("");
              void props
                .run("console.execute", { command: value, confirmed: true })
                .then((r) => {
                  setOutput(
                    Array.isArray(r.data.output)
                      ? r.data.output.map(String)
                      : [],
                  );
                  if (
                    /^(?:tps|mspt|list|version|plugins|spark (?:tps|health))$/i.test(
                      value.replace(/^\//, ""),
                    )
                  )
                    setHistory((h) =>
                      [value, ...h.filter((c) => c !== value)].slice(0, 20),
                    );
                  setHistoryIndex(-1);
                })
                .catch(() => {});
            }}
          >
            <span aria-hidden>›</span>
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  const next = Math.min(history.length - 1, historyIndex + 1);
                  setHistoryIndex(next);
                  setCommand(history[next] ?? "");
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  const next = Math.max(-1, historyIndex - 1);
                  setHistoryIndex(next);
                  setCommand(history[next] ?? "");
                }
              }}
              autoComplete="off"
              spellCheck={false}
              maxLength={512}
              placeholder="Enter a locally allowlisted command"
              aria-label="Console command"
            />
            <button className="cr-button primary" disabled={!command.trim()}>
              Run
            </button>
          </form>
        ) : (
          <p className="cr-hint cr-pad">
            Read-only console. Command execution requires a locally enabled
            capability and device scope.
          </p>
        )}
      </Panel>
      {output.length > 0 && (
        <Panel title="Latest command result">
          <pre className="cr-output">{output.join("\n")}</pre>
        </Panel>
      )}
      <p className="cr-hint">
        Showing at most 300 rows from a bounded 600-line session buffer. Command
        history is memory-only and excludes likely secret-bearing commands.
      </p>
    </>
  );
}
export function ChatView(props: ViewProps) {
  const [message, setMessage] = useState(""),
    [mini, setMini] = useState(false);
  return (
    <Panel title="Global chat" aside={<Badge>Public channel</Badge>}>
      <div className="cr-chat">
        {props.state.chat.length ? (
          props.state.chat.map((m, i) => (
            <div className="cr-chat-message" key={`${m.messageId}-${i}`}>
              <span className="cr-avatar">{str(m.playerName).slice(0, 2)}</span>
              <div>
                <strong>
                  {str(m.playerName)} <small>{time(m.capturedAt)}</small>
                </strong>
                <p>{str(m.content)}</p>
              </div>
            </div>
          ))
        ) : (
          <Empty title="No global chat messages yet">
            Vanilla and PlexonChats global messages appear when locally enabled.
          </Empty>
        )}
      </div>
      {props.can("chat.global.send") ? (
        <form
          className="cr-form cr-pad"
          onSubmit={(e) => {
            e.preventDefault();
            void props
              .run("chat.global.send", { message, miniMessage: mini })
              .then(() => setMessage(""))
              .catch(() => {});
          }}
        >
          <label>
            Message as {props.state.ready?.device.name}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              rows={3}
              required
            />
          </label>
          <div className="cr-actions">
            {props.state.ready?.device.scopes.includes(
              "chat.send.minimessage",
            ) &&
              props.state.ready.server.capabilities[
                "chat.send.minimessage"
              ] && (
                <label className="cr-check">
                  <input
                    type="checkbox"
                    checked={mini}
                    onChange={(e) => setMini(e.target.checked)}
                  />
                  MiniMessage
                </label>
              )}
            <button className="cr-button primary">Send to global chat</button>
          </div>
        </form>
      ) : (
        <p className="cr-hint cr-pad">
          Sending is disabled for this device or in local policy.
        </p>
      )}
    </Panel>
  );
}
export function PluginsView(props: ViewProps) {
  const [search, setSearch] = useState("");
  return (
    <>
      <div className="cr-toolbar">
        <label className="cr-search">
          Find a plugin
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search installed plugins"
          />
        </label>
        <Badge>{props.state.plugins.length} installed</Badge>
      </div>
      <div className="cr-plugin-grid">
        {props.state.plugins
          .filter((p) =>
            str(p.name).toLowerCase().includes(search.toLowerCase()),
          )
          .map((p) => (
            <Panel
              key={str(p.name)}
              title={str(p.name)}
              aside={
                <Badge tone={p.enabled ? "green" : "quiet"}>
                  {p.enabled ? "Enabled" : "Disabled"}
                </Badge>
              }
            >
              <div className="cr-pad">
                <strong className="cr-plugin-version">{str(p.version)}</strong>
                <p>
                  {Array.isArray(p.authors)
                    ? p.authors.join(", ")
                    : "Author not declared"}
                </p>
                <small>
                  Dependencies:{" "}
                  {Array.isArray(p.dependencies) && p.dependencies.length
                    ? p.dependencies.join(", ")
                    : "None declared"}
                </small>
                <small>
                  Soft dependencies:{" "}
                  {Array.isArray(p.softDependencies) &&
                  p.softDependencies.length
                    ? p.softDependencies.join(", ")
                    : "None declared"}
                </small>
                <div className="cr-actions">
                  {props.can("plugin.command.reload") && (
                    <ActionButton
                      onClick={() =>
                        props.run("plugin.command.reload", {
                          plugin: p.name,
                          confirmed: true,
                        })
                      }
                    >
                      Run configured reload
                    </ActionButton>
                  )}
                  {typeof p.website === "string" &&
                    /^https:\/\//.test(p.website) && (
                      <a
                        className="cr-button"
                        href={p.website}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Project website ↗
                      </a>
                    )}
                </div>
                <p className="cr-hint">
                  Configuration folder: plugins/{str(p.name)}. Use Files when
                  authorized.
                </p>
              </div>
            </Panel>
          ))}
      </div>
      {!props.state.plugins.length && (
        <Empty title="Waiting for plugin inventory" />
      )}
      <p className="cr-hint">
        Reload commands must be configured locally and pass the console
        allowlist. Generic hot unloading is not supported.
      </p>
    </>
  );
}

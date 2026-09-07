"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionButton,
  Badge,
  Empty,
  Panel,
  duration,
  metric,
  time,
  type ViewProps,
} from "./control-views";
import { number, records, str, type JsonMap } from "../lib/control-state";
import { sendDashboardAction } from "../lib/data-source";

type PlayerSort = "name" | "ping" | "session" | "world";
type PluginSort = "name" | "version";

function lower(value: unknown) {
  return str(value, "").toLowerCase();
}

function Timestamp({ value }: { value: unknown }) {
  const date = new Date(str(value, ""));
  const valid = Number.isFinite(date.getTime());
  const iso = valid ? date.toISOString() : undefined;
  return (
    <time dateTime={iso} title={iso ? `UTC: ${iso}` : undefined}>
      {time(value)}
    </time>
  );
}

function downloadText(filename: string, body: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function PlayersView21(props: ViewProps) {
  const [tab, setTab] = useState<"online" | "history">("online");
  const [search, setSearch] = useState("");
  const [worldFilter, setWorldFilter] = useState("ALL");
  const [sort, setSort] = useState<PlayerSort>("name");
  const [selected, setSelected] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyStatus, setHistoryStatus] = useState("ALL");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historyEntries, setHistoryEntries] = useState<JsonMap[]>([]);
  const [historyCursor, setHistoryCursor] = useState("");
  const [historyMore, setHistoryMore] = useState(false);
  const [historyBounded, setHistoryBounded] = useState(false);
  const [historyCapturedAt, setHistoryCapturedAt] = useState("");
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyPolicyDisabled, setHistoryPolicyDisabled] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<string | null>(null);
  const ready = props.state.ready;
  const historyScope = Boolean(
    ready?.device.scopes.includes("players.history.view"),
  );
  const historyCapabilityKnown = Boolean(
    ready &&
      Object.prototype.hasOwnProperty.call(
        ready.server.paperCapabilities,
        "players.history.view",
      ),
  );
  const historyCapability =
    ready?.server.paperCapabilities["players.history.view"] === true;
  const paperOnline = Boolean(ready?.agents.paper);
  const historyTabAvailable = historyScope && historyCapability;
  const worlds = useMemo(
    () =>
      Array.from(
        new Set(
          props.state.players
            .map((player) => str(player.world, ""))
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [props.state.players],
  );
  const players = useMemo(() => {
    const filtered = props.state.players.filter((player) => {
      const matchesSearch =
        lower(player.name).includes(search.toLowerCase()) ||
        lower(player.uuid).includes(search.toLowerCase());
      const matchesWorld =
        worldFilter === "ALL" || str(player.world) === worldFilter;
      return matchesSearch && matchesWorld;
    });
    return [...filtered].sort((a, b) => {
      if (sort === "ping")
        return (number(a.pingMillis) ?? Number.MAX_SAFE_INTEGER) -
          (number(b.pingMillis) ?? Number.MAX_SAFE_INTEGER);
      if (sort === "session")
        return (number(b.onlineDurationMillis) ?? 0) -
          (number(a.onlineDurationMillis) ?? 0);
      if (sort === "world")
        return str(a.world).localeCompare(str(b.world)) ||
          str(a.name).localeCompare(str(b.name));
      return str(a.name).localeCompare(str(b.name));
    });
  }, [props.state.players, search, worldFilter, sort]);
  const player = props.state.players.find((item) => item.uuid === selected);
  const historyRecord = historyEntries.find(
    (entry) => entry.eventId === selectedHistory,
  );

  const loadHistory = useCallback(
    async (append = false) => {
      if (!historyTabAvailable || !props.connected || !paperOnline) return;
      if (historyFrom && historyTo && historyFrom > historyTo) {
        setHistoryError("The From date must not be after the To date.");
        setHistoryLoaded(true);
        return;
      }
      setHistoryBusy(true);
      setHistoryError("");
      try {
        const parameters: JsonMap = {
          query: historyQuery.trim(),
          status: historyStatus,
          limit: 50,
        };
        if (historyFrom)
          parameters.from = new Date(`${historyFrom}T00:00:00`).toISOString();
        if (historyTo)
          parameters.to = new Date(`${historyTo}T23:59:59.999`).toISOString();
        if (append && historyCursor) parameters.cursor = historyCursor;
        const result = await sendDashboardAction(
          "players.history.list",
          parameters,
          "PAPER",
        );
        const data = result.data;
        if (data.historyEnabled !== true) {
          setHistoryPolicyDisabled(true);
          setHistoryEntries([]);
          setHistoryMore(false);
          setHistoryCursor("");
        } else {
          const entries = records(data.entries, 100);
          setHistoryPolicyDisabled(false);
          setHistoryEntries((current) =>
            (append ? [...current, ...entries] : entries).slice(0, 500),
          );
          setHistoryCursor(str(data.nextCursor, ""));
          setHistoryMore(data.hasMore === true);
          setHistoryBounded(data.boundedWindow === true);
          setHistoryCapturedAt(str(data.capturedAt, ""));
        }
        setHistoryLoaded(true);
      } catch (reason) {
        setHistoryError(
          reason instanceof Error
            ? reason.message
            : "The Paper agent could not read player history.",
        );
      } finally {
        setHistoryBusy(false);
      }
    }, [
      historyCursor,
      historyFrom,
      historyQuery,
      historyStatus,
      historyTabAvailable,
      historyTo,
      paperOnline,
      props.connected,
    ]);

  const historyUnavailable = !historyScope
    ? "This device grant does not include player history. Existing grants stay unchanged; pair a newly approved Moderator, Administrator, or Owner device to add it."
    : !historyCapabilityKnown
      ? "This Paper agent predates the player-history capability. Online players remain available; upgrade the agent to use history."
      : !historyCapability
        ? "Player history is disabled by local Paper policy. Enable player-history locally and restart or reload the agent before granting access."
        : "";

  return (
    <>
      <div className="cr-tabs cr21-player-tabs" aria-label="Player views">
        <button aria-pressed={tab === "online"} onClick={() => setTab("online")}>
          Online
        </button>
        {historyTabAvailable && (
          <button
            aria-pressed={tab === "history"}
            onClick={() => {
              setTab("history");
              if (!historyLoaded && !historyBusy) void loadHistory(false);
            }}
          >
            History
          </button>
        )}
      </div>

      {tab === "online" || !historyTabAvailable ? (
        <>
          <div className="cr21-filter-toolbar">
        <label className="cr-search">
          Search players
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Username or UUID"
          />
        </label>
        <label>
          World
          <select
            value={worldFilter}
            onChange={(event) => setWorldFilter(event.target.value)}
          >
            <option value="ALL">All worlds</option>
            {worlds.map((world) => (
              <option key={world}>{world}</option>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as PlayerSort)}
          >
            <option value="name">Name</option>
            <option value="ping">Ping</option>
            <option value="session">Session time</option>
            <option value="world">World</option>
          </select>
        </label>
        <Badge>{props.state.players.length} online</Badge>
        <button
          className="cr-button"
          disabled={refreshing || !props.can("players.snapshot.request")}
          onClick={() => {
            setRefreshing(true);
            void props
              .run("players.snapshot.request", {}, "PAPER")
              .finally(() => setRefreshing(false));
          }}
        >
          {refreshing ? "Requesting…" : "Refresh"}
        </button>
      </div>

          <Panel
            title="Online players"
            aside={
              <div className="cr21-panel-badges">
                <Badge>{players.length} shown</Badge>
                <Badge tone={props.connected && paperOnline ? "green" : "amber"}>
                  {!props.connected
                    ? "Reconnecting"
                    : !paperOnline
                      ? "Paper offline"
                      : props.state.pendingPlayerSnapshot
                        ? "Reconciling"
                        : "Live"}
                </Badge>
              </div>
            }
          >
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {players.map((item) => (
                  <tr key={str(item.uuid)}>
                    <td>
                      <div className="cr-person">
                        <span className="cr-avatar" aria-hidden>
                          {str(item.name).slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <strong>{str(item.name)}</strong>
                          <small>{str(item.uuid).slice(0, 8)}</small>
                        </div>
                      </div>
                    </td>
                    <td>{str(item.world)}</td>
                    <td>{metric(item.pingMillis, " ms", 0)}</td>
                    <td>{str(item.gameMode).toLowerCase()}</td>
                    <td>{duration(item.onlineDurationMillis)}</td>
                    <td>
                      <button
                        className="cr-button"
                        onClick={() => setSelected(str(item.uuid))}
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
          !props.connected ? (
            <Empty title="Roster unavailable while reconnecting">
              A fresh authoritative snapshot will replace the roster after the
              signed session reconnects.
            </Empty>
          ) : !paperOnline ? (
            <Empty title="Paper agent offline">
              Cached players are not shown as online. Reconnect Paper to load a
              current roster.
            </Empty>
          ) : props.state.pendingPlayerSnapshot ? (
            <Empty title="Loading the current roster">
              Multipart snapshot data is staged until Paper marks it complete.
            </Empty>
          ) : (
            <Empty
              title={
                search || worldFilter !== "ALL"
                  ? "No players match these filters"
                  : "No players online"
              }
            />
          )
        )}
      </Panel>

          {historyUnavailable && (
            <Panel title="Player history">
              <p className="cr-hint cr-pad">{historyUnavailable}</p>
            </Panel>
          )}
        </>
      ) : (
        <>
          <div className="cr21-filter-toolbar">
            <label className="cr-search">
              Search history
              <input
                value={historyQuery}
                maxLength={64}
                onChange={(event) => setHistoryQuery(event.target.value)}
                placeholder="Username or UUID"
              />
            </label>
            <label>
              Status
              <select
                value={historyStatus}
                onChange={(event) => setHistoryStatus(event.target.value)}
              >
                <option value="ALL">All observations</option>
                <option value="ONLINE">Joined</option>
                <option value="OFFLINE">Left</option>
              </select>
            </label>
            <label>
              From
              <input
                type="date"
                value={historyFrom}
                onChange={(event) => setHistoryFrom(event.target.value)}
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={historyTo}
                onChange={(event) => setHistoryTo(event.target.value)}
              />
            </label>
            <button
              className="cr-button"
              disabled={historyBusy || !props.connected || !paperOnline}
              onClick={() => void loadHistory(false)}
            >
              {historyBusy ? "Loading…" : "Search"}
            </button>
          </div>

          <Panel
            title="Paper-owned presence history"
            aside={
              historyCapturedAt ? (
                <Badge>Captured {time(historyCapturedAt)}</Badge>
              ) : undefined
            }
          >
            {!props.connected ? (
              <Empty title="History paused while reconnecting">
                History is queried directly from Paper and is not served from
                browser cache.
              </Empty>
            ) : !paperOnline ? (
              <Empty title="Paper agent offline">
                Reconnect Paper to query its local presence journal.
              </Empty>
            ) : historyPolicyDisabled ? (
              <Empty title="History disabled by local policy">
                No persistent journal is available. This setting cannot be
                enabled remotely.
              </Empty>
            ) : historyError ? (
              <Empty title="History query failed">
                {historyError} Check Paper diagnostics, then retry this bounded
                query.
              </Empty>
            ) : historyBusy && !historyLoaded ? (
              <Empty title="Loading player history" />
            ) : historyEntries.length ? (
              <>
                {historyBounded && (
                  <p className="cr21-bounded" role="status">
                    This result is bounded by retention or scan limits and may
                    not include every older observation.
                  </p>
                )}
                <div className="cr-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th>Observation</th>
                        <th>When</th>
                        <th>Duration</th>
                        <th>Termination</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyEntries.map((entry) => (
                        <tr key={str(entry.eventId)}>
                          <td>
                            <strong>{str(entry.name)}</strong>
                            <small className="cr21-block-id">
                              {str(entry.uuid).slice(0, 8)}
                            </small>
                          </td>
                          <td>{entry.state === "JOINED" ? "Joined" : "Left"}</td>
                          <td>
                            <Timestamp value={entry.observedAt} />
                          </td>
                          <td>{duration(entry.sessionDurationMillis)}</td>
                          <td>
                            {entry.termination === "UNKNOWN_DISCONNECT"
                              ? "Unknown disconnect"
                              : str(entry.termination).toLowerCase()}
                          </td>
                          <td>
                            <button
                              className="cr-button"
                              onClick={() => setSelectedHistory(str(entry.eventId))}
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {historyMore && (
                  <div className="cr21-load-more">
                    <button
                      className="cr-button"
                      disabled={historyBusy}
                      onClick={() => void loadHistory(true)}
                    >
                      {historyBusy ? "Loading…" : "Load older observations"}
                    </button>
                  </div>
                )}
              </>
            ) : historyLoaded ? (
              <Empty title="No matching history">
                Paper returned no presence observations for these bounded
                filters.
              </Empty>
            ) : (
              <Empty title="Loading player history" />
            )}
          </Panel>
        </>
      )}

      {player && (
        <PlayerDrawer21
          key={selected}
          {...props}
          player={player}
          previousSessions={historyEntries.filter(
            (entry) =>
              entry.uuid === player.uuid &&
              entry.state === "LEFT" &&
              entry.sessionId !== player.sessionId,
          )}
          historyAvailable={historyTabAvailable}
          close={() => setSelected(null)}
        />
      )}
      {historyRecord &&
        tab === "history" &&
        historyTabAvailable &&
        props.connected &&
        paperOnline && (
        <HistoryPlayerDrawer21
          entry={historyRecord}
          entries={historyEntries.filter(
            (entry) => entry.uuid === historyRecord.uuid,
          )}
          close={() => setSelectedHistory(null)}
        />
      )}
    </>
  );
}

export function HistoryPlayerDrawer21({
  entry,
  entries,
  close,
}: {
  entry: JsonMap;
  entries: JsonMap[];
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      className="cr-drawer cr21-player-drawer"
      ref={ref}
      onCancel={close}
      aria-labelledby="history-player-title"
    >
      <div className="cr-panel-head">
        <div>
          <small>Presence observation · read only</small>
          <h2 id="history-player-title">{str(entry.name)}</h2>
        </div>
        <button className="cr-button" onClick={close} aria-label="Close history details">
          ×
        </button>
      </div>
      <dl className="cr-details cr21-drawer-section">
        {[
          ["UUID", str(entry.uuid, "Unknown")],
          ["State", str(entry.state, "Unknown")],
          ["Observed", <Timestamp key="observed" value={entry.observedAt} />],
          [
            "Session started",
            <Timestamp key="started" value={entry.sessionStartedAt} />,
          ],
          [
            "Session ended",
            entry.sessionEndedAt ? (
              <Timestamp key="ended" value={entry.sessionEndedAt} />
            ) : (
              "Unknown"
            ),
          ],
          ["Duration", duration(entry.sessionDurationMillis)],
          ["Termination", str(entry.termination, "Unknown")],
          ["Session ID", str(entry.sessionId, "Unknown")],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <dt>{String(label)}</dt>
            <dd>{value ?? "Unknown"}</dd>
          </div>
        ))}
      </dl>
      <div className="cr21-drawer-section">
        <h3>Loaded observations for this player</h3>
        <ul className="cr21-session-list">
          {entries.slice(0, 12).map((item) => (
            <li key={str(item.eventId)}>
              <strong>{item.state === "JOINED" ? "Joined" : "Left"}</strong>
              <span>
                <Timestamp value={item.observedAt} />
              </span>
              <span>{duration(item.sessionDurationMillis)}</span>
            </li>
          ))}
        </ul>
        <p className="cr-hint">
          Offline history rows expose no player actions. Only observations in
          the currently loaded bounded result are shown here.
        </p>
      </div>
    </dialog>
  );
}

function PlayerDrawer21({
  player,
  previousSessions,
  historyAvailable,
  close,
  ...props
}: ViewProps & {
  player: JsonMap;
  previousSessions: JsonMap[];
  historyAvailable: boolean;
  close: () => void;
}) {
  const [tab, setTab] = useState("Overview");
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [gameMode, setGameMode] = useState(str(player.gameMode, "SURVIVAL"));
  const [world, setWorld] = useState(str(player.world, ""));
  const [coordinates, setCoordinates] = useState({ x: "", y: "", z: "" });
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);
  const base = { playerId: player.uuid };
  const permittedActions = [
    "message",
    "heal",
    "feed",
    "teleport",
    "gamemode",
    "kick",
    "ban",
    "unban",
    "whitelist.add",
    "whitelist.remove",
    "kill",
    "op",
    "deop",
  ].filter((action) => props.can(`player.${action}`));

  return (
    <dialog
      className="cr-drawer cr21-player-drawer"
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
        {["Overview", "Actions", "Moderation"].map((value) => (
          <button
            key={value}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {value}
          </button>
        ))}
      </div>

      {tab === "Overview" ? (
        <div className="cr21-drawer-section">
          <dl className="cr-details">
            {[
              ["UUID", player.uuid],
              ["World", player.world],
              ["Game mode", player.gameMode],
              ["Ping", metric(player.pingMillis, " ms", 0)],
              [
                "Health",
                `${player.health ?? "—"} / ${player.maximumHealth ?? "—"}`,
              ],
              ["Food", player.food],
              ["XP level", player.experienceLevel],
              ["Online", duration(player.onlineDurationMillis)],
              ["Session started", time(player.sessionStartedAt)],
              ["Session ID", player.sessionId],
              ...(typeof player.firstSeenAt === "string"
                ? [["First observed", time(player.firstSeenAt)]]
                : []),
              ...(typeof player.lastLoginAt === "string"
                ? [["Last login", time(player.lastLoginAt)]]
                : []),
              [
                "Position",
                player.position ? JSON.stringify(player.position) : "Not shared",
              ],
              ["IP address", player.address ?? "Not shared"],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt>{String(label)}</dt>
                <dd>{String(value ?? "—")}</dd>
              </div>
            ))}
          </dl>
          <p className="cr-hint">
            {permittedActions.length
              ? `${permittedActions.length} player actions are allowed for this device and current local policy.`
              : "This device has read-only access to player details."}
          </p>
          {historyAvailable && (
            <div className="cr21-drawer-section">
              <h3>Previous sessions</h3>
              {previousSessions.length ? (
                <ul className="cr21-session-list">
                  {previousSessions.slice(0, 12).map((session) => (
                    <li key={str(session.eventId)}>
                      <strong>{time(session.sessionStartedAt)}</strong>
                      <span>{time(session.sessionEndedAt)}</span>
                      <span>{duration(session.sessionDurationMillis)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="cr-hint">
                  Open the History tab to load bounded previous-session data
                  from Paper. History is never inferred from browser state.
                </p>
              )}
            </div>
          )}
        </div>
      ) : tab === "Actions" ? (
        <div className="cr-form cr21-drawer-section">
          {props.can("player.message") && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
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
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={2000}
                  required
                />
              </label>
              <button className="cr-button primary">Send message</button>
            </form>
          )}
          <div className="cr-actions">
            {["heal", "feed"]
              .filter((action) => props.can(`player.${action}`))
              .map((action) => (
                <ActionButton
                  key={action}
                  onClick={() => props.run(`player.${action}`, base)}
                >
                  {action === "heal" ? "Heal" : "Feed"}
                </ActionButton>
              ))}
          </div>
          {props.can("player.gamemode") && (
            <div className="cr-form">
              <label>
                Game mode
                <select
                  value={gameMode}
                  onChange={(event) => setGameMode(event.target.value)}
                >
                  {["SURVIVAL", "CREATIVE", "ADVENTURE", "SPECTATOR"].map(
                    (value) => (
                      <option key={value}>{value}</option>
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
                  onChange={(event) => setWorld(event.target.value)}
                />
              </label>
              <div className="cr-three">
                {(["x", "y", "z"] as const).map((key) => (
                  <label key={key}>
                    {key.toUpperCase()}
                    <input
                      type="number"
                      value={coordinates[key]}
                      onChange={(event) =>
                        setCoordinates({
                          ...coordinates,
                          [key]: event.target.value,
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <ActionButton
                disabled={Object.values(coordinates).some((value) => value === "")}
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
          {!permittedActions.some((action) =>
            ["message", "heal", "feed", "gamemode", "teleport"].includes(action),
          ) && (
            <Empty title="Player actions unavailable">
              The current device scope or local Paper policy does not allow
              direct player actions.
            </Empty>
          )}
        </div>
      ) : (
        <div className="cr-form cr21-drawer-section">
          <label>
            Moderation reason
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
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
              .filter((action) => props.can(`player.${action}`))
              .map((action) => (
                <ActionButton
                  key={action}
                  danger={["ban", "kill", "op", "deop"].includes(action)}
                  onClick={() =>
                    props.run(`player.${action}`, { ...base, reason })
                  }
                >
                  {action.replaceAll(".", " ")}
                </ActionButton>
              ))}
          </div>
          {!permittedActions.some((action) =>
            [
              "kick",
              "ban",
              "unban",
              "whitelist.add",
              "whitelist.remove",
              "kill",
              "op",
              "deop",
            ].includes(action),
          ) && (
            <Empty title="Moderation unavailable">
              This device does not have a moderation scope allowed by local
              policy.
            </Empty>
          )}
          <p className="cr-hint">
            Every operation is checked and audited locally. Operator changes
            remain Owner-only.
          </p>
        </div>
      )}
    </dialog>
  );
}

export function ConsoleView21(props: ViewProps) {
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("ALL");
  const [paused, setPaused] = useState<JsonMap[] | null>(null);
  const [followTail, setFollowTail] = useState(true);
  const [timestamps, setTimestamps] = useState(true);
  const [wrap, setWrap] = useState(true);
  const [clearAt, setClearAt] = useState(0);
  const [command, setCommand] = useState("");
  const [output, setOutput] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const viewport = useRef<HTMLDivElement>(null);

  const source = paused ?? props.state.console;
  const entries = useMemo(
    () =>
      source
        .filter(
          (line) =>
            (!clearAt || Date.parse(str(line.capturedAt, "")) > clearAt) &&
            (level === "ALL" || line.level === level) &&
            str(line.content).toLowerCase().includes(search.toLowerCase()),
        )
        .slice(-600),
    [source, clearAt, level, search],
  );

  useEffect(() => {
    if (followTail && viewport.current)
      viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [entries.length, followTail]);

  const visibleText = entries
    .map((line) =>
      `${timestamps ? `[${time(line.capturedAt)}] ` : ""}${str(line.level)} ${str(line.content)}`,
    )
    .join("\n");

  return (
    <>
      <div className="cr21-filter-toolbar">
        <label className="cr-search">
          Search output
          <input value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <div className="cr21-segmented" aria-label="Console severity filter">
          {["ALL", "INFO", "WARN", "ERROR"].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={level === value}
              onClick={() => setLevel(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <button
          className="cr-button"
          onClick={() => setPaused(paused ? null : [...props.state.console])}
        >
          {paused ? "Resume stream" : "Pause view"}
        </button>
        <button
          className="cr-button"
          aria-pressed={followTail}
          onClick={() => setFollowTail(!followTail)}
        >
          Follow tail {followTail ? "on" : "off"}
        </button>
        <details className="cr21-menu">
          <summary className="cr-button">Display / export</summary>
          <div>
            <button onClick={() => setTimestamps(!timestamps)}>
              {timestamps ? "Hide timestamps" : "Show timestamps"}
            </button>
            <button onClick={() => setWrap(!wrap)}>
              {wrap ? "Disable wrapping" : "Enable wrapping"}
            </button>
            <button
              disabled={!entries.length}
              onClick={() =>
                void navigator.clipboard
                  .writeText(visibleText)
                  .then(() => props.notice("Visible console lines copied."))
              }
            >
              Copy visible lines
            </button>
            <button
              disabled={!entries.length}
              onClick={() =>
                downloadText(
                  `plexonpanel-console-${new Date().toISOString().replaceAll(":", "-")}.log`,
                  visibleText,
                )
              }
            >
              Download browser-session log
            </button>
            <button onClick={() => setClearAt(Date.now())}>
              Clear local display
            </button>
          </div>
        </details>
        <Badge>{entries.length} lines</Badge>
      </div>

      <Panel
        title="Live console"
        aside={
          <div className="cr21-panel-badges">
            {paused && <Badge tone="amber">View paused</Badge>}
            <Badge tone={props.connected ? "green" : "amber"}>
              {props.connected ? "Full/authorized stream" : "Reconnecting"}
            </Badge>
          </div>
        }
      >
        <div
          className={`cr-console cr21-console ${wrap ? "wrap" : "nowrap"}`}
          ref={viewport}
          role="log"
          aria-live="off"
        >
          {entries.length ? (
            entries.map((line, index) => (
              <div
                className={`cr-console-line ${str(line.level).toLowerCase()}`}
                key={`${line.fingerprint}-${index}`}
              >
                {timestamps && <time>{time(line.capturedAt)}</time>}
                <span>{str(line.level)}</span>
                <code>
                  {str(line.content).replace(
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
                      .writeText(str(line.content))
                      .then(() => props.notice("Line copied."))
                  }
                >
                  Copy
                </button>
              </div>
            ))
          ) : (
            <Empty title="No console lines to display">
              Console content depends on the locally enabled stream and this
              device&apos;s scope. Missing data is not replaced with examples.
            </Empty>
          )}
        </div>

        {props.can("console.execute") ? (
          <form
            className="cr-command"
            onSubmit={(event) => {
              event.preventDefault();
              const value = command.trim();
              if (!value) return;
              setCommand("");
              void props
                .run("console.execute", { command: value, confirmed: true })
                .then((result) => {
                  setOutput(
                    Array.isArray(result.data.output)
                      ? result.data.output.map(String)
                      : [],
                  );
                  if (
                    /^(?:tps|mspt|list|version|plugins|spark (?:tps|health))$/i.test(
                      value.replace(/^\//, ""),
                    )
                  )
                    setHistory((current) =>
                      [value, ...current.filter((item) => item !== value)].slice(
                        0,
                        20,
                      ),
                    );
                  setHistoryIndex(-1);
                })
                .catch(() => {});
            }}
          >
            <span aria-hidden>›</span>
            <input
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  const next = Math.min(
                    history.length - 1,
                    historyIndex + 1,
                  );
                  setHistoryIndex(next);
                  setCommand(history[next] ?? "");
                }
                if (event.key === "ArrowDown") {
                  event.preventDefault();
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
        The console remains bounded to the browser session. Clearing the view
        does not delete server logs, and pausing does not stop the WebSocket.
      </p>
    </>
  );
}

export function ChatView21(props: ViewProps) {
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [paused, setPaused] = useState<JsonMap[] | null>(null);
  const [followTail, setFollowTail] = useState(true);
  const [clearAt, setClearAt] = useState(0);
  const [mini, setMini] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const source = paused ?? props.state.chat;
  const messages = useMemo(
    () =>
      source.filter(
        (item) =>
          (!clearAt || Date.parse(str(item.capturedAt, "")) > clearAt) &&
          (lower(item.playerName).includes(search.toLowerCase()) ||
            lower(item.content).includes(search.toLowerCase())),
      ),
    [source, clearAt, search],
  );
  useEffect(() => {
    if (followTail && viewport.current)
      viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [messages.length, followTail]);

  const plexonChatsActive =
    props.state.ready?.server.capabilities["chat.integration.plexonchats"] ===
      true ||
    props.state.chat.some(
      (item) => item.source === "PlexonChats" || item.integration === "PlexonChats",
    );

  return (
    <>
      <div className="cr21-filter-toolbar">
        <label className="cr-search">
          Search chat
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Player or message"
          />
        </label>
        <button
          className="cr-button"
          onClick={() => setPaused(paused ? null : [...props.state.chat])}
        >
          {paused ? "Resume view" : "Pause view"}
        </button>
        <button
          className="cr-button"
          aria-pressed={followTail}
          onClick={() => setFollowTail(!followTail)}
        >
          Follow tail {followTail ? "on" : "off"}
        </button>
        <button className="cr-button" onClick={() => setClearAt(Date.now())}>
          Clear local view
        </button>
        <Badge>{messages.length} messages</Badge>
        {plexonChatsActive && <Badge tone="cyan">PlexonChats</Badge>}
      </div>

      <Panel
        title="Global chat"
        aside={
          paused ? (
            <Badge tone="amber">View paused</Badge>
          ) : (
            <Badge tone={props.connected ? "green" : "quiet"}>
              {props.connected ? "Live channel" : "Disconnected"}
            </Badge>
          )
        }
      >
        <div className="cr-chat cr21-chat" ref={viewport}>
          {messages.length ? (
            messages.map((item, index) => (
              <div
                className="cr-chat-message"
                key={`${item.messageId}-${index}`}
              >
                <span className="cr-avatar" aria-hidden>
                  {str(item.playerName).slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <strong>
                    {str(item.playerName, "System")}{" "}
                    <small>{time(item.capturedAt)}</small>
                  </strong>
                  <p>{str(item.content)}</p>
                </div>
                <button
                  className="cr21-copy-message"
                  aria-label="Copy chat message"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(str(item.content))
                      .then(() => props.notice("Chat message copied."))
                  }
                >
                  Copy
                </button>
              </div>
            ))
          ) : (
            <Empty title={search ? "No matching chat messages" : "No global chat messages yet"}>
              Vanilla and supported integration messages appear only when the
              local policy provides them.
            </Empty>
          )}
        </div>

        {props.can("chat.global.send") ? (
          <form
            className="cr-form cr-pad"
            onSubmit={(event) => {
              event.preventDefault();
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
                onChange={(event) => setMessage(event.target.value)}
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
                      onChange={(event) => setMini(event.target.checked)}
                    />
                    MiniMessage
                  </label>
                )}
              <button
                className="cr-button primary"
                disabled={!message.trim()}
              >
                Send to global chat
              </button>
            </div>
          </form>
        ) : (
          <p className="cr-hint cr-pad">
            Sending is disabled for this device or by local policy.
          </p>
        )}
      </Panel>
    </>
  );
}

export function PluginsView21(props: ViewProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState<PluginSort>("name");
  const [selected, setSelected] = useState<string | null>(null);

  const plugins = useMemo(() => {
    const filtered = props.state.plugins.filter((plugin) => {
      const matchesSearch =
        lower(plugin.name).includes(search.toLowerCase()) ||
        lower(plugin.description).includes(search.toLowerCase());
      const matchesStatus =
        status === "ALL" ||
        (status === "ENABLED" && plugin.enabled === true) ||
        (status === "DISABLED" && plugin.enabled !== true);
      return matchesSearch && matchesStatus;
    });
    return [...filtered].sort((a, b) =>
      sort === "version"
        ? str(a.version).localeCompare(str(b.version), undefined, {
            numeric: true,
          })
        : str(a.name).localeCompare(str(b.name)),
    );
  }, [props.state.plugins, search, status, sort]);
  const plugin = props.state.plugins.find((item) => item.name === selected);

  return (
    <>
      <div className="cr21-filter-toolbar">
        <label className="cr-search">
          Search plugins
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name or description"
          />
        </label>
        <label>
          State
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="ALL">All states</option>
            <option value="ENABLED">Enabled</option>
            <option value="DISABLED">Disabled</option>
          </select>
        </label>
        <label>
          Sort
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as PluginSort)}
          >
            <option value="name">Name</option>
            <option value="version">Version</option>
          </select>
        </label>
        <Badge>{props.state.plugins.length} installed</Badge>
        <button
          className="cr-button"
          onClick={() =>
            props.notice(
              "Plugin inventory is pushed by the Paper agent; the latest received snapshot is displayed.",
            )
          }
        >
          Refresh
        </button>
      </div>

      <Panel title="Plugin inventory" aside={<Badge>{plugins.length} shown</Badge>}>
        {plugins.length ? (
          <div className="cr-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Plugin</th>
                  <th>Version</th>
                  <th>State</th>
                  <th>Authors</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {plugins.map((item) => (
                  <tr key={str(item.name)}>
                    <td>
                      <strong>{str(item.name)}</strong>
                      {typeof item.description === "string" && (
                        <small className="cr21-table-description">
                          {item.description}
                        </small>
                      )}
                    </td>
                    <td>{str(item.version)}</td>
                    <td>
                      <Badge tone={item.enabled ? "green" : "quiet"}>
                        {item.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </td>
                    <td>
                      {Array.isArray(item.authors) && item.authors.length
                        ? item.authors.join(", ")
                        : "Not declared"}
                    </td>
                    <td>
                      <button
                        className="cr-button"
                        onClick={() => setSelected(str(item.name))}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={
              search || status !== "ALL"
                ? "No plugins match these filters"
                : "Waiting for plugin inventory"
            }
          />
        )}
      </Panel>

      {plugin && (
        <PluginDialog21
          {...props}
          plugin={plugin}
          close={() => setSelected(null)}
        />
      )}
      <p className="cr-hint">
        Generic Bukkit/Paper reload is intentionally unsupported. Dedicated
        reload commands remain controlled by local plugin policy.
      </p>
    </>
  );
}

function PluginDialog21({
  plugin,
  close,
  ...props
}: ViewProps & { plugin: JsonMap; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      className="cr-drawer cr21-player-drawer"
      ref={ref}
      onCancel={close}
      aria-labelledby="plugin-title"
    >
      <div className="cr-panel-head">
        <div>
          <small>Plugin details</small>
          <h2 id="plugin-title">{str(plugin.name)}</h2>
        </div>
        <button className="cr-button" onClick={close} aria-label="Close plugin details">
          ×
        </button>
      </div>
      <div className="cr21-drawer-section">
        <div className="cr-actions">
          <Badge tone={plugin.enabled ? "green" : "quiet"}>
            {plugin.enabled ? "Enabled" : "Disabled"}
          </Badge>
          <Badge>{str(plugin.version)}</Badge>
        </div>
        <p>{str(plugin.description, "No description provided by this plugin.")}</p>
        <dl className="cr-details">
          <div>
            <dt>Authors</dt>
            <dd>
              {Array.isArray(plugin.authors) && plugin.authors.length
                ? plugin.authors.join(", ")
                : "Not declared"}
            </dd>
          </div>
          <div>
            <dt>Dependencies</dt>
            <dd>
              {Array.isArray(plugin.dependencies) && plugin.dependencies.length
                ? plugin.dependencies.join(", ")
                : "None declared"}
            </dd>
          </div>
          <div>
            <dt>Soft dependencies</dt>
            <dd>
              {Array.isArray(plugin.softDependencies) &&
              plugin.softDependencies.length
                ? plugin.softDependencies.join(", ")
                : "None declared"}
            </dd>
          </div>
          <div>
            <dt>Data folder</dt>
            <dd>plugins/{str(plugin.name)}</dd>
          </div>
        </dl>
        <div className="cr-actions">
          {props.can("plugin.command.reload") && (
            <ActionButton
              onClick={() =>
                props.run("plugin.command.reload", {
                  plugin: plugin.name,
                  confirmed: true,
                })
              }
            >
              Run configured reload
            </ActionButton>
          )}
          {typeof plugin.website === "string" &&
            /^https:\/\//.test(plugin.website) && (
              <a
                className="cr-button"
                href={plugin.website}
                target="_blank"
                rel="noreferrer"
              >
                Project website
              </a>
            )}
        </div>
        <p className="cr-hint">
          Use the Files workspace for configuration access when its root and
          current device scope permit it.
        </p>
      </div>
    </dialog>
  );
}

"use client";

import { ActionButton, Badge, Button, Empty, Panel, Select, SourceFacts } from "./ui/workspace";
import { Dialog, Disclosure, Table } from "./ui/primitives";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  duration,
  metric,
  time,
  type ViewProps,
} from "./control-views";
import { number, records, str, type JsonMap } from "../lib/control-state";
import { sendDashboardAction } from "../lib/data-source";
import { PlayerHead } from "../components/player-head";
import { useUiPreferences } from "../components/ui-preferences-provider";
import { HistoryPlayerDrawer } from "./communication-views";

type PlayerSort = "name" | "ping" | "session" | "world";

function lower(value: unknown) {
  return str(value, "").toLowerCase();
}

function playerNames(player: JsonMap) {
  const name = str(player.name, "Unknown player");
  const displayName = str(player.displayName, "").trim();
  return {
    name,
    displayName: displayName && displayName !== name ? displayName : "",
    primary: displayName || name,
  };
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

function displayedUuid(
  uuid: string,
  preference: "hidden" | "short" | "full",
) {
  if (preference === "hidden") return "";
  return preference === "full" ? uuid : uuid.slice(0, 8);
}

function useMobileLayout() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(query.matches);
    query.addEventListener("change", update);
    queueMicrotask(update);
    return () => query.removeEventListener("change", update);
  }, []);
  return mobile;
}

export function PlayerRoster(props: ViewProps & { showHistoryTab?: boolean }) {
  const showHistoryTab = props.showHistoryTab !== false;
  const { preferences } = useUiPreferences();
  const mobile = useMobileLayout();
  const useCards = mobile && preferences.mobilePlayerRows === "cards";
  const rowHeadSize = preferences.playerHeadSize === "small" ? 32 : 40;
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
  const [presenceNow, setPresenceNow] = useState(() => Date.now());
  const ready = props.state.ready;
  const historyScope = Boolean(ready?.device.scopes.includes("players.history.view"));
  const historyCapabilityKnown = Boolean(
    ready && Object.prototype.hasOwnProperty.call(ready.server.paperCapabilities, "players.history.view"),
  );
  const historyCapability = ready?.server.paperCapabilities["players.history.view"] === true;
  const paperOnline = Boolean(ready?.agents.paper);
  const historyTabAvailable = showHistoryTab && historyScope && historyCapability;

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => setPresenceNow(Date.now()), 0);
    const settleTimer = window.setTimeout(() => setPresenceNow(Date.now()), 6500);
    return () => {
      window.clearTimeout(refreshTimer);
      window.clearTimeout(settleTimer);
    };
  }, [props.state.presenceEventIds.length]);

  const recentlyChanged = useMemo(() => {
    const cutoff = presenceNow - 6000;
    return new Set(
      props.state.presenceDeltas
        .filter((delta) => {
          const observedAt = Date.parse(str(delta.observedAt, ""));
          return Number.isFinite(observedAt) && observedAt >= cutoff && observedAt <= presenceNow + 1000;
        })
        .map((delta) => str(delta.uuid, ""))
        .filter(Boolean),
    );
  }, [presenceNow, props.state.presenceDeltas]);

  const worlds = useMemo(
    () => Array.from(new Set(props.state.players.map((player) => str(player.world, "")).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [props.state.players],
  );
  const players = useMemo(() => {
    const query = search.toLowerCase();
    const filtered = props.state.players.filter((player) => {
      const matchesSearch = lower(player.name).includes(query) || lower(player.displayName).includes(query) || lower(player.uuid).includes(query);
      const matchesWorld = worldFilter === "ALL" || str(player.world) === worldFilter;
      return matchesSearch && matchesWorld;
    });
    return [...filtered].sort((a, b) => {
      if (sort === "ping") return (number(a.pingMillis) ?? Number.MAX_SAFE_INTEGER) - (number(b.pingMillis) ?? Number.MAX_SAFE_INTEGER);
      if (sort === "session") return (number(b.onlineDurationMillis) ?? 0) - (number(a.onlineDurationMillis) ?? 0);
      if (sort === "world") return str(a.world).localeCompare(str(b.world)) || str(a.name).localeCompare(str(b.name));
      return playerNames(a).primary.localeCompare(playerNames(b).primary);
    });
  }, [props.state.players, search, worldFilter, sort]);
  const player = props.state.players.find((item) => item.uuid === selected);
  const historyRecord = historyEntries.find((entry) => entry.eventId === selectedHistory);

  const loadHistory = useCallback(async (append = false) => {
    if (!historyTabAvailable || !props.connected || !paperOnline) return;
    if (historyFrom && historyTo && historyFrom > historyTo) {
      setHistoryError("The From date must not be after the To date.");
      setHistoryLoaded(true);
      return;
    }
    setHistoryBusy(true);
    setHistoryError("");
    try {
      const parameters: JsonMap = { query: historyQuery.trim(), status: historyStatus, limit: 50 };
      if (historyFrom) parameters.from = new Date(`${historyFrom}T00:00:00`).toISOString();
      if (historyTo) parameters.to = new Date(`${historyTo}T23:59:59.999`).toISOString();
      if (append && historyCursor) parameters.cursor = historyCursor;
      const result = await sendDashboardAction("players.history.list", parameters, "PAPER");
      const data = result.data;
      if (data.historyEnabled !== true) {
        setHistoryPolicyDisabled(true);
        setHistoryEntries([]);
        setHistoryMore(false);
        setHistoryCursor("");
      } else {
        const entries = records(data.entries, 100);
        setHistoryPolicyDisabled(false);
        setHistoryEntries((current) => (append ? [...current, ...entries] : entries).slice(0, 500));
        setHistoryCursor(str(data.nextCursor, ""));
        setHistoryMore(data.hasMore === true);
        setHistoryBounded(data.boundedWindow === true);
        setHistoryCapturedAt(str(data.capturedAt, ""));
      }
      setHistoryLoaded(true);
    } catch (reason) {
      setHistoryError(reason instanceof Error ? reason.message : "The Paper agent could not read player history.");
    } finally {
      setHistoryBusy(false);
    }
  }, [historyCursor, historyFrom, historyQuery, historyStatus, historyTabAvailable, historyTo, paperOnline, props.connected]);

  const historyUnavailable = !historyScope
    ? "This device grant does not include player history. Existing grants stay unchanged; pair a newly approved Moderator, Administrator, or Owner device to add it."
    : !historyCapabilityKnown
      ? "This Paper agent predates the player-history capability. Online players remain available; upgrade the agent to use history."
      : !historyCapability
        ? "Player history is disabled by local Paper policy. Enable player-history locally and restart or reload the agent before granting access."
        : "";

  return (
    <>
      {showHistoryTab && <div className="pp-segmented" aria-label="Player views">
        <Button aria-pressed={tab === "online"} onClick={() => setTab("online")}>Online</Button>
        {historyTabAvailable && (
          <Button
            aria-pressed={tab === "history"}
            onClick={() => {
              setTab("history");
              if (!historyLoaded && !historyBusy) void loadHistory(false);
            }}
          >
            History
          </Button>
        )}
      </div>}

      {tab === "online" || !historyTabAvailable ? (
        <>
          <div className="pp-toolbar">
            <label className="pp-field">Search players<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, display name or UUID" /></label>
            <Select aria-label="World" value={worldFilter} onValueChange={(selectedValue) => setWorldFilter(selectedValue)}><option value="ALL">All worlds</option>{worlds.map((world) => <option key={world}>{world}</option>)}</Select>
            <Select aria-label="Sort" value={sort} onValueChange={(selectedValue) => setSort(selectedValue as PlayerSort)}><option value="name">Name</option><option value="ping">Ping</option><option value="session">Session time</option><option value="world">World</option></Select>
            <Badge>{props.state.players.length} online</Badge>
            <Button

              disabled={refreshing || !props.can("players.snapshot.request")}
              onClick={() => {
                setRefreshing(true);
                void props.run("players.snapshot.request", {}, "PAPER").finally(() => setRefreshing(false));
              }}
            >
              {refreshing ? "Requesting…" : "Refresh"}
            </Button>
          </div>

          <Panel
            title="Online players"
            aside={<div className="pp-row"><Badge>{players.length} shown</Badge><Badge tone={props.connected && paperOnline ? "green" : "amber"}>{!props.connected ? "Reconnecting" : !paperOnline ? "Paper offline" : props.state.pendingPlayerSnapshot ? "Reconciling" : "Live"}</Badge></div>}
          >
            {players.length ? (
              useCards ? (
                <div className="pp-data-grid">
                  {players.map((item) => {
                    const uuid = str(item.uuid, "");
                    const names = playerNames(item);
                    const shownUuid = displayedUuid(uuid, preferences.playerUuid);
                    const highlighted = preferences.liveRowHighlight && recentlyChanged.has(uuid);
                    return (
                      <article className={`pp-record${highlighted ? " pp-new-row" : ""}`} key={uuid}>
                        <div className="pp-row">
                          <PlayerHead uuid={uuid} name={names.name} skinTextureId={str(item.skinTextureId, "")} size={rowHeadSize} online />
                          <div className="pp-row-details">
                            <strong>{names.primary}</strong>
                            {names.displayName && <small>{names.name}</small>}
                            {shownUuid && <small className="pp-identifier">{shownUuid}</small>}
                            <Badge tone="green">Online</Badge>
                          </div>
                        </div>
                        <dl className="pp-facts">
                          <div><dt>World</dt><dd>{str(item.world)}</dd></div>
                          <div><dt>Ping</dt><dd>{metric(item.pingMillis, " ms", 0)}</dd></div>
                          <div><dt>Session</dt><dd>{duration(item.onlineDurationMillis)}</dd></div>
                        </dl>
                        <Button  onClick={() => setSelected(uuid)}>Manage</Button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <Table caption="Online player roster" rows={players} rowKey={item=>str(item.uuid)} rowClassName={item=>preferences.liveRowHighlight&&recentlyChanged.has(str(item.uuid))?'pp-new-row':undefined} columns={[
                  {key:'player',label:'Player',rowHeader:true,render:item=>{const names=playerNames(item);const shownUuid=displayedUuid(str(item.uuid),preferences.playerUuid);return <div className="pp-row"><PlayerHead uuid={str(item.uuid)} name={names.name} skinTextureId={str(item.skinTextureId,'')} size={rowHeadSize} online/><div className="pp-row-details"><strong>{names.primary}</strong>{names.displayName&&<small>{names.name}</small>}{shownUuid&&<small className="pp-identifier">{shownUuid}</small>}</div></div>;}},
                  {key:'world',label:'World',render:item=>str(item.world)},
                  {key:'ping',label:'Ping',render:item=><span className="pp-number">{metric(item.pingMillis,' ms',0)}</span>},
                  {key:'mode',label:'Game mode',render:item=>str(item.gameMode).toLowerCase()},
                  {key:'session',label:'Session',render:item=>duration(item.onlineDurationMillis)},
                  {key:'actions',label:'Actions',render:item=><Button onClick={()=>setSelected(str(item.uuid))}>Manage</Button>},
                ]}/>

              )
            ) : !props.connected ? (
              <Empty title="Roster unavailable while reconnecting">A fresh authoritative snapshot will replace the roster after the signed session reconnects.</Empty>
            ) : !paperOnline ? (
              <Empty title="Paper agent offline">Cached players are not shown as online. Reconnect Paper to load a current roster.</Empty>
            ) : props.state.pendingPlayerSnapshot ? (
              <Empty title="Loading the current roster">Multipart snapshot data is staged until Paper marks it complete.</Empty>
            ) : (
              <Empty title={search || worldFilter !== "ALL" ? "No players match these filters" : "No players online"} />
            )}
          </Panel>

          <Disclosure title="Roster source and timing"><SourceFacts source="Paper player snapshot" unit="players; milliseconds; blocks" receivedAt={props.state.updatedAt}/><p className="pp-muted">Completed roster capture timestamps are not retained by this view. Position and address require an existing grant and a supplied field.</p></Disclosure>
          {showHistoryTab && historyUnavailable && <Panel title="Player history"><p className="pp-muted">{historyUnavailable}</p></Panel>}
        </>
      ) : (
        <>
          <div className="pp-toolbar">
            <label className="pp-field">Search history<input value={historyQuery} maxLength={64} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="Username or UUID" /></label>
            <Select aria-label="Status" value={historyStatus} onValueChange={(selectedValue) => setHistoryStatus(selectedValue)}><option value="ALL">All observations</option><option value="ONLINE">Joined</option><option value="OFFLINE">Left</option></Select>
            <label>From<input type="date" value={historyFrom} onChange={(event) => setHistoryFrom(event.target.value)} /></label>
            <label>To<input type="date" value={historyTo} onChange={(event) => setHistoryTo(event.target.value)} /></label>
            <Button  disabled={historyBusy || !props.connected || !paperOnline} onClick={() => void loadHistory(false)}>{historyBusy ? "Loading…" : "Search"}</Button>
          </div>

          <Panel title="Paper-owned presence history" aside={historyCapturedAt ? <Badge>Captured {time(historyCapturedAt)}</Badge> : undefined}>
            {!props.connected ? (
              <Empty title="History paused while reconnecting">History is queried directly from Paper and is not served from browser cache.</Empty>
            ) : !paperOnline ? (
              <Empty title="Paper agent offline">Reconnect Paper to query its local presence journal.</Empty>
            ) : historyPolicyDisabled ? (
              <Empty title="History disabled by local policy">No persistent journal is available. This setting cannot be enabled remotely.</Empty>
            ) : historyError ? (
              <Empty title="History query failed">{historyError} Check Paper diagnostics, then retry this bounded query.</Empty>
            ) : historyBusy && !historyLoaded ? (
              <Empty title="Loading player history" />
            ) : historyEntries.length ? (
              <>
                {historyBounded && <p className="pp-notice" role="status">This result is bounded by retention or scan limits and may not include every older observation.</p>}
                <div className="pp-table-scroll" data-cards="true" role="region" aria-label="Loaded presence history" tabIndex={0}><table className="pp-table">
                  <thead><tr><th>Player</th><th>Observation</th><th>When</th><th>Duration</th><th>Termination</th><th>Details</th></tr></thead>
                  <tbody>{historyEntries.map((entry) => (
                    <tr key={str(entry.eventId)}>
                      <td data-label="Player"><strong>{str(entry.name)}</strong><small className="pp-identifier">{str(entry.uuid).slice(0, 8)}</small></td>
                      <td data-label="Observation">{entry.state === "JOINED" ? "Joined" : "Left"}</td><td data-label="When"><Timestamp value={entry.observedAt} /></td><td data-label="Duration">{duration(entry.sessionDurationMillis)}</td>
                      <td data-label="Termination">{entry.termination === "UNKNOWN_DISCONNECT" ? "Unknown disconnect" : str(entry.termination).toLowerCase()}</td>
                      <td data-label="Details"><Button  onClick={() => setSelectedHistory(str(entry.eventId))}>Inspect</Button></td>
                    </tr>
                  ))}</tbody>
                </table></div>
                {historyMore && <div className="pp-row"><Button  disabled={historyBusy} onClick={() => void loadHistory(true)}>{historyBusy ? "Loading…" : "Load older observations"}</Button></div>}
              </>
            ) : historyLoaded ? (
              <Empty title="No matching history">Paper returned no presence observations for these bounded filters.</Empty>
            ) : (
              <Empty title="Loading player history" />
            )}
          </Panel>
        </>
      )}

      {player && (
        <PlayerDrawer23
          key={selected}
          {...props}
          player={player}
          previousSessions={historyEntries.filter((entry) => entry.uuid === player.uuid && entry.state === "LEFT" && entry.sessionId !== player.sessionId)}
          historyAvailable={historyTabAvailable}
          close={() => setSelected(null)}
        />
      )}
      {historyRecord && tab === "history" && historyTabAvailable && props.connected && paperOnline && (
        <HistoryPlayerDrawer entry={historyRecord} entries={historyEntries.filter((entry) => entry.uuid === historyRecord.uuid)} close={() => setSelectedHistory(null)} />
      )}
    </>
  );
}

export function playerDetailRows(player:JsonMap,scopes:readonly string[]){
  const names=playerNames(player);
  return [
    ["UUID", player.uuid],
    ...(names.displayName ? [["Display name", names.displayName] as [string, unknown]] : []),
    ["World", player.world],
    ["Game mode", player.gameMode],
    ["Ping", metric(player.pingMillis, " ms", 0)],
    ["Health", `${player.health ?? "—"} / ${player.maximumHealth ?? "—"}`],
    ["Food", player.food],
    ["XP level", player.experienceLevel],
    ...(typeof player.op === "boolean" ? [["Operator", player.op ? "Yes" : "No"] as [string, unknown]] : []),
    ...(typeof player.whitelisted === "boolean" ? [["Whitelisted", player.whitelisted ? "Yes" : "No"] as [string, unknown]] : []),
    ["Online", duration(player.onlineDurationMillis)],
    ["Session started", time(player.sessionStartedAt)],
    ["Session ID", player.sessionId],
    ...(typeof player.firstSeenAt === "string" ? [["First observed", time(player.firstSeenAt)] as [string, unknown]] : []),
    ...(typeof player.lastLoginAt === "string" ? [["Last login", time(player.lastLoginAt)] as [string, unknown]] : []),
    ...(scopes.includes("players.location") && player.position && typeof player.position === "object" ? [["Position", JSON.stringify(player.position)] as [string, unknown]] : []),
    ...(scopes.includes("players.address") && typeof player.address === "string" && player.address ? [["IP address", player.address] as [string, unknown]] : []),
  ] as Array<[string, unknown]>;
}

function PlayerDrawer23({ player, previousSessions, historyAvailable, close, ...props }: ViewProps & {
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
  const base = { playerId: player.uuid };
  const permittedActions = ["message", "heal", "feed", "teleport", "gamemode", "kick", "ban", "unban", "whitelist.add", "whitelist.remove", "kill", "op", "deop"].filter((action) => props.can(`player.${action}`));
  const uuid = str(player.uuid, "");
  const names = playerNames(player);
  const detailRows=playerDetailRows(player,props.deviceGrant?.scopes??props.state.ready?.device.scopes??[]);

  return (
    <Dialog open onClose={close} title={names.primary} description="Current Paper player. Actions apply to this bound player target.">
      <div className="pp-row"><PlayerHead uuid={uuid} name={names.name} skinTextureId={str(player.skinTextureId,'')} size={64} online/><code className="pp-identifier">{uuid}</code></div>
      <div className="pp-segmented">
        {["Overview", "Actions", "Moderation"].map((value) => <Button key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{value}</Button>)}
      </div>

      {tab === "Overview" ? (
        <div className="pp-stack">
          <dl className="pp-facts">
            {detailRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{String(value ?? "—")}</dd></div>)}
          </dl>
          {!detailRows.some(([label]) => label === "Position" || label === "IP address") && (
            <p className="pp-muted">Location and address are omitted when local Paper policy or the device grant does not authorize them.</p>
          )}
          <p className="pp-muted">{permittedActions.length ? `${permittedActions.length} player actions are allowed for this device and current local policy.` : "This device has read-only access to player details."}</p>
          {historyAvailable && (
            <div className="pp-stack">
              <h3>Previous sessions</h3>
              {previousSessions.length ? <ul className="pp-list">{previousSessions.slice(0, 12).map((session) => <li key={str(session.eventId)}><strong>{time(session.sessionStartedAt)}</strong><span>{time(session.sessionEndedAt)}</span><span>{duration(session.sessionDurationMillis)}</span></li>)}</ul> : <p className="pp-muted">Open the History tab to load bounded previous-session data from Paper. History is never inferred from browser state.</p>}
            </div>
          )}
        </div>
      ) : tab === "Actions" ? (
        <div className="pp-form pp-stack">
          {props.can("player.message") && <form onSubmit={(event) => { event.preventDefault(); void props.run("player.message", { ...base, message }).then(() => setMessage("")).catch(() => {}); }}><label>Private message<input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} required /></label><Button variant="primary" type="submit">Send message</Button></form>}
          <div className="pp-row">{["heal", "feed"].filter((action) => props.can(`player.${action}`)).map((action) => <ActionButton key={action} onClick={() => props.run(`player.${action}`, base)}>{action === "heal" ? "Heal" : "Feed"}</ActionButton>)}</div>
          {props.can("player.gamemode") && <div className="pp-form"><Select aria-label="Game mode" value={gameMode} onValueChange={(selectedValue) => setGameMode(selectedValue)}>{["SURVIVAL", "CREATIVE", "ADVENTURE", "SPECTATOR"].map((value) => <option key={value}>{value}</option>)}</Select><ActionButton onClick={() => props.run("player.gamemode", { ...base, gameMode })}>Set game mode</ActionButton></div>}
          {props.can("player.teleport") && <div className="pp-form"><label>Destination world<input value={world} onChange={(event) => setWorld(event.target.value)} /></label><div className="pp-stat-grid">{(["x", "y", "z"] as const).map((key) => <label key={key}>{key.toUpperCase()}<input type="number" value={coordinates[key]} onChange={(event) => setCoordinates({ ...coordinates, [key]: event.target.value })} /></label>)}</div><ActionButton disabled={Object.values(coordinates).some((value) => value === "")} disabledReason="Enter all three destination coordinates." onClick={() => props.run("player.teleport", { ...base, world, x: Number(coordinates.x), y: Number(coordinates.y), z: Number(coordinates.z) })}>Teleport</ActionButton></div>}
          {!permittedActions.some((action) => ["message", "heal", "feed", "gamemode", "teleport"].includes(action)) && <Empty title="Player actions unavailable">The current device scope or local Paper policy does not allow direct player actions.</Empty>}
        </div>
      ) : (
        <div className="pp-form pp-stack">
          <label>Moderation reason<input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} /></label>
          <div className="pp-row">
            {["kick", "ban", "unban", "whitelist.add", "whitelist.remove", "kill", "op", "deop"].filter((action) => props.can(`player.${action}`)).map((action) => <ActionButton key={action} danger={["ban", "kill", "op", "deop"].includes(action)} onClick={() => props.run(`player.${action}`, { ...base, reason })}>{({kick:"Kick player",ban:"Ban player",unban:"Unban player","whitelist.add":"Add to whitelist","whitelist.remove":"Remove from whitelist",kill:"Kill player",op:"Grant operator",deop:"Remove operator"} as Record<string,string>)[action]}</ActionButton>)}
          </div>
          {!permittedActions.some((action) => ["kick", "ban", "unban", "whitelist.add", "whitelist.remove", "kill", "op", "deop"].includes(action)) && <Empty title="Moderation unavailable">This device does not have a moderation scope allowed by local policy.</Empty>}
          <p className="pp-muted">Every operation is checked and audited locally. Operator changes remain Owner-only.</p>
        </div>
      )}
    </Dialog>
  );
}

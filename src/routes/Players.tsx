import { useMemo, useState } from "react";
import { number, str, type JsonMap } from "../adapter/control-state";
import { session, type Prepared } from "../adapter/session";
import { PlayerHead } from "../components/PlayerHead";
import { Button, Notice, Panel, Status, Empty } from "../components/ui";
import { ActionReview } from "../features/ActionReview";
import { playerCommand, permissionCommand } from "../lib/playerCommands";
import { useSession, useNow } from "../hooks";
import { toast } from "../components/toast";
import { Icon } from "../components/Icon";
import { hasScope } from "../presentation/authority";
import { sourceEvidence } from "../presentation/telemetry";
type Player = {
  uuid: string;
  name: string;
  world: string;
  ping: number | null;
  onlineMs: number | null;
};
const actions = [
  ["Whitelist", "player.whitelist.add"],
  ["Heal", "player.heal"],
  ["Feed", "player.feed"],
  ["Kick", "player.kick"],
  ["Ban", "player.ban"],
  ["Kill", "player.kill"],
  ["OP", "player.op"],
  ["De-op", "player.deop"],
] as const;
function duration(ms: number | null) {
  if (ms === null) return "Unknown";
  const minutes = Math.floor(ms / 60000);
  return minutes < 60
    ? `${minutes}m`
    : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
export default function Players() {
  const snap = useSession(),
    now = useNow(),
    [query, setQuery] = useState(""),
    [world, setWorld] = useState("all"),
    [sort, setSort] = useState("name"),
    [selected, setSelected] = useState(""),
    [prepared, setPrepared] = useState<Prepared | null>(null),
    [template, setTemplate] = useState("tell {player} Hello from the console"),
    [node, setNode] = useState("essentials.fly"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [reason, setReason] = useState(""),
    [gameMode, setGameMode] = useState("SURVIVAL");
  const allowed = hasScope(snap, "players.view"),
    evidence = sourceEvidence(snap.state, "paperHealth", now);
  const roster = useMemo<Player[]>(
    () =>
      allowed
        ? snap.state.players
            .map((raw) => ({
              uuid: str(raw.uuid, ""),
              name: str(raw.name, "Unknown"),
              world: str(raw.world, "Unknown"),
              ping: number(raw.ping),
              onlineMs: number(raw.onlineDurationMillis),
            }))
            .filter((p) => p.uuid)
        : [],
    [snap.state.players, allowed],
  );
  const players = useMemo(
    () =>
      roster
        .filter(
          (p) =>
            (p.name.toLowerCase().includes(query.toLowerCase()) ||
              p.uuid.includes(query)) &&
            (world === "all" || p.world === world),
        )
        .sort((a, b) =>
          sort === "ping"
            ? (a.ping ?? Infinity) - (b.ping ?? Infinity)
            : sort === "duration"
              ? (b.onlineMs ?? -1) - (a.onlineMs ?? -1)
              : a.name.localeCompare(b.name),
        ),
    [roster, query, world, sort],
  );
  const active = players.find((p) => p.uuid === selected) ?? players[0] ?? null,
    worlds = [...new Set(roster.map((p) => p.world))];
  const prepare = (action: string, parameters: JsonMap) => {
    setError("");
    try {
      setPrepared(session.prepare(action, parameters, "PAPER"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action unavailable.");
    }
  };
  const runTemplate = () => {
    if (!active) return;
    try {
      prepare("console.execute", { command: playerCommand(template, active) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid command.");
    }
  };
  const permission = (mode: "set" | "unset") => {
    if (!active) return;
    try {
      prepare("console.execute", {
        command: permissionCommand({ player: active.name, node, mode }),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid node.");
    }
  };
  return (
    <>
      <div className="players-toolbar">
        <label className="field">
          <span className="sr-only">Search players</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or UUID"
          />
        </label>
        <label className="field">
          <span className="sr-only">Filter by world</span>
          <select value={world} onChange={(e) => setWorld(e.target.value)}>
            <option value="all">All worlds</option>
            {worlds.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="sr-only">Sort players</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name">Name A–Z</option>
            <option value="ping">Lowest latency</option>
            <option value="duration">Longest session</option>
          </select>
        </label>
        <Status tone={evidence.kind === "live" ? "success" : "neutral"}>
          {roster.length} observed · {evidence.kind}
        </Status>
      </div>
      <div className="players-layout">
        <Panel
          eyebrow="PAPER / PLAYER ROSTER"
          title="People in your worlds"
          action={<span className="subtle">{players.length} results</span>}
        >
          <div className="roster-head">
            <span>Player identity</span>
            <span>World / session</span>
            <span>Latency</span>
          </div>
          <div className="roster">
            {players.length ? (
              players.map((player) => (
                <button
                  key={player.uuid}
                  className={`player-row ${active?.uuid === player.uuid ? "selected" : ""}`}
                  aria-pressed={active?.uuid === player.uuid}
                  onClick={() => {
                    setSelected(player.uuid);
                    if (matchMedia("(max-width: 820px)").matches)
                      requestAnimationFrame(() =>
                        document
                          .getElementById("selected-player-panel")
                          ?.scrollIntoView({ block: "start" }),
                      );
                  }}
                >
                  <PlayerHead uuid={player.uuid} name={player.name} />
                  <span className="player-identity">
                    <strong>{player.name}</strong>
                    <small>{player.uuid}</small>
                  </span>
                  <span>
                    <b>{player.world}</b>
                    <small>{duration(player.onlineMs)} session</small>
                  </span>
                  <span className="ping">
                    {player.ping === null ? "—" : `${player.ping} ms`}
                  </span>
                </button>
              ))
            ) : (
              <Empty
                title={
                  allowed ? "No matching players" : "Roster access restricted"
                }
              >
                {allowed
                  ? "Players appear when Paper reports them. Try another search or world."
                  : "This device needs the players.view scope."}
              </Empty>
            )}
          </div>
        </Panel>
        <aside
          id="selected-player-panel"
          className="player-detail"
          aria-label="Selected player details"
        >
          {active ? (
            <>
              <div className="player-profile">
                <PlayerHead
                  key={active.uuid}
                  uuid={active.uuid}
                  name={active.name}
                  large
                />
                <div>
                  <span className="eyebrow">PLAYER PROFILE</span>
                  <h2>{active.name}</h2>
                  <button
                    className="copy-id"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(active.uuid)
                        .then(() =>
                          toast.push("UUID copied", active.name, "success"),
                        )
                        .catch(() =>
                          toast.push(
                            "Copy unavailable",
                            "Select the UUID in the roster.",
                            "warning",
                          ),
                        );
                    }}
                  >
                    Copy UUID
                  </button>
                </div>
              </div>
              <dl className="identity-facts">
                <dt>Observation</dt>
                <dd>{evidence.kind}</dd>
                <dt>World</dt>
                <dd>{active.world}</dd>
                <dt>Latency</dt>
                <dd>
                  {active.ping === null ? "Unknown" : `${active.ping} ms`}
                </dd>
                <dt>Session</dt>
                <dd>{duration(active.onlineMs)}</dd>
              </dl>
              <section>
                <span className="eyebrow">MESSAGE & GAMEPLAY</span>
                <div className="player-fields">
                  <label className="field">
                    Private message
                    <textarea
                      rows={2}
                      value={message}
                      maxLength={2000}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </label>
                  <Button
                    disabled={
                      !message.trim() ||
                      !!session.reason("player.message", "PAPER")
                    }
                    title={session.reason("player.message", "PAPER")}
                    onClick={() =>
                      prepare("player.message", {
                        playerId: active.uuid,
                        message,
                      })
                    }
                  >
                    Review message <Icon name="arrow" />
                  </Button>
                  <label className="field">
                    Game mode
                    <select
                      value={gameMode}
                      onChange={(e) => setGameMode(e.target.value)}
                    >
                      {["SURVIVAL", "CREATIVE", "ADVENTURE", "SPECTATOR"].map(
                        (mode) => (
                          <option key={mode}>{mode}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <Button
                    disabled={!!session.reason("player.gamemode", "PAPER")}
                    title={session.reason("player.gamemode", "PAPER")}
                    onClick={() =>
                      prepare("player.gamemode", {
                        playerId: active.uuid,
                        gameMode,
                      })
                    }
                  >
                    Review game mode
                  </Button>
                </div>
              </section>
              <section>
                <span className="eyebrow">MODERATION & ACCESS</span>
                <div className="player-fields">
                  <label className="field">
                    Moderation reason{" "}
                    <input
                      value={reason}
                      maxLength={2000}
                      placeholder="Optional reason for kick or ban"
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                </div>
                <div className="action-grid">
                  {actions.map(([label, action]) => (
                    <Button
                      key={action}
                      variant={
                        [
                          "player.ban",
                          "player.kill",
                          "player.op",
                          "player.deop",
                        ].includes(action)
                          ? "danger"
                          : "secondary"
                      }
                      disabled={!!session.reason(action, "PAPER")}
                      title={session.reason(action, "PAPER")}
                      onClick={() =>
                        prepare(action, {
                          playerId: active.uuid,
                          ...((action === "player.kick" ||
                            action === "player.ban") &&
                          reason
                            ? { reason }
                            : {}),
                        })
                      }
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </section>
              <section className="player-command">
                <span className="eyebrow">COMMAND BUILDER</span>
                <label className="field">
                  Allowed command template
                  <input
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                  />
                </label>
                <code>
                  {template
                    .replaceAll("{player}", active.name)
                    .replaceAll("{uuid}", active.uuid)}
                </code>
                <Button
                  onClick={runTemplate}
                  disabled={!!session.reason("console.execute", "PAPER")}
                  title={session.reason("console.execute", "PAPER")}
                >
                  Review command
                </Button>
              </section>
              <section className="player-command">
                <span className="eyebrow">PERMISSION NODE / LUCKPERMS</span>
                <label className="field">
                  Node
                  <input
                    value={node}
                    onChange={(e) => setNode(e.target.value)}
                  />
                </label>
                <div className="button-row">
                  <Button
                    disabled={!!session.reason("console.execute", "PAPER")}
                    onClick={() => permission("set")}
                  >
                    Review grant
                  </Button>
                  <Button
                    disabled={!!session.reason("console.execute", "PAPER")}
                    onClick={() => permission("unset")}
                  >
                    Review removal
                  </Button>
                </div>
                <p className="subtle">
                  Requires the server’s allowed-command policy. Effective
                  permission trees are not available.
                </p>
              </section>
              {error && (
                <Notice tone="error" title="Cannot prepare action">
                  {error}
                </Notice>
              )}
            </>
          ) : (
            <Empty title="No player selected">
              Select a player to inspect their available controls.
            </Empty>
          )}
        </aside>
      </div>
      <ActionReview prepared={prepared} onClose={() => setPrepared(null)} />
    </>
  );
}

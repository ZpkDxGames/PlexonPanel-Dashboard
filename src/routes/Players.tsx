import { VirtualRows } from "../components/VirtualRows";
import { PresenceTimeline } from "../components/PresenceTimeline";
import { useEffect, useMemo, useRef, useState } from "react";
import { number, str, type JsonMap } from "../adapter/control-state";
import { session, type Prepared } from "../adapter/session";
import { PlayerHead } from "../components/PlayerHead";
import { Button, Notice, Status, Empty, Panel } from "../components/ui";
import { ActionReview } from "../features/ActionReview";
import { playerCommand, permissionCommand } from "../lib/playerCommands";
import { useSession, useNow } from "../hooks";
import { toast } from "../components/toast";
import { Icon } from "../components/Icon";
import { PlayerHistory } from "../components/PlayerHistory";
import { hasScope } from "../presentation/authority";
import { sourceEvidence } from "../presentation/telemetry";
import { ActionAvailability } from "../components/nextgen/ActionAvailability";
type Player = {
  uuid: string;
  name: string;
  world: string;
  ping: number | null;
  onlineMs: number | null;
};
const actions = [
  ["Whitelist", "player.whitelist.add"],
  ["Remove whitelist", "player.whitelist.remove"],
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
    [gameMode, setGameMode] = useState("SURVIVAL"),
    [inspecting, setInspecting] = useState(false),
    [playerTab, setPlayerTab] = useState("interact");
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
  const active = roster.find((p) => p.uuid === selected) ?? null,
    worlds = [...new Set(roster.map((p) => p.world))];
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const profileHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (inspecting) profileHeading.current?.focus();
    else if (returnFocus.current?.isConnected) returnFocus.current.focus();
    else document.getElementById("roster-heading")?.focus();
  }, [inspecting, selected]);
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
      <PresenceTimeline />
      <div hidden={inspecting}>
        <div className="community-intro">
          <div>
            <span className="directory-number">
              {String(roster.length).padStart(2, "0")}
            </span>
            <div>
              <h2 id="roster-heading" tabIndex={-1}>
                Online player roster
              </h2>
              <p>{worlds.length} observed worlds · Paper roster</p>
            </div>
          </div>
          <Status tone={evidence.kind === "live" ? "success" : "neutral"}>
            {evidence.kind} observations
          </Status>
        </div>
        <div className="players-toolbar">
          <label className="search-field">
            <Icon name="search" />
            <input
              aria-label="Search players"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a player by name or UUID"
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
          <span className="subtle">{players.length} results</span>
        </div>
        <section className="player-directory" aria-label="Player roster">
          <div className="roster-head">
            <span>PLAYER IDENTITY</span>
            <span>WORLD</span>
            <span>SESSION</span>
            <span>LATENCY</span>
            <span />
          </div>
          <div className="roster">
            {players.length ? (
              <VirtualRows
                rows={players}
                getKey={(player) => player.uuid}
                render={(player) => (
                  <button
                    key={player.uuid}
                    className={`player-row ${inspecting && active?.uuid === player.uuid ? "selected" : ""}`}
                    aria-label={`Inspect ${player.name}`}
                    onClick={(event) => {
                      returnFocus.current = event.currentTarget;
                      setSelected(player.uuid);
                      setPlayerTab("interact");
                      setInspecting(true);
                    }}
                  >
                    <span className="player-directory-name">
                      <PlayerHead uuid={player.uuid} name={player.name} />
                      <span className="player-identity">
                        <strong>{player.name}</strong>
                        <small>{player.uuid}</small>
                      </span>
                    </span>
                    <span className="world-tag">{player.world}</span>
                    <span className="session-duration">
                      {duration(player.onlineMs)}
                    </span>
                    <span className="ping">
                      <i aria-hidden="true" />
                      {player.ping === null ? "—" : `${player.ping} ms`}
                    </span>
                    <span className="roster-inspect">
                      Inspect <Icon name="arrow" />
                    </span>
                  </button>
                )}
              />
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
        </section>
        <div className="directory-footnote">
          <Icon name="players" />
          <p>
            Select a player to open their session, gameplay and moderation
            tools. Controls use the player’s UUID and the selected Paper
            authority.
          </p>
          <span>{evidence.label}</span>
        </div>
      </div>
      <section
        hidden={!inspecting}
        aria-label="Selected player details"
        className="player-profile-page"
      >
        <div className="profile-backbar">
          <button className="text-link" onClick={() => setInspecting(false)}>
            <Icon name="arrow" />
            Back to players
          </button>
          <Status tone={evidence.kind === "live" ? "success" : "neutral"}>
            Paper · {evidence.kind}
          </Status>
        </div>
        <div id="selected-player-panel" className="player-detail">
          {active ? (
            <>
              <header className="profile-header">
                <div className="player-profile">
                  <PlayerHead
                    key={active.uuid}
                    uuid={active.uuid}
                    name={active.name}
                    large
                  />
                  <div className="profile-identity">
                    <span className="eyebrow">PLAYER PROFILE</span>
                    <h2 ref={profileHeading} tabIndex={-1}>
                      {active.name}
                    </h2>
                    <div className="profile-uuid">
                      <code>{active.uuid}</code>
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
                                "Select the UUID above.",
                                "warning",
                              ),
                            );
                        }}
                      >
                        <Icon name="copy" />
                        Copy UUID
                      </button>
                    </div>
                  </div>
                  <div className="profile-session">
                    <span>Current reported session</span>
                    <strong>{duration(active.onlineMs)}</strong>
                    <small>Duration reported by Paper</small>
                  </div>
                </div>
                <div className="profile-stats">
                  <div>
                    <span>World</span>
                    <strong>{active.world}</strong>
                  </div>
                  <div>
                    <span>Latency</span>
                    <strong>
                      {active.ping === null ? "Unknown" : `${active.ping} ms`}
                    </strong>
                  </div>
                  <div>
                    <span>Observation</span>
                    <strong>{evidence.kind}</strong>
                  </div>
                </div>
              </header>
              <div className="profile-layout">
                <Panel title="Player tools" eyebrow="SELECTED PAPER AUTHORITY">
                  <div className="profile-tools">
                    <ActionAvailability
                      reason={[
                        ...new Set(
                          [
                            ...actions.map(([, a]) => a),
                            "player.message",
                            "player.gamemode",
                            "console.execute",
                          ]
                            .map((a) => session.reason(a, "PAPER"))
                            .filter(Boolean),
                        ),
                      ].join(" ")}
                    />
                    <div
                      className="inspector-tabs segmented"
                      role="group"
                      aria-label="Player tools"
                    >
                      {[
                        ["interact", "Interact"],
                        ["moderate", "Moderate"],
                        ["commands", "Commands"],
                      ].map(([key, label]) => (
                        <button
                          key={key}
                          id={`player-tool-${key}`}
                          className={playerTab === key ? "active" : ""}
                          aria-pressed={playerTab === key}
                          onClick={() => setPlayerTab(key)}
                          onKeyDown={(event) => {
                            if (
                              ![
                                "ArrowRight",
                                "ArrowLeft",
                                "Home",
                                "End",
                              ].includes(event.key)
                            )
                              return;
                            event.preventDefault();
                            const keys = ["interact", "moderate", "commands"];
                            const index =
                              event.key === "Home"
                                ? 0
                                : event.key === "End"
                                  ? 2
                                  : (keys.indexOf(key) +
                                      (event.key === "ArrowRight" ? 1 : 2)) %
                                    3;
                            setPlayerTab(keys[index]);
                            document
                              .getElementById(`player-tool-${keys[index]}`)
                              ?.focus();
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <section hidden={playerTab !== "interact"}>
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
                            {[
                              "SURVIVAL",
                              "CREATIVE",
                              "ADVENTURE",
                              "SPECTATOR",
                            ].map((mode) => (
                              <option key={mode}>{mode}</option>
                            ))}
                          </select>
                        </label>
                        <Button
                          disabled={
                            !!session.reason("player.gamemode", "PAPER")
                          }
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
                      <div className="button-row supportive-actions">
                        {actions
                          .filter(
                            ([, a]) =>
                              a === "player.heal" || a === "player.feed",
                          )
                          .map(([label, action]) => (
                            <Button
                              key={action}
                              disabled={!!session.reason(action, "PAPER")}
                              title={session.reason(action, "PAPER")}
                              onClick={() =>
                                prepare(action, { playerId: active.uuid })
                              }
                            >
                              {label}
                            </Button>
                          ))}
                      </div>
                    </section>
                    <section hidden={playerTab !== "moderate"}>
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
                        {actions
                          .filter(
                            ([, action]) =>
                              action !== "player.heal" &&
                              action !== "player.feed",
                          )
                          .map(([label, action]) => (
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
                    <section
                      className="player-command"
                      hidden={playerTab !== "commands"}
                    >
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
                    <section
                      className="player-command"
                      hidden={playerTab !== "commands"}
                    >
                      <span className="eyebrow">
                        PERMISSION NODE / LUCKPERMS
                      </span>
                      <label className="field">
                        Node
                        <input
                          value={node}
                          onChange={(e) => setNode(e.target.value)}
                        />
                      </label>
                      <div className="button-row">
                        <Button
                          disabled={
                            !!session.reason("console.execute", "PAPER")
                          }
                          onClick={() => permission("set")}
                        >
                          Review grant
                        </Button>
                        <Button
                          disabled={
                            !!session.reason("console.execute", "PAPER")
                          }
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
                  </div>
                </Panel>
                <PlayerHistory
                  key={`${snap.revision}:${active.uuid}`}
                  uuid={active.uuid}
                />
              </div>
            </>
          ) : (
            <Empty title="Player no longer in the roster">
              Return to players and select a currently reported identity.
              Controls cannot switch to another player automatically.
            </Empty>
          )}
        </div>
      </section>
      <ActionReview prepared={prepared} onClose={() => setPrepared(null)} />
    </>
  );
}

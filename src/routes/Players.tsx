import { Select } from "../components/Select";
import { copy } from "../i18n/en";
import { useEffect, useMemo, useState } from "react";
import { number, str, type JsonMap } from "../adapter/control-state";
import { session, type Prepared } from "../adapter/session";
import { PlayerHead } from "../components/PlayerHead";
import { Button, Notice, Panel, Status } from "../components/ui";
import { ActionReview } from "../features/ActionReview";
import { playerCommand, permissionCommand } from "../lib/playerCommands";
import { useSession } from "../hooks";
import { playerPingMillis } from "../lib/player-telemetry";
type Player = {
  uuid: string;
  name: string;
  world: string;
  ping: number | null;
  onlineMs: number | null;
  raw: JsonMap;
};
const actions = [
  ["Message", "player.message"],
  ["Kick", "player.kick"],
  ["Ban", "player.ban"],
  ["Whitelist", "player.whitelist.add"],
  ["Gamemode", "player.gamemode"],
  ["Heal", "player.heal"],
  ["Feed", "player.feed"],
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
  const snap = useSession();
  const [query, setQuery] = useState("");
  const [world, setWorld] = useState("all");
  const [selected, setSelected] = useState<string>("");
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [commandTemplate, setCommandTemplate] = useState(
    "tell {player} Hello from the console",
  );
  const [node, setNode] = useState("essentials.fly");
  const [builderError, setBuilderError] = useState("");
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [gameMode, setGameMode] = useState("SURVIVAL");
  const players = useMemo<Player[]>(
    () =>
      snap.state.players
        .map((raw) => ({
          uuid: str(raw.uuid, ""),
          name: str(raw.name, "Unknown"),
          world: str(raw.world, "Unknown"),
          ping: playerPingMillis(raw),
          onlineMs: number(raw.onlineDurationMillis),
          raw,
        }))
        .filter(
          (p) =>
            p.uuid &&
            (p.name.toLowerCase().includes(query.toLowerCase()) ||
              p.uuid.includes(query)),
        )
        .filter((p) => world === "all" || p.world === world)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [snap.state.players, query, world],
  );
  const active = players.find((p) => p.uuid === selected) ?? players[0] ?? null;
  const worlds = [
    ...new Set(snap.state.players.map((p) => str(p.world, "Unknown"))),
  ];
  useEffect(() => {
    if (
      snap.phase !== "live" ||
      !snap.state.ready?.agents.paper ||
      session.reason("players.snapshot.request", "PAPER")
    )
      return;

    let active = true;
    const refresh = () => {
      if (!active || document.visibilityState === "hidden") return;
      void session.query("players.snapshot.request", {}, "PAPER").catch(() => {
        /* Periodic roster reconciliation is best-effort; live presence remains authoritative. */
      });
    };

    refresh();
    const timer = window.setInterval(refresh, 5_500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [
    snap.phase,
    snap.revision,
    snap.state.ready?.agents.paper,
    snap.state.ready?.server.paperSession,
  ]);
  const prepare = (action: string, parameters: JsonMap) => {
    setBuilderError("");
    try {
      setPrepared(session.prepare(action, parameters, "PAPER"));
    } catch (error) {
      setBuilderError(
        error instanceof Error ? error.message : "Action unavailable.",
      );
    }
  };
  const runTemplate = () => {
    if (!active) return;
    try {
      prepare("console.execute", {
        command: playerCommand(commandTemplate, active),
      });
    } catch (error) {
      setBuilderError(
        error instanceof Error ? error.message : "Invalid command.",
      );
    }
  };
  const runPermission = (mode: "set" | "unset") => {
    if (!active) return;
    try {
      prepare("console.execute", {
        command: permissionCommand({ player: active.name, node, mode }),
      });
    } catch (error) {
      setBuilderError(
        error instanceof Error ? error.message : "Invalid permission mutation.",
      );
    }
  };
  return (
    <>
      <div className="players-toolbar">
        <label className="field">
          <span className="sr-only">{copy.search_players_e3799}</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={copy.search_name_or_uuid_c0789}
          />
        </label>
        <label className="field">
          <span className="sr-only">{copy.filter_by_world_bd8cb}</span>
          <Select value={world} onChange={(e) => setWorld(e.target.value)}>
            <option value="all">{copy.all_worlds_c07d5}</option>
            {worlds.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
        </label>
        <Status tone={snap.state.ready?.agents.paper ? "success" : "neutral"}>
          {snap.state.players.length}
          {copy._online_74aed}
        </Status>
      </div>
      <div className="players-layout">
        <Panel
          eyebrow={copy.current_server_roster_db94a}
          title={copy.online_players_621c6}
          action={
            <span className="subtle">
              {copy.select_a_player_to_manage_6b0bb}
            </span>
          }
        >
          <div className="roster">
            {players.length ? (
              players.map((player) => (
                <button
                  className={`player-row ${active?.uuid === player.uuid ? "selected" : ""}`}
                  key={player.uuid}
                  onClick={() => setSelected(player.uuid)}
                >
                  <PlayerHead uuid={player.uuid} name={player.name} />
                  <span className="player-identity">
                    <strong>{player.name}</strong>
                    <small>{player.uuid}</small>
                  </span>
                  <span>
                    <b>{player.world}</b>
                    <small>
                      {duration(player.onlineMs)}
                      {copy._online_74aed}
                    </small>
                  </span>
                  <span
                    className={`ping ${player.ping !== null && player.ping > 100 ? "high" : ""}`}
                  >
                    <i />
                    {player.ping === null ? "—" : `${player.ping} ms`}
                  </span>
                </button>
              ))
            ) : (
              <div className="inline-empty">
                <strong>{copy.no_one_is_online_efae1}</strong>
                <span>
                  {snap.state.ready?.agents.paper
                    ? "The server is quiet. New joins appear here as they happen."
                    : "Waiting for the Current server roster."}
                </span>
              </div>
            )}
          </div>
        </Panel>
        <aside className="player-detail" aria-label={copy.player_details_b7849}>
          {active ? (
            <>
              <div className="player-profile">
                <PlayerHead uuid={active.uuid} name={active.name} large />
                <div>
                  <span className="eyebrow">{copy.selected_player_35a76}</span>
                  <h2>{active.name}</h2>
                  <button
                    className="copy-id"
                    onClick={() =>
                      void navigator.clipboard.writeText(active.uuid)
                    }
                  >
                    {copy.copy_uuid_a7685}
                  </button>
                </div>
              </div>
              <dl className="identity-facts">
                <dt>{copy.status_bae7d}</dt>
                <dd>{copy.online_c3e83}</dd>
                <dt>{copy.world_70c07}</dt>
                <dd>{active.world}</dd>
                <dt>{copy.ping_6b68e}</dt>
                <dd>
                  {active.ping === null ? "Unknown" : `${active.ping} ms`}
                </dd>
                <dt>{copy.session_f7f19}</dt>
                <dd>{duration(active.onlineMs)}</dd>
              </dl>
              <section>
                <span className="eyebrow">{copy.player_actions_09698}</span>
                <div className="settings-body" style={{ marginTop: 10 }}>
                  <label className="field">
                    {copy.message_68f41}
                    <input
                      value={message}
                      onChange={(e) =>
                        setMessage(e.target.value.slice(0, 2000))
                      }
                      placeholder={copy.say_hello_1b50c}
                    />
                  </label>
                  <label className="field">
                    {copy.moderation_reason_84b28}
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value.slice(0, 2000))}
                      placeholder={copy.reason_for_kick_or_ban_a046b}
                    />
                  </label>
                  <label className="field">
                    {copy.gamemode_49906}
                    <Select
                      value={gameMode}
                      onChange={(e) => setGameMode(e.target.value)}
                    >
                      {["SURVIVAL", "CREATIVE", "ADVENTURE", "SPECTATOR"].map(
                        (v) => (
                          <option key={v}>{v}</option>
                        ),
                      )}
                    </Select>
                  </label>
                </div>
                <div className="action-grid">
                  {actions.map(([label, action]) => {
                    const reason = session.reason(action, "PAPER");
                    return (
                      <Button
                        key={action}
                        variant={
                          action === "player.ban" || action === "player.kill"
                            ? "danger"
                            : "secondary"
                        }
                        disabled={Boolean(reason)}
                        title={reason}
                        onClick={() =>
                          prepare(action, {
                            playerId: active.uuid,
                            ...(action === "player.message"
                              ? { message }
                              : action === "player.gamemode"
                                ? { gameMode }
                                : ["player.kick", "player.ban"].includes(action)
                                  ? { reason }
                                  : {}),
                          })
                        }
                      >
                        {label}
                      </Button>
                    );
                  })}
                </div>
              </section>
              <details className="player-command"><summary>Advanced player controls</summary>
                <span className="eyebrow">{copy.command_shortcut_01710}</span>
                <label className="field">
                  {copy.template_3ec1a}
                  <input
                    value={commandTemplate}
                    onChange={(e) => setCommandTemplate(e.target.value)}
                  />
                </label>
                <code>
                  {commandTemplate
                    .replaceAll("{player}", active.name)
                    .replaceAll("{uuid}", active.uuid)}
                </code>
                <Button
                  onClick={runTemplate}
                  disabled={Boolean(session.reason("console.execute", "PAPER"))}
                >
                  {copy.review_command_7a98f}
                </Button>
              </details>
              <details className="player-command"><summary>Permissions</summary>
                <span className="eyebrow">{copy.permissions_d06d5}</span>
                <p className="subtle">
                  {copy.uses_a_typed_luckperms_command_only_wh_25602}
                </p>
                <label className="field">
                  {copy.permission_node_743ee}
                  <input
                    value={node}
                    onChange={(e) => setNode(e.target.value)}
                  />
                </label>
                <div className="button-row">
                  <Button onClick={() => runPermission("set")}>
                    {copy.review_grant_88f83}
                  </Button>
                  <Button onClick={() => runPermission("unset")}>
                    {copy.review_removal_05d7a}
                  </Button>
                </div>
              </details>
              <Notice title={copy.effective_permissions_17c0f}>
                {copy.this_server_does_not_report_effective_47033}
              </Notice>
              {builderError && (
                <Notice tone="error" title={copy.cannot_prepare_action_8c8e4}>
                  {builderError}
                </Notice>
              )}
            </>
          ) : (
            <div className="inline-empty">
              <strong>{copy.no_player_selected_5a695}</strong>
              <span>{copy.select_an_online_player_to_inspect_ava_59b6a}</span>
            </div>
          )}
        </aside>
      </div>
      <ActionReview prepared={prepared} onClose={() => setPrepared(null)} />
    </>
  );
}

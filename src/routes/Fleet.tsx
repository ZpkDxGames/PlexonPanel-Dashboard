import { copy } from "../i18n/en";
import { TimeSeries } from "../components/charts/TimeSeries";
import { useSession } from "../hooks";
import { navigate } from "../router";
import { Button, Panel, Status } from "../components/ui";
import { number, str } from "../adapter/control-state";
import { session } from "../adapter/session";
export default function Fleet() {
  const snap = useSession();
  const selected = snap.state.serverId
    ? [{ serverId: snap.state.serverId, phase: snap.phase, state: snap.state }]
    : [];
  const rows = [...selected, ...snap.fleet].filter(
    (row, index, all) =>
      all.findIndex((candidate) => candidate.serverId === row.serverId) ===
      index,
  );
  return (
    <>
      <div className="fleet-layout">
        <Panel
          eyebrow={copy.paired_rooms_76b06}
          title={copy.server_fleet_70125}
          action={
            <Status
              tone={
                rows.some((row) => row.phase === "live") ? "success" : "neutral"
              }
            >
              {rows.length}
              {copy._paired_5c5cc}
            </Status>
          }
        >
          <div className="table-scroll-hint">
            {copy.swipe_to_see_all_server_details_e015d}
          </div>
          <div
            className="fleet-table"
            role="region"
            aria-label={copy.server_fleet_70125}
          >
            <div className="fleet-row fleet-head">
              <span>{copy.server_cb0cb}</span>
              <span>{copy.connection_6512e}</span>
              <span>{copy.players_392fe}</span>
              <span>{copy.tps_1d8e7}</span>
              <span>{copy.last_seen_56462}</span>
              <span />
            </div>
            {rows.length ? (
              rows.map((row) => {
                const name = str(
                  row.state.ready?.server.serverName,
                  snap.labels[row.serverId] ?? row.serverId,
                );
                const tps = number(
                  Array.isArray(row.state.server.tps)
                    ? row.state.server.tps[0]
                    : null,
                );
                return (
                  <div className="fleet-row" key={row.serverId}>
                    <div>
                      <i
                        className={row.phase === "live" ? "server-live" : ""}
                      />
                      <span>
                        <strong>{name}</strong>
                        <small>{row.serverId}</small>
                      </span>
                    </div>
                    <Status
                      tone={
                        row.phase === "live"
                          ? "success"
                          : row.phase === "reconnecting"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {row.phase}
                    </Status>
                    <b>
                      {number(
                        row.state.server.onlinePlayers,
                      )?.toLocaleString() ?? "—"}
                    </b>
                    <b>{tps?.toFixed(2) ?? "—"}</b>
                    <span>
                      {row.state.updatedAt
                        ? new Date(row.state.updatedAt).toLocaleTimeString()
                        : "No sample"}
                    </span>
                    <Button
                      variant="quiet"
                      onClick={() => {
                        void session.select(row.serverId);
                        navigate("Overview");
                      }}
                    >
                      {copy.open_cf9b7}
                    </Button>
                  </div>
                );
              })
            ) : (
              <div className="fleet-empty">
                <strong>{copy.no_paired_servers_8f610}</strong>
                <span>{copy.pair_this_browser_from_settings_your_p_afc86}</span>
                <Button onClick={() => navigate("Settings")}>
                  {copy.open_connection_settings_c9c76}
                </Button>
              </div>
            )}
          </div>
        </Panel>
        <aside className="fleet-summary" aria-label={copy.fleet_summary_52086}>
          <span className="eyebrow">{copy.your_workspace_68d40}</span>
          <h2>{copy.one_home_for_your_servers_39dac}</h2>
          <p>{copy.keep_an_eye_on_your_fleet_then_open_a_74305}</p>
          <dl>
            <dt>{copy.connected_c2f9b}</dt>
            <dd>{rows.filter((row) => row.phase === "live").length}</dd>
            <dt>{copy.attention_74e0b}</dt>
            <dd>{rows.filter((row) => row.phase !== "live").length}</dd>
            <dt>{copy.action_target_b42ae}</dt>
            <dd>{snap.state.serverId ? "1" : "0"}</dd>
          </dl>
        </aside>
      </div>
      <div className="performance-grid" style={{ marginTop: 20 }}>
        <Panel
          title={copy.selected_server_tick_rate_10822}
          eyebrow={copy.a_live_pulse_before_you_open_the_works_e7e29}
        >
          <TimeSeries
            title={copy.selected_server_tick_rate_5b00d}
            samples={snap.state.history}
            height={220}
            threshold={18}
            live={Boolean(snap.state.ready?.agents.paper)}
            series={[
              { key: "tps", label: "TPS", unit: "TPS", color: "var(--c2)" },
            ]}
          />
        </Panel>
        <Panel
          title={copy.selected_server_players_fb96c}
          eyebrow={copy.players_in_the_current_session_24141}
        >
          <TimeSeries
            title={copy.selected_server_players_4ec60}
            samples={snap.state.history}
            height={220}
            live={Boolean(snap.state.ready?.agents.paper)}
            series={[
              {
                key: "players",
                label: "Players",
                unit: "players",
                color: "var(--c1)",
              },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}

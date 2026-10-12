import { BlockMark } from "../components/BlockMark";
import { Button, Status } from "../components/ui";
import { number, str } from "../adapter/control-state";
import { connectionPhaseLabel, session } from "../adapter/session";
import { useSession } from "../hooks";
import { navigate } from "../router";
import { formatTime } from "../lib/time";

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
  const connected = rows.filter((row) => row.phase === "live").length;
  const attention = rows.length - connected;

  const openServer = (serverId: string) => {
    void session.select(serverId);
    navigate("Overview");
  };

  return (
    <main className="fleet-gate">
      <header className="fleet-gate-bar">
        <div className="fleet-brand">
          <BlockMark />
          <span>
            <strong>Plexon</strong>
            <small>Server fleet</small>
          </span>
        </div>
        <div className="fleet-gate-meta">
          <span>
            <i className={connected ? "ok" : ""} />
            {connected} connected
          </span>
          {attention > 0 && <span>{attention} need attention</span>}
          <span>{snap.credentials.length} paired</span>
        </div>
      </header>

      <section className="fleet-gate-content">
        <div className="fleet-gate-intro">
          <span className="eyebrow">Server selection</span>
          <h1>Choose a server workspace.</h1>
          <p>
            Fleet is the entry point to PlexonPanel. Select an instance before
            entering its telemetry, console, players, backups and settings.
          </p>
        </div>

        <div className="fleet-card-grid" aria-label="Paired servers">
          {rows.map((row) => {
            const ready = row.state.ready;
            const name = str(
              ready?.server.serverName,
              snap.labels[row.serverId] ?? row.serverId,
            );
            const tps = number(
              Array.isArray(row.state.server.tps)
                ? row.state.server.tps[0]
                : null,
            );
            const players = number(row.state.server.onlinePlayers);
            const serviceState =
              typeof row.state.service.state === "string"
                ? row.state.service.state
                : "unknown";
            const serviceLabel =
              serviceState === "active"
                ? "Running"
                : serviceState === "inactive" || serviceState === "failed"
                  ? "Stopped"
                  : "Unknown";
            const current = row.serverId === snap.state.serverId;
            const live = row.phase === "live";

            return (
              <article
                className={`fleet-card ${current ? "selected" : ""}`}
                key={row.serverId}
              >
                <div className="fleet-card-head">
                  <div className="fleet-card-mark" aria-hidden="true">
                    <BlockMark />
                  </div>
                  <div className="fleet-card-title">
                    <div>
                      <h2>{name}</h2>
                      {current && <span className="current-chip">Current</span>}
                    </div>
                    <code>
                      {ready?.server.instanceKey ?? row.serverId.slice(0, 8)}
                    </code>
                  </div>
                  <Status
                    tone={
                      live
                        ? "success"
                        : row.phase === "reconnecting"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {live ? "Relay connected" : connectionPhaseLabel(row.phase)}
                  </Status>
                </div>

                <div className="fleet-agent-strip">
                  <span
                    className={
                      ready?.agents.host ? "agent-state live" : "agent-state"
                    }
                  >
                    <i />
                    Host {ready?.agents.host ? "online" : "offline"}
                  </span>
                  <span
                    className={
                      ready?.agents.paper ? "agent-state live" : "agent-state"
                    }
                  >
                    <i />
                    Paper {ready?.agents.paper ? "online" : "offline"}
                  </span>
                  <span
                    className={
                      serviceState === "active"
                        ? "agent-state live"
                        : serviceState === "inactive" ||
                            serviceState === "failed"
                          ? "agent-state warn"
                          : "agent-state"
                    }
                  >
                    <i />
                    Service {serviceLabel.toLowerCase()}
                  </span>
                </div>

                <dl className="fleet-card-stats">
                  <div>
                    <dt>Players</dt>
                    <dd>{players?.toLocaleString() ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>TPS</dt>
                    <dd>{tps?.toFixed(2) ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Last signal</dt>
                    <dd>
                      {row.state.updatedAt
                        ? formatTime(row.state.updatedAt, { seconds: true })
                        : "No sample"}
                    </dd>
                  </div>
                </dl>

                <div className="fleet-card-foot">
                  <span>
                    {ready?.server.minecraftVersion
                      ? `Minecraft ${ready.server.minecraftVersion}`
                      : "Waiting for server identity"}
                  </span>
                  <Button
                    variant="primary"
                    onClick={() => openServer(row.serverId)}
                  >
                    Open workspace
                  </Button>
                </div>
              </article>
            );
          })}
        </div>

        {!rows.length && (
          <div className="fleet-gate-empty">
            <BlockMark />
            <strong>No paired servers are available.</strong>
            <span>Return to pairing to connect a server to this browser.</span>
          </div>
        )}

        <footer className="fleet-gate-footer">
          <span>Protocol 3</span>
          <span>Each server keeps isolated telemetry and command history.</span>
          <span>Selection never merges state across instances.</span>
        </footer>
      </section>
    </main>
  );
}

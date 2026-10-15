import { useState } from "react";
import { useSession, useNow } from "../hooks";
import { number, str } from "../adapter/control-state";
import { session } from "../adapter/session";
import { navigate } from "../router";
import { sourceEvidence, verifiedNodes } from "../presentation/telemetry";
import { Button, Status, Notice, Empty } from "../components/ui";
import { Icon } from "../components/Icon";
import { Sparkline } from "../components/Telemetry";
import { bytes } from "../store/selectors";
export default function Fleet() {
  const snap = useSession(),
    now = useNow(),
    [error, setError] = useState(""),
    [query, setQuery] = useState("");
  const rows = [
      ...(snap.state.serverId
        ? [
            {
              serverId: snap.state.serverId,
              state: snap.state,
              phase: snap.phase,
            },
          ]
        : []),
      ...snap.fleet,
    ].filter(
      (row, index, all) =>
        all.findIndex((other) => other.serverId === row.serverId) === index,
    ),
    nodes = verifiedNodes(rows, now);
  const open = async (id: string) => {
    setError("");
    try {
      if (id !== snap.state.serverId) await session.select(id);
      navigate("Overview");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to select server.",
      );
    }
  };
  return (
    <>
      <div className="directory-intro">
        <div>
          <span className="directory-number">
            {String(rows.length).padStart(2, "0")}
          </span>
          <div>
            <h2>Your server estate.</h2>
            <p>
              {rows.filter((row) => row.phase === "live").length} relay
              connected · {nodes.length} verified nodes
            </p>
          </div>
        </div>
        <Button variant="primary" onClick={() => navigate("Settings")}>
          <Icon name="plus" />
          Pair another server
        </Button>
      </div>
      <div className="directory-toolbar">
        <label className="search-field">
          <Icon name="search" />
          <input
            aria-label="Search servers"
            placeholder="Find a server or instance…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <span className="subtle">
          One selected action target · passive feeds are read only
        </span>
      </div>
      <section className="server-directory" aria-label="Server estate">
        <div className="directory-columns">
          <span>SERVER / INSTANCE</span>
          <span>RUNTIME SIGNAL</span>
          <span>PLAYERS</span>
          <span>SOURCE HEALTH</span>
          <span>WORKSPACE</span>
        </div>
        {rows
          .filter((row) =>
            `${row.state.ready?.server.serverName ?? ""} ${row.serverId} ${row.state.ready?.server.instanceKey ?? ""}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((row, index) => {
            const paper = sourceEvidence(row.state, "paperHealth", now),
              host = sourceEvidence(row.state, "hostSystem", now),
              selected = row.serverId === snap.state.serverId,
              tps = number(
                Array.isArray(row.state.server.tps)
                  ? row.state.server.tps[0]
                  : null,
              );
            return (
              <article
                className={`server-directory-row ${selected ? "selected" : ""}`}
                key={row.serverId}
              >
                <div className="server-directory-identity">
                  <span className="server-initial">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h2>
                      {str(
                        row.state.ready?.server.serverName,
                        snap.labels[row.serverId] ?? row.serverId,
                      )}
                    </h2>
                    <code>
                      {row.state.ready?.server.instanceKey ?? "Legacy instance"}
                    </code>
                    <small>{row.serverId}</small>
                  </div>
                </div>
                <div className="directory-signal">
                  <strong>
                    {row.state.ready?.agents.paper
                      ? (tps?.toFixed(2) ?? "—")
                      : "—"}
                    <small>TPS</small>
                  </strong>
                  <Sparkline samples={row.state.history} metric="tps" />
                </div>
                <div className="directory-players">
                  <strong>
                    {row.state.ready?.agents.paper
                      ? (number(row.state.server.onlinePlayers) ?? "—")
                      : "—"}
                  </strong>
                  <small>players · Paper</small>
                </div>
                <div className="directory-sources">
                  <span>
                    <b>Paper</b>
                    {paper.kind}
                  </span>
                  <span>
                    <b>Host</b>
                    {host.kind}
                  </span>
                  <time title="Source capture timestamp">
                    {paper.capturedAt ?? host.capturedAt ?? "No capture"}
                  </time>
                </div>
                <div className="directory-enter">
                  <Status tone={row.phase === "live" ? "success" : "neutral"}>
                    {selected ? "Selected" : row.phase}
                  </Status>
                  <Button
                    variant="quiet"
                    onClick={() => void open(row.serverId)}
                  >
                    {selected ? "Enter workspace" : "Select server"}
                    <Icon name="arrow" />
                  </Button>
                </div>
              </article>
            );
          })}
        {!rows.length && (
          <Empty title="Your fleet starts here">
            Pair this browser with your first server in Settings.
          </Empty>
        )}
      </section>
      <section className="node-ledger">
        <header className="section-heading">
          <div>
            <span className="eyebrow">HOST / VERIFIED NODE REGISTER</span>
            <h2>The infrastructure underneath.</h2>
          </div>
          <span className="subtle">Shared nodes counted once</span>
        </header>
        {nodes.length ? (
          nodes.map((node) => {
            const memory = bytes(node.memory);
            return (
              <div className="node-row" key={node.nodeId}>
                <Icon name="server" />
                <div>
                  <strong>{node.nodeId}</strong>
                  <small>{str(node.state.hostSystem.capturedAt)}</small>
                </div>
                <div>
                  <strong>{node.cpu?.toFixed(1) ?? "—"}%</strong>
                  <small>Node CPU</small>
                </div>
                <div>
                  <strong>
                    {memory.value} {memory.unit}
                  </strong>
                  <small>Node memory used</small>
                </div>
              </div>
            );
          })
        ) : (
          <Empty title="No verified node measurements">
            Legacy peers remain usable. Aggregation requires fresh, matching
            node identity.
          </Empty>
        )}
      </section>
      {error && (
        <Notice tone="error" title="Server selection">
          {error}
        </Notice>
      )}
    </>
  );
}

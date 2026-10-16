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
import { useTimestamp } from "../presentation/nextgen/time";
export default function Fleet() {
  const stamp = useTimestamp();
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
            <h2>Paired servers</h2>
            <p>
              {rows.filter((row) => row.phase === "live").length} relay
              connected · {nodes.length} verified nodes
            </p>
          </div>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            location.hash = "Settings?section=connection";
          }}
        >
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
        {rows
          .filter((row) =>
            `${row.state.ready?.server.serverName ?? ""} ${row.serverId} ${row.state.ready?.server.instanceKey ?? ""}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((row) => {
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
                <header className="fleet-card-header">
                  <span className="server-initial">
                    <Icon name="server" />
                  </span>
                  <div>
                    <h2>
                      {str(
                        row.state.ready?.server.serverName,
                        snap.labels[row.serverId] ?? row.serverId,
                      )}
                    </h2>
                    <span>
                      {row.state.ready?.server.instanceKey ?? "Legacy instance"}{" "}
                      · Minecraft{" "}
                      {row.state.ready?.server.minecraftVersion ??
                        "unavailable"}
                    </span>
                  </div>
                  <Status tone={row.phase === "live" ? "success" : "neutral"}>
                    {row.phase}
                  </Status>
                </header>
                <div className="fleet-card-metrics">
                  <div className="directory-signal">
                    <span>
                      <small>Paper tick rate</small>
                      <strong>
                        {row.state.ready?.agents.paper
                          ? (tps?.toFixed(2) ?? "—")
                          : "—"}
                        <small>TPS</small>
                      </strong>
                    </span>
                    <Sparkline samples={row.state.history} metric="tps" />
                  </div>
                  <div className="directory-players">
                    <small>Players · Paper</small>
                    <strong>
                      {row.state.ready?.agents.paper
                        ? (number(row.state.server.onlinePlayers) ?? "—")
                        : "—"}
                    </strong>
                  </div>
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
                    {stamp(paper.capturedAt ?? host.capturedAt)}
                  </time>
                </div>
                <details className="fleet-identity">
                  <summary>Instance identity</summary>
                  <code>{row.serverId}</code>
                  <p>
                    {row.state.ready?.server.fleetState ?? "Legacy"} ·{" "}
                    {row.state.ready?.server.nodeId ??
                      "Node identity not reported"}
                  </p>
                </details>
                <div className="directory-enter">
                  <Status tone={row.phase === "live" ? "success" : "neutral"}>
                    {selected ? "Selected" : "Passive observation"}
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
        {rows.filter((row) =>
          `${row.state.ready?.server.serverName ?? ""} ${row.serverId} ${row.state.ready?.server.instanceKey ?? ""}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        ).length === 0 && (
          <Empty
            title={rows.length ? "No matching servers" : "No paired servers"}
          >
            Try another name or pair a server in Connections.
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
                  <small>{stamp(node.state.hostSystem.capturedAt)}</small>
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

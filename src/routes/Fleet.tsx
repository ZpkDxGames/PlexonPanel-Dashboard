import { useState } from "react";
import { useSession, useNow } from "../hooks";
import { number, str } from "../adapter/control-state";
import { session } from "../adapter/session";
import { navigate } from "../router";
import { sourceEvidence, verifiedNodes } from "../presentation/telemetry";
import { Button, Panel, Status, Notice, Empty } from "../components/ui";
import { Icon } from "../components/Icon";
import { Sparkline, SectionLabel } from "../components/Telemetry";
import { bytes } from "../store/selectors";
export default function Fleet() {
  const snap = useSession(),
    now = useNow(),
    [error, setError] = useState("");
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
  );
  const nodes = verifiedNodes(rows, now);
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
      <div className="fleet-command">
        <div className="fleet-totals">
          <div>
            <strong>{rows.length.toString().padStart(2, "0")}</strong>
            <span>Paired servers</span>
          </div>
          <div>
            <strong>
              {rows
                .filter((row) => row.phase === "live")
                .length.toString()
                .padStart(2, "0")}
            </strong>
            <span>Relay connected</span>
          </div>
          <div>
            <strong>{nodes.length.toString().padStart(2, "0")}</strong>
            <span>Verified nodes</span>
          </div>
        </div>
        <Button onClick={() => navigate("Settings")}>
          <Icon name="server" />
          Pair another server
        </Button>
      </div>
      <SectionLabel
        index="01"
        title="Server estate"
        detail="One selected action target"
      />
      <div className="fleet-board">
        {rows.map((row) => {
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
              className={`fleet-card ${selected ? "selected" : ""}`}
              key={row.serverId}
            >
              <header>
                <Icon name="server" />
                <Status tone={row.phase === "live" ? "success" : "neutral"}>
                  {selected ? "Selected · " : ""}
                  {row.phase}
                </Status>
              </header>
              <h2>
                {str(
                  row.state.ready?.server.serverName,
                  snap.labels[row.serverId] ?? row.serverId,
                )}
              </h2>
              <span className="instance-id">
                {row.state.ready?.server.instanceKey ?? "Legacy instance"} /{" "}
                {row.serverId}
              </span>
              <div className="fleet-card-metrics">
                <div>
                  <strong>
                    {row.state.ready?.agents.paper
                      ? (tps?.toFixed(2) ?? "—")
                      : "—"}
                  </strong>
                  <small>TPS · {paper.kind}</small>
                </div>
                <div>
                  <strong>
                    {row.state.ready?.agents.paper
                      ? (number(row.state.server.onlinePlayers) ?? "—")
                      : "—"}
                  </strong>
                  <small>Players · Paper</small>
                </div>
              </div>
              <Sparkline samples={row.state.history} metric="tps" />
              <div className="fleet-card-sources">
                <span>Paper / {paper.label}</span>
                <span>Host / {host.label}</span>
                <time title="Source capture timestamp">
                  {paper.capturedAt ?? host.capturedAt ?? "No source capture"}
                </time>
              </div>
              <footer>
                <span>{selected ? "Active workspace" : "Read-only feed"}</span>
                <Button variant="quiet" onClick={() => void open(row.serverId)}>
                  {selected ? "Enter workspace" : "Select server"}
                  <Icon name="arrow" />
                </Button>
              </footer>
            </article>
          );
        })}
      </div>
      {!rows.length && (
        <Panel>
          <Empty title="Your fleet starts here">
            Pair this browser with your first server in Settings.
          </Empty>
        </Panel>
      )}
      <SectionLabel
        index="02"
        title="Node register"
        detail="Shared nodes counted once"
      />
      <Panel
        title="Infrastructure evidence"
        eyebrow="HOST / NODE AUTHORITY"
        className="node-register"
      >
        {nodes.length ? (
          nodes.map((node) => {
            const memory = bytes(node.memory);
            return (
              <div className="node-row" key={node.nodeId}>
                <div>
                  <strong>{node.nodeId}</strong>
                  <small>{str(node.state.hostSystem.capturedAt)}</small>
                </div>
                <div>
                  {node.cpu?.toFixed(1) ?? "—"}%<small>Node CPU</small>
                </div>
                <div>
                  {memory.value} {memory.unit}
                  <small>Node memory used</small>
                </div>
              </div>
            );
          })
        ) : (
          <Empty title="No verified node measurements">
            Connected legacy peers remain usable. Node aggregation waits for
            matching, fresh fleet metadata.
          </Empty>
        )}
      </Panel>
      {error && (
        <div className="page-notice">
          <Notice tone="error" title="Server selection">
            {error}
          </Notice>
        </div>
      )}
    </>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import type { RelayCredential } from "../lib/browser-store";
import { emptyControlState, type ControlState } from "../lib/control-state";
import { FleetFeed, type FleetSnapshot } from "../lib/fleet-feed";
import { connectionState, type ConnectionPhase } from "../lib/connection-state";
import { fleetCard, nodeSummaries } from "../lib/fleet-model";
import { useTelemetryNow } from "../lib/telemetry-clock";

function bytes(value: number | null): string {
  return value === null ? "Unavailable" : `${(value / 1024 ** 3).toFixed(2)} GiB`;
}
function metric(value: number | null, unit = ""): string {
  return value === null ? "Unavailable" : `${value.toFixed(1)}${unit}`;
}
export function FleetOverview({ credentials, selected, connected, openServer, pair, labels = {}, rememberName, phase }: {
  credentials: readonly RelayCredential[]; selected: ControlState; connected: boolean;
  openServer: (id: string) => void; pair: () => void;
  labels?: Record<string, string>; rememberName?: (id: string, name: string) => void; phase?: ConnectionPhase;
}) {
  const feed = useRef<FleetFeed | null>(null);
  const [snapshots, setSnapshots] = useState<FleetSnapshot[]>([]);
  const now = useTelemetryNow(Math.max(selected.updatedAt, ...snapshots.map(snapshot => snapshot.state.updatedAt)));
  useEffect(() => {
    const manager = new FleetFeed(setSnapshots);
    feed.current = manager;
    return () => { manager.close(); feed.current = null; };
  }, []);
  useEffect(() => { feed.current?.updateRoster(credentials, selected.serverId); }, [credentials, selected.serverId]);
  useEffect(() => {
    for (const snapshot of snapshots) {
      const name = snapshot.state.ready?.server.serverName;
      if (snapshot.phase === "live" && name) rememberName?.(snapshot.serverId, name);
    }
  }, [snapshots, rememberName]);
  const entries = credentials.map(credential => credential.serverId === selected.serverId
    ? { serverId: selected.serverId, state: selected, phase: connected ? "live" as const : phase === "connecting" ? "connecting" as const : "reconnecting" as const }
    : snapshots.find(snapshot => snapshot.serverId === credential.serverId) ??
      { serverId: credential.serverId, state: emptyControlState(credential.serverId), phase: "connecting" as const });
  const cards = entries.map(entry => ({ ...fleetCard(entry.state, entry.phase, now),
    name: entry.state.ready?.server.serverName || labels[entry.serverId] || `Server ${entry.serverId.slice(0, 8)}`,
    connection: connectionState(entry.state, entry.phase, now) }));
  const nodes = nodeSummaries(entries.filter(entry => entry.phase === "live").map(entry => entry.state), now);
  return <section className="fleet-workspace" aria-labelledby="fleet-title">
    <header className="fleet-heading"><div><p className="cr21-kicker">PAIRED SERVERS</p>
      <h1 id="fleet-title">Your servers</h1><p>One place for every server. Choose a workspace to get started.</p></div>
      <button type="button" onClick={pair}>Pair another server</button></header>
    {!cards.length && <p className="fleet-empty">No paired servers yet. Pair a server to open its workspace.</p>}
    <div className="fleet-cards">
      {cards.map(card => <article key={card.serverId} className="fleet-card" data-selected={card.serverId === selected.serverId}>
        <header><div><h2>{card.name}</h2><span className="fleet-id">{card.serverId.slice(0, 8)}{card.serverId === selected.serverId && " · Last selected"}</span></div>
          <span className={`fleet-status fleet-status-${card.status}`}>{card.connection.label}</span></header>
        <p className="fleet-reason">{card.connection.detail}</p>
        <dl className="fleet-metrics">
          <div><dt>Players</dt><dd>{card.players ?? "Unavailable"}</dd></div>
          <div><dt>TPS / MSPT</dt><dd>{metric(card.tps)} / {metric(card.mspt)}</dd></div>
          <div><dt>Minecraft service CPU</dt><dd>{metric(card.serviceCpu, "%")}</dd><small>100% = one CPU core</small></div>
          <div><dt>Minecraft service memory</dt><dd>{bytes(card.serviceMemory)}</dd></div>
        </dl>
        <p className="fleet-source">Relay: {card.connection.relay} · Host: {card.connection.host}</p>
        <p className="fleet-source">Minecraft: {card.connection.minecraft}</p>
        {card.nodeId && cards.filter(other => other.nodeId === card.nodeId).length > 1 &&
          <p className="fleet-source">Shared node · {cards.filter(other => other.nodeId === card.nodeId).length} paired servers</p>}
        <p className="fleet-source">Last sample: {card.lastUpdate === null ? "unavailable" : new Date(card.lastUpdate).toLocaleTimeString()}</p>
        <button type="button" onClick={() => openServer(card.serverId)} aria-label={`Open ${card.name} ${card.serverId.slice(0, 8)}`}>
          {card.serverId === selected.serverId ? "Continue to workspace" : "Open server"}</button>
      </article>)}
    </div>
    <details className="fleet-node-details"><summary>Shared infrastructure <span>{nodes.length} {nodes.length === 1 ? "node" : "nodes"}</span></summary><p className="fleet-source">Node totals use one fresh Host sample per node.</p>
    {!nodes.length && <p className="fleet-empty">No authenticated fleet node association is available yet.</p>}
    <div className="fleet-nodes">
      {nodes.map(node => <article key={node.nodeId} className="fleet-card"><header><h3>Node {node.nodeId.slice(0, 8)}</h3><span>{node.servers} paired {node.servers === 1 ? "server" : "servers"}</span></header>
        <dl className="fleet-metrics"><div><dt>Node CPU</dt><dd>{metric(node.cpu, "%")}</dd></div>
          <div><dt>Node memory used / total</dt><dd>{bytes(node.usedMemory)} / {bytes(node.totalMemory)}</dd></div>
          <div><dt>Sampled filesystem used / total</dt><dd>{bytes(node.diskUsed)} / {bytes(node.diskTotal)}</dd></div></dl>
        <p className="fleet-source">{node.sourceServerId ? `Host source: ${node.sourceServerId.slice(0, 8)}` : "No fresh connected Host sample"}</p>
      </article>)}
    </div></details>
  </section>;
}

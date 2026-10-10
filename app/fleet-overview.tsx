"use client";
import { useEffect, useRef, useState } from "react";
import type { RelayCredential } from "../lib/browser-store";
import { capturedAtMillis, number, emptyControlState, type Sample, type ControlState } from "../lib/control-state";
import { FleetFeed, type FleetSnapshot } from "../lib/fleet-feed";
import { connectionState, type ConnectionPhase } from "../lib/connection-state";
import { fleetCard, nodeSummaries } from "../lib/fleet-model";
import { useTelemetryNow } from "../lib/telemetry-clock";

import { Badge, Button, Empty, PageHeader, Panel, SourceFacts } from './ui/workspace';
import { Disclosure } from './ui/primitives';
import { TickPulse } from './charts/tick-pulse';

function latestHistory(state:ControlState):Sample[] {
  if(state.history.length)return state.history;
  const at=capturedAtMillis(state.server.capturedAt);
  return at===null?[]:[{at,sources:{paperHealth:at,paperSystem:null,hostSystem:null,service:null},tps:number(Array.isArray(state.server.tps)?state.server.tps[0]:null),mspt:number(state.server.averageTickMillis),players:number(state.server.onlinePlayers),heap:null,hostCpu:null,processCpu:null,memory:null,gc:null,serviceCpu:null,serviceMemory:null}];
}
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
  const [layout,setLayout]=useState("grid");
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
  const online=cards.filter(card=>card.status==='online').length;
  return <div className="pp-workspace" data-ui6-workspace="Fleet">
    <PageHeader title="Your servers" description={!cards.length?'Pair a server to open its workspace.':online===0?'All paired instances need a connection review.':online<cards.length?'Some instances need a connection review.':`${cards.length} paired ${cards.length===1?'instance':'instances'} ready to inspect.`} primary={<Button variant="primary" onClick={pair}>Pair another server</Button>} secondary={<div className="pp-segmented" aria-label="Instance layout"><Button aria-pressed={layout==='grid'} onClick={()=>setLayout('grid')}>Grid</Button><Button aria-pressed={layout==='list'} onClick={()=>setLayout('list')}>List</Button></div>}/>
    <Panel title="Shared infrastructure" aside={<Badge>{nodes.length} {nodes.length===1?'node':'nodes'}</Badge>}>
      <div className="pp-reserved-region" role="region" aria-label="Shared node totals" tabIndex={0}>
        {nodes.length?nodes.map(node=><article className="pp-record" key={node.nodeId}>
          <header><h3>Node {node.nodeId.slice(0,8)}</h3><span className="pp-muted">{node.servers} paired {node.servers===1?'server':'servers'}</span></header>
          <dl className="pp-facts"><div><dt>Host CPU (machine)</dt><dd>{metric(node.cpu,'%')}</dd></div><div><dt>Host RAM used / total</dt><dd>{bytes(node.usedMemory)} / {bytes(node.totalMemory)}</dd></div><div><dt>Filesystem used / total</dt><dd>{bytes(node.diskUsed)} / {bytes(node.diskTotal)}</dd></div></dl>
          <Disclosure title="Node source details"><p className="pp-muted">One fresh Host sample per node. {node.sourceServerId?`Host source: ${node.sourceServerId.slice(0,8)}`:'No fresh connected Host sample.'}</p><SourceFacts source="Host node" unit="CPU percent; memory and filesystem bytes" capturedAt={entries.find(entry=>entry.serverId===node.sourceServerId)?.state.hostSystem.capturedAt} receivedAt={entries.find(entry=>entry.serverId===node.sourceServerId)?.state.updatedAt}/></Disclosure>
        </article>):<Empty title="Shared totals unavailable">A fresh authenticated Host node association is required.</Empty>}
      </div>
    </Panel>
    {!cards.length&&<Empty title="No paired servers">Use Pair another server to connect your first instance.</Empty>}
    <div className="pp-data-grid" data-layout={layout} aria-label="Paired instances">
      {cards.map(card=>{const entry=entries.find(entry=>entry.serverId===card.serverId)!;return <article key={card.serverId} className="fleet-card pp-record" data-selected={card.serverId===selected.serverId}>
        <header><div><h3>{card.name}</h3><small className="pp-muted">{card.serverId.slice(0,8)}{card.serverId===selected.serverId?' / Last selected':''}</small></div><Badge tone={card.status==='online'?'green':card.status==='offline'?'quiet':'amber'}>{card.connection.label}</Badge></header>
        <p className="pp-muted pp-status-line">Relay: {card.connection.relay}. Host: {card.connection.host}. Minecraft: {card.connection.minecraft}.</p>
        <dl className="pp-facts"><div><dt>Players</dt><dd>{card.players??'Unavailable'}</dd></div><div><dt>TPS / MSPT</dt><dd>{metric(card.tps)} / {metric(card.mspt)}</dd></div><div><dt>Minecraft service CPU</dt><dd>{metric(card.serviceCpu,'%')}<small className="pp-muted"> / 100% = one CPU core</small></dd></div><div><dt>Minecraft service memory</dt><dd>{bytes(card.serviceMemory)}</dd></div><div><dt>Last seen</dt><dd>{card.lastUpdate===null?'Unavailable':new Date(card.lastUpdate).toLocaleTimeString()}</dd></div></dl>
        <TickPulse history={latestHistory(entry.state)} receivedAt={entry.state.updatedAt} compact accessibleLabel={`Tick Pulse for ${card.name}`} status={card.connection.label}/>
        {!entry.state.history.length&&<small className="pp-muted">Latest Paper capture only. Background Fleet subscriptions do not retain history.</small>}
        <Disclosure title="Connection sources"><p>{card.connection.detail}</p><SourceFacts source="Paper health" unit="ticks/s; milliseconds; players" capturedAt={entry.state.server.capturedAt} receivedAt={entry.state.updatedAt}/><SourceFacts source="Host service cgroup" unit="CPU percent of one core; memory bytes" capturedAt={(entry.state.service.resources as Record<string,unknown>)?.capturedAt} receivedAt={entry.state.updatedAt}/>{card.nodeId&&<p className="pp-muted">Shared node {card.nodeId.slice(0,8)}.</p>}</Disclosure>
        <Button onClick={()=>openServer(card.serverId)} aria-label={`Open ${card.name} ${card.serverId.slice(0,8)}`}>{card.serverId===selected.serverId?'Continue to workspace':'Open server'}</Button>
      </article>})}
    </div>
  </div>;
}

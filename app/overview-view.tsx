'use client';
import './styles/overview.css';
import { memo, useEffect, useState } from 'react';
import { bytes, duration, time, useQuery, type ViewProps } from './control-views';
import { Badge, Button, Disclosure, EmptyState, Panel, Popover } from './ui/primitives';
import { ActivityHistoryModal } from './activity-history-modal';
import { TelemetryChart, type ChartSpec } from './telemetry-chart';
import { TickPulse } from './charts/tick-pulse';
import { Sparkline } from './charts/sparkline';
import { capturedAtMillis, diagnostics, number, record, str } from '../lib/control-state';
import { METRICS, type MetricField } from '../lib/metric-reports';
import { classifyTelemetry } from '../lib/telemetry-freshness';
import { clockDiagnostics } from '../lib/clock-diagnostics';
import { useTelemetryNow } from '../lib/telemetry-clock';
import { fleetCard } from '../lib/fleet-model';
import { normalizeServiceState } from '../lib/lifecycle-state';
import { useUiPreferences } from '../components/ui-preferences-provider';
const charts: ChartSpec[] = [{ field: 'tps', label: 'Tick health', shortLabel: 'TPS', format: n => `${n.toFixed(2)} TPS`, source: 'paper-health', domain: [0, 20], series: 1 }, { field: 'mspt', label: 'Tick duration', shortLabel: 'MSPT', format: n => `${n.toFixed(2)} ms`, source: 'paper-health', reference: { value: 50, label: '50 ms tick budget' }, series: 2 }];
const fresh = (f: ReturnType<typeof classifyTelemetry>) => f.usable;
const label = (f: ReturnType<typeof classifyTelemetry>) => f.label;
const Instrument = memo(function Instrument({ props, field, title, value, detail, capturedAt, receivedAt, connected, now, importance, warning }: {
    props: ViewProps;
    field: MetricField;
    title: string;
    value: string;
    detail: string;
    capturedAt: unknown;
    receivedAt?:number;
    connected: boolean;
    now: number;
    importance: 'primary' | 'presence' | 'resource';
    warning?:string;
}) {
    const freshness = classifyTelemetry({capturedAt,receivedAt,connected,now});
    const source = METRICS[field].origin.replace(' · ', ' / ');
    return <article className={`instrument instrument-${importance}`} data-instrument={field}><div className="instrument-label"><h3>{title}</h3><span>{source}</span></div><div className="instrument-reading"><strong>{value}</strong><small>{detail}</small>{warning&&<Badge tone="warn">{warning}</Badge>}</div><Sparkline history={props.state.history} field={field} now={now} sourceCapturedAt={capturedAt} intervalMs={number(field === 'heap' ? props.state.system.sourceIntervalMillis : field === 'serviceCpu' || field === 'serviceMemory' ? record(props.state.service.resources).sourceIntervalMillis : props.state.server.sourceIntervalMillis) ?? METRICS[field].intervalMs}/><div className="instrument-provenance"><span>{label(freshness)}</span><Popover label={`${title} source`} title={`${title} freshness`}><dl className="pulse-facts"><div><dt>Source</dt><dd>{source}</dd></div><div><dt>Unit</dt><dd>{METRICS[field].unit}</dd></div><div><dt>Captured</dt><dd>{typeof capturedAt === 'string' ? capturedAt : 'Not supplied'}</dd></div><div><dt>Latest browser receipt</dt><dd>{receivedAt ? new Date(receivedAt).toISOString() : 'Not supplied'}</dd></div></dl><p>Per-capture receipt is not supplied. Unknown and stale values are unavailable; history retains observed values and gaps.</p></Popover></div></article>;
}, (a,b) => a.props.state.serverId===b.props.state.serverId && a.field===b.field && a.title===b.title && a.value===b.value && a.detail===b.detail && a.capturedAt===b.capturedAt && a.receivedAt===b.receivedAt && a.connected===b.connected && classifyTelemetry({capturedAt:a.capturedAt,receivedAt:a.receivedAt,connected:a.connected,now:a.now}).label===classifyTelemetry({capturedAt:b.capturedAt,receivedAt:b.receivedAt,connected:b.connected,now:b.now}).label && a.importance===b.importance && a.warning===b.warning);
function OverviewAttention({props,host,paper,service}:{props:ViewProps;host:boolean;paper:boolean;service:ReturnType<typeof classifyTelemetry>}) {
    const {state}=props;
    const backupReadAllowed = host && props.can('maintenance.status', 'HOST');
    const status = useQuery('maintenance.status', {}, backupReadAllowed, 'HOST');
    const operation = status.hasSuccess ? record(status.data.currentOperation) : {};
    const progress = record(state.backupProgress);
    const progressJob = str(progress.jobId, '');
    const progressPhase = str(progress.phase, '');
    const refreshStatus = status.refresh;
    useEffect(() => { if (backupReadAllowed && progressJob)
        refreshStatus(); }, [backupReadAllowed, progressJob, progressPhase, refreshStatus]);
    const phase = progressJob && progressJob === str(operation.jobId, '') && ['DEGRADED', 'FAILED', 'RECOVERY_REQUIRED'].includes(progressPhase) ? progressPhase : str(operation.phase, '');
    const attention = [...(!host ? [{ text: 'Host unavailable — service controls and backups need Host.', workspace: 'Server' as const }] : state.ready?.server.hostTargetCompatible === false || service.kind === 'stale' || ['failed'].includes(normalizeServiceState(state.service.state)) ? [{ text: 'Host service needs review. Check its state and source freshness.', workspace: 'Server' as const }] : []), ...(!paper ? [{ text: 'Paper offline — game telemetry is unavailable.', workspace: 'Server' as const }] : []), ...((['DEGRADED', 'RECOVERY_REQUIRED'].includes(phase) || phase === 'FAILED' && operation.retryable === true) ? [{ text: `Backup ${phase.toLowerCase().replaceAll('_', ' ')} — review the supplied job state.`, workspace: 'Backups' as const }] : [])];
    return attention.length > 0 ? <section className="overview-attention" aria-label="Needs attention"><h2>Needs attention</h2>{attention.map((a, i) => <div key={i}><Badge tone="warn">Review</Badge><span>{a.text}</span><Button variant="quiet" onClick={() => props.navigate?.(a.workspace)}>Open {a.workspace}</Button></div>)}</section> : null;
}
export function OverviewView(props: ViewProps) {
    const { state } = props;
    const { preferences } = useUiPreferences();
    const now = useTelemetryNow(state.updatedAt);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [chartsOpen,setChartsOpen]=useState(false);
    const paper = props.connected && !state.cached && Boolean(state.ready?.agents.paper);
    const host = props.connected && !state.cached && Boolean(state.ready?.agents.host);
    const health = classifyTelemetry({capturedAt:state.server.capturedAt,receivedAt:state.receipts?.paperHealth,connected:paper,now}), jvm = classifyTelemetry({capturedAt:state.system.capturedAt,receivedAt:state.receipts?.paperSystem,connected:paper,now});
    const resources = record(state.service.resources);
    const service = classifyTelemetry({capturedAt:resources.capturedAt,receivedAt:state.receipts?.service,connected:host,now});
    const serviceClockIsLatest=capturedAtMillis(resources.capturedAt)!==null&&(capturedAtMillis(state.hostSystem.capturedAt)===null||(state.receipts?.service??0)>(state.receipts?.hostSystem??0));
    const clocks = clockDiagnostics({now,paperCapturedAt:state.server.capturedAt,paperReceivedAt:state.receipts?.paperHealth,hostCapturedAt:serviceClockIsLatest?resources.capturedAt:state.hostSystem.capturedAt,hostReceivedAt:serviceClockIsLatest?state.receipts?.service:state.receipts?.hostSystem});
    const card = fleetCard(state, props.connected ? 'live' : 'reconnecting', now);
    const activity = state.presenceDeltas.slice(-6).reverse();
    const unavailable = '—';
    const common = { props, now };
    const numeric = (n: number | null, unit: string, digits = 2) => n === null || n < 0 ? unavailable : `${n.toFixed(digits)}${unit}`;
    return <div className="overview-workspace" data-ui6-overview>
  <TickPulse history={state.history} receivedAt={state.receipts?.paperHealth??0} capturedAt={state.server.capturedAt??null} connected={paper} windowEndAt={props.pulseWindowEndAt} intervalMs={number(state.server.sourceIntervalMillis) ?? 2000} status={!paper ? 'Paper disconnected' : label(health)}/>
  <OverviewAttention key={state.ready?.server.hostSession ?? 'no-host-session'} props={props} host={host} paper={paper} service={service}/>
  <section className="overview-instruments" aria-labelledby="overview-instrument-title"><h2 id="overview-instrument-title" className="pp-sr-only">Server instruments</h2>
   <Instrument {...common} field="tps" warning={card.tps!==null&&card.tps<18?'Below target':undefined} title="TPS" value={numeric(card.tps, '')} detail="ticks/s / 20 target" capturedAt={state.server.capturedAt} receivedAt={state.receipts?.paperHealth} connected={paper} importance="primary"/>
   <Instrument {...common} field="mspt" warning={card.mspt!==null&&card.mspt>50?'Tick budget exceeded':undefined} title="MSPT" value={numeric(card.mspt, ' ms')} detail="50 ms tick budget" capturedAt={state.server.capturedAt} receivedAt={state.receipts?.paperHealth} connected={paper} importance="primary"/>
   <Instrument {...common} field="players" title="Online players" value={card.players === null ? unavailable : String(card.players)} detail={`${number(state.server.maximumPlayers) ?? 'Unknown'} slots`} capturedAt={state.server.capturedAt} receivedAt={state.receipts?.paperHealth} connected={paper} importance="presence"/>
   <Instrument {...common} field="heap" title="JVM heap" value={fresh(jvm) ? bytes(state.system.jvmHeapUsedBytes) : unavailable} detail={`${fresh(jvm) ? bytes(state.system.jvmHeapMaximumBytes) : 'Unknown'} capacity`} capturedAt={state.system.capturedAt} receivedAt={state.receipts?.paperSystem} connected={paper} importance="resource"/>
   <Instrument {...common} field="serviceCpu" title="Service CPU" value={numeric(card.serviceCpu, '%', 1)} detail="100% = one core" capturedAt={resources.capturedAt} receivedAt={state.receipts?.service} connected={host} importance="resource"/>
   <Instrument {...common} field="serviceMemory" title="Service RAM" value={card.serviceMemory === null ? unavailable : bytes(card.serviceMemory)} detail="Minecraft cgroup / separate from heap" capturedAt={resources.capturedAt} receivedAt={state.receipts?.service} connected={host} importance="resource"/>
  </section>
  <section className="overview-identity" aria-label="Selected instance identity"><div><span>Selected instance</span><strong>{state.ready?.server.instanceKey ?? 'Identity unavailable'}</strong><code>{state.serverId}</code></div><dl><div><dt>Host service</dt><dd>{host && state.ready?.server.hostTargetCompatible !== false ? normalizeServiceState(state.service.state) : 'Unknown'} / {label(service)}</dd></div><div><dt>Service uptime</dt><dd>Not supplied</dd></div><div><dt>Paper uptime</dt><dd>{fresh(jvm) ? state.system.processUptimeMillis===undefined?'Not supplied':duration(state.system.processUptimeMillis) : unavailable}</dd></div><div><dt>Minecraft version</dt><dd>{state.ready?.server.minecraftVersion ?? unavailable}</dd></div><div><dt>Paper agent version</dt><dd>{state.ready?.server.pluginVersion ?? unavailable}</dd></div></dl></section>
  <div className="overview-details"><Panel title="Recent presence activity" actions={<Button variant="quiet" onClick={() => setHistoryOpen(true)}>View history</Button>}>{activity.length ? <ol className="overview-presence">{activity.map(event => <li key={str(event.eventId, `${event.uuid}-${event.observedAt}`)}><strong>{str(event.name, 'Player')}</strong><span>Observed {event.state === 'LEFT' ? 'leave' : 'join'} from Paper</span><time>{time(event.observedAt)}</time></li>)}</ol> : <EmptyState title="No recent presence activity">Authorized Paper join and leave observations appear here.</EmptyState>}</Panel><Panel title="World activity" actions={<span>{state.worlds.length ? `${state.worlds.length} ${state.worlds.length===1?'world':'worlds'}` : 'No world rows'}</span>}>{fresh(health) && state.worlds.length ? <div className="overview-worlds" tabIndex={0} role="region" aria-label="World activity table"><table><caption className="pp-sr-only">Paper world activity; capture time unavailable</caption><thead><tr><th scope="col">World</th><th scope="col">Players</th><th scope="col">Chunks</th><th scope="col">Entities</th></tr></thead><tbody>{state.worlds.slice(0, 8).map(world => <tr key={str(world.name)}><th scope="row">{str(world.name)}</th><td>{String(world.players ?? unavailable)}</td><td>{String(world.loadedChunks ?? unavailable)}</td><td>{String(world.entities ?? unavailable)}</td></tr>)}</tbody></table></div> : <EmptyState title="Waiting for world telemetry">Fresh Paper health and supplied world rows are required. World capture time is not retained in this view.</EmptyState>}</Panel></div>
  <details className="pp-disclosure" onToggle={event=>setChartsOpen(event.currentTarget.open)}><summary>Tick history charts</summary>{chartsOpen&&<div className="pp-stack"><div className="workspace-chart-grid">{charts.map(spec => <TelemetryChart key={spec.field} history={state.history} spec={spec} windowMinutes={preferences.chartWindowMinutes} sourceLabel="Paper health / source capture" sourceIntervalMs={number(state.server.sourceIntervalMillis)} sourceCapturedAt={capturedAtMillis(state.server.capturedAt)} receivedAt={state.receipts?.paperHealth} status={!paper ? 'disconnected' : fresh(health) ? 'live' : 'stale'}/>)}</div></div>}</details>
  <Disclosure title="Source details and safe diagnostics"><section aria-label="Clocks"><h3>Clocks</h3><dl className="pulse-facts pp-tabular">{clocks.rows.map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl><p>{clocks.interpretation}</p><Button onClick={()=>void navigator.clipboard.writeText(clocks.text).then(()=>props.notice('Clock details copied.')).catch(()=>props.notice('Could not copy clock details.'))}>Copy clock details</Button></section><dl className="pulse-facts"><div><dt>Paper health</dt><dd>{label(health)}</dd></div><div><dt>Paper JVM</dt><dd>{label(jvm)}</dd></div><div><dt>Host service</dt><dd>{label(service)}</dd></div><div><dt>World numbers</dt><dd>Paper world telemetry; units: players, chunks and entities. World capture timestamp is not retained. Latest browser receipt (any packet): {state.updatedAt?new Date(state.updatedAt).toISOString():'Not supplied'}.</dd></div><div><dt>Shared node</dt><dd>{label(classifyTelemetry({capturedAt:state.hostSystem.capturedAt,receivedAt:state.receipts?.hostSystem,connected:host,now}))}; shown in Fleet and Performance, separate from service CPU.</dd></div></dl><Button onClick={() => void navigator.clipboard.writeText(diagnostics(state)).then(() => props.notice('Safe diagnostics copied.')).catch(() => props.notice('Could not copy safe diagnostics.'))}>Copy safe diagnostics</Button></Disclosure>
  {historyOpen && <ActivityHistoryModal props={props} open onClose={() => setHistoryOpen(false)}/>}
 </div>;
}

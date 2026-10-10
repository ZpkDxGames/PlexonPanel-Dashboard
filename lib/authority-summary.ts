import { record, type ControlState } from './control-state';
import { fresh } from './fleet-model';
import type { ConnectionState } from './connection-state';
/** Presentation only. A healthy source never supplies another source's state. */
export function authoritySummary(state: ControlState, live: boolean, connection: ConnectionState, now: number) {
    const relay = live && !state.cached && Boolean(state.ready);
    const paper = relay && Boolean(state.ready?.agents.paper) && state.ready?.server.paperTargetCompatible !== false && fresh(state.server.capturedAt, now,state.receipts?.paperHealth);
    const host = relay && Boolean(state.ready?.agents.host) && state.ready?.server.hostTargetCompatible !== false && fresh(record(state.service.resources).capturedAt, now,state.receipts?.service);
    const console = relay && (state.ready?.consoleAuthority === 'HOST' ? host : state.ready?.consoleAuthority === 'PAPER_FALLBACK' ? paper : false);
    const count = [relay, paper, host, console].filter(Boolean).length;
    const words: Record<ConnectionState['kind'], string> = { online: count === 4 ? 'Online' : 'Degraded', connecting: 'Connecting', 'relay-unavailable': 'Offline', 'access-required': 'Access needed', limited: 'Paused', 'host-disconnected': 'Degraded', stopped: 'Stopped', starting: 'Starting', stopping: 'Stopping', failed: 'Failed', 'paper-disconnected': 'Degraded', incompatible: 'Degraded', stale: 'Stale', skew:'Clock skew' };
    return { word: words[connection.kind], count };
}

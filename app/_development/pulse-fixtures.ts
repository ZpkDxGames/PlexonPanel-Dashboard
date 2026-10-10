import type { Sample } from '../../lib/control-state';
// Test specimens are excluded along with the development laboratory.
export const PULSE_FIXTURE_MARKER = 'PLEXON_UI6_PULSE_FIXTURES_DEV_ONLY';
const end = Date.now();
const sample = (at: number, tps: number | null = 20, mspt: number | null = 12): Sample => ({ at, sources: { paperHealth: at, paperSystem: null, hostSystem: null, service: null }, tps, mspt, players: 3, heap: null, processCpu: null, hostCpu: null, memory: null, serviceCpu: null, serviceMemory: null, gc: null });
export const pulseSpecimens = [
    { name: 'Raw captures', intervalMs:90000, end, history: Array.from({ length: 20 }, (_, i) => sample(end - 1800000 + i * 90000)) },
    { name: 'Dense summarized', end, history: Array.from({ length: 3600 }, (_, i) => sample(end - 1800000 + i * 500, i % 100 < 5 ? 14 : 20, i % 100 < 5 ? 70 : 12)) },
    { name: 'Gaps, unknowns and real zero', end, history: [sample(end - 1800000), sample(end - 1798000, null, null), sample(end - 1200000, 0, 0), sample(end - 1180000, 18, 56), sample(end)] },
    { name: 'Lagging with ceiling overflow', end, history: Array.from({length:120},(_,i)=>sample(end-60000+i*500,14.999,i%12===0?150:80)) },
    { name: 'Stale captures', end:end-60000, history:[sample(end-120000),sample(end-60000)] },
    { name: 'Paper disconnected, retained observations', end:end-30000, history:[sample(end-120000),sample(end-30000)] },
    { name: 'Empty history', end, history: [] },
];

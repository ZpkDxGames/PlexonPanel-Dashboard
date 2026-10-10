import type { Sample } from './control-state';
import type { TickCapture } from './tick-pulse-model';
/** Only signed Paper-health provenance. Packet receipt and Host captures are not tick time. */
export function tickObservations(history: readonly Sample[]): TickCapture[] {
    const captures = new Map<number, TickCapture>();
    for (const sample of history) {
        const at = sample.sources?.paperHealth;
        if (at === null || at === undefined || !Number.isFinite(at) || at < 0)
            continue;
        captures.set(at, { capturedAt: at, tps: sample.tps !== null && Number.isFinite(sample.tps) && sample.tps >= 0 ? sample.tps : null, mspt: sample.mspt !== null && Number.isFinite(sample.mspt) && sample.mspt >= 0 ? sample.mspt : null });
    }
    return [...captures.values()].sort((a, b) => a.capturedAt - b.capturedAt);
}
export function nearestCapture(captures: readonly TickCapture[], at: number): number {
    if (!captures.length)
        return -1;
    let low = 0, high = captures.length - 1;
    while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (captures[mid].capturedAt < at)
            low = mid + 1;
        else
            high = mid;
    }
    return low > 0 && at - captures[low - 1].capturedAt <= captures[low].capturedAt - at ? low - 1 : low;
}

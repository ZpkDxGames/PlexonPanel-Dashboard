import type { ControlState, Sample } from "../adapter/control-state";
import type { Source } from "./telemetry";
const sources: Source[] = [
  "paperHealth",
  "paperSystem",
  "hostSystem",
  "service",
];
/** A source generation change invalidates its plot view, never its signed/raw history. */
export class SourceEpochs {
  private revision: number | undefined;
  private entries = new Map<
    Source,
    {
      key: string;
      excluded: WeakSet<Sample>;
      cache: WeakMap<Sample[], Sample[]>;
    }
  >();
  update(state: ControlState, revision: number) {
    if (this.revision !== revision) {
      this.entries.clear();
      this.revision = revision;
    }
    if (!state.ready) return;
    for (const source of sources) {
      const paper = source.startsWith("paper"),
        key = `${paper ? (state.ready.server.paperSession ?? "legacy") : (state.ready.server.hostSession ?? "legacy")}:${state.ready.agents[paper ? "paper" : "host"]}`;
      const prior = this.entries.get(source);
      if (!prior)
        this.entries.set(source, {
          key,
          excluded: new WeakSet(),
          cache: new WeakMap(),
        });
      else if (prior.key !== key)
        this.entries.set(source, {
          key,
          excluded: new WeakSet(state.history),
          cache: new WeakMap(),
        });
    }
  }
  view(history: Sample[], source: Source): Sample[] {
    const entry = this.entries.get(source);
    if (!entry) return history;
    const cached = entry.cache.get(history);
    if (cached) return cached;
    const eligible = history.filter((sample) => !entry.excluded.has(sample));
    const result = eligible.length === history.length ? history : eligible;
    entry.cache.set(history, result);
    return result;
  }
}

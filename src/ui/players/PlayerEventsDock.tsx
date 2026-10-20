"use client";
import { usePrefs, useViewSync, useRoster, time } from "../bindings";
import { usePlayerInspect } from "../bindings/usePlayerInspect";
import { useBootHistory } from "./PlayerEventsFeeder";
import { usePlayerEvents, type PlayerEventKind } from "./player-events";
const FILTERS = [
  { id: "all", label: "All" },
  { id: "presence", label: "Joins & leaves" },
  { id: "advancement", label: "Advancements" },
  { id: "death", label: "Deaths" },
  { id: "command", label: "Commands" },
] as const;
const GLYPH: Record<PlayerEventKind, { icon: string; verb: string }> = {
  join: { icon: "→", verb: "joined" },
  online: { icon: "●", verb: "is online" },
  leave: { icon: "←", verb: "left" },
  advancement: { icon: "★", verb: "earned" },
  death: { icon: "✕", verb: "died" },
  command: { icon: "/", verb: "ran" },
};
export function PlayerEventsDock() {
  const inspect = usePlayerInspect(),
    boot = useBootHistory(),
    events = usePlayerEvents(boot.allowed ? boot.bootId : undefined),
    sync = useViewSync(),
    prefs = usePrefs(),
    roster = useRoster(),
    filter = sync.playerEventFilter,
    shown = events.filter(
      (e) =>
        filter === "all" ||
        (filter === "presence"
          ? ["join", "leave", "online"].includes(e.kind)
          : e.kind === filter),
    );
  return (
    <div
      className="pp-pe"
      data-testid="player-events"
      aria-label="Boot player activity"
    >
      <div
        className="pp-pe__filters"
        role="group"
        aria-label="Filter player events"
      >
        {FILTERS.map((f) => (
          <button
            key={f.id}
            aria-pressed={filter === f.id}
            data-active={filter === f.id || undefined}
            onClick={() => sync.set("playerEventFilter", f.id)}
          >
            {f.label}
          </button>
        ))}
        <span className="pp-pe__count">
          {events.length} events · boot{" "}
          {boot.epoch.slice(0, 12) || "unreported"}
        </span>
      </div>
      {!boot.allowed ? (
        <p className="pp-pe__empty">
          Current player activity requires roster or overview access.
        </p>
      ) : !shown.length ? (
        <p className="pp-pe__empty">
          {roster.players.length
            ? "No matching events for this filter yet."
            : "No player activity on this boot yet."}
        </p>
      ) : (
        <ol
          className="pp-pe__list"
          tabIndex={0}
          aria-label="Current boot player events"
        >
          {shown.map((e) => (
            <li
              key={e.id}
              data-kind={e.kind}
              data-source={e.source}
              className="pp-pe__item"
            >
              <button
                type="button"
                className="pp-pe__inspect pp-row--interactive"
                disabled={!e.player}
                aria-label={e.player ? `Inspect ${e.player}` : undefined}
                onClick={() => {
                  if (e.player) inspect({ name: e.player });
                }}
              >
                <time dateTime={new Date(e.ts).toISOString()}>
                  {time(e.ts, prefs.timezone)}
                </time>
                <span className="pp-pe__icon" aria-hidden="true">
                  {GLYPH[e.kind].icon}
                </span>
                <span className="pp-pe__text">
                  <b>{e.player}</b> {GLYPH[e.kind].verb}
                  {e.detail && <code>{e.detail}</code>}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {boot.canLoadEarlier && boot.nextCursor && (
        <footer className="pp-pe__footer">
          <button
            className="pp-ctl"
            disabled={boot.loading}
            onClick={boot.loadEarlier}
          >
            Load earlier player events
          </button>
        </footer>
      )}
    </div>
  );
}

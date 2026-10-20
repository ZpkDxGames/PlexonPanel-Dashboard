"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Globe2 } from "lucide-react";
import { useRoster, useViewSync, usePrefs, duration, fmt } from "../bindings";
import {
  ConnectedInstrumentDeck,
  PlayerHead,
} from "../instruments/InstrumentDeck";
import { TelemetryStudio } from "../studio/TelemetryStudio";
import { Tabs } from "../primitives/Tabs";
import { LiveConsole } from "../console/LiveConsole";
import { usePlayerInspect } from "../bindings/usePlayerInspect";
import { PlayerEventsDock } from "../players/PlayerEventsDock";
export default function Overview() {
  const inspect = usePlayerInspect(),
    r = useRoster(),
    prefs = usePrefs(),
    sync = useViewSync(),
    channel = sync.dockFeed,
    setChannel = (v: "console" | "events") => sync.set("dockFeed", v),
    level = sync.dockLevel,
    setLevel = (v: string) => sync.set("dockLevel", v as typeof level),
    [search, setSearch] = useState("");
  return (
    <div className="pp-overview">
      <ConnectedInstrumentDeck />
      <TelemetryStudio />
      <div className="pp-dock">
        <section className="pp-pane">
          <header className="pp-pane__head">
            <Tabs
              value={channel}
              onChange={setChannel}
              items={[
                { id: "console", label: "Console" },
                { id: "events", label: "Player events" },
              ]}
              label="Event dock"
            />
            <Link
              href="/console"
              className="row push muted"
              style={{ fontSize: 11 }}
            >
              Open console <ArrowUpRight size={13} />
            </Link>
          </header>
          {channel === "events" ? (
            <PlayerEventsDock />
          ) : (
            <>
              <div className="pp-console-toolbar">
                <div className="pp-seg" role="group" aria-label="Severity">
                  {["All", "Info", "Warn", "Error"].map((l) => (
                    <button
                      key={l}
                      aria-pressed={level === l}
                      onClick={() => setLevel(l)}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <input
                  aria-label="Filter overview logs"
                  placeholder="Filter this boot…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <LiveConsole mode="compact" filters={{ level, search }} />
            </>
          )}
        </section>
        <section className="pp-pane">
          <header className="pp-pane__head">
            <h2>Active roster</h2>
            <span className="push pp-num muted">
              {fmt(r.online, 0)} / {fmt(r.capacity, 0)}
            </span>
          </header>
          <div style={{ maxHeight: 205, overflow: "auto" }}>
            {r.players.slice(0, 6).map((p) => (
              <button
                type="button"
                key={String(p.uuid)}
                className="pp-list-row pp-row--interactive"
                aria-label={`Inspect ${p.name}`}
                onClick={() =>
                  inspect({
                    uuid: typeof p.uuid === "string" ? p.uuid : null,
                    name: String(p.name ?? ""),
                  })
                }
              >
                <PlayerHead
                  uuid={String(p.uuid)}
                  name={String(p.name)}
                  skinTexture={
                    typeof p.skinTexture === "string" ? p.skinTexture : null
                  }
                  provider={prefs.skinProvider}
                />
                <span className="grow">{String(p.name)}</span>
                <span className="muted pp-num">
                  {String(p.pingMillis ?? p.ping ?? "—")} ms
                </span>
                <span className="faint pp-num" style={{ fontSize: 10 }}>
                  {duration(p.onlineDurationMillis)}
                </span>
              </button>
            ))}
            {!r.players.length && (
              <div className="pp-empty">No players in the current roster</div>
            )}
          </div>
          <div className="pp-worlds">
            <div className="pp-kicker pp-section-label">Worlds</div>
            {r.worlds.map((w, i) => (
              <div
                className="pp-list-row"
                key={String(w.name)}
                data-tone={i === 0 ? "emerald" : i === 1 ? "rose" : "violet"}
              >
                <Globe2 size={13} className="tone" />
                <span className="grow">{String(w.name)}</span>
                <span className="muted pp-num" style={{ fontSize: 10 }}>
                  {fmt(w.loadedChunks, 0)} chunks · {fmt(w.entities, 0)}{" "}
                  entities
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

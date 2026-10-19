import { useState, type ReactNode } from "react";
import { Users, Globe, Copy, ArrowUpRight, Clock } from "lucide-react";
import {
  useControl,
  useBand,
  usePlayers,
  useQuery,
  fmt1,
  duration,
} from "../hooks/useControl";
import { usePreferences } from "../../store/preferences";
import { IconBadge } from "../primitives/IconBadge";
import { Sparkline } from "../primitives/Sparkline";
import { PlayerHead } from "../primitives/AvatarStack";
import { SourceChip } from "../primitives/SourceChip";
import { Pill } from "../primitives/Pill";
import { EmptyState } from "../primitives/EmptyState";
import { Skeleton } from "../primitives/Skeleton";
import { PlayerInspector } from "./players/PlayerInspector";
import type { Tone } from "../types";
import { records } from "../../adapter/control-state";
export function Heading({
  id,
  title,
  detail,
}: {
  id: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="route-heading">
      <p className="eyebrow">{id}</p>
      <h1>{title}</h1>
      <p>{detail}</p>
    </div>
  );
}
export function Panel({
  title,
  tone = "accent",
  icon: Icon = Clock,
  children,
  band,
}: {
  band?: "live" | "delayed" | "stale";
  title: string;
  tone?: Tone;
  icon?: typeof Users;
  children: ReactNode;
}) {
  return (
    <section
      className="pp-card"
      data-stale={band === "stale"}
      data-tone={
        band === "stale" ? "rose" : band === "delayed" ? "amber" : tone
      }
    >
      <header className="card-header">
        <IconBadge icon={Icon} tone={tone} />
        <h2>{title}</h2>
        {band && band !== "live" && (
          <Pill tone={band === "stale" ? "rose" : "amber"} className="ml-auto">
            {band}
          </Pill>
        )}
      </header>
      {children}
    </section>
  );
}
export function QueryNotice({
  query,
}: {
  query: { loading: boolean; error: string; retry: () => void };
}) {
  return query.loading ? (
    <Skeleton className="h-20 mb-3" />
  ) : query.error ? (
    <div className="pp-well p-3 mb-3">
      <p className="text-secondary text-xs">{query.error}</p>
      <button className="btn mt-2" onClick={query.retry}>
        Retry
      </button>
    </div>
  ) : null;
}
export function Roster({
  limit,
  searchable = false,
}: {
  limit?: number;
  searchable?: boolean;
}) {
  const { state } = useControl(),
    p = usePlayers(),
    rosterBand = p.band,
    prefs = usePreferences(),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("name"),
    [uuid, setUuid] = useState<string | null>(null),
    rows = p.online
      .filter((p) =>
        (p.name + " " + p.uuid).toLowerCase().includes(search.toLowerCase()),
      )
      .sort((a, b) =>
        sort === "ping"
          ? Number(a.pingMillis ?? a.ping ?? 0) -
            Number(b.pingMillis ?? b.ping ?? 0)
          : a.name.localeCompare(b.name),
      )
      .slice(0, limit ?? 512);
  return (
    <>
      <Panel title="Active players" tone="emerald" icon={Users} band={p.band}>
        {searchable && (
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              className="field flex-1"
              aria-label="Search players"
              placeholder="Search name or exact UUID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label="Sort players"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="name">Name</option>
              <option value="ping">Ping</option>
            </select>
          </div>
        )}
        {rows.length ? (
          <div
            className="pp-well table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Player roster"
          >
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  {searchable && <th>UUID</th>}
                  <th>Ping</th>
                  <th>Session</th>
                  {searchable && (
                    <>
                      <th>World</th>
                      <th>State</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.uuid}>
                    <td>
                      <button
                        className="flex gap-2 items-center"
                        onClick={() => setUuid(p.uuid)}
                      >
                        <PlayerHead
                          provider={prefs.skinProvider}
                          uuid={p.uuid}
                          name={p.name}
                          size={30}
                        />
                        {p.name}
                      </button>
                    </td>
                    {searchable && (
                      <td className="mono text-muted">{p.uuid.slice(0, 8)}</td>
                    )}
                    <td>
                      <Pill
                        tone={
                          Number(p.pingMillis ?? p.ping) < 100
                            ? "emerald"
                            : "amber"
                        }
                      >
                        {String(p.pingMillis ?? p.ping ?? "—")} ms
                      </Pill>
                    </td>
                    <td className="text-secondary num">
                      {duration(p.onlineDurationMillis)}
                    </td>
                    {searchable && (
                      <>
                        <td className="text-secondary">
                          {String(p.world ?? "Unreported")}
                        </td>
                        <td>
                          <Pill
                            tone={rosterBand === "live" ? "emerald" : "slate"}
                          >
                            {rosterBand === "live" ? "Online" : "Last reported"}
                          </Pill>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No visible players"
            detail={
              state.server.onlinePlayers
                ? "The signed read scope does not expose this roster."
                : "No players are connected to this boot session."
            }
          />
        )}
      </Panel>
      <PlayerInspector uuid={uuid} onClose={() => setUuid(null)} />
    </>
  );
}
export function WorldActivity() {
  const { state: s } = useControl(),
    band = useBand("paperHealth"),
    chunks = s.worlds.reduce((a, w) => a + Number(w.loadedChunks ?? 0), 0),
    entities = s.worlds.reduce((a, w) => a + Number(w.entities ?? 0), 0);
  return (
    <Panel title="World activity" tone="emerald" icon={Globe} band={band}>
      <div className="grid grid-cols-2 gap-4 mb-4">
        {[
          ["Loaded chunks", chunks, "emerald", "chunks"],
          ["Entities", entities, "amber", "entities"],
        ].map(([label, value, tone, key]) => (
          <div key={String(label)} data-tone={tone}>
            <p className="eyebrow">{label}</p>
            <strong className="num text-2xl block my-3">
              {s.worlds.length ? value : "—"}
            </strong>
            <Sparkline
              values={s.history.map((h) =>
                typeof h[String(key) as keyof typeof h] === "number"
                  ? (h[String(key) as keyof typeof h] as number)
                  : null,
              )}
            />
          </div>
        ))}
      </div>
      <div className="pp-well p-3">
        <div className="world-segments">
          {s.worlds.map((w, i) => (
            <i
              key={String(w.name)}
              data-tone={["emerald", "rose", "violet"][i % 3]}
              style={{
                width: `${chunks ? (Number(w.loadedChunks ?? 0) / chunks) * 100 : 0}%`,
              }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-4 mt-3 text-xs">
          {s.worlds.map((w, i) => (
            <span
              key={String(w.name)}
              data-tone={["emerald", "rose", "violet"][i % 3]}
              className="tone-text"
            >
              {String(w.name)} <b className="num">{String(w.loadedChunks)}</b>
            </span>
          ))}
        </div>
      </div>
      <div className="mt-3">
        <SourceChip source="Paper" />
      </div>
    </Panel>
  );
}
export function SessionTimeline({
  query,
}: {
  query: ReturnType<typeof useQuery>;
}) {
  const { state: s } = useControl(),
    entries = records(query.data.entries, 25).length
      ? records(query.data.entries, 25)
      : s.presenceDeltas.slice(-25).reverse();
  return (
    <Panel title="Session timeline" tone="emerald" icon={Users}>
      <QueryNotice query={query} />
      {entries.length ? (
        <ol className="timeline">
          {entries.map((e, i) => (
            <li
              key={String(e.eventId ?? i)}
              data-tone={e.state === "JOINED" ? "emerald" : "slate"}
            >
              <strong>{String(e.name ?? e.uuid)}</strong>{" "}
              {String(e.state).toLowerCase()}
              <p className="text-muted text-xs">
                {String(e.observedAt ?? "Capture not reported")}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title="No presence events"
          detail="Current-boot join and leave events appear here when supplied by the Host or Paper."
        />
      )}
    </Panel>
  );
}

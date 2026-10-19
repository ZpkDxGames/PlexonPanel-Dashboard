"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import * as Dialog from "@radix-ui/react-dialog";
import { Copy, X, ArrowUpRight } from "lucide-react";
import {
  useViewSync,
  useControl,
  useRoster,
  usePrefs,
  useQuery,
  playerHistoryPage,
  playerCommand,
  session,
  fmt,
  duration,
  time,
  type JsonMap,
} from "../bindings";
import { PlayerHead } from "../instruments/InstrumentDeck";
import { Tabs } from "../primitives/Tabs";
import { MutationButton } from "../primitives/MutationButton";
import { useReview } from "../primitives/ReviewProvider";
import { QueryState } from "./shared";
import { PlayerEventsDock } from "../players/PlayerEventsDock";
export function Inspector({ uuid }: { uuid: string }) {
  const { state: s } = useControl(),
    prefs = usePrefs(),
    p = s.players.find((p) => p.uuid === uuid),
    [tab, setTab] = useState<"overview" | "sessions" | "actions">("overview"),
    [cursor, setCursor] = useState<string | undefined>(),
    [copied, setCopied] = useState(false),
    [command, setCommand] = useState("msg {player} "),
    [error, setError] = useState(""),
    review = useReview(),
    kind = session.reason("players.history.list", "HOST") ? "PAPER" : "HOST",
    q = useQuery("players.history.list", kind, {
      query: uuid,
      ...(cursor ? { cursor } : {}),
    }),
    history = playerHistoryPage(q.data, uuid);
  return (
    <>
      <div className="pp-inspector-top">
        <PlayerHead
          uuid={uuid}
          name={String(p?.name ?? "Player")}
          skinTexture={
            typeof p?.skinTexture === "string" ? p.skinTexture : null
          }
          provider={prefs.skinProvider}
          size={48}
        />
        <div className="grow">
          <h2 style={{ fontSize: 18 }}>
            {String(p?.name ?? "Exact UUID inspector")}
          </h2>
          <small className="muted">
            {p ? "Online" : "Outside current roster"} · session{" "}
            {duration(p?.onlineDurationMillis)}
          </small>
        </div>
      </div>
      <div className="row" style={{ padding: "0 20px 20px" }}>
        <code className="pp-uuid grow">{uuid}</code>
        <button
          className="pp-ctl"
          aria-label="Copy full UUID"
          onClick={() =>
            void navigator.clipboard.writeText(uuid).then(() => setCopied(true))
          }
        >
          <Copy size={13} />
        </button>
        {copied && <small role="status">Copied</small>}
      </div>
      <div className="pp-pane__head">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { id: "overview", label: "Overview" },
            { id: "sessions", label: "Sessions" },
            { id: "actions", label: "Actions" },
          ]}
          label="Player inspector"
        />
      </div>
      <div role="tabpanel" aria-label={`${tab} for ${uuid}`}>
        {tab === "overview" ? (
          <>
            <dl className="pp-details">
              {[
                ["World", String(p?.world ?? "Not reported")],
                ["Session", duration(p?.onlineDurationMillis)],
                [
                  "Position",
                  p?.position
                    ? JSON.stringify(p.position)
                    : "Not exposed by read scope",
                ],
                ["Ping", `${fmt(p?.pingMillis ?? p?.ping, 0)} ms`],
                [
                  "Gamemode",
                  String(p?.gameMode ?? p?.gamemode ?? "Not reported"),
                ],
                ["Health", fmt(p?.health, 0)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="pad muted" style={{ fontSize: 11 }}>
              Historical per-player ping is not supplied by this producer.
            </div>
          </>
        ) : tab === "sessions" ? (
          <>
            <QueryState query={q} />
            <Timeline events={history.entries} />
            {history.cursor && (
              <div className="pad">
                <button
                  className="pp-ctl"
                  onClick={() => setCursor(history.cursor!)}
                >
                  Earlier events
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="pp-actions">
              <MutationButton
                action="player.kick"
                kind="PAPER"
                label="Kick player"
                tone="amber"
                args={{ playerId: uuid, reason: "Removed by operator" }}
              />
              <MutationButton
                action="player.ban"
                kind="PAPER"
                label="Ban player"
                tone="rose"
                args={{ playerId: uuid, reason: "Banned by operator" }}
              />
              <MutationButton
                action="player.op"
                kind="PAPER"
                label="Grant operator"
                args={{ playerId: uuid }}
              />
            </div>
            <form
              className="pad"
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  if (!p)
                    throw new Error(
                      "Select an online player to build a command.",
                    );
                  const c = playerCommand(command, {
                    name: String(p.name),
                    uuid,
                  });
                  setError("");
                  void review("console.execute", { command: c }, "PAPER");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <label className="muted" style={{ fontSize: 12 }}>
                Command template
                <input
                  style={{
                    display: "block",
                    width: "100%",
                    margin: "8px 0 12px",
                  }}
                  aria-label="Player command template"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                />
              </label>
              <button className="pp-ctl">Build & review</button>
              {error && (
                <div className="pp-error" role="alert">
                  {error}
                </div>
              )}
            </form>
          </>
        )}
      </div>
    </>
  );
}
function Timeline({ events }: { events: JsonMap[] }) {
  const prefs = usePrefs();
  let prior = "";
  return (
    <div className="pp-timeline" aria-label="Epoch separated presence timeline">
      {events.length ? (
        events.map((e, i) => {
          const epoch = String(
              e.epoch ?? e.bootEpoch ?? e.sessionEpoch ?? "unreported",
            ),
            separator = prior !== epoch;
          prior = epoch;
          return (
            <div key={String(e.eventId ?? i)}>
              {separator && (
                <div className="pp-epoch">epoch {epoch.slice(0, 12)}</div>
              )}
              <div className="pp-list-row">
                <i
                  className="pp-dot"
                  data-tone={e.state === "LEFT" ? "amber" : "emerald"}
                />
                <span className="grow">
                  {String(e.name ?? "Player")} ·{" "}
                  {String(e.state ?? e.eventType ?? "presence")}
                </span>
                <small className="muted">
                  {time(String(e.observedAt ?? ""), prefs.timezone)}
                </small>
              </div>
            </div>
          );
        })
      ) : (
        <div className="pp-empty">
          No presence events in this retained window
        </div>
      )}
    </div>
  );
}
export default function Players() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const q = matchMedia("(max-width:1280px)"),
      apply = () => setNarrow(q.matches);
    apply();
    q.addEventListener("change", apply);
    return () => q.removeEventListener("change", apply);
  }, []);
  const r = useRoster(),
    prefs = usePrefs(),
    [search, setSearch] = useState(""),
    sync = useViewSync(),
    all = sync.rosterScope === "all",
    setAll = (v: boolean) => sync.set("rosterScope", v ? "all" : "online"),
    [uuid, setUuid] = useState<string | null>(null),
    scroll = useRef<HTMLDivElement>(null),
    players = useMemo(
      () =>
        r.players.filter((p) =>
          `${p.name} ${p.uuid}`.toLowerCase().includes(search.toLowerCase()),
        ),
      [r.players, search],
    ),
    v = useVirtualizer({
      count: players.length,
      getScrollElement: () => scroll.current,
      estimateSize: () => 44,
      overscan: 10,
    });
  return (
    <div className="pp-players">
      <section className="pp-pane">
        <header className="pp-pane__head">
          <h2 className="sr-only">Player roster</h2>
          <input
            className="grow"
            aria-label="Search name or exact UUID"
            placeholder="Search name or exact UUID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="pp-seg">
            <button aria-pressed={!all} onClick={() => setAll(false)}>
              Online
            </button>
            <button aria-pressed={all} onClick={() => setAll(true)}>
              All
            </button>
          </div>
        </header>
        <div className="pp-roster-list" ref={scroll}>
          {players.length ? (
            <div style={{ height: v.getTotalSize(), position: "relative" }}>
              {v.getVirtualItems().map((vi) => {
                const p = players[vi.index];
                return (
                  <button
                    key={String(p.uuid)}
                    className="pp-list-row pp-player-row"
                    style={{
                      position: "absolute",
                      top: vi.start,
                      left: 0,
                      right: 0,
                    }}
                    aria-pressed={uuid === p.uuid}
                    onClick={() => setUuid(String(p.uuid))}
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
                    <small className="muted pp-num">
                      {fmt(p.pingMillis ?? p.ping, 0)} ms
                    </small>
                    <ArrowUpRight size={12} />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="pp-empty">No matching players</div>
          )}
          {all && (
            <form
              className="pad"
              onSubmit={(e) => {
                e.preventDefault();
                if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(search))
                  setUuid(search);
              }}
            >
              <small className="muted">
                Offline history is queried by exact UUID.
              </small>
              <button
                className="pp-ctl"
                style={{ marginTop: 8 }}
                aria-disabled={
                  !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(search) || undefined
                }
              >
                Inspect exact UUID
              </button>
            </form>
          )}
        </div>
        <PlayerEventsDock />
      </section>
      <section className="pp-pane pp-inspector">
        {uuid ? (
          <Inspector key={uuid} uuid={uuid} />
        ) : (
          <div className="pp-empty" style={{ flex: 1 }}>
            Select a player
          </div>
        )}
      </section>
      <Dialog.Root
        open={!!uuid && narrow}
        onOpenChange={(open) => {
          if (!open) setUuid(null);
        }}
      >
        <Dialog.Portal>
          <div className="pp-mobile-inspector">
            <Dialog.Overlay className="pp-overlay" />
            <Dialog.Content className="pp-glass pp-drawer">
              <header>
                <Dialog.Title>Player inspector</Dialog.Title>
                <Dialog.Close
                  className="pp-ctl"
                  aria-label="Close player inspector"
                >
                  <X size={14} />
                </Dialog.Close>
              </header>
              <Dialog.Description className="sr-only">
                Exact identity and permission gated player actions
              </Dialog.Description>
              {uuid && <Inspector key={uuid} uuid={uuid} />}
            </Dialog.Content>
          </div>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

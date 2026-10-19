import Link from "next/link";
import { Box, Plus, Network } from "lucide-react";
import { Heading } from "../shared";
import { useControl, session, fmt1, fmtGiB } from "../../hooks/useControl";
import { usePairing } from "../../pairing/PairingGate";
import { IconBadge } from "../../primitives/IconBadge";
import { Sparkline } from "../../primitives/Sparkline";
import { Pill } from "../../primitives/Pill";
import { StatusRing } from "../../primitives/StatusRing";
export default function Fleet() {
  const snap = useControl(),
    pair = usePairing(),
    rows = [
      { serverId: snap.state.serverId, state: snap.state, phase: snap.phase },
      ...snap.fleet.filter((s) => s.serverId !== snap.state.serverId),
    ],
    online = rows.filter((r) => r.state.ready?.agents.paper).length;
  return (
    <>
      <Heading
        id="R01 · Fleet"
        title="Your network, in sight."
        detail="One signed workspace for every instance. Independent sources, explicit authority."
      />
      <div className="pp-shell fleet-stats">
        {[
          ["Online servers", `${online} / ${rows.length}`],
          [
            "Online players",
            rows.reduce(
              (n, r) => n + Number(r.state.server.onlinePlayers ?? 0),
              0,
            ),
          ],
          [
            "Hosts connected",
            rows.filter((r) => r.state.ready?.agents.host).length,
          ],
          ["Last backups", "Not reported"],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="eyebrow">{label}</p>
            <strong className="num text-xl block mt-2">{value}</strong>
          </div>
        ))}
      </div>
      <div className="fleet-grid">
        {rows.map((r) => (
          <section
            key={r.serverId}
            className="pp-card"
            data-tone={r.state.ready?.agents.paper ? "emerald" : "slate"}
          >
            <header className="card-header">
              <IconBadge icon={Box} />
              <div>
                <h2>
                  {r.state.ready?.server.serverName ??
                    snap.labels[r.serverId] ??
                    r.serverId}
                </h2>
                <p className="text-muted text-xs mt-1">
                  Paper {r.state.ready?.server.minecraftVersion ?? "unreported"}
                </p>
              </div>
              <StatusRing
                state={r.state.ready?.agents.paper ? "online" : "unknown"}
              />
            </header>
            <div className="mini-viz-grid">
              {[
                [
                  "TPS",
                  Array.isArray(r.state.server.tps)
                    ? fmt1(r.state.server.tps[0])
                    : "—",
                  "tps",
                  "cyan",
                ],
                [
                  "Players",
                  String(r.state.server.onlinePlayers ?? "—"),
                  "players",
                  "emerald",
                ],
                [
                  "Heap",
                  fmtGiB(r.state.system.jvmHeapUsedBytes),
                  "heap",
                  "violet",
                ],
              ].map(([label, value, key, tone]) => (
                <div key={label} data-tone={tone}>
                  <p className="eyebrow">{label}</p>
                  <strong className="num">{value}</strong>
                  <Sparkline
                    values={r.state.history.map((s) => s[key as "tps"] ?? null)}
                  />
                </div>
              ))}
            </div>
            <div className="pp-hairline my-4" />
            <footer className="flex justify-between items-center">
              <Pill tone="emerald">{r.phase}</Pill>
              <Link
                href="/overview"
                className="btn"
                onClick={() => {
                  if (r.serverId !== snap.state.serverId)
                    void session.select(r.serverId);
                }}
              >
                Open workspace
              </Link>
            </footer>
          </section>
        ))}
        <button
          className="pp-well min-h-64 rounded-xl border border-dashed border-[rgb(var(--line)/.15)] flex flex-col items-center justify-center gap-3 text-secondary"
          onClick={pair}
        >
          <IconBadge icon={Plus} />
          <strong>Add a server</strong>
          <span className="text-xs">Connect with a fresh pairing code</span>
        </button>
      </div>
    </>
  );
}

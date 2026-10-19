"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, ArrowUpRight } from "lucide-react";
import {
  useServers,
  useNow,
  verifiedNodes,
  fmt,
  gib,
  session,
} from "../bindings";
import { Sparkline } from "../studio/TelemetryStudio";
import { Title } from "./shared";
export default function Fleet() {
  const servers = useServers(),
    now = useNow(),
    router = useRouter(),
    nodes = verifiedNodes(
      servers.flatMap((s) =>
        s.state
          ? [{ state: s.state, phase: s.selected ? "live" : s.phase }]
          : [],
      ),
      now,
    );
  return (
    <div className="pp-page">
      <Title
        code="R01 / Infrastructure"
        title="Fleet command."
        detail="Node resources and the instances that run on them."
        actions={
          <Link href="/pair" className="pp-ctl">
            <Plus size={14} />
            Pair browser
          </Link>
        }
      />
      <section
        className="pp-deck pp-node-ledger"
        aria-label="Node hardware ledger"
      >
        {nodes.length ? (
          nodes.map((n) => (
            <div className="pp-cell pp-node" key={n.nodeId}>
              <div>
                <div className="row">
                  <i className="pp-dot" data-tone="emerald" />
                  <strong>
                    {String(
                      n.state.hostSystem.hostname ?? n.nodeId.slice(0, 8),
                    )}
                  </strong>
                </div>
                <small className="muted">
                  Node ·{" "}
                  {
                    servers.filter(
                      (s) => s.state?.ready?.server.nodeId === n.nodeId,
                    ).length
                  }{" "}
                  instance(s)
                </small>
              </div>
              {[
                ["CPU", fmt(n.cpu) + "%", n.cpu],
                [
                  "Memory",
                  gib(n.memory),
                  Number(n.state.hostSystem.physicalMemoryTotalBytes) > 0
                    ? (Number(n.memory) /
                        Number(n.state.hostSystem.physicalMemoryTotalBytes)) *
                      100
                    : null,
                ],
                [
                  "Disk",
                  fmt(n.state.hostSystem.diskUsedPercent) + "%",
                  n.state.hostSystem.diskUsedPercent,
                ],
              ].map(([label, value, amount]) => (
                <div className="pp-node-stat" key={String(label)}>
                  <div className="row spread">
                    <span className="pp-kicker">{String(label)}</span>
                    <span className="pp-num">{String(value)}</span>
                  </div>
                  <span className="pp-track" data-tone="indigo">
                    <i
                      style={{
                        width: `${typeof amount === "number" ? Math.min(100, amount) : 0}%`,
                      }}
                    />
                  </span>
                </div>
              ))}
            </div>
          ))
        ) : (
          <div className="pp-cell pad muted">
            No current, verified node evidence is available.
          </div>
        )}
      </section>
      <div className="row">
        <span className="pp-kicker">Instances / {servers.length}</span>
        <span className="push muted" style={{ fontSize: 11 }}>
          Independent agent clocks · Protocol 3
        </span>
      </div>
      <div className="pp-blades">
        {servers.map((s) => (
          <button
            className="pp-card pp-blade"
            key={s.id}
            onClick={() => {
              if (!s.selected) void session.select(s.id);
              router.push("/overview");
            }}
          >
            <div className="row spread pad">
              <div
                className="row"
                data-tone={s.phase === "online" ? "emerald" : "amber"}
              >
                <i className="pp-ring" data-phase={s.phase} />
                <strong>{s.name}</strong>
              </div>
              <ArrowUpRight size={14} className="muted" />
            </div>
            <div
              className="row spread"
              style={{ padding: "0 16px 14px", fontSize: 11 }}
            >
              <span className="muted">
                {String(
                  s.state?.ready?.server.minecraftVersion ??
                    "Version unavailable",
                )}
              </span>
              <span
                data-tone={s.phase === "online" ? "emerald" : "amber"}
                className="tone"
              >
                {s.phase}
              </span>
            </div>
            <div className="stats">
              {[
                [
                  "TPS",
                  Array.isArray(s.state?.server.tps)
                    ? fmt(s.state.server.tps[0], 2)
                    : "—",
                ],
                [
                  "PLAYERS",
                  `${fmt(s.state?.server.onlinePlayers, 0)} / ${fmt(s.state?.server.maximumPlayers, 0)}`,
                ],
                ["HEAP", gib(s.state?.system.jvmHeapUsedBytes)],
              ].map(([k, v]) => (
                <div key={k}>
                  <small className="pp-kicker">{k}</small>
                  <strong className="pp-num">{v}</strong>
                </div>
              ))}
            </div>
            <div style={{ height: 48, padding: "12px 16px" }}>
              <Sparkline
                values={s.state?.history.map((h) => h.tps) ?? []}
                tone="emerald"
              />
            </div>
          </button>
        ))}
      </div>
      <div className="pp-fleet-caption">
        Instances are grouped by their verified node association. Unknown values
        stay unavailable.
      </div>
    </div>
  );
}

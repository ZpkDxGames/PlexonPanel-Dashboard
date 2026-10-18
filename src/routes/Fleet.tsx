"use client";
import { ArrowUpRight, Cpu, Plus, Server } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { useNow, useSession } from "../hooks";
import { session } from "../adapter/session";
import { number, str } from "../adapter/control-state";
import { verifiedNodes, sourceEvidence } from "../presentation/telemetry";
import { valueLabel } from "../presentation/format";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Notice } from "../components/ui/empty";
import { PageHeader } from "../components/PageHeader";
import { navigate } from "../router";
export default function Fleet() {
  const snap = useSession(),
    now = useNow(),
    [error, setError] = useState("");
  const rows = [
      { serverId: snap.state.serverId, state: snap.state, phase: snap.phase },
      ...snap.fleet,
    ],
    nodes = verifiedNodes(rows, now);
  const open = async (id: string) => {
    try {
      if (id !== snap.state.serverId) await session.select(id);
      navigate("Overview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Server unavailable");
    }
  };
  return (
    <div className="space-y-5">
      <PageHeader
        title="Your fleet"
        description="Every instance. One operational view."
        action={
          <Button variant="outline" asChild>
            <Link href="/settings">
              <Plus />
              Connect server
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Paired instances", rows.length],
          ["Live connections", rows.filter((r) => r.phase === "live").length],
          ["Verified nodes", nodes.length],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-4 font-mono text-3xl">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {rows.map((row) => {
          const s = row.state,
            p = sourceEvidence(s, "paperHealth", now),
            id = s.ready?.server.nodeId;
          return (
            <Card key={row.serverId}>
              <CardHeader
                title={String(
                  s.ready?.server.serverName ??
                    snap.labels[row.serverId] ??
                    row.serverId,
                )}
                icon={<Server size={17} className="text-primary" />}
                action={
                  <Badge
                    dot
                    tone={row.phase === "live" ? "success" : "warning"}
                  >
                    {row.phase}
                  </Badge>
                }
              />
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground">TPS</p>
                    <p className="mt-2 font-mono text-xl">
                      {valueLabel(
                        p.usable && Array.isArray(s.server.tps)
                          ? number(s.server.tps[0])
                          : null,
                        "",
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">
                      Mean MSPT
                    </p>
                    <p className="mt-2 font-mono text-xl">
                      {valueLabel(
                        p.usable ? number(s.server.averageTickMillis) : null,
                        "ms",
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Players</p>
                    <p className="mt-2 font-mono text-xl">
                      {valueLabel(
                        p.usable ? number(s.server.onlinePlayers) : null,
                        "",
                      )}
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                  <p className="font-mono text-[9px] leading-5 text-muted-foreground">
                    Service {str(s.service.state, "unknown")}
                    <br />
                    Node{" "}
                    {s.ready?.server.fleetState === "BOUND"
                      ? (id ?? "unverified")
                      : "unverified"}
                    <br />
                    Boot {s.bootEpochId?.slice(0, 12) ?? "not reported"}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => void open(row.serverId)}
                  >
                    Open workspace
                    <ArrowUpRight />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Card>
        <CardHeader
          title="Shared node ledger"
          description="Node resources count once per verified node identity"
          icon={<Cpu size={16} className="text-muted-foreground" />}
        />
        <CardContent className="space-y-4">
          {nodes.length ? (
            nodes.map((n) => (
              <div
                key={n.nodeId}
                className="flex flex-wrap justify-between gap-3 rounded-lg border p-4"
              >
                <code className="break-all text-[10px]">{n.nodeId}</code>
                <span className="font-mono text-xs">
                  {valueLabel(n.cpu, "%")} CPU · {valueLabel(n.memory, "bytes")}{" "}
                  RAM
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">
              No fresh authenticated node observations.
            </p>
          )}
        </CardContent>
      </Card>
      {error && <Notice danger>{error}</Notice>}
    </div>
  );
}

"use client";
import { valueLabel } from "../presentation/format";
import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Box,
  Cpu,
  Globe2,
  MemoryStick,
  Play,
  RotateCw,
  Square,
  Users,
} from "lucide-react";
import { session } from "../adapter/session";
import { useSession, useNow } from "../hooks";
import { number, record, str } from "../adapter/control-state";
import { sourceEvidence } from "../presentation/telemetry";
import { hasScope } from "../presentation/authority";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/input";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
import {
  TelemetryChart,
  tickSeries,
  memorySeries,
  computeSeries,
} from "../components/charts/TelemetryChart";
import { ConsolePanel } from "../components/terminal/ConsolePanel";
import { useOperation } from "../features/operations";
import { PlayerHead } from "../components/PlayerHead";
export default function Overview() {
  const snap = useSession(),
    now = useNow(),
    state = snap.state,
    op = useOperation();
  const [tab, setTab] = useState("ticks"),
    [minutes, setMinutes] = useState(15);
  const paper = sourceEvidence(state, "paperHealth", now),
    jvm = sourceEvidence(state, "paperSystem", now),
    svc = sourceEvidence(state, "service", now),
    resources = record(state.service.resources);
  const tps = paper.usable
      ? number(Array.isArray(state.server.tps) ? state.server.tps[0] : null)
      : null,
    mspt = paper.usable ? number(state.server.averageTickMillis) : null,
    online = paper.usable ? number(state.server.onlinePlayers) : null,
    max = paper.usable ? number(state.server.maxPlayers) : null;
  const cpu =
      svc.usable && resources.cpuAvailable === true
        ? number(resources.cpuPercent)
        : null,
    heap = jvm.usable ? number(state.system.jvmHeapUsedBytes) : null,
    heapMax = jvm.usable ? number(state.system.jvmHeapMaximumBytes) : null;
  const running = state.service.state === "active",
    status =
      running && state.ready?.agents.paper
        ? "Online"
        : ["inactive", "failed"].includes(String(state.service.state))
          ? "Stopped"
          : "Awaiting status";
  const name = String(
    state.ready?.server.serverName ?? snap.labels[state.serverId] ?? "Server",
  );
  const cards = [
    {
      title: "Tick Performance",
      icon: Activity,
      value: tps === null ? "—" : tps.toFixed(2),
      unit: "TPS",
      detail:
        mspt === null
          ? "Waiting for Paper"
          : `${mspt.toFixed(1)} ms mean · ${valueLabel(state.server.msptP95, "ms")} p95`,
      tag: paper.kind,
      color: "text-primary",
    },
    {
      title: "Online Players",
      icon: Users,
      value: online === null ? "—" : String(online),
      unit: max === null ? "players" : `/ ${max}`,
      detail: "Live Paper roster",
      tag: paper.kind,
      color: "text-sky-500",
    },
    {
      title: "Compute Load",
      icon: Cpu,
      value: cpu === null ? "—" : cpu.toFixed(1),
      unit: "%",
      detail: "Minecraft service · % of one core",
      tag: svc.kind,
      color: "text-violet-400",
    },
    {
      title: "Memory Allocation",
      icon: MemoryStick,
      value: heap === null ? "—" : (heap / 2 ** 30).toFixed(1),
      unit: "GiB",
      detail:
        heapMax === null
          ? "JVM heap · capacity unreported"
          : `JVM heap · ${(heapMax / 2 ** 30).toFixed(1)} GiB maximum`,
      tag: jvm.kind,
      color: "text-amber-500",
    },
  ];
  return (
    <div className="space-y-5">
      <div
        className="flex flex-wrap items-center justify-between gap-4"
        data-testid="server-header"
      >
        <div className="flex min-w-0 items-center gap-4">
          <span className="hidden rounded-xl border bg-card p-3 text-primary sm:inline-flex">
            <ServerGlyph />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
              <Badge
                dot
                tone={
                  status === "Online"
                    ? "success"
                    : status === "Stopped"
                      ? "neutral"
                      : "warning"
                }
              >
                {status}
              </Badge>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Your server at a glance <span className="mx-1.5">·</span> Paper{" "}
              {state.ready?.server.minecraftVersion ?? "version pending"}
            </p>
          </div>
        </div>
        <div
          className="flex flex-col items-end gap-2"
          aria-label="Server lifecycle controls"
        >
          <div className="flex gap-2">
            {[
              { action: "server.start", label: "Start", icon: Play },
              { action: "server.restart", label: "Restart", icon: RotateCw },
              { action: "server.stop", label: "Stop", icon: Square },
            ].map((item) => (
              <Button
                key={item.action}
                variant={
                  item.action === "server.stop" ? "destructive" : "outline"
                }
                disabled={!!session.reason(item.action, "HOST")}
                title={session.reason(item.action, "HOST")}
                onClick={() => op.prepare(item.action)}
              >
                <item.icon />
                {item.label}
              </Button>
            ))}
          </div>
          <p className="max-w-md text-right text-[10px] leading-4 text-muted-foreground">
            {[
              ...new Set(
                ["server.start", "server.restart", "server.stop"]
                  .map((action) => session.reason(action, "HOST"))
                  .filter(Boolean),
              ),
            ].join(" ")}
          </p>
        </div>
      </div>
      <div
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
        data-testid="overview-kpis"
      >
        {cards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-4 xl:p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-muted-foreground">
                  {card.title}
                </p>
                <card.icon size={15} className={card.color} />
              </div>
              <p className="mb-3 mt-4 flex flex-wrap items-baseline gap-2 font-mono tabular-nums">
                <strong className="text-[28px] font-medium leading-none tracking-tight">
                  {card.value}
                </strong>
                <span className="text-xs text-muted-foreground">
                  {card.unit}
                </span>
              </p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] text-muted-foreground">
                  {card.detail}
                </p>
                <span
                  className={`size-1 shrink-0 rounded-full ${card.tag === "live" ? "bg-primary" : "bg-amber-400"}`}
                  title={card.tag}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card aria-label="Server performance">
          <CardHeader
            title="Server performance"
            icon={<Activity size={16} className="text-primary" />}
            action={
              <div className="flex items-center gap-2">
                <Select
                  className="h-8 w-20 text-[10px]"
                  aria-label="Chart time range"
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                >
                  {[1, 5, 15, 35].map((v) => (
                    <option key={v} value={v}>
                      {v} min
                    </option>
                  ))}
                </Select>
                <Link
                  href="/performance"
                  aria-label="Open performance analyzer"
                  className="rounded p-2 text-muted-foreground hover:text-foreground"
                >
                  <ArrowUpRight size={14} />
                </Link>
              </div>
            }
          />
          <Tabs value={tab} onValueChange={setTab}>
            <div className="px-4 pt-4">
              <TabsList aria-label="Overview chart">
                <TabsTrigger value="ticks">Tick &amp; MSPT</TabsTrigger>
                <TabsTrigger value="memory">Memory Tiers</TabsTrigger>
                <TabsTrigger value="compute">CPU &amp; Chunks</TabsTrigger>
              </TabsList>
            </div>
            {(["ticks", "memory", "compute"] as const).map((value) => (
              <TabsContent key={value} value={value} className="mt-0">
                <TelemetryChart
                  state={state}
                  series={
                    value === "ticks"
                      ? tickSeries
                      : value === "memory"
                        ? memorySeries
                        : computeSeries
                  }
                  since={Math.floor(now / 10000) * 10000 - minutes * 60000}
                  height={360}
                  label={
                    value === "ticks"
                      ? "Tick performance"
                      : value === "memory"
                        ? "Memory tiers"
                        : "CPU and chunks"
                  }
                />
              </TabsContent>
            ))}
          </Tabs>
        </Card>
        <ConsolePanel compact />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="World activity"
            description="Loaded chunks and entities reported by Paper"
            icon={<Globe2 size={16} className="text-muted-foreground" />}
          />
          <CardContent className="space-y-4">
            {state.worlds.length ? (
              state.worlds.map((w) => (
                <div
                  key={str(w.name)}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg border bg-muted/50 p-2 text-muted-foreground">
                      <Globe2 size={16} />
                    </span>
                    <span className="text-xs font-medium">{str(w.name)}</span>
                  </div>
                  <div className="text-right font-mono text-[10px]">
                    <p>
                      {valueLabel(
                        paper.usable ? number(w.loadedChunks) : null,
                        "chunks",
                      )}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {valueLabel(
                        paper.usable ? number(w.entities) : null,
                        "entities",
                      )}{" "}
                      ·{" "}
                      {valueLabel(
                        paper.usable ? number(w.tileEntities) : null,
                        "tiles",
                      )}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">
                Waiting for world observations
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader
            title="Active players"
            description="Exact identities from the current Paper roster"
            icon={<Users size={16} className="text-muted-foreground" />}
            action={
              <Link
                href="/players"
                className="flex items-center gap-1 text-[10px] text-primary"
              >
                View all
                <ArrowUpRight size={12} />
              </Link>
            }
          />
          <CardContent>
            <div className="space-y-3">
              {hasScope(snap, "players.view") &&
                state.players.slice(0, 4).map((p) => (
                  <div key={str(p.uuid)} className="flex items-center gap-3">
                    <PlayerHead uuid={str(p.uuid)} name={str(p.name)} />
                    <span className="flex-1 text-xs font-medium">
                      {str(p.name)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {str(p.world)}
                    </span>
                    <span className="font-mono text-[10px] text-primary">
                      {valueLabel(number(p.ping), "ms")}
                    </span>
                  </div>
                ))}
              {(!hasScope(snap, "players.view") || !state.players.length) && (
                <p className="text-xs text-muted-foreground">
                  {hasScope(snap, "players.view")
                    ? "No players reported in the current roster"
                    : "This device needs players.view"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      {op.review}
    </div>
  );
}
function ServerGlyph() {
  return <Box size={22} strokeWidth={1.5} />;
}

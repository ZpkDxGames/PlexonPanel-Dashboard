"use client";
import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { useSession } from "../hooks";
import { number, str, type JsonMap } from "../adapter/control-state";
import { hasScope } from "../presentation/authority";
import { useOperation, ActionButton } from "../features/operations";
import { playerCommand, permissionCommand } from "../lib/playerCommands";
import { Card, CardHeader } from "../components/ui/card";
import { Input, Select, Field, Textarea } from "../components/ui/input";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { Notice, Empty } from "../components/ui/empty";
import { PageHeader } from "../components/PageHeader";
import { PlayerHead } from "../components/PlayerHead";
import { PlayerHistory } from "../components/PlayerHistory";
import { PresenceTimeline } from "../components/PresenceTimeline";
import { VirtualRows } from "../components/VirtualRows";
const actions = [
  ["Whitelist", "player.whitelist.add"],
  ["Remove whitelist", "player.whitelist.remove"],
  ["Heal", "player.heal"],
  ["Feed", "player.feed"],
  ["Kick", "player.kick"],
  ["Ban", "player.ban"],
  ["Kill", "player.kill"],
  ["OP", "player.op"],
  ["De-op", "player.deop"],
];
export default function Players() {
  const snap = useSession(),
    op = useOperation(),
    [query, setQuery] = useState(""),
    [world, setWorld] = useState("all"),
    [sort, setSort] = useState("name"),
    [selected, setSelected] = useState<JsonMap | null>(null),
    [reason, setReason] = useState(""),
    [message, setMessage] = useState(""),
    [gameMode, setGameMode] = useState("SURVIVAL"),
    [template, setTemplate] = useState("tell {uuid} Hello"),
    [node, setNode] = useState("essentials.fly"),
    [error, setError] = useState("");
  const allowed = hasScope(snap, "players.view"),
    roster = allowed ? snap.state.players : [];
  const players = useMemo(
    () =>
      roster
        .filter(
          (p) =>
            `${p.name} ${p.uuid}`.toLowerCase().includes(query.toLowerCase()) &&
            (world === "all" || p.world === world),
        )
        .sort((a, b) =>
          sort === "ping"
            ? (number(a.ping) ?? Infinity) - (number(b.ping) ?? Infinity)
            : sort === "duration"
              ? (number(b.onlineDurationMillis) ?? -1) -
                (number(a.onlineDurationMillis) ?? -1)
              : str(a.name).localeCompare(str(b.name)),
        ),
    [roster, query, world, sort],
  );
  // Keep the selected immutable identity even when it leaves. Never select the next row.
  const active = selected && roster.find((p) => p.uuid === selected.uuid),
    prepare = (action: string, extra: JsonMap = {}) => {
      if (active)
        op.prepare(
          action,
          { playerId: str(selected?.uuid), ...extra },
          "PAPER",
        );
    };
  const command = (permission?: "set" | "unset") => {
    if (!active || !selected) return;
    try {
      if (!permission && template.includes("{player}"))
        throw new Error(
          "Use {uuid} to bind this command to the exact player identity.",
        );
      const cmd = permission
        ? permissionCommand({
            player: str(selected.uuid),
            node,
            mode: permission,
          })
        : playerCommand(template, {
            name: str(selected.name),
            uuid: str(selected.uuid),
          });
      op.prepare("console.execute", { command: cmd }, "PAPER");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid command");
    }
  };
  return (
    <div className="space-y-5">
      <PageHeader
        title="Players"
        description="Live roster and the story of the current server session."
        action={
          <Badge dot tone="info">
            {allowed ? roster.length : "—"} reported online
          </Badge>
        }
      />
      <Card>
        <CardHeader
          title="Online roster"
          icon={<Users size={16} className="text-primary" />}
          action={
            <div className="flex flex-wrap gap-2">
              <Input
                aria-label="Search players"
                className="w-52"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name or exact UUID…"
              />
              <Select
                aria-label="Filter by world"
                className="w-36"
                value={world}
                onChange={(e) => setWorld(e.target.value)}
              >
                <option value="all">All worlds</option>
                {[...new Set(roster.map((p) => str(p.world)))].map((w) => (
                  <option key={w}>{w}</option>
                ))}
              </Select>
              <Select
                aria-label="Sort players"
                className="w-36"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="name">Name A–Z</option>
                <option value="ping">Lowest latency</option>
                <option value="duration">Longest session</option>
              </Select>
            </div>
          }
        />
        {players.length ? (
          <VirtualRows
            rows={players}
            label="Player roster"
            getKey={(p) => str(p.uuid)}
            render={(p) => (
              <button
                aria-label={`Inspect ${p.name}`}
                className="flex w-full items-center gap-3 border-b px-5 py-4 text-left hover:bg-muted/40"
                onClick={() => setSelected({ ...p })}
              >
                <PlayerHead uuid={str(p.uuid)} name={str(p.name)} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">{str(p.name)}</p>
                  <p className="mt-1 truncate font-mono text-[9px] text-muted-foreground">
                    {str(p.uuid)}
                  </p>
                </div>
                <span className="hidden text-[10px] text-muted-foreground md:block">
                  {str(p.world)}
                </span>
                <span className="font-mono text-[10px] text-primary">
                  {number(p.ping) === null ? "—" : `${p.ping} ms`}
                </span>
              </button>
            )}
          />
        ) : (
          <Empty
            title={allowed ? "No matching players" : "Roster access restricted"}
          >
            {allowed
              ? "Waiting for the current Paper roster."
              : "This device needs players.view."}
          </Empty>
        )}
      </Card>
      <PresenceTimeline />
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="left-auto right-0 top-0 h-dvh max-h-dvh w-full max-w-xl translate-x-0 translate-y-0 rounded-none border-y-0 border-r-0 p-6">
          <DialogTitle>{str(selected?.name, "Player inspector")}</DialogTitle>
          <DialogDescription>
            Operations bind to this exact UUID.
          </DialogDescription>
          <div className="my-5 flex items-center gap-4">
            <PlayerHead
              uuid={str(selected?.uuid)}
              name={str(selected?.name)}
              large
            />
            <div className="min-w-0">
              <code className="break-all text-[10px]">
                {str(selected?.uuid)}
              </code>
              <p className="mt-2 text-xs text-muted-foreground">
                {active
                  ? str(active.world)
                  : "Player disconnected · actions locked"}
              </p>
            </div>
          </div>
          {!active && (
            <Notice>
              Selected player is no longer in the roster. Reopen a current
              identity before preparing another operation.
            </Notice>
          )}
          <Tabs defaultValue="gameplay">
            <TabsList aria-label="Player tools">
              <TabsTrigger value="gameplay">Gameplay</TabsTrigger>
              <TabsTrigger value="moderation">Moderation</TabsTrigger>
              <TabsTrigger value="commands">Commands</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <TabsContent value="gameplay" className="space-y-4">
              <Field label="Private message">
                <Textarea
                  value={message}
                  maxLength={2000}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </Field>
              <ActionButton
                action="player.message"
                kind="PAPER"
                disabled={!active || !message.trim()}
                onClick={() => prepare("player.message", { message })}
              >
                Review message
              </ActionButton>
              <Field label="Game mode">
                <Select
                  value={gameMode}
                  onChange={(e) => setGameMode(e.target.value)}
                >
                  {["SURVIVAL", "CREATIVE", "ADVENTURE", "SPECTATOR"].map(
                    (v) => (
                      <option key={v}>{v}</option>
                    ),
                  )}
                </Select>
              </Field>
              <ActionButton
                action="player.gamemode"
                kind="PAPER"
                disabled={!active}
                onClick={() => prepare("player.gamemode", { gameMode })}
              >
                Review game mode
              </ActionButton>
              <div className="flex flex-wrap gap-2">
                {actions.slice(2, 4).map(([label, action]) => (
                  <ActionButton
                    key={action}
                    action={action}
                    kind="PAPER"
                    variant="outline"
                    disabled={!active}
                    onClick={() => prepare(action)}
                  >
                    {label}
                  </ActionButton>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="moderation" className="space-y-4">
              <Field label="Moderation reason">
                <Textarea
                  value={reason}
                  maxLength={2000}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
              <div className="flex flex-wrap gap-3">
                {actions
                  .filter((_, i) => i < 2 || i > 3)
                  .map(([label, action]) => (
                    <ActionButton
                      key={action}
                      action={action}
                      kind="PAPER"
                      variant={
                        action.includes("ban") || action.includes("kill")
                          ? "destructive"
                          : "outline"
                      }
                      disabled={!active}
                      onClick={() =>
                        prepare(action, { ...(reason ? { reason } : {}) })
                      }
                    >
                      {label}
                    </ActionButton>
                  ))}
              </div>
            </TabsContent>
            <TabsContent value="commands" className="space-y-4">
              <Field
                label="Command template"
                hint="Use {uuid} to bind the command to this player."
              >
                <Input
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                />
              </Field>
              <ActionButton
                action="console.execute"
                kind="PAPER"
                disabled={!active}
                onClick={() => command()}
              >
                Review command
              </ActionButton>
              <Field label="LuckPerms permission node">
                <Input value={node} onChange={(e) => setNode(e.target.value)} />
              </Field>
              <div className="flex flex-wrap gap-2">
                {["set", "unset"].map((mode) => (
                  <ActionButton
                    key={mode}
                    action="console.execute"
                    kind="PAPER"
                    variant="outline"
                    disabled={!active}
                    onClick={() => command(mode as "set" | "unset")}
                  >
                    Review {mode}
                  </ActionButton>
                ))}
              </div>
              {error && <Notice danger>{error}</Notice>}
            </TabsContent>
            <TabsContent value="history">
              <PlayerHistory
                key={str(selected?.uuid)}
                uuid={str(selected?.uuid)}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      {op.review}
    </div>
  );
}

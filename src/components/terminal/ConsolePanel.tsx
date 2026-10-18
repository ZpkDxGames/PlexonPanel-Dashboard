"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronRight,
  Pause,
  Play,
  Search,
  Send,
  TerminalSquare,
  RefreshCw,
} from "lucide-react";
import { useSession } from "../../hooks";
import { session } from "../../adapter/session";
import { str, type JsonMap } from "../../adapter/control-state";
import { useHostHistory } from "./useHostHistory";
import { VirtualConsole } from "./VirtualConsole";
import { usePreferences } from "../../store/preferences";
import { useOperation } from "../../features/operations";
import { Button } from "../ui/button";
import { Card, CardHeader } from "../ui/card";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Notice } from "../ui/empty";
export function ConsolePanel({ compact = false }: { compact?: boolean }) {
  const snap = useSession(),
    prefs = usePreferences(),
    op = useOperation();
  const [query, setQuery] = useState(""),
    [level, setLevel] = useState("all"),
    [command, setCommand] = useState(""),
    [paused, setPaused] = useState(false),
    [following, setFollowing] = useState(true),
    [returnVersion, setReturn] = useState(0),
    [wrap, setWrap] = useState(true);
  const history = useHostHistory(query, level);
  const lines = useMemo(
    () =>
      history.lines.filter(
        (row) =>
          (level === "all" || String(row.level) === level) &&
          `${str(row.content ?? row.rawText ?? row.message, "")}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [history.lines, level, query],
  );
  const binding = `${snap.state.serverId}:${snap.revision}:${snap.state.bootEpochId}:${snap.state.ready?.device.scopes.join(",")}`;
  const [frozen, setFrozen] = useState<{ binding: string; lines: JsonMap[] }>({
    binding,
    lines,
  });
  const reason = session.reason("console.execute", "PAPER");
  return (
    <Card className="flex h-full flex-col" aria-label="Console panel">
      <CardHeader
        title="Live console"
        icon={<TerminalSquare size={16} className="text-muted-foreground" />}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={snap.phase === "live" ? "success" : "neutral"} dot>
              {snap.phase === "live" ? "Streaming" : "Disconnected"}
            </Badge>
            {compact && (
              <Link
                href="/console"
                aria-label="Open full console"
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <ArrowUpRight size={15} />
              </Link>
            )}
          </div>
        }
      />
      {!compact && (
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <div className="relative min-w-40 flex-1">
            <Search
              className="absolute left-3 top-3 text-muted-foreground"
              size={14}
            />
            <Input
              aria-label="Search console"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Host logs…"
            />
          </div>
          <div className="flex gap-1" aria-label="Log severity">
            {["all", "INFO", "WARN", "ERROR", "DEBUG"].map((v) => (
              <Button
                key={v}
                size="sm"
                variant={level === v ? "secondary" : "ghost"}
                aria-pressed={level === v}
                onClick={() => setLevel(v)}
              >
                {v === "all" ? "All" : v}
              </Button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={paused ? "Resume console" : "Pause console"}
            onClick={() => {
              if (!paused) setFrozen({ binding, lines });
              setPaused((v) => !v);
            }}
          >
            {paused ? <Play /> : <Pause />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Refresh Host history"
            disabled={history.busy}
            onClick={() => void history.refresh()}
          >
            <RefreshCw />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={wrap}
            onClick={() => setWrap((v) => !v)}
          >
            Wrap
          </Button>
        </div>
      )}
      {snap.state.bootEpochId && !compact && (
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-[10px] text-muted-foreground">
          <span className="size-1 rounded-full bg-primary" />
          <span>
            Boot <code>{snap.state.bootEpochId.slice(0, 8)}</code>
          </span>
          {snap.state.bootStartedAt && (
            <span>
              ·{" "}
              {new Date(snap.state.bootStartedAt).toLocaleString(undefined, {
                timeZone: prefs.timezone === "UTC" ? "UTC" : undefined,
              })}
            </span>
          )}
          <span className="ml-auto">Refreshes on restart</span>
        </div>
      )}
      {history.error && !compact && (
        <div className="p-3">
          <Notice>{history.error}</Notice>
        </div>
      )}
      <div className="min-h-0 flex-1">
        <VirtualConsole
          key={`${snap.revision}:${snap.state.bootEpochId ?? "unknown"}`}
          lines={paused && frozen.binding === binding ? frozen.lines : lines}
          height={compact ? 324 : 470}
          wrap={wrap}
          tail={!paused}
          utc={prefs.timezone === "UTC"}
          returnVersion={returnVersion}
          onFollowChange={setFollowing}
        />
      </div>
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 border-t bg-terminal px-4 py-1.5 text-[9px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1 rounded-full bg-primary" />
          {paused
            ? "Display paused"
            : following
              ? "Following live"
              : "Inspecting history"}
        </span>
        {!following || paused ? (
          <button
            className="text-primary"
            onClick={() => {
              setPaused(false);
              setReturn((v) => v + 1);
            }}
          >
            Return to live ↓
          </button>
        ) : (
          <span>Host SQLite · {lines.length.toLocaleString()} lines</span>
        )}
        {!compact && (
          <button
            disabled={!history.more || history.busy}
            onClick={() => void history.older()}
            className="text-primary disabled:opacity-40"
          >
            Load older
          </button>
        )}
      </div>
      <form
        className="flex min-h-14 items-center gap-3 border-t bg-card px-4 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (command.trim() && !reason)
            op.prepare("console.execute", { command: command.trim() }, "PAPER");
        }}
      >
        <ChevronRight size={16} className="shrink-0 text-primary" />
        <input
          aria-label="Server command"
          maxLength={512}
          value={command}
          onChange={(e) => setCommand(e.target.value.replace(/[\r\n]/g, " "))}
          placeholder="Type a server command…"
          className="min-w-0 flex-1 bg-transparent py-2 font-mono text-[11px] outline-none placeholder:text-muted-foreground"
        />
        <Button
          type="submit"
          aria-label="Review server command"
          variant="secondary"
          size="sm"
          disabled={!command.trim() || !!reason}
          title={reason}
        >
          <span className="hidden sm:inline">Review</span>
          <Send size={12} />
        </Button>
      </form>
      {reason && (
        <p className="border-t px-4 py-2 text-[10px] text-muted-foreground">
          {reason}
        </p>
      )}
      {op.review}
    </Card>
  );
}

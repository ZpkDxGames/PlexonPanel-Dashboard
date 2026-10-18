"use client";
import { useTimestamp } from "../presentation/nextgen/time";
import { ArrowDownLeft, ArrowUpRight, Clock3 } from "lucide-react";
import { useSession } from "../hooks";
import { hasScope } from "../presentation/authority";
import { record, records, str } from "../adapter/control-state";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Badge } from "./ui/badge";
export function PresenceTimeline() {
  const stamp = useTimestamp();
  const snap = useSession(),
    allowed = hasScope(snap, "players.view"),
    data = allowed ? record(snap.state.sessionEvents) : {},
    events = records(data.events, 10000);
  return (
    <Card>
      <CardHeader
        title="Current boot timeline"
        description="Host SQLite + player-events-current.json"
        icon={<Clock3 size={16} className="text-muted-foreground" />}
        action={
          snap.state.bootEpochId && (
            <Badge>Boot {snap.state.bootEpochId.slice(0, 8)}</Badge>
          )
        }
      />
      <CardContent
        className="max-h-80 space-y-4 overflow-y-auto"
        tabIndex={0}
        role="region"
        aria-label="Boot session events"
      >
        {events.length ? (
          events
            .slice(-50)
            .reverse()
            .map((event, i) => (
              <div
                key={str(event.eventId, String(i))}
                className="flex items-center gap-3"
              >
                <span
                  className={`rounded-lg p-2 ${event.action === "JOINED" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                >
                  {event.action === "JOINED" ? (
                    <ArrowDownLeft size={15} />
                  ) : (
                    <ArrowUpRight size={15} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs">
                    <strong>{str(event.playerName)}</strong>
                    <span className="ml-2 text-muted-foreground">
                      {str(event.action).toLowerCase()}
                    </span>
                  </p>
                  <p className="mt-1 truncate font-mono text-[9px] text-muted-foreground">
                    {str(event.playerUuid)}
                  </p>
                </div>
                <time className="text-[10px] text-muted-foreground">
                  {stamp(event.observedAt)}
                </time>
              </div>
            ))
        ) : (
          <p className="py-4 text-xs text-muted-foreground">
            {allowed
              ? "No player events received for this boot."
              : "This device needs players.view."}
          </p>
        )}
        {data.incomplete === true && (
          <p className="text-[10px] text-amber-500">
            The bounded Host timeline is incomplete. Missing sessions are
            unknown.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

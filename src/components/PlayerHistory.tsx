"use client";
import { useMemo } from "react";
import { Clock3 } from "lucide-react";
import { str, record } from "../adapter/control-state";
import { useSession } from "../hooks";
import { hasScope } from "../presentation/authority";
import { bootPlayerEvents } from "../presentation/player-history";
import { useTimestamp } from "../presentation/nextgen/time";
import { Badge } from "./ui/badge";
import { Empty, Notice } from "./ui/empty";
import { VirtualRows } from "./VirtualRows";
export function PlayerHistory({ uuid }: { uuid: string }) {
  const snap = useSession(),
    stamp = useTimestamp(),
    allowed = hasScope(snap, "players.view"),
    data = record(snap.state.sessionEvents);
  const entries = useMemo(
    () =>
      allowed
        ? bootPlayerEvents(data, snap.state.bootEpochId, uuid).slice().reverse()
        : [],
    [allowed, snap.state.sessionEvents, snap.state.bootEpochId, uuid],
  );
  const known =
    !!snap.state.bootEpochId && data.bootEpochId === snap.state.bootEpochId;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] text-muted-foreground">
          Host SQLite · current boot record
        </p>
        {snap.state.bootEpochId && (
          <Badge>{snap.state.bootEpochId.slice(0, 8)}</Badge>
        )}
      </div>
      {!allowed ? (
        <Notice>This device needs players.view.</Notice>
      ) : !known ? (
        <Empty title="Waiting for Host session history">
          Current boot records arrive from the Host Companion.
        </Empty>
      ) : entries.length ? (
        <VirtualRows
          rows={entries}
          height={340}
          label="Selected player boot events"
          getKey={(event) =>
            str(event.eventId, `${event.observedAt}:${event.action}`)
          }
          render={(event) => (
            <div className="flex items-start gap-3 border-b py-4">
              <Clock3
                size={15}
                className="mt-0.5 shrink-0 text-muted-foreground"
              />
              <div className="min-w-0">
                <p className="text-xs font-medium">
                  {str(event.action)} · {str(event.termination)}
                </p>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {stamp(event.observedAt)}
                </p>
                <p className="mt-1 break-all font-mono text-[9px] text-muted-foreground">
                  {uuid}
                </p>
              </div>
            </div>
          )}
        />
      ) : (
        <Empty title="No events for this UUID in the current boot" />
      )}
      {data.incomplete === true && (
        <Notice>
          The bounded Host record is incomplete. Missing sessions remain
          unknown.
        </Notice>
      )}
    </div>
  );
}

"use client";
import { useEffect, useMemo, useState } from "react";
import { Clock3 } from "lucide-react";
import { str, type JsonMap } from "../adapter/control-state";
import { useQuery } from "../features/useQuery";
import { playerHistoryPage } from "../presentation/player-history";
import { useTimestamp } from "../presentation/nextgen/time";
import { Button } from "./ui/button";
import { Notice, Empty } from "./ui/empty";
export function PlayerHistory({ uuid }: { uuid: string }) {
  const [cursor, setCursor] = useState<string | undefined>(),
    [entries, setEntries] = useState<JsonMap[]>([]),
    stamp = useTimestamp();
  const read = useQuery("players.history.list", "PAPER", {
    query: uuid,
    limit: 25,
    ...(cursor ? { cursor } : {}),
  });
  const page = useMemo(
    () => playerHistoryPage(read.data, uuid),
    [read.data, uuid],
  );
  useEffect(() => {
    if (read.at)
      setEntries((old) =>
        (cursor ? [...old, ...page.entries] : page.entries)
          .filter(
            (e, i, all) => all.findIndex((x) => x.eventId === e.eventId) === i,
          )
          .slice(-500),
      );
  }, [read.at, page, cursor]);
  return (
    <div className="space-y-4">
      {read.error && <Notice>{read.error}</Notice>}
      {page.enabled === false && (
        <Notice>
          Paper player history is disabled. Current boot events remain in the
          Host timeline.
        </Notice>
      )}
      {entries.length ? (
        <div className="space-y-4">
          {entries.map((event, i) => (
            <div
              key={str(event.eventId, String(i))}
              className="flex items-start gap-3 rounded-lg border p-3"
            >
              <Clock3 size={15} className="mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-xs font-medium">
                  {str(event.state)} · {str(event.termination)}
                </p>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {stamp(event.observedAt)}
                </p>
                <p className="mt-1 font-mono text-[9px] text-muted-foreground">
                  {uuid}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title={
            read.busy
              ? "Reading player history…"
              : "No history received for this UUID"
          }
        />
      )}
      <Button
        variant="outline"
        disabled={!page.cursor || read.busy}
        onClick={() => setCursor(page.cursor ?? undefined)}
      >
        Load older sessions
      </Button>
      {page.bounded && (
        <p className="text-[10px] text-muted-foreground">
          Bounded source history · up to 500 inspected records in tab memory
        </p>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { session } from "../adapter/session";
import { number, str } from "../adapter/control-state";
import { useSession } from "../hooks";
import { usePreferences } from "../store/preferences";
import { hasScope } from "../presentation/authority";
import { playerHistoryPage } from "../presentation/player-history";
import { Panel, Empty, Button, Notice, Status } from "./ui";
import { Icon } from "./Icon";

export function PlayerHistory({ uuid }: { uuid: string }) {
  const snap = useSession(),
    prefs = usePreferences();
  const [page, setPage] = useState<ReturnType<typeof playerHistoryPage> | null>(
      null,
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const ticket = useRef(0),
    mounted = useRef(false);
  const allowed = hasScope(snap, "players.history.view");
  const reason = session.reason("players.history.list", "PAPER");
  const load = async (cursor: string | null = null) => {
    if (!allowed || reason) return;
    const current = ++ticket.current;
    setBusy(true);
    setError("");
    try {
      const result = await session.query(
        "players.history.list",
        { query: uuid, limit: 25, ...(cursor ? { cursor } : {}) },
        "PAPER",
      );
      if (mounted.current && current === ticket.current)
        setPage(playerHistoryPage(result.data, uuid));
    } catch (cause) {
      if (mounted.current && current === ticket.current)
        setError(
          cause instanceof Error ? cause.message : "History unavailable.",
        );
    } finally {
      if (mounted.current && current === ticket.current) setBusy(false);
    }
  };
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      ticket.current++;
    };
  }, [uuid, allowed, reason]);
  const stamp = (value: unknown) => {
    const at = typeof value === "string" ? Date.parse(value) : NaN;
    return Number.isFinite(at)
      ? new Date(at).toLocaleString(undefined, {
          timeZone: prefs.timezone === "UTC" ? "UTC" : undefined,
        })
      : "Not reported";
  };
  return (
    <Panel
      title="Session history"
      eyebrow="PAPER / RETAINED OBSERVATIONS"
      className="player-history"
      action={<Icon name="clock" />}
    >
      {!allowed || reason ? (
        <Empty title="History unavailable">
          {!allowed ? "This device needs players.history.view." : reason}
        </Empty>
      ) : (
        <>
          <div className="history-toolbar">
            <Status tone="neutral">
              {page?.bounded ? "Bounded history" : "Retained history"}
            </Status>
            <Button loading={busy} onClick={() => void load()}>
              Latest observations
            </Button>
          </div>
          {error && (
            <div className="history-notice">
              <Notice tone="error" title="History query unavailable">
                {error}
              </Notice>
            </div>
          )}
          {!page && busy ? (
            <p className="history-note" role="status">
              Reading authorized Paper history…
            </p>
          ) : page && page.enabled === false ? (
            <Empty title="History is disabled">
              The connected Paper agent does not retain player history.
            </Empty>
          ) : page?.entries.length ? (
            <div className="history-list">
              {page.entries.map((entry, index) => (
                <article
                  className="history-entry"
                  key={str(entry.eventId, `${index}`)}
                >
                  <span
                    className={`history-icon ${entry.state === "JOINED" ? "joined" : ""}`}
                  >
                    <Icon name={entry.state === "JOINED" ? "play" : "stop"} />
                  </span>
                  <div>
                    <strong>
                      {entry.state === "JOINED"
                        ? "Joined the server"
                        : "Session ended"}
                    </strong>
                    <time>{stamp(entry.observedAt)}</time>
                    <small>
                      {entry.state === "LEFT"
                        ? str(entry.termination, "Termination not reported")
                        : "Observed join event"}
                    </small>
                  </div>
                  <span>
                    {number(entry.sessionDurationMillis) === null
                      ? "—"
                      : `${Math.floor(number(entry.sessionDurationMillis)! / 60000)}m`}
                  </span>
                </article>
              ))}
            </div>
          ) : !busy && !error ? (
            <Empty title="No retained observations">
              Paper has not returned matching history for this UUID.
            </Empty>
          ) : null}
          {page?.cursor && (
            <div className="panel-actions">
              <Button loading={busy} onClick={() => void load(page.cursor)}>
                Older observations <Icon name="arrow" />
              </Button>
            </div>
          )}
          <p className="history-note">
            Retained observations are not lifetime playtime or a total session
            count. Missing endings and durations remain unknown.
          </p>
          {page && (
            <p className="history-note">
              Source capture: {stamp(page.capturedAt)}
            </p>
          )}
        </>
      )}
    </Panel>
  );
}

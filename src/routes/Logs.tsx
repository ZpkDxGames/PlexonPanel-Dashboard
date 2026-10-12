import { Icon } from "../components/Icon";
import { Button } from "../components/ui";
import { copy } from "../i18n/en";
import { useMemo, useState } from "react";
import { useSession } from "../hooks";
import { groupLogs } from "../lib/log-parser";
import { str } from "../adapter/control-state";
import { Panel, Status } from "../components/ui";
import { Segmented } from "../components/Segmented";
import { FormattedText } from "../components/FormattedText";
export default function Logs() {
  const { state } = useSession(),
    [filter, setFilter] = useState("all"),
    [limit, setLimit] = useState(8);
  const events = useMemo(() => {
    const logs = groupLogs(state.console).flatMap((e) => {
      const world = /world|chunk|generat|terrain|region|noise/i.test(
          e.message + " " + e.source,
        ),
        backup = /backup|remote_verify|rclone|snapshot|restore/i.test(
          e.message + " " + e.source,
        ),
        critical = ["ERROR", "FATAL"].includes(e.level);
      const category =
        e.kind === "join" || e.kind === "leave"
          ? "players"
          : backup
            ? "backups"
            : world && (critical || e.level === "WARN")
              ? "worlds"
              : critical
                ? "errors"
                : null;
      return category
        ? [
            {
              id: e.id,
              time: e.time,
              category,
              message: e.message,
              level: e.level,
              trace: e.trace,
            },
          ]
        : [];
    });
    // Prefer dedicated presence events where available; avoid the corresponding console duplicate.
    const presence = state.presenceDeltas.map((e) => ({
      id: str(e.eventId),
      time: new Date(str(e.observedAt)).toLocaleTimeString(),
      category: "players",
      message: `${str(e.name)} ${e.state === "JOINED" ? "joined" : "left"} the game`,
      level: "INFO",
      trace: [] as string[],
    }));
    const messages = new Set(presence.map((e) => e.message + ":" + e.time));
    const backup = state.backupProgress
      ? [
          {
            id: "backup-current",
            time: new Date(
              str(
                state.backupProgress.capturedAt,
                state.updatedAt ? new Date(state.updatedAt).toISOString() : "",
              ),
            ).toLocaleTimeString(),
            category: "backups",
            message: `Backup: ${str(state.backupProgress.message, str(state.backupProgress.phase, "Update received"))}`,
            level: state.backupProgress.status === "FAILED" ? "ERROR" : "INFO",
            trace: [] as string[],
          },
        ]
      : [];
    return [
      ...backup,
      ...presence.reverse(),
      ...logs.filter((e) => !messages.has(e.message + ":" + e.time)).reverse(),
    ].slice(0, 200);
  }, [state.console, state.presenceDeltas, state.backupProgress]);
  const shown = events.filter((e) => filter === "all" || e.category === filter);
  return (
    <Panel
      title={copy.refine_587f8868}
      eyebrow={copy.refine_1da6f13e}
      action={
        <Status>
          {events.length} {copy.refine_181c5759}
        </Status>
      }
    >
      <div className="activity-filters">
        <Segmented label="Activity filter" value={filter}>
          {[
            ["all", "All"],
            ["players", "Players"],
            ["worlds", "World generation"],
            ["backups", "Backups"],
            ["errors", "Critical errors"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={filter === key ? "active" : ""}
              aria-pressed={filter === key}
              onClick={() => {
                setFilter(key);
                setLimit(8);
              }}
            >
              {label}
            </button>
          ))}
        </Segmented>
      </div>
      <div className="event-list">
        {shown.slice(0, limit).map((e) => (
          <article
            className="event-row"
            key={e.id}
            data-level={e.level}
            data-category={e.category}
          >
            <time>{e.time}</time>
            <span className="event-icon">
              <Icon
                name={
                  e.category === "players"
                    ? "players"
                    : e.category === "worlds"
                      ? "globe"
                      : e.category === "backups"
                        ? "backups"
                        : "alert"
                }
              />
            </span>
            <p>
              <FormattedText value={e.message} />
            </p>
            {e.trace.length > 0 && (
              <details>
                <summary>
                  {copy.refine_9435898e}
                  {e.trace.length} {copy.refine_8525aaa8}
                </summary>
                {e.trace.join("\n")}
              </details>
            )}
          </article>
        ))}
      </div>
      {shown.length > limit && (
        <div className="button-row" style={{ marginTop: 16 }}>
          <Button onClick={() => setLimit((n) => n + 8)}>
            Show older events · {shown.length - limit} more
          </Button>
        </div>
      )}
      {!shown.length && (
        <div className="inline-empty">
          <strong>{copy.refine_1103f9da}</strong>
          <span>{copy.refine_79ba9cee}</span>
        </div>
      )}
      <p className="subtle" style={{ marginTop: 16 }}>
        {copy.refine_f3fc0307}
      </p>
    </Panel>
  );
}

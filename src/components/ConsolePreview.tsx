import { memo, useMemo, useState } from "react";
import { useSession } from "../hooks";
import { usePreferences } from "../store/preferences";
import { hasScope } from "../presentation/authority";
import { str, type JsonMap } from "../adapter/control-state";
import { FormattedText } from "./FormattedText";
import { Icon } from "./Icon";
import { Panel, Status, Empty } from "./ui";
import { navigate } from "../router";

/** A bounded, read-only window. Command dispatch belongs to the reviewed console. */
export function ConsolePreview() {
  const snap = useSession(),
    prefs = usePreferences();
  const [paused, setPaused] = useState(false),
    [frozen, setFrozen] = useState<JsonMap[]>([]);
  const allowed =
    hasScope(snap, "console.view.full") ||
    hasScope(snap, "console.view.errors");
  const current = allowed ? (paused ? frozen : snap.state.console) : emptyLines;
  const lines = useMemo(() => current.slice(-8), [current]);
  const authority = snap.state.ready?.consoleAuthority ?? "UNAVAILABLE";
  return (
    <Panel
      title="Console"
      className="overview-console"
      action={
        <button className="text-link" onClick={() => navigate("Console")}>
          Open console <Icon name="arrow" />
        </button>
      }
    >
      <div
        className="preview-terminal"
        role="region"
        tabIndex={0}
        aria-label="Recent console output"
      >
        {lines.length ? (
          <PreviewRows lines={lines} utc={prefs.timezone === "UTC"} />
        ) : (
          <Empty
            title={
              allowed
                ? "Waiting for console output"
                : "Console access restricted"
            }
          >
            {allowed
              ? "New authorized output will appear here."
              : "This device needs a console viewing scope."}
          </Empty>
        )}
      </div>
      <div className="preview-terminal-footer">
        <Status
          tone={
            paused
              ? "warning"
              : authority === "UNAVAILABLE"
                ? "neutral"
                : "info"
          }
        >
          {paused
            ? "Display paused"
            : authority === "HOST"
              ? "Host journal"
              : authority === "PAPER_FALLBACK"
                ? "Paper fallback"
                : "Source unavailable"}
        </Status>
        <button
          className="text-link"
          aria-pressed={paused}
          onClick={() => {
            if (!paused) setFrozen(snap.state.console.slice(-8));
            setPaused(!paused);
          }}
        >
          <Icon name={paused ? "play" : "pause"} />
          {paused ? "Follow output" : "Pause preview"}
        </button>
      </div>
    </Panel>
  );
}

const emptyLines: JsonMap[] = [];
const clocks = [false, true].map(
  (utc) =>
    new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: utc ? "UTC" : undefined,
    }),
);
const PreviewRows = memo(function PreviewRows({
  lines,
  utc,
}: {
  lines: JsonMap[];
  utc: boolean;
}) {
  return (
    <>
      {lines.map((line, i) => {
        const value = line.capturedAt ?? line.receivedAt;
        const at = typeof value === "string" ? Date.parse(value) : NaN;
        return (
          <div
            className={`preview-line level-${str(line.level, "INFO").toLowerCase()}`}
            key={str(line.id, String(i))}
          >
            <time title={str(value)}>
              {Number.isFinite(at) ? clocks[Number(utc)].format(at) : "—"}
            </time>
            <span className="level">{str(line.level, "INFO")}</span>
            <span>
              <FormattedText value={str(line.content ?? line.rawText, "")} />
            </span>
          </div>
        );
      })}
    </>
  );
});

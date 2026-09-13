"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Empty, Panel, time, type ViewProps } from "./control-views";
import { str, type JsonMap } from "../lib/control-state";

function downloadText(filename: string, body: string) {
  const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function atConsoleTail(element: HTMLDivElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 48;
}

function lineKey(line: JsonMap, index: number): string {
  if (typeof line.journalCursor === "string" && line.journalCursor)
    return `journal:${line.journalCursor}`;
  if (
    typeof line.streamSession === "string" &&
    typeof line.sourceSequence === "number"
  )
    return `stream:${line.streamSession}:${line.sourceSequence}`;
  return `${str(line.capturedAt, "unknown")}:${str(line.fingerprint, "none")}:${index}`;
}

function consoleSourceLabel(props: ViewProps): string {
  if (!props.connected) return "Reconnecting";
  const ready = props.state.ready;
  if (ready?.consoleAuthority === "HOST") {
    if (ready.consoleSourceState === "RECOVERING") return "Host • History replay";
    if (ready.consoleSourceState === "RESTARTING") return "Host • Reconnecting";
    return "Host • Journal";
  }
  if (ready?.agents.paper) return "Paper fallback";
  if (ready?.agents.host) {
    if (ready.consoleSourceState === "JOURNAL_PERMISSION_DENIED")
      return "Host • Permission required";
    if (ready.consoleSourceState === "JOURNAL_UNAVAILABLE")
      return "Host • Console unavailable";
    return "Server offline";
  }
  return "Console offline";
}

export function ConsoleView30(props: ViewProps) {
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("ALL");
  const [paused, setPaused] = useState<JsonMap[] | null>(null);
  const [followTail, setFollowTail] = useState(true);
  const [unseenLines, setUnseenLines] = useState(0);
  const [timestamps, setTimestamps] = useState(true);
  const [wrap, setWrap] = useState(true);
  const [clearAt, setClearAt] = useState(0);
  const [command, setCommand] = useState("");
  const [output, setOutput] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const viewport = useRef<HTMLDivElement>(null);
  const previousSourceLength = useRef(0);

  const source = paused ?? props.state.console;
  const entries = useMemo(
    () =>
      source
        .filter(
          (line) =>
            (!clearAt || Date.parse(str(line.capturedAt, "")) > clearAt) &&
            (level === "ALL" || line.level === level) &&
            str(line.content).toLowerCase().includes(search.toLowerCase()),
        )
        .slice(-1200),
    [source, clearAt, level, search],
  );
  const paperOnline = Boolean(props.state.ready?.agents.paper);
  const hostOnline = Boolean(props.state.ready?.agents.host);
  const canExecute = props.can("console.execute");
  const commandAvailable = canExecute && paperOnline;
  const sourceLabel = consoleSourceLabel(props);

  useEffect(() => {
    const delta = Math.max(0, source.length - previousSourceLength.current);
    previousSourceLength.current = source.length;
    if (followTail && viewport.current) {
      viewport.current.scrollTop = viewport.current.scrollHeight;
      setUnseenLines(0);
    } else if (!paused && delta > 0) {
      setUnseenLines((current) => Math.min(2500, current + delta));
    }
  }, [entries.length, followTail, paused, source.length]);

  useEffect(() => {
    if (paused) return;
    previousSourceLength.current = props.state.console.length;
  }, [paused, props.state.console.length]);

  const jumpToTail = () => {
    setFollowTail(true);
    setUnseenLines(0);
    requestAnimationFrame(() => {
      if (viewport.current)
        viewport.current.scrollTop = viewport.current.scrollHeight;
    });
  };

  const visibleText = entries
    .map(
      (line) =>
        `${timestamps ? `[${time(line.capturedAt)}] ` : ""}${str(line.level)} ${str(line.content)}`,
    )
    .join("\n");

  return (
    <div className="cr30-console-stack">
      <div className="cr21-filter-toolbar cr30-console-toolbar">
        <label className="cr-search">
          <span className="sr-only">Search console output</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search console output"
          />
        </label>
        <div className="cr21-segmented" aria-label="Console severity filter">
          {["ALL", "INFO", "WARN", "ERROR"].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={level === value}
              onClick={() => setLevel(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <button
          className="cr-button"
          onClick={() => {
            setPaused(paused ? null : [...props.state.console]);
            setUnseenLines(0);
          }}
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <details className="cr21-menu">
          <summary className="cr-button">Display</summary>
          <div>
            <button onClick={() => setTimestamps(!timestamps)}>
              {timestamps ? "Hide timestamps" : "Show timestamps"}
            </button>
            <button onClick={() => setWrap(!wrap)}>
              {wrap ? "Disable wrapping" : "Enable wrapping"}
            </button>
            <button
              disabled={!entries.length}
              onClick={() =>
                void navigator.clipboard
                  .writeText(visibleText)
                  .then(() => props.notice("Visible console lines copied."))
              }
            >
              Copy visible lines
            </button>
            <button
              disabled={!entries.length}
              onClick={() =>
                downloadText(
                  `plexonpanel-console-${new Date().toISOString().replaceAll(":", "-")}.log`,
                  visibleText,
                )
              }
            >
              Export browser-session log
            </button>
            <button
              onClick={() => {
                setClearAt(Date.now());
                setUnseenLines(0);
              }}
            >
              Clear local display
            </button>
          </div>
        </details>
        <Badge>{entries.length} lines</Badge>
      </div>

      <Panel
        title="Live console"
        className="cr30-console-panel"
        aside={
          <div className="cr21-panel-badges">
            {paused && <Badge tone="amber">View paused</Badge>}
            {!followTail && !paused && <Badge tone="quiet">Reading history</Badge>}
            <Badge
              tone={
                sourceLabel === "Host • Journal" || sourceLabel === "Paper fallback"
                  ? "green"
                  : "amber"
              }
            >
              {sourceLabel}
            </Badge>
          </div>
        }
      >
        {!paperOnline && hostOnline && (
          <p className="cr-hint cr-pad cr30-console-offline-note">
            Paper is offline. Console output remains available through the Host Companion when its
            journal source is healthy. Command input will unlock after Paper is ready.
          </p>
        )}
        <div className="cr30-console-viewport-wrap">
          <div
            className={`cr-console cr21-console ${wrap ? "wrap" : "nowrap"}`}
            ref={viewport}
            role="log"
            aria-live="off"
            onScroll={() => {
              const element = viewport.current;
              if (!element || paused) return;
              if (atConsoleTail(element)) {
                if (!followTail) setFollowTail(true);
                if (unseenLines) setUnseenLines(0);
              } else if (followTail) {
                setFollowTail(false);
              }
            }}
          >
            {entries.length ? (
              entries.map((line, index) => {
                const invocation = str(line.invocationId, ""),
                  previousInvocation =
                    index > 0 ? str(entries[index - 1].invocationId, "") : "",
                  showSession = Boolean(invocation && invocation !== previousInvocation),
                  content = str(line.content),
                  dataGap = /console lines were dropped|bounded recent replay|cursor could not be resumed/i.test(
                    content,
                  );
                return (
                  <div className="cr30-console-entry" key={lineKey(line, index)}>
                    {showSession && (
                      <div className="cr30-console-session" role="separator">
                        <strong>PlexonCraft startup</strong>
                        <span>{time(line.capturedAt)}</span>
                        <code>Session {invocation.slice(0, 8)}…</code>
                      </div>
                    )}
                    <div
                      className={`cr-console-line ${str(line.level).toLowerCase()} ${dataGap ? "gap" : ""}`}
                    >
                      {timestamps && <time>{time(line.capturedAt)}</time>}
                      <span>{str(line.level)}</span>
                      <code>
                        {content.replace(
                          new RegExp(
                            String.fromCharCode(27) + "\\[[0-?]*[ -/]*[@-~]",
                            "g",
                          ),
                          "",
                        )}
                      </code>
                      <button
                        title="Copy line"
                        aria-label="Copy console line"
                        onClick={() =>
                          void navigator.clipboard
                            .writeText(content)
                            .then(() => props.notice("Line copied."))
                        }
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <Empty title="No console lines to display">
                {hostOnline && !paperOnline
                  ? "The Host Companion is online, but no allowed console history is available yet. Check the journal source status if this persists."
                  : "Console content depends on the locally enabled stream and this device's scope. Missing data is not replaced with examples."}
              </Empty>
            )}
          </div>
          {!paused && !followTail && (
            <button className="cr30-console-new-lines" onClick={jumpToTail}>
              {unseenLines > 0
                ? `${unseenLines} new line${unseenLines === 1 ? "" : "s"}`
                : "Return to live tail"}
            </button>
          )}
        </div>

        {canExecute ? (
          <form
            className="cr-command cr30-command-bar"
            onSubmit={(event) => {
              event.preventDefault();
              if (!commandAvailable) return;
              const value = command.trim();
              if (!value) return;
              setCommand("");
              void props
                .run("console.execute", { command: value, confirmed: true })
                .then((result) => {
                  setOutput(
                    Array.isArray(result.data.output)
                      ? result.data.output.map(String)
                      : [],
                  );
                  if (
                    /^(?:tps|mspt|list|version|plugins|spark (?:tps|health))$/i.test(
                      value.replace(/^\//, ""),
                    )
                  )
                    setHistory((current) =>
                      [value, ...current.filter((item) => item !== value)].slice(0, 20),
                    );
                  setHistoryIndex(-1);
                })
                .catch(() => {});
            }}
          >
            <span aria-hidden>›</span>
            <input
              value={command}
              disabled={!commandAvailable}
              onChange={(event) => setCommand(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  const next = Math.min(history.length - 1, historyIndex + 1);
                  setHistoryIndex(next);
                  setCommand(history[next] ?? "");
                }
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  const next = Math.max(-1, historyIndex - 1);
                  setHistoryIndex(next);
                  setCommand(history[next] ?? "");
                }
              }}
              autoComplete="off"
              spellCheck={false}
              maxLength={512}
              placeholder={
                paperOnline
                  ? "Enter a locally allowlisted command"
                  : "Paper is offline — commands unavailable"
              }
              aria-label="Console command"
            />
            <button
              className="cr-button primary"
              disabled={!commandAvailable || !command.trim()}
            >
              Run
            </button>
          </form>
        ) : (
          <p className="cr-hint cr-pad">
            Read-only console. Command execution requires a locally enabled capability and device
            scope.
          </p>
        )}
      </Panel>

      {output.length > 0 && (
        <Panel title="Latest command result">
          <pre className="cr-output">{output.join("\n")}</pre>
        </Panel>
      )}
      <p className="cr-hint cr30-console-authority">
        Output source: {sourceLabel}. Console output and command execution intentionally use separate
        authorities: Host owns lifecycle output when healthy; Paper owns commands. Clearing the view
        remains browser-local and never deletes server or journal logs.
      </p>
    </div>
  );
}

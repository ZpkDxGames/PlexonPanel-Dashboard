"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Empty, Panel, time, type ViewProps } from "./control-views";
import { str, type JsonMap } from "../lib/control-state";

const RETENTION_NOTICE =
  "Console history is limited to entries currently retained by systemd-journald on the Host.";

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

function stableLineId(line: JsonMap): string {
  if (typeof line.journalCursor === "string" && line.journalCursor)
    return `journal:${line.journalCursor}`;
  if (
    typeof line.streamSession === "string" &&
    typeof line.sourceSequence === "number"
  )
    return `stream:${line.streamSession}:${line.sourceSequence}`;
  return `${str(line.capturedAt, "unknown")}:${str(line.fingerprint, "none")}:${str(line.content, "")}`;
}

function lineKey(line: JsonMap, index: number): string {
  return `${stableLineId(line)}:${index}`;
}

function mergeConsoleLines(history: JsonMap[], live: JsonMap[]): JsonMap[] {
  const unique = new Map<string, JsonMap>();
  for (const line of [...history, ...live]) unique.set(stableLineId(line), line);
  return [...unique.values()].sort((left, right) => {
    const a = Date.parse(str(left.capturedAt, ""));
    const b = Date.parse(str(right.capturedAt, ""));
    if (!Number.isFinite(a) && !Number.isFinite(b)) return 0;
    if (!Number.isFinite(a)) return 1;
    if (!Number.isFinite(b)) return -1;
    return a - b;
  });
}

function consoleSourceLabel(props: ViewProps): string {
  if (!props.connected) return "Reconnecting";
  const ready = props.state.ready;
  if (ready?.consoleAuthority === "PAPER_FALLBACK") return "Paper • Live fallback";
  if (ready?.consoleAuthority === "UNAVAILABLE") return "Console unavailable";
  if (!ready?.agents.host) return "Host offline";
  if (ready.consoleSourceState === "RECOVERING") return "Host • History replay";
  if (ready.consoleSourceState === "RESTARTING") return "Host • Reconnecting";
  if (ready.consoleSourceState === "JOURNAL_PERMISSION_DENIED")
    return "Host • Permission required";
  if (ready.consoleSourceState === "JOURNAL_UNAVAILABLE") return "Host • Console unavailable";
  if (ready.consoleSourceState === "STARTING") return "Host • Starting";
  if (ready.consoleSourceState === "DISABLED") return "Host • Console disabled";
  if (ready.consoleSourceState === "STOPPED") return "Host • Console stopped";
  return "Host • Journal";
}

export function ConsoleView30(props: ViewProps) {
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [historical, setHistorical] = useState<JsonMap[]>([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyHasMore, setHistoryHasMore] = useState(true);
  const [historyCursor, setHistoryCursor] = useState("");
  const [historyBefore, setHistoryBefore] = useState("");
  const [historyKeyLoaded, setHistoryKeyLoaded] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [historyNotice, setHistoryNotice] = useState(RETENTION_NOTICE);
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
  const historyGeneration = useRef(0);
  const historyPending = useRef(false);

  const paperOnline = Boolean(props.state.ready?.agents.paper);
  const hostOnline = Boolean(props.state.ready?.agents.host);
  const canExecute = props.can("console.execute");
  const commandAvailable = canExecute && paperOnline;
  const canFullHistory = props.can("console.history", "HOST");
  const canErrorHistory = props.can("console.history.errors", "HOST");
  const historyAction = canFullHistory
    ? "console.history"
    : canErrorHistory
      ? "console.history.errors"
      : null;
  const sourceLabel = consoleSourceLabel(props);
  const historyKey = JSON.stringify([props.state.serverId, props.deviceGrant?.deviceId, props.state.ready?.device.issuedAt, props.connected, hostOnline, historyAction, level, fromDate, toDate, historyRefresh]);
  const combined = useMemo(
    () => mergeConsoleLines(historyKeyLoaded === historyKey ? historical : [], props.state.console),
    [historyKeyLoaded, historyKey, historical, props.state.console],
  );
  const source = paused ?? combined;
  const entries = useMemo(
    () =>
      source
        .filter(
          (line) =>
            (!clearAt || Date.parse(str(line.capturedAt, "")) > clearAt) &&
            (level === "ALL" || line.level === level) &&
            str(line.content).toLowerCase().includes(search.toLowerCase()),
        )
        .slice(-2500),
    [source, clearAt, level, search],
  );

  useEffect(() => {
    const requests = historyGeneration;
    const token = ++requests.current;
    historyPending.current = false;
    if (!hostOnline || !props.connected || !historyAction) return;
    if (historyAction === "console.history.errors" && level === "INFO") {
      const timer = window.setTimeout(() => {
        setHistorical([]);
        setHistoryHasMore(false);
        setHistoryKeyLoaded(historyKey);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(async () => {
      historyPending.current = true;
      setHistoryBusy(true);
      setHistoryError("");
      try {
        if (fromDate && toDate && fromDate > toDate)
          throw new Error("From must be on or before To.");
        const parameters: JsonMap = { limit: 100 };
        if (level !== "ALL") parameters.levels = [level];
        if (fromDate) parameters.after = new Date(`${fromDate}T00:00:00`).toISOString();
        if (toDate) parameters.before = new Date(`${toDate}T23:59:59.999`).toISOString();
        const result = await props.run(historyAction, parameters, "HOST");
        if (historyGeneration.current !== token) return;
        const lines = Array.isArray(result.data.lines)
          ? result.data.lines.filter((line): line is JsonMap => Boolean(line && typeof line === "object" && !Array.isArray(line))).slice(0, 100)
          : [];
        const nextCursor = str(result.data.nextCursor, "");
        const oldest = lines.length ? str(lines[0].capturedAt, "") : "";
        setHistorical(lines);
        setHistoryKeyLoaded(historyKey);
        setHistoryCursor(nextCursor);
        setHistoryBefore(oldest);
        setHistoryHasMore(Boolean(result.data.hasMore && (nextCursor || oldest)));
        setHistoryNotice(str(result.data.retentionNotice, RETENTION_NOTICE));
      } catch (reason) {
        if (historyGeneration.current === token) {
          setHistorical([]);
          setHistoryKeyLoaded(historyKey);
          setHistoryCursor("");
          setHistoryBefore("");
          setHistoryHasMore(false);
          setHistoryError(reason instanceof Error ? reason.message : "Host journal history is unavailable.");
        }
      } finally {
        if (historyGeneration.current === token) {
          historyPending.current = false;
          setHistoryBusy(false);
        }
      }
    }, 0);
    return () => {
      window.clearTimeout(timer);
      requests.current++;
      historyPending.current = false;
    };
    // The source key captures the server, signed connection, permission and level.
    // props.run is deliberately read at request time; a new render must not restart the query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyKey, hostOnline, props.connected, historyAction, level, fromDate, toDate]);

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
    previousSourceLength.current = combined.length;
  }, [paused, combined.length]);

  const jumpToTail = () => {
    setFollowTail(true);
    setUnseenLines(0);
    requestAnimationFrame(() => {
      if (viewport.current)
        viewport.current.scrollTop = viewport.current.scrollHeight;
    });
  };

  const loadOlder = async () => {
    if (!historyAction || !hostOnline || historyPending.current || historyKeyLoaded !== historyKey || !historyHasMore) return;
    const token = ++historyGeneration.current;
    historyPending.current = true;
    setHistoryBusy(true);
    setHistoryError("");
    try {
      const parameters: JsonMap = { limit: 100 };
      if (historyCursor) parameters.cursor = historyCursor;
      else if (historyBefore) parameters.before = historyBefore;
      if (fromDate) parameters.after = new Date(`${fromDate}T00:00:00`).toISOString();
      if (
        level !== "ALL" &&
        (historyAction === "console.history" || level === "WARN" || level === "ERROR")
      )
        parameters.levels = [level];
      const result = await props.run(historyAction, parameters, "HOST");
      if (historyGeneration.current !== token) return;
      const lines = Array.isArray(result.data.lines)
        ? result.data.lines.filter(
            (line): line is JsonMap =>
              Boolean(line && typeof line === "object" && !Array.isArray(line)),
          )
        : [];
      setHistorical((current) => mergeConsoleLines(lines, current).slice(-1800));
      const nextCursor = str(result.data.nextCursor, "");
      const oldest = lines.length ? str(lines[0].capturedAt, "") : "";
      setHistoryCursor(nextCursor);
      setHistoryBefore(oldest || historyBefore);
      setHistoryHasMore(Boolean(result.data.hasMore && (nextCursor || oldest) && historical.length + lines.length < 1800));
      setHistoryNotice(str(result.data.retentionNotice, RETENTION_NOTICE));
      if (!lines.length && !nextCursor)
        setHistoryError(
          "No older matching entries are currently retained by systemd-journald.",
        );
    } catch (error) {
      if (historyGeneration.current === token)
        setHistoryError(error instanceof Error ? error.message : "Unable to load Host journal history.");
    } finally {
      if (historyGeneration.current === token) {
        historyPending.current = false;
        setHistoryBusy(false);
      }
    }
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
            placeholder="Search loaded lines"
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
        <label>History from <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
        <label>History to <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
        <button
          className="cr-button"
          onClick={() => {
            setPaused(paused ? null : [...combined]);
            setUnseenLines(0);
          }}
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          className="cr-button"
          disabled={!hostOnline || !historyAction || historyBusy || historyKeyLoaded !== historyKey || !historyHasMore}
          onClick={() => void loadOlder()}
        >
          {historyBusy ? "Loading history…" : historyHasMore ? "Load older history" : "No older history"}
        </button>
        <button className="cr-button" disabled={!hostOnline || !historyAction || historyBusy}
          onClick={() => { setClearAt(0); setHistoryRefresh((value) => value + 1); }}>
          Reload retained history
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
              Export visible log
            </button>
            <button
              onClick={() => {
                setClearAt(Date.now());
                setHistorical([]);
                setHistoryHasMore(false);
                setHistoryCursor("");
                setHistoryBefore("");
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
            <Badge tone={sourceLabel === "Host • Journal" ? "green" : "amber"}>
              {sourceLabel}
            </Badge>
          </div>
        }
      >
        {!hostOnline && (
          <p className="cr-hint cr-pad cr30-console-offline-note">
            Host Companion is offline. Live output can continue through the bounded Paper fallback
            when it is enabled; retained history becomes available again only after Host reconnects.
          </p>
        )}
        {hostOnline && !paperOnline && (
          <p className="cr-hint cr-pad cr30-console-offline-note">
            Paper is offline. Host-owned live output and retained journald history remain available;
            command input unlocks after Paper is ready.
          </p>
        )}
        <p className="cr-hint cr-pad cr30-console-offline-note">
          {historyNotice} History date and severity filters run on Host; live lines remain visible. Historical requests return at most 100 lines per page; this view holds at most 1,800 loaded history lines. Search, copy and export cover loaded visible lines only.
          {!historyAction && " This device does not have a Host console-history scope."}
        </p>
        {historyError && (
          <p className="cr-hint cr-pad cr30-console-offline-note" role="status">
            {historyError}
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
                {hostOnline
                  ? "The Host Companion is online, but no allowed console history is available yet. Check its journal source status if this persists."
                  : "Console continuity is intentionally unavailable while the Host Companion is offline."}
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
        Output source: {sourceLabel}. Host owns retained history and is preferred for live capture;
        Paper owns command execution and provides only bounded, non-persistent live fallback.
        Clearing the view remains browser-local and never deletes journal entries.
      </p>
    </div>
  );
}

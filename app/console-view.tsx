"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { time, type ViewProps } from "./control-views";
import { Badge, Button, DisabledReason, Empty, PageHeader, Panel, SourceFacts } from "./ui/workspace";
import { Disclosure } from "./ui/primitives";
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

function consoleSourceLabel(props:ViewProps):string {
  if(!props.connected)return 'UNAVAILABLE';
  if(props.state.ready?.consoleAuthority==='PAPER_FALLBACK'&&props.state.ready.agents.paper)return 'PAPER fallback';
  if(props.state.ready?.consoleAuthority==='HOST'&&props.state.ready.agents.host)return 'HOST';
  return 'UNAVAILABLE';
}
function highlight(content:string,query:string):ReactNode {
  if(!query)return content;
  const parts:ReactNode[]=[];const needle=query.toLowerCase();let cursor=0;let found=content.toLowerCase().indexOf(needle);
  while(found!==-1){parts.push(content.slice(cursor,found),<mark key={found}>{content.slice(found,found+query.length)}</mark>);cursor=found+query.length;found=content.toLowerCase().indexOf(needle,cursor);}
  parts.push(content.slice(cursor));return parts;
}

export function ConsoleView(props: ViewProps) {
  const [windowOffset,setWindowOffset]=useState(0);
  const [matchIndex,setMatchIndex]=useState(0);
  const [executing,setExecuting]=useState(false);
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

  const windowEnd=Math.max(0,entries.length-(followTail?0:Math.min(windowOffset,Math.max(0,entries.length-250))));
  const windowStart=Math.max(0,windowEnd-250);
  const renderedEntries=entries.slice(windowStart,windowEnd);
  const moveMatch=(direction:-1|1)=>{
    if(!entries.length)return;
    const next=(matchIndex+direction+entries.length)%entries.length;
    setMatchIndex(next);setFollowTail(false);setWindowOffset(Math.max(0,entries.length-next-250));
    requestAnimationFrame(()=>viewport.current?.querySelector<HTMLElement>(`[data-console-index="${next}"]`)?.focus());
  };

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
      setWindowOffset(current=>Math.min(Math.max(0,entries.length-250),current+delta));
    }
  }, [entries.length, followTail, paused, source.length]);

  useEffect(() => {
    if (paused) return;
    previousSourceLength.current = combined.length;
  }, [paused, combined.length]);

  const jumpToTail = () => {
    setFollowTail(true);
    setWindowOffset(0);
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
    <div className="pp-workspace" data-ui6-workspace="Console">
      <PageHeader title="Server console" description={sourceLabel==='HOST'?'Host journal output. Commands run through Paper.':sourceLabel==='PAPER fallback'?'Paper live fallback. Retained queries use Host.':'Live console source unavailable; loaded history stays readable.'} primary={<Button variant="primary" onClick={()=>{setPaused(paused?null:[...combined]);setUnseenLines(0);}}>{paused?'Resume local view':'Pause local view'}</Button>}/>

      <div className="pp-toolbar pp-sticky-toolbar">
        <label className="pp-field">
          <span>Search console output</span>
          <input
            value={search}
            onChange={(event) => {setSearch(event.target.value);setWindowOffset(0);setMatchIndex(0);}}
            placeholder="Search loaded lines"
          />
        </label>
        <div className="pp-segmented" aria-label="Console severity filter">
          {["ALL", "INFO", "WARN", "ERROR"].map((value) => (
            <Button
              key={value}
              type="button"
              aria-pressed={level === value}
              onClick={() => setLevel(value)}
            >
              {value==='ALL'?'All levels':value}
            </Button>
          ))}
        </div>
        <label>History from <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
        <label>History to <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
        {search&&<div className="pp-row"><Button disabled={!entries.length} disabledReason="No loaded matches." onClick={()=>moveMatch(-1)}>Previous match</Button><Button disabled={!entries.length} disabledReason="No loaded matches." onClick={()=>moveMatch(1)}>Next match</Button><span className="pp-muted">{entries.length?Math.min(matchIndex+1,entries.length):0} / {entries.length} loaded matches</span></div>}
        <Button

          disabled={!hostOnline || !historyAction || historyBusy || historyKeyLoaded !== historyKey || !historyHasMore}
          onClick={() => void loadOlder()}
        >
          {historyBusy ? "Loading history…" : historyHasMore ? "Load older history" : "No older history"}
        </Button>
        <Button  disabled={!hostOnline || !historyAction || historyBusy}
          onClick={() => { setClearAt(0); setHistoryRefresh((value) => value + 1); }}>
          Reload retained history
        </Button>
        <details className="pp-disclosure">
          <summary>More</summary>
          <div className="pp-stack">
            <Button onClick={() => setTimestamps(!timestamps)}>
              {timestamps ? "Hide timestamps" : "Show timestamps"}
            </Button>
            <Button onClick={() => setWrap(!wrap)}>
              {wrap ? "Disable wrapping" : "Enable wrapping"}
            </Button>
            <Button
              disabled={!entries.length}
              onClick={() =>
                void navigator.clipboard
                  .writeText(visibleText)
                  .then(() => props.notice("Loaded console matches copied."))
              }
            >
              Copy loaded matches
            </Button>
            <Button
              disabled={!entries.length}
              onClick={() =>
                downloadText(
                  `plexonpanel-console-${new Date().toISOString().replaceAll(":", "-")}.log`,
                  visibleText,
                )
              }
            >
              Export loaded log
            </Button>
            <Button
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
            </Button>
          </div>
        </details>
        <Badge>{entries.length} lines</Badge>
      </div>

      <Panel
        title="Live console"
        className="pp-stack"
        aside={
          <div className="pp-row">
            {paused && <Badge tone="amber">View paused</Badge>}
            {!followTail && !paused && <Badge tone="quiet">Reading history</Badge>}
            <Badge tone={sourceLabel === "HOST" ? "green" : "amber"}>
              {sourceLabel}
            </Badge>
          </div>
        }
      >
        <Disclosure title="Source, history and local controls">
        {!hostOnline && (
          <p className="pp-muted">
            Host Companion is offline. Live output can continue through the bounded Paper fallback
            when it is enabled; retained history becomes available again only after Host reconnects.
          </p>
        )}
        {hostOnline && !paperOnline && (
          <p className="pp-muted">
            Paper is offline. Host-owned live output and retained journald history remain available;
            command input unlocks after Paper is ready.
          </p>
        )}
        <p className="pp-muted">
          {historyNotice} History date and severity filters run on Host; live lines remain visible. Historical requests return at most 100 lines per page; this view holds at most 1,800 loaded history lines. Search, copy and export cover loaded visible lines only.
          {!historyAction && " This device does not have a Host console-history scope."}
        </p>
        {historyError && (
          <p className="pp-muted" role="status">
            {historyError}
          </p>
        )}
        <p className="pp-muted">Pause is local. Clears this view only. Server logs are not deleted. Copy and export include every filtered loaded line, including lines outside the rendered window.</p>
        <SourceFacts source="Host journal or declared Paper live fallback" unit="log lines" receivedAt={props.state.updatedAt}/><p className="pp-muted">Each line carries its supplied capture time; per-line received-at timestamps are not retained.</p>
        <p className="pp-muted">Declared source state: {props.state.ready?.consoleSourceState??'not supplied'}. Search and display controls are local; history date and severity queries use Host.</p>
        </Disclosure>
        <div className="pp-row"><span className="pp-muted">Lines {entries.length?windowStart+1:0}–{windowEnd} of {entries.length} loaded.</span><Button disabled={windowStart===0} disabledReason="You are at the earliest loaded line." onClick={()=>{setFollowTail(false);setWindowOffset(current=>Math.min(Math.max(0,entries.length-250),current+250));}}>Show earlier loaded lines</Button><Button disabled={windowOffset===0} disabledReason="You are at the latest loaded line." onClick={()=>setWindowOffset(current=>Math.max(0,current-250))}>Show later loaded lines</Button></div>
        <div className="pp-stack pp-log-surface">
          <div
            className={`pp-log-pane ${wrap ? "wrap" : "nowrap"}`}
            aria-label="Loaded console output"
            tabIndex={0}
            ref={viewport}
            role="log"
            aria-live="off"
            onScroll={() => {
              const element = viewport.current;
              if (!element || paused) return;
              if (atConsoleTail(element) && windowOffset===0) {
                if (!followTail) setFollowTail(true);
                if (unseenLines) setUnseenLines(0);
              } else if (followTail) {
                setFollowTail(false);
              }
            }}
          >
            {entries.length ? (
              renderedEntries.map((line, visibleIndex) => {
                const index=windowStart+visibleIndex;
                const invocation = str(line.invocationId, ""),
                  previousInvocation =
                    index > 0 ? str(entries[index - 1].invocationId, "") : "",
                  showSession = Boolean(invocation && invocation !== previousInvocation),
                  content = str(line.content),
                  dataGap = /console lines were dropped|bounded recent replay|cursor could not be resumed/i.test(
                    content,
                  );
                return (
                  <div className="pp-console-entry" data-console-index={index} tabIndex={-1} key={lineKey(line, index)}>
                    {showSession && (
                      <div className="pp-log-session" role="separator">
                        <strong>{str(props.state.ready?.server.serverName, "Minecraft")} startup</strong>
                        <span>{time(line.capturedAt)}</span>
                        <code>Session {invocation.slice(0, 8)}…</code>
                      </div>
                    )}
                    <div
                      className={`pp-console-line ${str(line.level).toLowerCase()} ${dataGap ? "gap" : ""}`}
                    >
                      {timestamps && <time>{time(line.capturedAt)}</time>}
                      <span>{str(line.level)}</span>
                      <code>
                        {highlight(content.replace(
                          new RegExp(
                            String.fromCharCode(27) + "\\[[0-?]*[ -/]*[@-~]",
                            "g",
                          ),
                          "",
                        ),search)}
                      </code>
                      <Button
                        title="Copy line"
                        aria-label="Copy console line"
                        onClick={() =>
                          void navigator.clipboard
                            .writeText(content)
                            .then(() => props.notice("Line copied."))
                        }
                      >
                        Copy
                      </Button>
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
            <Button variant="primary" onClick={jumpToTail}>
              {unseenLines > 0
                ? `${unseenLines} new line${unseenLines === 1 ? "" : "s"}. Jump to latest`
                : "Jump to latest"}
            </Button>
          )}

        {(
          <form
            className="pp-composer view-command-bar"
            onSubmit={(event) => {
              event.preventDefault();
              if (!commandAvailable) return;
              const value = command.trim();
              if (!value) return;
              setCommand("");
              setExecuting(true);
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
                .catch(() => {}).finally(()=>setExecuting(false));
            }}
          >
            <label className="pp-field">Paper command
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
            </label><Button type="submit" variant="primary" busy={executing}
              disabledReason={!paperOnline?"Paper is offline. History remains readable.":!canExecute?"Read-only console. Command execution requires a locally enabled capability and device scope.":"Enter an allowlisted command."}
              disabled={!commandAvailable || !command.trim()}
            >
              {executing?"Waiting for signed result…":"Run"}
            </Button>
          </form>
        )}
        {!commandAvailable&&<DisabledReason reason={!paperOnline?'Paper is offline. History remains readable.':'Read-only console. Command execution requires a locally enabled capability and device scope.'}/>}
        </div>

      </Panel>

      {output.length > 0 && (
        <Panel title="Latest command result">
          <pre className="pp-output">{output.join("\n")}</pre>
        </Panel>
      )}
      <Disclosure title="Console authority"><p className="pp-muted">
        Output source: {sourceLabel}. Host owns retained history and is preferred for live capture;
        Paper owns command execution and provides only bounded, non-persistent live fallback.
        Clearing the view remains browser-local and never deletes journal entries.
      </p></Disclosure>
    </div>
  );
}

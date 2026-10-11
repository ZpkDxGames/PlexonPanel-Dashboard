import { copy } from "../i18n/en";
import { useEffect, useMemo, useRef, useState } from "react";
import type { JsonMap } from "../adapter/control-state";
import { groupLogs, pluginSlot, type LogEntry } from "../lib/log-parser";
import { FormattedText } from "./FormattedText";
import { Icon } from "./Icon";
import { session, type Prepared } from "../adapter/session";
import { ActionReview } from "../features/ActionReview";
import { useSession } from "../hooks";
const catalogue = [
  ["list", "Players online"],
  ["tps", "Current tick rate"],
  ["save-all", "Save worlds"],
  ["whitelist reload", "Reload whitelist"],
  ["weather clear", "Clear weather"],
  ["say", "Broadcast a message"],
  ["time set day", "Set day"],
  ["help", "Command help"],
  ["stop", "Stop the server"],
];
export function LogRow({
  entry,
  compact = false,
  open = false,
  toggle,
}: {
  entry: LogEntry;
  compact?: boolean;
  open?: boolean;
  toggle?: () => void;
}) {
  return (
    <div
      className={`log-row l-${entry.level.toLowerCase()} k-${entry.kind} ${open ? "open" : ""}`}
    >
      <time className="log-time">{entry.time}</time>
      <span className="log-lvl">{entry.level}</span>
      {!compact && (
        <span
          className={`log-src ${entry.plugin ? "plugin" : ""}`}
          style={
            {
              "--pc": `var(--c${pluginSlot(entry.source)})`,
            } as React.CSSProperties
          }
          title={entry.source}
        >
          {entry.source}
        </span>
      )}
      <span className="log-msg">
        <FormattedText value={entry.message} composer />
        {entry.count > 1 && <b className="x">×{entry.count}</b>}
      </span>
      {entry.trace.length > 0 && (
        <>
          <button className="trace-btn" onClick={toggle} aria-expanded={open}>
            {open ? "Hide trace" : `Show ${entry.trace.length} more lines`}
          </button>
          {open && (
            <pre className="trace">
              {entry.trace.join("\n")}
              <button
                onClick={() =>
                  void navigator.clipboard.writeText(
                    [entry.raw, ...entry.trace].join("\n"),
                  )
                }
              >
                {copy.copy_stack_trace_b72d9}
              </button>
            </pre>
          )}
        </>
      )}
    </div>
  );
}
export function LogViewport({
  entries,
  wrap = false,
  timestamps = true,
  threads = true,
  fontSize = 13,
}: {
  entries: LogEntry[];
  wrap?: boolean;
  timestamps?: boolean;
  threads?: boolean;
  fontSize?: number;
}) {
  const root = useRef<HTMLDivElement>(null),
    [top, setTop] = useState(0),
    [height, setHeight] = useState(500),
    [width, setWidth] = useState(800),
    [follow, setFollow] = useState(true),
    [expanded, setExpanded] = useState<Set<string>>(new Set());
  const rowHeight = fontSize * 1.55 + 5;
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => {
      setHeight(e.contentRect.height);
      setWidth(e.contentRect.width);
    });
    if (root.current) ro.observe(root.current);
    return () => ro.disconnect();
  }, []);
  const sizes = useMemo(
    () =>
      entries.map(
        (e) =>
          rowHeight +
          (e.trace.length ? 22 : 0) +
          (expanded.has(e.id) ? (e.trace.length + 2) * rowHeight : 0) +
          (wrap
            ? Math.max(
                0,
                Math.ceil(
                  e.message.length /
                    Math.max(
                      12,
                      (width -
                        (timestamps ? 78 : 0) -
                        (threads ? 130 : 0) -
                        90) /
                        (fontSize * 0.65),
                    ),
                ) - 1,
              ) * rowHeight
            : 0),
      ),
    [entries, rowHeight, expanded, wrap, width, timestamps, threads],
  );
  const offsets = useMemo(() => {
    const a = [0];
    for (const size of sizes) a.push(a.at(-1)! + size);
    return a;
  }, [sizes]);
  const total = offsets.at(-1) ?? 0;
  let lo = 0,
    hi = entries.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (offsets[mid] < top) lo = mid + 1;
    else hi = mid;
  }
  const start = Math.max(0, lo - 8);
  let end = start;
  while (end < entries.length && offsets[end] < top + height + rowHeight * 10)
    end++;
  useEffect(() => {
    if (follow && root.current) {
      root.current.scrollTop = root.current.scrollHeight;
      setTop(root.current.scrollTop);
    }
  }, [entries.length, total, follow]);
  return (
    <div className="log-viewport">
      <div
        ref={root}
        className={`log virtual-log ${wrap ? "wrap" : ""} ${!timestamps ? "no-time" : ""} ${!threads ? "no-thread" : ""}`}
        style={{ fontSize }}
        role="log"
        aria-live="off"
        tabIndex={0}
        aria-label={copy.server_output_4f9f8}
        onScroll={(e) => {
          setTop(e.currentTarget.scrollTop);
          setFollow(
            e.currentTarget.scrollHeight -
              e.currentTarget.scrollTop -
              e.currentTarget.clientHeight <
              48,
          );
        }}
      >
        <div style={{ height: total, position: "relative" }}>
          <div
            style={{ position: "absolute", top: offsets[start], width: "100%" }}
          >
            {entries.slice(start, end).map((e) => (
              <LogRow
                key={e.id}
                entry={e}
                open={expanded.has(e.id)}
                toggle={() =>
                  setExpanded((v) => {
                    const next = new Set(v);
                    next.has(e.id) ? next.delete(e.id) : next.add(e.id);
                    return next;
                  })
                }
              />
            ))}
          </div>
        </div>
        {!entries.length && (
          <div className="terminal-empty">
            <Icon name="console" />
            <strong>{copy.no_output_to_show_a57ce}</strong>
            <span>{copy.new_server_lines_will_appear_here_try_1783d}</span>
          </div>
        )}
      </div>
      {!follow && (
        <div className="more">
          <button onClick={() => setFollow(true)}>
            <Icon name="chevron" />
            {copy.jump_to_latest_d5769}
            {entries.length}
            {copy._lines_d2fb6}
          </button>
        </div>
      )}
    </div>
  );
}
export function ConsoleView({
  readOnly = false,
  mini = false,
  sourceLines,
}: {
  readOnly?: boolean;
  mini?: boolean;
  sourceLines?: JsonMap[];
}) {
  const snap = useSession();
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [paused, setPaused] = useState(false),
    [frozen, setFrozen] = useState<JsonMap[]>([]),
    [clearAt, setClearAt] = useState(-1),
    [wrap, setWrap] = useState(false),
    [timestamps, setTimestamps] = useState(true),
    [threads, setThreads] = useState(true),
    [regex, setRegex] = useState(false),
    [caseSensitive, setCase] = useState(false),
    [fontSize, setFont] = useState(13),
    [command, setCommand] = useState(""),
    [prepared, setPrepared] = useState<Prepared | null>(null),
    [error, setError] = useState(""),
    [histIndex, setHistIndex] = useState(-1),
    [history, setHistory] = useState<string[]>([]),
    [suggest, setSuggest] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null),
    commandRef = useRef<HTMLInputElement>(null),
    container = useRef<HTMLElement>(null);
  const current = sourceLines ?? (paused ? frozen : snap.state.console);
  const entries = useMemo(() => groupLogs(current), [current]);
  const authority =
    snap.state.ready?.consoleAuthority === "HOST" ? "HOST" : "PAPER";
  const offline = !snap.state.ready?.agents.paper;
  const commandReason = session.reason("console.execute", authority);
  useEffect(() => {
    try {
      setHistory(
        JSON.parse(
          localStorage.getItem(`plexon:commands:${snap.state.serverId}`) ??
            "[]",
        ),
      );
    } catch {
      setHistory([]);
    }
  }, [snap.state.serverId]);
  let expression: RegExp | null = null,
    regexError = "";
  if (regex && query) {
    try {
      expression = new RegExp(query, caseSensitive ? "" : "i");
    } catch {
      regexError = "Invalid pattern. Your output is still available.";
    }
  }
  const matches = entries.filter(
    (e, i) =>
      i > clearAt &&
      (filter === "all" ||
        (filter === "chat" && e.kind === "chat") ||
        (filter === "joins" && ["join", "leave"].includes(e.kind)) ||
        (filter === "commands" && e.kind === "command") ||
        (filter === "warn" && e.level === "WARN") ||
        (filter === "error" && ["ERROR", "FATAL"].includes(e.level))) &&
      (!query ||
        regexError ||
        (expression
          ? expression.test(e.message)
          : caseSensitive
            ? e.message.includes(query)
            : e.message.toLowerCase().includes(query.toLowerCase()))),
  );
  const suggestions = command.trim()
    ? catalogue
        .filter(([cmd]) => cmd.startsWith(command.replace(/^\//, "")))
        .slice(0, 5)
    : [];
  const prepare = (text: string) => {
    try {
      setError("");
      setPrepared(
        session.prepare(
          "console.execute",
          { command: text.replace(/^\//, "") },
          authority,
        ),
      );
      const next = [text, ...history.filter((c) => c !== text)].slice(0, 200);
      setHistory(next);
      try {
        localStorage.setItem(
          `plexon:commands:${snap.state.serverId}`,
          JSON.stringify(next),
        );
      } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : "Command unavailable.");
    }
  };
  const exportLines = () => {
    const url = URL.createObjectURL(
      new Blob(
        [matches.map((e) => [e.raw, ...e.trace].join("\n")).join("\n")],
        { type: "text/plain" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `plexon-console-${Date.now()}.log`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const filters = [
    ["all", "All"],
    ["chat", "Chat"],
    ["joins", "Joins and leaves"],
    ["commands", "Commands"],
    ["warn", "Warnings"],
    ["error", "Errors"],
  ];
  const count = (f: string) =>
    entries.filter(
      (e) =>
        f === "all" ||
        (f === "chat" && e.kind === "chat") ||
        (f === "joins" && ["join", "leave"].includes(e.kind)) ||
        (f === "commands" && e.kind === "command") ||
        (f === "warn" && e.level === "WARN") ||
        (f === "error" && ["ERROR", "FATAL"].includes(e.level)),
    ).length;
  return (
    <section
      className={`card console ${mini ? "mini" : "full"} ${readOnly ? "history-console" : ""}`}
      ref={container}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
          e.preventDefault();
          searchRef.current?.focus();
        }
        if (e.key === "/" && e.target === container.current) {
          e.preventDefault();
          commandRef.current?.focus();
        }
      }}
    >
      <header className="con-head">
        <h2>
          {mini
            ? "Console"
            : (snap.state.ready?.server.serverName ?? "Server console")}
        </h2>
        <span className={`conn ${offline ? "off" : ""}`}>
          <i />
          {offline
            ? "Offline · history available"
            : paused
              ? "Paused"
              : "Connected"}
        </span>
        {mini ? (
          <a className="link" href="#Console">
            {copy.open_full_console_d51bb}
          </a>
        ) : (
          <div className="filters">
            {filters.map(([f, label]) => (
              <button
                className="fchip"
                key={f}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {label}
                <em>{count(f)}</em>
              </button>
            ))}
          </div>
        )}
        {!mini && (
          <div className="con-tools">
            <label className="con-search">
              <Icon name="search" />
              <input
                ref={searchRef}
                aria-label={copy.search_output_65e6e}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={copy.search_output_65e6e}
              />
            </label>
            <button
              className="tbtn"
              title={copy.pause_or_resume_view_e1385}
              aria-label={copy.pause_or_resume_view_e1385}
              aria-pressed={paused}
              onClick={() => {
                if (!paused) setFrozen(snap.state.console);
                setPaused((v) => !v);
              }}
            >
              <Icon name={paused ? "play" : "stop"} />
            </button>
            <details className="console-options">
              <summary title={copy.console_settings_8e3bb}>
                {copy.view_69bd4}
              </summary>
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={wrap}
                    onChange={(e) => setWrap(e.target.checked)}
                  />
                  {copy.wrap_lines_a7392}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={timestamps}
                    onChange={(e) => setTimestamps(e.target.checked)}
                  />
                  {copy.timestamps_c04ed}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={threads}
                    onChange={(e) => setThreads(e.target.checked)}
                  />
                  {copy.sources_2eb56}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={regex}
                    onChange={(e) => setRegex(e.target.checked)}
                  />
                  {copy.regular_expression_cdfc7}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={caseSensitive}
                    onChange={(e) => setCase(e.target.checked)}
                  />
                  {copy.case_sensitive_c73af}
                </label>
                <button onClick={() => setFont((v) => Math.max(11, v - 1))}>
                  {copy.smaller_text_a8ea9}
                </button>
                <button onClick={() => setFont((v) => Math.min(18, v + 1))}>
                  {copy.larger_text_118f9}
                </button>
                <button
                  onClick={() =>
                    void navigator.clipboard.writeText(
                      matches.map((e) => e.raw).join("\n"),
                    )
                  }
                >
                  {copy.copy_visible_aa25f}
                </button>
                <button onClick={exportLines}>{copy.download_log_af24c}</button>
                <button
                  onClick={() =>
                    setClearAt((v) => (v < 0 ? entries.length - 1 : -1))
                  }
                >
                  {clearAt < 0 ? "Clear view (local only)" : "Undo clear"}
                </button>
                <button
                  onClick={() => {
                    if (document.fullscreenElement)
                      void document.exitFullscreen();
                    else void container.current?.requestFullscreen();
                  }}
                >
                  {copy.fullscreen_bb08d}
                </button>
              </div>
            </details>
          </div>
        )}
      </header>
      {regexError && <div className="console-message">{regexError}</div>}
      {mini ? (
        <div className="log compact">
          {entries.slice(-24).map((e) => (
            <LogRow entry={e} compact key={e.id} />
          ))}
        </div>
      ) : (
        <LogViewport
          entries={matches}
          wrap={wrap}
          timestamps={timestamps}
          threads={threads}
          fontSize={fontSize}
        />
      )}{" "}
      {!mini && (
        <div className="terminal-status">
          <span>
            {matches.length}
            {copy._matching_55970}
            {entries.length}
            {copy._retained_c1491}
          </span>
          <span>
            {snap.state.ready?.consoleAuthority === "HOST"
              ? "Host journal"
              : "Paper output"}{" "}
            ·{" "}
            {offline
              ? "history retained"
              : paused
                ? "view paused"
                : "live ingestion"}
          </span>
        </div>
      )}
      {!readOnly && !mini && (
        <footer className="con-foot">
          {suggestions.length > 0 && (
            <div
              className="suggest on"
              role="listbox"
              aria-label={copy.command_suggestions_ce072}
            >
              {suggestions.map(([cmd, description], i) => (
                <button
                  role="option"
                  aria-selected={suggest === i}
                  key={cmd}
                  onClick={() => {
                    setCommand(cmd + " ");
                    commandRef.current?.focus();
                  }}
                >
                  {cmd}
                  <small>{description}</small>
                </button>
              ))}
            </div>
          )}
          <form
            className="prompt"
            onSubmit={(e) => {
              e.preventDefault();
              if (command.trim()) prepare(command.trim());
            }}
          >
            <b>{copy._gt_03c7b}</b>
            <input
              ref={commandRef}
              aria-label={copy.server_command_72fe4}
              value={command}
              disabled={offline || Boolean(commandReason)}
              onChange={(e) => {
                setCommand(e.target.value.replace(/[\r\n]/g, " "));
                setSuggest(0);
              }}
              placeholder={
                offline
                  ? "Server offline. Start it to send commands."
                  : "Type a command. Tab completes, ↑ ↓ browse history"
              }
              onKeyDown={(e) => {
                if (e.key === "Tab" && suggestions.length) {
                  e.preventDefault();
                  setCommand(
                    suggestions[suggest % suggestions.length][0] + " ",
                  );
                  setSuggest((v) => v + 1);
                }
                if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                  e.preventDefault();
                  const next = Math.max(
                    -1,
                    Math.min(
                      history.length - 1,
                      histIndex + (e.key === "ArrowUp" ? 1 : -1),
                    ),
                  );
                  setHistIndex(next);
                  setCommand(next < 0 ? "" : history[next]);
                }
                if ((e.ctrlKey || e.metaKey) && e.key === "r") {
                  e.preventDefault();
                  setCommand(
                    history.find((h) => h.includes(command)) ?? command,
                  );
                }
              }}
            />
            <button
              type="submit"
              disabled={!command.trim() || offline || Boolean(commandReason)}
              title={copy.review_command_7a98f}
              aria-label={copy.review_command_7a98f}
            >
              <Icon name="send" />
            </button>
          </form>
          {commandReason && !offline && (
            <p className="console-message">{commandReason}</p>
          )}
          <div className="macros">
            {[
              "list",
              "tps",
              "save-all",
              "weather clear",
              "whitelist reload",
            ].map((cmd) => (
              <button
                key={cmd}
                disabled={offline || Boolean(commandReason)}
                onClick={() => {
                  setCommand(cmd);
                  prepare(cmd);
                }}
              >
                /{cmd}
              </button>
            ))}
          </div>
          {error && (
            <p className="console-message" role="alert">
              {error}
            </p>
          )}
        </footer>
      )}
      <ActionReview prepared={prepared} onClose={() => setPrepared(null)} />
    </section>
  );
}

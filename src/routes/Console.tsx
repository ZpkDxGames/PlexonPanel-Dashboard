import { memo, useEffect, useMemo, useRef, useState } from "react";
import { str, type JsonMap } from "../adapter/control-state";
import { session, type Prepared } from "../adapter/session";
import { FormattedText } from "../components/FormattedText";
import { PlayerHead } from "../components/PlayerHead";
import { Button, Notice, Panel, Status, Empty } from "../components/ui";
import { ActionReview } from "../features/ActionReview";
import { useSession } from "../hooks";
import { toast } from "../components/toast";
import { Icon } from "../components/Icon";
import { hasScope } from "../presentation/authority";
import { usePreferences } from "../store/preferences";
const lineHeight = 28;
type Tab = "console" | "chat" | "plugins";
const consoleClocks = [false, true].map(
  (utc) =>
    new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
      hour12: false,
      timeZone: utc ? "UTC" : undefined,
    }),
);
function stamp(value: unknown, utc = false) {
  const at = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(at)
    ? consoleClocks[Number(utc)].format(at)
    : "--:--:--.---";
}
const ConsoleLines = memo(function ConsoleLines({
  lines,
  wrap,
  tail,
  utc,
}: {
  lines: JsonMap[];
  wrap: boolean;
  tail: boolean;
  utc: boolean;
}) {
  const [scrollTop, setScrollTop] = useState(0),
    ref = useRef<HTMLDivElement>(null),
    follow = useRef(true),
    height = 480;
  useEffect(() => {
    if (tail && follow.current && ref.current)
      ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines, tail, wrap]);
  const start = wrap
      ? Math.max(0, lines.length - 400)
      : Math.max(0, Math.floor(scrollTop / lineHeight) - 8),
    count = wrap ? 400 : Math.ceil(height / lineHeight) + 16,
    visible = lines.slice(start, start + count);
  return (
    <div
      ref={ref}
      className={`terminal-scroll ${wrap ? "wrap" : "nowrap"}`}
      style={{ height }}
      role="region"
      tabIndex={0}
      aria-label="Console output"
      onScroll={(e) => {
        setScrollTop(e.currentTarget.scrollTop);
        follow.current =
          e.currentTarget.scrollHeight -
            e.currentTarget.scrollTop -
            e.currentTarget.clientHeight <
          60;
      }}
    >
      <div
        className="terminal-spacer"
        style={wrap ? undefined : { height: lines.length * lineHeight }}
      >
        <div
          style={
            wrap
              ? undefined
              : { transform: `translateY(${start * lineHeight}px)` }
          }
        >
          {visible.map((line, index) => (
            <div
              className="terminal-line"
              key={str(line.id, `${start + index}`)}
              title={`Timestamp: ${line.capturedAt ? "server capture" : "browser receipt"}`}
            >
              <time>{stamp(line.capturedAt ?? line.receivedAt, utc)}</time>
              <span
                className={`level level-${str(line.level, "INFO").toLowerCase()}`}
              >
                {str(line.level, "INFO")}
              </span>
              <span className="line-source">{str(line.source, "Unknown")}</span>
              <span className="line-message">
                <FormattedText value={str(line.content ?? line.rawText, "")} />
              </span>
            </div>
          ))}
        </div>
      </div>
      {!lines.length && (
        <Empty title="The console is quiet">
          No matching lines have been received for this device.
        </Empty>
      )}
    </div>
  );
});
export default function Console() {
  const snap = useSession(),
    prefs = usePreferences(),
    [tab, setTab] = useState<Tab>("console"),
    [query, setQuery] = useState(""),
    [level, setLevel] = useState("all"),
    [source, setSource] = useState("all"),
    [paused, setPaused] = useState(false),
    [frozen, setFrozen] = useState<JsonMap[]>([]),
    [cleared, setCleared] = useState(false),
    [wrap, setWrap] = useState(false),
    [command, setCommand] = useState(""),
    [chat, setChat] = useState(""),
    [mini, setMini] = useState(false),
    [prepared, setPrepared] = useState<Prepared | null>(null),
    [error, setError] = useState("");
  const canConsole =
      hasScope(snap, "console.view.full") ||
      hasScope(snap, "console.view.errors"),
    canChat = hasScope(snap, "chat.view"),
    canPlugins = hasScope(snap, "plugins.view");
  const retained = canConsole ? snap.state.console : [],
    current = canConsole ? (paused ? frozen : retained) : [];
  const lines = useMemo(
    () =>
      cleared
        ? []
        : current.filter(
            (line) =>
              (level === "all" || str(line.level).toLowerCase() === level) &&
              (source === "all" || str(line.source) === source) &&
              str(line.content ?? line.rawText, "")
                .toLowerCase()
                .includes(query.toLowerCase()),
          ),
    [current, query, level, source, cleared],
  );
  const authority = snap.state.ready?.consoleAuthority ?? "UNAVAILABLE",
    miniAllowed =
      hasScope(snap, "chat.send.minimessage") &&
      snap.state.ready?.server.paperCapabilities["chat.send.minimessage"] ===
        true;
  const prepare = (action: string, parameters: JsonMap) => {
    setError("");
    try {
      setPrepared(session.prepare(action, parameters, "PAPER"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action unavailable.");
    }
  };
  const exportLines = () => {
    const value = lines
        .map(
          (line) =>
            `${str(line.capturedAt ?? line.receivedAt)} ${str(line.level)} ${str(line.source)} ${str(line.content ?? line.rawText, "")}`,
        )
        .join("\n"),
      url = URL.createObjectURL(new Blob([value], { type: "text/plain" })),
      link = document.createElement("a");
    link.href = url;
    link.download = `plexon-console-${Date.now()}.log`;
    link.click();
    URL.revokeObjectURL(url);
    toast.push("Console exported", `${lines.length} visible lines`, "success");
  };
  const tabs: Tab[] = ["console", "chat", "plugins"];
  return (
    <>
      <div className="communication-workbench">
        <aside className="channel-switcher">
          <span className="eyebrow">SERVER CHANNELS</span>
          <div
            className="workspace-tabs"
            role="tablist"
            aria-label="Console workspace"
          >
            {tabs.map((item) => (
              <button
                key={item}
                id={`tab-${item}`}
                role="tab"
                aria-controls={`panel-${item}`}
                aria-selected={tab === item}
                tabIndex={tab === item ? 0 : -1}
                className={tab === item ? "active" : ""}
                onClick={() => setTab(item)}
                onKeyDown={(event) => {
                  if (
                    ["ArrowRight", "ArrowLeft", "Home", "End"].includes(
                      event.key,
                    )
                  ) {
                    event.preventDefault();
                    const index =
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? 2
                          : (tabs.indexOf(item) +
                              (event.key === "ArrowRight" ? 1 : 2)) %
                            3;
                    setTab(tabs[index]);
                    document.getElementById(`tab-${tabs[index]}`)?.focus();
                  }
                }}
              >
                {item === "console"
                  ? "Console"
                  : item === "chat"
                    ? "Live chat"
                    : "Plugin inventory"}
              </button>
            ))}
          </div>
          <div className="channel-footnote">
            <Icon name="access" />
            <strong>Source authority</strong>
            <span>
              {authority === "HOST"
                ? "Host journal"
                : authority === "PAPER_FALLBACK"
                  ? "Paper fallback"
                  : "Unavailable"}
            </span>
            <p>Commands and messages are reviewed through Paper.</p>
          </div>
        </aside>
        <div
          className="communication-stage"
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
        >
          {tab === "console" && (
            <Panel
              eyebrow="TERMINAL / LIVE STREAM"
              title="Server output"
              description={
                authority === "HOST"
                  ? "Host journal authority · retained stream"
                  : authority === "PAPER_FALLBACK"
                    ? "Paper fallback · new live lines only"
                    : "Console authority unavailable"
              }
              className="console-panel"
              action={
                <Status
                  tone={
                    paused
                      ? "warning"
                      : authority === "UNAVAILABLE"
                        ? "neutral"
                        : "success"
                  }
                >
                  {paused ? "Paused" : authority}
                </Status>
              }
            >
              <div className="console-toolbar">
                <input
                  aria-label="Search console"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find in output…"
                />
                <select
                  aria-label="Level filter"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                >
                  <option value="all">All levels</option>
                  <option value="info">Info</option>
                  <option value="warn">Warnings</option>
                  <option value="error">Errors</option>
                </select>
                <select
                  aria-label="Source filter"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                >
                  <option value="all">All sources</option>
                  {[
                    ...new Set(
                      retained.map((line) => str(line.source, "Unknown")),
                    ),
                  ].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <Button
                  onClick={() => {
                    if (!paused) setFrozen(retained);
                    setPaused((value) => !value);
                  }}
                >
                  <Icon name={paused ? "play" : "pause"} />
                  {paused ? "Resume" : "Pause"}
                </Button>
                <Button
                  aria-pressed={wrap}
                  onClick={() => setWrap((value) => !value)}
                >
                  {wrap ? "No wrap" : "Wrap"}
                </Button>
                <Button disabled={!lines.length} onClick={exportLines}>
                  <Icon name="download" />
                  Export
                </Button>
                <Button
                  variant="quiet"
                  onClick={() => setCleared((value) => !value)}
                >
                  {cleared ? "Undo clear" : "Clear view"}
                </Button>
              </div>
              <ConsoleLines
                lines={lines}
                wrap={wrap}
                tail={!paused}
                utc={prefs.timezone === "UTC"}
              />
              <div className="terminal-status">
                <span>
                  {lines.length} matching / {retained.length} retained
                  {wrap ? " · latest 400 rendered" : ""}
                </span>
                <span>
                  {paused
                    ? "Display paused · ingestion continues"
                    : "Live tail · scroll up to inspect"}
                </span>
                <span>{prefs.timezone === "UTC" ? "UTC" : "Local time"}</span>
              </div>
              <form
                className="command-composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (command.trim())
                    prepare("console.execute", { command: command.trim() });
                }}
              >
                <span aria-hidden="true">›</span>
                <textarea
                  aria-label="Server command"
                  rows={1}
                  maxLength={512}
                  value={command}
                  onChange={(e) =>
                    setCommand(e.target.value.replace(/[\r\n]+/g, " "))
                  }
                  placeholder="Type an allowed Paper command…"
                />
                <Button
                  variant="primary"
                  type="submit"
                  disabled={
                    !command.trim() ||
                    !!session.reason("console.execute", "PAPER")
                  }
                  title={session.reason("console.execute", "PAPER")}
                >
                  Review <Icon name="arrow" />
                </Button>
              </form>
              <div className="console-error">
                <p className="subtle">
                  {session.reason("console.execute", "PAPER") ||
                    "Commands execute through Paper after your review. The Host owns journal output."}
                </p>
              </div>
              {!canConsole && (
                <div className="console-error">
                  <Notice title="Console access restricted">
                    This device does not have a console viewing scope.
                  </Notice>
                </div>
              )}
            </Panel>
          )}
          {tab === "chat" && (
            <div className="chat-layout">
              <Panel
                eyebrow="PAPER / CONVERSATION"
                title="Global chat"
                action={
                  <Status>
                    {canChat ? snap.state.chat.length : 0} received
                  </Status>
                }
              >
                <div className="chat-stream">
                  {canChat && snap.state.chat.length ? (
                    snap.state.chat.map((item, index) => (
                      <div
                        className="chat-line"
                        key={`${str(item.capturedAt)}:${index}`}
                      >
                        <PlayerHead
                          uuid={str(
                            item.playerUuid,
                            "00000000-0000-4000-8000-000000000000",
                          )}
                          name={str(item.playerName, "Unknown")}
                        />
                        <div>
                          <strong>{str(item.playerName, "Unknown")}</strong>
                          <time>
                            {stamp(item.capturedAt, prefs.timezone === "UTC")}
                          </time>
                          <p>
                            <FormattedText value={str(item.message, "")} />
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <Empty
                      title={
                        canChat ? "No chat received" : "Chat access restricted"
                      }
                    >
                      {canChat
                        ? "New messages will appear here."
                        : "This device needs chat.view."}
                    </Empty>
                  )}
                </div>
              </Panel>
              <Panel eyebrow="MESSAGE / COMPOSE" title="Join the conversation">
                <div className="chat-compose">
                  <label className="field">
                    Message
                    <textarea
                      rows={5}
                      value={chat}
                      maxLength={512}
                      onChange={(e) => setChat(e.target.value)}
                    />
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={mini && miniAllowed}
                      disabled={!miniAllowed}
                      onChange={(e) => setMini(e.target.checked)}
                    />
                    MiniMessage formatting
                  </label>
                  <div className="composer-preview">
                    <span>Message preview</span>
                    <p>
                      <FormattedText
                        value={chat || "Your message will appear here"}
                        composer
                      />
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    disabled={
                      !chat.trim() ||
                      !!session.reason("chat.global.send", "PAPER")
                    }
                    title={session.reason("chat.global.send", "PAPER")}
                    onClick={() =>
                      prepare("chat.global.send", {
                        message: chat,
                        miniMessage: mini && miniAllowed,
                      })
                    }
                  >
                    Review send <Icon name="arrow" />
                  </Button>
                </div>
              </Panel>
            </div>
          )}
          {tab === "plugins" && (
            <Panel
              eyebrow="PAPER / INVENTORY"
              title="Installed plugins"
              description="Reported versions and runtime state. Reload requires server policy and a review."
            >
              <div className="plugin-list">
                {canPlugins && snap.state.plugins.length ? (
                  snap.state.plugins.map((plugin) => (
                    <article className="plugin-row" key={str(plugin.name)}>
                      <div>
                        <strong>{str(plugin.name)}</strong>
                        <span>{str(plugin.version, "Version unknown")}</span>
                      </div>
                      <Status
                        tone={plugin.enabled === true ? "success" : "neutral"}
                      >
                        {plugin.enabled === true
                          ? "Enabled"
                          : plugin.enabled === false
                            ? "Disabled"
                            : "Unknown"}
                      </Status>
                      <Button
                        disabled={
                          !!session.reason("plugin.command.reload", "PAPER")
                        }
                        title={session.reason("plugin.command.reload", "PAPER")}
                        onClick={() =>
                          prepare("plugin.command.reload", {
                            plugin: str(plugin.name),
                          })
                        }
                      >
                        Review reload
                      </Button>
                    </article>
                  ))
                ) : (
                  <Empty
                    title={
                      canPlugins
                        ? "Waiting for plugin inventory"
                        : "Plugin access restricted"
                    }
                  >
                    {canPlugins
                      ? "Paper has not provided an inventory."
                      : "This device needs plugins.view."}
                  </Empty>
                )}
              </div>
            </Panel>
          )}
        </div>
      </div>
      {error && (
        <div className="page-notice">
          <Notice tone="error" title="Cannot prepare operation">
            {error}
          </Notice>
        </div>
      )}
      <ActionReview prepared={prepared} onClose={() => setPrepared(null)} />
    </>
  );
}

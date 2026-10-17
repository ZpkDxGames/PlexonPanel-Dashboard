import { useHostHistory } from "../components/terminal/useHostHistory";
import { VirtualConsole } from "../components/terminal/VirtualConsole";
import { BootSessionBadge } from "../components/PresenceTimeline";
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
const ConsoleLines = VirtualConsole;
export default function Console() {
  const snap = useSession(),
    prefs = usePreferences(),
    [tab, setTab] = useState<Tab>("console"),
    [filtersOpen, setFiltersOpen] = useState(
      () =>
        typeof matchMedia === "function" &&
        matchMedia("(min-width:640px)").matches,
    ),
    [query, setQuery] = useState(""),
    [pluginQuery, setPluginQuery] = useState(""),
    [level, setLevel] = useState("all"),
    [source, setSource] = useState("all"),
    [paused, setPaused] = useState(false),
    [following, setFollowing] = useState(true),
    [returnVersion, setReturnVersion] = useState(0),
    [frozen, setFrozen] = useState<JsonMap[]>([]),
    [cleared, setCleared] = useState(false),
    [wrap, setWrap] = useState(false),
    [command, setCommand] = useState(""),
    [chat, setChat] = useState(""),
    [mini, setMini] = useState(false),
    [prepared, setPrepared] = useState<Prepared | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const media = matchMedia("(min-width:640px)");
    const resize = () => setFiltersOpen(media.matches);
    media.addEventListener("change", resize);
    return () => media.removeEventListener("change", resize);
  }, []);
  const canConsole =
      hasScope(snap, "console.view.full") ||
      hasScope(snap, "console.view.errors"),
    canChat = hasScope(snap, "chat.view"),
    canPlugins = hasScope(snap, "plugins.view");
  const frozenEpoch = useRef<string | undefined>(undefined);
  useEffect(() => {
    setPaused(false);
    setFrozen([]);
    setCleared(false);
  }, [snap.state.bootEpochId, snap.revision]);
  const hostHistory = useHostHistory(query, level);
  const retained = canConsole ? hostHistory.lines : [],
    current = canConsole
      ? paused && frozenEpoch.current === snap.state.bootEpochId
        ? hasScope(snap, "console.view.full")
          ? frozen
          : frozen.filter((row) =>
              ["WARN", "ERROR"].includes(String(row.level)),
            )
        : retained
      : [];
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
              <BootSessionBadge />
              <div className="console-toolbar">
                <input
                  aria-label="Search console"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find in output…"
                />
                <Button
                  onClick={() => {
                    if (!paused) {
                      frozenEpoch.current = snap.state.bootEpochId;
                      setFrozen(retained);
                    }
                    setPaused((value) => !value);
                  }}
                >
                  <Icon name={paused ? "play" : "pause"} />
                  {paused ? "Resume" : "Pause"}
                </Button>
                <details
                  className="console-filters"
                  open={filtersOpen}
                  onToggle={(event) => setFiltersOpen(event.currentTarget.open)}
                >
                  <summary>Filters & view</summary>
                  <div className="console-filter-controls">
                    <div
                      className="segmented"
                      role="group"
                      aria-label="Console severity"
                    >
                      {["all", "debug", "info", "warn", "error"].map(
                        (value) => (
                          <button
                            key={value}
                            aria-pressed={level === value}
                            onClick={() => setLevel(value)}
                          >
                            {value.toUpperCase()}
                          </button>
                        ),
                      )}
                    </div>
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
                </details>
              </div>
              <div className="console-toolbar">
                <Button
                  disabled={!hostHistory.more || hostHistory.busy}
                  onClick={() => void hostHistory.older()}
                >
                  Load older from Host
                </Button>
                <Button
                  disabled={hostHistory.busy}
                  onClick={() => void hostHistory.refresh()}
                >
                  Refresh history
                </Button>
                <span className="subtle">VPS SQLite · volatile tab memory</span>
              </div>
              {hostHistory.error ? (
                <p role="status">{hostHistory.error}</p>
              ) : null}
              <ConsoleLines
                lines={lines}
                wrap={wrap}
                tail={!paused}
                utc={prefs.timezone === "UTC"}
                returnVersion={returnVersion}
                onFollowChange={setFollowing}
              />
              <div className="terminal-status">
                {(!following || paused) && (
                  <Button
                    onClick={() => {
                      setPaused(false);
                      setReturnVersion((v) => v + 1);
                    }}
                  >
                    Return to live
                  </Button>
                )}
                <span>
                  {lines.length} matching / {retained.length} retained
                  {wrap ? " · measured wrapped rows" : ""}
                </span>
                <span>
                  {paused
                    ? "Display paused · ingestion continues"
                    : following
                      ? "Live tail · scroll up to inspect"
                      : "Inspecting retained output"}
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
                  {!miniAllowed && (
                    <p className="action-availability">
                      MiniMessage requires both chat.send.minimessage and the
                      current Paper capability.
                    </p>
                  )}
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
              <div className="plugin-toolbar">
                <label className="search-field">
                  <Icon name="search" />
                  <input
                    aria-label="Search plugins"
                    placeholder="Find an installed plugin…"
                    value={pluginQuery}
                    onChange={(e) => setPluginQuery(e.target.value)}
                  />
                </label>
              </div>
              <div className="plugin-list">
                {canPlugins &&
                snap.state.plugins.filter((plugin) =>
                  `${str(plugin.name)} ${str(plugin.version)}`
                    .toLowerCase()
                    .includes(pluginQuery.toLowerCase()),
                ).length ? (
                  snap.state.plugins
                    .filter((plugin) =>
                      `${str(plugin.name)} ${str(plugin.version)}`
                        .toLowerCase()
                        .includes(pluginQuery.toLowerCase()),
                    )
                    .map((plugin) => (
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
                          title={session.reason(
                            "plugin.command.reload",
                            "PAPER",
                          )}
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
                        ? pluginQuery
                          ? "No matching plugins"
                          : "Waiting for plugin inventory"
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

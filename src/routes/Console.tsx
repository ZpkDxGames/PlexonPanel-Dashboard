import { copy } from "../i18n/en";
import { ConsoleView } from "../components/ConsoleView";
import { useMemo, useRef, useState } from "react";
import { str, type JsonMap } from "../adapter/control-state";
import { session, type Prepared } from "../adapter/session";
import { FormattedText } from "../components/FormattedText";
import { PlayerHead } from "../components/PlayerHead";
import { Button, Notice, Panel, Status } from "../components/ui";
import { ActionReview } from "../features/ActionReview";
import { useSession } from "../hooks";
import { formatTime } from "../lib/time";
type Tab = "console" | "chat" | "plugins";
const lineHeight = 28;
function stamp(value: unknown) {
  const formatted = formatTime(value, { seconds: true, millis: true });
  return formatted === "—" ? "--:--:--.---" : formatted;
}
function ConsoleLines({ lines, wrap }: { lines: JsonMap[]; wrap: boolean }) {
  const [scrollTop, setScrollTop] = useState(0);
  const height = 520;
  const start = wrap
    ? Math.max(0, lines.length - 400)
    : Math.max(0, Math.floor(scrollTop / lineHeight) - 8);
  const count = wrap ? 400 : Math.ceil(height / lineHeight) + 16;
  const visible = lines.slice(start, start + count);
  return (
    <div
      className={`terminal-scroll ${wrap ? "wrap" : "nowrap"}`}
      style={{ height }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      tabIndex={0}
      aria-label={copy.console_output_2dd9f}
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
              title={`Timestamp source: ${line.capturedAt ? "server capture" : "browser receipt"}`}
            >
              <time>{stamp(line.capturedAt ?? line.receivedAt)}</time>
              <span
                className={`level level-${str(line.level, "info").toLowerCase()}`}
              >
                {str(line.level, "INFO")}
              </span>
              <span className="line-source" title={str(line.source, "unknown")}>
                {str(line.source, "unknown")}
              </span>
              <span className="line-message">
                <FormattedText value={str(line.content ?? line.rawText, "")} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
export default function Console() {
  const snap = useSession();
  const [tab, setTab] = useState<Tab>("console");
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [paused, setPaused] = useState(false);
  const [frozen, setFrozen] = useState<JsonMap[]>([]);
  const [cleared, setCleared] = useState(false);
  const [wrap, setWrap] = useState(false);
  const [command, setCommand] = useState("");
  const [chat, setChat] = useState("");
  const [mini, setMini] = useState(false);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [error, setError] = useState("");
  const current = paused ? frozen : snap.state.console;
  const lines = useMemo(
    () =>
      cleared
        ? []
        : current.filter(
            (line) =>
              (level === "all" || str(line.level).toLowerCase() === level) &&
              str(line.content ?? line.rawText, "")
                .toLowerCase()
                .includes(query.toLowerCase()),
          ),
    [current, query, level, cleared],
  );
  const consoleKind =
    snap.state.ready?.consoleAuthority === "HOST" ? "HOST" : "PAPER";
  const prepare = (
    action: string,
    parameters: JsonMap,
    kind: "HOST" | "PAPER" = consoleKind,
  ) => {
    setError("");
    try {
      setPrepared(session.prepare(action, parameters, kind));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action unavailable.");
    }
  };
  const togglePause = () => {
    if (!paused) setFrozen(snap.state.console);
    setPaused((value) => !value);
  };
  const exportLines = () => {
    const value = lines
      .map(
        (line) =>
          `${str(line.capturedAt)} ${str(line.level)} ${str(line.source)} ${str(line.content)}`,
      )
      .join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([value], { type: "text/plain" }));
    link.download = `plexon-console-${Date.now()}.log`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return (
    <>
      <div
        className="workspace-tabs"
        role="group"
        aria-label={copy.console_views_66455}
      >
        <button
          className={tab === "console" ? "active" : ""}
          onClick={() => setTab("console")}
        >
          {copy.console_9f334}
        </button>
        <button
          className={tab === "chat" ? "active" : ""}
          onClick={() => setTab("chat")}
        >
          {copy.chat_2ced5}
        </button>
        <button
          className={tab === "plugins" ? "active" : ""}
          onClick={() => setTab("plugins")}
        >
          {copy.plugins_ab2e2}
        </button>
      </div>
      {tab === "console" && <ConsoleView />}
      {tab === "chat" && (
        <div className="chat-layout">
          <Panel
            eyebrow={copy.paper_stream_6c978}
            title={copy.global_chat_2e160}
            action={
              <Status
                tone={snap.state.ready?.agents.paper ? "success" : "neutral"}
              >
                {snap.state.chat.length}
                {copy._retained_c1491}
              </Status>
            }
          >
            <div className="chat-stream">
              {snap.state.chat.length ? (
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
                      <time>{stamp(item.capturedAt)}</time>
                      <p>
                        <FormattedText value={str(item.message, "")} />
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="inline-empty">
                  <strong>{copy.no_chat_received_f6a01}</strong>
                  <span>
                    {copy.messages_appear_only_when_the_device_h_fa7bc}
                  </span>
                </div>
              )}
            </div>
          </Panel>
          <Panel
            eyebrow={copy.reviewed_send_632b9}
            title={copy.compose_message_e6172}
          >
            <div className="chat-compose">
              <label className="field">
                {copy.message_68f41}
                <textarea
                  rows={5}
                  value={chat}
                  onChange={(e) => setChat(e.target.value.slice(0, 512))}
                />
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={mini}
                  onChange={(e) => setMini(e.target.checked)}
                  disabled={Boolean(
                    session.reason("chat.global.send", "PAPER"),
                  )}
                />
                {copy._minimessage_requires_advertised_grant_d8cf4}
              </label>
              <div className="composer-preview">
                <span>{copy.preview_f1fbb}</span>
                <p>
                  <FormattedText
                    value={chat || "Your message preview"}
                    composer
                  />
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() =>
                  prepare(
                    "chat.global.send",
                    { message: chat, miniMessage: mini },
                    "PAPER",
                  )
                }
                disabled={
                  !chat.trim() ||
                  Boolean(session.reason("chat.global.send", "PAPER"))
                }
              >
                {copy.review_send_4c699}
              </Button>
            </div>
          </Panel>
        </div>
      )}
      {tab === "plugins" && (
        <Panel
          eyebrow={copy.paper_inventory_884b9}
          title={copy.plugins_ab2e2}
          action={
            <span className="subtle">{copy.observed_inventory_only_2f81b}</span>
          }
        >
          <div className="plugin-list">
            {snap.state.plugins.length ? (
              snap.state.plugins.map((plugin) => (
                <div className="plugin-row" key={str(plugin.name)}>
                  <div>
                    <strong>{str(plugin.name)}</strong>
                    <span>{str(plugin.version, "Version unknown")}</span>
                  </div>
                  <Status
                    tone={plugin.enabled === true ? "success" : "neutral"}
                  >
                    {plugin.enabled === true ? "enabled" : "disabled"}
                  </Status>
                  <Button
                    disabled={Boolean(
                      session.reason("plugin.command.reload", "PAPER"),
                    )}
                    title={session.reason("plugin.command.reload", "PAPER")}
                    onClick={() =>
                      prepare(
                        "plugin.command.reload",
                        { plugin: str(plugin.name) },
                        "PAPER",
                      )
                    }
                  >
                    {copy.review_reload_706b1}
                  </Button>
                </div>
              ))
            ) : (
              <div className="inline-empty">
                <strong>{copy.no_plugin_inventory_f095f}</strong>
                <span>{copy.waiting_for_a_paper_inventory_snapshot_42397}</span>
              </div>
            )}
          </div>
        </Panel>
      )}
      <ActionReview prepared={prepared} onClose={() => setPrepared(null)} />
    </>
  );
}

import { usePreferences } from "../../../store/preferences";
import { useMemo, useState } from "react";
import { records } from "../../../adapter/control-state";
import { Heading, Panel, QueryNotice } from "../shared";
import { useQuery, useControl } from "../../hooks/useControl";
import { historyWindow, retainHistoryPage } from "../../console/history-window";
import { LiveConsole } from "../../console/LiveConsole";
import { CommandComposer } from "../../console/CommandComposer";
import { parseLine, chipTone } from "../../console/parse-line";
import { PluginChip } from "../../console/PluginChip";
import { Pill } from "../../primitives/Pill";
import { EmptyState } from "../../primitives/EmptyState";
import { Puzzle, MessageSquare } from "lucide-react";
export default function Console() {
  const prefs = usePreferences(),
    clock = useMemo(
      () =>
        new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          ...(prefs.timezone === "UTC" ? { timeZone: "UTC" } : {}),
        }),
      [prefs.timezone],
    );
  const { state: s } = useControl(),
    [tab, setTab] = useState("Console"),
    [filter, setFilter] = useState("");
  const [chatCursor, setChatCursor] = useState<string | undefined>(),
    [olderChat, setOlderChat] = useState<ReturnType<typeof records>>([]),
    chatHistory = useQuery(
      "console.history",
      "HOST",
      { stream: "chat", ...(chatCursor ? { cursor: chatCursor } : {}) },
      !!s.ready?.device.scopes.includes("chat.view"),
    );
  const messages = historyWindow(
    olderChat,
    records(chatHistory.data.chatMessages, 25),
    s.chat,
    !!chatCursor,
    500,
    (m) =>
      String(m.id ?? m.capturedAt) + String(m.playerName) + String(m.message),
    (m) => Date.parse(String(m.capturedAt ?? m.timestamp)) || 0,
  );
  const plugins = useMemo(() => {
    const m = new Map<
      string,
      { tag: string; info: number; warn: number; error: number }
    >();
    for (const l of s.console) {
      const p = parseLine(
          String(l.id),
          `[12:00:00 ${l.level ?? "INFO"}]: ${l.content ?? ""}`,
        ),
        tag = p.tag ?? "Server",
        c = m.get(tag) ?? { tag, info: 0, warn: 0, error: 0 };
      if (p.level === "WARN") c.warn++;
      else if (["ERROR", "FATAL"].includes(p.level ?? "")) c.error++;
      else c.info++;
      m.set(tag, c);
    }
    return [...m.values()].sort((a, b) => b.error + b.warn - a.error - a.warn);
  }, [s.console]);
  const chat = (
    <>
      <QueryNotice query={chatHistory} />
      {typeof chatHistory.data.nextCursor === "string" && (
        <button
          className="btn mb-3"
          onClick={() => {
            setOlderChat(
              retainHistoryPage(
                olderChat,
                records(chatHistory.data.chatMessages, 25),
                500,
              ),
            );
            setChatCursor(String(chatHistory.data.nextCursor));
          }}
        >
          Earlier chat from this boot
        </button>
      )}
      {chatCursor && (
        <button
          className="btn mb-3"
          onClick={() => {
            setChatCursor(undefined);
            setOlderChat([]);
          }}
        >
          Return to live chat
        </button>
      )}
      <div className="pp-well p-3">
        {messages.map((m, i) => (
          <div key={i}>
            <div className="flex justify-between gap-3 text-xs text-muted">
              <strong className="tone-link">
                {String(m.playerName ?? "System")}
              </strong>
              <time
                dateTime={
                  typeof m.capturedAt === "string" ? m.capturedAt : undefined
                }
              >
                {typeof m.capturedAt === "string" &&
                Number.isFinite(Date.parse(m.capturedAt))
                  ? clock.format(new Date(m.capturedAt))
                  : "Unreported"}
              </time>
            </div>
            <p className="chat-bubble">
              {String(m.message ?? m.content ?? "")}
            </p>
          </div>
        ))}
        {!messages.length && (
          <EmptyState
            title="Waiting for chat"
            detail="Messages stream live under your chat.view scope."
          />
        )}
      </div>
      <CommandComposer chat />
    </>
  );
  return (
    <>
      <Heading
        id="R05 · Console & chat"
        title="Listen to your server."
        detail="A live terminal, plugin signals and player conversations. Nothing cached in this browser."
      />
      <div className="overview-main">
        <div>
          <div className="segments mb-4">
            {["Console", "Chat"].map((t) => (
              <button
                key={t}
                aria-pressed={tab === t}
                className={t === tab ? "pp-glow-active" : ""}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "Console" ? (
            <LiveConsole full plugin={filter} />
          ) : (
            <Panel title="Live chat" tone="sky" icon={MessageSquare}>
              {chat}
            </Panel>
          )}
        </div>
        <div className="space-y-4">
          <Panel title="Plugin signals" tone="violet" icon={Puzzle}>
            <div className="plugin-grid">
              {plugins.map((p) => (
                <button
                  key={p.tag}
                  data-tone={chipTone(p.tag)}
                  className="pp-well plugin-card"
                  aria-pressed={filter === p.tag}
                  onClick={() => setFilter(filter === p.tag ? "" : p.tag)}
                >
                  <PluginChip tag={p.tag} />
                  <div className="flex flex-wrap gap-1 mt-3">
                    <Pill tone="cyan">{p.info} info</Pill>
                    <Pill tone="amber">{p.warn} warn</Pill>
                    <Pill tone="rose">{p.error} error</Pill>
                  </div>
                  <div className="pp-well">
                    <i
                      style={{
                        width: `${Math.min(100, ((p.info + p.warn + p.error) / Math.max(1, s.console.length)) * 100)}%`,
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>
            {!plugins.length && (
              <EmptyState
                title="No plugin tags yet"
                detail="The current boot's parsed log stream supplies these cards."
              />
            )}
          </Panel>
          <Panel title="Live chat" tone="sky" icon={MessageSquare}>
            {chat}
          </Panel>
        </div>
      </div>
    </>
  );
}

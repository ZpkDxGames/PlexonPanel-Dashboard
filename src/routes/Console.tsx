import { copy } from "../i18n/en";
import { ConsoleView } from "../components/ConsoleView";
import { useState } from "react";
import { str, type JsonMap } from "../adapter/control-state";
import { session, type Prepared } from "../adapter/session";
import { FormattedText } from "../components/FormattedText";
import { PlayerHead } from "../components/PlayerHead";
import { Button, Notice, Panel, Status } from "../components/ui";
import { ActionReview } from "../features/ActionReview";
import { useSession } from "../hooks";
import { formatTime } from "../lib/time";
type Tab = "console" | "chat";
function stamp(value: unknown) {
  const formatted = formatTime(value, { seconds: true, millis: true });
  return formatted === "—" ? "--:--:--.---" : formatted;
}
export default function Console() {
  const snap = useSession();
  const [tab, setTab] = useState<Tab>("console");
  const [chat, setChat] = useState("");
  const [mini, setMini] = useState(false);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [error, setError] = useState("");
  const prepare = (
    action: string,
    parameters: JsonMap,
    kind: "HOST" | "PAPER" = "PAPER",
  ) => {
    setError("");
    try {
      setPrepared(session.prepare(action, parameters, kind));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action unavailable.");
    }
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
      <ActionReview prepared={prepared} onClose={() => setPrepared(null)} />
    </>
  );
}

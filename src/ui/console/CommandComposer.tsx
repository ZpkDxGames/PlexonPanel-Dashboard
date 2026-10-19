import { useRef, useState } from "react";
import { CornerDownLeft } from "lucide-react";
import { session, useControl } from "../bindings";
import { useReview } from "../primitives/ReviewProvider";
import { Tooltip } from "../primitives/Tooltip";
export function CommandComposer({ chat = false }: { chat?: boolean }) {
  useControl();
  const review = useReview(),
    [text, setText] = useState(""),
    [format, setFormat] = useState("PLAIN"),
    hist = useRef<string[]>([]),
    index = useRef(-1),
    action = chat ? "chat.global.send" : "console.execute",
    gate = session.reason(action, "PAPER");
  const input = (
    <input
      aria-label={chat ? "Chat message" : "Console command"}
      aria-disabled={!!gate || undefined}
      readOnly={!!gate}
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder={
        gate
          ? chat
            ? "Chat unavailable"
            : "Console commands unavailable"
          : chat
            ? "Message all players…"
            : "Run a command…  ↑ history · ↵ review & send"
      }
      onKeyDown={(e) => {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          index.current = Math.min(index.current + 1, hist.current.length - 1);
          setText(hist.current[index.current] ?? "");
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          index.current = Math.max(-1, index.current - 1);
          setText(hist.current[index.current] ?? "");
        }
      }}
    />
  );
  return (
    <form
      className="pp-composer"
      onSubmit={(e) => {
        e.preventDefault();
        if (gate || !text.trim()) return;
        hist.current.unshift(text);
        hist.current = hist.current.slice(0, 100);
        index.current = -1;
        void review(
          action,
          chat ? { message: text, format } : { command: text },
          "PAPER",
        );
        setText("");
      }}
    >
      <span aria-hidden>›</span>
      {gate ? (
        <Tooltip content={gate} side="top">
          {input}
        </Tooltip>
      ) : (
        input
      )}
      {chat && (
        <select
          aria-label="Chat format"
          value={format}
          onChange={(e) => setFormat(e.target.value)}
        >
          <option>PLAIN</option>
          <option>MINIMESSAGE</option>
        </select>
      )}
      <button
        className="pp-ctl"
        aria-disabled={!!gate || !text.trim() || undefined}
      >
        <CornerDownLeft size={14} />
        Send
      </button>
    </form>
  );
}

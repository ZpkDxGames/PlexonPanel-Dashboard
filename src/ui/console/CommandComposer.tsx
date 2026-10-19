import { useId, useRef, useState } from "react";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { useControl, session } from "../hooks/useControl";
import { useReview } from "../review/ActionReviewModal";
import { Kbd } from "../primitives/Kbd";
export function CommandComposer({ chat = false }: { chat?: boolean }) {
  useControl();
  const reasonId = useId(),
    [value, set] = useState(""),
    history = useRef<string[]>([]),
    index = useRef(0),
    draft = useRef(""),
    review = useReview(),
    action = chat ? "chat.global.send" : "console.execute",
    reason = session.reason(action, "PAPER"),
    disabled = !value.trim() || !!reason;
  function submit() {
    if (disabled) return;
    history.current = [...history.current, value].slice(-100);
    index.current = history.current.length;
    review(action, chat ? { message: value } : { command: value }, "PAPER");
    set("");
  }
  return (
    <div className="composer">
      <div className="pp-well composer-well">
        <span className="source-chip">
          <ShieldCheck size={12} />
          {chat ? "Chat" : "RCON"} · Paper
        </span>
        <ChevronRight size={16} />
        <input
          aria-label={chat ? "Chat message" : "Server command"}
          placeholder={
            reason || (chat ? "Type a chat message…" : "Type a server command…")
          }
          value={value}
          onChange={(e) => set(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") {
              e.preventDefault();
              if (index.current === history.current.length)
                draft.current = value;
              index.current = Math.max(0, index.current - 1);
              set(history.current[index.current] ?? value);
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              index.current = Math.min(
                history.current.length,
                index.current + 1,
              );
              set(history.current[index.current] ?? draft.current);
            }
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          className="btn primary"
          disabled={disabled}
          title={reason || undefined}
          aria-describedby={reason ? reasonId : undefined}
          onClick={submit}
        >
          Review {chat ? "message" : "command"}
          <Kbd>⌘↵</Kbd>
        </button>
      </div>
      {reason && (
        <p className="gate-reason" id={reasonId}>
          {reason}
        </p>
      )}
    </div>
  );
}

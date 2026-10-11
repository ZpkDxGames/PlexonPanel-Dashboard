import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";
import type { JsonMap } from "../adapter/control-state";
export type PlayerActionDraft = { action: string; label: string; uuid: string; name: string; revision: number };
export function PlayerActionForm({ draft, reason, onClose, onReview }: { draft: PlayerActionDraft; reason: string; onClose: () => void; onReview: (parameters: JsonMap) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState(""), [explanation, setExplanation] = useState(""), [gameMode, setGameMode] = useState("SURVIVAL");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, element = dialog.current;
    element?.showModal(); return () => { element?.close(); previous?.focus(); };
  }, []);
  const isMessage = draft.action === "player.message", isMode = draft.action === "player.gamemode";
  return <dialog ref={dialog} className="review-dialog player-action-dialog" aria-labelledby="player-action-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <form onSubmit={(event) => { event.preventDefault(); if (reason || (isMessage && !message.trim())) return; onReview({ playerId: draft.uuid, ...(isMessage ? { message: message.trim() } : isMode ? { gameMode } : explanation.trim() ? { reason: explanation.trim() } : {}) }); }}>
      <div className="review-head"><span className="eyebrow">Selected player</span><h2 id="player-action-title">{draft.label} · {draft.name}</h2><p>Choose the details, then review the exact target before sending.</p></div>
      <div className="player-action-fields"><code>{draft.uuid}</code>
        {isMessage ? <label className="field">Message<textarea autoFocus value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={2000} required/></label> : isMode ? <label className="field">Game mode<select autoFocus value={gameMode} onChange={(e) => setGameMode(e.target.value)}>{["SURVIVAL", "CREATIVE", "ADVENTURE", "SPECTATOR"].map((value) => <option key={value}>{value}</option>)}</select></label> : <label className="field">Reason (optional)<textarea autoFocus value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={3} maxLength={2000}/></label>}
        {reason && <p role="alert" className="action-unavailable">{reason}</p>}
      </div>
      <div className="dialog-actions"><Button type="button" variant="quiet" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={Boolean(reason) || (isMessage && !message.trim())}>Review {draft.label.toLowerCase()}</Button></div>
    </form>
  </dialog>;
}

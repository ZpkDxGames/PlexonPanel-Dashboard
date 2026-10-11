import { useEffect, useRef, useState } from "react";
import type { ActionCompletion } from "../adapter/data-source";
import { session, type Prepared } from "../adapter/session";
import { Button, Notice } from "../components/ui";
import { useSession } from "../hooks";

const stronger = new Set(["player.ban", "player.kill", "player.op", "player.deop", "backup.full.delete"]);

export function ActionReview({ prepared, onClose, onResult }: { prepared: Prepared | null; onClose: () => void; onResult?: () => void }) {
  useSession();
  const dialog = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActionCompletion | null>(null);
  const [error, setError] = useState("");
  const attempt = useRef(0), sent = useRef(false);
  useEffect(() => {
    if (prepared && !dialog.current?.open) dialog.current?.showModal();
    if (!prepared && dialog.current?.open) dialog.current.close();
    attempt.current++; sent.current = false;
    setTyped(""); setResult(null); setError(""); setBusy(false);
  }, [prepared]);
  if (!prepared) return null;
  const confirmText = prepared.subject ?? prepared.name;
  const strong = stronger.has(prepared.action);
  const valid = session.valid(prepared);
  const execute = async () => {
    if (sent.current || !session.valid(prepared)) return;
    sent.current = true;
    const current = attempt.current;
    setBusy(true); setError("");
    try { const completed = await session.execute(prepared, strong); if (current === attempt.current) { setResult(completed); onResult?.(); } }
    catch (cause) { if (current === attempt.current) setError(cause instanceof Error ? cause.message : "Operation failed."); }
    finally { if (current === attempt.current) setBusy(false); }
  };
  return <dialog className={strong ? "review-dialog strong-review" : "review-dialog"} ref={dialog} aria-labelledby="action-review-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="review-head"><div className="review-kicker"><span className="eyebrow">Bound operation</span><span className={strong ? "review-risk danger" : "review-risk"}>{strong ? "Typed confirmation" : "Explicit confirmation"}</span></div><h2 id="action-review-title">Review before dispatch</h2><p>The result must come from the selected agent. Relay acceptance is not completion.</p></div>
    <dl className="review-target"><dt>Server</dt><dd>{prepared.name}</dd><dt>Agent</dt><dd>{prepared.kind}</dd><dt>Action</dt><dd><code>{prepared.action}</code></dd>{prepared.subject && <><dt>Subject</dt><dd>{prepared.subject}</dd></>}</dl>
    <pre className="parameter-preview">{JSON.stringify(prepared.parameters, null, 2)}</pre>
    {strong && <label className="field">Type <strong>{confirmText}</strong> to confirm<input value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" /></label>}
    {!valid && !busy && !result && !error && <Notice tone="warning" title="Target changed">Close this review and prepare the operation again for the current server.</Notice>}
    {result && <Notice tone={result.status === "SUCCESS" ? "success" : "error"} title={result.status === "SUCCESS" ? "Agent result received" : result.status}>{result.message || result.code}</Notice>}
    {error && <Notice tone="error" title="Operation not completed">{error}</Notice>}
    <div className="dialog-actions"><Button variant="quiet" onClick={onClose} disabled={busy}>{result || error ? "Close" : "Cancel"}</Button>{!result && !error && <Button variant={strong ? "danger" : "primary"} onClick={() => void execute()} disabled={busy || !valid || (strong && typed !== confirmText)}>{busy ? "Waiting for agent…" : "Dispatch operation"}</Button>}</div>
  </dialog>;
}

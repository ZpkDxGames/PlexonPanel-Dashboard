import { useEffect, useRef, useState } from "react";
import type { ActionCompletion } from "../adapter/data-source";
import { session, type Prepared } from "../adapter/session";
import { Button, Notice } from "../components/ui";

const stronger = new Set(["player.ban", "player.kill", "player.op", "player.deop", "backup.full.delete"]);

export function ActionReview({ prepared, onClose }: { prepared: Prepared | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActionCompletion | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (prepared && !dialog.current?.open) dialog.current?.showModal();
    if (!prepared && dialog.current?.open) dialog.current.close();
    setTyped(""); setResult(null); setError("");
  }, [prepared]);
  if (!prepared) return null;
  const confirmText = prepared.subject ?? prepared.name;
  const strong = stronger.has(prepared.action);
  const execute = async () => {
    setBusy(true); setError("");
    try { setResult(await session.execute(prepared, strong)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Operation failed."); }
    finally { setBusy(false); }
  };
  return <dialog className="review-dialog" ref={dialog} aria-labelledby="action-review-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="review-head"><span className="eyebrow">Bound operation</span><h2 id="action-review-title">Review before dispatch</h2><p>The result must come from the selected agent. Relay acceptance is not completion.</p></div>
    <dl className="review-target"><dt>Server</dt><dd>{prepared.name}</dd><dt>Agent</dt><dd>{prepared.kind}</dd><dt>Action</dt><dd><code>{prepared.action}</code></dd>{prepared.subject && <><dt>Subject</dt><dd>{prepared.subject}</dd></>}</dl>
    <pre className="parameter-preview">{JSON.stringify(prepared.parameters, null, 2)}</pre>
    {strong && <label className="field">Type <strong>{confirmText}</strong> to confirm<input value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" /></label>}
    {result && <Notice tone="success" title={result.status === "SUCCESS" ? "Agent result received" : result.status}>{result.message || result.code}</Notice>}
    {error && <Notice tone="error" title="Operation not completed">{error}</Notice>}
    <div className="dialog-actions"><Button variant="quiet" onClick={onClose} disabled={busy}>{result ? "Close" : "Cancel"}</Button>{!result && <Button variant={strong ? "danger" : "primary"} onClick={() => void execute()} disabled={strong && typed !== confirmText} loading={busy}>{busy ? "Waiting for agent…" : "Dispatch operation"}</Button>}</div>
  </dialog>;
}

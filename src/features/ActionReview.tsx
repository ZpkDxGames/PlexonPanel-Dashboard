import { useEffect, useRef, useState } from "react";
import type { ActionCompletion } from "../adapter/data-source";
import { session, type Prepared } from "../adapter/session";
import { Button, Notice } from "../components/ui";

const stronger = new Set(["player.ban", "player.kill", "player.op", "player.deop", "backup.full.delete", 'files.delete', 'backup.full.restore']);

export function ActionReview({ prepared, onClose }: { prepared: Prepared | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActionCompletion | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (prepared && !dialog.current?.open) {dialog.current?.showModal();dialog.current?.querySelector<HTMLButtonElement>('.dialog-actions button')?.focus();}
    if (!prepared && dialog.current?.open) dialog.current.close();
    setTyped(""); setResult(null); setError("");
  }, [prepared]);
  if (!prepared) return null;
  const confirmText = prepared.subject ?? prepared.name;
  const strong = stronger.has(prepared.action) || prepared.action === 'console.execute' && /^(?:\/?(?:stop|op|deop|ban|kill|fill|reload)\b|\/?whitelist\s+off)/i.test(String(prepared.parameters.command));
  const consequence = prepared.action === 'server.stop' || prepared.action === 'server.restart' ? 'Players will disconnect. Unsaved progress depends on the server completing its save before shutdown.' : prepared.action.includes('restore') ? 'Restoring replaces current server data and may stop the server. Verify the selected backup first.' : prepared.action.includes('delete') ? 'This removes the selected item. Make sure you have a backup before continuing.' : prepared.action.startsWith('player.') ? 'This changes the selected player’s access or state on this server.' : 'The selected server will receive this operation once. Review the target and parameters before continuing.';
  const execute = async () => {
    setBusy(true); setError("");
    try { setResult(await session.execute(prepared, strong)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Operation failed."); }
    finally { setBusy(false); }
  };
  return <dialog className="review-dialog" ref={dialog} aria-labelledby="action-review-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="review-head"><span className="eyebrow">Confirm action</span><h2 id="action-review-title">Ready to continue?</h2><p>{consequence}</p></div>
    <dl className="review-target"><dt>Server</dt><dd>{prepared.name}</dd><dt>Agent</dt><dd>{prepared.kind}</dd><dt>Action</dt><dd><code>{prepared.action}</code></dd>{prepared.subject && <><dt>Subject</dt><dd>{prepared.subject}</dd></>}</dl>
    <pre className="parameter-preview">{JSON.stringify(prepared.parameters, null, 2)}</pre>
    {strong && <label className="field">Type <strong>{confirmText}</strong> to confirm<input value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" /></label>}
    {result && <Notice tone={result.status === 'SUCCESS' ? 'success' : 'warning'} title={result.status === "SUCCESS" ? "Server result received" : result.status}>{result.message || result.code}</Notice>}
    {error && <Notice tone="error" title="Operation not completed">{error}</Notice>}
    <div className="dialog-actions"><Button variant="quiet" onClick={onClose} disabled={busy}>{result ? "Close" : "Cancel"}</Button>{!result && <Button variant={strong ? "danger" : "primary"} onClick={() => void execute()} disabled={busy || (strong && typed !== confirmText)}>{busy ? "Waiting for agent…" : "Dispatch operation"}</Button>}</div>
  </dialog>;
}

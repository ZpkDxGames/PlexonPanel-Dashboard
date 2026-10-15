import { useEffect, useRef, useState } from "react";
import type { ActionCompletion } from "../adapter/data-source";
import { session, type Prepared } from "../adapter/session";
import { useSession } from "../hooks";
import { Button, Notice } from "../components/ui";
import { reviewPolicy } from "../presentation/review-policy";
export function ActionReview({
  prepared,
  onClose,
}: {
  prepared: Prepared | null;
  onClose: () => void;
}) {
  const snap = useSession(),
    dialog = useRef<HTMLDialogElement>(null),
    [typed, setTyped] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<ActionCompletion | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!prepared) return;
    const current = dialog.current;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (current && !current.open) current.showModal();
    setTyped("");
    setResult(null);
    setError("");
    return () => {
      if (current?.open) current.close();
      if (previous?.isConnected) previous.focus();
    };
  }, [prepared]);
  if (!prepared) return null;
  const confirmText = prepared.subject ?? prepared.name,
    policy = reviewPolicy(prepared.action),
    strong = policy.typed,
    valid = session.valid(prepared),
    operation =
      snap.operation?.action === prepared.action ? snap.operation : null;
  const execute = async () => {
    setBusy(true);
    setError("");
    try {
      setResult(await session.execute(prepared, policy.confirmed));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operation failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <dialog
      className="review-dialog"
      ref={dialog}
      aria-labelledby="action-review-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="review-head">
        <span className="eyebrow">OPERATION / REVIEW</span>
        <h2 id="action-review-title">Review before dispatch</h2>
        <p>
          Confirm the server, agent and exact parameters. Completion comes from
          the selected agent.
        </p>
      </div>
      <dl className="review-target">
        <dt>Server</dt>
        <dd>{prepared.name}</dd>
        <dt>Agent</dt>
        <dd>{prepared.kind}</dd>
        <dt>Operation</dt>
        <dd>
          <code>{prepared.action}</code>
        </dd>
        {prepared.subject && (
          <>
            <dt>Subject</dt>
            <dd>{prepared.subject}</dd>
          </>
        )}
      </dl>
      <pre className="parameter-preview">
        {JSON.stringify(prepared.parameters, null, 2)}
      </pre>
      {strong && (
        <label className="field">
          Type <strong>{confirmText}</strong> to confirm
          <input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
          />
        </label>
      )}
      {!valid && !result && (
        <Notice tone="warning" title="Target or authority changed">
          Close this review and inspect the selected server before preparing
          again.
        </Notice>
      )}
      {busy && (
        <Notice
          title={
            operation?.phase === "acknowledged"
              ? "Queued by relay · awaiting agent"
              : "Awaiting agent response"
          }
        >
          {operation?.message ??
            "The outcome is not yet known. This operation will not be automatically retried."}
        </Notice>
      )}
      {result && (
        <>
          <Notice
            tone={result.status === "SUCCESS" ? "success" : "warning"}
            title={
              result.status === "SUCCESS"
                ? "Agent result received"
                : result.status
            }
          >
            {result.message || result.code}
          </Notice>
          {result.data && (
            <pre className="parameter-preview" aria-label="Agent response">
              {JSON.stringify(result.data, null, 2).slice(0, 24000)}
            </pre>
          )}
        </>
      )}
      {error && (
        <Notice tone="error" title="Operation not completed">
          {error}
        </Notice>
      )}
      <div className="dialog-actions">
        <Button variant="quiet" onClick={onClose} disabled={busy}>
          {result ? "Close" : "Cancel"}
        </Button>
        {!result && (
          <Button
            variant={strong ? "danger" : "primary"}
            disabled={!valid || (strong && typed !== confirmText)}
            loading={busy}
            onClick={() => void execute()}
          >
            {busy ? "Waiting for agent…" : "Dispatch operation"}
          </Button>
        )}
      </div>
    </dialog>
  );
}

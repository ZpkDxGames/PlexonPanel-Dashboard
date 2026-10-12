import { copy } from "../i18n/en";
import { useEffect, useRef, useState } from "react";
import type { ActionCompletion } from "../adapter/data-source";
import { session, type Prepared } from "../adapter/session";
import { Button, Notice } from "../components/ui";
import {
  requiresAgentConfirmation,
  requiresTypedConfirmation,
} from "../lib/console-command";
export function ActionReview({
  prepared,
  onClose,
  onComplete,
  forceAgentConfirmation = false,
}: {
  prepared: Prepared | null;
  onClose: () => void;
  onComplete?: (result: ActionCompletion) => void;
  forceAgentConfirmation?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActionCompletion | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (prepared && !dialog.current?.open) {
      dialog.current?.showModal();
      dialog.current
        ?.querySelector<HTMLButtonElement>(".dialog-actions button")
        ?.focus();
    }
    if (!prepared && dialog.current?.open) dialog.current.close();
    setTyped("");
    setResult(null);
    setError("");
  }, [prepared]);
  if (!prepared) return null;
  const confirmText = prepared.subject ?? prepared.name;
  const strong = requiresTypedConfirmation(
    prepared.action,
    prepared.parameters,
  );
  const confirmsAgent =
    forceAgentConfirmation ||
    requiresAgentConfirmation(prepared.action, prepared.parameters);
  const consequence =
    prepared.action === "server.stop" || prepared.action === "server.restart"
      ? "Players will disconnect. Unsaved progress depends on the server completing its save before shutdown."
      : prepared.action.includes("restore")
        ? "Restoring replaces current server data and may stop the server. Verify the selected backup first."
        : prepared.action.includes("delete")
          ? "This removes the selected item. Make sure you have a backup before continuing."
          : prepared.action.startsWith("player.")
            ? "This changes the selected player’s access or state on this server."
            : "The selected server will receive this operation once. Review the target and parameters before continuing.";
  const execute = async () => {
    setBusy(true);
    setError("");
    try {
      const completion = await session.execute(prepared, confirmsAgent);
      setResult(completion);
      onComplete?.(completion);
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
        <span className="eyebrow">{copy.confirm_action_50649}</span>
        <h2 id="action-review-title">{copy.ready_to_continue_0db8c}</h2>
        <p>{consequence}</p>
      </div>
      <dl className="review-target">
        <dt>{copy.server_cb0cb}</dt>
        <dd>{prepared.name}</dd>
        <dt>{copy.agent_5ce2e}</dt>
        <dd>{prepared.kind}</dd>
        <dt>{copy.action_97c89}</dt>
        <dd>
          <code>{prepared.action}</code>
        </dd>
        {prepared.subject && (
          <>
            <dt>{copy.subject_8d183}</dt>
            <dd>{prepared.subject}</dd>
          </>
        )}
      </dl>
      <pre className="parameter-preview">
        {JSON.stringify(prepared.parameters, null, 2)}
      </pre>
      {strong && (
        <label className="field">
          {copy.type_e298b}
          <strong>{confirmText}</strong>
          {copy._to_confirm_600f4}
          <input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
          />
        </label>
      )}
      {result && (
        <Notice
          tone={result.status === "SUCCESS" ? "success" : "warning"}
          title={
            result.status === "SUCCESS"
              ? "Server result received"
              : result.status
          }
        >
          {result.message || result.code}
        </Notice>
      )}
      {error && (
        <Notice tone="error" title={copy.operation_not_completed_b7886}>
          {error}
        </Notice>
      )}
      <div className="dialog-actions">
        <Button variant="quiet" onClick={onClose} disabled={busy}>
          {result ? "Close" : "Cancel"}
        </Button>
        {!result && (
          <Button
            variant={confirmsAgent ? "danger" : "primary"}
            onClick={() => void execute()}
            disabled={busy || (strong && typed !== confirmText)}
          >
            {busy
              ? "Waiting for agent…"
              : confirmsAgent
                ? "Confirm & dispatch"
                : "Dispatch operation"}
          </Button>
        )}
      </div>
    </dialog>
  );
}

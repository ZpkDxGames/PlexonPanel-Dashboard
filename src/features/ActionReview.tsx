import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { useEffect, useRef, useState } from "react";
import type { ActionCompletion } from "../adapter/data-source";
import { session, type Prepared } from "../adapter/session";
import { useSession } from "../hooks";
import { Button, Notice } from "../components/ui";
import { navigate } from "../router";
import { reviewPolicy } from "../presentation/review-policy";
export function ActionReview({
  prepared,
  onClose,
}: {
  prepared: Prepared | null;
  onClose: () => void;
}) {
  const snap = useSession(),
    previousFocus = useRef<HTMLElement | null>(null),
    [typed, setTyped] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<ActionCompletion | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!prepared) return;
    setTyped("");
    setResult(null);
    setError("");
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
    <Dialog
      open={!!prepared}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="review-dialog"
        onOpenAutoFocus={() => {
          previousFocus.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
        }}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (busy) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const target = previousFocus.current;
          if (target?.isConnected && !target.hasAttribute("disabled"))
            target.focus();
          else document.getElementById("workspace")?.focus();
        }}
      >
        <div className="review-head">
          <span className="eyebrow">OPERATION / REVIEW</span>
          <DialogTitle asChild>
            <h2 id="action-review-title">
              Review {prepared.action.replaceAll(".", " ").replaceAll("-", " ")}
            </h2>
          </DialogTitle>
          <DialogDescription asChild>
            <p>
              Confirm the server, agent and exact parameters. Completion comes
              from the selected agent.
            </p>
          </DialogDescription>
        </div>
        <dl className="review-target">
          <dt>Server</dt>
          <dd>{prepared.name}</dd>
          <dt>Server ID</dt>
          <dd>
            <code>{prepared.target.serverId}</code>
          </dd>
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
                  ? prepared.action === "maintenance.full-backup.create" &&
                    result.data?.state === "QUEUED"
                    ? "Host accepted job · not completed"
                    : "Agent result received"
                  : result.status
              }
            >
              {prepared.action === "maintenance.full-backup.create" &&
              result.data?.state === "QUEUED"
                ? "The Host owns the queued job. Inspect durable status in Backups for completion and verification."
                : result.message || result.code}
            </Notice>
            {result.data && (
              <pre className="parameter-preview" aria-label="Agent response">
                {JSON.stringify(result.data, null, 2).slice(0, 24000)}
              </pre>
            )}
          </>
        )}
        {error && (
          <Notice tone="error" title="Outcome not confirmed">
            {error} Inspect the agent audit or durable Host status before
            preparing another operation.
          </Notice>
        )}
        {error && (
          <Button
            onClick={() => {
              onClose();
              navigate("Access");
            }}
          >
            Inspect agent audit
          </Button>
        )}
        <div className="dialog-actions">
          <Button variant="quiet" onClick={onClose} disabled={busy}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button
              variant={strong ? "danger" : "primary"}
              disabled={!!error || !valid || (strong && typed !== confirmText)}
              loading={busy}
              onClick={() => void execute()}
            >
              {busy ? "Waiting for agent…" : "Dispatch operation"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

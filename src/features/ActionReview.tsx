"use client";
import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Field, Input } from "../components/ui/input";
import { Notice } from "../components/ui/empty";
import { Badge } from "../components/ui/badge";
import { session, type Prepared } from "../adapter/session";
import type { ActionCompletion } from "../adapter/data-source";
import { reviewPolicy } from "../presentation/review-policy";
import { useSession } from "../hooks";
import { navigate } from "../router";
export function ActionReview({
  prepared,
  onClose,
}: {
  prepared: Prepared | null;
  onClose: () => void;
}) {
  const snap = useSession(),
    previousFocus = useRef<HTMLElement | null>(null);
  const [typed, setTyped] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<ActionCompletion | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (prepared) {
      setTyped("");
      setResult(null);
      setError("");
    }
  }, [prepared]);
  if (!prepared) return null;
  const policy = reviewPolicy(prepared.action),
    confirmText = prepared.subject ?? prepared.name,
    valid = session.valid(prepared);
  const execute = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      setResult(await session.execute(prepared, policy.confirmed));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  };
  const queued =
    result?.status === "SUCCESS" &&
    prepared.action === "maintenance.full-backup.create" &&
    result.data?.state === "QUEUED";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        hideClose={busy}
        onOpenAutoFocus={() => {
          previousFocus.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
        }}
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (busy) e.preventDefault();
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          const target = previousFocus.current;
          if (target?.isConnected && !target.hasAttribute("disabled"))
            target.focus();
          else document.getElementById("workspace")?.focus();
        }}
      >
        <div className="mb-4 inline-flex rounded-xl border border-primary/20 bg-primary/10 p-3 text-primary">
          <ShieldCheck size={22} />
        </div>
        <DialogTitle>Review operation</DialogTitle>
        <DialogDescription>
          Confirm the server and exact target before dispatching.
        </DialogDescription>
        <div className="my-5 rounded-xl border bg-background p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <strong className="text-sm">{prepared.name}</strong>
            <Badge>{prepared.kind}</Badge>
          </div>
          <p className="break-all font-mono text-[10px] text-muted-foreground">
            {prepared.target.serverId}
          </p>
          <p className="mt-3 font-mono text-xs text-primary">
            {prepared.action}
          </p>
          {prepared.subject && (
            <p className="mt-2 text-xs">Target: {prepared.subject}</p>
          )}
        </div>
        <pre className="mb-5 max-h-48 overflow-auto rounded-lg border bg-terminal p-4 font-mono text-[10px] leading-6">
          {JSON.stringify(prepared.parameters, null, 2)}
        </pre>
        {policy.typed && (
          <Field label={`Type ${confirmText} to confirm`}>
            <Input
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </Field>
        )}
        <div className="mt-4 space-y-3">
          {!valid && !result && (
            <Notice title="Target or authority changed">
              Close this review and prepare again from the current server.
            </Notice>
          )}
          {busy && (
            <Notice
              title={
                snap.operation?.phase === "acknowledged"
                  ? "Queued by relay · awaiting agent"
                  : "Awaiting agent response"
              }
            >
              The outcome is pending. This operation will not be retried
              automatically.
            </Notice>
          )}
          {result && (
            <>
              <Notice
                title={
                  queued
                    ? "Host accepted job · not completed"
                    : `Agent result: ${result.status}`
                }
              >
                {queued
                  ? "Inspect durable job status in Backups for completion and verification."
                  : result.message || result.code}
              </Notice>
              {result.data && (
                <pre
                  aria-label="Agent response"
                  className="max-h-48 overflow-auto rounded-lg border bg-terminal p-3 font-mono text-[10px]"
                >
                  {JSON.stringify(result.data, null, 2).slice(0, 24000)}
                </pre>
              )}
            </>
          )}
          {error && (
            <>
              <Notice danger title="Outcome not confirmed">
                {error} Inspect the audit or durable Host status before
                preparing another operation.
              </Notice>
              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  navigate("Access");
                }}
              >
                Inspect agent audit
              </Button>
            </>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={onClose}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button
              variant={policy.typed ? "destructive" : "default"}
              disabled={
                busy ||
                !!error ||
                !valid ||
                (policy.typed && typed !== confirmText)
              }
              onClick={() => void execute()}
            >
              {busy ? (
                <>
                  <Loader2 className="animate-spin" />
                  Waiting for agent…
                </>
              ) : (
                "Dispatch operation"
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

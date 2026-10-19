"use client";
import { useContext, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ShieldCheck, X, LoaderCircle } from "lucide-react";
import {
  session,
  useControl,
  useNow,
  reviewPolicy,
  record,
  MutationContext,
  useLedger,
  type Prepared,
  type Kind,
  type JsonMap,
} from "../bindings";
import { Tooltip } from "./Tooltip";
type Begin = (action: string, args?: JsonMap, kind?: Kind) => Promise<void>;
export const useReview = () => useContext(MutationContext);
export function ReviewProvider({ children }: { children: ReactNode }) {
  useControl();
  useNow();
  const ledger = useLedger();
  const [prepared, setPrepared] = useState<Prepared | null>(null),
    [typed, setTyped] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    focus = useRef<HTMLElement | null>(null),
    cancel = useRef<HTMLButtonElement>(null),
    confirmRef = useRef<HTMLButtonElement>(null),
    [deadline, setDeadline] = useState(0);
  const destructive =
      !!prepared &&
      (/stop|ban|delete|revoke|restore(?!\.prepare)/.test(prepared.action) ||
        reviewPolicy(prepared.action).typed),
    typedRequired =
      !!prepared &&
      (reviewPolicy(prepared.action).typed ||
        prepared.action === "backup.full.restore"),
    tone = destructive ? "rose" : "indigo";
  const begin: Begin = async (action, args = {}, kind = "HOST") => {
    try {
      let parameters = args;
      if (action === "backup.full.restore") {
        const token = await session.query(
            "backup.full.restore.prepare",
            { backupId: args.backupId },
            "HOST",
          ),
          d = record(token.data);
        if (
          typeof d.confirmationToken !== "string" ||
          typeof d.serverName !== "string"
        )
          throw new Error(
            "The Host did not issue a restore confirmation token.",
          );
        parameters = {
          ...args,
          confirmationToken: d.confirmationToken,
          serverName: d.serverName,
        };
      }
      const p = session.prepare(action, parameters, kind);
      focus.current = document.activeElement as HTMLElement;
      setTyped("");
      setError("");
      setDeadline(Date.now() + 60000);
      setPrepared(p);
    } catch (e) {
      setToast((e as Error).message);
    }
  };
  const reason = !prepared
    ? ""
    : ledger[prepared.kind === "HOST" ? "host" : "paper"].state !== "live"
      ? "Current target telemetry is required. Prepare again after the source recovers."
      : !session.valid(prepared)
        ? "The target or authority changed. Review again."
        : Date.now() > deadline
          ? "This review has expired. Prepare again."
          : typedRequired && typed !== prepared.name
            ? "Type the exact server name to confirm."
            : busy
              ? "Waiting for the agent result."
              : "";
  async function execute() {
    if (!prepared || reason) return;
    setBusy(true);
    setError("");
    try {
      const r = await session.execute(prepared, true);
      setToast(`${r.status}: ${r.message ?? "Operation completed"}`);
      setPrepared(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const confirm = (
    <button
      ref={confirmRef}
      className="pp-ctl"
      data-tone={tone}
      data-primary="true"
      aria-disabled={reason ? true : undefined}
      onClick={() => void execute()}
    >
      {busy && <LoaderCircle size={14} aria-hidden />}Confirm & execute
    </button>
  );
  return (
    <MutationContext.Provider value={begin}>
      {children}
      <Dialog.Root
        open={!!prepared}
        onOpenChange={(open) => {
          if (!open && !busy) setPrepared(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="pp-overlay" />
          <Dialog.Content
            className="pp-glass pp-modal"
            data-tone={tone}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              (destructive ? cancel.current : confirmRef.current)?.focus();
            }}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              focus.current?.focus();
            }}
          >
            <header>
              <ShieldCheck size={20} />
              <Dialog.Title>Review: {prepared?.action}</Dialog.Title>
              <i className="pp-dot" />
              <Dialog.Close
                className="pp-ctl push"
                aria-label="Close action review"
                disabled={busy}
              >
                <X size={14} />
              </Dialog.Close>
            </header>
            <div className="pp-modal-body">
              <Dialog.Description>
                {prepared?.action.includes("restore")
                  ? "Replace server data from the verified archive. The Host creates an emergency restore point first."
                  : prepared?.action.includes("backup")
                    ? "Warn connected players, flush saves, stop safely, verify the archive and upload through the configured provider."
                    : "Execute this operation on the selected instance. Authority and the exact target generation are checked again before dispatch."}
              </Dialog.Description>
              <dl>
                {[
                  ["Target", prepared?.name],
                  ["Scope", prepared?.action],
                  ["Affected instance", prepared?.target.serverId],
                  [
                    "Reversible?",
                    destructive ? "Not guaranteed" : "Depends on the operation",
                  ],
                  ["Generation", prepared?.target.generation],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <details style={{ marginTop: 16 }}>
                <summary>Exact parameters</summary>
                <pre>
                  {JSON.stringify(
                    prepared?.parameters,
                    (_k, v) =>
                      _k === "confirmationToken"
                        ? "[Host confirmation token]"
                        : v,
                    2,
                  )}
                </pre>
              </details>
              {destructive && (
                <div className="tone" style={{ marginTop: 16, fontSize: 12 }}>
                  ⚠ This action can interrupt availability or change access.
                </div>
              )}
              {typedRequired && (
                <label>
                  Type server name
                  <input
                    aria-label="Type server name"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoComplete="off"
                  />
                </label>
              )}
              {error && (
                <div
                  className="pp-error"
                  role="alert"
                  style={{ marginTop: 14 }}
                >
                  {error}
                </div>
              )}
            </div>
            <footer>
              <Dialog.Close ref={cancel} className="pp-ctl" disabled={busy}>
                Cancel
              </Dialog.Close>
              {reason ? <Tooltip content={reason}>{confirm}</Tooltip> : confirm}
            </footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {toast && (
        <div
          role="status"
          className="pp-glass pp-toast"
          onClick={() => setToast("")}
        >
          {toast}
          <button
            aria-label="Dismiss notification"
            style={{ marginLeft: 12 }}
            onClick={() => setToast("")}
          >
            ×
          </button>
        </div>
      )}
    </MutationContext.Provider>
  );
}

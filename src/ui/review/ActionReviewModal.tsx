import {
  createContext,
  useContext,
  useState,
  useRef,
  useId,
  type ReactNode,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { LoaderCircle, ShieldCheck, X, type LucideIcon } from "lucide-react";
import { session, useControl } from "../hooks/useControl";
import type { Kind, Prepared } from "../../adapter/session";
import type { JsonMap } from "../../adapter/control-state";
import { reviewPolicy } from "../../presentation/review-policy";
import { IconBadge } from "../primitives/IconBadge";
import { Pill } from "../primitives/Pill";
const Review = createContext<
  (action: string, parameters?: JsonMap, kind?: Kind) => void
>(() => {});
export const useReview = () => useContext(Review);
export function ReviewProvider({ children }: { children: ReactNode }) {
  useControl();
  const [open, setOpen] = useState(false),
    [prepared, setPrepared] = useState<Prepared | null>(null),
    [error, setError] = useState(""),
    [typed, setTyped] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState(""),
    focus = useRef<HTMLElement | null>(null);
  function review(
    action: string,
    parameters: JsonMap = {},
    kind: Kind = "HOST",
  ) {
    focus.current = document.activeElement as HTMLElement;
    setPrepared(null);
    setError("");
    setTyped("");
    setResult("");
    setOpen(true);
    try {
      setPrepared(session.prepare(action, parameters, kind));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const destructive =
      !!prepared &&
      (reviewPolicy(prepared.action).typed ||
        /stop|ban|delete|revoke/.test(prepared.action)),
    risk = destructive
      ? "destructive"
      : prepared && reviewPolicy(prepared.action).confirmed
        ? "caution"
        : "info",
    tone =
      risk === "destructive" ? "rose" : risk === "caution" ? "amber" : "indigo";
  async function confirm() {
    if (!prepared || !session.valid(prepared)) return;
    setBusy(true);
    try {
      const r = await session.execute(prepared, true);
      setResult(
        `${r.status}: ${r.message ?? "Operation resolved by the agent"}`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Review.Provider value={review}>
      {children}
      <Dialog.Root
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="modal-overlay" />
          <Dialog.Content
            className="pp-glass modal"
            data-tone={tone}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              focus.current?.focus();
            }}
          >
            <header className="card-header">
              <IconBadge icon={ShieldCheck} tone={tone} />
              <div>
                <Dialog.Title>
                  {prepared ? `Review ${prepared.action}` : "Review action"}
                </Dialog.Title>
                <Pill tone={tone}>{risk}</Pill>
              </div>
              <Dialog.Close
                className="icon-btn ml-auto"
                aria-label="Close review"
                disabled={busy}
              >
                <X size={16} />
              </Dialog.Close>
            </header>
            <Dialog.Description className="text-secondary mb-4">
              Review the exact prepared target and effects before confirming.
            </Dialog.Description>
            {prepared && (
              <>
                <h3>What will happen</h3>
                <ul className="list-disc pl-5 space-y-2 text-secondary my-3">
                  <li>
                    The {prepared.kind} agent will authorize and execute{" "}
                    {prepared.action}.
                  </li>
                  <li>
                    Server controls may interrupt connected players; a full
                    backup includes warning, cold stop, upload and restart.
                  </li>
                </ul>
                <p className="eyebrow mb-2">Exact target</p>
                <div className="pp-well p-3 break-words">
                  <strong>{prepared.name}</strong>
                  <p className="mono text-xs mt-1">
                    {prepared.target.serverId}
                  </p>
                  <pre>{JSON.stringify(prepared.parameters, null, 2)}</pre>
                </div>
                <p className="text-secondary text-xs mt-3">
                  Prepared generation {prepared.target.generation} · authority
                  is rechecked at dispatch.
                </p>
                {destructive && (
                  <label className="block mt-4">
                    Type server name
                    <input
                      aria-label="Type server name"
                      className="field mt-2 w-full"
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      placeholder={prepared.name}
                    />
                  </label>
                )}
                {!session.valid(prepared) && (
                  <p className="gate-reason">
                    The target or authority changed. Close this review and
                    prepare again.
                  </p>
                )}
              </>
            )}
            {error && (
              <p className="error-banner mt-4" role="alert">
                {error}
              </p>
            )}
            {result && (
              <div
                role="status"
                className="pp-well p-3 mt-4"
                data-tone="emerald"
              >
                {result}
              </div>
            )}
            <footer className="flex justify-end gap-2 mt-5">
              <Dialog.Close className="btn" disabled={busy}>
                {result ? "Close" : "Cancel"}
              </Dialog.Close>
              {!result && (
                <button
                  className="btn primary"
                  data-tone={tone}
                  onClick={() => void confirm()}
                  disabled={
                    busy ||
                    !prepared ||
                    !session.valid(prepared) ||
                    (destructive && typed !== prepared.name)
                  }
                >
                  {busy && (
                    <LoaderCircle
                      size={16}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  {busy
                    ? "Waiting for agent result…"
                    : `Confirm ${prepared?.action.split(".").at(-1) ?? "action"}`}
                </button>
              )}
            </footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Review.Provider>
  );
}
export function MutationButton({
  action,
  kind = "HOST",
  parameters = {},
  label,
  extraReason = "",
  tone = "indigo",
  icon: Icon,
  solid = false,
}: {
  action: string;
  kind?: Kind;
  parameters?: JsonMap;
  label: string;
  extraReason?: string;
  tone?: "emerald" | "indigo" | "amber" | "rose";
  icon?: LucideIcon;
  solid?: boolean;
}) {
  useControl();
  const review = useReview(),
    reason = session.reason(action, kind) || extraReason,
    id = useId();
  return (
    <div>
      <button
        className={`btn ${solid ? "primary" : ""}`}
        data-tone={tone}
        disabled={!!reason}
        title={reason || undefined}
        aria-describedby={reason ? id : undefined}
        onClick={() => review(action, parameters, kind)}
      >
        {Icon && <Icon size={16} aria-hidden="true" />}
        {label}
      </button>
      {reason && (
        <p className="gate-reason" id={id}>
          {reason}
        </p>
      )}
    </div>
  );
}

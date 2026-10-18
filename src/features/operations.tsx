"use client";
import { useState, type ComponentProps } from "react";
import { session, type Kind, type Prepared } from "../adapter/session";
import type { JsonMap } from "../adapter/control-state";
import { ActionReview } from "./ActionReview";
import { Button } from "../components/ui/button";
import { Notice } from "../components/ui/empty";
import { useSession } from "../hooks";
export function useOperation() {
  const [prepared, setPrepared] = useState<Prepared | null>(null),
    [error, setError] = useState("");
  return {
    prepare(action: string, parameters: JsonMap = {}, kind: Kind = "HOST") {
      setError("");
      try {
        setPrepared(session.prepare(action, parameters, kind));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action unavailable");
      }
    },
    review: (
      <>
        <ActionReview prepared={prepared} onClose={() => setPrepared(null)} />
        {error && (
          <Notice danger title="Cannot prepare operation">
            {error}
          </Notice>
        )}
      </>
    ),
  };
}
export function ActionButton({
  action,
  kind = "HOST",
  blocked,
  children,
  ...props
}: ComponentProps<typeof Button> & {
  action: string;
  kind?: Kind;
  blocked?: string;
}) {
  useSession();
  const reason = blocked || session.reason(action, kind);
  return (
    <span className="inline-flex max-w-full flex-col gap-1.5">
      <Button
        {...props}
        title={reason || props.title}
        disabled={!!reason || props.disabled}
      >
        {children}
      </Button>
      {reason && (
        <span className="max-w-56 text-[10px] leading-relaxed text-muted-foreground">
          {reason}
        </span>
      )}
    </span>
  );
}

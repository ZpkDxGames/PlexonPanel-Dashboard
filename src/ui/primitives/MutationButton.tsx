import { forwardRef } from "react";
import { type LucideIcon } from "lucide-react";
import { useMutation, type Kind, type JsonMap, type Tone } from "../bindings";
import { Tooltip } from "./Tooltip";
export const MutationButton = forwardRef<
  HTMLButtonElement,
  {
    action: string;
    kind?: Kind;
    args?: JsonMap;
    label: string;
    icon?: LucideIcon;
    tone?: Tone;
    foreground?: boolean;
    className?: string;
    extraReason?: string;
  }
>(function MutationButton(
  {
    action,
    kind = "HOST",
    args = {},
    label,
    icon: Icon,
    tone = "indigo",
    foreground,
    className = "",
    extraReason = "",
  },
  ref,
) {
  const mutation = useMutation(action, kind),
    reason = mutation.reason || extraReason;
  const button = (
    <button
      ref={ref}
      type="button"
      className={`pp-ctl ${className}`}
      data-tone={tone}
      data-fg={foreground || undefined}
      aria-label={label}
      aria-disabled={reason ? true : undefined}
      aria-description={reason || undefined}
      onClick={() => {
        if (!reason) void mutation.begin(args);
      }}
    >
      {Icon && <Icon size={14} aria-hidden />}
      <span>{label}</span>
    </button>
  );
  return reason ? <Tooltip content={reason}>{button}</Tooltip> : button;
});

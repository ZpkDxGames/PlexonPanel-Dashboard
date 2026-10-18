import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/utils";
const input =
  "h-10 w-full min-w-0 rounded-lg border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground disabled:opacity-40";
export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(input, className)} {...props} />;
}
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(input, "h-auto min-h-20 py-3", className)}
      {...props}
    />
  );
}
export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(input, className)} {...props} />;
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="grid min-w-0 gap-2 text-xs font-medium">
      {label}
      {children}
      {hint && (
        <span className="font-normal text-muted-foreground">{hint}</span>
      )}
    </label>
  );
}

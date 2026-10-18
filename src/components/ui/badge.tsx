import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
export function Badge({
  children,
  tone = "neutral",
  dot = false,
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-[10px] font-semibold",
        {
          neutral: "border-border bg-muted/40 text-muted-foreground",
          success:
            "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
          warning:
            "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
          danger:
            "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
          info: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        }[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

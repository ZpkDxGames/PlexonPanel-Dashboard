import type { ReactNode } from "react";
import { Radio } from "lucide-react";
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center gap-2 p-6 text-center">
      <span className="mb-1 rounded-xl border bg-muted/40 p-3 text-muted-foreground">
        <Radio size={20} />
      </span>
      <p className="text-sm font-medium">{title}</p>
      {children && (
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          {children}
        </p>
      )}
    </div>
  );
}
export function Notice({
  children,
  title,
  danger = false,
}: {
  title?: string;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      role={danger ? "alert" : "status"}
      className={`rounded-lg border p-3 text-xs leading-relaxed ${danger ? "border-rose-500/25 bg-rose-500/5 text-rose-700 dark:text-rose-300" : "bg-muted/40 text-muted-foreground"}`}
    >
      {title && <strong className="mb-1 block text-foreground">{title}</strong>}
      {children}
    </div>
  );
}

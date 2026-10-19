import type { ReactNode } from "react";
import type { Tone } from "../types";
import { cn } from "../cn";
export function Pill({
  tone = "accent",
  dot,
  className,
  children,
  size,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
  size?: "sm" | "md";
}) {
  return (
    <span data-tone={tone} className={cn("pill", className)}>
      {dot && <i className="signal-dot" />}
      {children}
    </span>
  );
}

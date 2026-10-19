import type { HTMLAttributes } from "react";
import type { Tone } from "../types";
export function Surface({
  level = "card",
  tone = "accent",
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & {
  level?: "canvas" | "shell" | "card" | "well" | "glass";
  tone?: Tone;
}) {
  return (
    <section
      data-tone={tone}
      className={`pp-${level} ${className}`}
      {...props}
    />
  );
}

import type { LucideIcon } from "lucide-react";
import type { Tone } from "../types";
export function IconBadge({
  icon: Icon,
  tone = "accent",
}: {
  icon: LucideIcon;
  tone?: Tone;
}) {
  return (
    <span className="pp-icon-badge" data-tone={tone}>
      <Icon size={18} strokeWidth={1.75} />
    </span>
  );
}

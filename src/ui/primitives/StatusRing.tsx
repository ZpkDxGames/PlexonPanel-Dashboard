import type { Tone } from "../types";
import { fmtGiB } from "../hooks/useControl";
export function StatusRing({
  state,
}: {
  state: "online" | "starting" | "stopping" | "stopped" | "unknown";
}) {
  const tone = {
    online: "emerald",
    starting: "amber",
    stopping: "amber",
    stopped: "slate",
    unknown: "slate",
  }[state] as Tone;
  const pulsing = state === "online" || state === "starting";
  return (
    <span
      data-tone={tone}
      className="relative inline-grid size-2.5 place-items-center"
    >
      {pulsing && (
        <i className="absolute inset-0 rounded-full border border-[rgb(var(--tone))] animate-[pp-pulse-ring_2.4s_ease-out_infinite]" />
      )}
      <i className="size-2 rounded-full bg-[rgb(var(--tone))] shadow-[0_0_10px_rgb(var(--tone))]" />
    </span>
  );
}

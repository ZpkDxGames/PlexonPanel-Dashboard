import type { Tone } from "../types";
import { fmtGiB } from "../hooks/useControl";
export function EqualizerBars({
  samples,
  ceil = 60,
  bars = 30,
}: {
  samples: (number | null)[];
  ceil?: number;
  bars?: number;
}) {
  const slice = samples.slice(-bars);
  const padded = [
    ...Array(Math.max(0, bars - slice.length)).fill(null),
    ...slice,
  ];
  return (
    <div
      className="flex h-9 items-end gap-[2px]"
      role="img"
      aria-label="Recent MSPT per sample"
    >
      {padded.map((v, i) => {
        const h = v == null ? 8 : Math.max(10, Math.min(100, (v / ceil) * 100));
        const tone =
          v == null
            ? "slate"
            : v <= 40
              ? "emerald"
              : v <= 50
                ? "amber"
                : "rose";
        return (
          <i
            key={i}
            data-tone={tone}
            style={{
              height: `${h}%`,
              opacity: v == null ? 0.25 : 0.55 + (i / bars) * 0.45,
            }}
            className="flex-1 rounded-[2px] bg-gradient-to-t from-[rgb(var(--tone)/0.35)] to-[rgb(var(--tone))] shadow-[0_0_6px_-1px_rgb(var(--tone)/0.5)]"
          />
        );
      })}
    </div>
  );
}

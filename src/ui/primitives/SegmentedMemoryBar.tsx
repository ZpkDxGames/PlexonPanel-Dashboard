import type { Tone } from "../types";
import { fmtGiB } from "../hooks/useControl";
// Layers are NOT additive: used ⊂ committed, cgroup may exceed committed (metaspace, direct buffers).
// Draw the largest layer first so smaller layers sit on top.
type Layer = {
  key: string;
  label: string;
  bytes: number;
  tone: Tone;
  opacity: number;
};

export function SegmentedMemoryBar({
  used,
  committed,
  cgroup,
  max,
}: {
  used: number;
  committed: number;
  cgroup: number | null;
  max: number;
}) {
  const layers: Layer[] = [
    ...(cgroup != null
      ? [
          {
            key: "cg",
            label: "Systemd cgroup",
            bytes: cgroup,
            tone: "indigo" as Tone,
            opacity: 0.35,
          },
        ]
      : []),
    {
      key: "com",
      label: "Heap committed",
      bytes: committed,
      tone: "violet" as Tone,
      opacity: 0.45,
    },
    {
      key: "use",
      label: "Heap used",
      bytes: used,
      tone: "violet" as Tone,
      opacity: 1,
    },
  ].sort((a, b) => b.bytes - a.bytes);
  const pct = (b: number) => `${Math.min(100, (b / max) * 100)}%`;
  return (
    <div>
      <div className="pp-well relative h-2.5 overflow-hidden rounded-full">
        {layers.map((l) => (
          <i
            key={l.key}
            data-tone={l.tone}
            style={{ width: pct(l.bytes), opacity: l.opacity }}
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[rgb(var(--tone)/0.7)] to-[rgb(var(--tone))] transition-[width] duration-500"
          />
        ))}
        <span className="absolute inset-y-0 right-0 w-px bg-[rgb(var(--line)/.3)]" />
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[rgb(var(--text-3))]">
        {[...layers]
          .sort((a, b) => a.bytes - b.bytes)
          .map((l) => (
            <li
              key={l.key}
              data-tone={l.tone}
              className="flex items-center gap-1.5"
            >
              <i
                className="size-1.5 rounded-full bg-[rgb(var(--tone))]"
                style={{ opacity: l.opacity }}
              />
              {l.label}{" "}
              <b className="num font-medium text-[rgb(var(--text-2))]">
                {fmtGiB(l.bytes)}
              </b>
            </li>
          ))}
        <li className="flex items-center gap-1.5">
          <i className="size-1.5 rounded-full border border-[rgb(var(--line)/.4)]" />
          Max{" "}
          <b className="num font-medium text-[rgb(var(--text-2))]">
            {fmtGiB(max)}
          </b>
        </li>
      </ul>
    </div>
  );
}

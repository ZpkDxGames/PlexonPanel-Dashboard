import type { Tone } from "../types";
import { fmtGiB } from "../hooks/useControl";
export function DualGauge({
  service,
  node,
  nodeBand = "live",
}: {
  service: number | null;
  node: number | null;
  nodeBand?: "live" | "delayed" | "stale";
}) {
  // service is "% of one core" and may exceed 100. Scale the track to whole cores.
  const cores = Math.max(1, Math.ceil((service ?? 0) / 100));
  const full = cores * 100;
  const base = Math.min(service ?? 0, 100),
    burst = Math.max(0, (service ?? 0) - 100);
  return (
    <div className="space-y-2">
      <GaugeRow
        label="Service"
        value={service == null ? "—" : `${service.toFixed(1)}%`}
        tone="indigo"
      >
        <i
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[rgb(var(--tone)/.6)] to-[rgb(var(--tone))]"
          style={{ width: `${(base / full) * 100}%` }}
        />
        {burst > 0 && (
          <i
            className="absolute inset-y-0 rounded-full bg-[repeating-linear-gradient(135deg,rgb(var(--hue-amber)),rgb(var(--hue-amber))_3px,rgb(var(--hue-amber)/.45)_3px,rgb(var(--hue-amber)/.45)_6px)]"
            style={{
              left: `${(100 / full) * 100}%`,
              width: `${(burst / full) * 100}%`,
            }}
          />
        )}
        {cores > 1 &&
          Array.from({ length: cores - 1 }, (_, k) => (
            <b
              key={k}
              className="absolute inset-y-[-2px] w-px bg-[rgb(var(--line)/.4)]"
              style={{ left: `${((k + 1) / cores) * 100}%` }}
            />
          ))}
      </GaugeRow>
      <GaugeRow
        label={`Node${nodeBand === "live" ? "" : ` · ${nodeBand}`}`}
        band={nodeBand}
        value={node == null ? "—" : `${node.toFixed(1)}%`}
        tone="cyan"
      >
        {node != null && (
          <i
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[rgb(var(--tone)/.55)] to-[rgb(var(--tone))]"
            style={{ width: `${Math.min(100, node)}%` }}
          />
        )}
      </GaugeRow>
    </div>
  );
}
function GaugeRow({
  label,
  value,
  tone,
  children,
  band = "live",
}: {
  label: string;
  value: string;
  tone: Tone;
  children: React.ReactNode;
  band?: "live" | "delayed" | "stale";
}) {
  return (
    <div
      data-tone={tone}
      data-stale={band === "stale"}
      className="grid grid-cols-[48px_1fr_44px] items-center gap-2 text-[11px]"
    >
      <span className="text-[rgb(var(--text-3))]">{label}</span>
      <div className="pp-well relative h-2 rounded-full">{children}</div>
      <span className="num text-right font-medium text-[rgb(var(--text-2))]">
        {value}
      </span>
    </div>
  );
}

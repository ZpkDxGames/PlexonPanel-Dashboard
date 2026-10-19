import { useBand } from "../hooks/useControl";
import { FreshnessChip } from "../primitives/FreshnessChip";
import { SourceChip } from "../primitives/SourceChip";
import { usePreferences } from "../../store/preferences";
import type { Row } from "./scales";
export function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: readonly {
    dataKey?: unknown;
    color?: string;
    value?: unknown;
    payload?: Row;
  }[];
  label?: unknown;
}) {
  const p = usePreferences(),
    paperBand = useBand("paperHealth"),
    hostBand = useBand("hostSystem");
  if (!active || !payload?.length) return null;
  const row = payload.find((p) => p.payload)?.payload;
  return (
    <div className="pp-glass p-3 text-xs min-w-48">
      <time className="mono">
        {new Date(Number(label)).toLocaleTimeString(
          undefined,
          p.timezone === "UTC" ? { timeZone: "UTC" } : {},
        )}
      </time>
      <div className="mt-2">
        <FreshnessChip band={row?.source === "Host" ? hostBand : paperBand} />
      </div>
      <ul className="space-y-2 mt-2">
        {payload
          .filter((v) => v.value != null && v.dataKey !== "band")
          .map((v) => (
            <li key={String(v.dataKey)} className="flex justify-between gap-6">
              <span style={{ color: v.color }}>{String(v.dataKey)}</span>
              <strong className="num">
                {String(v.dataKey) === "mspt"
                  ? row?.mspt_raw
                  : typeof v.value === "number"
                    ? v.value.toFixed(1)
                    : String(v.value)}
              </strong>
            </li>
          ))}
      </ul>
      <div className="pp-hairline my-2" />
      <div className="flex justify-between gap-4">
        <span>Boot {row?.epoch ?? "unreported"}</span>
        <SourceChip source={row?.source ?? "Paper"} />
      </div>
    </div>
  );
}

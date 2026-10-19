import { Pill } from "./Pill";
export function FreshnessChip({
  band,
  ageMs,
}: {
  band: "live" | "delayed" | "stale";
  ageMs?: number;
}) {
  return (
    <Pill
      tone={band === "live" ? "emerald" : band === "delayed" ? "amber" : "rose"}
      dot
    >
      {band[0].toUpperCase() + band.slice(1)}
      {ageMs != null && band !== "live"
        ? ` · ${Math.round(ageMs / 1000)}s`
        : ""}
    </Pill>
  );
}

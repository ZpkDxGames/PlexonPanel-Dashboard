import { useCallback } from "react";
import { usePreferences } from "../../store/preferences";
const clocks = [undefined, "UTC"].map(
  (timeZone) =>
    new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone,
    }),
);
export function displayTimestamp(value: unknown, utc = false) {
  const at =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Date.parse(value)
        : NaN;
  return Number.isFinite(at) ? clocks[Number(utc)].format(at) : "Not reported";
}
export function useTimestamp() {
  const { timezone } = usePreferences();
  return useCallback(
    (value: unknown) => displayTimestamp(value, timezone === "UTC"),
    [timezone],
  );
}

import { finite } from "./telemetry";
import { bytes } from "../store/selectors";
export function valueLabel(value: unknown, unit: string) {
  if (!finite(value)) return "—";
  if (unit === "bytes") {
    const b = bytes(value);
    return `${b.value} ${b.unit}`;
  }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`;
}

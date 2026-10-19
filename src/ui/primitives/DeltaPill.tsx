import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Pill } from "./Pill";
import type { Tone } from "../types";
export function DeltaPill({
  value,
  unit = "",
  goodWhen = "down",
  tone,
}: {
  value: number;
  unit?: string;
  goodWhen?: "up" | "down";
  tone?: Tone;
}) {
  const up = value > 0,
    good = up ? goodWhen === "up" : goodWhen === "down",
    Icon = value === 0 ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <Pill tone={tone ?? (value === 0 ? "slate" : good ? "emerald" : "amber")}>
      <Icon size={12} />
      {Math.abs(value).toFixed(1)}
      {unit}
    </Pill>
  );
}

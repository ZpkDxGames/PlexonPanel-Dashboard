import type { ReactNode } from "react";
export function EvidenceValue({
  label,
  value,
  source,
}: {
  label: string;
  value: ReactNode;
  source: string;
}) {
  return (
    <div className="evidence-value">
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
      <small>{source}</small>
    </div>
  );
}

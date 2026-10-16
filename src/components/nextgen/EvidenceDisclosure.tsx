import type { ReactNode } from "react";
export function EvidenceDisclosure({
  label = "Source details",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <details className="evidence-disclosure">
      <summary>{label}</summary>
      {children}
    </details>
  );
}

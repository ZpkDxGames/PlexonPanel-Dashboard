import type { ReactNode } from "react";
export function RecordList({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="record-list" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}

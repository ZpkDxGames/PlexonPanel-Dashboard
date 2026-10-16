import type { ReactNode } from "react";
export function StateBlock({
  title,
  reason,
  children,
}: {
  title: string;
  reason: string;
  children?: ReactNode;
}) {
  return (
    <div className="state-block">
      <strong>{title}</strong>
      <p>{reason}</p>
      {children}
    </div>
  );
}

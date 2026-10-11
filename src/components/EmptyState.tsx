import { useId, type ReactNode } from "react";

export function EmptyState({ eyebrow, title, children, action }: { eyebrow: string; title: string; children: ReactNode; action?: ReactNode }) {
  const titleId = useId();
  return <section className="empty-state" aria-labelledby={titleId}>
    <span className="eyebrow">{eyebrow}</span>
    <h2 id={titleId}>{title}</h2>
    <p>{children}</p>
    {action && <div className="empty-actions">{action}</div>}
  </section>;
}

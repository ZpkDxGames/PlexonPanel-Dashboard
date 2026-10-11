import type { ReactNode } from "react";

export function EmptyState({ eyebrow, title, children, action }: { eyebrow: string; title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="empty-state" aria-labelledby="empty-title">
    <span className="eyebrow">{eyebrow}</span>
    <h2 id="empty-title">{title}</h2>
    <p>{children}</p>
    {action && <div className="empty-actions">{action}</div>}
  </section>;
}

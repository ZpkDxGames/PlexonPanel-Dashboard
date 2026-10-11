import { useId, type ButtonHTMLAttributes, type ReactNode } from "react";

export function Panel({ title, eyebrow, action, children, className = "" }: { title?: string; eyebrow?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  const headingId = useId();
  return <section className={`panel ${className}`} aria-labelledby={title ? headingId : undefined}>
    {(title || eyebrow || action) && <header className="panel-header"><div className="panel-heading-copy">{eyebrow && <span className="eyebrow">{eyebrow}</span>}{title && <h2 id={headingId}>{title}</h2>}</div>{action && <div className="panel-header-action">{action}</div>}</header>}
    {children}
  </section>;
}

export function Button({ variant = "secondary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "quiet" }) {
  return <button {...props} className={`button ${variant} ${props.className ?? ""}`} />;
}

export function Status({ tone = "neutral", children }: { tone?: "neutral" | "success" | "warning" | "error" | "info"; children: ReactNode }) {
  return <span className={`status ${tone}`}><i aria-hidden="true" />{children}</span>;
}

export function Notice({ tone = "neutral", title, children }: { tone?: "neutral" | "warning" | "error" | "success"; title: string; children: ReactNode }) {
  return <div className={`notice ${tone}`} role={tone === "error" ? "alert" : "status"}><strong>{title}</strong><span>{children}</span></div>;
}

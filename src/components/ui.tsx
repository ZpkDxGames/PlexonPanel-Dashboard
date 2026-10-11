import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Panel({ title, eyebrow, action, children, className = "" }: { title?: string; eyebrow?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>
    {(title || eyebrow || action) && <header className="panel-header"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}{title && <h2>{title}</h2>}</div>{action}</header>}
    {children}
  </section>;
}

export function Button({ variant = "secondary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "quiet" }) {
  return <button {...props} className={`button ${variant} ${props.className ?? ""}`} />;
}

export function Status({ tone = "neutral", children }: { tone?: "neutral" | "success" | "warning" | "error" | "info"; children: ReactNode }) {
  return <span className={`status ${tone}`}><i />{children}</span>;
}

export function Notice({ tone = "neutral", title, children }: { tone?: "neutral" | "warning" | "error" | "success"; title: string; children: ReactNode }) {
  return <div className={`notice ${tone}`}><strong>{title}</strong><span>{children}</span></div>;
}

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";
export function Panel({
  title,
  eyebrow,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || eyebrow || action) && (
        <header className="panel-header">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
          {action && <div className="panel-header-action">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
export function Button({
  variant = "secondary",
  loading = false,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "quiet";
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`button ${variant} ${props.className ?? ""}`}
    >
      <span className="button-label">{children}</span>
      {loading && <span className="button-spinner" aria-hidden="true" />}
    </button>
  );
}
export function Status({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "warning" | "error" | "info";
  children: ReactNode;
}) {
  return (
    <span className={`status ${tone}`}>
      <i />
      {children}
    </span>
  );
}
export function Notice({
  tone = "neutral",
  title,
  children,
}: {
  tone?: "neutral" | "warning" | "error" | "success";
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`notice ${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon
        name={
          tone === "error" || tone === "warning"
            ? "alert"
            : tone === "success"
              ? "check"
              : "access"
        }
      />
      <div>
        <strong>{title}</strong>
        <span>{children}</span>
      </div>
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="inline-empty">
      <Icon name="server" />
      <strong>{title}</strong>
      <span>{children}</span>
    </div>
  );
}

import type { ReactNode } from "react";
export function Title({
  code,
  title,
  detail,
  actions,
}: {
  code: string;
  title: string;
  detail: string;
  actions?: ReactNode;
}) {
  return (
    <div className="pp-title">
      <div>
        <small className="pp-kicker">{code}</small>
        <h1>{title}</h1>
        <p className="muted" style={{ fontSize: 12, marginTop: 5 }}>
          {detail}
        </p>
      </div>
      {actions}
    </div>
  );
}
export function Pane({
  title,
  children,
  actions,
  className = "",
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`pp-pane ${className}`}>
      <header className="pp-pane__head">
        <h2>{title}</h2>
        <div className="row push">{actions}</div>
      </header>
      {children}
    </section>
  );
}
export function QueryState({
  query,
}: {
  query: { loading: boolean; error: string };
}) {
  return query.loading ? (
    <div className="pad muted" role="status">
      Requesting current evidence…
    </div>
  ) : query.error ? (
    <div className="pad muted" role="status">
      {query.error}
    </div>
  ) : null;
}
export function Table({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      className="pp-table-wrap pp-well"
      tabIndex={0}
      role="region"
      aria-label={label}
    >
      <table className="pp-table">{children}</table>
    </div>
  );
}

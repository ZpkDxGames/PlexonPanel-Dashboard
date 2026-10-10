"use client";

import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type CSSProperties } from "react";
import { Icon, type IconName } from "./icons";

export { Icon } from "./icons";
export type Tone = "ok" | "warn" | "critical" | "info" | "unknown";
const toneIcon: Record<Tone, IconName> = { ok: "check", warn: "warning", critical: "failure", info: "info", unknown: "unknown" };
const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

export function Button({ variant = "secondary", busy = false, icon, children, className, disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "quiet" | "danger"; busy?: boolean; icon?: IconName }) {
  return <button {...props} type={props.type ?? "button"} className={cx("pp-button", `pp-button-${variant}`, className)} disabled={disabled || busy} aria-busy={busy || undefined}>
    {busy ? <span className="pp-busy" aria-hidden="true" /> : icon ? <Icon name={icon} /> : null}{children}
  </button>;
}
export function Panel({ title, children, actions, className }: { title?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  const id = useId();
  return <section className={cx("pp-panel", className)} aria-labelledby={title ? id : undefined}>
    {title && <header className="pp-panel-heading"><h3 id={id}>{title}</h3>{actions}</header>}{children}
  </section>;
}
export function Badge({ tone = "unknown", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`pp-badge pp-tone-${tone}`}><Icon name={toneIcon[tone]} size="small" />{children}</span>;
}
export function Field({ label, hint, error, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const generated = useId(); const fieldId = id ?? generated;
  const mode = props.disabled ? "Unavailable" : props.readOnly ? "Read only" : undefined;
  return <div className="pp-field" data-mode={props.disabled ? "disabled" : props.readOnly ? "readonly" : undefined}><label htmlFor={fieldId}>{label}{props.required && <span className="pp-muted"> (required)</span>}</label>
    {mode && <span id={`${fieldId}-mode`} className="pp-field-mode">{mode}</span>}
    <input {...props} id={fieldId} aria-invalid={Boolean(error) || undefined} aria-describedby={cx(mode && `${fieldId}-mode`, hint && `${fieldId}-hint`, error && `${fieldId}-error`, props["aria-describedby"]) || undefined} />
    {hint && <p id={`${fieldId}-hint`} className="pp-field-hint">{hint}</p>}{error && <p id={`${fieldId}-error`} className="pp-field-error"><Icon name="failure" size="small" />{error}</p>}
  </div>;
}

// Native popover supplies top-layer placement and makes closed content inert.
// Select/Menu keep their own keyboard semantics; no document-level focus polling.
function Floating({ label, children, role, disabled = false, readOnly = false, invalid = false, hintId, className, triggerIcon = "chevron", accessibleLabel, onOpen }: {
  label: ReactNode; children: ReactNode; role?: "listbox" | "menu"; disabled?: boolean; readOnly?: boolean; invalid?: boolean; hintId?: string; className?: string; triggerIcon?: IconName;
  accessibleLabel?: string; onOpen?: (container: HTMLDivElement) => void;
}) {
  const id = useId(); const trigger = useRef<HTMLButtonElement>(null); const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false); const [position, setPosition] = useState<CSSProperties>({});
  const close = () => { popup.current?.hidePopover(); trigger.current?.focus(); };
  function place() {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ "--pp-anchor-left": `${rect.left}px`, "--pp-anchor-top": `${rect.bottom}px`, "--pp-anchor-width": `${rect.width}px`, "--pp-anchor-room": `${Math.max(44, window.innerHeight - rect.bottom - 16)}px` } as CSSProperties);
  }
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);
  return <span className={cx("pp-floating-owner", className)}>
    <button type="button" className="pp-button pp-button-secondary pp-floating-trigger" ref={trigger} role={role === "listbox" ? "combobox" : undefined} disabled={disabled} aria-readonly={readOnly || undefined} aria-label={accessibleLabel} aria-haspopup={role ?? "dialog"} aria-expanded={open} aria-controls={id} aria-invalid={invalid || undefined} aria-describedby={hintId} onClick={() => { if (readOnly) return; place(); popup.current?.togglePopover(); }} onKeyDown={(event) => {
      if (!readOnly && role && (event.key === "ArrowDown" || event.key === "ArrowUp")) { event.preventDefault(); place(); popup.current?.showPopover(); }
    }}>{label}<Icon name={triggerIcon} size="small" /></button>
    <div id={id} ref={popup} popover="auto" className={cx("pp-floating", className && `${className}-popup`)} role={role} aria-label={typeof label === "string" ? label : undefined} style={position} onToggle={(event) => {
      const next = event.newState === "open"; setOpen(next); if (next) onOpen?.(event.currentTarget);
    }} onClick={event => { if ((event.target as HTMLElement).closest("[data-pp-dismiss]")) close(); }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); } else if (role && event.key === "Tab") close(); }}>
      {children}
    </div>
  </span>;
}

export type SelectOption = { value: string; label: string; disabled?: boolean };
export function Select({ label, options, value, onChange, disabled = false, readOnly = false, error, hint }: { label: string; options: readonly SelectOption[]; value: string; onChange: (value: string) => void; disabled?: boolean; readOnly?: boolean; error?: string; hint?: string }) {
  const id = useId(); const [active, setActive] = useState(value); const query = useRef({ text: "", time: 0 });
  const unavailable = disabled || options.length === 0;
  const mode = unavailable ? "Unavailable" : readOnly ? "Read only" : undefined;
  const move = (key: string, container: HTMLElement, now: number) => {
    const enabled = options.filter(o => !o.disabled); if (!enabled.length) return;
    let i = Math.max(0, enabled.findIndex(o => o.value === active));
    if (key === "ArrowDown") i = (i + 1) % enabled.length;
    if (key === "ArrowUp") i = (i + enabled.length - 1) % enabled.length;
    if (key === "Home") i = 0; if (key === "End") i = enabled.length - 1;
    if (key.length === 1 && key !== " ") {
      query.current.text = now - query.current.time > 700 ? key : query.current.text + key; query.current.time = now;
      const found = enabled.findIndex(o => o.label.toLocaleLowerCase().startsWith(query.current.text.toLocaleLowerCase()));
      if (found < 0) return; i = found;
    }
    setActive(enabled[i].value); container.querySelectorAll<HTMLElement>('[role="option"]:not(:disabled)')[i]?.focus();
  };
  return <div className="pp-field" data-mode={unavailable ? "disabled" : readOnly ? "readonly" : undefined}><span id={`${id}-label`}>{label}</span>
    {mode && <span id={`${id}-mode`} className="pp-field-mode">{mode}</span>}
    <Floating label={<span>{options.find(o => o.value === value)?.label ?? "Choose…"}<span className="pp-sr-only"> — {label}</span></span>} accessibleLabel={`${options.find(o => o.value === value)?.label ?? "Choose…"} — ${label}`} role="listbox" disabled={unavailable} readOnly={readOnly} invalid={Boolean(error)} hintId={cx(mode && `${id}-mode`, hint && `${id}-hint`, error && `${id}-error`) || undefined} className="pp-select" onOpen={container => {
      const initial = options.find(o => o.value === value && !o.disabled) ?? options.find(o => !o.disabled);
      if (initial) { setActive(initial.value); container.querySelector<HTMLElement>(`[data-value="${CSS.escape(initial.value)}"]`)?.focus(); }
      container.setAttribute("aria-labelledby", `${id}-label`);
    }}>
      {options.map(option => <button data-pp-dismiss type="button" key={option.value} data-value={option.value} role="option" aria-selected={value === option.value} disabled={option.disabled} tabIndex={option.value === active ? 0 : -1} className="pp-option" onClick={() => onChange(option.value)} onKeyDown={event => {
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || (event.key.length === 1 && event.key !== " ")) {
          event.preventDefault(); move(event.key, event.currentTarget.parentElement!, event.timeStamp);
        }
      }}><span>{option.label}</span>{value === option.value && <Icon name="check" size="small" />}</button>)}
    </Floating>
    {hint && <p id={`${id}-hint`} className="pp-field-hint">{hint}</p>}{error && <p id={`${id}-error`} className="pp-field-error"><Icon name="failure" size="small" />{error}</p>}
  </div>;
}
export function Popover({ label, accessibleLabel, title, children, disabled }: { label: ReactNode; accessibleLabel?: string; title: string; children: ReactNode; disabled?: boolean }) {
  const id = useId();
  return <Floating label={label} accessibleLabel={accessibleLabel} disabled={disabled} onOpen={container => { container.setAttribute("role", "dialog"); container.setAttribute("aria-labelledby", id); container.querySelector<HTMLElement>("button")?.focus(); }}>
    <div className="pp-stack"><h3 id={id}>{title}</h3>{children}<Button variant="quiet" data-pp-dismiss>Close</Button></div>
  </Floating>;
}
export type MenuItem = { label: string; icon?: IconName; disabled?: boolean; onSelect: () => void };
export function Menu({ label, items, disabled }: { label: string; items: readonly MenuItem[]; disabled?: boolean }) {
  const [active, setActive] = useState(0); const query = useRef({ text: "", time: 0 });
  return <Floating label={label} role="menu" disabled={disabled} triggerIcon="more" onOpen={container => { const i = items.findIndex(item => !item.disabled); setActive(i); container.querySelectorAll<HTMLElement>('[role="menuitem"]')[i]?.focus(); }}>
    {items.map((item, index) => <button data-pp-dismiss key={item.label} type="button" role="menuitem" disabled={item.disabled} tabIndex={index === active ? 0 : -1} className="pp-option" onClick={item.onSelect} onKeyDown={event => {
      const enabled = items.map((item, i) => item.disabled ? -1 : i).filter(i => i >= 0);
      let next = enabled.indexOf(index);
      if (event.key === "ArrowDown") next = (next + 1) % enabled.length;
      else if (event.key === "ArrowUp") next = (next + enabled.length - 1) % enabled.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = enabled.length - 1;
      else if (event.key.length === 1 && event.key !== " ") {
        const now = performance.now(); query.current.text = now - query.current.time > 700 ? event.key : query.current.text + event.key; query.current.time = now;
        next = enabled.findIndex(i => items[i].label.toLocaleLowerCase().startsWith(query.current.text.toLocaleLowerCase())); if (next < 0) return;
      } else return;
      event.preventDefault(); setActive(enabled[next]); event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="menuitem"]')[enabled[next]]?.focus();
    }}>{item.icon && <Icon name={item.icon} size="small" />}{item.label}</button>)}
  </Floating>;
}

export function Dialog({ open, onClose, title, description, children, actions, className, returnFocusElement }: { returnFocusElement?: HTMLElement; open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  const id = useId(); const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current; if (!dialog || !open) return;
    const previous = returnFocusElement ?? document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      let attempts=0;
      const restore=()=>{if(!previous?.isConnected)return;const activeDialog=document.querySelector('dialog[open]');if(activeDialog&&!activeDialog.contains(previous))return;if(previous.matches(':disabled')&&attempts++<20){setTimeout(restore,16);return;}previous.focus();};
      restore();
    };
  }, [open, returnFocusElement]);
  return <dialog ref={ref} className={cx("pp-dialog deepslate", className)} aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined} onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => {
    if (event.key !== "Tab" || event.defaultPrevented) return;
    const targets = [...event.currentTarget.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')].filter(el => el.tabIndex >= 0 && !el.matches(":disabled") && el.getClientRects().length > 0);
    const first = targets[0]; const last = targets.at(-1);
    if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault(); (event.shiftKey ? last : first)?.focus();
    }
  }} onClick={event => {
    if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); }
  }}>
    <header className="pp-panel-heading"><h2 id={`${id}-title`}>{title}</h2><Button variant="quiet" icon="close" aria-label={`Close ${title}`} onClick={onClose} /></header>
    {description && <p id={`${id}-description`} className="pp-muted">{description}</p>}<div className="pp-stack">{children}</div>{actions && <footer className="pp-row">{actions}</footer>}
  </dialog>;
}

export type TabItem = { id: string; label: string; content: ReactNode; disabled?: boolean };
export function Tabs({ label, tabs, value, onChange }: { label: string; tabs: readonly TabItem[]; value: string; onChange: (id: string) => void }) {
  const id = useId();
  return <div className="pp-tabs"><div role="tablist" aria-label={label} className="pp-tablist">{tabs.map(tab => <button type="button" key={tab.id} role="tab" id={`${id}-tab-${tab.id}`} aria-controls={`${id}-panel-${tab.id}`} aria-selected={value === tab.id} tabIndex={value === tab.id ? 0 : -1} disabled={tab.disabled} className="pp-tab" onClick={() => onChange(tab.id)} onKeyDown={event => {
    const enabled = tabs.filter(t => !t.disabled); let i = enabled.findIndex(t => t.id === tab.id);
    if (event.key === "ArrowRight") i = (i + 1) % enabled.length;
    else if (event.key === "ArrowLeft") i = (i + enabled.length - 1) % enabled.length;
    else if (event.key === "Home") i = 0; else if (event.key === "End") i = enabled.length - 1; else return;
    event.preventDefault(); document.getElementById(`${id}-tab-${enabled[i].id}`)?.focus();
  }}>{tab.label}</button>)}</div>
    {tabs.map(tab => <div key={tab.id} role="tabpanel" id={`${id}-panel-${tab.id}`} aria-labelledby={`${id}-tab-${tab.id}`} hidden={tab.id !== value} tabIndex={0} className="pp-tabpanel">{tab.content}</div>)}
  </div>;
}
export type TableColumn<Row> = { key: string; label: string; render: (row: Row) => ReactNode; rowHeader?: boolean };
export function Table<Row>({ caption, columns, rows, rowKey, rowClassName, empty, loading = false }: { caption: string; columns: readonly TableColumn<Row>[]; rows: readonly Row[]; rowKey: (row: Row) => string; rowClassName?: (row:Row)=>string|undefined; empty?: ReactNode; loading?: boolean }) {
  return <div className="pp-table-scroll" data-cards={columns.length>3} role="region" aria-label={caption} tabIndex={0} aria-busy={loading || undefined}><table className="pp-table"><caption>{caption}</caption><thead><tr>{columns.map(col => <th key={col.key} scope="col">{col.label}</th>)}</tr></thead><tbody>
    {rows.map(row => <tr key={rowKey(row)} className={rowClassName?.(row)}>{columns.map(col => col.rowHeader ? <th key={col.key} data-label={col.label} scope="row">{col.render(row)}</th> : <td key={col.key} data-label={col.label}>{col.render(row)}</td>)}</tr>)}
    {!rows.length && <tr><td colSpan={columns.length}>{loading ? <Skeleton label="Loading table" /> : empty ?? "No rows supplied."}</td></tr>}
  </tbody></table></div>;
}
export function Toast({ tone = "info", children, onDismiss }: { tone?: Tone; children: ReactNode; onDismiss?: () => void }) {
  const label = { ok: "Success", warn: "Warning", critical: "Failed", info: "Information", unknown: "Unknown" }[tone];
  return <div className={`pp-toast pp-tone-${tone}`} role={tone === "critical" ? "alert" : "status"}><Icon name={toneIcon[tone]} /><div><strong>{label}: </strong>{children}</div>{onDismiss && <Button variant="quiet" icon="close" aria-label="Dismiss notification" onClick={onDismiss} />}</div>;
}
export function Skeleton({ label = "Loading", lines = 3 }: { label?: string; lines?: number }) {
  return <div className="pp-skeleton" role="status"><span className="pp-sr-only">{label}</span>{Array.from({ length: Math.min(10, Math.max(1, lines)) }, (_, i) => <span key={i} aria-hidden="true" />)}</div>;
}
export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="pp-empty pp-stack"><h3>{title}</h3><p className="pp-muted">{children}</p>{action && <div>{action}</div>}</div>;
}
export function Disclosure({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return <details className="pp-disclosure" open={defaultOpen || undefined}><summary>{title}</summary><div className="pp-stack">{children}</div></details>;
}

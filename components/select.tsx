"use client";

import { Children, Fragment, isValidElement, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./select.module.css";

type Option = { value: string; label: ReactNode; text: string; disabled: boolean };
type OptionProps = { value?: string | number; children?: ReactNode; disabled?: boolean };
function textContent(value: ReactNode): string {
  return Children.toArray(value).map(child => isValidElement<OptionProps>(child)
    ? textContent(child.props.children) : String(child)).join("");
}
function optionsFrom(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<OptionProps>(child)) return [];
    if (child.type === Fragment) return optionsFrom(child.props.children);
    if (child.type !== "option") return [];
    const text = textContent(child.props.children);
    return [{ value: String(child.props.value ?? text), label: child.props.children, text, disabled: Boolean(child.props.disabled) }];
  });
}

/** Single-select listbox. All input paths share the same controlled value callback. */
export function Select({ value, children, onValueChange, disabled = false, className = "", id, name, title,
  "aria-label": label, "aria-labelledby": labelledBy, "aria-describedby": describedBy,
}: { value?: string | number; children: ReactNode; onValueChange: (value: string) => void; disabled?: boolean;
  className?: string; id?: string; name?: string; title?: string; "aria-label"?: string;
  "aria-labelledby"?: string; "aria-describedby"?: string }) {
  const listId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef({ text: "", at: 0 });
  const [popup, setPopup] = useState<{ left: number; top: number; width: number; height: number; above: boolean; parent: Element } | null>(null);
  const [activeValue, setActiveValue] = useState("");
  const options = optionsFrom(children);
  const selected = options.find(option => option.value === String(value));
  const enabled = options.filter(option => !option.disabled);
  const active = enabled.find(option => option.value === activeValue) ?? enabled.find(option => option.value === String(value)) ?? enabled[0];
  const activeIndex = options.indexOf(active);
  const open = Boolean(popup) && !disabled && enabled.length > 0;
  const close = () => setPopup(null);
  const choose = (option: Option) => {
    if (disabled || option.disabled) return;
    close();
    trigger.current?.focus();
    if (option.value !== String(value)) onValueChange(option.value);
  };
  const show = (option = enabled.find(item => item.value === String(value)) ?? enabled[0]) => {
    if (disabled || !option || !trigger.current) return;
    const rect = trigger.current.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 180), window.innerWidth - 16);
    const below = window.innerHeight - rect.bottom - 12;
    const above = below < 160 && rect.top > below;
    setActiveValue(option.value);
    setPopup({ left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      top: above ? rect.top - 6 : rect.bottom + 6, width,
      height: Math.max(64, Math.min(320, above ? rect.top - 16 : below)), above,
      parent: trigger.current.closest("dialog") ?? document.body });
  };
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !menu.current?.contains(target)) setPopup(null);
    };
    const reposition = (event: Event) => {
      if (!(event.target instanceof Node) || !menu.current?.contains(event.target)) setPopup(null);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);
  useEffect(() => {
    if (open) menu.current?.querySelector('[data-active="true"]')?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeValue]);

  return <>
    <button ref={trigger} id={id} type="button" role="combobox" aria-haspopup="listbox"
      aria-expanded={open} aria-controls={open ? listId : undefined}
      aria-activedescendant={open && active ? `${listId}-${activeIndex}` : undefined}
      aria-label={label} aria-labelledby={labelledBy} aria-describedby={describedBy} title={title}
      disabled={disabled || enabled.length === 0} className={`${styles.trigger} ${className}`}
      onClick={event => { event.preventDefault(); if (open) close(); else show(); }}
      onBlur={() => close()}
      onKeyDown={event => {
        const key = event.key;
        if (key === "Tab") { close(); return; }
        if (key === "Escape") { if (open) { event.preventDefault(); event.stopPropagation(); close(); } return; }
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(key)) {
          event.preventDefault();
          const index = enabled.indexOf(active);
          const next = key === "Home" ? enabled[0] : key === "End" ? enabled.at(-1)
            : !open ? (key === "ArrowUp" ? enabled.at(-1) : enabled.find(item => item.value === String(value)) ?? enabled[0])
            : enabled[(index + (key === "ArrowDown" ? 1 : -1) + enabled.length) % enabled.length];
          if (next) { if (open) setActiveValue(next.value); else show(next); }
        } else if (key === "Enter" || key === " ") {
          event.preventDefault();
          if (open && active) choose(active); else show();
        } else if (key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          const now = event.timeStamp;
          const term = (now - search.current.at < 700 ? search.current.text : "") + key.toLowerCase();
          search.current = { text: term, at: now };
          const matching = enabled.find(option => option.text.toLowerCase().startsWith(term))
            ?? enabled.find(option => option.text.toLowerCase().startsWith(key.toLowerCase()));
          if (matching) { if (open) setActiveValue(matching.value); else show(matching); }
        }
      }}>
      <span>{selected?.label ?? "Choose an option"}</span>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    {name && <input type="hidden" name={name} value={value ?? ""} disabled={disabled} />}
    {open && popup && createPortal(
      <div ref={menu} id={listId} role="listbox" aria-label={label} aria-labelledby={labelledBy ?? id}
        className={styles.menu} style={{ position: "fixed", left: popup.left, top: popup.top,
          width: popup.width, maxHeight: popup.height, transform: popup.above ? "translateY(-100%)" : undefined }}>
        {options.map((option, index) => <div key={option.value} id={`${listId}-${index}`} role="option" data-value={option.value}
          aria-selected={option.value === String(value)} aria-disabled={option.disabled || undefined}
          data-active={active?.value === option.value} className={styles.option}
          onPointerMove={() => { if (!option.disabled) setActiveValue(option.value); }}
          onMouseDown={event => event.preventDefault()}
          onClick={event => { event.preventDefault(); event.stopPropagation(); choose(option); }}>
          <span>{option.label}</span><span aria-hidden="true">{option.value === String(value) ? "✓" : ""}</span>
        </div>)}
      </div>, popup.parent)}
  </>;
}

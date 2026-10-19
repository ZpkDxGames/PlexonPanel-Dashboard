"use client";
import { useId, useRef, useState, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown } from "lucide-react";
export type SelectOption = {
  value: string;
  label: string;
  leading?: ReactNode;
};
export function PpSelect({
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  ariaLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false),
    id = useId(),
    menu = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    cursor = useRef(0),
    selected = options.find((o) => o.value === value);
  function focus(index: number) {
    cursor.current = Math.max(0, Math.min(options.length - 1, index));
    menu.current
      ?.querySelectorAll<HTMLButtonElement>('[role="option"]')
      [cursor.current]?.focus();
  }
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          ref={trigger}
          type="button"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? id : undefined}
          className={`pp-ctl pp-select-trigger ${className}`}
          onKeyDown={(e) => {
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
              e.preventDefault();
              cursor.current =
                e.key === "End" || e.key === "ArrowUp" ? options.length - 1 : 0;
              setOpen(true);
            }
          }}
        >
          <span className="row">
            {selected?.leading}
            {selected?.label ?? value}
          </span>
          <ChevronDown size={13} data-open={open} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <div role="region" aria-label={`${ariaLabel} options`}>
          <Popover.Content
            ref={menu}
            id={id}
            role="listbox"
            aria-label={ariaLabel}
            className="pp-glass pp-select-menu"
            align="start"
            sideOffset={5}
            collisionPadding={12}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              focus(
                Math.max(
                  0,
                  options.findIndex((o) => o.value === value),
                ),
              );
            }}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              trigger.current?.focus();
            }}
            onKeyDown={(e) => {
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                focus(
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? options.length - 1
                      : (cursor.current +
                          (e.key === "ArrowDown" ? 1 : -1) +
                          options.length) %
                        options.length,
                );
              }
            }}
          >
            {options.map((o, i) => (
              <button
                type="button"
                role="option"
                aria-selected={value === o.value}
                tabIndex={-1}
                className="pp-select-item"
                key={o.value}
                onFocus={() => {
                  cursor.current = i;
                }}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <span className="row">
                  {o.leading}
                  {o.label}
                </span>
                {value === o.value && <Check size={12} />}
              </button>
            ))}
          </Popover.Content>
        </div>
      </Popover.Portal>
    </Popover.Root>
  );
}

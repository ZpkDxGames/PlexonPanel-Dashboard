import { copy } from "../i18n/en";
import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
  type ChangeEvent,
} from "react";
import { Icon } from "./Icon";
function options(
  children: ReactNode,
): { value: string; label: ReactNode; disabled: boolean }[] {
  return Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<{
        value?: string;
        children?: ReactNode;
        disabled?: boolean;
      }>(child)
    )
      return [];
    if (child.type === Fragment) return options(child.props.children);
    return [
      {
        value: String(child.props.value ?? child.props.children),
        label: child.props.children,
        disabled: !!child.props.disabled,
      },
    ];
  });
}
/** Button/listbox replaces OS styling, with arrows, typeahead and focus restoration. */
export function Select({
  children,
  value,
  onChange,
  disabled,
  "aria-label": label,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const items = options(children),
    selected = items.findIndex((o) => o.value === String(value));
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(Math.max(0, selected));
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const choose = (i: number) => {
    if (!items[i] || items[i].disabled) return;
    onChange?.({
      target: { value: items[i].value },
      currentTarget: { value: items[i].value },
    } as ChangeEvent<HTMLSelectElement>);
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <div className="custom-select" ref={root}>
      <button
        ref={trigger}
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        disabled={disabled}
        onClick={() => {
          setActive(Math.max(0, selected));
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
          } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            setOpen(true);
            setActive((i) =>
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? items.length - 1
                  : Math.max(
                      0,
                      Math.min(
                        items.length - 1,
                        i + (e.key === "ArrowDown" ? 1 : -1),
                      ),
                    ),
            );
          } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open ? choose(active) : setOpen(true);
          } else if (e.key === "Tab") setOpen(false);
          else if (e.key.length === 1) {
            const n = items.findIndex((o) =>
              String(o.label).toLowerCase().startsWith(e.key.toLowerCase()),
            );
            if (n >= 0) {
              setActive(n);
              setOpen(true);
            }
          }
        }}
      >
        <span>{items[selected]?.label ?? "Choose an option"}</span>
        <Icon name="chevron" />
      </button>
      {open && (
        <div
          id={id}
          role="listbox"
          className="select-options"
          aria-label={label ?? "Options"}
        >
          {items.map((o, i) => (
            <div
              id={`${id}-${i}`}
              key={o.value}
              role="option"
              aria-selected={selected === i}
              aria-disabled={o.disabled || undefined}
              className={i === active ? "focused" : ""}
              onPointerMove={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
            >
              {o.label}
              {selected === i && (
                <span aria-hidden="true">{copy.refine_698a8799}</span>
              )}
            </div>
          ))}
        </div>
      )}
      <select
        {...props}
        value={value}
        disabled={disabled}
        onChange={onChange}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      >
        {children}
      </select>
    </div>
  );
}

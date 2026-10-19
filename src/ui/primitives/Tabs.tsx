import { useId } from "react";
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  items: readonly { id: T; label: string }[];
  label: string;
}) {
  const id = useId();
  return (
    <div className="pp-tabs" role="tablist" aria-label={label}>
      {items.map((item, i) => (
        <button
          key={item.id}
          id={`${id}-${item.id}`}
          type="button"
          role="tab"
          tabIndex={value === item.id ? 0 : -1}
          aria-selected={value === item.id}
          data-state={value === item.id ? "active" : "inactive"}
          onClick={() => onChange(item.id)}
          onKeyDown={(e) => {
            if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) {
              e.preventDefault();
              const index =
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? items.length - 1
                    : (i + (e.key === "ArrowRight" ? 1 : -1) + items.length) %
                      items.length;
              onChange(items[index].id);
              const parent = e.currentTarget.parentElement;
              (parent?.children[index] as HTMLElement)?.focus();
            }
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

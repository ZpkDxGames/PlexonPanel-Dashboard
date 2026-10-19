import { useId, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronsUpDown, Check } from "lucide-react";
export function PreferenceSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    id = useId();
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className="btn"
        role="combobox"
        aria-label={label}
        aria-controls={id}
        aria-expanded={open}
      >
        {value}
        <ChevronsUpDown size={14} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="pp-glass p-2 z-100 min-w-48" sideOffset={6}>
          <input
            className="field w-full mb-2"
            aria-label={`Search ${label}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
          />
          <div role="listbox" id={id} aria-label={label}>
            {options
              .filter((v) => v.toLowerCase().includes(search.toLowerCase()))
              .map((v) => (
                <button
                  key={v}
                  className="nav-link w-full"
                  role="option"
                  aria-selected={v === value}
                  onClick={() => {
                    onChange(v);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  {v}
                  {v === value && <Check size={14} />}
                </button>
              ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

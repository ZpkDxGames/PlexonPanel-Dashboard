import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ROUTES } from "./routes";
import { useServers, session } from "../bindings";
import { useReview } from "../primitives/ReviewProvider";
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter(),
    servers = useServers(),
    review = useReview(),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState(0);
  const all = [
      ...ROUTES.map((r) => ({
        id: r.href,
        label: r.label,
        detail: `G ${r.key}`,
        run: () => router.push(r.href),
      })),
      ...servers.map((s) => ({
        id: s.id,
        label: s.name,
        detail: "Instance",
        run: () => {
          if (!s.selected) void session.select(s.id);
          router.push("/overview");
        },
      })),
      ...[
        { action: "backup.create", label: "Quick Backup" },
        { action: "maintenance.restart.now", label: "Restart server" },
        { action: "server.stop", label: "Stop server" },
      ]
        .filter((a) => !session.reason(a.action, "HOST"))
        .map((a) => ({
          id: a.action,
          label: a.label,
          detail: "Review action",
          run: () =>
            void review(
              a.action,
              a.action === "backup.create" ? { countdownSeconds: 300, destinationMode: "AUTO" } : {},
            ),
        })),
    ],
    items = all.filter((i) =>
      i.label.toLowerCase().includes(query.toLowerCase()),
    );
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="pp-overlay" />
        <Dialog.Content className="pp-glass pp-modal pp-palette">
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search routes, instances and available actions.
          </Dialog.Description>
          <input
            autoFocus
            aria-label="Search commands"
            placeholder="Jump to a workspace, instance or action…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelected((i) => (i + 1) % Math.max(1, items.length));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelected(
                  (i) => (i - 1 + items.length) % Math.max(1, items.length),
                );
              }
              if (e.key === "Enter") {
                items[selected]?.run();
                onOpenChange(false);
              }
            }}
          />
          <div
            className="pp-palette-list"
            role="listbox"
            aria-label="Matching commands"
          >
            {items.map((item, i) => (
              <button
                key={item.id}
                role="option"
                aria-selected={selected === i}
                onMouseEnter={() => setSelected(i)}
                onClick={() => {
                  item.run();
                  onOpenChange(false);
                }}
              >
                <span className="grow">{item.label}</span>
                <kbd className="pp-kbd">{item.detail}</kbd>
              </button>
            ))}
            {!items.length && (
              <div className="pp-empty">No matching commands</div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

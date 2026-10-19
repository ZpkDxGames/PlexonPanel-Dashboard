import { useEffect, useState } from "react";
import Link from "next/link";
import * as Popover from "@radix-ui/react-popover";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, Search, Sun, Moon, X, ChevronRight } from "lucide-react";
import { preferences, usePreferences } from "../../store/preferences";
import { useSource } from "../hooks/useControl";
import { FreshnessChip } from "../primitives/FreshnessChip";
import { navigation } from "./Sidebar";
import { Kbd } from "../primitives/Kbd";
export function TopBar({
  route,
  onMenu,
}: {
  route: string;
  onMenu: () => void;
}) {
  const prefs = usePreferences(),
    paper = useSource("paperHealth"),
    host = useSource("hostSystem"),
    [open, set] = useState(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        set((v) => !v);
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  return (
    <header className="topbar pp-shell">
      <div className="flex gap-3 items-center">
        <button
          className="icon-btn mobile-only"
          aria-label="Open navigation"
          onClick={onMenu}
        >
          <Menu size={18} />
        </button>
        <span className="breadcrumbs">
          Workspace <ChevronRight size={12} />
          <strong>
            {navigation.find((n) => n.id === route)?.label ?? route}
          </strong>
        </span>
      </div>
      <div className="flex gap-3 items-center">
        <Popover.Root>
          <Popover.Trigger className="source-status" aria-label="Source status">
            <span
              data-tone={
                paper.kind === "live" && host.kind === "live"
                  ? "emerald"
                  : "amber"
              }
              className="signal-dot"
            />
            <span>
              {paper.kind === "live" && host.kind === "live"
                ? "All sources live"
                : "Source status"}
            </span>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content className="pp-glass p-4 space-y-3" sideOffset={12}>
              {[
                ["Paper", paper],
                ["Host", host],
              ].map(([label, e]) => (
                <div className="flex gap-3" key={String(label)}>
                  {String(label)}
                  <FreshnessChip
                    band={
                      (e as typeof paper).kind === "live"
                        ? "live"
                        : (e as typeof paper).kind === "delayed"
                          ? "delayed"
                          : "stale"
                    }
                  />
                  <span
                    className="mono text-muted text-xs"
                    title={(e as typeof paper).capturedAt ?? undefined}
                  >
                    {(e as typeof paper).ageMs == null
                      ? "No sample"
                      : `${Math.max(0, Math.floor((e as typeof paper).ageMs! / 1000))}s ago`}
                  </span>
                </div>
              ))}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <button className="btn palette-trigger" onClick={() => set(true)}>
          <Search size={14} />
          Jump to…<Kbd>⌘ K</Kbd>
        </button>
        <button
          className="icon-btn"
          aria-label="Toggle theme"
          onClick={() =>
            preferences.update({
              theme:
                document.documentElement.dataset.theme === "dark"
                  ? "light"
                  : "dark",
            })
          }
        >
          {prefs.theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>
      <Dialog.Root open={open} onOpenChange={set}>
        <Dialog.Portal>
          <Dialog.Overlay className="modal-overlay" />
          <Dialog.Content className="pp-glass modal">
            <Dialog.Title>Jump to workspace</Dialog.Title>
            <Dialog.Description>Choose a workspace route.</Dialog.Description>
            <Dialog.Close
              className="icon-btn absolute right-4 top-4"
              aria-label="Close search"
            >
              <X size={16} />
            </Dialog.Close>
            {navigation.map((n) => (
              <Link
                className="nav-link"
                key={n.id}
                href={`/${n.id}`}
                onClick={() => set(false)}
              >
                <n.icon size={18} />
                {n.label}
              </Link>
            ))}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </header>
  );
}

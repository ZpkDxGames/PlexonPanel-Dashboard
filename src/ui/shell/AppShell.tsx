"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PanelLeft, Layers3 } from "lucide-react";
import { useActiveServer } from "../bindings";
import { Tooltip } from "../primitives/Tooltip";
import { ROUTES } from "./routes";
import { MissionControlHeader } from "./MissionControlHeader";
import { CommandPalette } from "./CommandPalette";
import { PlayerEventsFeeder } from "../players/PlayerEventsFeeder";
export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false),
    [palette, setPalette] = useState(false),
    pathname = usePathname(),
    router = useRouter(),
    server = useActiveServer();
  useEffect(() => {
    const route = ROUTES.find((r) => r.href === pathname);
    document.title = `${route?.label ?? "Workspace"} · ${server.name} · PlexonPanel`;
  }, [pathname, server.name]);
  useEffect(() => {
    let armed = 0;
    function key(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
        return;
      }
      const t = e.target as HTMLElement;
      if (
        t.closest("input,textarea,select,[contenteditable=true]") ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;
      if (e.key.toLowerCase() === "g") {
        armed = Date.now();
        return;
      }
      if (armed && Date.now() - armed < 900) {
        const route = ROUTES.find((r) => String(r.key) === e.key);
        if (route) {
          e.preventDefault();
          router.push(route.href);
        }
        armed = 0;
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [router]);
  return (
    <PlayerEventsFeeder>
      <div className="pp-shell" data-rail={open ? "open" : "compact"}>
        <nav className="pp-rail" aria-label="Primary">
          <Link
            href="/overview"
            className="pp-rail__item pp-brand"
            aria-label="PlexonPanel home"
          >
            <Layers3 size={22} />
            <span className="pp-rail__label">plexonpanel</span>
          </Link>
          {ROUTES.map((r) => (
            <Tooltip
              key={r.id}
              side="right"
              content={
                <span className="row">
                  {r.label}
                  <kbd className="pp-kbd">G</kbd>
                  <kbd className="pp-kbd">{r.key}</kbd>
                </span>
              }
            >
              <Link
                className="pp-rail__item"
                href={r.href}
                aria-label={r.label}
                aria-current={pathname === r.href ? "page" : undefined}
              >
                <r.icon size={20} strokeWidth={1.65} />
                <span className="pp-rail__label">{r.label}</span>
              </Link>
            </Tooltip>
          ))}
          <button
            className="pp-rail__item pp-rail__toggle"
            aria-label="Toggle navigation width"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <PanelLeft size={20} />
            <span className="pp-rail__label">Collapse</span>
          </button>
        </nav>
        <div className="pp-shell__main">
          <MissionControlHeader onPalette={() => setPalette(true)} />
          <main
            className="pp-canvas"
            data-bleed={pathname === "/console"}
            id="workspace"
          >
            {["/overview", "/players", "/console", "/access"].includes(
              pathname,
            ) && (
              <h1 className="sr-only">
                {ROUTES.find((r) => r.href === pathname)?.label}
              </h1>
            )}
            {children}
          </main>
        </div>
      </div>
      <CommandPalette open={palette} onOpenChange={setPalette} />
    </PlayerEventsFeeder>
  );
}

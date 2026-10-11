import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import { navigate, routeLabels, routes } from "../router";

export function WorkspacePalette({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const items = useMemo(() => routes.filter((route) => `${routeLabels[route]} ${route}`.toLowerCase().includes(query.toLowerCase().trim())), [query]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); previous?.focus(); };
  }, []);
  const choose = (index: number) => { const route = items[index]; if (route) { navigate(route); onClose(); } };
  return <dialog className="palette palette-dialog" ref={dialog} aria-labelledby="palette-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="palette-input"><Icon name="search"/><input autoFocus placeholder="Search workspaces…" aria-label="Search workspaces" value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} onKeyDown={(event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(0, Math.min(items.length - 1, value + (event.key === "ArrowDown" ? 1 : -1)))); }
      if (event.key === "Enter") { event.preventDefault(); choose(active); }
    }}/><button className="palette-close" onClick={onClose} aria-label="Close search">Esc</button></div>
    <div className="palette-caption"><span id="palette-title">Workspace shortcuts</span><small>↑ ↓ select · Enter open</small></div>
    <div className="palette-results">{items.map((route, index) => <button key={route} className={index === active ? "is-highlighted" : ""} onFocus={() => setActive(index)} onClick={() => choose(index)}><Icon name={route.toLowerCase()}/><span><strong>{routeLabels[route]}</strong><small>Open workspace</small></span><em>↵</em></button>)}{!items.length && <div className="inline-empty"><strong>No matching workspace</strong><span>Try players, performance or settings.</span></div>}</div>
  </dialog>;
}

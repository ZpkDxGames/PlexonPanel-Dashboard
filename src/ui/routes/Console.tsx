"use client";
import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import {
  useViewSync,
  useControl,
  useActiveServer,
  usePrefs,
  time,
} from "../bindings";
import { PpSelect } from "../primitives/Select";
import { Tabs } from "../primitives/Tabs";
import { LiveConsole } from "../console/LiveConsole";
import { CommandComposer } from "../console/CommandComposer";
import { MutationButton } from "../primitives/MutationButton";
import { Table } from "./shared";
export default function Console() {
  const snap = useControl(),
    server = useActiveServer(),
    prefs = usePrefs(),
    sync = useViewSync(),
    tab = sync.idePane,
    setTab = (v: "console" | "chat" | "plugins") => sync.set("idePane", v),
    level = sync.ideLevel,
    setLevel = (v: string) => sync.set("ideLevel", v as typeof level),
    [search, setSearch] = useState(""),
    regex = sync.ideRegex,
    plugin = sync.idePlugin,
    wrap = sync.ideWrap,
    [clearBefore, setClearBefore] = useState(0),
    filter = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        !(e.target as HTMLElement).closest("input,select,textarea")
      ) {
        e.preventDefault();
        filter.current?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setClearBefore(Date.now());
      }
      if (e.altKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        sync.set("ideRegex", (v) => !v);
      }
      if (e.altKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        sync.set("ideWrap", (v) => !v);
      }
      if (
        e.key === "End" &&
        !(e.target as HTMLElement).closest("input,select,textarea")
      ) {
        const el = document.querySelector(".pp-console-scroll");
        if (el) el.scrollTop = el.scrollHeight;
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  function exportLogs() {
    const text = (tab === "chat" ? snap.state.chat : snap.state.console)
        .map(
          (l) =>
            `[${time(String(l.capturedAt ?? l.timestamp), prefs.timezone)}] ${String(l.content ?? l.message ?? "")}`,
        )
        .join("\n"),
      url = URL.createObjectURL(new Blob([text], { type: "text/plain" })),
      a = document.createElement("a");
    a.href = url;
    a.download = "plexonpanel-current-boot.log";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  let regexError = false;
  try {
    if (regex && search) new RegExp(search);
  } catch {
    regexError = true;
  }
  return (
    <section className="pp-ide" aria-label="Console IDE">
      <div className="pp-ide-bar">
        <span className="pp-num epoch-detail">
          epoch {server.epochId.slice(0, 12)} · {snap.state.console.length}{" "}
          lines
        </span>
        <i
          className="pp-dot"
          data-tone={snap.phase === "live" ? "emerald" : "amber"}
        />
        <span className="epoch-detail">
          {snap.phase === "live" ? "streaming" : "paused"}
        </span>
        <div className="push">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: "console", label: "Console" },
              { id: "chat", label: "Chat" },
              { id: "plugins", label: "Plugins" },
            ]}
            label="Terminal workspace"
          />
        </div>
      </div>
      <div className="pp-console-toolbar">
        <div className="pp-seg" role="group" aria-label="Console severity">
          {["All", "Info", "Warn", "Error"].map((l) => (
            <button
              key={l}
              aria-pressed={level === l}
              onClick={() => setLevel(l)}
            >
              {l}
            </button>
          ))}
        </div>
        <input
          ref={filter}
          aria-label="Filter terminal stream"
          aria-invalid={regexError || undefined}
          placeholder={regex ? "Regular expression…" : "Filter stream… /"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className="pp-ctl desktop-only"
          aria-pressed={regex}
          onClick={() => sync.set("ideRegex", (v) => !v)}
        >
          .*
        </button>
        <PpSelect
          ariaLabel="Filter plugin"
          value={plugin}
          onChange={(v) => sync.set("idePlugin", v)}
          options={[
            { value: "", label: "All plugins" },
            ...snap.state.plugins.map((p) => ({
              value: String(p.name),
              label: String(p.name),
            })),
          ]}
        />
        <button
          className="pp-ctl desktop-only"
          aria-pressed={wrap}
          onClick={() => sync.set("ideWrap", (v) => !v)}
        >
          Wrap
        </button>
        <button
          className="pp-ctl"
          aria-label="Export current stream"
          onClick={exportLogs}
        >
          <Download size={13} />
        </button>
      </div>
      {tab === "plugins" ? (
        <div className="pp-well" style={{ overflow: "auto" }}>
          <Table label="Plugin inventory">
            <thead>
              <tr>
                <th>Plugin</th>
                <th>Version</th>
                <th>State</th>
                <th>Authors</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {snap.state.plugins
                .filter((p) =>
                  String(p.name).toLowerCase().includes(search.toLowerCase()),
                )
                .map((p) => (
                  <tr key={String(p.name)}>
                    <td>{String(p.name)}</td>
                    <td>{String(p.version ?? "—")}</td>
                    <td>
                      <i
                        className="pp-dot"
                        data-tone={p.enabled ? "emerald" : "amber"}
                      />{" "}
                      {p.enabled ? "enabled" : "disabled"}
                    </td>
                    <td>
                      {Array.isArray(p.authors) ? p.authors.join(", ") : "—"}
                    </td>
                    <td>
                      <MutationButton
                        action="plugin.command.reload"
                        kind="PAPER"
                        args={{ plugin: p.name }}
                        label={`Reload ${p.name}`}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </div>
      ) : (
        <LiveConsole
          key={tab}
          mode="full"
          channel={tab}
          filters={{ level, search, regex, plugin }}
          clearBefore={clearBefore}
          wrap={wrap}
        />
      )}
      <CommandComposer chat={tab === "chat"} />
    </section>
  );
}

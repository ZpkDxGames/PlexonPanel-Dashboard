"use client";

import { Select } from "../components/select";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionButton,
  Badge,
  Empty,
  Panel,
  duration,
  time,
  type ViewProps,
} from "./control-views";
import { str, type JsonMap } from "../lib/control-state";

type PluginSort = "name" | "version";

function lower(value: unknown) {
  return str(value, "").toLowerCase();
}

function Timestamp({ value }: { value: unknown }) {
  const date = new Date(str(value, ""));
  const valid = Number.isFinite(date.getTime());
  const iso = valid ? date.toISOString() : undefined;
  return (
    <time dateTime={iso} title={iso ? `UTC: ${iso}` : undefined}>
      {time(value)}
    </time>
  );
}

export function HistoryPlayerDrawer({
  entry,
  entries,
  close,
}: {
  entry: JsonMap;
  entries: JsonMap[];
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      className="ui-drawer workspace-player-drawer"
      ref={ref}
      onCancel={close}
      aria-labelledby="history-player-title"
    >
      <div className="ui-panel-head">
        <div>
          <small>Presence observation · read only</small>
          <h2 id="history-player-title">{str(entry.name)}</h2>
        </div>
        <button className="ui-button" onClick={close} aria-label="Close history details">
          ×
        </button>
      </div>
      <dl className="ui-details workspace-drawer-section">
        {[
          ["UUID", str(entry.uuid, "Unknown")],
          ["State", str(entry.state, "Unknown")],
          ["Observed", <Timestamp key="observed" value={entry.observedAt} />],
          [
            "Session started",
            <Timestamp key="started" value={entry.sessionStartedAt} />,
          ],
          [
            "Session ended",
            entry.sessionEndedAt ? (
              <Timestamp key="ended" value={entry.sessionEndedAt} />
            ) : (
              "Unknown"
            ),
          ],
          ["Duration", duration(entry.sessionDurationMillis)],
          ["Termination", str(entry.termination, "Unknown")],
          ["Session ID", str(entry.sessionId, "Unknown")],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <dt>{String(label)}</dt>
            <dd>{value ?? "Unknown"}</dd>
          </div>
        ))}
      </dl>
      <div className="workspace-drawer-section">
        <h3>Loaded observations for this player</h3>
        <ul className="workspace-session-list">
          {entries.slice(0, 12).map((item) => (
            <li key={str(item.eventId)}>
              <strong>{item.state === "JOINED" ? "Joined" : "Left"}</strong>
              <span>
                <Timestamp value={item.observedAt} />
              </span>
              <span>{duration(item.sessionDurationMillis)}</span>
            </li>
          ))}
        </ul>
        <p className="ui-hint">
          Offline history rows expose no player actions. Only observations in
          the currently loaded bounded result are shown here.
        </p>
      </div>
    </dialog>
  );
}

export function ChatView(props: ViewProps) {
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [paused, setPaused] = useState<JsonMap[] | null>(null);
  const [followTail, setFollowTail] = useState(true);
  const [clearAt, setClearAt] = useState(0);
  const [mini, setMini] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const source = paused ?? props.state.chat;
  const messages = useMemo(
    () =>
      source.filter(
        (item) =>
          (!clearAt || Date.parse(str(item.capturedAt, "")) > clearAt) &&
          (lower(item.playerName).includes(search.toLowerCase()) ||
            lower(item.content).includes(search.toLowerCase())),
      ),
    [source, clearAt, search],
  );
  useEffect(() => {
    if (followTail && viewport.current)
      viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [messages.length, followTail]);

  const plexonChatsActive =
    props.state.ready?.server.capabilities["chat.integration.plexonchats"] ===
      true ||
    props.state.chat.some(
      (item) => item.source === "PlexonChats" || item.integration === "PlexonChats",
    );

  return (
    <>
      <div className="workspace-filter-toolbar">
        <label className="ui-search">
          Search chat
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Player or message"
          />
        </label>
        <button
          className="ui-button"
          onClick={() => setPaused(paused ? null : [...props.state.chat])}
        >
          {paused ? "Resume view" : "Pause view"}
        </button>
        <button
          className="ui-button"
          aria-pressed={followTail}
          onClick={() => setFollowTail(!followTail)}
        >
          Follow tail {followTail ? "on" : "off"}
        </button>
        <button className="ui-button" onClick={() => setClearAt(Date.now())}>
          Clear local view
        </button>
        <Badge>{messages.length} messages</Badge>
        {plexonChatsActive && <Badge tone="cyan">PlexonChats</Badge>}
      </div>

      <Panel
        title="Global chat"
        aside={
          paused ? (
            <Badge tone="amber">View paused</Badge>
          ) : (
            <Badge tone={props.connected ? "green" : "quiet"}>
              {props.connected ? "Live channel" : "Disconnected"}
            </Badge>
          )
        }
      >
        <div className="ui-chat workspace-chat" ref={viewport}>
          {messages.length ? (
            messages.map((item, index) => (
              <div
                className="ui-chat-message"
                key={`${item.messageId}-${index}`}
              >
                <span className="ui-avatar" aria-hidden>
                  {str(item.playerName).slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <strong>
                    {str(item.playerName, "System")}{" "}
                    <small>{time(item.capturedAt)}</small>
                  </strong>
                  <p>{str(item.content)}</p>
                </div>
                <button
                  className="ui-button"
                  aria-label="Copy chat message"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(str(item.content))
                      .then(() => props.notice("Chat message copied."))
                  }
                >
                  Copy
                </button>
              </div>
            ))
          ) : (
            <Empty title={search ? "No matching chat messages" : "No global chat messages yet"}>
              Vanilla and supported integration messages appear only when the
              local policy provides them.
            </Empty>
          )}
        </div>

        {props.can("chat.global.send") ? (
          <form
            className="ui-form ui-pad"
            onSubmit={(event) => {
              event.preventDefault();
              void props
                .run("chat.global.send", { message, miniMessage: mini })
                .then(() => setMessage(""))
                .catch(() => {});
            }}
          >
            <label>
              Message as {props.state.ready?.device.name}
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={2000}
                rows={3}
                required
              />
            </label>
            <div className="ui-actions">
              {props.state.ready?.device.scopes.includes(
                "chat.send.minimessage",
              ) &&
                props.state.ready.server.capabilities[
                  "chat.send.minimessage"
                ] && (
                  <label className="ui-check">
                    <input
                      type="checkbox"
                      checked={mini}
                      onChange={(event) => setMini(event.target.checked)}
                    />
                    MiniMessage
                  </label>
                )}
              <button
                className="ui-button primary"
                disabled={!message.trim()}
              >
                Send to global chat
              </button>
            </div>
          </form>
        ) : (
          <p className="ui-hint ui-pad">
            Sending is disabled for this device or by local policy.
          </p>
        )}
      </Panel>
    </>
  );
}

export function PluginsView(props: ViewProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState<PluginSort>("name");
  const [selected, setSelected] = useState<string | null>(null);

  const plugins = useMemo(() => {
    const filtered = props.state.plugins.filter((plugin) => {
      const matchesSearch =
        lower(plugin.name).includes(search.toLowerCase()) ||
        lower(plugin.description).includes(search.toLowerCase());
      const matchesStatus =
        status === "ALL" ||
        (status === "ENABLED" && plugin.enabled === true) ||
        (status === "DISABLED" && plugin.enabled !== true);
      return matchesSearch && matchesStatus;
    });
    return [...filtered].sort((a, b) =>
      sort === "version"
        ? str(a.version).localeCompare(str(b.version), undefined, {
            numeric: true,
          })
        : str(a.name).localeCompare(str(b.name)),
    );
  }, [props.state.plugins, search, status, sort]);
  const plugin = props.state.plugins.find((item) => item.name === selected);

  return (
    <>
      <div className="workspace-filter-toolbar">
        <label className="ui-search">
          Search plugins
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name or description"
          />
        </label>
        <label>
          State
          <Select aria-label="State"
            value={status}
            onValueChange={(selectedValue) => setStatus(selectedValue)}
          >
            <option value="ALL">All states</option>
            <option value="ENABLED">Enabled</option>
            <option value="DISABLED">Disabled</option>
          </Select>
        </label>
        <label>
          Sort
          <Select aria-label="Sort"
            value={sort}
            onValueChange={(selectedValue) => setSort(selectedValue as PluginSort)}
          >
            <option value="name">Name</option>
            <option value="version">Version</option>
          </Select>
        </label>
        <Badge>{props.state.plugins.length} installed</Badge>
        <button
          className="ui-button"
          onClick={() =>
            props.notice(
              "Plugin inventory is pushed by the Paper agent; the latest received snapshot is displayed.",
            )
          }
        >
          Refresh
        </button>
      </div>

      <Panel title="Plugin inventory" aside={<Badge>{plugins.length} shown</Badge>}>
        {plugins.length ? (
          <div className="ui-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Plugin</th>
                  <th>Version</th>
                  <th>State</th>
                  <th>Authors</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {plugins.map((item) => (
                  <tr key={str(item.name)}>
                    <td>
                      <strong>{str(item.name)}</strong>
                      {typeof item.description === "string" && (
                        <small className="workspace-table-description">
                          {item.description}
                        </small>
                      )}
                    </td>
                    <td>{str(item.version)}</td>
                    <td>
                      <Badge tone={item.enabled ? "green" : "quiet"}>
                        {item.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </td>
                    <td>
                      {Array.isArray(item.authors) && item.authors.length
                        ? item.authors.join(", ")
                        : "Not declared"}
                    </td>
                    <td>
                      <button
                        className="ui-button"
                        onClick={() => setSelected(str(item.name))}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={
              search || status !== "ALL"
                ? "No plugins match these filters"
                : "Waiting for plugin inventory"
            }
          />
        )}
      </Panel>

      {plugin && (
        <PluginDialog21
          {...props}
          plugin={plugin}
          close={() => setSelected(null)}
        />
      )}
      <p className="ui-hint">
        Generic Bukkit/Paper reload is intentionally unsupported. Dedicated
        reload commands remain controlled by local plugin policy.
      </p>
    </>
  );
}

function PluginDialog21({
  plugin,
  close,
  ...props
}: ViewProps & { plugin: JsonMap; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      className="ui-drawer workspace-player-drawer"
      ref={ref}
      onCancel={close}
      aria-labelledby="plugin-title"
    >
      <div className="ui-panel-head">
        <div>
          <small>Plugin details</small>
          <h2 id="plugin-title">{str(plugin.name)}</h2>
        </div>
        <button className="ui-button" onClick={close} aria-label="Close plugin details">
          ×
        </button>
      </div>
      <div className="workspace-drawer-section">
        <div className="ui-actions">
          <Badge tone={plugin.enabled ? "green" : "quiet"}>
            {plugin.enabled ? "Enabled" : "Disabled"}
          </Badge>
          <Badge>{str(plugin.version)}</Badge>
        </div>
        <p>{str(plugin.description, "No description provided by this plugin.")}</p>
        <dl className="ui-details">
          <div>
            <dt>Authors</dt>
            <dd>
              {Array.isArray(plugin.authors) && plugin.authors.length
                ? plugin.authors.join(", ")
                : "Not declared"}
            </dd>
          </div>
          <div>
            <dt>Dependencies</dt>
            <dd>
              {Array.isArray(plugin.dependencies) && plugin.dependencies.length
                ? plugin.dependencies.join(", ")
                : "None declared"}
            </dd>
          </div>
          <div>
            <dt>Soft dependencies</dt>
            <dd>
              {Array.isArray(plugin.softDependencies) &&
              plugin.softDependencies.length
                ? plugin.softDependencies.join(", ")
                : "None declared"}
            </dd>
          </div>
          <div>
            <dt>Data folder</dt>
            <dd>plugins/{str(plugin.name)}</dd>
          </div>
        </dl>
        <div className="ui-actions">
          {props.can("plugin.command.reload") && (
            <ActionButton
              onClick={() =>
                props.run("plugin.command.reload", {
                  plugin: plugin.name,
                  confirmed: true,
                })
              }
            >
              Run configured reload
            </ActionButton>
          )}
          {typeof plugin.website === "string" &&
            /^https:\/\//.test(plugin.website) && (
              <a
                className="ui-button"
                href={plugin.website}
                target="_blank"
                rel="noreferrer"
              >
                Project website
              </a>
            )}
        </div>
        <p className="ui-hint">
          Use the Files workspace for configuration access when its root and
          current device scope permit it.
        </p>
      </div>
    </dialog>
  );
}

"use client";

import { ActionButton as NewActionButton, Badge as NewBadge, Button, DisabledReason, Empty as NewEmpty, PageHeader, Panel as NewPanel, SourceFacts } from "./ui/workspace";
import { PlayerHead } from "../components/player-head";
import { useUiPreferences } from "../components/ui-preferences-provider";

import { Select } from "./ui/workspace";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  duration,
  time,
  type ViewProps,
} from "./control-views";
import { Dialog, Disclosure, Table } from "./ui/primitives";
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
  return (
    <Dialog open onClose={close} title={str(entry.name)} description="Read-only presence observation from the loaded Paper journal.">
      <dl className="pp-facts">
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
      <div className="pp-stack">
        <h3>Loaded observations for this player</h3>
        <ul className="pp-list">
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
        <p className="pp-muted">
          Offline history rows expose no player actions. Only observations in
          the currently loaded bounded result are shown here.
        </p>
      </div>
    </Dialog>
  );
}

export function ChatView(props: ViewProps) {
  const { preferences } = useUiPreferences();
  const composer = useRef<HTMLTextAreaElement>(null);
  const [sending,setSending]=useState(false);
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
    <div className="pp-workspace" data-ui6-workspace="Chat">
      <PageHeader title="Global messages" description={props.connected&&props.state.ready?.agents.paper?`${messages.length} loaded messages from Paper.`:'Paper is disconnected. Loaded messages remain local.'} primary={<Button variant="primary" disabled={!props.can('chat.global.send')} disabledReason="Sending is disabled for this device or by local policy." onClick={()=>{composer.current?.focus();composer.current?.scrollIntoView({block:'center'});}}>Compose message</Button>}/>
      <div className="pp-toolbar">
        <label className="pp-field">
          Search chat
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Player or message"
          />
        </label>
        <details className="pp-disclosure"><summary>More</summary><div className="pp-stack">
        <Button
          onClick={() => setPaused(paused ? null : [...props.state.chat])}
        >
          {paused ? "Resume view" : "Pause view"}
        </Button>
        <Button

          aria-pressed={followTail}
          onClick={() => setFollowTail(!followTail)}
        >
          Follow tail {followTail ? "on" : "off"}
        </Button>
        <Button  onClick={() => setClearAt(Date.now())}>
          Clear local view
        </Button>
        </div></details>
        <NewBadge>{messages.length} {messages.length===1?"message":"messages"}</NewBadge>
        {plexonChatsActive && <NewBadge tone="cyan">PlexonChats</NewBadge>}
      </div>

      <NewPanel
        title="Global chat"
        aside={
          paused ? (
            <NewBadge tone="amber">View paused</NewBadge>
          ) : (
            <NewBadge tone={props.connected&&props.state.ready?.agents.paper ? "green" : "quiet"}>
              {props.connected&&props.state.ready?.agents.paper ? "Paper live" : "Disconnected"}
            </NewBadge>
          )
        }
      >
        <div className="pp-message-list" ref={viewport} role="region" aria-label="Loaded global chat messages" tabIndex={0}>
          {messages.length ? (
            messages.map((item, index) => (
              <div
                className={`pp-list-row pp-message${preferences.liveRowHighlight?" pp-new-row":""}`}
                data-grouped={index>0&&messages[index-1].playerName===item.playerName&&messages[index-1].playerUuid===item.playerUuid} tabIndex={0}
                key={`${item.messageId}-${index}`}
              >
                <PlayerHead uuid={str(item.playerUuid,'')} name={str(item.playerName,'System')} size={32}/>
                <div className="pp-row-details">
                  {!(index>0&&messages[index-1].playerName===item.playerName&&messages[index-1].playerUuid===item.playerUuid)&&<strong>{str(item.playerName,'System')}</strong>}
                  <time className="pp-message-time" dateTime={str(item.capturedAt,'')} title={str(item.capturedAt,'')}>{time(item.capturedAt)}</time>
                  <p>{str(item.content)}</p>
                </div>
                <Button

                  aria-label="Copy chat message"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(str(item.content))
                      .then(() => props.notice("Chat message copied."))
                  }
                >
                  Copy
                </Button>
              </div>
            ))
          ) : (
            <NewEmpty title={search ? "No matching chat messages" : "No global chat messages yet"}>
              Vanilla and supported integration messages appear only when the
              local policy provides them.
            </NewEmpty>
          )}
        </div>

        <Disclosure title="Chat source and timing"><SourceFacts source="Paper chat" unit="messages" receivedAt={props.state.updatedAt}/><p className="pp-muted">Hover or focus a message for its supplied capture time. Individual received-at timestamps are not retained.</p></Disclosure>
        {props.can("chat.global.send") ? (
          <form
            className="pp-form"
            onSubmit={(event) => {
              event.preventDefault();
              setSending(true);
              void props
                .run("chat.global.send", { message, miniMessage: mini })
                .then(() => setMessage(""))
                .catch(() => {}).finally(()=>setSending(false));
            }}
          >
            <label>
              Message as {props.state.ready?.device.name}
              <textarea ref={composer}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={2000}
                rows={3}
                required
              />
            </label>
            <div className="pp-row">
              {props.state.ready?.device.scopes.includes(
                "chat.send.minimessage",
              ) &&
                props.state.ready.server.capabilities[
                  "chat.send.minimessage"
                ] && (
                  <label className="pp-check">
                    <input
                      type="checkbox"
                      checked={mini}
                      onChange={(event) => setMini(event.target.checked)}
                    />
                    MiniMessage
                  </label>
                )}
              <Button
                type="submit" busy={sending} disabledReason="Write a message before sending."
                disabled={!message.trim()}
              >
                {sending?"Waiting for signed result…":"Send to global chat"}
              </Button>
            </div>
          </form>
        ) : (
          <DisabledReason reason="Sending is disabled for this device or by local policy."/>
        )}
      </NewPanel>
    </div>
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
    <div className="pp-workspace" data-ui6-workspace="Plugins">
      <PageHeader title="Paper plugins" description={props.connected&&props.state.ready?.agents.paper?`${props.state.plugins.length} installed plugins in the latest Paper snapshot.`:'Paper is disconnected. Inventory is unavailable.'} primary={<Button variant="primary" onClick={()=>props.notice('Plugin inventory is pushed by the Paper agent; the latest received snapshot is displayed.')}>Refresh latest</Button>}/>
      <div className="pp-toolbar">
        <label className="pp-field">
          Search plugins
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name or description"
          />
        </label>
        <Select aria-label="State"
            value={status}
            onValueChange={(selectedValue) => setStatus(selectedValue)}
          >
            <option value="ALL">All states</option>
            <option value="ENABLED">Enabled</option>
            <option value="DISABLED">Disabled</option>
          </Select>
        <Select aria-label="Sort"
            value={sort}
            onValueChange={(selectedValue) => setSort(selectedValue as PluginSort)}
          >
            <option value="name">Name</option>
            <option value="version">Version</option>
          </Select>
        <NewBadge>{props.state.plugins.length} installed</NewBadge>

      </div>

      <NewPanel title="Plugin inventory" aside={<NewBadge>{plugins.length} shown</NewBadge>}>
        {plugins.length ? (
          <Table caption="Latest Paper plugin inventory" rows={plugins} rowKey={item=>str(item.name)} columns={[
            {key:'name',label:'Plugin',rowHeader:true,render:item=><><strong>{str(item.name)}</strong>{typeof item.description==='string'&&<small>{item.description}</small>}</>},
            {key:'version',label:'Version',render:item=>str(item.version)},
            {key:'state',label:'State',render:item=><NewBadge tone={item.enabled===true?'green':item.enabled===false?'quiet':'amber'}>{item.enabled===true?'Enabled':item.enabled===false?'Disabled':'Unknown'}</NewBadge>},
            {key:'authors',label:'Authors',render:item=>Array.isArray(item.authors)&&item.authors.length?item.authors.join(', '):'Not declared'},
            {key:'actions',label:'Actions',render:item=><Button onClick={()=>setSelected(str(item.name))}>Details</Button>},
          ]}/>

        ) : (
          <NewEmpty
            title={
              search || status !== "ALL"
                ? "No plugins match these filters"
                : "Waiting for plugin inventory"
            }
          />
        )}
      </NewPanel>

      <Disclosure title="Inventory source and timing"><SourceFacts source="Paper plugin snapshot" unit="installed plugins" receivedAt={props.state.updatedAt}/><p className="pp-muted">Snapshot capture timestamps are not retained by this view.</p></Disclosure>
      {plugin && (
        <PluginDialog21
          {...props}
          plugin={plugin}
          close={() => setSelected(null)}
        />
      )}
      <p className="pp-muted">
        Generic Bukkit/Paper reload is intentionally unsupported. Dedicated
        reload commands remain controlled by local plugin policy.
      </p>
    </div>
  );
}

function PluginDialog21({
  plugin,
  close,
  ...props
}: ViewProps & { plugin: JsonMap; close: () => void }) {
  return (
    <Dialog open onClose={close} title={str(plugin.name)} description="Details from the latest Paper inventory.">
      <div className="pp-stack">
        <div className="pp-row">
          <NewBadge tone={plugin.enabled===true ? "green" : "quiet"}>
            {plugin.enabled===true ? "Enabled" : plugin.enabled===false ? "Disabled" : "Unknown"}
          </NewBadge>
          <NewBadge>{str(plugin.version)}</NewBadge>
        </div>
        <p>{str(plugin.description, "No description provided by this plugin.")}</p>
        <dl className="pp-facts">
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
            <dd><code>plugins/{str(plugin.name)}</code></dd>
          </div>
        </dl>
        <div className="pp-row">
          {props.can("plugin.command.reload") && (
            <NewActionButton
              onClick={() =>
                props.run("plugin.command.reload", {
                  plugin: plugin.name,
                  confirmed: true,
                })
              }
            >
              Run configured reload
            </NewActionButton>
          )}
          {typeof plugin.website === "string" &&
            /^https:\/\//.test(plugin.website) && (
              <a

                href={plugin.website}
                target="_blank"
                rel="noreferrer"
              >
                Project website
              </a>
            )}
        </div>
        <p className="pp-muted">
          Use the Files workspace for configuration access when its root and
          current device scope permit it.
        </p>
      </div>
    </Dialog>
  );
}

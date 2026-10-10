"use client";

import { useMemo, useState } from "react";
import { useTelemetryNow } from "../lib/telemetry-clock";
import { liveActivity } from "../lib/durable-activity";
import { time, type ViewProps } from "./control-views";
import { Badge, Button, Empty, PageHeader, Panel } from "./ui/workspace";
import { Disclosure } from "./ui/primitives";
import { useUiPreferences } from "../components/ui-preferences-provider";
import { ActivityHistoryModal } from "./activity-history-modal";
import { PlayerRoster } from "./player-roster";

function journalStatus(props: ViewProps) {
  const ready = props.state.ready;
  if (!ready || !props.connected)
    return { label: "Source offline", tone: "amber", detail: "Reconnect the signed relay session to query Paper's journal." };
  if (!(props.deviceGrant?.scopes ?? ready?.device.scopes)?.includes("players.history.view"))
    return { label: "Not granted", tone: "quiet", detail: "This device cannot query Paper's journal. An approved device needs a new immutable grant." };
  if (!ready.agents.paper)
    return { label: "Source offline", tone: "amber", detail: "Paper must reconnect before its retained journal can be queried." };
  if (!Object.prototype.hasOwnProperty.call(ready.server.paperCapabilities, "players.history.view"))
    return { label: "Unsupported", tone: "quiet", detail: "The connected Paper version does not advertise player history." };
  if (ready.server.paperCapabilities["players.history.view"] !== true)
    return { label: "Local policy off", tone: "amber", detail: "The operator must enable player-history.enabled locally after reviewing privacy and retention." };
  return { label: "Available", tone: "green", detail: "Open Activity to query retained, paginated observations directly from Paper." };
}

export function PlayersView(props: ViewProps) {
  const { preferences } = useUiPreferences();
  const [activityOpen, setActivityOpen] = useState(false);
  const now = useTelemetryNow(props.state.updatedAt);
  const journal = journalStatus(props);
  const live = useMemo(
    () => props.connected && props.state.ready?.agents.paper &&
      (props.deviceGrant?.scopes ?? props.state.ready.device.scopes).includes("players.view")
      ? liveActivity(props.state.presenceDeltas, { query: "", status: "ALL", from: "", to: "" })
      : [],
    [props.connected, props.deviceGrant?.scopes, props.state.ready, props.state.presenceDeltas],
  );

  return (
    <div className="pp-workspace" data-ui6-workspace="Players">
      <PageHeader title="Player roster" description={props.connected&&props.state.ready?.agents.paper?'Current players from Paper.':'Paper roster unavailable while disconnected.'} primary={<Button variant="primary" disabled={!props.state.serverId} onClick={()=>setActivityOpen(true)}>Browse activity history</Button>}/>
      <PlayerRoster {...props} showHistoryTab={false} />
      <Panel
        title="Recent player activity"
        className="pp-stack"
        aside={<div className="pp-row">
          <Badge tone={props.connected && props.state.ready?.agents.paper ? "green" : "amber"}>
            {props.connected && props.state.ready?.agents.paper ? "Live" : "Source offline"}
          </Badge>
          <Badge>{live.length} recent in this session</Badge>
        </div>}
      >
        <p className="pp-muted">Live updates are transient. The Paper journal supplies retained activity when locally enabled.</p>
        <div className="pp-data-grid">
          <section className="pp-list" aria-label="Recent live join and leave activity">
            {live.length ? live.slice(0, 8).map((event) => (
              <article className={`pp-list-row${preferences.liveRowHighlight && now-Date.parse(event.observedAt)<6000?" pp-new-row":""}`} key={event.eventId}>
                <span className="pp-initial" aria-hidden>{event.name.slice(0, 1).toUpperCase()}</span>
                <div className="pp-row-details">
                  <strong>{event.name}</strong><small>{event.uuid.slice(0, 8)}</small>
                </div>
                <span data-state={event.state}>{event.state === "JOINED" ? "Joined" : "Left"}</span>
                <time dateTime={event.observedAt}>{time(event.observedAt)}</time>
              </article>
            )) : <Empty title="No recent live activity">Paper joins and leaves appear here during this signed session.</Empty>}
          </section>
          <aside className="pp-stack">
            <div>
              <span className="pp-muted">Paper journal</span>
              <div className="pp-row">
                <strong>Retained history</strong><Badge tone={journal.tone}>{journal.label}</Badge>
              </div>
              <p>{journal.detail}</p>
            </div>
            <Disclosure title="History and privacy"><p>Paper controls retention and access. This view does not keep a browser history archive.</p></Disclosure>
          </aside>
        </div>
      </Panel>
      {activityOpen && <ActivityHistoryModal
        props={props} open onClose={() => setActivityOpen(false)}
      />}
    </div>
  );
}

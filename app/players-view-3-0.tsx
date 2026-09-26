"use client";

import { useMemo, useState } from "react";
import { liveActivity } from "../lib/durable-activity";
import { Badge, Empty, Panel, time, type ViewProps } from "./control-views";
import { ActivityHistoryModal } from "./activity-history-modal";
import { PlayersView21 as PlayersView23 } from "./players-view-2-3";

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

export function PlayersView30(props: ViewProps) {
  const [activityOpen, setActivityOpen] = useState(false);
  const journal = journalStatus(props);
  const live = useMemo(
    () => props.connected && props.state.ready?.agents.paper &&
      (props.deviceGrant?.scopes ?? props.state.ready.device.scopes).includes("players.view")
      ? liveActivity(props.state.presenceDeltas, { query: "", status: "ALL", from: "", to: "" })
      : [],
    [props.connected, props.deviceGrant?.scopes, props.state.ready, props.state.presenceDeltas],
  );

  return (
    <>
      <PlayersView23 {...props} showHistoryTab={false} />
      <Panel
        title="Recent player activity"
        className="cr31-player-activity-panel"
        aside={<div className="cr31-player-activity-badges">
          <Badge tone={props.connected && props.state.ready?.agents.paper ? "green" : "amber"}>
            {props.connected && props.state.ready?.agents.paper ? "Live" : "Source offline"}
          </Badge>
          <Badge>{live.length} recent in this session</Badge>
        </div>}
      >
        <p className="cr-hint cr-pad">Live updates are transient. The Paper journal supplies retained activity when locally enabled.</p>
        <div className="cr31-player-activity-body">
          <section className="cr31-player-activity-feed" aria-label="Recent live join and leave activity">
            {live.length ? live.slice(0, 8).map((event) => (
              <article key={event.eventId}>
                <span className="cr30-activity-initial" aria-hidden>{event.name.slice(0, 1).toUpperCase()}</span>
                <div className="cr31-player-activity-identity">
                  <strong>{event.name}</strong><small>{event.uuid.slice(0, 8)}</small>
                </div>
                <span data-state={event.state}>{event.state === "JOINED" ? "Joined" : "Left"}</span>
                <time dateTime={event.observedAt}>{time(event.observedAt)}</time>
              </article>
            )) : <Empty title="No recent live activity">Paper joins and leaves appear here during this signed session.</Empty>}
          </section>
          <aside className="cr31-player-history-context">
            <div>
              <span className="cr31-player-history-kicker">Paper journal</span>
              <div className="cr31-player-history-status">
                <strong>Retained history</strong><Badge tone={journal.tone}>{journal.label}</Badge>
              </div>
              <p>{journal.detail}</p>
            </div>
            <div className="cr31-player-history-actions">
              <button type="button" className="cr-button primary"
                disabled={!props.state.serverId} onClick={() => setActivityOpen(true)}>
                Browse activity history
              </button>
              <small>Paper controls retention and access. This view does not keep a browser history archive.</small>
            </div>
          </aside>
        </div>
      </Panel>
      {activityOpen && <ActivityHistoryModal
        props={props} open onClose={() => setActivityOpen(false)}
      />}
    </>
  );
}

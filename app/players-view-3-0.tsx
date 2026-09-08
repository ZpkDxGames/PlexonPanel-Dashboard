"use client";

import { useEffect, useMemo, useState } from "react";
import { PlayerHead } from "../components/player-head";
import {
  ACTIVITY_HISTORY_MAX_EVENTS,
  loadActivityHistory,
  subscribeActivityHistory,
  type PresenceHistoryEvent,
} from "../lib/activity-history";
import { Badge, Empty, Panel, time, type ViewProps } from "./control-views";
import { ActivityHistoryModal } from "./activity-history-modal";
import { PlayersView21 as PlayersView23 } from "./players-view-2-3";

function paperJournalStatus(props: ViewProps) {
  const ready = props.state.ready;
  const scope = Boolean(ready?.device.scopes.includes("players.history.view"));
  const capabilityKnown = Boolean(
    ready &&
      Object.prototype.hasOwnProperty.call(
        ready.server.paperCapabilities,
        "players.history.view",
      ),
  );
  const capability =
    ready?.server.paperCapabilities["players.history.view"] === true;

  if (!scope)
    return {
      label: "Not granted",
      tone: "quiet",
      detail:
        "Persistent Paper history is not included in this device grant. Browser-local activity remains available here.",
    };
  if (!capabilityKnown)
    return {
      label: "Agent unsupported",
      tone: "quiet",
      detail:
        "This Paper agent does not advertise persistent player history. Browser-local activity remains available here.",
    };
  if (!capability)
    return {
      label: "Local policy off",
      tone: "amber",
      detail:
        "Persistent Paper history is disabled by local policy. Recent browser-local join/leave activity is still kept separately.",
    };
  return {
    label: "Available",
    tone: "green",
    detail:
      "Persistent Paper history is available through the History tab; this panel remains the fast browser-local activity feed.",
  };
}

function PlayerActivityPanel({
  props,
  events,
  openHistory,
}: {
  props: ViewProps;
  events: PresenceHistoryEvent[];
  openHistory: () => void;
}) {
  const journal = paperJournalStatus(props);
  const recent = events.slice(-8).reverse();
  const joins = events.filter((event) => event.state === "JOINED").length;
  const leaves = events.filter((event) => event.state === "LEFT").length;
  const uniquePlayers = new Set(events.map((event) => event.uuid)).size;

  return (
    <Panel
      title="Recent player activity"
      className="cr31-player-activity-panel"
      aside={(
        <div className="cr31-player-activity-badges">
          <Badge tone={props.connected ? "green" : "amber"}>
            {props.connected ? "Live capture" : "Reconnecting"}
          </Badge>
          <Badge>{events.length.toLocaleString()} stored</Badge>
        </div>
      )}
    >
      <div className="cr31-player-activity-summary" aria-label="Stored player activity summary">
        <div>
          <small>Events</small>
          <strong>{events.length.toLocaleString()}</strong>
        </div>
        <div>
          <small>Joins</small>
          <strong>{joins.toLocaleString()}</strong>
        </div>
        <div>
          <small>Leaves</small>
          <strong>{leaves.toLocaleString()}</strong>
        </div>
        <div>
          <small>Players seen</small>
          <strong>{uniquePlayers.toLocaleString()}</strong>
        </div>
      </div>

      <div className="cr31-player-activity-body">
        <section className="cr31-player-activity-feed" aria-label="Recent join and leave activity">
          {recent.length ? (
            recent.map((event) => (
              <article key={event.eventId}>
                <PlayerHead
                  uuid={event.uuid}
                  name={event.name}
                  size={38}
                  online={event.state === "JOINED"}
                />
                <div className="cr31-player-activity-identity">
                  <strong>{event.name}</strong>
                  <small>{event.uuid.slice(0, 8)}</small>
                </div>
                <span data-state={event.state}>
                  {event.state === "JOINED" ? "Joined" : "Left"}
                </span>
                <time dateTime={event.observedAt}>{time(event.observedAt)}</time>
              </article>
            ))
          ) : (
            <Empty title="No recent player activity">
              Join and leave events will appear here as Paper supplies authorized presence updates.
            </Empty>
          )}
        </section>

        <aside className="cr31-player-history-context">
          <div>
            <span className="cr31-player-history-kicker">Paper journal</span>
            <div className="cr31-player-history-status">
              <strong>Persistent history</strong>
              <Badge tone={journal.tone}>{journal.label}</Badge>
            </div>
            <p>{journal.detail}</p>
          </div>
          <div className="cr31-player-history-actions">
            <button
              type="button"
              className="cr-button primary"
              disabled={!props.state.serverId}
              onClick={openHistory}
            >
              Browse activity history
            </button>
            <small>
              Browser activity is retained locally up to {ACTIVITY_HISTORY_MAX_EVENTS.toLocaleString()} events per server.
            </small>
          </div>
        </aside>
      </div>
    </Panel>
  );
}

export function PlayersView30(props: ViewProps) {
  const [activityOpen, setActivityOpen] = useState(false);
  const [events, setEvents] = useState<PresenceHistoryEvent[]>([]);
  const serverId = props.state.serverId;

  useEffect(() => {
    if (!serverId) {
      setEvents([]);
      return;
    }
    const refresh = () => setEvents(loadActivityHistory(serverId));
    const timer = window.setTimeout(refresh, 0);
    const unsubscribe = subscribeActivityHistory(serverId, refresh);
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [serverId]);

  const stableEvents = useMemo(
    () => [...events].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt)),
    [events],
  );

  return (
    <>
      <PlayersView23 {...props} />
      <PlayerActivityPanel
        props={props}
        events={stableEvents}
        openHistory={() => setActivityOpen(true)}
      />
      <ActivityHistoryModal
        serverId={serverId}
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
      />
    </>
  );
}

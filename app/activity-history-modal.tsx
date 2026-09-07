"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PlayerHead } from "../components/player-head";
import {
  ACTIVITY_HISTORY_MAX_EVENTS,
  clearActivityHistory,
  loadActivityHistory,
  subscribeActivityHistory,
  type PresenceHistoryEvent,
} from "../lib/activity-history";

type StateFilter = "ALL" | "JOINED" | "LEFT";
type SortOrder = "NEWEST" | "OLDEST";

const PAGE_SIZE = 100;

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const delta = Math.round((today - target) / 86_400_000);
  if (delta === 0) return "Today";
  if (delta === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function eventTime(event: PresenceHistoryEvent): string {
  return new Date(event.observedAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function ActivityHistoryModal({
  serverId,
  open,
  onClose,
}: {
  serverId: string;
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [events, setEvents] = useState<PresenceHistoryEvent[]>([]);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<StateFilter>("ALL");
  const [sortOrder, setSortOrder] = useState<SortOrder>("NEWEST");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open || !serverId) return;
    setLoading(true);
    setVisibleCount(PAGE_SIZE);
    const refresh = () => {
      setEvents(loadActivityHistory(serverId));
      setLoading(false);
    };
    const timer = window.setTimeout(refresh, 0);
    const unsubscribe = subscribeActivityHistory(serverId, refresh);
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(focusTimer);
      unsubscribe();
    };
  }, [open, serverId]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, sortOrder, stateFilter]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matching = events.filter((event) => {
      if (stateFilter !== "ALL" && event.state !== stateFilter) return false;
      return (
        !needle ||
        event.name.toLowerCase().includes(needle) ||
        event.uuid.toLowerCase().includes(needle)
      );
    });
    return matching.sort((a, b) => {
      const delta = Date.parse(a.observedAt) - Date.parse(b.observedAt);
      return sortOrder === "NEWEST" ? -delta : delta;
    });
  }, [events, query, sortOrder, stateFilter]);

  const visible = filtered.slice(0, visibleCount);
  const groups = useMemo(() => {
    const result = new Map<string, PresenceHistoryEvent[]>();
    for (const event of visible) {
      const label = dayLabel(event.observedAt);
      const list = result.get(label) ?? [];
      list.push(event);
      result.set(label, list);
    }
    return [...result.entries()];
  }, [visible]);

  const joins = events.filter((event) => event.state === "JOINED").length;
  const leaves = events.filter((event) => event.state === "LEFT").length;
  const uniquePlayers = new Set(events.map((event) => event.uuid)).size;

  return (
    <dialog
      ref={dialogRef}
      className="cr30-activity-dialog"
      aria-labelledby="cr30-activity-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="cr30-activity-modal-shell">
        <header className="cr30-activity-modal-head">
          <div>
            <span>Control Room / Activity</span>
            <h2 id="cr30-activity-dialog-title">Player activity history</h2>
            <p>
              Browser-local join and leave history. Opening this view does not navigate away from
              the live dashboard or reconnect its telemetry session.
            </p>
          </div>
          <button type="button" className="cr30-activity-close" onClick={onClose} aria-label="Close activity history">
            ×
          </button>
        </header>

        <section className="cr30-activity-modal-stats" aria-label="Activity history summary">
          <article><small>Total events</small><strong>{events.length.toLocaleString()}</strong></article>
          <article><small>Joins</small><strong>{joins.toLocaleString()}</strong></article>
          <article><small>Leaves</small><strong>{leaves.toLocaleString()}</strong></article>
          <article><small>Unique players</small><strong>{uniquePlayers.toLocaleString()}</strong></article>
        </section>

        <section className="cr30-activity-modal-controls" aria-label="Activity history filters">
          <input
            ref={searchRef}
            type="search"
            placeholder="Search player name or UUID"
            aria-label="Search player activity"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            aria-label="Filter activity type"
            value={stateFilter}
            onChange={(event) => setStateFilter(event.target.value as StateFilter)}
          >
            <option value="ALL">All activity</option>
            <option value="JOINED">Joins only</option>
            <option value="LEFT">Leaves only</option>
          </select>
          <select
            aria-label="Sort activity"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value as SortOrder)}
          >
            <option value="NEWEST">Newest first</option>
            <option value="OLDEST">Oldest first</option>
          </select>
          <button
            type="button"
            className="cr30-activity-clear"
            disabled={!events.length}
            onClick={() => {
              if (!events.length) return;
              if (
                window.confirm(
                  `Clear ${events.length.toLocaleString()} stored activity events for this server from this browser?`,
                )
              )
                clearActivityHistory(serverId);
            }}
          >
            Clear history
          </button>
        </section>

        <div className="cr30-activity-modal-scroll">
          {loading ? (
            <div className="cr30-activity-modal-empty">Loading browser history…</div>
          ) : groups.length ? (
            <section className="cr30-activity-modal-groups" aria-label="Stored player activity">
              {groups.map(([label, group]) => (
                <article className="cr30-activity-modal-group" key={label}>
                  <header>
                    <strong>{label}</strong>
                    <span>{group.length.toLocaleString()} shown</span>
                  </header>
                  <div>
                    {group.map((event) => (
                      <div className="cr30-activity-modal-row" key={event.eventId}>
                        <PlayerHead
                          uuid={event.uuid}
                          name={event.name}
                          size={38}
                          online={event.state === "JOINED"}
                        />
                        <div className="cr30-activity-modal-identity">
                          <strong>{event.name}</strong>
                          <small>{event.uuid}</small>
                        </div>
                        <div className="cr30-activity-modal-meta">
                          <span data-state={event.state}>{event.state}</span>
                          <time dateTime={event.observedAt}>{eventTime(event)}</time>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </section>
          ) : (
            <div className="cr30-activity-modal-empty">
              {events.length ? "No activity matches the current filters." : "No stored activity yet."}
            </div>
          )}

          {!loading && visible.length < filtered.length && (
            <div className="cr30-activity-load-more">
              <button type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                Load {Math.min(PAGE_SIZE, filtered.length - visible.length).toLocaleString()} more
              </button>
              <span>
                Showing {visible.length.toLocaleString()} of {filtered.length.toLocaleString()} matching events
              </span>
            </div>
          )}
        </div>

        <footer className="cr30-activity-modal-foot">
          <span>
            Retention is capped at {ACTIVITY_HISTORY_MAX_EVENTS.toLocaleString()} events per server.
          </span>
          <span>Stored only in this browser&apos;s LocalStorage.</span>
        </footer>
      </div>
    </dialog>
  );
}

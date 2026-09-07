"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PlayerHead } from "../../components/player-head";
import {
  ACTIVITY_HISTORY_MAX_EVENTS,
  clearActivityHistory,
  listActivityHistoryServers,
  loadActivityHistory,
  subscribeActivityHistory,
  type PresenceHistoryEvent,
} from "../../lib/activity-history";
import styles from "./activity.module.css";

type StateFilter = "ALL" | "JOINED" | "LEFT";
type SortOrder = "NEWEST" | "OLDEST";

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

function useServerHistory(serverId: string) {
  const [events, setEvents] = useState<PresenceHistoryEvent[]>([]);
  useEffect(() => {
    if (!serverId) return;
    const refresh = () => setEvents(loadActivityHistory(serverId));
    const timer = window.setTimeout(refresh, 0);
    const unsubscribe = subscribeActivityHistory(serverId, refresh);
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [serverId]);
  return serverId ? events : [];
}

export default function ActivityPage() {
  const [serverId, setServerId] = useState("");
  const [servers, setServers] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<StateFilter>("ALL");
  const [sortOrder, setSortOrder] = useState<SortOrder>("NEWEST");
  const events = useServerHistory(serverId);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const available = listActivityHistoryServers();
      const requested =
        new URLSearchParams(window.location.search).get("serverId") ?? "";
      const selected = requested || available[0] || "";
      setServers(
        available.includes(selected) || !selected
          ? available
          : [selected, ...available],
      );
      setServerId(selected);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const updateServer = (next: string) => {
    setServerId(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("serverId", next);
    else url.searchParams.delete("serverId");
    window.history.replaceState(null, "", url);
  };

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

  const groups = useMemo(() => {
    const result = new Map<string, PresenceHistoryEvent[]>();
    for (const event of filtered) {
      const label = dayLabel(event.observedAt);
      const list = result.get(label) ?? [];
      list.push(event);
      result.set(label, list);
    }
    return [...result.entries()];
  }, [filtered]);

  const joins = events.filter((event) => event.state === "JOINED").length;
  const leaves = events.filter((event) => event.state === "LEFT").length;
  const uniquePlayers = new Set(events.map((event) => event.uuid)).size;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Control Room / Activity</span>
            <h1>Player activity history</h1>
            <p>
              Join and leave events are stored only in this browser&apos;s LocalStorage.
              The dashboard does not request additional plugin telemetry for this page.
            </p>
          </div>
          <Link className={styles.back} href="/">
            ← Back to dashboard
          </Link>
        </header>

        {servers.length > 1 && (
          <label>
            <span className={styles.eyebrow}>Stored server</span>
            <select
              className={styles.serverSelect}
              value={serverId}
              onChange={(event) => updateServer(event.target.value)}
            >
              {servers.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
        )}

        <section className={styles.stats} aria-label="Activity history summary">
          <article className={styles.stat}>
            <small>Total events</small>
            <strong>{events.length.toLocaleString()}</strong>
          </article>
          <article className={styles.stat}>
            <small>Joins</small>
            <strong>{joins.toLocaleString()}</strong>
          </article>
          <article className={styles.stat}>
            <small>Leaves</small>
            <strong>{leaves.toLocaleString()}</strong>
          </article>
          <article className={styles.stat}>
            <small>Unique players</small>
            <strong>{uniquePlayers.toLocaleString()}</strong>
          </article>
        </section>

        <section className={styles.controls} aria-label="Activity history filters">
          <input
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
            className={styles.danger}
            disabled={!serverId || events.length === 0}
            onClick={() => {
              if (!serverId || !events.length) return;
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

        {!serverId ? (
          <div className={styles.empty}>
            No stored server activity was found in this browser yet. Open the dashboard and
            receive a player join or leave event first.
          </div>
        ) : groups.length ? (
          <section className={styles.groups} aria-label="Stored player activity">
            {groups.map(([label, group]) => (
              <article className={styles.group} key={label}>
                <header className={styles.groupHeader}>
                  <strong>{label}</strong>
                  <span>{group.length.toLocaleString()} events</span>
                </header>
                <div className={styles.list}>
                  {group.map((event) => (
                    <div className={styles.row} key={event.eventId}>
                      <PlayerHead
                        uuid={event.uuid}
                        name={event.name}
                        size={40}
                        online={event.state === "JOINED"}
                      />
                      <div className={styles.identity}>
                        <strong>{event.name}</strong>
                        <small>{event.uuid}</small>
                      </div>
                      <div className={styles.meta}>
                        <span className={styles.badge} data-state={event.state}>
                          {event.state === "JOINED" ? "JOINED" : "LEFT"}
                        </span>
                        <time dateTime={event.observedAt}>{eventTime(event)}</time>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </section>
        ) : (
          <div className={styles.empty}>No activity matches the current filters.</div>
        )}

        <p className={styles.note}>
          Retention is capped at {ACTIVITY_HISTORY_MAX_EVENTS.toLocaleString()} events per server
          to keep browser storage bounded. Clearing site data, using a different browser profile,
          or using another device will not carry this history over.
        </p>
      </div>
    </main>
  );
}

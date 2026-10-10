"use client";

import { Button, Select } from "./ui/workspace";
import { Dialog } from "./ui/primitives";

import { useEffect, useMemo, useRef, useState } from "react";
import { sendDashboardAction } from "../lib/data-source";
import {
  ACTIVITY_PAGE_SIZE, activityPage, activityParameters, liveActivity,
  observation, type ActivityFilters, type ActivityObservation,
} from "../lib/durable-activity";
import { duration, time, type ViewProps } from "./control-views";

interface HistoryPage {
  key: string;
  entries: ActivityObservation[];
  nextCursor: string;
  bounded: boolean;
  capturedAt: string;
  index: number;
}

const INITIAL_FILTERS: ActivityFilters = { query: "", status: "ALL", from: "", to: "" };
const MAX_ACTIVITY_PAGES = 100;

export function ActivityHistoryModal({
  props, open, onClose,
}: {
  props: ViewProps;
  open: boolean;
  onClose: () => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  const [filters, setFilters] = useState<ActivityFilters>(INITIAL_FILTERS);
  const [page, setPage] = useState<HistoryPage | null>(null);
  const [cursors, setCursors] = useState<string[]>([""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const ready = props.state.ready;
  const serverId = props.state.serverId;
  const effectiveScopes = props.deviceGrant?.scopes ?? ready?.device.scopes;
  const scope = Boolean(effectiveScopes?.includes("players.history.view"));
  const capabilityKnown = Boolean(ready &&
    Object.prototype.hasOwnProperty.call(ready.server.paperCapabilities, "players.history.view"));
  const enabled = ready?.server.paperCapabilities["players.history.view"] === true;
  const paperOnline = Boolean(ready?.agents.paper);
  const available = open && props.connected && paperOnline && scope && enabled;
  const sourceKey = `${serverId}:${props.deviceGrant?.deviceId ?? ready?.device.deviceId ?? ""}:${ready?.device.issuedAt ?? ""}:${ready?.server.paperSession ?? ""}:${scope}:${enabled}:${props.connected}:${paperOnline}`;
  const filterKey = JSON.stringify([filters.query, filters.status, filters.from, filters.to]);
  const key = `${sourceKey}:${filterKey}`;
  const current = page?.key === key && available ? page : null;
  const canLive = Boolean(effectiveScopes?.includes("players.view"));
  const live = useMemo(
    () => props.connected && paperOnline && canLive
      ? liveActivity(props.state.presenceDeltas, filters) : [],
    [props.connected, paperOnline, canLive, props.state.presenceDeltas, filters],
  );
  const entries = activityPage(current?.entries ?? [], live, Boolean(current && current.index === 0));

  useEffect(() => {
    if (open) {
      const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    // A late private action result must never appear under another server,
    // session, filter, capability or dialog lifetime.
    const requests = generation;
    const token = ++requests.current;
    pending.current = false;
    if (!available) return;
    const timer = window.setTimeout(async () => {
      pending.current = true;
      setBusy(true);
      setError("");
      setCursors([""]);
      try {
        if (filters.from && filters.to && filters.from > filters.to)
          throw new Error("From must be on or before To.");
        const result = await sendDashboardAction(
          "players.history.list", activityParameters(filters), "PAPER",
        );
        if (generation.current !== token) return;
        if (result.data.historyEnabled !== true)
          throw new Error("Paper reports that local history is disabled.");
        setPage({
          key,
          entries: (Array.isArray(result.data.entries) ? result.data.entries : [])
            .slice(0, ACTIVITY_PAGE_SIZE).map((row) => observation(row, true))
            .filter((row): row is ActivityObservation => row !== null),
          nextCursor: typeof result.data.nextCursor === "string" ? result.data.nextCursor : "",
          bounded: result.data.boundedWindow === true,
          capturedAt: typeof result.data.capturedAt === "string" ? result.data.capturedAt : "",
          index: 0,
        });
      } catch (reason) {
        if (generation.current === token) {
          setPage(null);
          setError(reason instanceof Error ? reason.message : "Paper history is unavailable.");
        }
      } finally {
        if (generation.current === token) {
          pending.current = false;
          setBusy(false);
        }
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      requests.current++;
      pending.current = false;
    };
  }, [available, key, sourceKey, filterKey, filters]);

  async function navigate(index: number, cursor: string) {
    if (!available || pending.current || !current || index >= MAX_ACTIVITY_PAGES) return;
    const token = ++generation.current;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await sendDashboardAction(
        "players.history.list", activityParameters(filters, cursor), "PAPER",
      );
      if (generation.current !== token) return;
      if (result.data.historyEnabled !== true)
        throw new Error("Paper reports that local history is disabled.");
      setPage({
        key, index,
        entries: (Array.isArray(result.data.entries) ? result.data.entries : [])
          .slice(0, ACTIVITY_PAGE_SIZE).map((row) => observation(row, true))
          .filter((row): row is ActivityObservation => row !== null),
        nextCursor: typeof result.data.nextCursor === "string" ? result.data.nextCursor : "",
        bounded: result.data.boundedWindow === true,
        capturedAt: typeof result.data.capturedAt === "string" ? result.data.capturedAt : "",
      });
      if (index >= cursors.length) setCursors((currentCursors) => [...currentCursors.slice(0, index), cursor]);
    } catch (reason) {
      if (generation.current === token)
        setError(reason instanceof Error ? reason.message : "Paper history is unavailable.");
    } finally {
      if (generation.current === token) {
        pending.current = false;
        setBusy(false);
      }
    }
  }

  const unavailable = !props.connected
    ? "The signed relay session is disconnected. History cannot be queried."
    : !scope
    ? "This device lacks players.history.view. Ask the operator to re-pair an approved device; old grants do not gain new scopes."
    : !paperOnline
      ? "Paper is offline. Its local history will be available when it reconnects."
    : !capabilityKnown
      ? "This Paper agent does not advertise player history. Upgrade it to use the local journal."
    : !enabled
        ? "Paper history is off. An operator must enable player-history.enabled locally after reviewing retention and privacy."
        : "";

  return (
    <Dialog open={open} onClose={onClose} title="Player activity" description="Paper's local presence journal is the retained history source.">
      <div className="pp-workspace">
        <section className="pp-toolbar" aria-label="Activity history filters">
          <label>Search player activity<input ref={searchRef} type="search" maxLength={64} placeholder="Player name or UUID"
            aria-label="Search player activity" value={filters.query}
            onChange={(event) => setFilters((value) => ({ ...value, query: event.target.value }))} /></label>
          <Select aria-label="Filter activity type" value={filters.status}
            onValueChange={(selectedValue) => setFilters((value) => ({ ...value, status: selectedValue as ActivityFilters["status"] }))}>
            <option value="ALL">All activity</option><option value="ONLINE">Joins</option><option value="OFFLINE">Leaves</option>
          </Select>
          <label>From <input type="date" value={filters.from}
            onChange={(event) => setFilters((value) => ({ ...value, from: event.target.value }))} /></label>
          <label>To <input type="date" value={filters.to}
            onChange={(event) => setFilters((value) => ({ ...value, to: event.target.value }))} /></label>
        </section>
        <div className="pp-scroll-region" aria-live="polite">
          {unavailable && <div className="pp-notice">{unavailable}</div>}
          {!unavailable && error && <p role="alert" className="pp-notice">{error}</p>}
          {!unavailable && busy && !current && <div className="pp-notice">Querying Paper history…</div>}
          {!unavailable && !busy && !current && !error && <div className="pp-notice">Waiting for Paper history…</div>}
          {!unavailable && current && (
            <>
              <p className="pp-notice" role="status">
                Page {current.index + 1} / {current.entries.length} journal records
                {current.capturedAt ? ` / queried ${time(current.capturedAt)}` : ""}.
                {current.bounded && " Scan or retention limits may omit older observations."}
                {" "}Live rows are transient until they appear in the journal.
              </p>
              {entries.length ? (
                <section className="pp-list" aria-label="Paper player activity">
                  <article className="pp-stack">
                    <header><strong>Newest first</strong><span>{entries.length} shown</span></header>
                    <div>
                      {entries.map((item) => (
                        <div className="pp-list-row" key={item.eventId}>
                          <span className="pp-initial" aria-hidden>{item.name.slice(0, 1).toUpperCase()}</span>
                          <div className="pp-row-details">
                            <strong>{item.name}</strong><small>{item.uuid}</small>
                            {item.termination === "UNKNOWN_DISCONNECT" && <small>Disconnect time unknown</small>}
                            {item.state === "LEFT" && item.sessionDurationMillis !== null && <small>Session {duration(item.sessionDurationMillis)}</small>}
                          </div>
                          <div className="pp-stack">
                            <span data-state={item.state}>{item.state === "JOINED" ? "Joined" : "Left"}</span>
                            <small>{item.durable ? "Paper journal" : "Live / pending"}</small>
                            <time dateTime={item.observedAt} title={item.observedAt}>{time(item.observedAt)}</time>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                </section>
              ) : <div className="pp-notice">No matching journal observations are retained in this bounded page.</div>}
              <div className="pp-row">
                <Button type="button" disabled={busy || current.index === 0}
                  onClick={() => void navigate(current.index - 1, cursors[current.index - 1])}>Newer page</Button>
                <Button type="button" disabled={busy || !current.nextCursor || current.index >= MAX_ACTIVITY_PAGES - 1}
                  onClick={() => void navigate(current.index + 1, current.nextCursor)}>
                  {busy ? "Loading…" : "Older page"}
                </Button>
              </div>
            </>
          )}
          {unavailable && live.length > 0 && (
            <p className="pp-notice">There are {live.length} recent live presence events in this tab only. They are not a historical record.</p>
          )}
        </div>
        <footer className="pp-muted">
          <span>Times use your device time zone. Pages contain at most {ACTIVITY_PAGE_SIZE} journal records; this view caps navigation at {MAX_ACTIVITY_PAGES} pages.</span>
          <span>Retention and scan limits are set locally on Paper.</span>
        </footer>
      </div>
    </Dialog>
  );
}

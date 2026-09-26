"use client";

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
  const dialogRef = useRef<HTMLDialogElement>(null);
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
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
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
    <dialog
      ref={dialogRef}
      className="cr30-activity-dialog"
      aria-labelledby="cr30-activity-dialog-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="cr30-activity-modal-shell">
        <header className="cr30-activity-modal-head">
          <div>
            <span>Control Room / Players</span>
            <h2 id="cr30-activity-dialog-title">Player activity</h2>
            <p>Paper&apos;s local presence journal is the history source. Opening this view keeps the live dashboard session connected.</p>
          </div>
          <button type="button" className="cr30-activity-close" onClick={onClose} aria-label="Close activity history">×</button>
        </header>
        <section className="cr30-activity-modal-controls" aria-label="Activity history filters">
          <input ref={searchRef} type="search" maxLength={64} placeholder="Player name or UUID"
            aria-label="Search player activity" value={filters.query}
            onChange={(event) => setFilters((value) => ({ ...value, query: event.target.value }))} />
          <select aria-label="Filter activity type" value={filters.status}
            onChange={(event) => setFilters((value) => ({ ...value, status: event.target.value as ActivityFilters["status"] }))}>
            <option value="ALL">All activity</option><option value="ONLINE">Joins</option><option value="OFFLINE">Leaves</option>
          </select>
          <label>From <input type="date" value={filters.from}
            onChange={(event) => setFilters((value) => ({ ...value, from: event.target.value }))} /></label>
          <label>To <input type="date" value={filters.to}
            onChange={(event) => setFilters((value) => ({ ...value, to: event.target.value }))} /></label>
        </section>
        <div className="cr30-activity-modal-scroll" aria-live="polite">
          {unavailable && <div className="cr30-activity-modal-empty">{unavailable}</div>}
          {!unavailable && error && <p role="alert" className="cr21-bounded">{error}</p>}
          {!unavailable && busy && !current && <div className="cr30-activity-modal-empty">Querying Paper history…</div>}
          {!unavailable && !busy && !current && !error && <div className="cr30-activity-modal-empty">Waiting for Paper history…</div>}
          {!unavailable && current && (
            <>
              <p className="cr21-bounded" role="status">
                Page {current.index + 1} · {current.entries.length} journal records
                {current.capturedAt ? ` · queried ${time(current.capturedAt)}` : ""}.
                {current.bounded && " Scan or retention limits may omit older observations."}
                {" "}Live rows are transient until they appear in the journal.
              </p>
              {entries.length ? (
                <section className="cr30-activity-modal-groups" aria-label="Paper player activity">
                  <article className="cr30-activity-modal-group">
                    <header><strong>Newest first</strong><span>{entries.length} shown</span></header>
                    <div>
                      {entries.map((item) => (
                        <div className="cr30-activity-modal-row" key={item.eventId}>
                          <span className="cr30-activity-initial" aria-hidden>{item.name.slice(0, 1).toUpperCase()}</span>
                          <div className="cr30-activity-modal-identity">
                            <strong>{item.name}</strong><small>{item.uuid}</small>
                            {item.termination === "UNKNOWN_DISCONNECT" && <small>Disconnect time unknown</small>}
                            {item.state === "LEFT" && item.sessionDurationMillis !== null && <small>Session {duration(item.sessionDurationMillis)}</small>}
                          </div>
                          <div className="cr30-activity-modal-meta">
                            <span data-state={item.state}>{item.state === "JOINED" ? "Joined" : "Left"}</span>
                            <small>{item.durable ? "Paper journal" : "Live · pending"}</small>
                            <time dateTime={item.observedAt} title={item.observedAt}>{time(item.observedAt)}</time>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                </section>
              ) : <div className="cr30-activity-modal-empty">No matching journal observations are retained in this bounded page.</div>}
              <div className="cr30-activity-load-more">
                <button type="button" disabled={busy || current.index === 0}
                  onClick={() => void navigate(current.index - 1, cursors[current.index - 1])}>Newer page</button>
                <button type="button" disabled={busy || !current.nextCursor || current.index >= MAX_ACTIVITY_PAGES - 1}
                  onClick={() => void navigate(current.index + 1, current.nextCursor)}>
                  {busy ? "Loading…" : "Older page"}
                </button>
              </div>
            </>
          )}
          {unavailable && live.length > 0 && (
            <p className="cr21-bounded">There are {live.length} recent live presence events in this tab only. They are not a historical record.</p>
          )}
        </div>
        <footer className="cr30-activity-modal-foot">
          <span>Times use your device time zone. Pages contain at most {ACTIVITY_PAGE_SIZE} journal records; this view caps navigation at {MAX_ACTIVITY_PAGES} pages.</span>
          <span>Retention and scan limits are set locally on Paper.</span>
        </footer>
      </div>
    </dialog>
  );
}

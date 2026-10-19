"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  canRead,
  session,
  useControl,
  usePrefs,
  useQuery,
  records,
  type JsonMap,
} from "../bindings";
import { consoleRowId } from "../console/parse-line";
import { historyWindow, retainHistoryPage } from "../console/history-window";
import {
  ingestConsole,
  ingestPresence,
  ingestRoster,
  __resetPlayerEvents,
  type PresenceDelta,
} from "./player-events";

interface BootHistory {
  bootId?: string;
  epoch: string;
  allowed: boolean;
  canLoadEarlier: boolean;
  lines: JsonMap[];
  error: string;
  loading: boolean;
  historical: boolean;
  nextCursor?: string;
  loadEarlier: () => void;
  latest: () => void;
}
const EMPTY: BootHistory = {
  epoch: "",
  allowed: false,
  canLoadEarlier: false,
  lines: [],
  error: "",
  loading: false,
  historical: false,
  loadEarlier: () => {},
  latest: () => {},
};
const Context = createContext<BootHistory>(EMPTY);
export const useBootHistory = () => useContext(Context);
export function eventTimestamp(value: unknown): number | undefined {
  const at =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Date.parse(value)
        : NaN;
  return Number.isFinite(at) ? at : undefined;
}
/** One query seam shared with LiveConsole; no second transport or route-local feeder. */
export function PlayerEventsFeeder({ children }: { children: ReactNode }) {
  const snap = useControl(),
    s = snap.state,
    prefs = usePrefs(),
    epoch = String(
      s.service.invocationId ?? s.ready?.server.paperSession ?? "",
    ),
    bootId = epoch ? `${s.serverId}/${epoch}` : undefined,
    allowed = canRead(snap, "players.view") || canRead(snap, "overview.view"),
    historyAction = session.reason("console.history", "HOST")
      ? "console.history.errors"
      : "console.history",
    identity = [
      bootId,
      snap.revision,
      historyAction,
      s.ready?.device.scopes.join("|"),
    ].join(":"),
    [window, setWindow] = useState<{
      identity: string;
      cursor?: string;
      older: JsonMap[];
    }>({ identity: "", older: [] }),
    cursor = window.identity === identity ? window.cursor : undefined,
    older = window.identity === identity ? window.older : EMPTY.lines,
    history = useQuery(
      historyAction,
      "HOST",
      cursor ? { cursor } : {},
      !!bootId,
    ),
    page = useMemo(
      () => records(history.data.lines, 6000),
      [history.data.lines],
    ),
    lines = useMemo(
      () =>
        historyWindow(
          older,
          page,
          s.console,
          !!cursor,
          6000,
          (l) => consoleRowId(l, epoch),
          (l) => eventTimestamp(l.capturedAt ?? l.timestamp) ?? 0,
        ),
      [older, page, s.console, cursor, epoch],
    ),
    timezone =
      prefs.timezone === "UTC"
        ? "UTC"
        : Intl.DateTimeFormat().resolvedOptions().timeZone;
  useEffect(() => {
    if (!allowed) __resetPlayerEvents();
  }, [allowed]);
  useEffect(() => {
    if (!bootId || !allowed) return;
    const anchor = Date.now();
    // History paging does not pause live event collection.
    ingestConsole(
      bootId,
      [...page, ...s.console].map((l) => ({
        seq: consoleRowId(l, epoch),
        ts: eventTimestamp(l.capturedAt ?? l.timestamp ?? l.observedAt),
        clock: typeof l.clock === "string" ? l.clock : undefined,
        text: String(l.content ?? l.message ?? ""),
        level: String(l.level ?? ""),
      })),
      { tz: timezone, anchor },
    );
  }, [bootId, allowed, page, s.console, epoch, timezone]);
  useEffect(() => {
    if (!bootId || !allowed) return;
    const byBoot = new Map<string, PresenceDelta[]>();
    for (const d of s.presenceDeltas) {
      const state = String(d.state ?? d.eventType ?? "").toUpperCase(),
        kind = ["JOIN", "JOINED", "ONLINE"].includes(state)
          ? "join"
          : ["LEAVE", "LEFT", "OFFLINE"].includes(state)
            ? "leave"
            : undefined,
        ts = eventTimestamp(d.observedAt ?? d.timestamp ?? d.capturedAt),
        name = String(d.name ?? d.playerName ?? "");
      if (!kind || ts === undefined || !name) continue;
      const sourceEpoch = String(
          d.epoch ?? d.bootEpoch ?? d.sessionEpoch ?? epoch,
        ),
        id = `${s.serverId}/${sourceEpoch}`;
      const list = byBoot.get(id) ?? [];
      list.push({
        ts,
        kind,
        player: name,
        uuid: typeof d.uuid === "string" ? d.uuid : undefined,
      });
      byBoot.set(id, list);
    }
    // Ingest oldest boot first, so the bounded store always retains the active boot.
    for (const [id, deltas] of [...byBoot].sort(
      (a, b) => (a[1][0]?.ts ?? 0) - (b[1][0]?.ts ?? 0),
    ))
      ingestPresence(id, deltas);
  }, [bootId, allowed, s.presenceDeltas, s.serverId, epoch]);
  useEffect(() => {
    if (
      !bootId ||
      !allowed ||
      !s.ready?.agents.paper ||
      !canRead(snap, "players.view")
    )
      return;
    // An incomplete reconnect snapshot is not evidence that everyone left.
    if (!s.inventoryIds?.players && !s.players.length) return;
    ingestRoster(
      bootId,
      s.players.map((p) => ({
        name: String(p.name ?? ""),
        uuid: typeof p.uuid === "string" ? p.uuid : undefined,
        sessionStartedAt: eventTimestamp(p.sessionStartedAt),
      })),
    );
  }, [
    bootId,
    allowed,
    s.ready?.agents.paper,
    s.inventoryIds?.players,
    s.players,
    snap.grant,
    s.ready?.device,
  ]);
  const nextCursor =
    typeof history.data.nextCursor === "string"
      ? history.data.nextCursor
      : undefined;
  return (
    <Context.Provider
      value={{
        bootId,
        epoch,
        allowed,
        canLoadEarlier: canRead(snap, "players.history.view"),
        lines,
        error: history.error,
        loading: history.loading,
        historical: !!cursor,
        nextCursor,
        loadEarlier: () => {
          if (nextCursor && !history.loading)
            setWindow({
              identity,
              cursor: nextCursor,
              older: retainHistoryPage(older, page, 5000),
            });
        },
        latest: () => setWindow({ identity, older: [] }),
      }}
    >
      {children}
    </Context.Provider>
  );
}

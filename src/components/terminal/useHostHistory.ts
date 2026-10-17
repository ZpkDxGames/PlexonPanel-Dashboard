import { useCallback, useEffect, useRef, useState } from "react";
import { hasScope } from "../../presentation/authority";
import { useSession } from "../../hooks";
import { session } from "../../adapter/session";
import {
  mergeConsoleLines,
  record,
  records,
  type JsonMap,
} from "../../adapter/control-state";
export function useHostHistory(query: string, level: string) {
  const snap = useSession(),
    [history, setHistory] = useState<JsonMap[]>([]),
    [cursor, setCursor] = useState<string | undefined>(),
    [more, setMore] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const full = hasScope(snap, "console.view.full"),
    errors = hasScope(snap, "console.view.errors");
  const generation = useRef(0),
    epoch = snap.state.bootEpochId,
    revision = snap.revision;
  const read = useCallback(
    async (older = false) => {
      const ticket = ++generation.current,
        action = session.reason("console.history", "HOST")
          ? "console.history.errors"
          : "console.history";
      if (!epoch || session.reason(action, "HOST")) return;
      setBusy(true);
      setError("");
      try {
        const response = await session.query(
            action,
            {
              limit: 100,
              ...(query ? { query } : {}),
              ...(level !== "all" ? { levels: [level.toUpperCase()] } : {}),
              ...(older && cursor ? { cursor } : {}),
              invocationId: epoch,
            },
            "HOST",
          ),
          data = record(response.data),
          current = session.getSnapshot();
        if (
          ticket !== generation.current ||
          revision !== current.revision ||
          epoch !== current.state.bootEpochId ||
          data.bootEpochId !== epoch
        )
          return;
        const lines = records(data.lines, 200);
        setHistory((old) => (older ? mergeConsoleLines(lines, old) : lines));
        setMore(data.hasMore === true);
        setCursor(
          typeof data.nextCursor === "string" ? data.nextCursor : undefined,
        );
      } catch (cause) {
        if (ticket === generation.current)
          setError(
            cause instanceof Error ? cause.message : "Host history unavailable",
          );
      } finally {
        if (ticket === generation.current) setBusy(false);
      }
    },
    [epoch, revision, query, level, cursor, full, errors],
  );
  const latest = useRef(read);
  latest.current = read;
  useEffect(() => {
    generation.current++;
    setHistory([]);
    setMore(false);
    setCursor(undefined);
    setBusy(false);
    const timer = setTimeout(() => void latest.current(false), 250);
    return () => {
      clearTimeout(timer);
      generation.current++;
    };
  }, [epoch, revision, query, level, full, errors]);
  const merged = mergeConsoleLines(history, snap.state.console),
    authorized = full
      ? merged
      : errors
        ? merged.filter((row) => ["WARN", "ERROR"].includes(String(row.level)))
        : [];
  return {
    lines: authorized,
    more,
    busy,
    error,
    refresh: () => read(false),
    older: () => read(true),
  };
}

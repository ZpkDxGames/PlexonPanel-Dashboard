import { useCallback, useEffect, useRef, useState } from "react";
import { session, type Kind } from "../adapter/session";
import { record, type JsonMap } from "../adapter/control-state";
import { useSession } from "../hooks";
/** Invalidates reads with the selected server/grant. A response cannot hydrate another target. */
export function useQuery(
  action: string,
  kind: Kind = "HOST",
  parameters: JsonMap = {},
  interval = 0,
) {
  const snap = useSession(),
    key = JSON.stringify(parameters),
    generation = useRef(0);
  const [value, setValue] = useState<{
    data: JsonMap;
    error: string;
    busy: boolean;
    at: number;
  }>({ data: {}, error: "", busy: false, at: 0 });
  const query = useCallback(async () => {
    const ticket = ++generation.current,
      revision = snap.revision,
      serverId = snap.state.serverId;
    const reason = session.reason(action, kind);
    if (reason) {
      setValue({ data: {}, error: reason, busy: false, at: 0 });
      return;
    }
    setValue((v) => ({ ...v, busy: true, error: "" }));
    try {
      const response = await session.query(action, JSON.parse(key), kind);
      const current = session.getSnapshot();
      if (
        ticket !== generation.current ||
        revision !== current.revision ||
        serverId !== current.state.serverId
      )
        return;
      if (response.status !== "SUCCESS")
        throw new Error(response.message || response.code);
      setValue({
        data: record(response.data),
        error: "",
        busy: false,
        at: Date.now(),
      });
    } catch (e) {
      if (ticket === generation.current)
        setValue({
          data: {},
          error: e instanceof Error ? e.message : "Query unavailable",
          busy: false,
          at: 0,
        });
    }
  }, [action, kind, key, snap.revision, snap.phase, snap.state.serverId]);
  useEffect(() => {
    setValue({ data: {}, error: "", busy: false, at: 0 });
    void query();
    const timer = interval
      ? setInterval(() => {
          if (!document.hidden) void query();
        }, interval)
      : undefined;
    return () => {
      generation.current++;
      clearInterval(timer);
    };
  }, [query, interval]);
  return { ...value, refresh: query };
}

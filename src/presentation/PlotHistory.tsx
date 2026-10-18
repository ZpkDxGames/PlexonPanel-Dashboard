import { useSession } from "../hooks";
import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type { ControlState, Sample } from "../adapter/control-state";
import type { Source } from "./telemetry";
import { SourceEpochs } from "./epochs";
type PlotViews = Record<Source, Sample[]>;
const History = createContext<{ raw: Sample[]; sources: PlotViews } | null>(
  null,
);
export function PlotHistoryProvider({
  state,
  revision,
  children,
}: {
  state: ControlState;
  revision: number;
  children: ReactNode;
}) {
  const epochs = useRef<SourceEpochs | null>(null);
  if (!epochs.current) epochs.current = new SourceEpochs();
  epochs.current.update(state, revision);
  const generation = `${revision}:${state.ready?.server.paperSession}:${state.ready?.server.hostSession}:${state.ready?.agents.paper}:${state.ready?.agents.host}`;
  const value = useMemo(
    () =>
      Object.fromEntries(
        (
          ["paperHealth", "paperSystem", "hostSystem", "service"] as Source[]
        ).map((source) => [
          source,
          epochs.current!.view(state.history, source),
        ]),
      ) as Record<Source, Sample[]>,
    [state.history, generation],
  );
  const owned = useMemo(
    () => ({ raw: state.history, sources: value }),
    [state.history, value],
  );
  return <History.Provider value={owned}>{children}</History.Provider>;
}
/** Never substitute the selected server’s history for a passive fleet row. */
export function usePlotHistory(raw?: Sample[]) {
  const value = useContext(History);
  return value && (!raw || raw === value.raw) ? value.sources : null;
}

export function SessionPlotHistoryProvider({
  children,
}: {
  children: ReactNode;
}) {
  const snap = useSession();
  return (
    <PlotHistoryProvider state={snap.state} revision={snap.revision}>
      {children}
    </PlotHistoryProvider>
  );
}

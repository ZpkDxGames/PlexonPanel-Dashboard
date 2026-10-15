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
const History = createContext<Record<Source, Sample[]> | null>(null);
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
  return <History.Provider value={value}>{children}</History.Provider>;
}
export const usePlotHistory = () => useContext(History);

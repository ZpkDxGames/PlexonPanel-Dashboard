"use client";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useHostInvoke } from "./host-invoke";
import { session, useQuery, type JsonMap } from "./index";
import { normalizePreflight, type PreflightView } from "./backups-model";
import { normalizeMaintenance, remainingCountdown } from "./maintenance-model";
export {
  normalizeMaintenance,
  remainingCountdown,
  formatMmSs,
} from "./maintenance-model";
export type { MaintenanceView, CountdownKind } from "./maintenance-model";
function useDurabilitySource() {
  const invoke = useHostInvoke(),
    config = useQuery("maintenance.settings.get"),
    [statusData, setStatusData] = useState<JsonMap>({}),
    [snap, setSnap] = useState(() => normalizeMaintenance(null, 0)),
    [preflight, setPreflight] = useState<PreflightView | null>(null),
    [preflightBusy, setPreflightBusy] = useState(true),
    [preflightError, setPreflightError] = useState(""),
    [statusError, setStatusError] = useState(""),
    [tick, setTick] = useState(0),
    alive = useRef(false),
    polling = useRef(false),
    scanning = useRef(false);
  const pull = useCallback(async () => {
    if (polling.current) return;
    polling.current = true;
    try {
      const data = await invoke("maintenance.status");
      if (alive.current) {
        setStatusData(data);
        setSnap(normalizeMaintenance(data));
        setStatusError("");
      }
    } catch (error) {
      if (alive.current) setStatusError((error as Error).message);
    } finally {
      polling.current = false;
    }
  }, [invoke]);
  const runPreflight = useCallback(
    async (fresh = false) => {
      if (scanning.current) return;
      scanning.current = true;
      if (alive.current) setPreflightBusy(true);
      try {
        const data = await invoke("backup.preflight", { fresh });
        if (alive.current) {
          setPreflight(normalizePreflight(data));
          setPreflightError("");
        }
      } catch (error) {
        // A failed refresh must not leave a previous green report actionable.
        if (alive.current) {
          setPreflight(null);
          setPreflightError((error as Error).message);
        }
      } finally {
        scanning.current = false;
        if (alive.current) setPreflightBusy(false);
      }
    },
    [invoke],
  );
  useEffect(() => {
    alive.current = true;
    void pull();
    void runPreflight();
    const statusPoll = setInterval(() => {
      if (!document.hidden) void pull();
    }, 5000);
    const preflightPoll = setInterval(() => {
      if (!document.hidden) void runPreflight();
    }, 30000);
    const visible = () => {
      if (!document.hidden) {
        void pull();
        void runPreflight();
      }
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive.current = false;
      clearInterval(statusPoll);
      clearInterval(preflightPoll);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [pull, runPreflight]);
  useEffect(() => {
    if (snap.countdownState !== "ACTIVE") return;
    const timer = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, [snap.countdownState]);
  const refresh = useCallback(async () => {
    await Promise.all([pull(), runPreflight(true)]);
    config.retry();
  }, [pull, runPreflight, config.retry]);
  void tick;
  return {
    ...snap,
    remainingSeconds: remainingCountdown(
      snap,
      typeof performance === "undefined" ? 0 : performance.now(),
    ),
    statusData: session.reason("maintenance.status", "HOST") ? {} : statusData,
    statusError,
    preflight: session.reason("backup.preflight", "HOST") ? null : preflight,
    preflightBusy,
    preflightError,
    config,
    invoke,
    refresh,
    rerun: runPreflight,
  };
}
const DurabilityContext = createContext<ReturnType<
  typeof useDurabilitySource
> | null>(null);
/** One status/preflight subscription shared by the header and workbench. */
export function DurabilityProvider({ children }: { children: ReactNode }) {
  const value = useDurabilitySource();
  return createElement(DurabilityContext.Provider, { value }, children);
}
export function useMaintenanceCountdown() {
  const context = useContext(DurabilityContext);
  if (!context) throw new Error("DurabilityProvider is required.");
  return context;
}
